<script lang="ts">
  /**
   * Auto Match Planning (partner.html), in the order the pits conversation goes: the match (or the
   * team you are talking to), then their Auto (they point at the picture that looks like theirs,
   * and you move its spots and set its times), then ours on top of it, with whether the two touch,
   * where each parks and the TIPs. A plan holds a few options (their Auto beside one of ours) to
   * flip between, and the one the team is going with. When the two touch, the page says the
   * smallest delay, theirs or our INIT wait, that avoids it. The answer is the Visualizer's preview
   * (beside.ts), not biobuzz's Java simulator.
   */
  import { onMount } from "svelte";
  import { publicAsset } from "../utils/publicAsset";
  import type { TimingValues } from "../lib/timing/model";
  import {
    contactOnly,
    initWait,
    OUR_COLOR,
    PARTNER_COLOR,
    robotFromText,
    routeChoices,
    runBeside,
    smallestFix,
    withInitWait,
    type BesideResult,
    type Robot,
  } from "./beside";
  import { drawField, markerAt, routesOf, toField, type Marker } from "./field";
  import PresetCards, { type Card } from "./PresetCards.svelte";
  import RouteEditor, { type ShotTimes } from "./RouteEditor.svelte";
  import ScoutPanel from "./ScoutPanel.svelte";
  import {
    knownAutos,
    type PartnerLibrary,
    type PlanOption,
    type PlanRecord,
  } from "./scouting";
  import {
    arrivals as arrivalsOf,
    clampPoint,
    clampSpot,
    driveFrom,
    launches as launchesOf,
    PRESETS,
    routeRobot,
    STILL_PRESET,
    type PartnerRoute,
  } from "./route";
  import {
    displayName,
    loadFile,
    loadLists,
    loadTiming,
    parseState,
    stateHash,
    type Lists,
    type PageState,
  } from "./load";

  const SPEEDS = [1, 2, 4];
  const LETTERS = "ABCDEF";
  const MAX_OPTIONS = 4;

  /** Before anyone has said what they do: nothing picked on either side. */
  const blankOption = (): PlanOption => ({
    partner: { ...STILL_PRESET, name: "" },
    ours: null,
    off: [],
    ourWaitS: null,
  });

  // ---- What is picked (the link carries the option shown) ----
  const initial = parseState(location.hash);
  let options = $state.raw<PlanOption[]>([
    {
      ...blankOption(),
      ...(initial.partner ? { partner: initial.partner } : {}),
      ours: initial.ours,
      off: initial.off,
    },
  ]);
  let active = $state(0);
  let chosen = $state(0);
  let alliance = $state<"red" | "blue">(initial.alliance);
  let miss = $state.raw<number[]>(initial.miss);
  let event = $state<string | null>(initial.event);
  let team = $state<number | null>(initial.team);
  let match = $state<string | null>(initial.match);
  /** The link held a partner of its own: a saved plan loading first does not replace it. */
  const linkHasLook = initial.partner !== null;

  const option = $derived(options[active] ?? options[0]);
  const ours = $derived(option.ours);
  const partner = $derived(option.partner);
  const off = $derived(option.off);

  /** Changes the option shown. */
  function patch(change: Partial<PlanOption>) {
    options = options.map((o, i) => (i === active ? { ...o, ...change } : o));
  }

  // ---- What is loaded ----
  let lists = $state.raw<Lists | null>(null);
  let values = $state.raw<TimingValues | null>(null);
  /** Loaded robots, by file. */
  let robots = $state.raw<Record<string, Robot>>({});
  let failed = $state.raw<Record<string, string>>({});
  /** Every team's known Autos this season, loaded by the match panel. */
  let library = $state.raw<PartnerLibrary | null>(null);
  /**
   * Our Autos drawn to run beside one other, from the Auto Strategy page's manifest: each half's
   * file and Auto name → the other half's Auto name.
   */
  let pairs = $state.raw<Record<string, string>>({});
  let listError = $state<string | null>(null);

  // ---- Playback ----
  let t = $state(0);
  let playing = $state(false);
  let speed = $state(2);
  /** The partner's spots are being moved: the field's markers take touches, not the page. */
  let moving = $state(false);
  /** The marker under the finger, while one is dragged. */
  let dragging = $state<number | null>(null);

  let canvas = $state<HTMLCanvasElement | null>(null);
  let size = $state(360);
  let image = $state.raw<HTMLImageElement | null>(null);
  let imageTick = $state(0);
  let dark = $state(false);

  // ---- The robots ----
  const look = $derived({
    choices: Object.fromEntries(off.map((c) => [c, false])),
    tips: Object.fromEntries(miss.map((n) => [n, false])),
  });
  /** Our Auto as drawn (before its INIT wait is set). */
  const oursBase = $derived(ours ? (robots[ours] ?? null) : null);
  const oursWait = $derived(
    oursBase?.doc.auto ? initWait(oursBase.doc.auto) : null,
  );
  const oursRobot = $derived(
    oursBase ? withInitWait(oursBase, option.ourWaitS) : null,
  );
  const partnerRobot = $derived.by((): Robot | null => {
    if (!values) return null;
    try {
      return routeRobot(partner, values);
    } catch (error) {
      console.error("Could not build the partner's Auto:", error);
      return null;
    }
  });
  /**
   * Stands in for our robot until ours is picked, so the partner's own TIPs are worked out: it
   * never moves, and nothing about it is shown.
   */
  const nobody = $derived(
    values
      ? routeRobot(
          { ...STILL_PRESET, start: { x: 120, y: 70, h: 180 } },
          values,
        )
      : null,
  );
  const choices = $derived(oursBase ? routeChoices(oursBase.doc.auto!) : []);
  /** Whether our Auto is on the field yet. */
  const paired = $derived(oursRobot !== null);

  const result = $derived.by((): BesideResult | null => {
    const left = oursRobot ?? nobody;
    if (!left || !partnerRobot || !values) return null;
    try {
      return runBeside(left, partnerRobot, look, values, paired);
    } catch (error) {
      console.error("Could not preview these two together:", error);
      return null;
    }
  });
  const shown = $derived(
    result && partnerRobot
      ? paired && oursRobot
        ? [oursRobot, partnerRobot]
        : [partnerRobot]
      : [],
  );
  const shownPreviews = $derived(
    result ? (paired ? result.previews : [result.previews[1]]) : [],
  );
  const routes = $derived(
    result ? routesOf(shown, shownPreviews, result.span) : [],
  );
  const colors = $derived(
    paired ? [OUR_COLOR, PARTNER_COLOR] : [PARTNER_COLOR, PARTNER_COLOR],
  );
  const span = $derived(result?.span ?? 30);
  const contact = $derived(paired ? (result?.contact ?? null) : null);

  /** When each of the partner's drives gets there, by step index. */
  const partnerArrivals = $derived(arrivalsOf(result?.previews[1]));
  /** Each of the partner's shots: launch, last ball, and when the CELL it TIPs settles. */
  const partnerShots = $derived.by((): Record<number, ShotTimes> => {
    const out: Record<number, ShotTimes> = {};
    if (!result) return out;
    const launched = launchesOf(result.previews[1]);
    const effects = (result.lanes?.hive.volleys ?? [])
      .filter((v) => v.robot === 1)
      .sort((a, b) => a.t - b.t);
    Object.keys(launched)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach((step, k) => {
        const tip = effects[k]?.tip ?? null;
        out[step] = {
          ...launched[step],
          settled: tip === null ? null : (result.tips[tip]?.settled ?? null),
        };
      });
    return out;
  });

  /** The partner's spots on the field while they are being moved: start, then each drive's bend and end. */
  type Handle =
    | { kind: "start" }
    | { kind: "to"; step: number }
    | { kind: "bend"; step: number };
  const handles = $derived.by((): Handle[] => [
    { kind: "start" },
    ...partner.steps.flatMap((s, i): Handle[] =>
      s.kind === "drive"
        ? [
            { kind: "bend", step: i },
            { kind: "to", step: i },
          ]
        : [],
    ),
  ]);
  const markers = $derived.by((): Marker[] | null => {
    if (!moving) return null;
    let n = 0;
    return handles.map((h, k) => {
      if (h.kind === "start")
        return { at: partner.start, label: "S", active: dragging === k };
      const step = partner.steps[h.step];
      if (step.kind !== "drive")
        return { at: partner.start, label: "", active: false };
      if (h.kind === "to")
        return { at: step.to, label: String(++n), active: dragging === k };
      const from = driveFrom(partner, h.step);
      return {
        at: step.bend ?? {
          x: (from.x + step.to.x) / 2,
          y: (from.y + step.to.y) / 2,
        },
        label: "",
        active: dragging === k,
        small: true,
      };
    });
  });

  // ---- Options ----
  /** Each option's answer in one glance, for its tab: no contact, contact, or not paired yet. */
  const optionStates = $derived.by(() =>
    options.map((o, i): "good" | "bad" | "open" => {
      if (i === active) return !paired ? "open" : contact ? "bad" : "good";
      const base = o.ours ? robots[o.ours] : null;
      if (!base || !values) return "open";
      try {
        const look = {
          choices: Object.fromEntries(o.off.map((c) => [c, false])),
          tips: {},
        };
        return contactOnly(
          withInitWait(base, o.ourWaitS),
          routeRobot(o.partner, values),
          look,
          values,
        )
          ? "bad"
          : "good";
      } catch {
        return "open";
      }
    }),
  );
  function addOption() {
    if (options.length >= MAX_OPTIONS) return;
    options = [...options, structuredClone($state.snapshot(option))];
    active = options.length - 1;
  }
  function removeOption() {
    if (options.length < 2) return;
    options = options.filter((_, i) => i !== active);
    if (chosen === active) chosen = 0;
    else if (chosen > active) chosen--;
    active = Math.max(0, active - 1);
  }

  // ---- What would avoid contact ----
  const fixes = $derived.by(() => {
    if (!contact || !values || dragging !== null || !oursRobot || !oursBase)
      return null;
    const v = values;
    const them = smallestFix(
      (extra) =>
        contactOnly(
          oursRobot,
          routeRobot({ ...partner, delayS: partner.delayS + extra }, v),
          look,
          v,
        ) !== null,
      6,
    );
    const now = option.ourWaitS ?? oursWait?.s ?? null;
    const us =
      oursWait && partnerRobot && now !== null
        ? smallestFix(
            (extra) =>
              now + extra > 29 ||
              contactOnly(
                withInitWait(oursBase, now + extra),
                partnerRobot,
                look,
                v,
              ) !== null,
            8,
          )
        : null;
    return { them, us, now };
  });

  // ---- Their Autos to pick from: the team's own, then the stand-ins ----
  const cards = $derived.by((): Card[] => [
    ...(team ? knownAutos(library, team) : []).map((k) => ({
      key: `team:${k.route.name}`,
      label: `${team} · ${k.route.name}`,
      route: k.route,
      theirs: true,
    })),
    ...PRESETS.map((p) => ({
      key: `preset:${p.name}`,
      label: p.name,
      route: p,
      theirs: false,
    })),
  ]);
  /** The card the partner's Auto is, while it is still that card's start, spots and steps. */
  const sameShape = (a: PartnerRoute, b: PartnerRoute) =>
    JSON.stringify([a.start, a.steps]) === JSON.stringify([b.start, b.steps]);
  const selectedCard = $derived(
    cards.find(
      (c) =>
        sameShape(c.route, partner) &&
        (!c.theirs || c.route.name === partner.name),
    )?.key ?? null,
  );
  function pickCard(card: Card) {
    playing = false;
    miss = [];
    // A stand-in has no name until the partner gives theirs; a team's own keeps its.
    patch({
      partner: {
        ...card.route,
        name: card.theirs ? card.route.name : "",
        delayS: 0,
      },
    });
  }

  // ---- Plans ----
  /** A saved plan onto the page; none saved: one blank option, their Auto first. */
  function applyPlan(
    record: PlanRecord | null,
    matchAlliance: "red" | "blue" | null,
  ) {
    if (matchAlliance) alliance = matchAlliance;
    playing = false;
    moving = false;
    miss = [];
    options = record?.options.length ? record.options : [blankOption()];
    chosen = record?.chosen ?? 0;
    active = chosen;
  }

  // ---- Loading ----
  async function loadRobot(file: string) {
    if (robots[file] || failed[file]) return;
    try {
      const text = await loadFile(file);
      robots = { ...robots, [file]: robotFromText(file, text) };
    } catch (error) {
      failed = {
        ...failed,
        [file]: error instanceof Error ? error.message : String(error),
      };
    }
  }

  function nameOf(file: string): string {
    return robots[file]?.doc.auto?.exportName || displayName(file);
  }

  /** The other half's Auto name, when `file` is half of a pair; null for a solo Auto. */
  function pairOf(file: string): string | null {
    return pairs[nameOf(file)] ?? pairs[file] ?? null;
  }

  onMount(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const theme = () => {
      dark = media.matches;
      const next = new Image();
      next.onload = () => imageTick++;
      next.src = publicAsset(
        `/fields/${dark ? "biobuzz-dark.webp" : "biobuzz-light.webp"}`,
      );
      image = next;
    };
    theme();
    media.addEventListener("change", theme);

    void (async () => {
      const [l, v] = await Promise.all([loadLists(), loadTiming()]);
      lists = l;
      values = v;
      if (l.stale)
        listError =
          "GitHub would not list our Autos (too many visits from this Wi-Fi, or no internet): these are the ones from 20 Nov.";
      await Promise.all(l.autos.map(loadRobot));
    })();
    void (async () => {
      try {
        const res = await fetch("autos/manifest.json", { cache: "no-cache" });
        if (!res.ok) return;
        const manifest = await res.json();
        const out: Record<string, string> = {};
        for (const card of manifest.cards ?? []) {
          if (card.group !== "pair" || card.files?.length !== 2) continue;
          const names: string[] = card.halves ?? card.files.map(displayName);
          for (const [i, j] of [
            [0, 1],
            [1, 0],
          ]) {
            out[card.files[i]] = names[j];
            out[names[i]] = names[j];
          }
        }
        pairs = out;
      } catch {
        // No pair tags.
      }
    })();
    return () => media.removeEventListener("change", theme);
  });

  // The link follows the option shown.
  $effect(() => {
    const state: PageState = {
      ours,
      partner,
      alliance,
      off,
      miss,
      event,
      team,
      match,
    };
    const hash = stateHash(state);
    if (hash !== location.hash)
      history.replaceState(
        null,
        "",
        hash || location.pathname + location.search,
      );
  });

  // A new pick starts from the top (not while a spot is being dragged: the field stays put).
  $effect(() => {
    void result;
    if (dragging === null) t = 0;
  });

  // ---- Playback ----
  $effect(() => {
    if (!playing) return;
    let last = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      t = Math.min(span, t + ((now - last) / 1000) * speed);
      last = now;
      if (t >= span) {
        playing = false;
        return;
      }
      frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  });

  function play() {
    if (playing) {
      playing = false;
      return;
    }
    if (t >= span - 1e-6) t = 0;
    moving = false;
    playing = true;
  }

  // ---- The field ----
  $effect(() => {
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      size = Math.max(200, Math.round(entry.contentRect.width));
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  });

  $effect(() => {
    if (!canvas) return;
    void imageTick;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(size * ratio);
    canvas.height = Math.round(size * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawField(ctx, size, {
      robots: shown,
      previews: shownPreviews,
      colors,
      routes,
      // Moving spots: the robots stand at their starts, under the markers.
      t: moving ? 0 : t,
      contact,
      blue: alliance === "blue",
      image,
      markers,
    });
  });

  function canvasXY(e: PointerEvent) {
    const rect = canvas!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, w: rect.width };
  }

  function down(e: PointerEvent) {
    if (!moving || !canvas || !markers) return;
    const { x, y, w } = canvasXY(e);
    const hit = markerAt(markers, x, y, w, alliance === "blue");
    if (hit < 0) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    playing = false;
    dragging = hit;
  }
  function move(e: PointerEvent) {
    if (dragging === null) return;
    e.preventDefault();
    const { x, y, w } = canvasXY(e);
    const p = toField(x, y, w, alliance === "blue");
    const h = handles[dragging];
    if (h.kind === "start") {
      patch({
        partner: {
          ...partner,
          start: clampSpot({ ...partner.start, x: p.x, y: p.y }),
        },
      });
      return;
    }
    const step = partner.steps[h.step];
    if (step.kind !== "drive") return;
    const moved =
      h.kind === "to"
        ? { ...step, to: clampSpot({ ...step.to, x: p.x, y: p.y }) }
        : { ...step, bend: clampPoint(p) };
    patch({
      partner: {
        ...partner,
        steps: partner.steps.map((s, i) => (i === h.step ? moved : s)),
      },
    });
  }
  function up() {
    dragging = null;
  }

  // ---- Our side ----
  function pickOurs(file: string) {
    patch({ ours: file, off: [], ourWaitS: null });
    miss = [];
  }
  function setChoice(condition: string, yes: boolean) {
    patch({
      off: yes
        ? off.filter((c) => c !== condition)
        : [...new Set([...off, condition])],
    });
  }
  function setTip(tip: number, lands: boolean) {
    miss = lands
      ? miss.filter((n) => n !== tip)
      : [...new Set([...miss, tip])].sort((a, b) => a - b);
  }
  function nudgeOurWait(delta: number) {
    if (!oursWait) return;
    const now = option.ourWaitS ?? oursWait.s;
    patch({
      ourWaitS: Math.min(29, Math.max(0, Math.round((now + delta) * 2) / 2)),
    });
  }

  /** The TIP rows: each the volleys try for in this look, and each set to miss. */
  const tipRows = $derived.by(() => {
    const rows: { tip: number; robot: number | null }[] = (
      result?.toggles ?? []
    ).map((toggle) => ({ tip: toggle.tip, robot: toggle.robot }));
    for (const n of miss)
      if (!rows.some((row) => row.tip === n))
        rows.push({ tip: n, robot: null });
    return rows.sort((a, b) => a.tip - b.tip);
  });

  const fmt = (s: number) => `${s.toFixed(1)} s`;
  const pretty = (s: string) =>
    s
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\btip\b/g, "TIP")
      .replace(/^./, (c) => c.toUpperCase());
  const who = (robot: number | null) =>
    robot === 0 ? "us" : robot === 1 ? "them" : "";
</script>

<div class="wrap">
  <header>
    <nav class="crumbs">
      <a href="autos.html">← Auto Strategy</a>
      <a href="./">Visualizer</a>
    </nav>
    <div class="titlebar">
      <h1>Auto Match Planning</h1>
      <div class="seg alliance" role="group" aria-label="Alliance">
        <button
          type="button"
          data-alliance="red"
          aria-pressed={alliance === "red"}
          onclick={() => (alliance = "red")}>Red</button
        >
        <button
          type="button"
          data-alliance="blue"
          aria-pressed={alliance === "blue"}
          onclick={() => (alliance = "blue")}>Blue</button
        >
      </div>
    </div>
  </header>

  <div class="layout">
    <div class="stage">
      <div class="optbar" role="group" aria-label="Options">
        {#each options as _, i (i)}
          <button
            type="button"
            class="opt {optionStates[i]}"
            aria-pressed={active === i}
            onclick={() => {
              active = i;
              moving = false;
              playing = false;
            }}
            >{LETTERS[i]}{#if chosen === i}&nbsp;★{/if}</button
          >
        {/each}
        {#if options.length < MAX_OPTIONS}
          <button
            type="button"
            class="opt add"
            aria-label="Another option"
            onclick={addOption}>+</button
          >
        {/if}
        <span class="spacer"></span>
        {#if options.length > 1}
          <button
            type="button"
            class="optact"
            aria-pressed={chosen === active}
            onclick={() => (chosen = active)}
            >{chosen === active
              ? "★ Going with this"
              : "☆ Go with this"}</button
          >
          <button
            type="button"
            class="optact"
            aria-label="Remove this option"
            onclick={removeOption}>✕</button
          >
        {/if}
      </div>
      <div class="fieldbox">
        <canvas
          bind:this={canvas}
          class:moving
          style:height="{size}px"
          aria-label="The field: our robot in red, the partner in teal"
          onpointerdown={down}
          onpointermove={move}
          onpointerup={up}
          onpointercancel={up}
        ></canvas>
      </div>
      <div class="playbar">
        <button
          type="button"
          class="play"
          onclick={play}
          disabled={!result}
          aria-label={playing ? "Pause" : "Play"}>{playing ? "❚❚" : "▶"}</button
        >
        <div class="scrub">
          <input
            type="range"
            min="0"
            max={span}
            step="0.1"
            bind:value={t}
            disabled={!result}
            aria-label="Time after PLAY"
          />
          <div class="ticks" aria-hidden="true">
            {#if contact}
              <span
                class="tick contact"
                style:left="{(contact.t / span) * 100}%"
              ></span>
            {/if}
            {#each result?.tipsInAuto ?? [] as tip, i (i)}
              <span
                class="tick tip"
                style:left="{(Math.min(tip.settled, span) / span) * 100}%"
              ></span>
            {/each}
          </div>
        </div>
        <span class="clock">{t.toFixed(1)} s</span>
        <div class="seg speed" role="group" aria-label="Speed">
          {#each SPEEDS as s (s)}
            <button
              type="button"
              aria-pressed={speed === s}
              onclick={() => (speed = s)}>{s}×</button
            >
          {/each}
        </div>
      </div>

      {#if result && paired}
        <div class="verdict" aria-live="polite">
          <div class="tiles">
            {#if contact}
              <button
                type="button"
                class="tile bad"
                onclick={() => {
                  playing = false;
                  t = contact!.t;
                }}
                aria-label="Contact at {fmt(contact.t)}: show it"
              >
                <small>Contact</small><b>{fmt(contact.t)}</b>
              </button>
            {:else}
              <div class="tile good"><small>Contact</small><b>None</b></div>
            {/if}
            {#each result.ends as end, i (i)}
              <div
                class="tile"
                class:warn={end.parkedAt === null &&
                  end.why !== "stays on its start"}
              >
                <small
                  ><span
                    class="key"
                    style:background={i === 0 ? OUR_COLOR : PARTNER_COLOR}
                  ></span>
                  {i === 0 ? "We park" : "They park"}</small
                >
                {#if end.parkedAt !== null}
                  <b>{fmt(end.parkedAt)}</b>
                {:else if end.why === "stays on its start"}
                  <b>Still</b>
                {:else}
                  <b>No</b>
                {/if}
              </div>
            {/each}
            <div class="tile">
              <small>TIPs</small><b>{result.tipsInAuto.length}</b>
            </div>
          </div>
          {#if fixes}
            <div class="fixes">
              {#if fixes.them !== null}
                <button
                  type="button"
                  onclick={() =>
                    patch({
                      partner: {
                        ...partner,
                        delayS: partner.delayS + fixes!.them!,
                      },
                    })}>No contact if they wait +{fmt(fixes.them)}</button
                >
              {/if}
              {#if fixes.us !== null && fixes.now !== null}
                <button
                  type="button"
                  onclick={() => patch({ ourWaitS: fixes!.now! + fixes!.us! })}
                  >No contact if our {oursWait?.tip
                    ? `TIP ${oursWait.tip} wait`
                    : "wait"} is {fmt(fixes.now + fixes.us)}</button
                >
              {/if}
              {#if fixes.them === null && fixes.us === null}
                <span class="nofix">No delay up to 6 s avoids it</span>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <div class="controls">
      <ScoutPanel
        bind:event
        bind:team
        bind:match
        bind:library
        current={{ options, chosen }}
        keepLinkLook={linkHasLook}
        onApply={applyPlan}
        autoName={nameOf}
      />

      <section>
        <h2>Their Auto</h2>
        <PresetCards
          {cards}
          selected={selectedCard}
          ours={paired ? (routes[0] ?? null) : null}
          blue={alliance === "blue"}
          {image}
          {imageTick}
          onPick={pickCard}
        />
        <RouteEditor
          route={partner}
          arrivals={partnerArrivals}
          shots={partnerShots}
          bind:moving
          onChange={(route) => patch({ partner: route })}
        />
      </section>

      <section>
        <h2>Our Auto</h2>
        {#if listError}<p class="note warn">{listError}</p>{/if}
        <div class="picks">
          {#each lists?.autos ?? [] as file (file)}
            <button
              type="button"
              class="pick"
              aria-pressed={ours === file}
              onclick={() => pickOurs(file)}
              disabled={!!failed[file]}
            >
              {nameOf(file)}
              {#if pairOf(file)}<small>pair</small>{:else}<small class="solo"
                  >solo</small
                >{/if}
            </button>
          {/each}
        </div>
        {#if ours && failed[ours]}<p class="note warn">{failed[ours]}</p>{/if}

        {#if paired && (choices.length || tipRows.length || oursWait)}
          <div class="switches">
            {#if oursWait}
              <div class="sw">
                <span
                  >{oursWait.tip
                    ? `Wait for TIP ${oursWait.tip} until`
                    : "Wait until"}</span
                >
                <div class="stepper">
                  <button
                    type="button"
                    aria-label="Earlier"
                    onclick={() => nudgeOurWait(-0.5)}>−</button
                  >
                  <b>{fmt(option.ourWaitS ?? oursWait.s)}</b>
                  <button
                    type="button"
                    aria-label="Later"
                    onclick={() => nudgeOurWait(0.5)}>+</button
                  >
                </div>
              </div>
            {/if}
            {#each choices as choice (choice.condition)}
              <div class="sw">
                <span>{pretty(choice.option)}</span>
                <div class="seg">
                  <button
                    type="button"
                    aria-pressed={!off.includes(choice.condition)}
                    onclick={() => setChoice(choice.condition, true)}
                    >{pretty(choice.legs[0])}</button
                  >
                  <button
                    type="button"
                    aria-pressed={off.includes(choice.condition)}
                    onclick={() => setChoice(choice.condition, false)}
                    >{pretty(choice.legs[1])}</button
                  >
                </div>
              </div>
            {/each}
            {#each tipRows as row (row.tip)}
              <div class="sw">
                <span
                  >TIP {row.tip}{#if who(row.robot)}<small
                      >&nbsp;· {who(row.robot)}</small
                    >{/if}</span
                >
                <div class="seg">
                  <button
                    type="button"
                    aria-pressed={!miss.includes(row.tip)}
                    onclick={() => setTip(row.tip, true)}>Lands</button
                  >
                  <button
                    type="button"
                    class="off"
                    aria-pressed={miss.includes(row.tip)}
                    onclick={() => setTip(row.tip, false)}>Misses</button
                  >
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    </div>
  </div>
</div>

<style>
  .optbar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-bottom: 1px solid var(--line);
  }
  .optbar .spacer {
    flex: 1;
  }
  .opt {
    font: inherit;
    font-weight: 800;
    font-size: 15px;
    min-width: 44px;
    height: 40px;
    padding: 0 10px;
    border-radius: 9px;
    border: 1px solid var(--line);
    border-bottom: 4px solid var(--line);
    background: var(--seg);
    color: var(--ink);
    cursor: pointer;
  }
  .opt.good {
    border-bottom-color: #2e9e57;
  }
  .opt.bad {
    border-bottom-color: var(--warn-dot);
  }
  .opt[aria-pressed="true"] {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
  }
  .opt.add {
    border-style: dashed;
    color: var(--accent);
  }
  .optact {
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    height: 40px;
    min-width: 40px;
    padding: 0 10px;
    border-radius: 9px;
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--ink);
    cursor: pointer;
  }
  .optact[aria-pressed="true"] {
    color: var(--accent);
    border-color: var(--accent);
  }
  .fixes {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }
  .fixes button {
    font: inherit;
    font-size: 14px;
    font-weight: 700;
    min-height: 40px;
    padding: 6px 12px;
    border-radius: 10px;
    border: 1px solid var(--warn-line);
    background: var(--warn-bg);
    color: var(--warn-ink);
    cursor: pointer;
  }
  .nofix {
    font-size: 14px;
    font-weight: 700;
    color: var(--warn-ink);
    padding: 8px 0;
  }
  .stepper {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) 44px;
    align-items: center;
    gap: 6px;
  }
  .stepper b {
    text-align: center;
  }
  .stepper button {
    font: inherit;
    font-size: 20px;
    font-weight: 700;
    height: 44px;
    border-radius: 9px;
    border: 1px solid var(--line);
    background: var(--seg);
    color: var(--ink);
    cursor: pointer;
  }
  :global(:root) {
    --bg: #f4f5f7;
    --panel: #ffffff;
    --ink: #15181d;
    --muted: #5d6470;
    --line: #dcdfe5;
    --accent: #2f6fde;
    --accent-ink: #ffffff;
    --seg: #eceff4;
    --seg-on: #ffffff;
    --seg-on-ink: #15181d;
    --tag: #e8f0fd;
    --tag-ink: #1f4fa8;
    --trial: #fbe9cf;
    --trial-ink: #8a5a12;
    --good-bg: #e3f4e8;
    --good-ink: #17652f;
    --good-line: #a9dbb8;
    --field: #2b2b2b;
    --warn-bg: #fde8e4;
    --warn-ink: #a3220e;
    --warn-line: #f2b8ad;
    --warn-dot: #d9381e;
    --font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :global(:root:not([data-theme="light"])) {
      --bg: #111418;
      --panel: #1a1e24;
      --ink: #e8ebf0;
      --muted: #9aa2ae;
      --line: #2c323b;
      --accent: #6ea0ff;
      --accent-ink: #0d1117;
      --seg: #11151a;
      --seg-on: #2c3440;
      --seg-on-ink: #ffffff;
      --tag: #1c2638;
      --tag-ink: #9cc0ff;
      --trial: #33291a;
      --trial-ink: #f0c47a;
      --good-bg: #15301e;
      --good-ink: #8fe0a8;
      --good-line: #2a5a38;
      --warn-bg: #3a1a14;
      --warn-ink: #ffb4a3;
      --warn-line: #6b2a1e;
      --warn-dot: #ff7a5c;
      color-scheme: dark;
    }
  }
  :global(*) {
    box-sizing: border-box;
  }
  :global(html),
  :global(body) {
    margin: 0;
  }
  :global(body) {
    background: var(--bg);
    color: var(--ink);
    font: 15px/1.5 var(--font);
  }
  .wrap {
    max-width: 1240px;
    margin: 0 auto;
    padding-block: 16px 48px;
    padding-left: max(16px, env(safe-area-inset-left, 0px));
    padding-right: max(16px, env(safe-area-inset-right, 0px));
    display: grid;
    gap: 16px;
  }
  .crumbs {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }
  .crumbs a {
    color: var(--accent);
    text-decoration: none;
    font-weight: 600;
  }
  .titlebar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    margin-top: 6px;
  }
  h1 {
    margin: 0;
    font-size: clamp(24px, 6vw, 36px);
    letter-spacing: -0.01em;
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
    align-items: start;
  }
  @media (min-width: 900px) {
    .layout {
      grid-template-columns: minmax(0, 620px) minmax(0, 1fr);
    }
    .stage {
      position: sticky;
      top: 12px;
    }
  }
  .stage {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 14px;
    overflow: hidden;
    overflow: clip;
    min-width: 0;
  }
  /* A phone: the field and its answer stay on screen while the picks scroll under them. */
  @media (max-width: 899.98px) and (min-height: 640px) {
    .stage {
      position: sticky;
      top: 0;
      z-index: 2;
      border-radius: 0 0 14px 14px;
      margin-inline: calc(-1 * max(16px, env(safe-area-inset-left, 0px)));
      border-inline: 0;
      border-top: 0;
      box-shadow: 0 6px 10px -8px rgba(0, 0, 0, 0.35);
    }
    .fieldbox {
      max-width: min(100%, calc(100svh - 330px));
      margin: 0 auto;
    }
  }
  .fieldbox {
    position: relative;
    background: var(--field);
  }
  canvas {
    display: block;
    width: 100%;
    touch-action: pan-y;
  }
  canvas.moving {
    touch-action: none;
    cursor: crosshair;
    outline: 3px solid var(--accent);
    outline-offset: -3px;
  }
  .playbar {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--line);
  }
  .play {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 0;
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 16px;
    cursor: pointer;
  }
  .play:disabled {
    opacity: 0.4;
  }
  .scrub {
    position: relative;
    min-width: 0;
  }
  .scrub input {
    width: 100%;
    height: 32px;
    margin: 0;
    accent-color: var(--accent);
  }
  .ticks {
    position: absolute;
    inset: auto 8px -2px 8px;
    height: 6px;
    pointer-events: none;
  }
  .tick {
    position: absolute;
    width: 4px;
    height: 6px;
    margin-left: -2px;
    border-radius: 2px;
  }
  .tick.contact {
    background: var(--warn-dot);
  }
  .tick.tip {
    background: var(--accent);
  }
  .clock {
    font: 600 14px var(--mono);
    min-width: 4.2em;
    text-align: right;
  }
  .verdict {
    padding: 8px 10px 10px;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(0, 0.7fr);
    gap: 6px;
  }
  .tile {
    font: inherit;
    color: inherit;
    text-align: left;
    display: grid;
    gap: 0;
    align-content: start;
    padding: 6px 8px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: var(--seg);
    min-width: 0;
  }
  .tile small {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    opacity: 0.85;
    white-space: nowrap;
    overflow: hidden;
  }
  .tile b {
    font-size: 19px;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tile.good {
    background: var(--good-bg);
    color: var(--good-ink);
    border-color: var(--good-line);
  }
  .tile.bad {
    background: var(--warn-bg);
    color: var(--warn-ink);
    border-color: var(--warn-line);
    cursor: pointer;
  }
  .tile.warn b {
    color: var(--warn-ink);
  }
  .key {
    display: inline-block;
    width: 14px;
    height: 5px;
    border-radius: 3px;
    flex: none;
  }
  @media (max-width: 420px) {
    .tile {
      padding: 5px 6px;
    }
    .tile b {
      font-size: 16px;
    }
    .tile small {
      font-size: 10.5px;
    }
  }
  .quiet {
    color: var(--muted);
    margin: 0;
  }
  .controls {
    display: grid;
    gap: 18px;
    min-width: 0;
  }
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
  .picks {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .pick {
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    min-height: 44px;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: var(--seg);
    color: var(--ink);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
  }
  .pick small {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 1px 6px;
    border-radius: 999px;
    background: var(--trial);
    color: var(--trial-ink);
  }
  .pick small.solo {
    background: var(--tag);
    color: var(--tag-ink);
  }
  .pick[aria-pressed="true"] {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
  }
  .pick:disabled {
    opacity: 0.5;
  }
  .switches {
    display: grid;
    gap: 4px;
  }
  .sw {
    display: grid;
    grid-template-columns: 7.5em minmax(0, 1fr);
    align-items: center;
    gap: 10px;
  }
  .sw > span {
    font-size: 13px;
    font-weight: 700;
    color: var(--muted);
    line-height: 1.2;
  }
  .sw > span small {
    font-weight: 600;
  }
  .seg {
    display: grid;
    grid-template-columns: 1fr 1fr;
    background: var(--seg);
    border: 1px solid var(--line);
    border-radius: 9px;
    padding: 3px;
    gap: 3px;
    min-width: 0;
  }
  .seg.speed {
    grid-template-columns: repeat(3, auto);
  }
  .seg button {
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    border: 0;
    border-radius: 6px;
    padding: 6px 8px;
    min-height: 40px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    min-width: 0;
    line-height: 1.2;
  }
  .seg.speed button {
    padding: 6px 7px;
    font-size: 13px;
  }
  .seg button[aria-pressed="true"] {
    background: var(--seg-on);
    color: var(--seg-on-ink);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
  }
  .seg button.off[aria-pressed="true"] {
    background: #c9472f;
    color: #fff;
  }
  .alliance {
    width: 9.5em;
  }
  .alliance button[data-alliance="red"][aria-pressed="true"] {
    background: #c62828;
    color: #fff;
  }
  .alliance button[data-alliance="blue"][aria-pressed="true"] {
    background: #1f5fd6;
    color: #fff;
  }
  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .note {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }
  .note.warn {
    color: var(--warn-ink);
  }
</style>
