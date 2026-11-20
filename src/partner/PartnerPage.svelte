<script lang="ts">
  /**
   * Auto Match Planning (partner.html): pick one of our Autos on biobuzz master and the
   * partner's Auto (one of the page's stand-ins, or a team's saved one, edited as steps on the
   * field), watch them run together, and read whether they touch, where each parks, and the TIPs.
   * The answer is the Visualizer's preview (beside.ts), not biobuzz's Java simulator.
   */
  import { onMount } from "svelte";
  import { publicAsset } from "../utils/publicAsset";
  import type { TimingValues } from "../lib/timing/model";
  import {
    OUR_COLOR,
    previewAlone,
    PARTNER_COLOR,
    robotFromText,
    routeChoices,
    runBeside,
    type BesideResult,
    type Robot,
  } from "./beside";
  import { drawField, markerAt, routesOf, toField, type Marker } from "./field";
  import PresetCards from "./PresetCards.svelte";
  import RouteEditor from "./RouteEditor.svelte";
  import ScoutPanel from "./ScoutPanel.svelte";
  import type { PlanRecord } from "./scouting";
  import {
    arrivals as arrivalsOf,
    clampSpot,
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

  const COLORS = [OUR_COLOR, PARTNER_COLOR];
  const SPEEDS = [1, 2, 4];

  // ---- What is picked (the link carries it) ----
  const initial = parseState(location.hash);
  let ours = $state<string | null>(initial.ours);
  let partner = $state.raw<PartnerRoute>(
    initial.partner ?? { ...STILL_PRESET, name: "" },
  );
  let alliance = $state<"red" | "blue">(initial.alliance);
  let off = $state.raw<string[]>(initial.off);
  let miss = $state.raw<number[]>(initial.miss);
  let event = $state<string | null>(initial.event);
  let team = $state<number | null>(initial.team);
  let match = $state<string | null>(initial.match);
  /** The stand-in the partner's Auto was started from, for its button; null for a team's own. */
  let preset = $state<string | null>(
    initial.partner ? null : STILL_PRESET.name,
  );
  /** The link held a partner of its own: a saved plan loading first does not replace it. */
  const linkHasLook = initial.partner !== null;

  // ---- What is loaded ----
  let lists = $state.raw<Lists | null>(null);
  let values = $state.raw<TimingValues | null>(null);
  /** Loaded robots, by file. */
  let robots = $state.raw<Record<string, Robot>>({});
  let failed = $state.raw<Record<string, string>>({});
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

  const oursRobot = $derived(ours ? (robots[ours] ?? null) : null);
  const partnerRobot = $derived.by((): Robot | null => {
    if (!values) return null;
    try {
      return routeRobot(partner, values);
    } catch (error) {
      console.error("Could not build the partner's Auto:", error);
      return null;
    }
  });
  const choices = $derived(oursRobot ? routeChoices(oursRobot.doc.auto!) : []);
  /** What the field shows, as a saved plan keeps it. */
  const current = $derived({ ours, off, partner });

  /** A saved plan onto the field; none saved: the partner as a blank Auto to fill in. */
  function applyPlan(
    record: PlanRecord | null,
    matchAlliance: "red" | "blue" | null,
  ) {
    if (matchAlliance) alliance = matchAlliance;
    playing = false;
    miss = [];
    if (record?.ours) ours = record.ours;
    off = record?.off ?? [];
    partner = record?.partner ?? { ...STILL_PRESET, name: "" };
    preset = record?.partner ? null : STILL_PRESET.name;
  }

  /** A stand-in to start from: its steps, with no name until the partner gives theirs. */
  function pickPreset(route: PartnerRoute) {
    pickRoute({ ...route, name: "" });
    preset = route.name;
  }

  function pickRoute(route: PartnerRoute) {
    preset = null;
    partner = route;
    playing = false;
    miss = [];
  }

  const look = $derived({
    choices: Object.fromEntries(off.map((c) => [c, false])),
    tips: Object.fromEntries(miss.map((n) => [n, false])),
  });
  /** Ours alone, for the field while there is no pair to run. */
  const alone = $derived.by(() => {
    if (!oursRobot || !values || result) return null;
    try {
      const preview = previewAlone(oursRobot, look, values);
      return {
        preview,
        route: routesOf(
          [oursRobot],
          [preview],
          Math.max(30, preview.endTime),
        )[0],
      };
    } catch {
      return null;
    }
  });
  const result = $derived.by((): BesideResult | null => {
    if (!oursRobot || !partnerRobot || !values) return null;
    try {
      return runBeside(oursRobot, partnerRobot, look, values);
    } catch (error) {
      console.error("Could not preview these two together:", error);
      return null;
    }
  });
  const shown = $derived(
    result && oursRobot && partnerRobot ? [oursRobot, partnerRobot] : [],
  );
  const routes = $derived(
    result ? routesOf(shown, result.previews, result.span) : [],
  );
  const span = $derived(result?.span ?? 30);
  /** When each of the partner's drives gets there, by step index. */
  const partnerArrivals = $derived(arrivalsOf(result?.previews[1]));
  /** The partner's spots on the field while they are being moved: the start, then each drive. */
  const markerSteps = $derived.by((): (number | "start")[] => [
    "start",
    ...partner.steps.flatMap((s, i) => (s.kind === "drive" ? [i] : [])),
  ]);
  const markers = $derived.by((): Marker[] | null =>
    moving
      ? markerSteps.map((k, n) => {
          const step = k === "start" ? null : partner.steps[k];
          return {
            at: step?.kind === "drive" ? step.to : partner.start,
            label: k === "start" ? "S" : String(n),
            active: dragging === n,
          };
        })
      : null,
  );
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
      image = new Image();
      image.onload = () => imageTick++;
      image.src = publicAsset(
        `/fields/${dark ? "biobuzz-dark.webp" : "biobuzz-light.webp"}`,
      );
    };
    theme();
    media.addEventListener("change", theme);

    void (async () => {
      const [l, v] = await Promise.all([loadLists(), loadTiming()]);
      lists = l;
      values = v;
      if (l.stale)
        listError =
          "GitHub would not list the folders (too many visits from this Wi-Fi, or no internet), so these are the files that were there on 20 Nov. A new one may be missing.";
      if (!ours || !l.autos.includes(ours))
        ours = l.autos.includes("r-solo.pp")
          ? "r-solo.pp"
          : (l.autos[0] ?? null);
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
        // No pair notes.
      }
    })();
    return () => media.removeEventListener("change", theme);
  });

  // The link follows what is picked.
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
    // No pair yet: ours alone, at its start.
    const solo = !result;
    drawField(ctx, size, {
      robots: solo ? (oursRobot && alone ? [oursRobot] : []) : shown,
      previews: solo ? (alone ? [alone.preview] : []) : result!.previews,
      colors: COLORS,
      routes: solo ? (alone ? [alone.route] : []) : routes,
      // Moving spots: the robots stand at their starts, under the markers.
      t: solo || moving ? 0 : t,
      contact: solo ? null : result!.contact,
      blue: alliance === "blue",
      image,
      markers,
    });
  });

  function canvasXY(event: PointerEvent) {
    const rect = canvas!.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      w: rect.width,
    };
  }

  function down(event: PointerEvent) {
    if (!moving || !canvas || !markers) return;
    const { x, y, w } = canvasXY(event);
    const hit = markerAt(markers, x, y, w, alliance === "blue");
    if (hit < 0) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    playing = false;
    dragging = hit;
  }
  function move(event: PointerEvent) {
    if (dragging === null) return;
    event.preventDefault();
    const { x, y, w } = canvasXY(event);
    const p = toField(x, y, w, alliance === "blue");
    const k = markerSteps[dragging];
    if (k === "start") {
      partner = {
        ...partner,
        start: clampSpot({ ...partner.start, x: p.x, y: p.y }),
      };
    } else {
      const step = partner.steps[k];
      if (step.kind !== "drive") return;
      partner = {
        ...partner,
        steps: partner.steps.map((s, i) =>
          i === k
            ? { ...step, to: clampSpot({ ...step.to, x: p.x, y: p.y }) }
            : s,
        ),
      };
    }
  }
  function up() {
    dragging = null;
  }

  // ---- Picks ----
  function pickOurs(file: string) {
    ours = file;
    off = [];
    miss = [];
  }
  function setChoice(condition: string, yes: boolean) {
    off = yes
      ? off.filter((c) => c !== condition)
      : [...new Set([...off, condition])];
  }
  function setTip(tip: number, lands: boolean) {
    miss = lands
      ? miss.filter((n) => n !== tip)
      : [...new Set([...miss, tip])].sort((a, b) => a - b);
  }

  const fmt = (s: number) => `${s.toFixed(1)} s`;
  const pretty = (s: string) =>
    s
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\btip\b/g, "TIP")
      .replace(/^./, (c) => c.toUpperCase());
  const who = (robot: number | null) =>
    robot === 0 ? "us" : robot === 1 ? "partner" : "";
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
            {#if result?.contact}
              <span
                class="tick contact"
                style:left="{(result.contact.t / span) * 100}%"
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

      <div class="verdict" aria-live="polite">
        {#if !result}
          <p class="quiet">
            {#if !values || !lists}Loading from biobuzz master…
            {:else if !oursRobot}Pick our Auto.
            {:else if !partnerRobot}Pick a partner.
            {:else}Could not preview these two together.{/if}
          </p>
        {:else}
          <div class="tiles">
            {#if result.contact}
              <button
                type="button"
                class="tile bad"
                onclick={() => {
                  playing = false;
                  t = result!.contact!.t;
                }}
                aria-label="Contact at {fmt(result.contact.t)}: show it"
              >
                <small>Contact</small><b>{fmt(result.contact.t)}</b>
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
                  ><span class="key" style:background={COLORS[i]}></span>
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
        {/if}
      </div>
    </div>

    <div class="controls">
      <ScoutPanel
        bind:event
        bind:team
        bind:match
        {current}
        keepLinkLook={linkHasLook}
        onApply={applyPlan}
        autoName={nameOf}
        onPickRoute={pickRoute}
      />

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

        {#if choices.length || tipRows.length}
          <div class="switches">
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

      <section>
        <h2>Partner</h2>
        <PresetCards
          presets={PRESETS}
          selected={preset}
          ours={result ? (routes[0] ?? null) : (alone?.route ?? null)}
          blue={alliance === "blue"}
          {image}
          {imageTick}
          onPick={pickPreset}
        />
        <RouteEditor
          route={partner}
          arrivals={partnerArrivals}
          bind:moving
          onChange={(route) => (partner = route)}
        />
      </section>
    </div>
  </div>
</div>

<style>
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
