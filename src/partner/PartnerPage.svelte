<script lang="ts">
  /**
   * "Our Auto beside a partner" (partner.html): pick one of our Autos on biobuzz master and a
   * partner (a stand-in, or one drawn with a finger), watch them run together, and read whether
   * they touch, where each parks, and the TIPs. The answer is the Visualizer's preview
   * (beside.ts), not biobuzz's Java simulator.
   */
  import { onMount } from "svelte";
  import { publicAsset } from "../utils/publicAsset";
  import type { BasePoint } from "../types";
  import type { TimingValues } from "../lib/timing/model";
  import {
    drawnPartner,
    OUR_COLOR,
    previewAlone,
    PARTNER_COLOR,
    robotFromText,
    routeChoices,
    runBeside,
    type BesideResult,
    type Robot,
  } from "./beside";
  import { drawField, routesOf, toField } from "./field";
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
  let partnerMode = $state<"standin" | "draw">(
    initial.drawn ? "draw" : "standin",
  );
  let partner = $state<string | null>(initial.partner);
  let drawn = $state.raw<BasePoint[] | null>(initial.drawn);
  let at = $state(initial.at);
  let shoots = $state(initial.shoots);
  let alliance = $state<"red" | "blue">(initial.alliance);
  let off = $state.raw<string[]>(initial.off);
  let miss = $state.raw<number[]>(initial.miss);

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
  /** The finger is drawing a partner: the canvas takes touches instead of scrolling. */
  let arming = $state(false);
  let stroke = $state.raw<BasePoint[] | null>(null);

  let canvas = $state<HTMLCanvasElement | null>(null);
  let size = $state(360);
  let image: HTMLImageElement | null = null;
  let imageTick = $state(0);
  let dark = $state(false);

  const oursRobot = $derived(ours ? (robots[ours] ?? null) : null);
  const partnerRobot = $derived.by((): Robot | null => {
    if (partnerMode === "draw") {
      if (!drawn?.length) return null;
      return drawnPartner({
        start: drawn[0],
        stroke: drawn.slice(1),
        startS: at,
        shoots,
      });
    }
    return partner ? (robots[partner] ?? null) : null;
  });
  const choices = $derived(oursRobot ? routeChoices(oursRobot.doc.auto!) : []);

  const look = $derived({
    choices: Object.fromEntries(off.map((c) => [c, false])),
    tips: Object.fromEntries(miss.map((n) => [n, false])),
  });
  /** Ours alone, for the field while there is no pair to run (a partner being drawn). */
  const alone = $derived.by(() => {
    if (!oursRobot || !values || (result && !arming)) return null;
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
  /** Who TIPped each TIP that counts: 0 us, 1 the partner. */
  const tipBy = $derived(
    (result?.tipsInAuto ?? []).map((tip) => {
      const index = result!.tips.indexOf(tip);
      return (
        result!.lanes?.hive.volleys.find((v) => v.tip === index)?.robot ?? null
      );
    }),
  );
  const startsTouching = $derived(result?.contact?.t === 0);
  const partnerName = $derived(
    partnerMode === "draw"
      ? "Drawn partner"
      : partner
        ? displayName(partner)
        : "Partner",
  );

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
    const auto = robots[file]?.doc.auto;
    return (
      (!file.startsWith("partners/") && auto?.exportName) || displayName(file)
    );
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
      // A first visit starts beside the stand-in that stays out of the way.
      if (
        partnerMode === "standin" &&
        (!partner || !l.partners.includes(partner))
      )
        partner =
          l.partners.find((f) => f.endsWith("/partner-still.pp")) ?? null;
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

  $effect(() => {
    if (partnerMode === "standin" && partner) void loadRobot(partner);
  });

  // The link follows what is picked.
  $effect(() => {
    const state: PageState = {
      ours,
      partner: partnerMode === "standin" ? partner : null,
      drawn: partnerMode === "draw" ? drawn : null,
      at,
      shoots,
      alliance,
      off,
      miss,
    };
    const hash = stateHash(state);
    if (hash !== location.hash)
      history.replaceState(
        null,
        "",
        hash || location.pathname + location.search,
      );
  });

  // A new pick starts from the top.
  $effect(() => {
    void result;
    t = 0;
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
    // Drawing, or no pair yet: ours alone, at its start.
    const solo = arming || stroke !== null || !result;
    drawField(ctx, size, {
      robots: solo ? (oursRobot && alone ? [oursRobot] : []) : shown,
      previews: solo ? (alone ? [alone.preview] : []) : result!.previews,
      colors: COLORS,
      routes: solo ? (alone ? [alone.route] : []) : routes,
      t: solo ? 0 : t,
      contact: solo ? null : result!.contact,
      blue: alliance === "blue",
      image,
      stroke,
    });
  });

  function fieldPoint(event: PointerEvent): BasePoint {
    const rect = canvas!.getBoundingClientRect();
    return toField(
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect.width,
      alliance === "blue",
    );
  }

  function down(event: PointerEvent) {
    if (!arming || !canvas) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    playing = false;
    stroke = [fieldPoint(event)];
  }
  function move(event: PointerEvent) {
    if (!stroke) return;
    event.preventDefault();
    stroke = [...stroke, fieldPoint(event)];
  }
  function up() {
    if (!stroke) return;
    drawn = stroke;
    stroke = null;
    arming = false;
    t = 0;
  }

  // ---- Picks ----
  function pickOurs(file: string) {
    ours = file;
    off = [];
    miss = [];
  }
  function pickPartner(file: string) {
    partnerMode = "standin";
    partner = file;
    arming = false;
    miss = [];
  }
  function startDrawing() {
    partnerMode = "draw";
    arming = true;
    playing = false;
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
  function nudgeAt(delta: number) {
    at = Math.min(25, Math.max(0, Math.round((at + delta) * 2) / 2));
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
      <h1>Beside a partner</h1>
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
    <p class="lead">
      Our Auto and a partner's, run together: do they touch, does each park, how
      many TIPs.
    </p>
  </header>

  <div class="layout">
    <div class="stage">
      <div class="fieldbox">
        <canvas
          bind:this={canvas}
          class:arming
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
          disabled={!result || arming}
          aria-label={playing ? "Pause" : "Play"}>{playing ? "❚❚" : "▶"}</button
        >
        <div class="scrub">
          <input
            type="range"
            min="0"
            max={span}
            step="0.1"
            bind:value={t}
            disabled={!result || arming}
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
        {#if arming}
          <p class="drawhint">
            Put a finger on the partner's <b>start</b> and drag along its
            <b>path</b>. Lift to finish.
          </p>
        {:else if !result}
          <p class="quiet">
            {#if !values || !lists}Loading from biobuzz master…
            {:else if !oursRobot}Pick our Auto.
            {:else if partnerMode === "draw" && !drawn}Draw the partner on the
              field.
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
      {#if result}
        <section class="details">
          <h2>What happens</h2>
          <ul>
            <li class:bad={result.contact}>
              {#if !result.contact}
                <b>No contact</b> in the whole Auto.
              {:else if startsTouching}
                <b>They touch at the start:</b> both start on the same spot. A partner
                from the other side of the field fits beside this Auto.
              {:else}
                <b>They touch at {fmt(result.contact.t)}</b>, at the red ring on
                the field.
              {/if}
            </li>
            {#each result.ends as end, i (i)}
              <li
                class:bad={end.parkedAt === null &&
                  end.why !== "stays on its start"}
              >
                <span class="key" style:background={COLORS[i]}></span>
                <b>{i === 0 ? nameOf(ours ?? "") : partnerName}</b>:
                {#if end.parkedAt !== null}
                  parked at {fmt(end.parkedAt)}{#if end.byGuard}, by the endgame
                    guard{/if}.
                {:else if end.why === "stays on its start"}
                  never drives; it stays on its start.
                {:else}
                  not parked ({end.why}).
                {/if}
              </li>
            {/each}
            <li>
              <b
                >{result.tipsInAuto.length} TIP{result.tipsInAuto.length === 1
                  ? ""
                  : "s"}</b
              >{#if result.tipsInAuto.length}:{/if}
              {#each result.tipsInAuto as tip, i (i)}
                <span class="chip" class:late={tip.settled > 30}
                  >TIP {i + 1} settled {fmt(tip.settled)}{#if who(tipBy[i])}, {who(
                      tipBy[i],
                    )}{/if}{#if tip.settled > 30}, after AUTO: counts{/if}</span
                >
              {/each}
            </li>
          </ul>
        </section>
      {/if}

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
        {#if ours && pairOf(ours)}
          <p class="note">
            {nameOf(ours)} is drawn to run beside our {pairOf(ours)}. Beside
            anyone else, check this carefully.
          </p>
        {/if}
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
          <p class="note">
            A TIP that misses is its first try missing; a later volley at that
            CELL can still TIP it.
          </p>
        {/if}
      </section>

      <section>
        <h2>Partner</h2>
        <div class="seg two" role="group" aria-label="Partner">
          <button
            type="button"
            aria-pressed={partnerMode === "standin"}
            onclick={() => {
              partnerMode = "standin";
              arming = false;
              miss = [];
            }}>Stand-in</button
          >
          <button
            type="button"
            aria-pressed={partnerMode === "draw"}
            onclick={() =>
              drawn ? ((partnerMode = "draw"), (miss = [])) : startDrawing()}
            >Draw it</button
          >
        </div>

        {#if partnerMode === "standin"}
          <div class="picks">
            {#each lists?.partners ?? [] as file (file)}
              <button
                type="button"
                class="pick"
                aria-pressed={partner === file}
                onclick={() => pickPartner(file)}>{displayName(file)}</button
              >
            {/each}
          </div>
          {#if partner && failed[partner]}<p class="note warn">
              {failed[partner]}
            </p>{/if}
          <p class="note">
            The stand-ins in biobuzz <code>TeamCode/autos/partners/</code>.
          </p>
        {:else}
          <div class="drawn">
            <button
              type="button"
              class="btn primary"
              onclick={startDrawing}
              disabled={arming}
            >
              {drawn ? "Redraw on the field" : "Draw on the field"}
            </button>
            <div class="sw">
              <span>Starts driving</span>
              <div class="stepper">
                <button
                  type="button"
                  onclick={() => nudgeAt(-0.5)}
                  aria-label="Earlier">−</button
                >
                <output>{at === 0 ? "at PLAY" : `at ${at.toFixed(1)} s`}</output
                >
                <button
                  type="button"
                  onclick={() => nudgeAt(0.5)}
                  aria-label="Later">+</button
                >
              </div>
            </div>
            <div class="sw">
              <span>Shoots preloads first</span>
              <div class="seg">
                <button
                  type="button"
                  aria-pressed={!shoots}
                  onclick={() => (shoots = false)}>No</button
                >
                <button
                  type="button"
                  aria-pressed={shoots}
                  onclick={() => (shoots = true)}>Yes</button
                >
              </div>
            </div>
            <p class="note">
              It faces away from the wall it starts nearest, drives one smooth
              path through the drawing at our robot's speed, and stops at its
              end. If it shoots, it fires one volley at the CELL at its end
              before it drives. Send the link (it holds the drawing) to the
              team.
            </p>
          </div>
        {/if}
      </section>

      <p class="note foot">
        From the Visualizer's own preview and collision check: each robot's
        frame, every tenth of a second, with the team's timing facts on biobuzz
        master. It is a quick look, not the Java simulator, which stays the
        answer.
      </p>
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
  .lead {
    margin: 6px 0 0;
    color: var(--muted);
    font-size: 14px;
    max-width: 60ch;
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
  canvas.arming {
    touch-action: none;
    cursor: crosshair;
    outline: 3px solid var(--accent);
    outline-offset: -3px;
  }
  .drawhint {
    margin: 0;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--tag);
    color: var(--tag-ink);
    font-size: 15px;
    line-height: 1.35;
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
  .details ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 6px;
  }
  .details li.bad b {
    color: var(--warn-ink);
  }
  .details .key {
    margin-right: 4px;
    vertical-align: 2px;
  }
  .chip {
    display: inline-block;
    margin: 2px 4px 0 0;
    font-size: 12.5px;
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--seg);
    border: 1px solid var(--line);
    white-space: nowrap;
  }
  .chip.late {
    background: var(--trial);
    color: var(--trial-ink);
    border-color: transparent;
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
  .drawn {
    display: grid;
    gap: 8px;
  }
  .btn {
    font: inherit;
    font-size: 15px;
    font-weight: 700;
    min-height: 46px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: var(--seg);
    color: var(--ink);
    cursor: pointer;
  }
  .btn.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
  }
  .btn:disabled {
    opacity: 0.55;
  }
  .stepper {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) 44px;
    align-items: center;
    gap: 6px;
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
  .stepper output {
    text-align: center;
    font-weight: 700;
  }
  .note {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }
  .note.warn {
    color: var(--warn-ink);
  }
  .foot {
    padding: 0 4px;
  }
  code {
    font-family: var(--mono);
    font-size: 12.5px;
  }
</style>
