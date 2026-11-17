<script lang="ts">
  import { toggleSpotLock } from "../team/spotUnlock";
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
  import type { AtomicPath, CompoundPath } from "../../types";
  import GroupInspector from "../../view/inspector/GroupInspector.svelte";
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
  import {
    addSpot,
    initRow,
    isStartName,
    renameSpot,
    stepForLine,
    stepsOf,
    everyStep,
    type Step,
  } from "./steps";
  import { makeTeamSpot, parkOffers, toggleParkChoice } from "./spotEdits";
  import { saveSpotsOpen, spotEdits, unlockedSpots } from "../team/spotsStore";

  interface Props {
    /** The selected path: a Drive or Park step's, or a spot's park path. */
    line: AtomicPath | null;
    /** The selected path when it is a group of segments (an Auto drawn with one). */
    group?: CompoundPath | null;
    /** The selected card's step, when it is a Drive or Park on a spot. */
    cardStep?: Step | null;
  }

  let { line, group = null, cardStep = null }: Props = $props();

  const project = useProject();
  const auto = useAuto();
  const editor = useEditor();

  let doc = $derived(project.doc);
  /** The step: a park path's drive when that path is selected (P), else the selected card's. */
  let found = $derived.by(() => {
    const byLine = line ? stepForLine(doc, line.id) : null;
    if (byLine?.viaPark) return byLine;
    if (cardStep) return { step: cardStep, viaPark: false };
    return byLine;
  });
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
      ? everyStep(stepsOf(doc)).filter((s) => s.spot === spot && s.lineId)
          .length
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
  // Keyed on the id alone: every edit replaces `line` with a new object of the same id, and an
  // effect that read `line.id` directly reran on each one, closing the path editor mid-typing.
  let lineId = $derived(line?.id ?? group?.id ?? null);
  $effect(() => {
    void lineId;
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

  /** This Auto's own spot, being renamed: the text typed, and why it was refused. */
  let renaming = $state<{ text: string; problem: string | null } | null>(null);
  $effect(() => {
    void spot;
    renaming = null;
  });

  function finishRename() {
    if (!renaming || !spot) return;
    const result = renameSpot(doc, spot, renaming.text);
    if ("problem" in result) {
      renaming.problem = result.problem;
      return;
    }
    project.apply(() => result.doc);
    renaming = null;
  }

  /** A Park step: the other PARK spots the drive team may pick in INIT (types.ts parkChoices). */
  let offers = $derived(
    step?.kind === "park" && !found?.viaPark ? parkOffers(doc, spot) : [],
  );

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
    {#if line}<PathInspector {line} />{:else if group}<GroupInspector
        {group}
      />{/if}
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
            onclick={() =>
              toggleSpotLock(
                spot!,
                unlocked,
                () => project.doc,
                (next) => project.apply(() => next),
              )}
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
      {#if !team && !isStartName(spot) && !found?.viaPark}
        {#if renaming}
          <form
            class="flex items-center gap-1.5"
            onsubmit={(e) => {
              e.preventDefault();
              finishRename();
            }}
          >
            <!-- svelte-ignore a11y_autofocus -->
            <input
              class={[fieldClass, "font-mono text-xs"]}
              aria-label="New name"
              bind:value={renaming.text}
              autofocus
              onkeydown={(e) => e.key === "Escape" && (renaming = null)}
            />
            <Button size="sm" variant="secondary" type="submit">Rename</Button>
          </form>
          {#if renaming.problem}
            <p class="text-xs text-danger">{renaming.problem}</p>
          {/if}
        {:else}
          <div class="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              title="Every step that goes here follows"
              onclick={() => (renaming = { text: spot!, problem: null })}
              >Rename</Button
            >
            <Button
              size="sm"
              variant="secondary"
              title="For every Auto, once you Save team spots"
              onclick={() => {
                const next = makeTeamSpot(project.doc, spot!);
                if (next !== project.doc) project.apply(() => next);
              }}>Make it a team spot</Button
            >
          </div>
        {/if}
      {/if}
    </div>

    {#if offers.length}
      <div class="flex flex-col gap-1.5">
        <span class={labelClass}>Other parks in INIT</span>
        <div class="flex flex-wrap gap-x-3 gap-y-1">
          {#each offers as name (name)}
            <label class="flex items-center gap-1.5 text-xs text-heading">
              <input
                type="checkbox"
                checked={doc.auto?.parkChoices?.includes(name) ?? false}
                onchange={(e) =>
                  project.apply((current) =>
                    toggleParkChoice(current, name, e.currentTarget.checked),
                  )}
              />
              <span class="font-mono">{name}</span>
            </label>
          {/each}
        </div>
        <p class="text-xs text-body">
          If a partner parks where we planned to, the drive team picks another
          with the D-pad's left and right. Driver Station: <span
            class="font-mono text-heading"
            >{initRow("choice", "Park", spot)}</span
          >
        </p>
      </div>
    {/if}

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
{:else if line}
  <PathInspector {line} />
{:else if group}
  <GroupInspector {group} />
{/if}
