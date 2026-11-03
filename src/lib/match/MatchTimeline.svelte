<script lang="ts">
  /**
   * The Match view's timeline (lanes.ts): one row per Auto shown together, the shared HIVE between
   * them, and arrows for the chain the field cannot show (volley → TIP → the wait it ends). Read
   * only: click or drag to move the playback clock.
   *
   * Fork: `compact` is the Match view with two Autos side by side: thinner rows, the robots'
   * results in their side panels, the HIVE's sliders behind its label, and the play controls in
   * the corner, so the field keeps its height.
   */
  import type { Snippet } from "svelte";
  import {
    robotSummary as summary,
    type MatchLanes,
    type Segment,
    type WaitBar,
  } from "./lanes";

  interface Props {
    lanes: MatchLanes;
    /** The playback clock, seconds. */
    seconds: number;
    onSeek: (seconds: number) => void;
    compact?: boolean;
    /** Compact: the HIVE's sliders, opened from its label. */
    hive?: Snippet;
    /** Compact: a HIVE what-if is changed (a dot on its label). */
    hiveChanged?: boolean;
    /** Compact: play and loop, in the corner under the labels. */
    controls?: Snippet;
  }

  let {
    lanes,
    seconds,
    onSeek,
    compact = false,
    hive,
    hiveChanged = false,
    controls,
  }: Props = $props();

  const LABEL_W = 96;
  let ROBOT_H = $derived(compact ? 22 : 30);
  let HIVE_H = $derived(compact ? 20 : 26);
  let GAP = $derived(compact ? 18 : 26);
  let AXIS_H = $derived(compact ? 30 : 16);
  const PAD_R = 18;

  let hiveOpen = $state(false);
  let root = $state<HTMLElement>();

  let width = $state(600);

  /** Rows top to bottom: the first Auto, the HIVE, then the others. */
  type Row = { kind: "robot"; index: number } | { kind: "hive" };
  let rows = $derived.by((): Row[] => {
    const robots = lanes.robots.map((_, index): Row => ({
      kind: "robot",
      index,
    }));
    return robots.length
      ? [robots[0], { kind: "hive" }, ...robots.slice(1)]
      : [{ kind: "hive" }];
  });
  let rowTop = $derived.by(() => {
    const tops: number[] = [];
    let y = 4;
    for (const row of rows) {
      tops.push(y);
      y += (row.kind === "hive" ? HIVE_H : ROBOT_H) + GAP;
    }
    return tops;
  });
  let height = $derived(
    rows.reduce(
      (h, row) => h + (row.kind === "hive" ? HIVE_H : ROBOT_H) + GAP,
      4,
    ) -
      GAP +
      AXIS_H +
      6,
  );
  let hiveTop = $derived(rowTop[rows.findIndex((row) => row.kind === "hive")]);
  let plotW = $derived(Math.max(40, width - LABEL_W - PAD_R));
  const x = (t: number) =>
    LABEL_W + (Math.max(0, Math.min(t, lanes.span)) / lanes.span) * plotW;
  const w = (t0: number, t1: number) => Math.max(1.5, x(t1) - x(t0));

  function topOf(lane: number | "hive"): number {
    const i = rows.findIndex((row) =>
      lane === "hive"
        ? row.kind === "hive"
        : row.kind === "robot" && row.index === lane,
    );
    return rowTop[i] ?? 0;
  }
  function heightOf(lane: number | "hive") {
    return lane === "hive" ? HIVE_H : ROBOT_H;
  }

  let ticks = $derived(
    Array.from({ length: Math.floor(lanes.span / 5) + 1 }, (_, i) => i * 5),
  );

  const FILL: Record<Segment["kind"], string> = {
    drive: "",
    volley: "var(--color-warning)",
    spinup: "var(--color-warning)",
    pick: "var(--color-success)",
    gather: "#14b8a6",
    action: "#94a3b8",
  };

  const fmt = (t: number) => `${t.toFixed(1)} s`;

  /** A trigger that ended a wait, in words. */
  const CONDITION: Record<string, string> = {
    IntakeFull: "intake full",
    Empty: "launcher empty",
    CameraBlind: "camera blind",
  };

  function waitText(wait: WaitBar): string {
    if (wait.ended === "guard") return "cut by endgame";
    if (wait.atOnce) return "up already";
    if (wait.tip !== null) return `TIP ${wait.tip + 1}`;
    if (wait.ended === "time")
      return wait.branched ? "timed out → Otherwise" : "timed out";
    return CONDITION[wait.condition ?? ""] ?? wait.condition ?? "";
  }

  function waitTitle(wait: WaitBar): string {
    const limit =
      wait.limitAt !== null
        ? `, at most ${(wait.limitAt - wait.t0).toFixed(1)} s`
        : "";
    return `${wait.label}: ${fmt(wait.t0)} → ${fmt(wait.t1)} (${(wait.t1 - wait.t0).toFixed(1)} s${limit}) · ${waitText(wait)}`;
  }

  function linkPath(link: MatchLanes["links"][number]): string {
    const fromTop = topOf(link.from.lane);
    const toTop = topOf(link.to.lane);
    const down = toTop > fromTop;
    const y0 = down ? fromTop + heightOf(link.from.lane) : fromTop;
    const y1 = down ? toTop : toTop + heightOf(link.to.lane);
    const x0 = x(link.from.t);
    const x1 = x(link.to.t);
    const mid = (y0 + y1) / 2;
    return `M ${x0} ${y0} C ${x0} ${mid}, ${x1} ${mid}, ${x1} ${y1}`;
  }

  let dragging = false;
  function seekAt(event: PointerEvent) {
    const svg = event.currentTarget as SVGSVGElement;
    const box = svg.getBoundingClientRect();
    const px = event.clientX - box.left;
    if (px < LABEL_W - 4) return;
    const t = ((px - LABEL_W) / plotW) * lanes.span;
    onSeek(Math.max(0, Math.min(lanes.span, t)));
  }
</script>

<svelte:window
  onpointerdown={(event) => {
    if (hiveOpen && !root?.contains(event.target as Node)) hiveOpen = false;
  }}
  onkeydown={(event) => {
    if (hiveOpen && event.key === "Escape") hiveOpen = false;
  }}
/>

<div
  class="relative rounded-xl border border-border bg-base/60 px-2 pt-2 pb-1.5"
  bind:clientWidth={width}
  bind:this={root}
>
  <svg
    {width}
    {height}
    class="block cursor-col-resize touch-none outline-none select-none focus-visible:outline-2 focus-visible:outline-primary"
    role="slider"
    tabindex="0"
    aria-label="Match timeline: drag to move the clock"
    aria-valuemin={0}
    aria-valuemax={lanes.span}
    aria-valuenow={Math.round(seconds * 10) / 10}
    onpointerdown={(event) => {
      dragging = true;
      (event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId);
      seekAt(event);
    }}
    onpointermove={(event) => dragging && seekAt(event)}
    onpointerup={() => (dragging = false)}
    onlostpointercapture={() => (dragging = false)}
    onkeydown={(event) => {
      if (event.key === "ArrowRight")
        onSeek(Math.min(lanes.span, seconds + 0.5));
      else if (event.key === "ArrowLeft") onSeek(Math.max(0, seconds - 0.5));
      else return;
      event.preventDefault();
    }}
  >
    <defs>
      <marker
        id="match-arrow"
        viewBox="0 0 8 8"
        refX="7"
        refY="4"
        markerWidth="7"
        markerHeight="7"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 8 4 L 0 8 z" class="fill-heading" />
      </marker>
      <pattern
        id="match-swing"
        width="6"
        height="6"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect width="3" height="6" fill="var(--color-warning)" opacity="0.55" />
      </pattern>
    </defs>

    <!-- The grid: every 5 s, the 30 s end of the Auto stronger. -->
    {#each ticks as tick (tick)}
      <line
        x1={x(tick)}
        x2={x(tick)}
        y1={2}
        y2={height - AXIS_H}
        class="stroke-border"
        stroke-width={tick === 30 ? 1.5 : 1}
        stroke-dasharray={tick === 30 ? "" : "2 3"}
      />
      <text
        x={x(tick)}
        y={height - 4}
        text-anchor="middle"
        class="fill-body text-[10px] tabular-nums"
      >
        {tick}s
      </text>
    {/each}

    {#each rows as row, r (row.kind === "hive" ? "hive" : row.index)}
      {@const top = rowTop[r]}
      {#if row.kind === "hive"}
        {#if !(compact && hive)}
          <text
            x={4}
            y={top + HIVE_H / 2 + 4}
            class="fill-heading text-[11px] font-semibold">HIVE</text
          >
        {/if}
        {#each lanes.hive.cells as cell, i (i)}
          <rect
            x={x(cell.t0)}
            y={top + 2}
            width={w(cell.t0, cell.t1)}
            height={HIVE_H - 4}
            rx="3"
            fill={cell.state === "swing"
              ? "url(#match-swing)"
              : cell.state === "left"
                ? "#8b5cf6"
                : "#64748b"}
            opacity={cell.state === "swing" ? 1 : 0.35}
          >
            <title
              >{cell.state === "swing"
                ? "Swinging"
                : `${cell.state.toUpperCase()} CELL up`}: {fmt(cell.t0)} → {fmt(
                cell.t1,
              )}</title
            >
          </rect>
          {#if cell.state !== "swing" && x(cell.t1) - x(cell.t0) > 96}
            <text
              x={x(cell.t0) + 5}
              y={top + HIVE_H / 2 + 4}
              class="pointer-events-none fill-heading text-[10px]"
            >
              {cell.tip !== null ? `TIP ${cell.tip + 1} → ` : ""}{cell.state ===
              "left"
                ? "LEFT"
                : "RIGHT"} CELL up
            </text>
          {/if}
        {/each}
        {#each lanes.hive.volleys as volley, i (i)}
          <g>
            <line
              x1={x(volley.t)}
              x2={x(volley.t)}
              y1={top + HIVE_H - 9}
              y2={top + HIVE_H - 2}
              stroke={lanes.robots[volley.robot]?.color}
              stroke-width="2.5"
              opacity={volley.counted ? 1 : 0.4}
            />
            <title
              >{volley.name}'s volley lands at {fmt(volley.t)}: {volley.counted
                ? `the raised CELL holds ${volley.load} POLLEN${volley.tip !== null ? ` → TIP ${volley.tip + 1}` : ""}`
                : "mid-swing, does not count"}</title
            >
          </g>
        {/each}
      {:else}
        {@const robot = lanes.robots[row.index]}
        <rect
          x={2}
          y={top + 6}
          width={4}
          height={ROBOT_H - 12}
          rx="2"
          fill={robot.color}
        />
        <text
          x={10}
          y={top + ROBOT_H / 2 + 4}
          class="fill-heading text-[11px] font-semibold"
        >
          {robot.name.length > 13 ? `${robot.name.slice(0, 12)}…` : robot.name}
          <title>{robot.name}</title>
        </text>
        <!-- Waits: outlined to their "at most", filled until they ended. -->
        {#each robot.waits as wait, i (i)}
          {#if wait.limitAt !== null && wait.limitAt > wait.t1 + 1e-6}
            <rect
              x={x(wait.t0)}
              y={top + 3}
              width={w(wait.t0, wait.limitAt)}
              height={ROBOT_H - 6}
              rx="4"
              fill="none"
              class="stroke-body"
              stroke-dasharray="3 3"
              opacity="0.6"
            />
          {/if}
          <rect
            x={x(wait.t0)}
            y={top + 3}
            width={w(wait.t0, wait.t1)}
            height={ROBOT_H - 6}
            rx="4"
            class={wait.ended === "trigger"
              ? "fill-body/25 stroke-body"
              : "fill-danger/25 stroke-danger"}
            stroke-width="1"
          >
            <title>{waitTitle(wait)}</title>
          </rect>
          {#if x(wait.t1) - x(wait.t0) > 36}
            <text
              x={x(wait.t0) + 4}
              y={top + ROBOT_H / 2 + 4}
              class="pointer-events-none fill-heading text-[10px]"
            >
              wait · {waitText(wait)}
            </text>
          {/if}
        {/each}
        {#each robot.segments as segment, i (i)}
          {#if segment.kind === "drive"}
            <rect
              x={x(segment.t0)}
              y={top + ROBOT_H / 2 - 3}
              width={w(segment.t0, segment.t1)}
              height={6}
              rx="3"
              fill={robot.color}
              opacity="0.7"
            >
              <title
                >Drive {segment.label}: {fmt(segment.t0)} → {fmt(
                  segment.t1,
                )}</title
              >
            </rect>
          {:else if segment.kind === "spinup"}
            <circle
              cx={x(segment.t0)}
              cy={top + ROBOT_H / 2}
              r="3"
              fill={FILL.spinup}
            >
              <title>Spin up at {fmt(segment.t0)}</title>
            </circle>
          {:else}
            <rect
              x={x(segment.t0)}
              y={top + 4}
              width={w(segment.t0, segment.t1)}
              height={ROBOT_H - 8}
              rx="3"
              fill={FILL[segment.kind]}
              opacity="0.85"
            >
              <title
                >{segment.label}: {fmt(segment.t0)} → {fmt(segment.t1)}</title
              >
            </rect>
            {#if x(segment.t1) - x(segment.t0) > 46}
              <text
                x={x(segment.t0) + 4}
                y={top + ROBOT_H / 2 + 4}
                class="pointer-events-none fill-black text-[10px]"
              >
                {segment.label}
              </text>
            {/if}
          {/if}
        {/each}
        <!-- Where the robot is done, or the guard parked it. -->
        {#if robot.endTime <= lanes.span}
          <line
            x1={x(robot.endTime)}
            x2={x(robot.endTime)}
            y1={top + 2}
            y2={top + ROBOT_H - 2}
            stroke={robot.color}
            stroke-width="2"
          >
          </line>
        {/if}
      {/if}
    {/each}

    <!-- The chain: a volley TIPs the HIVE, the TIP ends a wait. -->
    {#each lanes.links as link, i (i)}
      <path
        d={linkPath(link)}
        fill="none"
        class="pointer-events-none stroke-heading"
        stroke-width="1.75"
        opacity="0.9"
        marker-end="url(#match-arrow)"
      />
    {/each}

    <line
      x1={x(seconds)}
      x2={x(seconds)}
      y1={0}
      y2={height - AXIS_H}
      stroke="var(--color-primary)"
      stroke-width="2"
      class="pointer-events-none"
    />
  </svg>

  {#if compact && hive}
    {@const tips = lanes.hive.tipsInAuto}
    <!-- The HIVE's label opens its what-ifs; their sliders are not under the field. -->
    <button
      type="button"
      class={[
        "absolute left-2 flex items-center gap-1 rounded px-1 text-left text-[11px] hover:bg-body/10",
        hiveOpen && "bg-body/10",
      ]}
      style={`top: ${8 + hiveTop}px; width: ${LABEL_W - 6}px; height: ${HIVE_H}px`}
      title={`${tips} TIP${tips === 1 ? "" : "s"} settled by 30 s. Click for the HIVE's what-ifs`}
      aria-expanded={hiveOpen}
      onclick={() => (hiveOpen = !hiveOpen)}
    >
      <span class="font-semibold text-heading">HIVE</span>
      {#if hiveChanged}<span class="text-primary" title="A HIVE what-if is set"
          >•</span
        >{/if}
      <span class="text-[10px] text-body"
        >{tips} TIP{tips === 1 ? "" : "s"}</span
      >
      <span class="ml-auto text-body">▾</span>
    </button>
    {#if hiveOpen}
      <div
        class="absolute left-2 z-30 w-[26rem] max-w-[calc(100%-1rem)] rounded-lg border border-border bg-surface shadow-lg"
        style={`bottom: calc(100% - ${8 + hiveTop - 4}px)`}
      >
        {@render hive()}
      </div>
    {/if}
  {/if}
  {#if compact && controls}
    <div class="absolute bottom-1.5 left-2 flex items-center gap-1">
      {@render controls()}
    </div>
  {/if}

  {#if !compact}
    <div
      class="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 px-1 text-[11px] text-body"
    >
      {#each lanes.robots as robot (robot.name)}
        <span class="flex items-center gap-1.5">
          <span
            class="inline-block size-2 rounded-full"
            style={`background: ${robot.color}`}
          ></span>
          <span class="font-semibold text-heading">{robot.name}</span>
          {summary(robot)}
        </span>
      {/each}
      <span>
        <span class="font-semibold text-heading">HIVE</span>
        {lanes.hive.tipsInAuto} TIP{lanes.hive.tipsInAuto === 1 ? "" : "s"} settled
        by 30 s
      </span>
    </div>
  {/if}
</div>
