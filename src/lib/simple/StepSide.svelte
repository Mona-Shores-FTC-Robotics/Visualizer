<script lang="ts">
  /**
   * Fork: the right panel for a Drive or Park step of a simple Auto (steps.ts isSimple), in place
   * of upstream's path editor: the spot the step goes to (x, y and facing, in Pedro's field frame),
   * its team-spot lock, and the park path from it. "Edit path shape" opens the path editor for
   * control points and heading modes.
   */
  import {
    ArrowLeft,
    Lock,
    LockOpen,
    Navigation,
    SquareParking,
  } from "@lucide/svelte";
  import type { AtomicPath } from "../../types";
  import { FIELD_SIZE } from "../../config";
  import { useProject } from "../../state/project.svelte";
  import { useAuto } from "../../state/auto.svelte";
  import { useEditor } from "../../state/editor.svelte";
  import Button from "../components/ui/Button.svelte";
  import IconButton from "../components/ui/IconButton.svelte";
  import { fieldClass, labelClass } from "../components/ui/styles";
  import PathInspector from "../../view/inspector/PathInspector.svelte";
  import { AUTO_LENGTH_S, guardSeconds } from "../auto/simulate";
  import { spotParks } from "./parkFrom";
  import { addSpot, stepForLine, stepsOf } from "./steps";
  import {
    saveSpotsOpen,
    setSpotUnlocked,
    spotEdits,
    unlockedSpots,
  } from "../team/spotsStore";

  interface Props {
    /** The selected path: a Drive or Park step's, or a spot's park path. */
    line: AtomicPath;
  }

  let { line }: Props = $props();

  const project = useProject();
  const auto = useAuto();
  const editor = useEditor();

  let doc = $derived(project.doc);
  let found = $derived(stepForLine(doc, line.id));
  let step = $derived(found?.step ?? null);
  let spot = $derived(step?.spot ?? null);
  let point = $derived(spot ? (doc.auto?.points[spot] ?? null) : null);
  let team = $derived(!!spot && !!doc.auto?.teamSpots?.includes(spot));
  let unlocked = $derived(!!spot && $unlockedSpots.has(spot));
  let changed = $derived(!!spot && !!$spotEdits[spot]);
  let locked = $derived(team && !unlocked);
  /** How many steps end on this spot: moving it moves them all. */
  let visits = $derived(
    spot
      ? stepsOf(doc)
          .flatMap((s) => [s, ...(s.otherwise ?? [])])
          .filter((s) => s.spot === spot && s.lineId).length
      : 0,
  );
  let park = $derived(
    step ? (spotParks(doc, auto.catalog).get(step.cardId) ?? null) : null,
  );
  let parkTo = $derived(
    park ? (doc.auto?.pathEnds[park.lineId] ?? null) : null,
  );
  let leaveBy = $derived.by(() => {
    const path = park ? auto.catalog?.byId.get(park.lineId) : null;
    return path ? AUTO_LENGTH_S - guardSeconds(path) : null;
  });
  let parkShown = $derived(!!park && auto.focusedPark === park.lineId);

  /** The path editor, for control points and heading modes; back to the step on another path. */
  let shape = $state(false);
  $effect(() => {
    void line.id;
    shape = false;
  });

  const fmt = (s: number) => s.toFixed(1);

  /** Moves or turns the spot; every step that ends there follows. Typing is one undo step. */
  function setPose(axis: 0 | 1 | 2, input: HTMLInputElement) {
    const value = parseFloat(input.value);
    if (!spot || !point || Number.isNaN(value)) return;
    const pose = [point[0], point[1], point[2] ?? 0];
    pose[axis] = axis === 2 ? value : Math.min(FIELD_SIZE, Math.max(0, value));
    const name = spot;
    project.apply(
      (current) => addSpot(current, name, pose[0], pose[1], pose[2]),
      {
        coalesce: `spot.${name}.${axis}`,
      },
    );
  }

  /** Shows the park path on the field, out for editing, as the builder's P does. */
  function toggleParkShown() {
    if (!park) return;
    if (parkShown) {
      auto.focusedPark = null;
      auto.editingPark = false;
      if (found?.viaPark && step?.lineId) editor.select([step.lineId]);
      return;
    }
    auto.focusedPark = park.lineId;
    auto.editingPark = true;
    editor.select([park.lineId]);
  }

  const POSE = [
    { axis: 0, label: "X", unit: "in", step: 0.5 },
    { axis: 1, label: "Y", unit: "in", step: 0.5 },
    { axis: 2, label: "Facing", unit: "°", step: 5 },
  ] as const;
</script>

{#if shape}
  <div class="flex flex-col gap-3">
    <Button
      size="sm"
      variant="ghost"
      class="self-start"
      onclick={() => (shape = false)}
    >
      <ArrowLeft class="size-3.5" /> Step
    </Button>
    <PathInspector {line} />
  </div>
{:else if step && spot && point}
  <div class="flex flex-col gap-3 text-sm">
    <div class="flex items-start gap-2">
      {#if step.kind === "park"}<SquareParking
          class="mt-0.5 size-4 shrink-0 text-primary"
        />{:else}<Navigation class="mt-0.5 size-4 shrink-0 text-primary" />{/if}
      <span class="flex min-w-0 flex-col leading-tight">
        <span class="text-xs text-body"
          >{found?.viaPark
            ? "Park path from"
            : step.kind === "park"
              ? "Park at"
              : "Drive to"}</span
        >
        <span class="font-mono text-heading [overflow-wrap:anywhere]"
          ><!-- Spot names break after an underscore, never mid-word. -->{#each spot.split("_") as part, i (i)}{#if i}_<wbr
              />{/if}{part}{/each}</span
        >
      </span>
    </div>

    <div class="flex flex-col gap-1.5">
      <div class="flex items-center justify-between">
        <span class={labelClass}>Spot</span>
        {#if team}
          <IconButton
            label={unlocked
              ? "Lock this team spot"
              : "Unlock this team spot to move it (every Auto that uses it moves with it once saved)"}
            size="sm"
            active={unlocked}
            class={unlocked ? "text-warning!" : ""}
            onclick={() => setSpotUnlocked(spot!, !unlocked)}
          >
            {#if unlocked}<LockOpen />{:else}<Lock />{/if}
          </IconButton>
        {/if}
      </div>
      <div class="grid grid-cols-3 gap-2">
        {#each POSE as field (field.axis)}
          <label class="flex min-w-0 flex-col gap-1">
            <span class="text-[11px] text-body"
              >{field.label} ({field.unit})</span
            >
            <input
              class={[fieldClass, "font-mono"]}
              type="number"
              min={field.axis === 2 ? undefined : 0}
              max={field.axis === 2 ? undefined : FIELD_SIZE}
              step={field.step}
              aria-label={`Spot ${field.label}`}
              value={field.axis === 2
                ? (point[2] ?? 0)
                : Number(point[field.axis].toFixed(1))}
              disabled={locked}
              onchange={(event) => setPose(field.axis, event.currentTarget)}
            />
          </label>
        {/each}
      </div>
      <p class="text-xs text-body">
        {#if team}
          A team spot, {unlocked
            ? "unlocked: changes here move it for every Auto once saved"
            : "locked. Unlock it to move it"}.{changed
            ? " Changed, not saved."
            : ""}
          {#if changed}
            <button
              type="button"
              class="text-primary underline"
              onclick={() => saveSpotsOpen.set(true)}>Save team spots…</button
            >{/if}
        {:else}
          This Auto's own spot.
        {/if}
        {#if visits > 1}
          {visits} steps go here, and all of them move with it.{/if}
        Pedro's field frame: inches from the corner, degrees counterclockwise.
      </p>
    </div>

    {#if park}
      <div class="flex flex-col gap-1.5">
        <span class={labelClass}>Park path</span>
        <p class="text-xs text-body">
          If the robot runs behind and time runs short here, it parks along this
          path{parkTo ? ` to ${parkTo}` : ""}{leaveBy !== null
            ? `, leaving by ${fmt(leaveBy)} s at the latest`
            : ""}. Planned to leave here at {fmt(park.leaveS)} s.
        </p>
        <div class="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant={parkShown ? "primary" : "secondary"}
            aria-pressed={parkShown}
            onclick={toggleParkShown}
            >{parkShown ? "Hide park path" : "Show park path"}</Button
          >
        </div>
      </div>
    {/if}

    <Button
      size="sm"
      variant="ghost"
      class="self-start"
      title="Control points and heading modes: the path editor"
      onclick={() => (shape = true)}
      >Edit {found?.viaPark ? "park " : ""}path shape →</Button
    >
  </div>
{:else}
  <PathInspector {line} />
{/if}
