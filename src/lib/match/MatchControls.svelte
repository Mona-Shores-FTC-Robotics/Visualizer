<script lang="ts">
  /**
   * The Match view's controls: the first Auto's facts on the left, the HIVE's in the middle, the
   * others' on the right, as they sit on the timeline. What-ifs for this look only
   * (controls.svelte.ts): the team's facts are never changed from here.
   */
  import type { AutoSection } from "../auto/types";
  import { previewQuestions } from "../auto/simulate";
  import type { TimingFact, TimingValues } from "../timing/model";
  import {
    clampFact,
    factStep,
    HIVE_FACT_LIST,
    MATCH_PRESETS,
    ROBOT_FACT_LIST,
    type MatchControls,
  } from "./controls.svelte";
  import { checkboxClass, labelClass } from "../components/ui/styles";
  import type { FieldEntry } from "../timing/together";
  import { knobBreaks, type Knob, type KnobBreaks } from "./breakpoints";

  interface RobotInfo {
    file: string;
    name: string;
    color: string;
    auto: AutoSection;
  }

  interface Props {
    robots: RobotInfo[];
    controls: MatchControls;
    /** The team's facts (timing.json and this laptop's), before any what-if. */
    base: TimingValues;
    /** What is previewed now, what-ifs and all: `robots[i]` is `entries[i]`. */
    entries: FieldEntry[];
    /** The shared facts previewed now (the team's, with the HIVE what-ifs). */
    values: TimingValues;
  }

  let { robots, controls, base, entries, values }: Props = $props();

  /** Tipping points found for the what-ifs as they are now, by slider. */
  let ticks = $state<Record<string, KnobBreaks>>({});
  let searching = $state(false);
  let searched = $state(false);
  /** Bumped by every change, so a search that is overtaken stops. */
  let generation = 0;
  const keyOf = (knob: Knob) => `${knob.robot ?? "hive"}:${knob.id}`;

  // Any change to what is previewed makes the ticks stale.
  $effect(() => {
    void entries;
    void values;
    generation += 1;
    ticks = {};
    searched = false;
    searching = false;
  });

  /** Searches every slider, one per tick of the clock, so the page stays live. */
  function findTicks() {
    const run = ++generation;
    const names = robots.map((r) => r.name);
    const knobs: Knob[] = [
      ...HIVE_FACT_LIST.map((f): Knob => ({ robot: null, id: f.id })),
      ...robots.flatMap((r, robot) =>
        controls.still[r.file]
          ? []
          : ROBOT_FACT_LIST.map((f): Knob => ({ robot, id: f.id })),
      ),
    ];
    const snapshot = { entries, values };
    ticks = {};
    searching = true;
    const step = (i: number) => {
      if (run !== generation) return;
      if (i >= knobs.length) {
        searching = false;
        searched = true;
        return;
      }
      try {
        const found = knobBreaks(
          snapshot.entries,
          snapshot.values,
          knobs[i],
          names,
        );
        ticks = { ...ticks, [keyOf(knobs[i])]: found };
      } catch (error) {
        console.error("Tipping point search failed:", error);
      }
      setTimeout(() => step(i + 1), 0);
    };
    setTimeout(() => step(0), 30);
  }

  /** Where a value sits along a slider, 0–100. */
  const along = (fact: TimingFact, v: number) =>
    ((v - fact.range[0]) / (fact.range[1] - fact.range[0])) * 100;

  let width = $state(900);
  /** Narrow: one panel at a time, picked by tab. */
  let narrow = $derived(width < 720);
  let tab = $state<string>("hive");

  /** Short names for the sliders; FACTS' labels say it in full, in the tooltip. */
  const SHORT: Record<string, string> = {
    driveSpeed: "Drive speed",
    spinUpS: "Spin-up",
    volleyS: "Volley time",
    intakeFullS: "Intake full",
    volleyLoad: "Hits per volley",
    tipStartS: "TIP delay",
    tipSwingS: "HIVE swing",
    tipLoad: "Weight to TIP",
    startLoad: "Start weight",
  };

  /** What a trigger coming means, for its checkbox. */
  const TRIGGER: Record<string, string> = {
    CellUp: "TIP or CELL up comes",
    Tip: "TIP comes",
    LeftCellUp: "LEFT CELL comes up",
    RightCellUp: "RIGHT CELL comes up",
    IntakeFull: "Intake fills",
    Empty: "Launcher empties",
    CameraBlind: "Camera goes blind",
  };

  function unit(fact: TimingFact) {
    if (fact.unit === "POLLEN") return "";
    if (fact.unit === "×") return "×";
    return " s";
  }
  function show(fact: TimingFact, value: number) {
    const digits = fact.unit === "POLLEN" ? 0 : fact.unit === "×" ? 2 : 1;
    return `${value.toFixed(digits)}${unit(fact)}`;
  }

  /** Each robot's triggers: one checkbox per condition its waits ask. */
  function triggers(auto: AutoSection): string[] {
    const seen: string[] = [];
    for (const q of previewQuestions(auto))
      if (!seen.includes(q.condition)) seen.push(q.condition);
    return seen;
  }

  /** Whether a condition comes: the controls only ever answer one for every wait on it. */
  function comes(robot: RobotInfo, condition: string): boolean {
    return controls.scenario[robot.file]?.[condition] ?? true;
  }

  function robotValue(robot: RobotInfo, fact: TimingFact): number {
    return controls.own[robot.file]?.[fact.id] ?? base[fact.id];
  }
  function hiveValue(fact: TimingFact): number {
    return controls.hive[fact.id] ?? base[fact.id];
  }

  let first = $derived(robots.slice(0, 1));
  let rest = $derived(robots.slice(1));
</script>

{#snippet slider(
  fact: TimingFact,
  value: number,
  changed: boolean,
  set: (v: number | null) => void,
  knob: Knob,
)}
  {@const found = ticks[keyOf(knob)]}
  <label
    class="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-2 text-[11px]"
    title={`${fact.label}. Times: ${fact.times}. Team value ${show(fact, base[fact.id])}.`}
  >
    <span
      class={["truncate", changed ? "font-semibold text-heading" : "text-body"]}
    >
      {SHORT[fact.id] ?? fact.label}
    </span>
    <span class="relative block">
      <input
        type="range"
        class="w-full accent-primary"
        min={fact.range[0]}
        max={fact.range[1]}
        step={factStep(fact)}
        {value}
        oninput={(event) => {
          const v = clampFact(
            fact,
            Number((event.currentTarget as HTMLInputElement).value),
          );
          set(v === null || Math.abs(v - base[fact.id]) < 1e-9 ? null : v);
        }}
      />
      {#each [found?.down, found?.up] as tick, i (i)}
        {#if tick}
          <span
            class="pointer-events-none absolute -bottom-0.5 h-1.5 w-0.5 -translate-x-1/2 rounded bg-warning"
            style={`left: ${along(fact, tick.value)}%`}
            title={`${show(fact, tick.value)}: ${tick.change}`}
          ></span>
        {/if}
      {/each}
    </span>
    <span class="flex items-center justify-end gap-1 tabular-nums">
      <span class={changed ? "font-semibold text-primary" : "text-heading"}>
        {show(fact, value)}
      </span>
      {#if changed}
        <button
          type="button"
          class="text-body hover:text-heading"
          title={`Back to the team's ${show(fact, base[fact.id])}`}
          aria-label={`Reset ${SHORT[fact.id]}`}
          onclick={(event) => {
            event.preventDefault();
            set(null);
          }}>↺</button
        >
      {/if}
    </span>
    {#if found && (found.down || found.up)}
      <span
        class="col-span-3 -mt-0.5 truncate text-[10px] text-warning"
        title={[found.down, found.up]
          .filter((t) => t)
          .map((t) => `${show(fact, t!.value)}: ${t!.change}`)
          .join("\n")}
      >
        {#if found.down}↓ {show(fact, found.down.value)}: {found.down
            .change}{/if}{#if found.down && found.up}
          &nbsp;·&nbsp;{/if}{#if found.up}↑ {show(fact, found.up.value)}: {found
            .up.change}{/if}
      </span>
    {/if}
  </label>
{/snippet}

{#snippet robotPanel(robot: RobotInfo)}
  {@const still = controls.still[robot.file] ?? false}
  <section
    class="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-base/60 p-2"
  >
    <header class="flex items-center gap-2">
      <span
        class="inline-block size-2.5 shrink-0 rounded-full"
        style={`background: ${robot.color}`}
      ></span>
      <span
        class="truncate text-xs font-semibold text-heading"
        title={robot.file}>{robot.name}</span
      >
      <label
        class={[labelClass, "ml-auto flex items-center gap-1 text-[11px]"]}
        title="The robot stays at its start: a partner that does not run its Auto"
      >
        <input
          type="checkbox"
          class={checkboxClass}
          checked={still}
          onchange={(event) =>
            controls.setStill(
              robot.file,
              (event.currentTarget as HTMLInputElement).checked,
            )}
        />
        No-show
      </label>
    </header>
    <div
      class={["flex flex-col gap-1", still && "pointer-events-none opacity-40"]}
    >
      {#each ROBOT_FACT_LIST as fact (fact.id)}
        {@render slider(
          fact,
          robotValue(robot, fact),
          controls.own[robot.file]?.[fact.id] !== undefined,
          (v) => controls.setOwn(robot.file, fact.id, v),
          { robot: robots.indexOf(robot), id: fact.id },
        )}
      {/each}
      {#if triggers(robot.auto).length}
        <div
          class="mt-1 flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-1.5"
        >
          {#each triggers(robot.auto) as condition (condition)}
            {@const yes = comes(robot, condition)}
            <label
              class={[
                labelClass,
                "flex items-center gap-1 text-[11px]",
                !yes && "text-danger",
              ]}
              title={yes
                ? "Comes when the timing says. Untick: it never comes, and each wait on it runs to its limit"
                : "Never comes: each wait on it runs to its limit"}
            >
              <input
                type="checkbox"
                class={checkboxClass}
                checked={yes}
                onchange={(event) =>
                  controls.setTrigger(
                    robot.file,
                    robot.auto,
                    condition,
                    (event.currentTarget as HTMLInputElement).checked,
                  )}
              />
              {TRIGGER[condition] ?? `${condition} comes`}
            </label>
          {/each}
        </div>
      {/if}
    </div>
  </section>
{/snippet}

{#snippet hivePanel()}
  <section
    class="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-base/60 p-2"
  >
    <header class="text-xs font-semibold text-heading">
      HIVE <span class="font-normal text-body">· shared</span>
    </header>
    {#each HIVE_FACT_LIST as fact (fact.id)}
      {@render slider(
        fact,
        hiveValue(fact),
        controls.hive[fact.id] !== undefined,
        (v) => controls.setHive(fact.id, v),
        { robot: null, id: fact.id },
      )}
    {/each}
    <p class="mt-auto text-[10px] text-body">
      What-ifs for this look only. The team's facts are in Timing → Facts.
    </p>
  </section>
{/snippet}

<div class="flex flex-col gap-2" bind:clientWidth={width}>
  <div class="flex flex-wrap items-center gap-1.5 text-[11px]">
    <span class={labelClass}>What if</span>
    {#each MATCH_PRESETS as preset (preset.id)}
      <button
        type="button"
        class={[
          "rounded-md border px-2 py-0.5 transition",
          controls.preset === preset.id
            ? "border-primary bg-primary/15 text-heading"
            : "border-border text-body hover:text-heading",
        ]}
        title={preset.title}
        onclick={() =>
          controls.apply(
            preset,
            robots.map((r) => r.file),
            base,
          )}>{preset.label}</button
      >
    {/each}
    <button
      type="button"
      class="ml-auto rounded-md border border-warning/60 px-2 py-0.5 text-heading hover:bg-warning/10 disabled:opacity-50"
      disabled={searching}
      title="For every slider, the nearest value up and down where the match comes out differently: TIPs by 30 s, how a wait ends, or the endgame guard parking a robot. Marked on the slider; everything else held where it is."
      onclick={findTicks}
      >{searching
        ? `Searching… ${Object.keys(ticks).length}`
        : searched
          ? "Tipping points ✓"
          : "Find tipping points"}</button
    >
    <button
      type="button"
      class="rounded-md border border-border px-2 py-0.5 text-body hover:text-heading disabled:opacity-40"
      disabled={!controls.changed}
      title="Back to the team's timing.json, every trigger coming and every robot moving"
      onclick={() => controls.reset()}>Team values</button
    >
  </div>
  {#if narrow}
    <div class="flex gap-1 text-[11px]" role="tablist">
      {#each [...first.map( (r) => ({ key: r.file, label: r.name, color: r.color }) ), { key: "hive", label: "HIVE", color: "" }, ...rest.map( (r) => ({ key: r.file, label: r.name, color: r.color }) )] as t (t.key)}
        <button
          type="button"
          role="tab"
          aria-selected={tab === t.key}
          class={[
            "flex min-w-0 items-center gap-1 rounded-md border px-2 py-0.5",
            tab === t.key
              ? "border-primary bg-primary/15 text-heading"
              : "border-border text-body",
          ]}
          onclick={() => (tab = t.key)}
        >
          {#if t.color}<span
              class="inline-block size-2 shrink-0 rounded-full"
              style={`background: ${t.color}`}
            ></span>{/if}
          <span class="truncate">{t.label}</span>
        </button>
      {/each}
    </div>
    {#if tab === "hive" || !robots.some((r) => r.file === tab)}
      {@render hivePanel()}
    {:else}
      {#each robots.filter((r) => r.file === tab) as robot (robot.file)}
        {@render robotPanel(robot)}
      {/each}
    {/if}
  {:else}
    <div class="grid grid-cols-3 gap-2">
      {#each first as robot (robot.file)}
        {@render robotPanel(robot)}
      {/each}
      {@render hivePanel()}
      {#each rest as robot (robot.file)}
        {@render robotPanel(robot)}
      {/each}
    </div>
  {/if}
</div>
