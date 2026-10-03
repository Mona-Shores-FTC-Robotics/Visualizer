<script lang="ts">
  /**
   * The left panel while several Autos play together (a team pair, or files picked in
   * multi-path mode): one shared 0–30 s timeline with a lane per robot, the simulator's lanes
   * under them, near-collisions, the chosen robot's cards (read only) and the pair's latest
   * simulation result. Editing one robot opens it in the Auto editor (App.svelte).
   */
  import type { PathCatalog } from "../auto/geometry";
  import type { PartnerTimes, PreviewResult } from "../auto/simulate";
  import { AUTO_LENGTH_S } from "../auto/simulate";
  import { cardTitle, isPlainWait, rowLabel } from "../auto/tree";
  import type { AutoCard, AutoSection } from "../auto/types";
  import { SECTION_CLASS, ACTION_CLASS, seconds } from "../auto/components/ui";
  import { showToast } from "../toast";
  import {
    robotName,
    type LaneBlock,
    type LinkProblem,
    type NearMiss,
  } from "./tandem";
  import {
    lastChange,
    loadSimResult,
    pairMismatch,
    pickRun,
    simLane,
    type SimResult,
  } from "./simResult";
  import {
    addPartnerFile,
    reloadTeamView,
    teamView,
    teamViewLink,
  } from "./teamView";
  import { COPY_PREFIX } from "./teamAutos";

  export interface PanelRobot {
    file: string;
    color: string;
    lane: LaneBlock[];
    total: number;
    auto: AutoSection | null;
    catalog: PathCatalog | null;
    preview: PreviewResult | null;
    partner: PartnerTimes;
  }

  interface Props {
    robots: PanelRobot[];
    misses: NearMiss[];
    settled: boolean;
    problems: LinkProblem[];
    /** Seconds into the Autos. */
    now: number;
    onSeek: (seconds: number) => void;
    onEdit: (index: number) => void;
  }

  let { robots, misses, settled, problems, now, onSeek, onEdit }: Props =
    $props();

  let chosen = $state(0);
  let robot = $derived(robots[Math.min(chosen, robots.length - 1)] ?? null);

  /** The axis: the Autonomous period, longer if a robot runs past it. */
  let span = $derived(Math.max(AUTO_LENGTH_S, ...robots.map((r) => r.total)));
  const pct = (t: number) =>
    `${(Math.max(0, Math.min(t, span)) / span) * 100}%`;
  const width = (b: { t0: number; t1: number }) =>
    `${(Math.max(0, Math.min(b.t1, span) - Math.max(0, b.t0)) / span) * 100}%`;
  const ticks = [0, 5, 10, 15, 20, 25, 30];

  const blockTitle = (b: LaneBlock) =>
    `${b.label} · ${b.t0.toFixed(1)}–${b.t1.toFixed(1)} s${b.linked ? " · fired by the partner" : ""}${b.timedOut ? " · ran to its time limit" : ""}`;

  // --- simulation result -----------------------------------------------------

  let showSim = $state(true);
  let simWhich: "typical" | "best" = $state("typical");
  let sim: SimResult | null = $state(null);
  let simNote = $state("");
  let simStale = $state("");
  let simFor = "";

  $effect(() => {
    const view = $teamView;
    const key = view
      ? `${view.ref}|${view.files.join(",")}|${view.fetchedAt}`
      : "";
    if (key === simFor) return;
    simFor = key;
    sim = null;
    simNote = "";
    simStale = "";
    if (!view || view.files.length === 0) return;
    void (async () => {
      const loaded = await loadSimResult(view.files);
      if (simFor !== key) return;
      if ("missing" in loaded) {
        simNote = loaded.missing;
        return;
      }
      const mismatch = pairMismatch(loaded.result, view.files);
      if (mismatch) {
        simNote = `The latest result for ${robotName(view.files[0])} is not this pair: ${mismatch}.`;
        return;
      }
      sim = loaded.result;
      // Edited since it was simulated? (GitHub's API; nothing said if it cannot tell.)
      const finished = loaded.result.finishedAt
        ? Date.parse(loaded.result.finishedAt)
        : NaN;
      const changes = await Promise.all(
        view.files.map((f) => lastChange(view.ref, f)),
      );
      if (simFor !== key) return;
      const edited = view.files.filter((_, i) => {
        const change = changes[i];
        if (!change || change.sha === loaded.result.commit) return false;
        return Number.isFinite(finished) && Date.parse(change.date) > finished;
      });
      if (edited.length > 0)
        simStale = `${edited.join(", ")} changed after this run.`;
    })();
  });

  let simRun = $derived(sim ? pickRun(sim, simWhich) : null);
  /** The simulator's lane for each robot on screen (by name), if it ran it. */
  let simLanes = $derived(
    robots.map((r) => {
      const ran = simRun?.robots.find((s) => s.auto === robotName(r.file));
      return ran ? simLane(ran.timeline, ran.finishedAt) : null;
    }),
  );

  // --- the chosen robot's cards ------------------------------------------------

  let running = $derived.by(() => {
    // Built fresh each time and never changed after, so a plain Set is enough.
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const ids = new Set<string>();
    if (!robot) return ids;
    for (const b of robot.lane) {
      if (b.cardId && now >= b.t0 - 1e-9 && now <= b.t1 + 1e-9 && b.t1 > b.t0)
        ids.add(b.cardId);
    }
    return ids;
  });

  const pathName = (r: PanelRobot, lineId: string) =>
    r.catalog?.byId.get(lineId)?.name ?? "(missing path)";
  const startOf = (r: PanelRobot, id: string) =>
    r.lane.find((b) => b.cardId === id)?.t0;

  // --- buttons ------------------------------------------------------------------

  let fileInput: HTMLInputElement | undefined = $state();

  async function addFromDisk(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    await addPartnerFile(file.name, await file.text());
  }

  async function copyLink() {
    if (!$teamView) return;
    const link = teamViewLink($teamView);
    try {
      await navigator.clipboard.writeText(link);
      showToast(
        "Link copied: it opens this pair, latest version, on any laptop.",
        "success",
      );
    } catch {
      window.prompt("Copy this link:", link);
    }
  }

  const isTeamCopy = (file: string) => file.startsWith(COPY_PREFIX);
</script>

<div class="tandem">
  <div class="tandem-head">
    <div class="tandem-title">
      {#if $teamView?.pair}
        Pair <strong>{$teamView.pair}</strong>
      {:else}
        {robots.length} Autos together
      {/if}
      {#if $teamView}<span class="tandem-sub">biobuzz {$teamView.ref}</span
        >{/if}
    </div>
    <div class="tandem-actions">
      {#if $teamView}
        <button
          class={ACTION_CLASS}
          onclick={() => reloadTeamView()}
          title="Fetch the latest pushed version">Reload</button
        >
        <button
          class={ACTION_CLASS}
          onclick={copyLink}
          title="A link that opens this pair on any laptop (files added from disk are not in it)"
          >Copy link</button
        >
      {/if}
      <button
        class={ACTION_CLASS}
        onclick={() => fileInput?.click()}
        title="Add any .pp file, ours or another team's, as a partner robot"
        >+ Partner file</button
      >
      <input
        bind:this={fileInput}
        type="file"
        accept=".pp,.json"
        class="hidden"
        onchange={addFromDisk}
      />
    </div>
  </div>

  <!-- The shared timeline -->
  <div class="tandem-timeline" role="group" aria-label="Timeline">
    <div class="tandem-axis">
      {#each ticks as t (t)}
        <span style:left={pct(t)}>{t}</span>
      {/each}
    </div>
    {#each robots as r, i (r.file)}
      <div class="tandem-lane-name" class:chosen={i === chosen}>
        <button
          onclick={() => (chosen = i)}
          style:color={r.color}
          title={r.file}>{robotName(r.file)}</button
        >
        <span>{seconds(r.total)}</span>
      </div>
      <div
        class="tandem-lane"
        role="presentation"
        onclick={(e) => {
          const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
          onSeek(((e.clientX - box.left) / box.width) * span);
          chosen = i;
        }}
      >
        {#each r.lane as b, k (k)}
          {#if b.kind === "command"}
            <span class="blk-cmd" style:left={pct(b.t0)} title={blockTitle(b)}
            ></span>
          {:else}
            <span
              class="blk blk--{b.kind}"
              class:blk--linked={b.linked}
              class:blk--timeout={b.timedOut}
              style:left={pct(b.t0)}
              style:width={width(b)}
              style:--c={r.color}
              title={blockTitle(b)}>{b.label}</span
            >
          {/if}
        {/each}
      </div>
      {#if showSim && simLanes[i]}
        <div class="tandem-lane-name tandem-lane-name--sim">
          <span>sim</span>
        </div>
        <div
          class="tandem-lane tandem-lane--sim"
          role="presentation"
          onclick={(e) => {
            const box = (
              e.currentTarget as HTMLElement
            ).getBoundingClientRect();
            onSeek(((e.clientX - box.left) / box.width) * span);
          }}
        >
          {#each simLanes[i] ?? [] as b, k (k)}
            {#if b.kind === "command"}
              <span
                class="blk-cmd"
                style:left={pct(b.t0)}
                title={`simulated · ${blockTitle(b)}`}
              ></span>
            {:else}
              <span
                class="blk blk--{b.kind}"
                class:blk--timeout={b.timedOut}
                style:left={pct(b.t0)}
                style:width={width(b)}
                style:--c={r.color}
                title={`simulated · ${blockTitle(b)}`}
              ></span>
            {/if}
          {/each}
        </div>
      {/if}
    {/each}
    <div class="tandem-marks">
      {#each misses as m, k (k)}
        <button
          class="miss"
          class:miss--contact={m.contact}
          style:left={pct(m.t0)}
          style:width={`max(3px, ${width(m)})`}
          title={`${m.contact ? "Collision" : "Within 3 in"}: ${robotName(robots[m.a].file)} and ${robotName(robots[m.b].file)}, ${m.t0.toFixed(1)}–${m.t1.toFixed(1)} s`}
          onclick={() => onSeek(m.t0)}
          aria-label="Near-collision"
        ></button>
      {/each}
      {#if sim && simRun?.robotsCollidedAt != null}
        <span
          class="sim-hit"
          style:left={pct(simRun.robotsCollidedAt)}
          title={`The simulator's robots collided at ${simRun.robotsCollidedAt.toFixed(1)} s`}
          >✕</span
        >
      {/if}
    </div>
    <div class="tandem-overlay">
      <div class="tandem-playhead" style:left={pct(now)}></div>
    </div>
  </div>

  {#if misses.length > 0 || !settled || problems.length > 0}
    <ul class="tandem-notes">
      {#each misses as m, k (k)}
        <li class:bad={m.contact}>
          <button onclick={() => onSeek(m.t0)}>{m.t0.toFixed(1)} s</button>
          {m.contact ? "Collision" : "Within 3 in"}: {robotName(
            robots[m.a].file,
          )} and {robotName(robots[m.b].file)}
          ({(m.t1 - m.t0).toFixed(1)} s, near {m.at.x.toFixed(0)}, {m.at.y.toFixed(
            0,
          )})
        </li>
      {/each}
      {#if !settled}
        <li class="bad">
          The robots' waits on each other never settled: the timing shown is
          approximate.
        </li>
      {/if}
      {#each problems as p, k (k)}
        <li class="bad">pairs.json link: {p.problem}</li>
      {/each}
    </ul>
  {/if}

  <!-- The chosen robot -->
  {#if robot}
    <div class="tandem-robot-head">
      <span style:color={robot.color} class="font-semibold"
        >{robotName(robot.file)}</span
      >
      {#if robot.auto && isTeamCopy(robot.file)}
        <button
          class={ACTION_CLASS}
          onclick={() => onEdit(Math.min(chosen, robots.length - 1))}
          title="Open it in the Auto editor; the other robots keep playing as ghosts"
          >Edit</button
        >
      {:else if robot.auto}
        <button
          class={ACTION_CLASS}
          onclick={() => onEdit(Math.min(chosen, robots.length - 1))}
          title="Open this copy in the Auto editor">Edit copy</button
        >
      {/if}
    </div>
    <div class="tandem-cards">
      {#if robot.auto && robot.preview}
        {@render cardList(robot, robot.auto.cards, 0, true)}
      {:else}
        <p class="tandem-sub">No Auto in this file: its paths, back to back.</p>
        {#each robot.lane as b, k (k)}
          <button
            class="card"
            class:card--running={now >= b.t0 && now <= b.t1}
            onclick={() => onSeek(b.t0)}
          >
            <span class="card-t">{b.t0.toFixed(1)}</span>{b.label}
          </button>
        {/each}
      {/if}
    </div>
  {/if}

  <!-- The simulation result -->
  {#if $teamView}
    <div class={SECTION_CLASS}>
      <div class="tandem-robot-head">
        <span class="font-semibold text-gray-300">Simulation</span>
        {#if sim}
          <label class="tandem-sub"
            ><input type="checkbox" bind:checked={showSim} /> lanes</label
          >
          <select class="tandem-select" bind:value={simWhich}>
            <option value="typical">typical seed</option>
            <option value="best">best seed</option>
          </select>
        {/if}
      </div>
      {#if sim && simRun}
        <div class="sim-grid">
          <span>Points</span><strong>{simRun.points ?? "?"}</strong>
          <span>TIPs</span><strong
            >{simRun.autoTips ?? "?"}{#if simRun.tipsAt.length}<span
                class="tandem-sub"
              >
                at {simRun.tipsAt.map((t) => t.toFixed(1)).join(", ")} s</span
              >{/if}</strong
          >
          <span>Collided</span><strong
            class:bad={simRun.robotsCollidedAt != null}
            >{simRun.robotsCollidedAt != null
              ? `${simRun.robotsCollidedAt.toFixed(1)} s`
              : "no"}</strong
          >
          {#each simRun.robots as sr (sr.auto)}
            <span>{sr.auto}</span><strong
              >{sr.launched ?? "?"} launched{sr.finishedAt != null
                ? `, done ${sr.finishedAt.toFixed(1)} s`
                : ", still going at 30 s"}{sr.park ? ", parked" : ""}</strong
            >
          {/each}
          <span>Design</span><strong
            >{sim.design ?? "?"}{sim.partnerDesign
              ? ` / ${sim.partnerDesign}`
              : ""}</strong
          >
          <span>Seed</span><strong>{simRun.seed} of {sim.runs.length}</strong>
        </div>
        <p class="tandem-sub">
          {sim.commit ? `Commit ${sim.commit.slice(0, 7)}` : ""}{sim.finishedAt
            ? `, ${new Date(sim.finishedAt).toLocaleString()}`
            : ""}
          {#if sim.runUrl}· <a
              href={sim.runUrl}
              target="_blank"
              rel="noreferrer">the run</a
            >{/if}
        </p>
        {#if simStale}<p class="bad">
            {simStale} Simulate again to compare.
          </p>{/if}
      {:else}
        <p class="tandem-sub">{simNote || "Loading…"}</p>
      {/if}
    </div>
  {/if}
</div>

{#snippet cardList(
  r: PanelRobot,
  cards: AutoCard[],
  depth: number,
  taken: boolean,
)}
  {#each cards as card (card.id)}
    {@const t = startOf(r, card.id)}
    {@const ran = r.preview?.ran.has(card.id) ?? false}
    <button
      class="card"
      class:card--running={running.has(card.id)}
      class:card--off={!taken || !ran}
      style:padding-left={`${6 + depth * 12}px`}
      onclick={() => t !== undefined && onSeek(t)}
    >
      <span class="card-t">{t !== undefined ? t.toFixed(1) : "–"}</span>
      {#if card.kind === "action"}▶ {card.name}
      {:else if card.kind === "path"}↝ {pathName(r, card.lineId)}
      {:else if card.kind === "rejoin"}↻ {cardTitle(
          card,
          pathName(r, card.lineId),
        )}
      {:else}⏸ {card.label ||
          (isPlainWait(card) ? "Wait for" : "Decision")}{card.alongside
          ? ` · ${card.alongside}`
          : ""}
        {#if r.partner.has(card.id)}<span
            class="card-link"
            title={r.partner.get(card.id)?.why}>⇄ partner</span
          >{/if}
      {/if}
    </button>
    {#if card.kind === "firstOf" && !isPlainWait(card)}
      {#each card.rows as row, index (index)}
        {@const rowTaken = taken && r.preview?.taken.get(card.id) === index}
        <div
          class="row"
          class:card--off={!rowTaken}
          style:padding-left={`${18 + depth * 12}px`}
        >
          {rowLabel(row)}
        </div>
        {@render cardList(r, row.cards, depth + 1, rowTaken)}
      {/each}
    {/if}
  {/each}
{/snippet}

<style>
  .tandem {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
    font-size: 0.75rem;
    color: #d4d4d4;
  }
  .tandem-head,
  .tandem-robot-head {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .tandem-title {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .tandem-actions {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .tandem-sub {
    color: #8a8a8a;
    font-size: 0.68rem;
  }
  .tandem-timeline {
    position: relative;
    display: grid;
    grid-template-columns: 74px 1fr;
    row-gap: 3px;
    padding-top: 14px;
  }
  .tandem-axis {
    position: absolute;
    left: 74px;
    right: 0;
    top: 0;
    height: 12px;
    font-size: 0.6rem;
    color: #777;
  }
  .tandem-axis span {
    position: absolute;
    transform: translateX(-50%);
  }
  .tandem-lane-name {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-size: 0.66rem;
    color: #888;
  }
  .tandem-lane-name button {
    text-align: left;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tandem-lane-name.chosen button {
    text-decoration: underline;
  }
  .tandem-lane-name--sim {
    font-size: 0.6rem;
    padding-left: 8px;
  }
  .tandem-lane {
    position: relative;
    height: 26px;
    background: #181818;
    border: 1px solid #2c2c2c;
    cursor: pointer;
    overflow: hidden;
  }
  .tandem-lane--sim {
    height: 9px;
    opacity: 0.75;
  }
  .blk {
    position: absolute;
    top: 2px;
    bottom: 2px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 0.6rem;
    line-height: 20px;
    padding: 0 2px;
    border-radius: 2px;
    color: #111;
  }
  .tandem-lane--sim .blk {
    top: 1px;
    bottom: 1px;
  }
  .blk--drive {
    background: var(--c);
  }
  .blk--wait {
    background: repeating-linear-gradient(
      135deg,
      #3a3a3a 0 4px,
      #2e2e2e 4px 8px
    );
    color: #ccc;
  }
  .blk--linked {
    box-shadow: inset 0 0 0 1px #ffc516;
  }
  .blk--timeout {
    color: #ff8f8f;
  }
  .blk-cmd {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: #ffc516;
  }
  .tandem-marks {
    grid-column: 2;
    position: relative;
    height: 10px;
  }
  .miss {
    position: absolute;
    top: 1px;
    height: 8px;
    background: #ff9f43;
    border-radius: 2px;
  }
  .miss--contact {
    background: #e5484d;
  }
  .sim-hit {
    position: absolute;
    top: -3px;
    transform: translateX(-50%);
    color: #e5484d;
    font-size: 0.7rem;
  }
  /* Over the lanes only (they start after the 74px names), so the playhead's left is a share of them. */
  .tandem-overlay {
    position: absolute;
    left: 74px;
    right: 0;
    top: 12px;
    bottom: 0;
    pointer-events: none;
  }
  .tandem-playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    margin-left: -1px;
    background: #3fcf8e;
  }
  .tandem-notes {
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: #c9a227;
  }
  .tandem-notes button {
    font-family: ui-monospace, monospace;
    text-decoration: underline;
  }
  .bad {
    color: #ff6b6b;
  }
  .tandem-cards {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    min-height: 120px;
    max-height: 40vh;
    border: 1px solid #2c2c2c;
  }
  .card {
    display: flex;
    gap: 6px;
    align-items: baseline;
    text-align: left;
    padding: 2px 6px;
    border-bottom: 1px solid #222;
  }
  .card:hover {
    background: #242424;
  }
  .card--running {
    box-shadow: inset 3px 0 0 #3fcf8e;
    background: #1d2a22;
  }
  .card--off {
    opacity: 0.45;
  }
  .card-t {
    width: 30px;
    flex: none;
    color: #777;
    font-family: ui-monospace, monospace;
    font-size: 0.65rem;
  }
  .card-link {
    margin-left: auto;
    color: #ffc516;
    font-size: 0.62rem;
  }
  .row {
    color: #888;
    font-size: 0.65rem;
    font-style: italic;
  }
  .tandem-select {
    background: #111;
    border: 1px solid #444;
    font-size: 0.68rem;
    margin-left: auto;
  }
  .sim-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 10px;
  }
  .sim-grid span {
    color: #888;
  }
  .sim-grid strong {
    color: #ddd;
    font-weight: 600;
  }
</style>
