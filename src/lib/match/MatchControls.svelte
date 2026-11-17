<script lang="ts">
  /**
   * The Match view's controls: the first Auto's facts on the left, the HIVE's in the middle, the
   * others' on the right, as they sit on the timeline. What-ifs for this look only
   * (controls.svelte.ts): the team's facts are never changed from here.
   *
   * Fork: with two Autos, each robot's sliders go in a side panel (`show` is its index) and only
   * the What-if bar sits above the field (`show="bar"`) and the HIVE's sliders open from its label
   * on the timeline (`show="hive"`); with more, `show="all"`.
   */
  import type { AutoSection } from "../auto/types";
  import {
    choiceLabel,
    routeChoices,
    senseTriggers,
    stops,
    type Stop,
    triggerHint,
    triggerLabel,
    type RouteChoice,
  } from "./whatIfs";
  import { switchKey } from "../auto/simulate";
  import { allCards } from "../auto/tree";
  import {
    TIP_CONDITIONS,
    type TimingFact,
    type TimingValues,
  } from "../timing/model";
  import {
    tipChoiceHint,
    tipChoiceLabel,
    tipToggles,
    type TipToggle,
  } from "./tipToggles";
  import {
    clampFact,
    factStep,
    HIVE_FACT_LIST,
    MATCH_PRESETS,
    ROBOT_FACT_LIST,
    type MatchControls,
  } from "./controls.svelte";
  import { fieldClass } from "../components/ui/styles";
  import type { FieldEntry } from "../timing/together";
  import { knobBreaks, type Knob } from "./breakpoints";
  import { tipping } from "./tipping.svelte";
  import Menu from "../components/ui/Menu.svelte";
  import type { MenuEntry } from "../components/ui/menu";

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
    /** Every panel, the What-if bar and the HIVE only, or one robot's panel by index. */
    show?: "all" | "bar" | "hive" | number;
    /** A robot's panel: its result in words, under its name (lanes.ts robotSummary). */
    summary?: string;
    /** The bar: the match's result in one line (lanes.ts matchResult). */
    result?: string | null;
    /** The bar's More menu: whether the branches not taken are drawn, faint. */
    untaken?: boolean;
    onUntaken?: (on: boolean) => void;
  }

  let {
    robots,
    controls,
    base,
    entries,
    values,
    show: part = "all",
    summary,
    result = null,
    untaken = false,
    onUntaken,
  }: Props = $props();

  /** The bar's More menu: the what-ifs and views a look seldom needs. */
  let moreEntries = $derived<MenuEntry[]>([
    ...MATCH_PRESETS.map((preset) => ({
      label: `${controls.preset === preset.id ? "✓ " : ""}What if: ${preset.label}`,
      run: () =>
        controls.apply(
          preset,
          robots.map((r) => r.file),
          base,
        ),
    })),
    "separator",
    {
      label: tipping.searching
        ? "Finding tipping points…"
        : "Find tipping points",
      disabled: tipping.searching,
      run: findTicks,
    },
    ...(onUntaken
      ? [
          {
            label: `${untaken ? "✓ " : ""}Show branches not taken`,
            run: () => onUntaken(!untaken),
          },
        ]
      : []),
  ]);

  const keyOf = (knob: Knob) => `${knob.robot ?? "hive"}:${knob.id}`;
  /** In a side panel: each slider under its name, so it fits a narrow panel. */
  let stacked = $derived(typeof part === "number");
  /** The panel that runs the search also clears it; a robot's panel only reads it. */
  let searches = $derived(part === "all" || part === "bar");

  // Any change to what is previewed makes the ticks stale.
  $effect(() => {
    void entries;
    void values;
    if (searches) tipping.clear();
  });

  /** Searches every slider, one per tick of the clock, so the page stays live. */
  function findTicks() {
    const run = ++tipping.generation;
    const names = robots.map((r) => r.name);
    const knobs: Knob[] = [
      ...HIVE_FACT_LIST.map((f): Knob => ({ robot: null, id: f.id })),
      ...robots.flatMap((r, robot) =>
        controls.still[r.file]
          ? []
          : robotFacts(r).map((f): Knob => ({ robot, id: f.id })),
      ),
    ];
    const snapshot = { entries, values };
    tipping.ticks = {};
    tipping.searching = true;
    const step = (i: number) => {
      if (run !== tipping.generation) return;
      if (i >= knobs.length) {
        tipping.searching = false;
        tipping.searched = true;
        return;
      }
      try {
        const found = knobBreaks(
          snapshot.entries,
          snapshot.values,
          knobs[i],
          names,
        );
        tipping.ticks = { ...tipping.ticks, [keyOf(knobs[i])]: found };
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
  /** Narrow: one panel at a time, picked by tab (only when every panel is here). */
  let narrow = $derived(part === "all" && width < 720);
  let tab = $state<string>("hive");

  /** Short names for the sliders; FACTS' labels say it in full, in the tooltip. */
  const SHORT: Record<string, string> = {
    driveSpeed: "Drive speed",
    spinUpS: "Spin-up",
    volleyS: "Volley time",
    intakeFullS: "Intake full",
    pickFlowerS: "FLOWER pick",
    gardenGatherS: "GARDEN gather",
    volleyLoad: "Hits per volley",
    tipStartS: "TIP delay",
    tipSwingS: "HIVE swing",
    tipLoad: "Weight to TIP",
    startLoad: "Start weight",
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

  /**
   * Each robot's sensed triggers: one checkbox per condition its waits ask, but not a route
   * choice (a dropdown) or the clock check's always-true trigger (whatIfs.ts).
   */
  function triggers(auto: AutoSection): string[] {
    return senseTriggers(auto);
  }

  /**
   * A robot's sliders: the facts that time something its Auto does. "FLOWER pick" and "GARDEN
   * gather" show only for an Auto with that step, and "Intake full" only for one that waits for the
   * intake to fill, which no Auto on master does. "Hits per volley" is not a slider: the HIVE takes a
   * volley as its 4 POLLEN (mentor, 15 Nov 2026).
   */
  function robotFacts(robot: RobotInfo): TimingFact[] {
    const waits = triggers(robot.auto);
    const steps = new Set(
      allCards(robot.auto.cards).flatMap((c) =>
        c.kind === "action" ? [c.name] : [],
      ),
    );
    return ROBOT_FACT_LIST.filter((fact) => {
      if (fact.id === "volleyLoad") return false;
      if (fact.id === "intakeFullS") return waits.includes("IntakeFull");
      if (fact.id === "pickFlowerS") return steps.has("PickFlower");
      if (fact.id === "gardenGatherS") return steps.has("GardenGather");
      return true;
    });
  }

  /**
   * Each robot's stops, from its Auto and its paths (whatIfs.ts), but not a wait for a CELL or a
   * TIP: with the HIVE modelled, those follow the TIP rows (tipToggles.ts), so they are not asked
   * again wait by wait.
   */
  function stopsOf(robot: RobotInfo): Stop[] {
    return stops(
      robot.auto,
      entries[robots.indexOf(robot)]?.lines ?? [],
    ).filter((stop) => !TIP_CONDITIONS.includes(stop.condition));
  }

  /** The TIPs the robots try for in this look, with what-ifs and all. */
  let tips = $derived.by((): TipToggle[] => {
    try {
      return tipToggles(entries, values);
    } catch (error) {
      console.error("Could not list the TIPs:", error);
      return [];
    }
  });
  /** A TIP's choices: on try 1 … tries, then never. */
  function tipChoices(t: TipToggle): number[] {
    return [...Array.from({ length: t.tries }, (_, i) => i), Infinity];
  }
  /** A try's button: whose volley, what it fires, when it lands ("r-no-cross FLOWER 11 s"). */
  function tryLabel(t: TipToggle, misses: number): string {
    if (misses === Infinity) return "never";
    const at = t.tryList[misses];
    if (!at) return tipChoiceLabel(misses);
    return `${robots[at.robot]?.name ?? `robot ${at.robot + 1}`} ${at.what} ${Math.round(at.t)} s`;
  }

  /** Whether a stop's trigger comes in time in this look: its own answer, else its trigger's. */
  function stopOnTime(robot: RobotInfo, stop: Stop): boolean {
    const scenario = controls.scenario[robot.file] ?? {};
    const own = stop.own ? scenario[switchKey(stop.cardId)] : undefined;
    return own ?? scenario[stop.condition] ?? true;
  }

  function setStop(robot: RobotInfo, stop: Stop, onTime: boolean) {
    if (stop.own) controls.setWait(robot.file, stop.cardId, onTime);
    else controls.setTrigger(robot.file, robot.auto, stop.condition, onTime);
  }

  function comes(robot: RobotInfo, condition: string): boolean {
    return controls.scenario[robot.file]?.[condition] ?? true;
  }

  /** The leg of a route choice previewed: the drawn one (0) unless its trigger is answered no. */
  function legOf(robot: RobotInfo, choice: RouteChoice): 0 | 1 {
    return comes(robot, choice.condition) ? 0 : 1;
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
  {@const found = tipping.ticks[keyOf(knob)]}
  <label
    class={[
      "grid items-center text-[11px]",
      stacked
        ? "grid-cols-[1fr_auto] gap-x-2 gap-y-0.5"
        : "grid-cols-[6.5rem_1fr_3.5rem] gap-2",
    ]}
    title={`${fact.label}. Times: ${fact.times}. Team value ${show(fact, base[fact.id])}.`}
  >
    <span
      class={["truncate", changed ? "font-semibold text-heading" : "text-body"]}
    >
      {SHORT[fact.id] ?? fact.label}
    </span>
    <span class={["relative block", stacked && "col-span-2 row-start-2"]}>
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
        class={[
          "-mt-0.5 truncate text-[10px] text-warning",
          stacked ? "col-span-2" : "col-span-3",
        ]}
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
  <!-- Fork: a robot's result and its timing. What happens to it in the match (no-show, INIT, its
       stops) is asked above the field (robotQuestions), with the TIPs. -->
  {@const still = controls.still[robot.file] ?? false}
  {@const changed = Object.keys(controls.own[robot.file] ?? {}).length}
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
    </header>
    {#if summary}
      <p class="-mt-1 text-[11px] text-body">{summary}</p>
    {/if}
    {#if !still}
      <details class="group text-[11px]" open={changed > 0 || undefined}>
        <summary
          class="cursor-pointer select-none text-body hover:text-heading"
          title="How long this robot takes to spin up, launch, pick and drive, for this look only. The team's values are in Timing → Facts, outside the Match view."
        >
          Robot timing{changed ? ` · ${changed} changed` : ""}
        </summary>
        <div class="mt-1.5 flex flex-col gap-1">
          {#each robotFacts(robot) as fact (fact.id)}
            {@render slider(
              fact,
              robotValue(robot, fact),
              controls.own[robot.file]?.[fact.id] !== undefined,
              (v) => controls.setOwn(robot.file, fact.id, v),
              { robot: robots.indexOf(robot), id: fact.id },
            )}
          {/each}
        </div>
      </details>
    {/if}
  </section>
{/snippet}

{#snippet robotQuestions(robot: RobotInfo)}
  <!-- Fork: what can happen to one robot in the match: it runs or is a no-show, its INIT picks
       (the Driver Station's rows), and its stops other than the TIPs (whatIfs.ts). -->
  {@const still = controls.still[robot.file] ?? false}
  <span
    class="flex min-w-0 items-center gap-1 text-[11px] font-medium whitespace-nowrap text-heading"
  >
    <span
      class="inline-block size-2 shrink-0 rounded-full"
      style={`background: ${robot.color}`}
    ></span>
    {robot.name}
  </span>
  <div class="flex flex-wrap items-center gap-1.5 text-[11px]">
    <div class="flex gap-1" role="radiogroup" aria-label={`${robot.name} runs`}>
      {#each [false, true] as noShow (noShow)}
        {@const on = still === noShow}
        <button
          type="button"
          role="radio"
          aria-checked={on}
          class={[
            "rounded-md border px-2 py-0.5 font-semibold leading-tight transition",
            on && !noShow && "border-primary bg-primary/15 text-heading",
            on && noShow && "border-danger bg-danger/10 text-danger",
            !on && "border-border text-body hover:text-heading",
          ]}
          title={noShow
            ? "The robot stays at its start: a partner that does not run its Auto"
            : "The robot runs its Auto"}
          onclick={() => controls.setStill(robot.file, noShow)}
          >{noShow ? "no-show" : "runs"}</button
        >
      {/each}
    </div>
    {#if !still}
      {#each routeChoices(robot.auto) as choice (choice.condition)}
        {@const leg = legOf(robot, choice)}
        <label
          class={[
            "flex items-center gap-1",
            leg === 1 ? "font-semibold text-heading" : "text-body",
          ]}
          title={`The INIT menu's ${choice.option} row: which way the robot goes. ${choice.legs[0]} is the one drawn.`}
        >
          <span class="shrink-0">INIT</span>
          <select
            class={[fieldClass, "!w-auto min-w-0 !py-0.5 text-[11px]"]}
            aria-label={`INIT ${choice.option}`}
            value={leg}
            onchange={(event) =>
              controls.setTrigger(
                robot.file,
                robot.auto,
                choice.condition,
                (event.currentTarget as HTMLSelectElement).value === "0",
              )}
          >
            <option value={0}>{choiceLabel(choice, 0)}</option>
            <option value={1}>{choiceLabel(choice, 1)}</option>
          </select>
        </label>
      {/each}
      {#each stopsOf(robot) as stop (stop.cardId)}
        {@const onTime = stopOnTime(robot, stop)}
        <span
          class="flex items-center gap-1"
          role="radiogroup"
          aria-label={triggerLabel(stop.condition)}
        >
          <span
            class={onTime ? "text-body" : "font-semibold text-danger"}
            title={`${stop.name} · ${stop.asks}\n${triggerHint(stop.condition, onTime)}${stop.own ? "" : `\nA wait with no steps of its own: this answers every wait on ${triggerLabel(stop.condition)}.`}`}
            >{triggerLabel(stop.condition)}</span
          >
          {#each [true, false] as planned (planned)}
            {@const on = onTime === planned}
            <button
              type="button"
              role="radio"
              aria-checked={on}
              class={[
                "rounded-md border px-1.5 py-0.5 font-semibold leading-tight transition",
                on && planned && "border-primary bg-primary/15 text-heading",
                on && !planned && "border-danger bg-danger/10 text-danger",
                !on && "border-border text-body hover:text-heading",
              ]}
              title={planned
                ? `It comes: ${stop.planned}`
                : `It does not come: ${stop.late}`}
              onclick={() => setStop(robot, stop, planned)}
              >{planned ? "✓" : "✗"}</button
            >
          {/each}
        </span>
      {/each}
    {/if}
  </div>
{/snippet}

{#snippet tipRows()}
  <!-- Fork: the TIPs the robots try for (tipToggles.ts), the HIVE's and not one robot's: for each,
       which volley TIPs it, named by whose it is and when it lands, or never. The field and the
       timeline show what each robot then does. -->
  {#each tips as t (t.tip)}
    <span
      class={[
        "text-[11px] font-medium whitespace-nowrap",
        t.misses === Infinity ? "text-danger" : "text-heading",
      ]}>TIP {t.tip} comes on</span
    >
    <div
      class="flex flex-wrap items-center gap-1 text-[11px]"
      role="radiogroup"
      aria-label={`TIP ${t.tip}`}
    >
      {#each tipChoices(t) as misses (misses)}
        {@const on = t.misses === misses}
        {@const at = t.tryList[misses]}
        <button
          type="button"
          role="radio"
          aria-checked={on}
          class={[
            "flex items-center gap-1 rounded-md border px-2 py-0.5 font-semibold leading-tight transition",
            on &&
              misses !== Infinity &&
              "border-primary bg-primary/15 text-heading",
            on &&
              misses === Infinity &&
              "border-danger bg-danger/10 text-danger",
            !on && "border-border text-body hover:text-heading",
          ]}
          title={tipChoiceHint(t.tip, misses)}
          onclick={() => controls.setTipMisses(t.tip, misses)}
        >
          {#if at && robots[at.robot]}<span
              class="inline-block size-2 shrink-0 rounded-full"
              style={`background: ${robots[at.robot].color}`}
            ></span>{/if}{tryLabel(t, misses)}</button
        >
      {/each}
    </div>
  {/each}
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

{#if typeof part === "number"}
  {#if robots[part]}{@render robotPanel(robots[part])}{/if}
{:else if part === "hive"}
  {@render hivePanel()}
{:else}
  <div class="flex flex-col gap-1.5" bind:clientWidth={width}>
    <!-- Fork: the answer first, then the questions that change it (mentor, 17 Nov 2026: the
         Match view had grown a control for every idea; what is left asks about the match). -->
    <div class="flex items-center gap-2">
      <p
        class="min-w-0 flex-1 text-xs font-semibold text-heading"
        title="TIPs settled by 30 s, how each robot ends, and whether the two robots touch, in this look"
      >
        {#if result}<span
            class="mr-1.5 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-primary uppercase"
            >Result</span
          >{result}{/if}
      </p>
      {#if controls.changed}
        <button
          type="button"
          class="shrink-0 rounded-md border border-border px-2 py-0.5 text-[11px] text-body hover:text-heading"
          title="Back to the team's timing, every TIP on its first try, every INIT choice as drawn and every robot running"
          onclick={() => controls.reset()}>Reset</button
        >
      {/if}
      <Menu label="More" entries={moreEntries} align="end" />
    </div>
    <div class="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1">
      {@render tipRows()}
      {#each robots as robot (robot.file)}
        {@render robotQuestions(robot)}
      {/each}
    </div>
    {#if tipping.searching || tipping.searched}
      <p class="text-[10px] text-warning">
        {tipping.searching
          ? `Finding tipping points… ${Object.keys(tipping.ticks).length}`
          : "Tipping points are marked on each robot's timing sliders."}
      </p>
    {/if}
    {#if part === "bar"}
      <!-- Only the bar: the robots are in the side panels, the HIVE behind its label. -->
    {:else if narrow}
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
{/if}
