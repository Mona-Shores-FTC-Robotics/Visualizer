<script lang="ts">
  /**
   * Fork: the right panel for a simple Auto's selected step that is not a Drive or Park (those
   * have StepSide): everything that sets the step up, so its card in the builder can be one line.
   * A launch's time limit and aim, a wait's trigger, limit, INIT row and name in the match log, a
   * clock check's time, a route choice's names on the INIT menu, and what follows an Otherwise.
   */
  import {
    Clock,
    Flower,
    Flower2,
    Hourglass,
    Rocket,
    Split,
    Sprout,
    Terminal,
    Fan,
  } from "@lucide/svelte";
  import type { Component } from "svelte";
  import { useProject } from "../../state/project.svelte";
  import { fieldClass, labelClass } from "../components/ui/styles";
  import Button from "../components/ui/Button.svelte";
  import { faceCell } from "./spotEdits";
  import {
    ALWAYS,
    DEFAULT_TIMEOUT_S,
    TIME_ONLY,
    WAIT_FOR,
    initRow,
    isStartName,
    newTimeName,
    setChoice,
    setStepTimeout,
    setWait,
    setWaitName,
    setWaitRejoin,
    waitShort,
    type Step,
  } from "./steps";

  interface Props {
    step: Step;
  }

  let { step }: Props = $props();

  const project = useProject();
  let doc = $derived(project.doc);

  function apply(next: typeof doc) {
    if (next !== doc) project.apply(() => next);
  }

  const KIND: Partial<Record<Step["kind"], { word: string; icon: Component }>> =
    {
      launch: { word: "Launch all", icon: Rocket },
      spinup: { word: "Spin up", icon: Fan },
      pick: { word: "Pick flower", icon: Flower2 },
      pickLaunch: { word: "Pick flower and launch", icon: Flower },
      gather: { word: "Garden gather", icon: Sprout },
      command: { word: "Command", icon: Terminal },
      wait: { word: "Wait", icon: Hourglass },
      choice: { word: "Choose in INIT", icon: Split },
    };

  let clockCheck = $derived(step.kind === "wait" && step.waitFor === ALWAYS);
  let kind = $derived(
    clockCheck ? { word: "If before a time", icon: Clock } : KIND[step.kind],
  );
  let limited = $derived(
    ["launch", "pick", "pickLaunch", "gather", "command"].includes(step.kind),
  );
  let hasOtherwise = $derived(
    step.kind === "wait" && step.waitFor !== TIME_ONLY,
  );
  let seconds = (input: HTMLInputElement) => Number(input.value) || 0.1;
</script>

<div class="flex flex-col gap-4 text-sm">
  <div class="flex items-start gap-2">
    {#if kind}<kind.icon class="mt-0.5 size-4 shrink-0 text-primary" />{/if}
    <span class="flex min-w-0 flex-col leading-tight">
      <span class="text-xs text-body">{kind?.word ?? "Step"}</span>
      <span class="text-heading [overflow-wrap:anywhere]"
        >{step.kind === "wait" && step.name
          ? step.name
          : step.kind === "wait" && !clockCheck && step.waitFor !== TIME_ONLY
            ? `Wait for ${waitShort(step.waitFor)}`
            : step.label}</span
      >
    </span>
  </div>

  {#if step.kind === "other"}
    <p class="text-xs text-body">
      Not a builder step: change it under Advanced.
    </p>
  {/if}

  {#if limited}
    <label class="flex flex-col gap-1">
      <span class={labelClass}>At most</span>
      <span class="flex items-center gap-1.5">
        <input
          class={[fieldClass, "!w-20 font-mono"]}
          type="number"
          min="0.1"
          step="0.5"
          aria-label="Time limit, seconds"
          placeholder={String(DEFAULT_TIMEOUT_S)}
          value={step.timeoutS ?? ""}
          onchange={(e) =>
            apply(
              setStepTimeout(
                doc,
                step.cardId,
                e.currentTarget.value === ""
                  ? null
                  : Number(e.currentTarget.value),
              ),
            )}
        />
        <span class="text-xs text-body">s</span>
      </span>
      <span class="text-xs text-body"
        >If it has not finished by then, the robot stops it and goes on. A
        launch that has started feeding always finishes. Empty: {DEFAULT_TIMEOUT_S}
        s.</span
      >
    </label>
  {/if}

  {#if step.kind === "launch" && step.aim}
    {@const aim = step.aim}
    {@const cell = aim.cell === "AUDIENCE" ? "audience" : "scoring"}
    <div class="flex flex-col gap-1.5">
      <span class={labelClass}>Aim</span>
      <p class={["text-xs", aim.on ? "text-body" : "text-danger"]}>
        {#if aim.on}
          At our {cell} CELL, {Math.round(aim.rangeIn)} in away, {Math.abs(
            aim.offDeg,
          ).toFixed(1)}° off, with the turret locked.
        {:else}
          Faces {Math.abs(aim.offDeg).toFixed(0)}° off our {cell} CELL (it needs
          {Math.round(aim.needDeg)}°): with the turret locked, this misses.
          {#if step.atSpot && isStartName(step.atSpot)}
            The start's heading is set by the marks: drive to a launch spot
            first, and aim that.
          {:else if !step.atSpot}
            Drive to a spot first, and aim that.
          {/if}
        {/if}
      </p>
      {#if !aim.on && step.atSpot && !isStartName(step.atSpot)}
        <Button
          size="sm"
          variant="secondary"
          class="self-start"
          onclick={() => apply(faceCell(doc, step.atSpot!, aim.needDeg))}
          >Turn {step.atSpot} to face the CELL</Button
        >
      {/if}
    </div>
  {:else if step.kind === "pick"}
    <p class="text-xs text-body">
      {#if step.flower && !step.problem}
        At the {step.flower.name}, along its line and back{step.squares
          ? ""
          : " to this spot"}.
        {#if step.squares}
          <span class="text-warning"
            >This spot is off the FLOWER's line or not square to it: the robot
            squares up first. Put the spot on its line (click on the line) to
            save that time.</span
          >
        {/if}
      {:else}
        <span class="text-danger"
          >{step.problem}: the robot won't pick here. Drive to a spot on a
          FLOWER's line (click on its line to make one).</span
        >
      {/if}
    </p>
  {:else if step.kind === "gather"}
    <p class="text-xs text-body">
      {#if step.garden}
        Into the {step.garden.name}, intake on, and back to this spot.
      {:else}
        <span class="text-danger"
          >{step.problem}: the robot won't gather from here.</span
        >
      {/if}
    </p>
  {:else if step.kind === "pickLaunch"}
    <p class="text-xs text-body">
      {#if step.flower && !step.problem && step.shot}
        At the {step.flower.name}: the load goes from against it at our
        {step.shot.cell === "AUDIENCE" ? "audience" : "scoring"} CELL,
        {Math.round(step.shot.rangeIn)} in away and
        {Math.round(step.shot.offSquareDeg)}° off square, with the turret turned
        {Math.round(Math.abs(step.shot.turretDeg))}° round, and the FLOWER's
        four follow.
      {:else}
        <span class="text-danger"
          >{step.problem}: the robot won't do this here. Drive to a spot on the
          FAR FLOWER's line.</span
        >
      {/if}
    </p>
    <p class="text-xs text-warning">
      For a robot whose turret aims (20245). Not run on a robot yet: its time is
      an estimate, and whether a fifth piece is ever aboard (G407) is not
      settled.
    </p>
  {:else if step.kind === "wait" && clockCheck}
    <label class="flex flex-col gap-1">
      <span class={labelClass}>Before</span>
      <span class="flex items-center gap-1.5">
        <input
          class={[fieldClass, "!w-20 font-mono"]}
          type="number"
          min="0"
          step="0.5"
          aria-label="Seconds"
          value={step.waitS}
          onchange={(e) =>
            apply(
              setWait(doc, step.cardId, {
                seconds: seconds(e.currentTarget),
              }),
            )}
        />
        <span class="text-xs text-body">s on the match clock</span>
      </span>
      <span class="text-xs text-body"
        >The robot looks at the clock once: before this time it goes on with the
        steps below, at it or later it does the Otherwise. It never waits.</span
      >
    </label>
    <div class="flex flex-col gap-1.5">
      <label class="flex items-center gap-2 text-xs text-heading">
        <input
          type="checkbox"
          checked={!!step.waitOption}
          onchange={(e) =>
            apply(
              setWait(doc, step.cardId, {
                option: e.currentTarget.checked ? newTimeName(doc) : null,
              }),
            )}
        />
        The drive team can change this time in INIT
      </label>
      {#if step.waitOption}
        <label class="flex items-center gap-1.5 text-xs text-body">
          Row name
          <input
            class={[fieldClass, "!w-36 !py-0.5 text-xs"]}
            aria-label="Name on the INIT menu"
            value={step.waitOption}
            onchange={(e) =>
              apply(
                setWait(doc, step.cardId, {
                  option: e.currentTarget.value || step.waitOption,
                }),
              )}
          />
        </label>
        <p class="text-xs text-body">
          Driver Station: <span class="font-mono text-heading"
            >{initRow("time", step.waitOption, step.waitS ?? 0)}</span
          >
        </p>
      {/if}
    </div>
  {:else if step.kind === "wait"}
    <div class="flex flex-col gap-1.5">
      <span class={labelClass}>Waits for</span>
      <select
        class={[fieldClass, "text-xs"]}
        aria-label="Wait for"
        value={step.waitFor}
        onchange={(e) =>
          apply(setWait(doc, step.cardId, { waitFor: e.currentTarget.value }))}
      >
        {#if !WAIT_FOR.some((w) => w.trigger === step.waitFor)}<option
            value={step.waitFor}>{step.waitFor}</option
          >{/if}
        {#each WAIT_FOR.filter((w) => w.trigger !== ALWAYS && (!w.legacy || w.trigger === step.waitFor)) as w (w.trigger)}<option
            value={w.trigger}
            disabled={w.trigger === TIME_ONLY && !!step.otherwise?.length}
            title={w.trigger === TIME_ONLY && step.otherwise?.length
              ? "Remove the Otherwise steps first: a wait for nothing always runs to its time"
              : undefined}>{waitShort(w.trigger)}</option
          >{/each}
      </select>
      {#if step.waitFor === "CellUp"}
        <span class="text-xs text-body"
          >The CELL the robot faces, read up by the camera. At once if it
          already is.</span
        >
      {/if}
    </div>
    <div class="flex flex-col gap-1.5">
      <span class={labelClass}
        >{step.waitFor === TIME_ONLY ? "Waits" : "Gives up"}</span
      >
      <span class="flex flex-wrap items-center gap-1.5">
        <select
          class={[fieldClass, "!w-auto text-xs"]}
          aria-label="Time limit"
          value={step.waitClock ? "clock" : "most"}
          onchange={(e) =>
            apply(
              setWait(doc, step.cardId, {
                matchClock: e.currentTarget.value === "clock",
              }),
            )}
        >
          <option value="most">after</option>
          <option value="clock">at</option>
        </select>
        <input
          class={[fieldClass, "!w-20 font-mono"]}
          type="number"
          min="0.1"
          step="0.5"
          aria-label="Seconds"
          value={step.waitS}
          onchange={(e) =>
            apply(
              setWait(doc, step.cardId, {
                seconds: seconds(e.currentTarget),
              }),
            )}
        />
        <span class="text-xs text-body"
          >{step.waitClock ? "s on the match clock" : "s of waiting here"}</span
        >
      </span>
    </div>
    {#if step.waitClock && step.waitFor !== TIME_ONLY}
      <div class="flex flex-col gap-1.5">
        <label class="flex items-center gap-2 text-xs text-heading">
          <input
            type="checkbox"
            checked={!!step.waitAdjustable}
            onchange={(e) =>
              apply(
                setWait(doc, step.cardId, {
                  adjustable: e.currentTarget.checked,
                }),
              )}
          />
          The drive team can change this time in INIT
        </label>
        {#if step.waitAdjustable}
          <label class="flex items-center gap-1.5 text-xs text-body">
            It waits for
            <select
              class={[fieldClass, "!w-auto !py-0.5 text-xs"]}
              aria-label="Which TIP"
              title="Which TIP of the match this wait is for: the first, second or third time the HIVE tips"
              value={String(step.waitTip ?? "")}
              onchange={(e) =>
                apply(
                  setWait(doc, step.cardId, {
                    tip: Number(e.currentTarget.value),
                  }),
                )}
            >
              {#if !step.waitTip}<option value="">the partner's TIP</option
                >{/if}
              <option value="1">TIP 1</option>
              <option value="2">TIP 2</option>
              <option value="3">TIP 3</option>
            </select>
          </label>
          <p class="text-xs text-body">
            Driver Station: <span class="font-mono text-heading"
              >{initRow("partnerWait", "", step.waitS ?? 0, step.waitTip)}</span
            >. One per Auto.
          </p>
        {/if}
      </div>
    {/if}
    {#if step.spinUp}
      <label
        class="flex items-center gap-2 text-xs text-body"
        title="The launcher spins up while it waits. An Auto that spins up at its start already has it spinning"
      >
        <input
          type="checkbox"
          checked
          onchange={() => apply(setWait(doc, step.cardId, { spinUp: false }))}
        />
        Spins up the launcher while it waits (not needed after a Spin up step)
      </label>
    {/if}
  {:else if step.kind === "choice"}
    <label class="flex flex-col gap-1">
      <span class={labelClass}>Name on the INIT menu</span>
      <input
        class={[fieldClass, "text-xs"]}
        aria-label="Choice name"
        value={step.option}
        onchange={(e) =>
          apply(setChoice(doc, step.cardId, { option: e.currentTarget.value }))}
      />
    </label>
    <div class="flex flex-col gap-1.5">
      <span class={labelClass}>The two ways</span>
      {#each step.legs ?? [] as leg, legIndex (legIndex)}
        <label class="flex items-center gap-1.5 text-xs text-body">
          <span class="w-14 shrink-0">{legIndex === 0 ? "Default" : "Or"}</span>
          <input
            class={[fieldClass, "font-mono text-xs"]}
            aria-label={legIndex === 0
              ? "First leg's name"
              : "Second leg's name"}
            value={leg.name}
            onchange={(e) =>
              apply(
                setChoice(doc, step.cardId, {
                  leg: legIndex as 0 | 1,
                  name: e.currentTarget.value,
                }),
              )}
          />
        </label>
      {/each}
      <p class="text-xs text-body">
        Driver Station: <span class="font-mono text-heading"
          >{initRow(
            "choice",
            step.option ?? "",
            step.legs?.[0]?.name ?? "",
          )}</span
        >; left and right change it.
        {#if step.legs?.some((leg) => leg.steps.some((s) => s.kind === "park"))}
          Each way ends with its own Park, and nothing follows.
        {:else}
          Both ways end on the same spot, and the steps below follow either.
        {/if}
      </p>
    </div>
  {/if}

  {#if step.kind === "wait" && step.waitFor !== TIME_ONLY}
    <label class="flex flex-col gap-1">
      <span class={labelClass}>Name in the match log</span>
      <input
        class={[fieldClass, "text-xs"]}
        aria-label="Name in the match log"
        placeholder={step.label}
        value={step.name ?? ""}
        onchange={(e) =>
          apply(setWaitName(doc, step.cardId, e.currentTarget.value))}
      />
      <span class="text-xs text-body"
        >Also its title in the list. Empty: "{step.label}".</span
      >
    </label>
  {/if}

  {#if hasOtherwise && step.otherwise?.length}
    <label class="flex flex-col gap-1">
      <span class={labelClass}>After the Otherwise</span>
      <select
        class={[fieldClass, "text-xs"]}
        aria-label="After the Otherwise"
        value={step.rejoin === false ? "park" : "goOn"}
        onchange={(e) =>
          apply(
            setWaitRejoin(doc, step.cardId, e.currentTarget.value !== "park"),
          )}
      >
        <option value="goOn">go on with the steps below</option>
        <option value="park"
          >{step.insteadParks ? "park" : "skip the steps below"}</option
        >
      </select>
    </label>
  {/if}
</div>
