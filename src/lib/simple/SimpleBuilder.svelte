<script lang="ts">
  import { toggleSpotLock } from "../team/spotUnlock";
  // Fork: the simple builder. An Auto as a short list of our robot's steps (lib/simple/steps.ts):
  // pick a start, then add Launch all, Drive to, Pick flower and Park from the palette, by click
  // or by dragging into the list. Everything else the Auto Builder does is under Advanced.
  import {
    ChevronRight,
    Clock,
    Flower,
    Flower2,
    Hourglass,
    Lock,
    LockOpen,
    Sprout,
    Terminal,
    GripVertical,
    Navigation,
    Fan,
    Rocket,
    Split,
    SquareParking,
    X,
  } from "@lucide/svelte";
  import { untrack, type Component } from "svelte";
  import { useProject } from "../../state/project.svelte";
  import { currentFilePath } from "../../stores";
  import { useAuto } from "../../state/auto.svelte";
  import { usePlayback } from "../../state/playback.svelte";
  import {
    parseSelection,
    previewScenario,
    selectedCardId,
    spotPicker,
  } from "../auto/store";
  import { AUTO_LENGTH_S, switchKey } from "../auto/simulate";
  import { fieldClass } from "../components/ui/styles";
  import { flowerLinedUp, pickSpot } from "./flowers";
  import { spotParks } from "./parkFrom";
  import { stepCollisions, type StepHits } from "./collide";
  import { useEditor } from "../../state/editor.svelte";
  import { linkSpot, sortSpotEdits } from "../team/teamSpots";
  import { faceCell, withTeamSpot } from "./spotEdits";
  import {
    dropSpotEdits,
    editSpot,
    refreshTeamSpots,
    spotsStatus,
    saveSpotsOpen,
    savedSpots,
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
    pruneUnusedPaths,
    removeStep,
    setStart,
    isStartName,
    startLabel,
    startName,
    startsFrom,
    setStepSpot,
    DEFAULT_TIMEOUT_S,
    everyStep,
    initRow,
    ALWAYS,
    LEG_KINDS,
    sideSpot,
    waitShort,
    TIME_ONLY,
    stepsOf,
    type Step,
    type StepKind,
    type StepList,
  } from "./steps";

  const project = useProject();
  const auto = useAuto();
  const playback = usePlayback();

  type AddKind = Exclude<StepKind, "other" | "command">;
  const PALETTE: {
    kind: AddKind;
    label: string;
    /** The palette chip's word; `label` is the full name in menus. */
    short: string;
    icon: Component;
    hint: string;
  }[] = [
    {
      kind: "launch",
      short: "Launch",
      label: "Launch all",
      icon: Rocket,
      hint: "Shoot everything the robot holds",
    },
    {
      kind: "spinup",
      short: "Spin up",
      label: "Spin up",
      icon: Fan,
      hint: "Start the launcher's wheels now; they keep spinning, so a later Launch all fires at once",
    },
    {
      kind: "drive",
      short: "Drive",
      label: "Drive to",
      icon: Navigation,
      hint: "Drive to a spot: pick one, or click the field",
    },
    {
      kind: "pick",
      short: "Pick",
      label: "Pick flower",
      icon: Flower2,
      hint: "The robot's D-pad up pick: squares up on the nearest FLOWER's line if it needs to, pushes in and backs out",
    },
    {
      kind: "pickLaunch",
      short: "Pick+launch",
      label: "Pick flower and launch",
      icon: Flower,
      hint: "At the FAR FLOWER, with a load aboard and a turret that aims: fires the load from against the FLOWER while it picks, eight in a row. Never run on a robot yet",
    },
    {
      kind: "gather",
      short: "Gather",
      label: "Garden gather",
      icon: Sprout,
      hint: "The robot's D-pad down gather: into the nearest GARDEN, intake on, and back to this spot",
    },
    {
      kind: "wait",
      short: "Wait",
      label: "Wait for TIP or CELL up",
      icon: Hourglass,
      hint: "Wait here until the CELL in front of the robot is up (at once if it already is), at most a few seconds",
    },
    {
      kind: "check",
      short: "If before",
      label: "If before a time",
      icon: Clock,
      hint: "Look at the match clock once: before the time the robot goes on with the steps below, otherwise it does the Otherwise. It never waits",
    },
    {
      kind: "choice",
      short: "Choose",
      label: "Choose in INIT",
      icon: Split,
      hint: "Two ways to do the next part (WALL FLOWER or GARDEN, say): the drive team picks one in INIT, and both go on with the steps below",
    },
    {
      kind: "park",
      short: "Park",
      label: "Park",
      icon: SquareParking,
      hint: "Drive to the park spot; also where the robot goes if time runs short",
    },
  ];
  const ICONS: Record<StepKind, Component | null> = {
    launch: Rocket,
    spinup: Fan,
    drive: Navigation,
    pick: Flower2,
    pickLaunch: Flower,
    gather: Sprout,
    command: Terminal,
    wait: Hourglass,
    check: Clock,
    choice: Split,
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
  /** Fork: the start buttons, the team's _START spots (steps.ts startsFrom). */
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
  /** Fork: the team-spot changes in this browser, this Auto's apart from the rest. */
  let pendingSpots = $derived(
    sortSpotEdits(
      $spotEdits,
      linkedSpots,
      $spotsStatus === "ok" ? $savedSpots : null,
    ),
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
    /** The list it goes in: the main one, or a wait's Otherwise. */
    into: StepList;
    at: { x: number; y: number } | null;
    name: string;
  } | null>(null);

  /** A list's key for drag-and-drop: the main list, or the wait whose Otherwise it is. */
  const listKey = (into: StepList) =>
    into
      ? `${into.waitCardId}${into.leg === undefined ? "" : `/${into.leg}`}`
      : "";

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

  /** A team spot's lock: unlocking one other Autos use asks whether to move it for all (spotUnlock.ts). */
  function lockSpot(name: string, unlocked: boolean) {
    void toggleSpotLock(name, unlocked, () => project.doc, apply);
  }

  function chooseStart(name: string) {
    apply(setStart(doc, name, starts[name]));
  }

  /** Whether the preview draws a wait's "it came" branch (true) or its Otherwise (false). */
  function previewsTip(cardId: string): boolean {
    return $previewScenario[switchKey(cardId)] ?? true;
  }

  /** Draws one branch of a wait: the steps below it as if the trigger came, or its Otherwise. */
  function previewTip(cardId: string, yes: boolean) {
    previewScenario.update((scenario) => ({
      ...scenario,
      [switchKey(cardId)]: yes,
    }));
  }

  function add(kind: AddKind, index = insertIndex(), into: StepList = null) {
    // A leg holds drives and commands only, and a choice stays in the main list (steps.ts).
    if (into?.leg !== undefined && !LEG_KINDS.includes(kind)) {
      const owner = everyStep(steps).find((s) => s.cardId === into.waitCardId);
      if (kind !== "park" || !owner?.legsMayPark) return;
    }
    if (kind === "choice" && into) return;
    // Building an Otherwise, or a leg of a choice: show it, so the step just added is drawn.
    if (into) previewTip(into.waitCardId, into.leg === 0);
    if (kind === "drive" || kind === "park") {
      // The team's park for this side (RIGHT_START → RIGHT_PARK), else an older file's PARK.
      const teamPark = sideSpot(side, "PARK");
      const parkSpot =
        kind !== "park"
          ? null
          : teamPark && $teamSpots[teamPark]
            ? teamPark
            : spots.includes("PARK")
              ? "PARK"
              : null;
      if (parkSpot) return addAt(kind, index, parkSpot, into);
      startPicking(kind, index, into);
      return;
    }
    const result = addStep(doc, kind, index, undefined, into);
    apply(result.doc);
    selectedCardId.set(result.cardId);
  }

  function addAt(
    kind: AddKind,
    index: number,
    spot: string,
    into: StepList = null,
  ) {
    const result = addStep(withTeamSpot(doc, spot), kind, index, spot, into);
    apply(result.doc);
    selectedCardId.set(result.cardId);
    stopPicking();
  }

  function startPicking(
    kind: "drive" | "park",
    index: number,
    into: StepList = null,
  ) {
    pending = { kind, index, into, at: null, name: "" };
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
    const { kind, index, into, at } = pending;
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
    const result = addStep(withSpot, kind, index, name, into);
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
    // Shown and out for editing at once: its control point handles show, and the Step panel edits it.
    auto.focusedPark = park.lineId;
    auto.editingPark = true;
    editor.select([park.lineId]);
  }

  function closePark() {
    focusedCard = null;
    auto.focusedPark = null;
    auto.editingPark = false;
  }

  // A file opened here drops the paths no step drives (steps.ts pruneUnusedPaths): an older
  // version's leftovers would draw as stray dashed lines. Once per file, as an undoable edit.
  $effect(() => {
    void $currentFilePath;
    untrack(() => {
      const pruned = pruneUnusedPaths(doc);
      if (pruned !== doc) project.apply(() => pruned);
    });
  });

  // Selecting a step, or the park going away (its step removed or moved last), puts it back.
  $effect(() => {
    void selectedId;
    untrack(closePark);
  });
  $effect(() => {
    if (focusedCard && parks.get(focusedCard)?.lineId !== auto.focusedPark)
      untrack(closePark);
  });

  // --- dragging: palette tiles into the list, and steps within it ---------------------------------

  /** Where a dragged step would land: which list (listKey) and the index in it. */
  let dropAt = $state<{ list: string; index: number } | null>(null);
  const dropping = (into: StepList, index: number) =>
    dropAt?.list === listKey(into) && dropAt.index === index;

  function dragStart(event: DragEvent, payload: string) {
    event.dataTransfer?.setData("text/x-step", payload);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "copyMove";
  }

  function dragOver(event: DragEvent, index: number, into: StepList = null) {
    if (!event.dataTransfer?.types.includes("text/x-step")) return;
    event.preventDefault();
    event.stopPropagation();
    dropAt = { list: listKey(into), index };
  }

  function drop(event: DragEvent, index: number, into: StepList = null) {
    const payload = event.dataTransfer?.getData("text/x-step") ?? "";
    dropAt = null;
    event.preventDefault();
    event.stopPropagation();
    if (payload.startsWith("move:"))
      apply(moveStep(doc, payload.slice(5), index, into));
    else if (payload.startsWith("add:"))
      add(payload.slice(4) as AddKind, index, into);
  }

  const fmt = (s: number) => s.toFixed(1);

  /** A step's title on its card. A drive's spot is in its dropdown, so the title doesn't say it. */
  function cardTitle(step: Step): string {
    switch (step.kind) {
      case "drive":
      case "park":
        return step.spot && doc.auto?.points[step.spot]
          ? step.kind === "park"
            ? "Park at"
            : "Drive to"
          : step.label;
      case "wait":
        if (step.waitFor === TIME_ONLY) return step.label;
        if (step.name) return step.name;
        return step.waitFor === ALWAYS
          ? `If before ${step.waitS} s`
          : `Wait for ${waitShort(step.waitFor)}`;
      case "choice":
        return step.option || step.label;
      case "pick":
        return step.flower ? `Pick ${step.flower.name}` : step.label;
      case "pickLaunch":
        return step.flower
          ? `Pick and launch at ${step.flower.name}`
          : step.label;
      case "gather":
        return step.garden ? `Gather in ${step.garden.name}` : step.label;
      default:
        return step.label;
    }
  }

  /** A step in one line, for a folded Otherwise: "Park at LEFT_PARK". */
  const oneLine = (step: Step) =>
    (step.kind === "drive" || step.kind === "park") && step.spot
      ? `${step.kind === "park" ? "Park at" : "Drive to"} ${step.spot}`
      : cardTitle(step);

  type Tag = { text: string; title: string; tone?: "init" | "warn" };
  /** The few facts a card shows at the right of its line: its limit, and whether INIT sets it. */
  function tagsOf(step: Step): Tag[] {
    const tags: Tag[] = [];
    const limit = (s: number) =>
      tags.push({
        text: `≤ ${s} s`,
        title: "At most this long: the robot then stops it and goes on",
      });
    switch (step.kind) {
      case "launch":
      case "command":
        limit(step.timeoutS ?? DEFAULT_TIMEOUT_S);
        break;
      case "pick":
      case "gather":
        if (step.timeoutS !== undefined) limit(step.timeoutS);
        break;
      case "pickLaunch":
        if (step.timeoutS !== undefined) limit(step.timeoutS);
        tags.push({
          text: "untried",
          tone: "warn",
          title:
            "For a robot whose turret aims (20245). Never run on a robot: its time is an estimate",
        });
        break;
      case "wait":
        if (step.waitFor === TIME_ONLY) break;
        if (step.waitFor === ALWAYS) {
          if (step.name)
            tags.push({
              text: `before ${step.waitS} s`,
              title: "A look at the match clock: it never waits",
            });
          if (step.waitOption)
            tags.push({
              text: "INIT",
              tone: "init",
              title: `Driver Station: ${initRow("time", step.waitOption, step.waitS ?? 0)}`,
            });
          break;
        }
        tags.push(
          step.waitClock
            ? {
                text: `until ${step.waitS} s`,
                title: `Gives up at ${step.waitS} s on the match clock`,
              }
            : {
                text: `≤ ${step.waitS} s`,
                title: `Gives up ${step.waitS} s after it starts waiting`,
              },
        );
        if (step.waitAdjustable)
          tags.push({
            text: "INIT",
            tone: "init",
            title: `Driver Station: ${initRow("partnerWait", "", step.waitS ?? 0, step.waitTip)}`,
          });
        break;
      case "choice":
        tags.push({
          text: "INIT",
          tone: "init",
          title: `Driver Station: ${initRow("choice", step.option ?? "", step.legs?.[0]?.name ?? "")}`,
        });
        break;
      case "park": {
        const others = doc.auto?.parkChoices ?? [];
        if (others.length)
          tags.push({
            text: "INIT",
            tone: "init",
            title: `The drive team may pick ${others.join(" or ")} instead, in INIT`,
          });
        break;
      }
    }
    return tags;
  }

  /** The card's longer description, on hover. */
  function hover(step: Step): string | undefined {
    if (step.kind === "launch" && step.aim?.on)
      return `At our ${step.aim.cell === "AUDIENCE" ? "audience" : "scoring"} CELL, ${Math.round(step.aim.rangeIn)} in away, ${Math.abs(step.aim.offDeg).toFixed(1)}° off`;
    if (step.kind === "wait" && step.name) return step.label;
    if (step.kind === "choice") return step.label;
    return undefined;
  }

  /** The heading of a wait's Otherwise: "If no CELL up by 23 s". */
  function otherwiseHead(step: Step): string {
    if (step.waitFor === ALWAYS) return `At ${step.waitS} s or later`;
    return `If no ${waitShort(step.waitFor)} ${step.waitClock ? "by" : "within"} ${step.waitS} s`;
  }
</script>

<!-- Fork: a step is one line: what it does, its spot, and a tag or two (its time limit, INIT).
     Everything that sets it up is in the Step panel on the right (StepPanel, StepSide). Only
     what needs fixing shows under it. -->
{#snippet stepItem(step: Step, index: number, into: StepList)}
  {@const Icon =
    step.kind === "wait" && step.waitFor === ALWAYS ? Clock : ICONS[step.kind]}
  {@const spotStep =
    (step.kind === "drive" || step.kind === "park") &&
    !!step.spot &&
    !!doc.auto?.points[step.spot]}
  <li
    class={[
      "simple-step",
      selectedId === step.cardId && "simple-step--selected",
      runningId === step.cardId && "simple-step--running",
      dropping(into, index) && "simple-step--drop",
    ]}
    draggable="true"
    ondragstart={(e) => dragStart(e, `move:${step.cardId}`)}
    ondragover={(e) => dragOver(e, index, into)}
    ondragleave={() => (dropAt = null)}
    ondrop={(e) => drop(e, index, into)}
  >
    <div class="flex items-center gap-1.5">
      <GripVertical class="size-3.5 shrink-0 cursor-grab text-body" />
      <!-- The title and a drive's spot: the spot drops under the title when the line is short. -->
      <div
        class="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5"
      >
        <button
          type="button"
          class={[
            "flex min-w-0 items-center gap-2 text-left",
            !spotStep && "flex-1",
          ]}
          title={hover(step)}
          onclick={() => select(step)}
        >
          <span class="w-4 shrink-0 text-right font-mono text-xs text-body"
            >{index + 1}</span
          >
          {#if Icon}<Icon class="size-4 shrink-0 text-primary" />{/if}
          <span
            class={[
              "min-w-0 [overflow-wrap:anywhere]",
              step.kind === "other" ? "text-body" : "text-heading",
            ]}
            ><!-- Spot names break after an underscore, never mid-word. -->{#each cardTitle(step).split("_") as part, i (i)}{#if i}_<wbr
                />{/if}{part}{/each}</span
          >
        </button>
        {#if spotStep}
          <select
            class="simple-spot"
            aria-label="Spot"
            value={step.spot}
            onchange={(e) => {
              const name = e.currentTarget.value;
              apply(setStepSpot(withTeamSpot(doc, name), step.cardId, name));
            }}
          >
            {@render spotOptions()}
          </select>
          {#if $unlockedSpots.has(step.spot!)}
            <span
              class="text-warning"
              title="Unlocked: dragging its end on the field moves this team spot for every Auto, once saved. Lock it again in the Step panel"
              ><LockOpen class="size-3.5" /></span
            >
          {/if}
        {/if}
      </div>
      {#each tagsOf(step) as tag (tag.text)}
        <span
          class={["simple-tag", tag.tone && `simple-tag--${tag.tone}`]}
          title={tag.title}>{tag.text}</span
        >
      {/each}
      {#if parks.has(step.cardId)}
        <button
          type="button"
          class={["simple-park", parkShown(step.cardId) && "simple-park--on"]}
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

    {@render notes(step)}

    {#if step.kind === "wait" && step.waitFor !== TIME_ONLY}
      <!-- Fork: the Otherwise list, the steps that run only if the wait gives up (steps.ts). The
           field draws one way at a time; the way not drawn folds to one line, and opening it
           draws it. -->
      {@const sub = { waitCardId: step.cardId }}
      {@const count = step.otherwise?.length ?? 0}
      {@render branch(
        step,
        sub,
        otherwiseHead(step),
        step.otherwise ?? [],
        !count || !previewsTip(step.cardId),
        () => previewTip(step.cardId, !previewsTip(step.cardId)),
        count && step.rejoin !== false
          ? "then go on with the steps below"
          : count && !step.insteadParks
            ? "then skip the steps below"
            : null,
        "Otherwise steps",
        PALETTE,
      )}
    {:else if step.kind === "choice"}
      {#each step.legs ?? [] as leg, legIndex (legIndex)}
        {@const sub = { waitCardId: step.cardId, leg: legIndex as 0 | 1 }}
        {@render branch(
          step,
          sub,
          leg.name,
          leg.steps,
          previewsTip(step.cardId) === (legIndex === 0),
          () => previewTip(step.cardId, legIndex === 0),
          null,
          `${leg.name} steps`,
          PALETTE.filter(
            (t) =>
              LEG_KINDS.includes(t.kind) ||
              (t.kind === "park" && step.legsMayPark),
          ),
        )}
      {/each}
    {/if}
  </li>
{/snippet}

<!-- One way out of a wait or a choice: its heading (a button that draws it), and when drawn, its
     steps and a line to add one. -->
{#snippet branch(
  step: Step,
  sub: { waitCardId: string; leg?: 0 | 1 },
  head: string,
  list: Step[],
  open: boolean,
  show: () => void,
  then: string | null,
  label: string,
  offer: typeof PALETTE,
)}
  <div
    class={["simple-otherwise mt-1 ml-2", !open && "simple-otherwise--shut"]}
  >
    <button
      type="button"
      class="simple-branch-head"
      aria-expanded={open}
      title={open
        ? "Drawn on the field"
        : "Draw this way on the field, and open it"}
      onclick={() => !open && show()}
    >
      <ChevronRight
        class={["size-3 shrink-0 transition-transform", open && "rotate-90"]}
      />
      <span
        class={[
          "shrink-0 font-medium",
          step.kind === "choice" ? "font-mono" : "",
          open ? "text-heading" : "text-body",
        ]}>{head}{!open && list.length ? ":" : ""}</span
      >
      {#if !open && list.length}
        <span class="min-w-0 truncate text-body"
          >{list.map(oneLine).join(" → ")}</span
        >
      {/if}
    </button>
    {#if open}
      <ol class="mt-1 flex flex-col gap-1" aria-label={label}>
        {#each list as other, i (other.cardId)}
          {@render stepItem(other, i, sub)}
        {/each}
        <li
          class={[
            "simple-end !border-0 !p-0 !text-left",
            dropping(sub, list.length) && "simple-step--drop",
          ]}
          ondragover={(e) => dragOver(e, list.length, sub)}
          ondragleave={() => (dropAt = null)}
          ondrop={(e) => drop(e, list.length, sub)}
        >
          <select
            class="simple-add"
            aria-label={step.kind === "choice"
              ? `Add a step to ${head}`
              : "Add an Otherwise step"}
            title="Or drag a step from the Add row onto this line"
            value=""
            onchange={(e) => {
              const kind = e.currentTarget.value as AddKind;
              e.currentTarget.value = "";
              if (kind) add(kind, list.length, sub);
            }}
          >
            <option value="">+ add a step</option>
            {#each offer as tile (tile.kind)}
              <option value={tile.kind}>{tile.label}</option>
            {/each}
          </select>
        </li>
      </ol>
      {#if then}<p class="mt-0.5 text-[11px] text-body">{then}</p>{/if}
    {/if}
  </div>
{/snippet}

<!-- Under a step, only what needs fixing: a launch that misses, a pick off its line, a drive that
     runs into something. -->
{#snippet notes(step: Step)}
  {#if step.problem && step.kind !== "pickLaunch"}
    <p class="simple-note text-danger">{step.problem}.</p>
  {/if}
  {#if (step.kind === "drive" || step.kind === "park") && hits.get(step.cardId)}
    {@const hit = hits.get(step.cardId)!}
    {#if hit.drive.length}
      <p class="simple-note text-danger">
        Touches {hit.drive.join(" and ")}: move the spot or bend the path.
      </p>
    {/if}
    {#if hit.park.length}
      <p class="simple-note text-warning">
        Its park path (P) touches {hit.park.join(" and ")}.
      </p>
    {/if}
  {:else if step.kind === "launch" && step.aim && !step.aim.on}
    {@const aim = step.aim}
    <div class="simple-note flex items-center gap-2">
      <span class="flex-1 text-danger"
        >Misses: {Math.abs(aim.offDeg).toFixed(0)}° off the CELL{step.atSpot &&
        isStartName(step.atSpot)
          ? ". Drive to a launch spot first"
          : !step.atSpot
            ? ". Drive to a spot first"
            : ""}</span
      >
      {#if step.atSpot && !isStartName(step.atSpot)}
        <button
          type="button"
          class="simple-tile !min-h-0 !py-0.5 text-xs"
          title={`Turn ${step.atSpot} to face the CELL (${Math.round(aim.needDeg)}°)`}
          onclick={() => apply(faceCell(doc, step.atSpot!, aim.needDeg))}
          >Face the CELL</button
        >
      {/if}
    </div>
  {:else if (step.kind === "pick" || step.kind === "pickLaunch") && step.squares && !step.problem}
    <p class="simple-note text-warning">
      Off the FLOWER's line: it squares up first.
    </p>
  {:else if step.kind === "pickLaunch" && step.problem}
    <p class="simple-note text-danger">
      {step.problem}: drive to a spot on the FAR FLOWER's line.
    </p>
  {:else if step.kind === "gather" && !step.garden && !step.problem}
    <p class="simple-note text-danger">No GARDEN in range.</p>
  {/if}
{/snippet}

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
      aria-label={open ? "Lock the start spot" : "Unlock the start spot"}
      onclick={() => lockSpot(side!, open)}
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
  {#if pendingSpots.here.length}
    <div class="simple-pending flex flex-col gap-1.5" role="status">
      <p class="text-xs text-heading">
        Team spots changed here, not saved:
        <b class="font-mono">{pendingSpots.here.join(", ")}</b>
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
            confirm(
              `Put ${pendingSpots.here.join(", ")} back as the team has them?`,
            ) && dropSpotEdits(pendingSpots.here)}>Undo changes</button
        >
      </div>
    </div>
  {/if}
  {#if pendingSpots.elsewhere.length}
    <div class="flex flex-col gap-1 text-xs text-body" role="status">
      <p>
        Also changed in this browser, not used by this Auto:
        <span class="font-mono">{pendingSpots.elsewhere.join(", ")}</span>.
        {#if pendingSpots.gone.length}
          The team's list has no
          <span class="font-mono">{pendingSpots.gone.join(", ")}</span>
          (renamed since?); Save team spots would add
          {pendingSpots.gone.length === 1 ? "it" : "them"} back.
        {/if}
      </p>
      <button
        type="button"
        class="self-start underline"
        onclick={() =>
          confirm(
            `Drop this browser's changes to ${pendingSpots.elsewhere.join(", ")}? Those spots go back as the team has them.`,
          ) && dropSpotEdits(pendingSpots.elsewhere)}>Clear these</button
      >
    </div>
  {/if}
  <ol class="flex flex-col gap-1" aria-label="Steps">
    {#each steps as step, index (step.cardId)}
      {@render stepItem(step, index, null)}
    {/each}

    {#if steps.length && !everyStep(steps).some((step) => step.kind === "park")}
      <li class="px-1 text-xs text-warning">
        No Park step: add one, so the robot parks by 30 s even when a step runs
        long.
      </li>
    {/if}
    <li
      class={[
        "simple-end",
        dropping(null, steps.length) && "simple-step--drop",
      ]}
      ondragover={(e) => dragOver(e, steps.length, null)}
      ondragleave={() => (dropAt = null)}
      ondrop={(e) => drop(e, steps.length, null)}
    >
      {steps.length
        ? "Drop a step here, or add one below"
        : "Add the first step from the row below, or drag it here"}
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
              addAt(
                pending.kind,
                pending.index,
                e.currentTarget.value,
                pending.into,
              )}
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
    class="sticky bottom-0 flex flex-wrap items-center gap-1 border-t border-border bg-surface pt-2 pb-1"
    aria-label="Add a step"
  >
    <span class="mr-0.5 text-xs text-body">Add</span>
    {#each PALETTE as tile (tile.kind)}
      <button
        type="button"
        class="simple-chip"
        title={`${tile.label}: ${tile.hint}`}
        aria-label={tile.label}
        draggable="true"
        ondragstart={(e) => dragStart(e, `add:${tile.kind}`)}
        onclick={() => add(tile.kind)}
      >
        <tile.icon class="size-3.5 text-primary" />
        {tile.short}
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
  .simple-otherwise {
    border-left: 2px solid color-mix(in srgb, var(--warning) 60%, transparent);
    padding-left: 0.5rem;
  }
  /* An Otherwise may hold a wait with an Otherwise of its own, to any depth: the steps inside one
     give up their own indents, so each level costs the panel only the line down its left. */
  .simple-otherwise .simple-step {
    padding-left: 0.375rem;
    padding-right: 0.375rem;
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
  .simple-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    border-radius: 999px;
    border: 1px solid var(--border);
    padding: 0.2rem 0.55rem;
    font-size: 0.75rem;
    color: var(--heading);
    background: color-mix(in srgb, var(--base) 60%, transparent);
    cursor: pointer;
  }
  .simple-tile:hover,
  .simple-chip:hover,
  .simple-start:hover {
    border-color: var(--primary);
  }
  .simple-spot {
    min-width: 0;
    max-width: 100%;
    border: 1px solid transparent;
    border-radius: 0.4rem;
    padding: 0.05rem 0.2rem;
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.75rem;
    color: var(--heading);
    background: color-mix(in srgb, var(--body) 10%, transparent);
    cursor: pointer;
  }
  .simple-spot:hover,
  .simple-spot:focus {
    border-color: var(--primary);
    outline: none;
  }
  .simple-tag {
    flex-shrink: 0;
    border-radius: 999px;
    padding: 0 0.4rem;
    font-size: 0.68rem;
    line-height: 1.1rem;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    color: var(--body);
    background: color-mix(in srgb, var(--body) 12%, transparent);
  }
  .simple-tag--init {
    color: var(--primary);
    background: color-mix(in srgb, var(--primary) 16%, transparent);
    font-weight: 600;
  }
  .simple-tag--warn {
    color: var(--warning);
    background: color-mix(in srgb, var(--warning) 16%, transparent);
  }
  .simple-note {
    margin-top: 0.25rem;
    padding-left: 1.6rem;
    font-size: 0.75rem;
  }
  .simple-otherwise .simple-note {
    padding-left: 0.25rem;
  }
  .simple-branch-head {
    display: flex;
    width: 100%;
    min-width: 0;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.75rem;
    text-align: left;
  }
  .simple-otherwise--shut {
    border-left-color: var(--border);
  }
  .simple-otherwise--shut .simple-branch-head {
    cursor: pointer;
  }
  .simple-otherwise--shut .simple-branch-head:hover span {
    color: var(--heading);
  }
  .simple-add {
    border: 0;
    background: transparent;
    padding: 0.1rem 0;
    font-size: 0.72rem;
    color: var(--body);
    cursor: pointer;
  }
  .simple-add:hover {
    color: var(--primary);
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
