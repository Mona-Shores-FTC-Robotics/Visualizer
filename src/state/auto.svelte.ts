import { getContext, setContext, untrack } from "svelte";
import { fromStore } from "svelte/store";
import type { Path, Settings } from "../types";
import type { ProjectDoc } from "../io";
import { FIELD_SIZE } from "../config";
import type { Command } from "../model/commands";
import type { RobotPose } from "../sim/pose";
import { robotPoseAt } from "../sim/pose";
import { atomicSegments } from "../utils/pathTraversal";
import { createSegment } from "../utils/normalize";
import {
  autoSection,
  connectAutoStore,
  parseSelection,
  previewScenario,
  resetAutoView,
  selectedCardId,
  setNewPathHandler,
} from "../lib/auto/store";
import { allCards, findCard } from "../lib/auto/tree";
import { autoFromPaths, insertPathCard, newPathStart } from "../lib/auto/edit";
import {
  atomicPaths,
  pinState,
  resolvePins,
  type PinState,
} from "../lib/auto/pins";
import { linkSegmentIds, relink } from "../lib/auto/links";
import { buildPathCatalog } from "../lib/auto/geometry";
import { validateAuto } from "../lib/auto/validate";
import {
  motionPoseAt,
  simulateAuto,
  worstCase,
  type PreviewResult,
} from "../lib/auto/simulate";
import { previewTogether, type FieldEntry } from "../lib/timing/together";
import { compileLadders, ladderInfo } from "../lib/ladder/compile";
import { timingMode, timingValues } from "../lib/timing/store";
import type { Tip } from "../lib/timing/model";
import {
  cardTimes,
  missScenario,
  ladderScenario,
  ladderOutcomes,
  planOf,
  GOOD_PATH,
  type PlanStep,
} from "../lib/plan/plan";
import type { EditorState } from "./editor.svelte";
import type { Overlay, Overlays } from "./overlays.svelte";
import type { ProjectStore } from "./project.svelte";

/**
 * Fork: the Auto Builder's side of the app. The open project's Auto (kept in
 * `project.doc.auto`), its preview, and what keeps it consistent with the
 * paths: pins hold path ends on named points, and link paths move the chain
 * to wherever a branch starts. Upstream's components read the preview
 * through `Playback` and draw the Auto through the components in lib/auto.
 */
export class AutoState {
  /** Draw the branches the preview does not take, dashed. */
  showUntaken = $state(true);
  /** How the left panel shows the Auto: the plan (good path, chapters, misses) or every card. */
  view = $state<"plan" | "cards">("plan");
  /** The chapter open in the plan view. */
  chapter = $state(0);
  /** The branching wait whose miss is open in the plan view, by card id. */
  miss = $state<string | null>(null);

  #project: ProjectStore;
  #getSettings: () => Settings;
  #overlays: Overlays;
  #scenario = fromStore(previewScenario);
  #timingMode = fromStore(timingMode);
  #timingValues = fromStore(timingValues);
  #selection = fromStore(selectedCardId);
  /** The pins as they last held; see `resolvePins`. */
  #pinned: PinState | null = null;

  auto = $derived.by(() => this.#project.doc.auto ?? null);
  /**
   * The open project's preview, while it is what plays: other files shown
   * together take over the clock and the field.
   */
  playing = $derived.by(() =>
    this.#overlays.active ? null : (this.together?.previews[0] ?? null),
  );
  /** The settings the preview times the robot with. */
  get settings(): Settings {
    return this.#getSettings();
  }
  catalog = $derived.by(() =>
    this.auto
      ? buildPathCatalog(
          this.#project.doc.startPoint,
          this.#project.doc.lines,
          this.#getSettings(),
        )
      : null,
  );
  issues = $derived.by(() =>
    this.auto && this.catalog
      ? validateAuto(this.auto, this.catalog, this.#project.doc.startPoint)
      : [],
  );
  /** The Auto being edited, previewed alone (its own volleys TIP the HIVE with Typical timing). */
  together = $derived.by(
    (): { previews: PreviewResult[]; tips: Tip[] } | null => {
      const auto = this.auto;
      const catalog = this.catalog;
      if (!auto || !catalog) return null;
      const doc = this.#project.doc;
      if (this.#timingMode.current === "typical") {
        // Alone, nothing models the partner's Auto, so a tip we wait for is
        // taken to come; the plan view's good path depends on it.
        return previewTogether(
          [this.#entry(doc, this.#getSettings(), this.#scenario.current)],
          this.#timingValues.current,
          true,
          { tipsCome: true },
        );
      }
      return {
        previews: [
          simulateAuto(auto, catalog, doc.startPoint, this.#scenario.current),
        ],
        tips: [],
      };
    },
  );
  preview = $derived(this.together?.previews[0] ?? null);
  /** The Auto as a plan: good path, chapters, misses (lib/plan). */
  plan = $derived.by(() =>
    this.auto && this.catalog ? planOf(this.auto, this.catalog.names) : null,
  );
  /** When each card runs in the preview on screen. */
  times = $derived.by(() =>
    this.preview ? cardTimes(this.preview) : NO_TIMES,
  );
  /** The open miss's wait, when one is open: a wait that branches, or a plain wait for a tip. */
  missStep = $derived.by(
    () => this.plan?.steps.find((step) => step.cardId === this.miss) ?? null,
  );
  /** The open miss's ladder, when it has one. */
  missLadder = $derived.by(() =>
    this.auto && this.miss ? ladderInfo(this.auto, this.miss) : null,
  );
  /** Which outcome of the open ladder the preview shows (`ladderOutcomes`'s `k`). */
  missTry = $state(0);
  worst = $derived(
    this.auto && this.catalog ? worstCase(this.auto, this.catalog) : null,
  );
  /** Link paths: drawn by nobody, grabbed by nobody. */
  linkIds: ReadonlySet<string> = $derived.by(() =>
    this.auto ? linkSegmentIds(this.auto, this.#project.doc.lines) : NONE,
  );
  /** The segments of the selected path card: only they show control points. */
  handleSegments = $derived.by(() => {
    const { cardId } = parseSelection(this.#selection.current);
    const card = this.auto && cardId ? findCard(this.auto.cards, cardId) : null;
    if (card?.kind !== "path") return NONE;
    const path = this.#project.doc.lines.find(
      (line) => line.id === card.lineId,
    );
    return idSet(
      path ? atomicSegments([path]).map((segment) => segment.id) : [],
    );
  });

  /**
   * The overlays' Autos previewed together: with Typical timing their volleys
   * share one HIVE, so one robot's wait for its CELL ends on the other's TIP.
   */
  overlayTogether = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- rebuilt whole on every change
    const previews = new Map<Overlay, PreviewResult>();
    const withAuto = this.#overlays.items.filter((overlay) => overlay.doc.auto);
    const entries = withAuto.map((overlay) =>
      this.#entry(overlay.doc, this.#overlays.settingsFor(overlay), {}),
    );
    let tips: Tip[] = [];
    try {
      if (this.#timingMode.current === "typical") {
        const together = previewTogether(entries, this.#timingValues.current);
        tips = together.tips;
        together.previews.forEach((preview, i) =>
          previews.set(withAuto[i], preview),
        );
      } else {
        entries.forEach((entry, i) =>
          previews.set(
            withAuto[i],
            simulateAuto(
              entry.auto,
              buildPathCatalog(entry.startPoint, entry.lines, entry.settings),
              entry.startPoint,
              entry.scenario,
            ),
          ),
        );
      }
    } catch (error) {
      console.error("Could not preview the shown Autos:", error);
    }
    return { previews, tips, entries };
  });

  constructor(
    project: ProjectStore,
    getSettings: () => Settings,
    overlays: Overlays,
    editor: EditorState,
  ) {
    this.#project = project;
    this.#getSettings = getSettings;
    this.#overlays = overlays;
    connectAutoStore(project);
    setNewPathHandler((where) => this.addPath(where, editor));
    editor.addPathHook = (at) => this.addPath("branchEnd", editor, at);

    // Components read the Auto as `$autoSection`.
    $effect.pre(() => autoSection.set(this.auto));

    // A new or opened document starts with a fresh card list view, and its
    // pins as they are in the file.
    $effect.pre(() => {
      void project.loads;
      untrack(() => {
        resetAutoView();
        this.#pinned = null;
        this.chapter = 0;
        this.miss = null;
      });
    });

    // The plan view previews the good path, or the miss it has open; answers set on the cards
    // do not carry into it. A miss whose wait is gone closes.
    $effect.pre(() => {
      if (this.view !== "plan") return;
      const step = this.missStep;
      const scenario = step ? this.#missScenario(step) : GOOD_PATH;
      untrack(() => {
        if (this.miss && !step) this.miss = null;
        previewScenario.set(scenario);
      });
    });

    // This fork is one screen, the Auto: a project without one gets an Auto
    // that drives its paths in Path List order.
    $effect.pre(() => {
      if (project.doc.auto) return;
      untrack(() =>
        project.amend((doc) =>
          doc.auto
            ? doc
            : { ...doc, auto: autoFromPaths(doc.lines.map((line) => line.id)) },
        ),
      );
    });

    // After every edit: the pins hold, then the paths are laid out in the
    // order the Auto drives them (see lib/auto/pins.ts and links.ts).
    $effect.pre(() => {
      const doc = project.doc;
      const settings = getSettings();
      untrack(() => {
        if (!doc.auto) {
          this.#pinned = null;
          return;
        }
        const next = this.#settle(doc, settings);
        if (next !== doc) project.amend(() => next);
      });
    });

    // Selecting a path card selects its path, so the field shows that path's
    // control points (and only that path's) and the inspector edits it.
    $effect(() => {
      const { cardId } = parseSelection(this.#selection.current);
      const auto = untrack(() => this.auto);
      if (!auto || !cardId) return;
      const card = findCard(auto.cards, cardId);
      if (card?.kind !== "path") return;
      untrack(() => {
        if (editor.primarySelectedId !== card.lineId)
          editor.select([card.lineId]);
      });
    });
    // And the other way: clicking a path on the field selects the card that drives it.
    $effect(() => {
      const lineId = editor.selectedLineId;
      if (lineId) untrack(() => this.#selectCardDriving(lineId));
    });
  }

  /** The document with its pins holding and its link paths laid out. */
  #settle(doc: ProjectDoc, settings: Settings): ProjectDoc {
    let auto = doc.auto!;
    let { startPoint, lines } = doc;

    // Ladders first: they write cards, paths and pins of their own (lib/ladder).
    const built = compileLadders(auto, lines);
    if (built.changed) {
      auto = built.auto;
      lines = built.lines;
    }

    const segments = atomicPaths(lines);
    const stale = Object.keys(auto.pathEnds).filter((id) => !segments.has(id));
    if (stale.length) {
      const pathEnds = { ...auto.pathEnds };
      stale.forEach((id) => delete pathEnds[id]);
      auto = { ...auto, pathEnds };
    }

    const { points, moves } = resolvePins(
      auto,
      startPoint,
      lines,
      this.#pinned,
    );
    for (const move of moves) {
      if (move.segmentId === null) {
        startPoint = { ...startPoint, x: move.x, y: move.y };
      } else {
        lines = moveEnd(lines, move.segmentId, move.x, move.y);
      }
    }
    if (points) auto = { ...auto, points };
    this.#pinned = { ...pinState(auto), points: auto.points };

    let sequence = doc.sequence;
    const result = relink(startPoint, lines, auto, settings);
    if (result.changed) {
      lines = result.lines;
      auto = { ...auto };
      if (result.linkIds.length) auto.linkPaths = result.linkIds;
      else delete auto.linkPaths;
    }
    if (result.changed || built.changed) {
      sequence = atomicSegments(lines).map((line) => ({
        kind: "path" as const,
        lineId: line.id,
      }));
    }

    if (
      auto === doc.auto &&
      startPoint === doc.startPoint &&
      lines === doc.lines
    )
      return doc;
    return { ...doc, auto, startPoint, lines, sequence };
  }

  #entry(
    doc: ProjectDoc,
    settings: Settings,
    scenario: FieldEntry["scenario"],
  ): FieldEntry {
    return {
      auto: doc.auto!,
      startPoint: doc.startPoint,
      lines: doc.lines,
      settings,
      scenario,
    };
  }

  #missScenario(step: PlanStep) {
    const ladder = this.missLadder;
    return ladder
      ? ladderScenario(step.cardId, ladder, this.missTry)
      : missScenario(step);
  }

  /**
   * Shows what happens when `step`'s tip doesn't come: the preview and the field follow it. With
   * a ladder, outcome `k` (`ladderOutcomes`): the first try working, unless another is asked for.
   */
  openMiss(step: PlanStep, k = 0) {
    this.miss = step.cardId;
    this.missTry = k;
    previewScenario.set(this.#missScenario(step));
  }

  /** The field's ◆: opens that wait's miss, or closes it when it is the one open. */
  toggleMiss(cardId: string) {
    const step = this.plan?.steps.find((s) => s.cardId === cardId);
    if (!step || this.miss === cardId) this.closeMiss();
    else this.openMiss(step);
  }

  /** Back to the good path. */
  closeMiss() {
    this.miss = null;
    previewScenario.set(GOOD_PATH);
  }

  /**
   * Every way the Auto can run, for "All outcomes": the good path, then each wait that branches
   * with its tip missed. Each is a preview of its own, so it is computed when asked for.
   */
  outcomes(): {
    label: string;
    step: PlanStep | null;
    /** For a ladder: which outcome (`ladderOutcomes`'s `k`). */
    k: number;
    preview: PreviewResult;
  }[] {
    const auto = this.auto;
    const catalog = this.catalog;
    const plan = this.plan;
    if (!auto || !catalog || !plan) return [];
    const doc = this.#project.doc;
    const run = (scenario: Record<string, boolean>) =>
      this.#timingMode.current === "typical"
        ? previewTogether(
            [this.#entry(doc, this.#getSettings(), scenario)],
            this.#timingValues.current,
            false,
            { tipsCome: true },
          ).previews[0]
        : simulateAuto(auto, catalog, doc.startPoint, scenario);
    return [
      { label: "Every tip comes", step: null, k: 0, preview: run(GOOD_PATH) },
      ...plan.branches.flatMap((step) => {
        const name = `${step.tip ?? step.label} doesn't come`;
        const ladder = ladderInfo(auto, step.cardId);
        if (!ladder)
          return [
            { label: name, step, k: 0, preview: run(missScenario(step)) },
          ];
        return ladderOutcomes(ladder).map(({ k, label }) => ({
          label: `${name} · ${label}`,
          step,
          k,
          preview: run(ladderScenario(step.cardId, ladder, k)),
        }));
      }),
    ];
  }

  /** Where the open project's robot is, `seconds` into the preview. */
  poseAt(seconds: number, settings: Settings): RobotPose | null {
    const preview = this.preview;
    if (!preview) return null;
    return previewPose(preview, seconds, this.#project.doc, settings);
  }

  /** Clicking a path on the field selects the card that drives it. */
  #selectCardDriving(segmentId: string) {
    const auto = this.auto;
    if (!auto) return;
    const top = this.#project.doc.lines.find(
      (line) =>
        line.id === segmentId ||
        atomicSegments([line]).some((s) => s.id === segmentId),
    );
    const { cardId } = parseSelection(this.#selection.current);
    const current = cardId ? findCard(auto.cards, cardId) : null;
    if (current?.kind === "path" && current.lineId === top?.id) return;
    const driver = allCards(auto.cards).find(
      (card) => card.kind === "path" && card.lineId === top?.id,
    );
    if (driver) selectedCardId.set(driver.id);
  }

  /**
   * Auto mode's "add a path": a new path that starts where the robot is at
   * that point of the Auto, and a card that drives it, ending at `at` if
   * given. `branchEnd` (the field's add path) adds at the end of the selected
   * card's branch; `after` (the card list's + Path) right after the selected
   * card. The links put the
   * path's start where the robot is (see lib/auto/links.ts).
   */
  addPath(
    where: "after" | "branchEnd",
    editor: EditorState,
    at?: { x: number; y: number },
  ) {
    const auto = this.auto;
    const catalog = this.catalog;
    if (!auto || !catalog) return;
    const doc = this.#project.doc;
    const selection = parseSelection(this.#selection.current);
    const from = newPathStart(auto, catalog, doc.startPoint, selection, where);
    const round = (value: number) => Math.round(value * 10) / 10;
    const onField = (value: number) =>
      Math.min(FIELD_SIZE - 12, Math.max(12, value));
    const rad = (from.headingDeg * Math.PI) / 180;
    const path = createSegment(
      round(at?.x ?? onField(from.x + 24 * Math.cos(rad))),
      round(at?.y ?? onField(from.y + 24 * Math.sin(rad))),
    );
    path.heading = { type: "constant", degrees: round(from.headingDeg) };

    let cardId = "";
    const addPathAndCard: Command = (current) => {
      const draft = structuredClone(current.auto!);
      cardId = insertPathCard(draft, path.id, selection, where);
      return {
        ...current,
        lines: [...current.lines, path],
        sequence: [...current.sequence, { kind: "path", lineId: path.id }],
        auto: draft,
      };
    };
    this.#project.apply(addPathAndCard);
    selectedCardId.set(cardId);
    editor.select([path.id]);
  }
}

/** A set built once and never changed, so it need not be reactive. */
function idSet(ids: string[]): ReadonlySet<string> {
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- never mutated
  return new Set(ids);
}

const NONE = idSet([]);
const NO_TIMES: ReadonlyMap<string, { t0: number; t1: number }> = cardTimes({
  log: [],
  drives: [],
} as unknown as PreviewResult);

/** Where a robot is in a preview: on its project paths, or on a routine's own drive. */
export function previewPose(
  preview: PreviewResult,
  seconds: number,
  doc: Pick<ProjectDoc, "startPoint" | "lines">,
  settings: Settings,
): RobotPose {
  // Routine patterns and straight drives are not project paths; the
  // preview places the robot on them itself.
  const motion = motionPoseAt(preview, seconds);
  if (motion)
    return { x: motion.x, y: motion.y, heading: motion.headingDeg, t: null };
  return robotPoseAt(
    seconds,
    preview.timeline,
    doc.startPoint,
    doc.lines,
    settings,
  );
}

/** `lines` with one segment's end moved, wherever it sits in the tree. */
function moveEnd(
  lines: Path[],
  segmentId: string,
  x: number,
  y: number,
): Path[] {
  return lines.map((line) => {
    if (line.kind === "compound") {
      const segments = moveEnd(line.segments, segmentId, x, y);
      return segments === line.segments ? line : { ...line, segments };
    }
    return line.id === segmentId
      ? { ...line, endPoint: { ...line.endPoint, x, y } }
      : line;
  });
}

const CONTEXT_KEY = Symbol("auto");

export function provideAuto(auto: AutoState) {
  setContext(CONTEXT_KEY, auto);
}

export function useAuto(): AutoState {
  return getContext<AutoState>(CONTEXT_KEY);
}
