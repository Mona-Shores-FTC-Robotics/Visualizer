<script lang="ts">
  /**
   * The partner's Auto as steps (route.ts): its name, where it starts, then shoot, pick a FLOWER,
   * drive to a spot by a time, wait until a time, and park. Spots are moved by dragging their
   * numbered markers on the field ("Move spots"); times with − and + buttons. Each drive shows when
   * the preview gets it there, and says so when that is later than the partner said.
   */
  import {
    nextSpot,
    withSteps,
    type PartnerRoute,
    type RouteStep,
  } from "./route";

  interface Props {
    route: PartnerRoute;
    /** When each drive gets there in the run with our Auto, by step index. */
    arrivals: Record<number, number>;
    /** The field's markers take touches: spots are being moved. */
    moving: boolean;
    onChange: (route: PartnerRoute) => void;
  }
  let { route, arrivals, moving = $bindable(), onChange }: Props = $props();

  const STEP_S = 0.5;
  const LATE_S = 0.25;
  const clampS = (s: number) =>
    Math.min(30, Math.max(0, Math.round(s / STEP_S) * STEP_S));
  const fmt = (s: number) => `${s.toFixed(1)} s`;

  /** Each drive's number on the field: 1, 2, … in order. */
  const numbers = $derived.by(() => {
    let n = 0;
    return route.steps.map((s) => (s.kind === "drive" ? ++n : 0));
  });
  const parked = $derived(
    route.steps.some((s) => s.kind === "drive" && s.park),
  );

  function set(i: number, step: RouteStep) {
    onChange(
      withSteps(
        route,
        route.steps.map((s, k) => (k === i ? step : s)),
      ),
    );
  }
  function remove(i: number) {
    onChange(
      withSteps(
        route,
        route.steps.filter((_, k) => k !== i),
      ),
    );
  }
  function add(kind: RouteStep["kind"] | "park") {
    let steps = [...route.steps];
    if (kind === "park") {
      // One park, and last: an earlier one becomes a plain drive.
      steps = steps.map((s) =>
        s.kind === "drive" ? { ...s, park: false } : s,
      );
      steps.push({ kind: "drive", to: nextSpot(route), by: null, park: true });
    } else {
      const step: RouteStep =
        kind === "drive"
          ? { kind: "drive", to: nextSpot(route), by: null, park: false }
          : kind === "wait"
            ? { kind: "wait", until: 10 }
            : { kind };
      // New steps go before the park, which stays last.
      const park = steps.findIndex((s) => s.kind === "drive" && s.park);
      if (park >= 0) steps.splice(park, 0, step);
      else steps.push(step);
    }
    onChange(withSteps(route, steps));
    if (kind === "drive" || kind === "park") moving = true;
  }
  function turn(i: number | "start", by: number) {
    if (i === "start") {
      onChange({
        ...route,
        start: { ...route.start, h: (route.start.h + by + 360) % 360 },
      });
      return;
    }
    const s = route.steps[i];
    if (s.kind === "drive")
      set(i, { ...s, to: { ...s.to, h: (s.to.h + by + 360) % 360 } });
  }
  function nudgeBy(i: number, delta: number) {
    const s = route.steps[i];
    if (s.kind !== "drive") return;
    const base = s.by ?? Math.ceil(arrivals[i] ?? 10);
    set(i, { ...s, by: clampS(s.by === null ? base : base + delta) });
  }
  function nudgeUntil(i: number, delta: number) {
    const s = route.steps[i];
    if (s.kind === "wait") set(i, { ...s, until: clampS(s.until + delta) });
  }

  /** What is wrong with an arrival: later than the partner said, or after AUTO ends; else "". */
  function lateText(by: number | null, at: number): string {
    if (by !== null && at > by + LATE_S)
      return `: ${fmt(at - by)} later than they said`;
    if (at > 30 + 1e-6) return ": after AUTO ends";
    return "";
  }

  const label = (s: RouteStep, n: number) =>
    s.kind === "shoot"
      ? "Shoots (when its CELL is up)"
      : s.kind === "pick"
        ? "Picks a FLOWER"
        : s.kind === "wait"
          ? "Waits until"
          : s.park
            ? `Parks at ${n}`
            : `Drives to ${n}`;
</script>

<div class="editor">
  <label class="name">
    <span>Name</span>
    <input
      value={route.name}
      maxlength="40"
      placeholder="What they call it: X, Close side…"
      oninput={(e) => onChange({ ...route, name: e.currentTarget.value })}
    />
  </label>

  <button
    type="button"
    class="btn move"
    aria-pressed={moving}
    onclick={() => (moving = !moving)}
    >{moving ? "Done moving spots" : "Move spots on the field"}</button
  >

  <ol class="steps">
    <li class="step">
      <span class="num start">S</span>
      <span class="what">Starts here</span>
      <span class="acts">
        <button
          type="button"
          aria-label="Turn the start 45 degrees"
          title="Turn 45°"
          onclick={() => turn("start", -45)}>⟳</button
        >
      </span>
    </li>
    {#each route.steps as step, i (i)}
      <li class="step">
        <span class="num" class:start={false}>{numbers[i] || ""}</span>
        <span class="what">{label(step, numbers[i])}</span>
        <span class="acts">
          {#if step.kind === "drive"}
            <button
              type="button"
              aria-label="Turn 45 degrees at this spot"
              title="Turn 45°"
              onclick={() => turn(i, -45)}>⟳</button
            >
          {/if}
          <button
            type="button"
            class="del"
            aria-label="Remove this step"
            onclick={() => remove(i)}>✕</button
          >
        </span>
        {#if step.kind === "drive"}
          <div class="time">
            <span class="by">by</span>
            <button
              type="button"
              aria-label="Earlier"
              onclick={() => nudgeBy(i, -STEP_S)}>−</button
            >
            <button
              type="button"
              class="value"
              onclick={() =>
                set(i, {
                  ...step,
                  by:
                    step.by === null
                      ? clampS(Math.ceil(arrivals[i] ?? 10))
                      : null,
                })}>{step.by === null ? "any time" : fmt(step.by)}</button
            >
            <button
              type="button"
              aria-label="Later"
              onclick={() => nudgeBy(i, STEP_S)}>+</button
            >
          </div>
          {#if arrivals[i] !== undefined}
            <p class="arrive" class:late={lateText(step.by, arrivals[i])}>
              Gets there at {fmt(arrivals[i])}{lateText(step.by, arrivals[i])}
            </p>
          {/if}
        {:else if step.kind === "wait"}
          <div class="time">
            <span class="by">until</span>
            <button
              type="button"
              aria-label="Earlier"
              onclick={() => nudgeUntil(i, -STEP_S)}>−</button
            >
            <span class="value">{fmt(step.until)}</span>
            <button
              type="button"
              aria-label="Later"
              onclick={() => nudgeUntil(i, STEP_S)}>+</button
            >
          </div>
        {/if}
      </li>
    {/each}
  </ol>

  <div class="adds" role="group" aria-label="Add a step">
    <button type="button" onclick={() => add("shoot")}>+ Shoot</button>
    <button type="button" onclick={() => add("drive")}>+ Drive</button>
    <button type="button" onclick={() => add("pick")}>+ FLOWER</button>
    <button type="button" onclick={() => add("wait")}>+ Wait</button>
    <button type="button" onclick={() => add("park")}
      >{parked ? "+ Park (move it)" : "+ Park"}</button
    >
  </div>
</div>

<style>
  .editor {
    display: grid;
    gap: 8px;
  }
  .name {
    display: grid;
    grid-template-columns: 4.6em minmax(0, 1fr);
    align-items: center;
    gap: 10px;
  }
  .name > span {
    font-size: 13px;
    font-weight: 700;
    color: var(--muted);
  }
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
  .btn {
    font: inherit;
    font-size: 15px;
    font-weight: 700;
    min-height: 44px;
    border-radius: 10px;
    border: 1px solid var(--accent);
    background: transparent;
    color: var(--accent);
    cursor: pointer;
  }
  .btn[aria-pressed="true"] {
    background: var(--accent);
    color: var(--accent-ink);
  }
  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .step {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr) auto;
    align-items: center;
    gap: 4px 8px;
    padding: 6px 8px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--seg);
  }
  .num {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: 13px;
    background: #4ecdc4;
    color: #111;
  }
  .num:empty {
    background: transparent;
  }
  .what {
    font-weight: 700;
    font-size: 14px;
    line-height: 1.2;
  }
  .time {
    grid-column: 2 / -1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .time .by {
    font-size: 13px;
    color: var(--muted);
    font-weight: 700;
  }
  .time button,
  .acts button {
    font: inherit;
    font-size: 17px;
    font-weight: 700;
    min-width: 40px;
    height: 40px;
    border-radius: 9px;
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--ink);
    cursor: pointer;
  }
  .time .value {
    min-width: 5.4em;
    font-size: 15px;
    text-align: center;
  }
  span.value {
    display: inline-grid;
    place-items: center;
    height: 40px;
    font-weight: 700;
  }
  .acts {
    display: inline-flex;
    gap: 4px;
  }
  .del {
    color: var(--muted);
    font-size: 14px;
  }
  .arrive {
    grid-column: 2 / -1;
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }
  .arrive.late {
    color: var(--warn-ink);
    font-weight: 700;
  }
  .adds {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .adds button {
    font: inherit;
    font-size: 14px;
    font-weight: 700;
    min-height: 44px;
    padding: 6px 12px;
    border-radius: 10px;
    border: 1px dashed var(--accent);
    background: transparent;
    color: var(--accent);
    cursor: pointer;
  }
  button:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
</style>
