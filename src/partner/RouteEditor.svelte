<script lang="ts">
  /**
   * The partner's Auto as steps (route.ts): when they shoot (and how long their volley is), where
   * they drive and by when, waits, a FLOWER or the GARDEN, the park; and "they wait", to try them
   * a little later. Spots and bends are dragged on the field ("Move spots"); times are − / +.
   * Shots show their last ball out and when the CELL settles; drives when they get there.
   */
  import {
    nextSpot,
    withSteps,
    type PartnerRoute,
    type RouteStep,
  } from "./route";

  export interface ShotTimes {
    /** Launch starts, last ball leaves, seconds after PLAY. */
    t0: number;
    t1: number;
    /** When the CELL it TIPs settles; null: it TIPs nothing. */
    settled: number | null;
  }

  interface Props {
    route: PartnerRoute;
    /** When each drive gets there, by step index. */
    arrivals: Record<number, number>;
    /** Each shot's times, by step index. */
    shots: Record<number, ShotTimes>;
    /** The field's markers take touches: spots are being moved. */
    moving: boolean;
    onChange: (route: PartnerRoute) => void;
  }
  let {
    route,
    arrivals,
    shots,
    moving = $bindable(),
    onChange,
  }: Props = $props();

  const STEP_S = 0.5;
  const LATE_S = 0.25;
  const clampS = (s: number, max = 30) =>
    Math.min(max, Math.max(0, Math.round(s / STEP_S) * STEP_S));
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
    const driveTo = (park: boolean): RouteStep => ({
      kind: "drive",
      to: nextSpot(route),
      bend: null,
      by: null,
      park,
    });
    if (kind === "park") {
      // One park, and last: an earlier one becomes a plain drive.
      steps = steps.map((s) =>
        s.kind === "drive" ? { ...s, park: false } : s,
      );
      steps.push(driveTo(true));
    } else {
      const step: RouteStep =
        kind === "drive"
          ? driveTo(false)
          : kind === "wait"
            ? { kind: "wait", until: 10 }
            : kind === "shoot"
              ? { kind: "shoot", at: null }
              : { kind };
      // New steps go before the park, which stays last.
      const park = steps.findIndex((s) => s.kind === "drive" && s.park);
      if (park >= 0) steps.splice(park, 0, step);
      else steps.push(step);
    }
    onChange(withSteps(route, steps));
    if (kind === "drive" || kind === "park") moving = true;
  }
  function turn(i: number | "start") {
    if (i === "start") {
      onChange({
        ...route,
        start: { ...route.start, h: (route.start.h + 315) % 360 },
      });
      return;
    }
    const s = route.steps[i];
    if (s.kind === "drive")
      set(i, { ...s, to: { ...s.to, h: (s.to.h + 315) % 360 } });
  }
  /** A time stepper's next value: from "any time" it starts where the preview has it. */
  function nudge(value: number | null, fallback: number, delta: number) {
    return clampS(value === null ? Math.ceil(fallback) : value + delta);
  }
  function lateText(by: number | null, at: number): string {
    if (by !== null && at > by + LATE_S) return ` · ${fmt(at - by)} late`;
    if (at > 30 + 1e-6) return " · after AUTO";
    return "";
  }

  const label = (s: RouteStep, n: number) =>
    s.kind === "shoot"
      ? "Shoots"
      : s.kind === "pick"
        ? "Picks a FLOWER"
        : s.kind === "gather"
          ? "Gathers at the GARDEN"
          : s.kind === "superFlower"
            ? "SUPER FLOWER: shoots 8 when its CELL is up"
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

  <div class="knobs">
    <div class="knob">
      <span>Volley</span>
      <button
        type="button"
        aria-label="Shorter volley"
        onclick={() =>
          onChange({
            ...route,
            volleyS: Math.max(0.5, clampS(route.volleyS - STEP_S, 10)),
          })}>−</button
      >
      <b>{fmt(route.volleyS)}</b>
      <button
        type="button"
        aria-label="Longer volley"
        onclick={() =>
          onChange({ ...route, volleyS: clampS(route.volleyS + STEP_S, 10) })}
        >+</button
      >
    </div>
    <div class="knob">
      <span>They wait</span>
      <button
        type="button"
        aria-label="They wait less"
        onclick={() =>
          onChange({ ...route, delayS: clampS(route.delayS - STEP_S, 15) })}
        >−</button
      >
      <b>+{fmt(route.delayS)}</b>
      <button
        type="button"
        aria-label="They wait more"
        onclick={() =>
          onChange({ ...route, delayS: clampS(route.delayS + STEP_S, 15) })}
        >+</button
      >
    </div>
  </div>

  <button
    type="button"
    class="btn move"
    aria-pressed={moving}
    onclick={() => (moving = !moving)}
    >{moving ? "Done moving spots" : "Move spots on the field"}</button
  >

  <ol class="steps">
    <li class="step">
      <span class="num">S</span>
      <span class="what">Starts here</span>
      <span class="acts">
        <button
          type="button"
          aria-label="Turn the start 45 degrees"
          onclick={() => turn("start")}>⟳</button
        >
      </span>
    </li>
    {#each route.steps as step, i (i)}
      <li class="step">
        <span class="num">{numbers[i] || ""}</span>
        <span class="what">{label(step, numbers[i])}</span>
        <span class="acts">
          {#if step.kind === "drive"}
            {#if step.bend}
              <button
                type="button"
                aria-label="Straighten this drive"
                onclick={() => set(i, { ...step, bend: null })}>⟋</button
              >
            {/if}
            <button
              type="button"
              aria-label="Turn 45 degrees at this spot"
              onclick={() => turn(i)}>⟳</button
            >
          {/if}
          <button
            type="button"
            class="del"
            aria-label="Remove this step"
            onclick={() => remove(i)}>✕</button
          >
        </span>
        {#if step.kind === "drive" || step.kind === "shoot" || step.kind === "wait"}
          {@const value =
            step.kind === "drive"
              ? step.by
              : step.kind === "shoot"
                ? step.at
                : step.until}
          {@const preview =
            step.kind === "drive"
              ? arrivals[i]
              : step.kind === "shoot"
                ? shots[i]?.t0
                : undefined}
          <div class="time">
            <span class="by"
              >{step.kind === "drive"
                ? "by"
                : step.kind === "shoot"
                  ? "at"
                  : ""}</span
            >
            <button
              type="button"
              aria-label="Earlier"
              onclick={() => {
                const v = nudge(value, preview ?? 10, -STEP_S);
                set(
                  i,
                  step.kind === "drive"
                    ? { ...step, by: v }
                    : step.kind === "shoot"
                      ? { ...step, at: v }
                      : { ...step, until: v },
                );
              }}>−</button
            >
            {#if step.kind === "wait"}
              <span class="value">{fmt(step.until)}</span>
            {:else}
              <button
                type="button"
                class="value"
                onclick={() => {
                  const v =
                    value === null ? clampS(Math.ceil(preview ?? 10)) : null;
                  set(
                    i,
                    step.kind === "drive"
                      ? { ...step, by: v }
                      : { ...step, at: v },
                  );
                }}>{value === null ? "any time" : fmt(value)}</button
              >
            {/if}
            <button
              type="button"
              aria-label="Later"
              onclick={() => {
                const v = nudge(value, preview ?? 10, STEP_S);
                set(
                  i,
                  step.kind === "drive"
                    ? { ...step, by: v }
                    : step.kind === "shoot"
                      ? { ...step, at: v }
                      : { ...step, until: v },
                );
              }}>+</button
            >
          </div>
          {#if step.kind === "drive" && arrivals[i] !== undefined}
            <p class="out" class:late={lateText(step.by, arrivals[i]) !== ""}>
              There {fmt(arrivals[i])}{lateText(step.by, arrivals[i])}
            </p>
          {:else if step.kind === "shoot" && shots[i]}
            <p class="out">
              Last ball {fmt(shots[i].t1)} · {shots[i].settled === null
                ? "no TIP"
                : `CELL settled ${fmt(shots[i].settled!)}`}
            </p>
          {/if}
        {:else if step.kind === "superFlower" && shots[i]}
          <p class="out">
            Shoots {fmt(shots[i].t0)} · last ball {fmt(shots[i].t1)} · {shots[i]
              .settled === null
              ? "no TIP"
              : `CELL settled ${fmt(shots[i].settled!)}`}
          </p>
        {/if}
      </li>
    {/each}
  </ol>

  <div class="adds" role="group" aria-label="Add a step">
    <button type="button" onclick={() => add("shoot")}>+ Shoot</button>
    <button type="button" onclick={() => add("drive")}>+ Drive</button>
    <button type="button" onclick={() => add("pick")}>+ FLOWER</button>
    <button type="button" onclick={() => add("gather")}>+ GARDEN</button>
    <button type="button" onclick={() => add("superFlower")}
      >+ SUPER FLOWER</button
    >
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
  .name > span,
  .knob > span {
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
  .knobs {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 6px 12px;
  }
  .knob {
    display: grid;
    grid-template-columns: 4.6em 40px minmax(0, 1fr) 40px;
    align-items: center;
    gap: 6px;
  }
  .knob b {
    text-align: center;
    font-size: 15px;
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
    min-width: 1.2em;
  }
  .time button,
  .acts button,
  .knob button {
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
  }
  .out {
    grid-column: 2 / -1;
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }
  .out.late {
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
