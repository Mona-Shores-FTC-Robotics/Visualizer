<script lang="ts">
  // Fork: the simple builder. An Auto as a short list of our robot's steps (lib/simple/steps.ts):
  // pick a start, then add Launch all, Drive to, Pick flower and Park from the palette, by click
  // or by dragging into the list. Everything else the Auto Builder does is under Advanced.
  import {
    Flower2,
    GripVertical,
    Navigation,
    Rocket,
    SquareParking,
    X,
  } from "@lucide/svelte";
  import type { Component } from "svelte";
  import { useProject } from "../../state/project.svelte";
  import { useAuto } from "../../state/auto.svelte";
  import { usePlayback } from "../../state/playback.svelte";
  import { parseSelection, selectedCardId, spotPicker } from "../auto/store";
  import { AUTO_LENGTH_S } from "../auto/simulate";
  import { fieldClass } from "../components/ui/styles";
  import { flowerLinedUp, pickSpot } from "./flowers";
  import {
    addSpot,
    addStep,
    cleanSpotName,
    freeSpotName,
    moveStep,
    removeStep,
    setSpotHeading,
    setStart,
    setStepSpot,
    startSide,
    STARTS,
    START_SPOT,
    stepsOf,
    type StartSide,
    type Step,
    type StepKind,
  } from "./steps";

  interface Props {
    /** Opens Save to GitHub. */
    onSave: () => void;
    onExport: () => void;
  }

  let { onSave, onExport }: Props = $props();

  const project = useProject();
  const auto = useAuto();
  const playback = usePlayback();

  type AddKind = Exclude<StepKind, "other">;
  const PALETTE: {
    kind: AddKind;
    label: string;
    icon: Component;
    hint: string;
  }[] = [
    {
      kind: "launch",
      label: "Launch all",
      icon: Rocket,
      hint: "Shoot everything the robot holds",
    },
    {
      kind: "drive",
      label: "Drive to",
      icon: Navigation,
      hint: "Drive to a spot: pick one, or click the field",
    },
    {
      kind: "pick",
      label: "Pick flower",
      icon: Flower2,
      hint: "The robot's D-pad up pick, straight ahead from here and back to this spot",
    },
    {
      kind: "park",
      label: "Park",
      icon: SquareParking,
      hint: "Drive to the park spot; also where the robot goes if time runs short",
    },
  ];
  const ICONS: Record<StepKind, Component | null> = {
    launch: Rocket,
    drive: Navigation,
    pick: Flower2,
    park: SquareParking,
    other: null,
  };

  let doc = $derived(project.doc);
  let steps = $derived(stepsOf(doc));
  let side = $derived(startSide(doc));
  let spots = $derived(
    Object.keys(doc.auto?.points ?? {}).filter((name) => name !== START_SPOT),
  );
  let selectedId = $derived(parseSelection($selectedCardId).cardId);
  let end = $derived(auto.preview?.endTime ?? 0);
  let worst = $derived(auto.worst?.total ?? end);
  let clock = $derived(
    end > AUTO_LENGTH_S ? "over" : end > AUTO_LENGTH_S - 2 ? "close" : "ok",
  );
  /** The step the preview is running now. */
  let runningId = $derived.by(() => {
    let id: string | null = null;
    for (const entry of auto.preview?.log ?? []) {
      if (entry.t > playback.seconds + 1e-6) break;
      if (entry.cardId) id = entry.cardId;
    }
    return id;
  });

  /**
   * A drive or park waiting for its spot: the list position it goes at, and once the field is
   * clicked, where (it then needs a name).
   */
  let pending = $state<{
    kind: "drive" | "park";
    index: number;
    at: { x: number; y: number } | null;
    name: string;
  } | null>(null);

  /** Where new steps go: after the selected step, else at the end. */
  function insertIndex(): number {
    const at = steps.findIndex((step) => step.cardId === selectedId);
    return at < 0 ? steps.length : at + 1;
  }

  function apply(next: typeof doc) {
    if (next !== doc) project.apply(() => next);
  }

  function chooseStart(choice: StartSide) {
    apply(setStart(doc, choice));
  }

  function add(kind: AddKind, index = insertIndex()) {
    if (kind === "drive" || kind === "park") {
      const parkSpot =
        kind === "park" && spots.includes("PARK") ? "PARK" : null;
      if (parkSpot) return addAt(kind, index, parkSpot);
      startPicking(kind, index);
      return;
    }
    const result = addStep(doc, kind, index);
    apply(result.doc);
    selectedCardId.set(result.cardId);
  }

  function addAt(kind: AddKind, index: number, spot: string) {
    const result = addStep(doc, kind, index, spot);
    apply(result.doc);
    selectedCardId.set(result.cardId);
    stopPicking();
  }

  function startPicking(kind: "drive" | "park", index: number) {
    pending = { kind, index, at: null, name: "" };
    spotPicker.set((at) => {
      if (!pending || !doc.auto) return;
      pending = {
        ...pending,
        at,
        name:
          pending.kind === "park" && !spots.includes("PARK")
            ? "PARK"
            : freeSpotName(doc.auto),
      };
      spotPicker.set(null);
    });
  }

  function stopPicking() {
    pending = null;
    spotPicker.set(null);
  }

  /**
   * Where a new spot goes: a click on a FLOWER's approach line is put on its pick spot, square to
   * it (where the robot's pick starts and ends); any other click stays, facing as the robot is.
   */
  function newSpotPose(at: { x: number; y: number }): {
    x: number;
    y: number;
    h: number;
  } {
    const flower = flowerLinedUp(at.x, at.y);
    if (flower) {
      const spot = pickSpot(flower);
      return { x: spot.x, y: spot.y, h: spot.headingDeg };
    }
    return { ...at, h: headingBefore(pending?.index ?? steps.length) };
  }

  function headingBefore(index: number): number {
    let h = doc.startPoint.headingDeg;
    for (const step of steps.slice(0, index)) {
      const point = step.spot ? doc.auto?.points[step.spot] : null;
      if (point?.[2] !== undefined) h = point[2];
    }
    return h;
  }

  function nameAndAdd() {
    if (!pending?.at || !doc.auto) return;
    const name = cleanSpotName(pending.name) || freeSpotName(doc.auto);
    const { kind, index, at } = pending;
    const pose = newSpotPose(at);
    const withSpot = doc.auto.points[name]
      ? doc
      : addSpot(doc, name, pose.x, pose.y, pose.h);
    const result = addStep(withSpot, kind, index, name);
    apply(result.doc);
    selectedCardId.set(result.cardId);
    stopPicking();
  }

  function select(step: Step) {
    selectedCardId.set(selectedId === step.cardId ? null : step.cardId);
  }

  // --- dragging: palette tiles into the list, and steps within it ---------------------------------

  let dropAt = $state<number | null>(null);

  function dragStart(event: DragEvent, payload: string) {
    event.dataTransfer?.setData("text/x-step", payload);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "copyMove";
  }

  function dragOver(event: DragEvent, index: number) {
    if (!event.dataTransfer?.types.includes("text/x-step")) return;
    event.preventDefault();
    dropAt = index;
  }

  function drop(event: DragEvent, index: number) {
    const payload = event.dataTransfer?.getData("text/x-step") ?? "";
    dropAt = null;
    event.preventDefault();
    if (payload.startsWith("move:"))
      apply(moveStep(doc, payload.slice(5), index));
    else if (payload.startsWith("add:"))
      add(payload.slice(4) as AddKind, index);
  }

  const fmt = (s: number) => s.toFixed(1);
</script>

<div class="simple flex flex-col gap-3 px-1 pb-2 text-sm">
  <div class="flex items-baseline justify-between">
    <span class="font-semibold text-heading">Auto</span>
    <span
      class={[
        "font-mono tabular-nums",
        clock === "over" && "text-danger",
        clock === "close" && "text-warning",
        clock === "ok" && "text-heading",
      ]}
      title={worst > end + 0.05
        ? `Worst case ${fmt(worst)} s`
        : "The preview's time"}
      >{fmt(end)} s <span class="text-body">of {AUTO_LENGTH_S}</span></span
    >
  </div>

  <div class="flex items-center gap-2">
    <button
      type="button"
      class="simple-tile flex-1 justify-center"
      onclick={onSave}>Save to GitHub</button
    >
    <button
      type="button"
      class="text-xs text-body underline"
      onclick={onExport}
      title="Download the Java for the robot">Java</button
    >
    <button
      type="button"
      class="text-xs text-body underline"
      onclick={() => (auto.view = "cards")}
      title="Waits, decisions, rejoins and the plan view">Advanced</button
    >
  </div>

  <div class="grid grid-cols-2 gap-1.5" role="group" aria-label="Start">
    {#each Object.entries(STARTS) as [key, start] (key)}
      <button
        type="button"
        class={["simple-start", side === key && "simple-start--on"]}
        aria-pressed={side === key}
        onclick={() => chooseStart(key as StartSide)}>{start.label}</button
      >
    {/each}
  </div>

  <ol class="flex flex-col gap-1" aria-label="Steps">
    {#each steps as step, index (step.cardId)}
      {@const Icon = ICONS[step.kind]}
      <li
        class={[
          "simple-step",
          selectedId === step.cardId && "simple-step--selected",
          runningId === step.cardId && "simple-step--running",
          dropAt === index && "simple-step--drop",
        ]}
        draggable="true"
        ondragstart={(e) => dragStart(e, `move:${step.cardId}`)}
        ondragover={(e) => dragOver(e, index)}
        ondragleave={() => (dropAt = null)}
        ondrop={(e) => drop(e, index)}
      >
        <div class="flex items-center gap-2">
          <GripVertical class="size-3.5 shrink-0 cursor-grab text-body" />
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-2 text-left"
            onclick={() => select(step)}
          >
            <span class="w-4 shrink-0 text-right font-mono text-xs text-body"
              >{index + 1}</span
            >
            {#if Icon}<Icon class="size-4 shrink-0 text-primary" />{/if}
            <span
              class={[
                "truncate",
                step.kind === "other" ? "text-body" : "text-heading",
              ]}>{step.label}</span
            >
            {#if step.kind === "other"}<span class="text-[10px] text-body"
                >advanced</span
              >{/if}
          </button>
          <button
            type="button"
            class="simple-icon"
            title="Remove this step"
            aria-label={`Remove ${step.label}`}
            onclick={() => apply(removeStep(doc, step.cardId))}
            ><X class="size-3.5" /></button
          >
        </div>

        {#if (step.kind === "drive" || step.kind === "park") && step.spot && doc.auto?.points[step.spot]}
          {@const point = doc.auto.points[step.spot]}
          <div class="mt-1.5 flex items-center gap-2 pl-6 text-xs text-body">
            <select
              class={[fieldClass, "!w-auto !py-0.5 text-xs"]}
              aria-label="Spot"
              value={step.spot}
              onchange={(e) =>
                apply(setStepSpot(doc, step.cardId, e.currentTarget.value))}
            >
              {#each spots as name (name)}<option value={name}>{name}</option
                >{/each}
            </select>
            <label class="flex items-center gap-1">
              facing
              <input
                class={[fieldClass, "!w-16 !py-0.5 text-xs"]}
                type="number"
                step="5"
                value={point[2] ?? 0}
                onchange={(e) =>
                  apply(
                    setSpotHeading(
                      doc,
                      step.spot!,
                      Number(e.currentTarget.value) || 0,
                    ),
                  )}
              />°
            </label>
          </div>
        {:else if step.kind === "pick"}
          <div class="mt-1 pl-6 text-xs">
            {#if step.flower && !step.problem}
              <span class="text-body"
                >at the {step.flower.name}, straight ahead and back to this spot</span
              >
            {:else}
              <span class="text-danger"
                >{step.problem}: the robot won't pick here. Drive to a spot on a
                FLOWER's line (click on its line to make one).</span
              >
            {/if}
          </div>
        {/if}
      </li>
    {/each}

    <li
      class={["simple-end", dropAt === steps.length && "simple-step--drop"]}
      ondragover={(e) => dragOver(e, steps.length)}
      ondragleave={() => (dropAt = null)}
      ondrop={(e) => drop(e, steps.length)}
    >
      {steps.length
        ? "Drop a step here, or click one below"
        : "Add the first step: click one below, or drag it here"}
    </li>
  </ol>

  {#if pending}
    <div class="simple-pending" role="status">
      {#if !pending.at}
        <p class="text-heading">
          {pending.kind === "park" ? "Park" : "Drive to"}:
          <b>click the field</b>
          where the robot should go{spots.length ? ", or pick a spot:" : "."}
        </p>
        {#if spots.length}
          <select
            class={[fieldClass, "mt-1.5 text-xs"]}
            aria-label="Existing spot"
            onchange={(e) =>
              pending &&
              addAt(pending.kind, pending.index, e.currentTarget.value)}
          >
            <option value="">choose a spot…</option>
            {#each spots as name (name)}<option value={name}>{name}</option
              >{/each}
          </select>
        {/if}
      {:else}
        <form
          class="flex items-center gap-1.5"
          onsubmit={(e) => {
            e.preventDefault();
            nameAndAdd();
          }}
        >
          <label class="shrink-0 text-heading" for="simple-spot-name"
            >Name this spot</label
          >
          <!-- svelte-ignore a11y_autofocus -->
          <input
            id="simple-spot-name"
            class={[fieldClass, "text-xs"]}
            bind:value={pending.name}
            autofocus
          />
          <button type="submit" class="simple-tile !min-h-0 !py-1">Add</button>
        </form>
      {/if}
      <button
        type="button"
        class="mt-1.5 text-xs text-body underline"
        onclick={stopPicking}>Cancel</button
      >
    </div>
  {/if}

  <div
    class="sticky bottom-0 grid grid-cols-2 gap-1.5 bg-surface py-1.5"
    aria-label="Add a step"
  >
    {#each PALETTE as tile (tile.kind)}
      <button
        type="button"
        class="simple-tile"
        title={tile.hint}
        draggable="true"
        ondragstart={(e) => dragStart(e, `add:${tile.kind}`)}
        onclick={() => add(tile.kind)}
      >
        <tile.icon class="size-4 text-primary" />
        {tile.label}
      </button>
    {/each}
  </div>
</div>

<style>
  .simple-start {
    border-radius: 0.6rem;
    border: 1px solid var(--border);
    padding: 0.45rem 0.5rem;
    color: var(--heading);
    background: color-mix(in srgb, var(--base) 70%, transparent);
  }
  .simple-start--on {
    border-color: var(--primary);
    color: var(--primary);
    font-weight: 600;
  }
  .simple-step {
    border-radius: 0.6rem;
    border: 1px solid var(--border);
    padding: 0.4rem 0.5rem;
    background: color-mix(in srgb, var(--base) 60%, transparent);
  }
  .simple-step--selected {
    border-color: var(--primary);
  }
  .simple-step--running {
    box-shadow: inset 3px 0 0 var(--primary);
  }
  .simple-step--drop {
    box-shadow: 0 -2px 0 var(--primary);
  }
  .simple-end {
    border-radius: 0.6rem;
    border: 1px dashed var(--border);
    padding: 0.5rem;
    text-align: center;
    font-size: 0.75rem;
    color: var(--body);
  }
  .simple-pending {
    border-radius: 0.6rem;
    border: 1px solid var(--primary);
    padding: 0.5rem 0.6rem;
    font-size: 0.75rem;
  }
  .simple-tile {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 2.25rem;
    border-radius: 0.6rem;
    border: 1px solid var(--border);
    padding: 0.4rem 0.6rem;
    color: var(--heading);
    background: color-mix(in srgb, var(--surface) 80%, transparent);
    cursor: pointer;
  }
  .simple-tile:hover,
  .simple-start:hover {
    border-color: var(--primary);
  }
  .simple-icon {
    display: inline-flex;
    padding: 0.2rem;
    border-radius: 0.4rem;
    color: var(--body);
  }
  .simple-icon:hover {
    color: var(--danger);
  }
</style>
