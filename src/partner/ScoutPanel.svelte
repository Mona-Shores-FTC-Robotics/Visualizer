<script lang="ts">
  /**
   * The partner page's match menu and plans: our events and matches from FTCScout, the partner
   * team in each, and the team's saved plan for them (scouting.ts): what their Auto does and which
   * of ours runs beside it, with notes. Picking a match or a team loads its plan onto the field;
   * Save puts what the field shows, and the notes, in the team's record on GitHub.
   */
  import { onMount } from "svelte";
  import { saveToken, savedToken, whoAmI } from "../lib/github/api";
  import {
    currentEvent,
    eventInfo,
    ourEvents,
    seasonOf,
    type EventInfo,
    type OurMatch,
    type ScoutEvent,
  } from "./ftcscout";
  import {
    knownAutos,
    loadLibrary,
    loadPlans,
    planFor,
    planKey,
    savePlan,
    type EventPlans,
    type PartnerLibrary,
    type PlanRecord,
  } from "./scouting";
  import type { PartnerRoute } from "./route";

  interface Props {
    event: string | null;
    team: number | null;
    match: string | null;
    /** What the field shows now, as a plan would keep it. */
    current: {
      ours: string | null;
      off: string[];
      partner: PartnerRoute;
    };
    /** The link already held a look: the first plan loaded does not replace it. */
    keepLinkLook: boolean;
    /** Show a plan on the field (null: none saved, start a fresh drawing), and the match's alliance. */
    onApply: (
      record: PlanRecord | null,
      alliance: "red" | "blue" | null,
    ) => void;
    autoName: (file: string) => string;
    /** Put one of the team's known Autos on the field. */
    onPickRoute: (route: PartnerRoute) => void;
  }
  let {
    event = $bindable(),
    team = $bindable(),
    match = $bindable(),
    current,
    keepLinkLook,
    onApply,
    autoName,
    onPickRoute,
  }: Props = $props();

  const season = seasonOf(new Date());
  let events = $state.raw<ScoutEvent[]>([]);
  let info = $state.raw<EventInfo | null>(null);
  let plans = $state.raw<EventPlans | null>(null);
  /** Every team's known Autos this season (scouting.ts). */
  let library = $state.raw<PartnerLibrary | null>(null);
  let error = $state<string | null>(null);
  let loading = $state(false);
  let notes = $state("");
  let saving = $state(false);
  let saveMessage = $state<{ ok: boolean; text: string } | null>(null);
  let token = $state<string | null>(savedToken());
  let login = $state<string | null>(null);
  let tokenInput = $state("");
  let showConnect = $state(false);
  let firstApply = true;

  const record = $derived(team ? planFor(plans, team, match) : null);
  const matchOwn = $derived(
    team && match ? (plans?.plans[planKey(team, match)] ?? null) : null,
  );
  const teamName = $derived(
    info?.teams.find((t) => t.number === team)?.name ?? "",
  );
  const thisMatch = $derived(
    info?.matches.find((m) => m.key === match && m.partner === team) ?? null,
  );
  const same = (a: unknown, b: unknown) =>
    JSON.stringify(a) === JSON.stringify(b);
  const dirty = $derived(
    !record
      ? current.partner !== null || notes.trim() !== ""
      : !same(record.partner, current.partner) ||
          record.ours !== current.ours ||
          !same([...record.off].sort(), [...current.off].sort()) ||
          record.notes !== notes,
  );

  onMount(() => {
    void (async () => {
      try {
        events = await ourEvents(season);
        if (!event || !events.some((e) => e.code === event))
          event =
            currentEvent(events, new Date().toISOString().slice(0, 10))?.code ??
            null;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    })();
    loadLibrary(season)
      .then((l) => (library = l))
      .catch(() => (library = null));
    if (token)
      whoAmI(token)
        .then((l) => (login = l))
        .catch(() => (login = null));
  });

  // A new event: its teams, our matches and the team's plans.
  $effect(() => {
    const code = event;
    if (!code) return;
    loading = true;
    error = null;
    void Promise.all([eventInfo(season, code), loadPlans(season, code)])
      .then(([i, p]) => {
        if (event !== code) return;
        info = i;
        plans = p;
        if (team) {
          const r = planFor(p, team, match);
          notes = r?.notes ?? "";
          if (!(firstApply && keepLinkLook)) onApply(r, null);
        }
        firstApply = false;
      })
      .catch((e) => {
        if (event === code) error = e instanceof Error ? e.message : String(e);
      })
      .finally(() => {
        if (event === code) loading = false;
      });
  });

  function pickMatch(m: OurMatch) {
    team = m.partner;
    match = m.key;
    saveMessage = null;
    const r = m.partner ? planFor(plans, m.partner, m.key) : null;
    notes = r?.notes ?? "";
    onApply(r, m.alliance);
  }

  function pickTeam(n: number | null) {
    team = n;
    match = null;
    saveMessage = null;
    const r = n ? planFor(plans, n, null) : null;
    notes = r?.notes ?? "";
    if (n) onApply(r, null);
  }

  async function connect() {
    const value = tokenInput.trim();
    if (!value) return;
    try {
      login = await whoAmI(value);
      saveToken(value);
      token = value;
      tokenInput = "";
      showConnect = false;
      saveMessage = null;
    } catch {
      saveMessage = {
        ok: false,
        text: "GitHub did not accept that token. Check it and paste it again.",
      };
    }
  }

  async function save(forMatch: boolean) {
    if (!event || !team || !info) return;
    if (!token) {
      showConnect = true;
      return;
    }
    saving = true;
    saveMessage = null;
    const key = planKey(team, forMatch ? match : null);
    try {
      ({ plans, library } = await savePlan(
        season,
        event,
        key,
        {
          team,
          match: forMatch ? match : null,
          ours: current.ours,
          off: current.off,
          partner: current.partner,
          notes: notes.trim(),
        },
        info.event.name,
      ));
      saveMessage = {
        ok: true,
        text: `Saved for the team${forMatch ? ` in ${match} only` : ` at ${info.event.name}`}.`,
      };
    } catch (e) {
      saveMessage = {
        ok: false,
        text: `Not saved: ${e instanceof Error ? e.message : String(e)} Your changes are still here; try again.`,
      };
    } finally {
      saving = false;
    }
  }

  async function removeMatchPlan() {
    if (!event || !team || !match || !info) return;
    saving = true;
    try {
      ({ plans, library } = await savePlan(
        season,
        event,
        planKey(team, match),
        null,
        info.event.name,
      ));
      const r = planFor(plans, team, match);
      notes = r?.notes ?? "";
      onApply(r, null);
      saveMessage = { ok: true, text: `${match} uses ${team}'s plan again.` };
    } catch (e) {
      saveMessage = {
        ok: false,
        text: `Not removed: ${e instanceof Error ? e.message : String(e)}`,
      };
    } finally {
      saving = false;
    }
  }

  const when = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? ""
      : d.toLocaleString([], {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
        });
  };
  const hasPlan = (n: number | null, key: string | null) =>
    n !== null && planFor(plans, n, key) !== null;
  /** "Nov 20": the event's first day, short enough to fit a phone's menu. */
  const dates = (e: ScoutEvent) =>
    new Date(`${e.start}T12:00:00`).toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
</script>

<section class="scout">
  <h2>Match</h2>
  {#if error}<p class="note warn">{error}</p>{/if}
  <label class="field">
    <span>Event</span>
    <select
      aria-label="Event"
      bind:value={event}
      onchange={() => {
        team = null;
        match = null;
        notes = "";
        saveMessage = null;
      }}
      disabled={!events.length}
    >
      {#if !events.length}<option value={event}>Loading from FTCScout…</option
        >{/if}
      {#each events as e (e.code)}
        <option value={e.code}>{e.name} · {dates(e)}</option>
      {/each}
    </select>
  </label>

  {#if info}
    {#if info.matches.length}
      <div class="matches" role="group" aria-label="Our matches">
        {#each info.matches as m (m.key + m.us)}
          <button
            type="button"
            class="match {m.alliance}"
            aria-pressed={match === m.key && team === m.partner}
            onclick={() => pickMatch(m)}
          >
            <b>{m.key}</b>
            <small>{m.us} + {m.partner ?? "?"}</small>
            {#if hasPlan(m.partner, m.key)}<i class="planned" title="Plan saved"
                >✓</i
              >{/if}
          </button>
        {/each}
      </div>
    {:else if !loading}
      <p class="note">
        No match schedule on FTCScout yet. Pick the partner team you are talking
        to:
      </p>
    {/if}
    <label class="field">
      <span>Partner</span>
      <select
        aria-label="Partner team"
        value={team ?? ""}
        onchange={(e) => {
          const v = Number(e.currentTarget.value);
          pickTeam(v > 0 ? v : null);
        }}
      >
        <option value="">Pick a team…</option>
        {#each info.teams.filter((t) => t.number !== 19429 && t.number !== 20245) as t (t.number)}
          <option value={t.number}
            >{t.number} {t.name}{hasPlan(t.number, null) ? " ✓" : ""}</option
          >
        {/each}
      </select>
    </label>
  {:else if loading}
    <p class="note">Loading the event…</p>
  {/if}

  {#if team && info}
    <div class="plan">
      <div class="planhead">
        <b>{team}{teamName ? ` ${teamName}` : ""}</b>
        {#if thisMatch}<span class="tag {thisMatch.alliance}"
            >{thisMatch.key} · {thisMatch.alliance === "red" ? "Red" : "Blue"} · with
            {thisMatch.us}</span
          >{/if}
      </div>
      <p class="status">
        {#if record}
          {record.match ? `Plan for ${record.match} only` : "Plan"} saved{record.savedBy
            ? ` by ${record.savedBy}`
            : ""}{record.savedAt ? `, ${when(record.savedAt)}` : ""}{record.ours
            ? `. We run ${autoName(record.ours)}`
            : ""}.
        {:else}
          No plan yet. Set their Auto under Partner below (start from a
          stand-in, move its spots, set its times), then save.
        {/if}
        {#if dirty}<span class="unsaved">Not saved</span>{/if}
      </p>
      {#if knownAutos(library, team).length}
        <div class="known" role="group" aria-label="Their known Autos">
          <span>Their Autos</span>
          {#each knownAutos(library, team) as known (known.route.name)}
            <button
              type="button"
              aria-pressed={current.partner.name === known.route.name}
              onclick={() => onPickRoute(known.route)}
              >{known.route.name}</button
            >
          {/each}
        </div>
      {/if}
      <p class="note">
        Name their Auto under Partner (what they call it: X, Y…) and it is kept
        for {team}, for this event and the next.
      </p>
      <label class="field notes">
        <span>Notes</span>
        <textarea
          rows="3"
          bind:value={notes}
          placeholder="What they said: start side, preloads, when they move, where they park, who calls the TIP…"
        ></textarea>
      </label>

      {#if token}
        <div class="saves">
          <button
            type="button"
            class="btn primary"
            disabled={saving || !current.partner}
            onclick={() => save(false)}
            >{saving ? "Saving…" : `Save for ${team}`}</button
          >
          {#if match}
            <button
              type="button"
              class="btn"
              disabled={saving || !current.partner}
              onclick={() => save(true)}>Save for {match} only</button
            >
          {/if}
        </div>
        {#if matchOwn}
          <button
            type="button"
            class="linkbtn"
            disabled={saving}
            onclick={removeMatchPlan}
            >{match} has its own plan: remove it and use {team}'s</button
          >
        {/if}
        <p class="note">
          Saving as {login ?? "…"} to biobuzz's <code>scouting</code> branch:
          the whole team sees it.
          <button
            type="button"
            class="linkbtn"
            onclick={() => {
              saveToken(null);
              token = null;
              login = null;
            }}>Disconnect</button
          >
        </p>
      {:else}
        <button
          type="button"
          class="btn primary"
          onclick={() => (showConnect = !showConnect)}
          >Connect GitHub to save</button
        >
      {/if}
      {#if showConnect && !token}
        <div class="connect">
          <p class="note">
            Paste the team's GitHub token once on this phone (the one Save to
            GitHub uses: Contents read and write on biobuzz). It stays in this
            browser only.
          </p>
          <input
            type="password"
            autocomplete="off"
            bind:value={tokenInput}
            placeholder="github_pat_…"
            aria-label="GitHub token"
          />
          <button type="button" class="btn" onclick={connect}>Connect</button>
        </div>
      {/if}
      {#if saveMessage}
        <p class="note" class:warn={!saveMessage.ok} class:ok={saveMessage.ok}>
          {saveMessage.text}
        </p>
      {/if}
    </div>
  {/if}
</section>

<style>
  section {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 14px 16px;
    display: grid;
    gap: 10px;
    min-width: 0;
  }
  h2 {
    margin: 0;
    font-size: 19px;
  }
  .field {
    display: grid;
    grid-template-columns: 4.6em minmax(0, 1fr);
    align-items: center;
    gap: 10px;
  }
  .field > span {
    font-size: 13px;
    font-weight: 700;
    color: var(--muted);
  }
  .field.notes {
    align-items: start;
  }
  .field.notes > span {
    padding-top: 10px;
  }
  select,
  textarea,
  input {
    font: inherit;
    font-size: 16px;
    color: var(--ink);
    background: var(--seg);
    border: 1px solid var(--line);
    border-radius: 9px;
    padding: 8px 10px;
    min-height: 44px;
    width: 100%;
    min-width: 0;
  }
  textarea {
    resize: vertical;
    line-height: 1.35;
  }
  .matches {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .match {
    font: inherit;
    position: relative;
    display: grid;
    justify-items: start;
    min-height: 48px;
    min-width: 5.6em;
    padding: 5px 10px 5px 12px;
    border-radius: 10px;
    border: 1px solid var(--line);
    border-left: 5px solid;
    background: var(--seg);
    color: var(--ink);
    cursor: pointer;
    line-height: 1.2;
  }
  .match.red {
    border-left-color: #c62828;
  }
  .match.blue {
    border-left-color: #1f5fd6;
  }
  .match small {
    color: var(--muted);
    font-size: 11.5px;
  }
  .match[aria-pressed="true"] {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
  }
  .match[aria-pressed="true"] small {
    color: inherit;
  }
  .planned {
    position: absolute;
    top: 3px;
    right: 6px;
    font-style: normal;
    font-weight: 800;
    font-size: 12px;
    color: var(--good-ink);
  }
  .match[aria-pressed="true"] .planned {
    color: inherit;
  }
  .plan {
    display: grid;
    gap: 8px;
    border-top: 1px solid var(--line);
    padding-top: 10px;
  }
  .planhead {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 10px;
    font-size: 17px;
  }
  .tag {
    font-size: 12px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
    color: #fff;
  }
  .tag.red {
    background: #c62828;
  }
  .tag.blue {
    background: #1f5fd6;
  }
  .status {
    margin: 0;
    font-size: 14px;
  }
  .unsaved {
    display: inline-block;
    margin-left: 6px;
    font-size: 12px;
    font-weight: 700;
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--trial);
    color: var(--trial-ink);
  }
  .saves {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9em, 1fr));
    gap: 8px;
  }
  .btn {
    font: inherit;
    font-size: 15px;
    font-weight: 700;
    min-height: 46px;
    padding: 6px 10px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: var(--seg);
    color: var(--ink);
    cursor: pointer;
  }
  .known {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .known > span {
    font-size: 13px;
    font-weight: 700;
    color: var(--muted);
    margin-right: 4px;
  }
  .known button {
    font: inherit;
    font-size: 15px;
    font-weight: 700;
    min-height: 44px;
    min-width: 3em;
    padding: 6px 12px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: var(--seg);
    color: var(--ink);
    cursor: pointer;
  }
  .known button[aria-pressed="true"] {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
  }
  .btn.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
  }
  .btn:disabled {
    opacity: 0.55;
  }
  .linkbtn {
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    background: none;
    border: 0;
    padding: 6px 0;
    color: var(--accent);
    cursor: pointer;
    text-align: left;
  }
  .connect {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
  }
  .connect .note {
    grid-column: 1 / -1;
  }
  .note {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }
  .note.warn {
    color: var(--warn-ink);
  }
  .note.ok {
    color: var(--good-ink);
    font-weight: 700;
  }
  code {
    font-family: var(--mono);
    font-size: 12.5px;
  }
  button:focus-visible,
  select:focus-visible,
  textarea:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
</style>
