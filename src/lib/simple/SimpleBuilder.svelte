<script lang="ts">
  // Fork: the simple builder. An Auto as a short list of our robot's steps (lib/simple/steps.ts):
  // pick a start, then add Launch all, Drive to, Pick flower and Park from the palette, by click
  // or by dragging into the list. Everything else the Auto Builder does is under Advanced.
  import {
    Flower2,
    Hourglass,
    Link2,
    Lock,
    LockOpen,
    Pencil,
    Sprout,
    GripVertical,
    Navigation,
    Rocket,
    SquareParking,
    X,
  } from "@lucide/svelte";
  import { untrack, type Component } from "svelte";
  import { useProject } from "../../state/project.svelte";
  import { useAuto } from "../../state/auto.svelte";
  import { usePlayback } from "../../state/playback.svelte";
  import { parseSelection, selectedCardId, spotPicker } from "../auto/store";
  import { AUTO_LENGTH_S, guardSeconds } from "../auto/simulate";
  import { fieldClass } from "../components/ui/styles";
  import { flowerLinedUp, pickSpot } from "./flowers";
  import { spotParks } from "./parkFrom";
  import { stepCollisions, type StepHits } from "./collide";
  import { useEditor } from "../../state/editor.svelte";
  import { linkSpot } from "../team/teamSpots";
  import {
    discardSpotEdits,
    editSpot,
    refreshTeamSpots,
    spotsStatus,
    saveSpotsOpen,
    setSpotUnlocked,
    spotEdits,
    teamSpots,
    unlockedSpots,
  } from "../team/spotsStore";
  import {
    addSpot,
    addStep,
    cleanSpotName,
    freeSpotName,
    moveStep,
    removeStep,
    setSpotHeading,
    setStart,
    isStartName,
    startLabel,
    startName,
    startsFrom,
    setStepSpot,
    setWait,
    renameSpot,
    WAIT_FOR,
    stepsOf,
    type Step,
    type StepKind,
  } from "./steps";

  interface Props {
    /** Downloads the .pp file. */
    onSave: () => void;
    /** Makes a link that opens this Auto. */
    onShare: () => void;
    /** The mentors' Save to GitHub and simulate. */
    onGithub: () => void;
    onExport: () => void;
  }

  let { onSave, onShare, onGithub, onExport }: Props = $props();

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
      kind: "gather",
      label: "Garden gather",
      icon: Sprout,
      hint: "The robot's D-pad down gather: into the nearest GARDEN, intake on, and back to this spot",
    },
    {
      kind: "wait",
      label: "Wait for TIP",
      icon: Hourglass,
      hint: "Wait here until our HIVE tips (or a CELL is up), at most a few seconds",
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
    gather: Sprout,
    wait: Hourglass,
    park: SquareParking,
    other: null,
  };

  let doc = $derived(project.doc);
  let steps = $derived(stepsOf(doc));
  /** Fork: the spots' own park paths (parkFrom.ts), by the drive card that reaches each. */
  let parks = $derived(spotParks(doc, auto.catalog));
  /** Fork: what each drive, and the park from its spot, runs into (collide.ts). */
  let hits = $derived(
    auto.catalog
      ? stepCollisions(doc, auto.catalog)
      : new Map<string, StepHits>(),
  );
  /** Fork: the start buttons, the team's START_ spots (steps.ts startsFrom). */
  let starts = $derived(startsFrom($teamSpots));
  let side = $derived(startName(doc, starts));
  /** Fork: spots linked to the team's list (lib/team/teamSpots.ts). */
  let linkedSpots = $derived(new Set(doc.auto?.teamSpots ?? []));
  /** This Auto's own spots. */
  let ownSpots = $derived(
    Object.keys(doc.auto?.points ?? {})
      .filter((name) => !isStartName(name) && !linkedSpots.has(name))
      .sort(),
  );
  /** The team's spots, and any this Auto links that the list does not have (yet). */
  let teamNames = $derived(
    [...new Set([...Object.keys($teamSpots), ...linkedSpots])]
      .filter((name) => !isStartName(name) && !ownSpots.includes(name))
      .sort(),
  );
  let spots = $derived([...ownSpots, ...teamNames]);
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

  /**
   * Fork: team spots this Auto links that the team's list does not have: made as team spots on a
   * laptop that never saved them. Offered back to the list so they are not lost.
   */
  let missingSpots = $derived(
    $spotsStatus === "ok"
      ? (doc.auto?.teamSpots ?? []).filter(
          (name) => !$teamSpots[name] && doc.auto?.points[name],
        )
      : [],
  );

  function addMissingSpots() {
    for (const name of missingSpots) editSpot(name, doc.auto!.points[name]);
  }

  /** Save to computer, saying first when team spots are only in this browser. */
  function saveFile() {
    const unsaved = [
      ...new Set([...Object.keys($spotEdits), ...missingSpots]),
    ].sort();
    if (
      unsaved.length &&
      !confirm(
        `Team spots ${unsaved.join(", ")} are only in this browser, not in biobuzz. ` +
          "The file keeps their numbers, but nobody else gets them until someone presses " +
          "Save team spots. Save the file anyway?",
      )
    )
      return;
    onSave();
  }

  /**
   * Fork: turns the spot a launch is made from to face our CELL (aim.ts). A team spot changes for
   * every Auto that uses it, once saved.
   */
  function faceCell(spot: string, needDeg: number) {
    const point = doc.auto?.points[spot];
    if (!point) return;
    const h = ((Math.round(needDeg) % 360) + 360) % 360;
    if (linkedSpots.has(spot)) editSpot(spot, [point[0], point[1], h]);
    apply(setSpotHeading(doc, spot, h));
  }

  /** Fork: a spot being renamed, on the step it was started from. */
  let renaming = $state<{
    cardId: string;
    from: string;
    text: string;
    problem: string | null;
  } | null>(null);

  function finishRename() {
    if (!renaming) return;
    const result = renameSpot(doc, renaming.from, renaming.text);
    if ("problem" in result) {
      renaming.problem = result.problem;
      return;
    }
    apply(result.doc);
    renaming = null;
  }

  /** Fork: one of this Auto's own spots becomes a team spot (saved with Save team spots). */
  function makeTeamSpot(name: string) {
    const pose = doc.auto?.points[name];
    if (!pose) return;
    if (
      $teamSpots[name] &&
      !confirm(
        `The team already has a spot ${name}. Move it to where this Auto has it?`,
      )
    )
      return;
    editSpot(name, pose);
    apply(linkSpot(doc, name, pose));
  }

  /** Fork: a spot named from a field click is also saved as a team spot. */
  let asTeamSpot = $state(false);

  /** Where new steps go: after the selected step, else at the end. */
  function insertIndex(): number {
    const at = steps.findIndex((step) => step.cardId === selectedId);
    return at < 0 ? steps.length : at + 1;
  }

  function apply(next: typeof doc) {
    if (next !== doc) project.apply(() => next);
  }

  function chooseStart(name: string) {
    apply(setStart(doc, name, starts[name]));
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

  /** The document with the team spot `name` linked in, if it is one and is not yet. */
  function withTeamSpot(base: typeof doc, name: string): typeof doc {
    const pose = $teamSpots[name];
    return pose && !base.auto?.points[name] ? linkSpot(base, name, pose) : base;
  }

  function addAt(kind: AddKind, index: number, spot: string) {
    const result = addStep(withTeamSpot(doc, spot), kind, index, spot);
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
    let withSpot = withTeamSpot(doc, name);
    if (!withSpot.auto?.points[name]) {
      withSpot = addSpot(withSpot, name, pose.x, pose.y, pose.h);
      // Fork: saved as a team spot, for every Auto (lib/team/teamSpots.ts).
      if (asTeamSpot) {
        const point = withSpot.auto!.points[name];
        editSpot(name, point);
        withSpot = linkSpot(withSpot, name, point);
      }
    }
    const result = addStep(withSpot, kind, index, name);
    apply(result.doc);
    selectedCardId.set(result.cardId);
    stopPicking();
  }

  function select(step: Step) {
    selectedCardId.set(selectedId === step.cardId ? null : step.cardId);
  }

  // --- a spot's park: its P shows it with its control points out; a second press, or Done, puts it back

  const editor = useEditor();
  /** The drive card whose park is shown. */
  /** The drive whose P was pressed; every drive to the same spot shares its park. */
  let focusedCard = $state<string | null>(null);
  /** Whether a step's park is the one shown (its own P, or another visit to the same spot). */
  const parkShown = (cardId: string) =>
    !!auto.focusedPark && parks.get(cardId)?.lineId === auto.focusedPark;

  function togglePark(cardId: string) {
    const park = parks.get(cardId);
    if (!park) return;
    if (focusedCard === cardId) return closePark();
    focusedCard = cardId;
    // Shown and out for editing at once: its control point handles show, and the Path panel edits it.
    auto.focusedPark = park.lineId;
    auto.editingPark = true;
    editor.select([park.lineId]);
  }

  function closePark() {
    focusedCard = null;
    auto.focusedPark = null;
    auto.editingPark = false;
  }

  // Selecting a step, or the park going away (its step removed or moved last), puts it back.
  $effect(() => {
    void selectedId;
    untrack(closePark);
  });
  $effect(() => {
    if (focusedCard && parks.get(focusedCard)?.lineId !== auto.focusedPark)
      untrack(closePark);
  });

  /** The latest the guard sends the robot to park from a spot, along that spot's park. */
  function spotLeaveBy(lineId: string): number | null {
    const path = auto.catalog?.byId.get(lineId);
    return path ? AUTO_LENGTH_S - guardSeconds(path) : null;
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

{#snippet spotOptions()}
  {#if ownSpots.length}
    <optgroup label="This Auto's spots">
      {#each ownSpots as name (name)}<option value={name}>{name}</option>{/each}
    </optgroup>
  {/if}
  {#if teamNames.length}
    <optgroup label="Team spots">
      {#each teamNames as name (name)}<option value={name}>{name}</option
        >{/each}
    </optgroup>
  {/if}
{/snippet}

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
      title="Download this Auto's .pp file, to keep or to give to a mentor"
      onclick={saveFile}>Save to computer</button
    >
    <button
      type="button"
      class="simple-tile flex-1 justify-center"
      title="A link that opens this Auto: paste it in the GitHub issue or send it to a mentor"
      onclick={onShare}>Share link</button
    >
  </div>
  <div class="-mt-2 flex items-center justify-end gap-3">
    <button
      type="button"
      class="text-xs text-body underline"
      onclick={onExport}
      title="Download the Java for the robot (mentors)">Java</button
    >
    <button
      type="button"
      class="text-xs text-body underline"
      onclick={onGithub}
      title="Save to GitHub and simulate (mentors)">GitHub…</button
    >
    <button
      type="button"
      class="text-xs text-body underline"
      onclick={() => (auto.view = "cards")}
      title="Waits, decisions, rejoins and the plan view">Advanced</button
    >
  </div>

  <div class="grid grid-cols-2 gap-1.5" role="group" aria-label="Start">
    {#each Object.keys(starts).sort().reverse() as name (name)}
      <button
        type="button"
        class={["simple-start", side === name && "simple-start--on"]}
        aria-pressed={side === name}
        title={`${name}: a team spot`}
        onclick={() => chooseStart(name)}>{startLabel(name)}</button
      >
    {/each}
  </div>
  {#if side && linkedSpots.has(side)}
    {@const open = $unlockedSpots.has(side)}
    <button
      type="button"
      class={[
        "flex items-center gap-1 self-start text-xs text-body underline",
        open && "!text-warning",
      ]}
      title={open
        ? "Unlocked: the START panel's X, Y and heading, or dragging the start, move this team spot. Then Save team spots"
        : "The start is a team spot, locked. Unlock it to move it (every Auto that starts here moves with it once saved)"}
      onclick={() => setSpotUnlocked(side!, !open)}
    >
      {#if open}<LockOpen class="size-3.5" />
        {startLabel(side)} unlocked: move it, then Save team spots. Lock it again{:else}<Lock
          class="size-3.5"
        /> Unlock
        {startLabel(side)} to move it{/if}
    </button>
  {/if}

  {#if $spotsStatus !== "ok" && $spotsStatus !== "loading"}
    <div class="simple-pending flex items-center gap-1.5" role="alert">
      <p class="flex-1 text-xs text-warning">
        {$spotsStatus} Team spots and starts from biobuzz are missing until it can.
      </p>
      <button
        type="button"
        class="text-xs text-body underline"
        onclick={() => void refreshTeamSpots()}>Try again</button
      >
    </div>
  {/if}
  {#if missingSpots.length}
    <div class="simple-pending flex flex-col gap-1.5" role="status">
      <p class="text-xs text-heading">
        This Auto uses team spots the team's list doesn't have:
        <b class="font-mono">{missingSpots.join(", ")}</b>. They were made on a
        computer that never saved them.
      </p>
      <button
        type="button"
        class="simple-tile justify-center"
        onclick={addMissingSpots}>Add them to the team's spots</button
      >
    </div>
  {/if}
  {#if Object.keys($spotEdits).length}
    <div class="simple-pending flex flex-col gap-1.5" role="status">
      <p class="text-xs text-heading">
        Team spots changed here, not saved:
        <b class="font-mono">{Object.keys($spotEdits).sort().join(", ")}</b>
      </p>
      <div class="flex items-center gap-1.5">
        <button
          type="button"
          class="simple-tile flex-1 justify-center"
          onclick={() => saveSpotsOpen.set(true)}>Save team spots…</button
        >
        <button
          type="button"
          class="text-xs text-body underline"
          onclick={() =>
            confirm("Put the changed team spots back as the team has them?") &&
            discardSpotEdits()}>Undo changes</button
        >
      </div>
    </div>
  {/if}
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
          {#if parks.has(step.cardId)}
            <button
              type="button"
              class={[
                "simple-park",
                parkShown(step.cardId) && "simple-park--on",
              ]}
              title="Where the robot parks from this spot if time runs short. Show and edit its park path"
              aria-label={`Park path from ${step.spot ?? "this spot"}`}
              aria-pressed={parkShown(step.cardId)}
              onclick={() => togglePark(step.cardId)}>P</button
            >
          {/if}
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
            {#if renaming?.cardId === step.cardId}
              <form
                class="flex items-center gap-1"
                onsubmit={(e) => {
                  e.preventDefault();
                  finishRename();
                }}
              >
                <!-- svelte-ignore a11y_autofocus -->
                <input
                  class={[fieldClass, "!w-32 !py-0.5 font-mono text-xs"]}
                  aria-label="New name"
                  bind:value={renaming.text}
                  autofocus
                  onkeydown={(e) => e.key === "Escape" && (renaming = null)}
                />
                <button type="submit" class="simple-tile !min-h-0 !py-0.5"
                  >Rename</button
                >
              </form>
            {:else}
              <select
                class={[fieldClass, "!w-auto !py-0.5 text-xs"]}
                aria-label="Spot"
                value={step.spot}
                onchange={(e) => {
                  const name = e.currentTarget.value;
                  apply(
                    setStepSpot(withTeamSpot(doc, name), step.cardId, name),
                  );
                }}
              >
                {@render spotOptions()}
              </select>
            {/if}
            {#if !linkedSpots.has(step.spot) && !isStartName(step.spot) && renaming?.cardId !== step.cardId}
              <button
                type="button"
                class="simple-icon"
                title={`Rename ${step.spot} (every step that goes there follows)`}
                aria-label={`Rename ${step.spot}`}
                onclick={() =>
                  (renaming = {
                    cardId: step.cardId,
                    from: step.spot!,
                    text: step.spot!,
                    problem: null,
                  })}><Pencil class="size-3.5" /></button
              >
              <button
                type="button"
                class="simple-icon"
                title={`Make ${step.spot} a team spot, for every Auto (then Save team spots)`}
                aria-label={`Make ${step.spot} a team spot`}
                onclick={() => makeTeamSpot(step.spot!)}
                ><Link2 class="size-3.5" /></button
              >
            {/if}
            {#if linkedSpots.has(step.spot)}
              {@const open = $unlockedSpots.has(step.spot)}
              <button
                type="button"
                class={["simple-icon", open && "!text-warning"]}
                title={open
                  ? "Unlocked: dragging its end on the field moves this team spot. Lock it again"
                  : "A team spot, locked. Unlock it to move it (every Auto that uses it moves with it once saved)"}
                aria-label={open ? "Lock team spot" : "Unlock team spot"}
                onclick={() => setSpotUnlocked(step.spot!, !open)}
              >
                {#if open}<LockOpen class="size-3.5" />{:else}<Lock
                    class="size-3.5"
                  />{/if}
              </button>
            {/if}
            <label class="flex items-center gap-1">
              facing
              <input
                class={[fieldClass, "!w-16 !py-0.5 text-xs"]}
                type="number"
                step="5"
                value={point[2] ?? 0}
                disabled={linkedSpots.has(step.spot) &&
                  !$unlockedSpots.has(step.spot)}
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
          {#if renaming?.cardId === step.cardId && renaming.problem}
            <p class="mt-1 pl-6 text-xs text-danger">{renaming.problem}</p>
          {/if}
          {#if focusedCard === step.cardId}
            {@const park = parks.get(step.cardId)!}
            {@const by = spotLeaveBy(park.lineId)}
            {@const visits = [...parks.values()].filter(
              (p) => p.lineId === park.lineId,
            ).length}
            <div class="mt-1.5 flex items-center gap-2 pl-6 text-xs text-body">
              <span class="flex-1"
                >Planned to leave here at {fmt(park.leaveS)} s. If the robot runs
                behind and time runs short here, it parks along this path{by !==
                null
                  ? `, leaving by ${fmt(by)} s at the latest`
                  : ""}.{visits > 1
                  ? ` All ${visits} drives to ${step.spot} share this park.`
                  : ""} To bend it, add a control point in the Path panel and drag
                it on the field.</span
              >
              <button type="button" class="simple-tile" onclick={closePark}
                >Done</button
              >
            </div>
          {/if}
          {#if step.problem}
            <p class="mt-1 pl-6 text-xs text-danger">{step.problem}.</p>
          {/if}
          {#if hits.get(step.cardId)}
            {@const hit = hits.get(step.cardId)!}
            {#if hit.drive.length}
              <p class="mt-1 pl-6 text-xs text-danger">
                The drive here touches {hit.drive.join(" and ")} (within the robot's
                {doc.robot.safetyMargin} in safety margin). Move the spot, or bend
                the path with a control point.
              </p>
            {/if}
            {#if hit.park.length}
              <p class="mt-1 pl-6 text-xs text-warning">
                Its park path (P) touches {hit.park.join(" and ")}: press P and
                bend it.
              </p>
            {/if}
          {/if}
        {:else if step.kind === "launch" && step.aim}
          {@const aim = step.aim}
          {@const cell = aim.cell === "AUDIENCE" ? "audience" : "scoring"}
          <div class="mt-1 flex items-center gap-2 pl-6 text-xs">
            <span class={["flex-1", aim.on ? "text-body" : "text-danger"]}>
              {#if aim.on}
                At our {cell} CELL, {Math.round(aim.rangeIn)} in away, {Math.abs(
                  aim.offDeg,
                ).toFixed(1)}° off: on, with the turret locked.
              {:else}
                Faces {Math.abs(aim.offDeg).toFixed(0)}° off our {cell} CELL (it needs
                {Math.round(aim.needDeg)}°): with the turret locked, this
                misses.
              {/if}
            </span>
            {#if !aim.on && step.atSpot && !isStartName(step.atSpot)}
              <button
                type="button"
                class="simple-tile !min-h-0 !py-0.5"
                title={`Turn ${step.atSpot} to face the CELL (${Math.round(aim.needDeg)}°)`}
                onclick={() => faceCell(step.atSpot!, aim.needDeg)}
                >Face the CELL</button
              >
            {/if}
          </div>
          {#if !aim.on && (!step.atSpot || isStartName(step.atSpot))}
            <p class="mt-1 pl-6 text-xs text-body">
              {step.atSpot && isStartName(step.atSpot)
                ? "The start's heading is set by the marks: drive to a launch spot first, and aim that."
                : "Drive to a spot first, and aim that."}
            </p>
          {/if}
        {:else if step.kind === "wait"}
          <div class="mt-1.5 flex items-center gap-2 pl-6 text-xs text-body">
            <select
              class={[fieldClass, "!w-auto !py-0.5 text-xs"]}
              aria-label="Wait for"
              value={step.waitFor}
              onchange={(e) =>
                apply(
                  setWait(doc, step.cardId, {
                    waitFor: e.currentTarget.value,
                  }),
                )}
            >
              {#each WAIT_FOR as w (w.trigger)}<option value={w.trigger}
                  >{w.label}</option
                >{/each}
            </select>
            <label class="flex items-center gap-1">
              at most
              <input
                class={[fieldClass, "!w-16 !py-0.5 text-xs"]}
                type="number"
                min="0.1"
                step="0.5"
                value={step.waitS}
                onchange={(e) =>
                  apply(
                    setWait(doc, step.cardId, {
                      seconds: Number(e.currentTarget.value) || 0.1,
                    }),
                  )}
              />s
            </label>
          </div>
        {:else if step.kind === "gather"}
          <div class="mt-1 pl-6 text-xs">
            {#if step.garden}
              <span class="text-body"
                >into the {step.garden.name} and back to this spot</span
              >
            {:else}
              <span class="text-danger"
                >{step.problem}: the robot won't gather from here.</span
              >
            {/if}
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

    {#if steps.length && !steps.some((step) => step.kind === "park")}
      <li class="px-1 text-xs text-warning">
        No Park step: add one, so the robot parks by 30 s even when a step runs
        long.
      </li>
    {/if}
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
            {@render spotOptions()}
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
        <label class="mt-1 flex items-center gap-1.5 text-xs text-body">
          <input type="checkbox" bind:checked={asTeamSpot} />
          Also a team spot, for every Auto
        </label>
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
  .simple-park {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 0.35rem;
    border: 1px solid #ff8a3d;
    color: #ff8a3d;
    font-size: 0.7rem;
    font-weight: 700;
  }
  .simple-park--on {
    background: #ff8a3d;
    color: var(--base);
  }
</style>
