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
  }

  let { robots, controls, base }: Props = $props();

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
)}
  <label
    class="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-2 text-[11px]"
    title={`${fact.label}. Times: ${fact.times}. Team value ${show(fact, base[fact.id])}.`}
  >
    <span
      class={["truncate", changed ? "font-semibold text-heading" : "text-body"]}
    >
      {SHORT[fact.id] ?? fact.label}
    </span>
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

<div class="flex flex-col gap-2">
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
      class="ml-auto rounded-md border border-border px-2 py-0.5 text-body hover:text-heading disabled:opacity-40"
      disabled={!controls.changed}
      title="Back to the team's timing.json, every trigger coming and every robot moving"
      onclick={() => controls.reset()}>Team values</button
    >
  </div>
  <div class="grid gap-2 md:grid-cols-3">
    {#each first as robot (robot.file)}
      {@render robotPanel(robot)}
    {/each}
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
        )}
      {/each}
      <p class="mt-auto text-[10px] text-body">
        What-ifs for this look only. The team's facts are in Timing → Facts.
      </p>
    </section>
    {#each rest as robot (robot.file)}
      {@render robotPanel(robot)}
    {/each}
  </div>
</div>
