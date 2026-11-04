/**
 * The simple builder's steps (lib/simple/SimpleBuilder.svelte): an Auto as a short list of things
 * our robot does, each one of the Auto's ordinary cards.
 *
 *   Launch all    an action card, LaunchAll
 *   Pick flower   an action card, PickFlower
 *   Drive to X    a path card whose path ends on the named point X
 *   Park at X     the same, marked as the park path
 *
 * So the file, the preview, the plan view and the Java export are the same as for any Auto; the
 * builder only hides what a first Auto does not need. A card the builder did not make (a decision
 * beyond a Wait's Otherwise) shows as an advanced step and is left alone.
 *
 * A Wait step may carry an **Otherwise** list: ordinary steps (no wait) that run only if the wait
 * times out, the cards of its time row. The trigger row stays empty, so when the trigger comes the
 * Auto goes straight on with the steps below the wait; after the Otherwise steps it goes on with
 * them too (AutoKit's firstOf). One level only: no wait inside an Otherwise.
 *
 * Every edit returns a new document, so the caller applies it as one undo step.
 */
import type { ProjectDoc } from "../../io/project";
import type { AtomicPath, Path } from "../../types";
import { createSegment } from "../../utils/normalize";
import { createEmptyAuto } from "../auto/normalize";
import { cardTitle, makeCardId } from "../auto/tree";
import type {
  AutoCard,
  AutoSection,
  FirstOfCard,
  NamedPoint,
} from "../auto/types";
import { robotFootprints } from "../../model/collision";
import { ownHalf, pickFrom, type Flower } from "./flowers";
import { aimFrom, type Aim } from "./aim";
import {
  gardenFor,
  MAX_RANGE_IN as GARDEN_RANGE_IN,
  type Garden,
} from "./garden";

export type StepKind =
  "launch" | "spinup" | "pick" | "gather" | "wait" | "drive" | "park" | "other";

export interface Step {
  cardId: string;
  kind: StepKind;
  /** "Launch all", "Drive to WALL_PICK", or an advanced card's own title. */
  label: string;
  /** The named point a drive or park ends on. */
  spot: string | null;
  /** The path a drive or park drives. */
  lineId: string | null;
  /** Pick flower: the FLOWER the robot will pick (the nearest within range), or null for none. */
  flower?: Flower | null;
  /** Garden gather: the GARDEN it goes to, or null when none is in range. */
  garden?: Garden | null;
  /** Pick flower: the robot squares up onto the FLOWER's line before it pushes. */
  squares?: boolean;
  /** Pick flower, Garden gather: why the robot would refuse, or null when it will do it. */
  problem?: string | null;
  /** Launch all: where it goes with the turret locked (aim.ts), and the spot it is launched from. */
  aim?: Aim;
  atSpot?: string | null;
  /** Wait: the trigger it waits for (WAIT_FOR), and the most it waits, seconds. */
  waitFor?: string;
  waitS?: number;
  /** Wait: `waitS` is a time on the match clock ("until 8 s"), not since the wait began. */
  waitClock?: boolean;
  /** Wait: the drive team may move it in INIT, as the partner's last shot plus the TIP lag (biobuzz InitOptions). */
  waitAdjustable?: boolean;
  /** Wait: the launcher spins up while it waits (SpinUp alongside). */
  spinUp?: boolean;
  /** Wait: the steps that run only if it times out (its Otherwise list), in order. */
  otherwise?: Step[];
  /**
   * Wait: after the Otherwise the robot goes on with the steps below the wait (true), or the
   * Otherwise ends with its own Park and the steps below run only when the trigger comes (false).
   */
  rejoin?: boolean;
}

/** Where a step goes: the main list, or the Otherwise list of the wait card named. */
export type StepList = { waitCardId: string } | null;

/**
 * Fork: what a Wait step waits for, the robot's triggers (biobuzz AutoRegistration). The builder
 * offers CellUp, shown as "Wait for TIP or CELL up" (mentor, 3 Nov 2026): the CELL the robot is
 * aimed at is up, true at once if it already is, else once the camera sees it settle up after a
 * TIP; and IntakeFull, a FLOWER pick topped up until the intake holds four (r-solo-staging). The
 * others are what older Autos and the partner stand-ins were drawn with (Tip: our HIVE tipped
 * since the wait began; LeftCellUp, RightCellUp: that CELL is up; CameraBlind: the stand-ins'
 * hold, which in the simulator runs to its time limit); a file that uses one still opens as a
 * Wait step, so no team file needs the card editor, but the dropdown no longer offers them.
 */
export const WAIT_FOR: readonly {
  trigger: string;
  label: string;
  legacy?: boolean;
}[] = [
  { trigger: "CellUp", label: "TIP or CELL up" },
  { trigger: "IntakeFull", label: "intake full" },
  { trigger: "Tip", label: "TIP (since the wait began)", legacy: true },
  { trigger: "LeftCellUp", label: "Left CELL up", legacy: true },
  { trigger: "RightCellUp", label: "Right CELL up", legacy: true },
  { trigger: "CameraBlind", label: "camera blind", legacy: true },
];
/** A new Wait step's limit, seconds: the robot moves on after this even with no TIP. */
export const WAIT_DEFAULT_S = 7;

/**
 * Fork: the starts are team spots named …_START (lib/team/teamSpots.ts; the team's names are
 * side first: RIGHT_START, RIGHT_PARK, RIGHT_LAUNCH_OFFSET). The builder's start buttons are the
 * team's _START spots. These are the ones it knows before the team's list is read (or with no
 * network), drawn for RED (the robot turns them for BLUE): biobuzz StartPositions, measured on
 * 31 Oct 2026, back flat on the wall and the frame's left side on a seam.
 */
export const DEFAULT_STARTS: Readonly<Record<string, NamedPoint>> = {
  RIGHT_START: [55.6, 7.7, 90],
  LEFT_START: [62.3, 133.8, 270],
};
/** Where a new Auto starts. */
export const DEFAULT_START = "RIGHT_START";

/** Whether a spot is a start: …_START, or an older file's START or START_…. */
export function isStartName(name: string): boolean {
  return (
    name === "START" || name.endsWith("_START") || name.startsWith("START_")
  );
}

/** The starts to offer: the team's _START spots, over the built-in ones. */
export function startsFrom(
  team: Readonly<Record<string, NamedPoint>>,
): Record<string, NamedPoint> {
  const out: Record<string, NamedPoint> = { ...DEFAULT_STARTS };
  for (const [name, pose] of Object.entries(team))
    if (name.endsWith("_START")) out[name] = pose;
  return out;
}

/** The team's spot that pairs with a start by side: "RIGHT_START" + "PARK" → "RIGHT_PARK". */
export function sideSpot(start: string | null, role: string): string | null {
  const side = start?.match(/^(.+)_START$/)?.[1];
  return side ? `${side}_${role}` : null;
}

/** "RIGHT_START" → "Right start". */
export function startLabel(name: string): string {
  const words = name
    .replace(/_START$/, "")
    .replace(/^START_?/, "")
    .toLowerCase()
    .split("_")
    .filter(Boolean);
  if (!words.length) return "Start";
  return `${words.join(" ").replace(/^./, (c) => c.toUpperCase())} start`;
}

export const LAUNCH_ALL = "LaunchAll";
/**
 * The robot's SpinUp: starts the launcher's wheels and finishes at once; the wheels keep spinning
 * (biobuzz LaunchCards), so a Launch all after it fires without waiting for them.
 */
export const SPIN_UP = "SpinUp";
export const PICK_FLOWER = "PickFlower";
export const GARDEN_GATHER = "GardenGather";
/**
 * A pick's card timeout, seconds: longer than a pick, as the robot code asks (a card's default
 * 5 s can cut it short).
 */
export const PICK_TIMEOUT_S = 8;

/** The steps of the Auto's main list, in order; a Wait step carries its Otherwise steps. */
export function stepsOf(doc: ProjectDoc): Step[] {
  if (!doc.auto) return [];
  // The builder's view: a wait that does not rejoin shows the steps below it in the main list.
  const auto = structuredClone(doc.auto);
  const parking = unfold(auto);
  const steps = walkSteps({ ...doc, auto }, auto.cards, {
    here: {
      x: doc.startPoint.x,
      y: doc.startPoint.y,
      h: doc.startPoint.headingDeg,
    },
    onSpot: auto.startAt ?? null,
  });
  for (const step of steps)
    if (step.kind === "wait") step.rejoin = !parking.has(step.cardId);
  return steps;
}

/** Where the robot is while the steps are read: its pose, and the named spot it is on. */
interface Walk {
  here: { x: number; y: number; h: number };
  /** The named spot the robot is on: the start's, then each drive's. */
  onSpot: string | null;
}

function walkSteps(doc: ProjectDoc, cards: AutoCard[], at: Walk): Step[] {
  const auto = doc.auto!;
  return cards.map((card): Step => {
    const base = { cardId: card.id, spot: null, lineId: null };
    if (card.kind === "action" && card.name === LAUNCH_ALL) {
      // The turret stays locked straight ahead in an Auto: the heading is the aim (aim.ts).
      return {
        ...base,
        kind: "launch",
        label: "Launch all",
        aim: aimFrom(at.here.x, at.here.y, at.here.h, auto.drawnFor),
        atSpot: at.onSpot,
      };
    }
    if (card.kind === "action" && card.name === SPIN_UP) {
      return { ...base, kind: "spinup", label: "Spin up the launcher" };
    }
    if (card.kind === "action" && card.name === PICK_FLOWER) {
      // A pick ends where its push started (FlowerPicker's contract): where the drive left the
      // robot, or on the FLOWER's line if it squared up first.
      const pick = pickFrom(at.here.x, at.here.y, at.here.h);
      if (pick.ok && pick.squares)
        at.here = {
          x: pick.start.x,
          y: pick.start.y,
          h: pick.start.headingDeg,
        };
      return {
        ...base,
        kind: "pick",
        label: "Pick flower",
        flower: pick.flower,
        problem: pick.ok ? null : pick.why,
        squares: pick.ok && pick.squares,
      };
    }
    if (card.kind === "action" && card.name === GARDEN_GATHER) {
      // A gather ends where it started (GardenGather's contract), so `here` stays.
      const garden = gardenFor(at.here.x, at.here.y);
      return {
        ...base,
        kind: "gather",
        label: "Garden gather",
        garden,
        problem: garden
          ? null
          : `No GARDEN on our side of the centre line within ${GARDEN_RANGE_IN} in`,
      };
    }
    if (card.kind === "firstOf") {
      const wait = waitOf(card);
      if (wait) {
        const label =
          WAIT_FOR.find((w) => w.trigger === wait.trigger)?.label ??
          wait.trigger;
        // The Otherwise steps start where the wait is, on a copy: the list below the wait is read
        // as if the trigger came (the preview's default), so it goes on from the wait's pose too.
        const otherwise = walkSteps(doc, wait.otherwise, {
          here: { ...at.here },
          onSpot: at.onSpot,
        });
        return {
          ...base,
          kind: "wait",
          label: `Wait for ${label}`,
          waitFor: wait.trigger,
          waitS: wait.seconds,
          waitClock: wait.matchClock,
          waitAdjustable: wait.adjustable,
          spinUp: wait.spinUp,
          otherwise,
        };
      }
    }
    if (card.kind === "path") {
      const spot = spotOf(auto, doc.lines, card.lineId);
      const point = spot ? auto.points[spot] : null;
      if (point)
        at.here = { x: point[0], y: point[1], h: point[2] ?? at.here.h };
      at.onSpot = spot;
      const park = card.park;
      // An Auto may not cross the centre line with any part of the robot.
      const crosses =
        !!point &&
        robotFootprints(
          { x: at.here.x, y: at.here.y, heading: at.here.h },
          { ...doc.robot, safetyMargin: 0 },
        )
          .flat()
          .some((corner) => !ownHalf(doc.startPoint.x, corner.x));
      return {
        ...base,
        problem: crosses
          ? "The robot reaches across the centre line here, which an Auto may not do"
          : null,
        kind: park ? "park" : "drive",
        label: spot
          ? `${park ? "Park at" : "Drive to"} ${spot}`
          : park
            ? "Park"
            : "Drive",
        spot,
        lineId: card.lineId,
      };
    }
    return { ...base, kind: "other", label: cardTitle(card) };
  });
}

/** A new Auto: no paths and no steps, the robot at the right start. */
export function blankAuto(doc: ProjectDoc): ProjectDoc {
  return setStart(
    { ...doc, lines: [], sequence: [], auto: createEmptyAuto() },
    DEFAULT_START,
    DEFAULT_STARTS[DEFAULT_START],
  );
}

/** Whether every step is one the simple builder makes, so it can show the whole Auto. */
export function isSimple(doc: ProjectDoc): boolean {
  const simple = (steps: Step[]): boolean =>
    steps.every(
      (step) => step.kind !== "other" && simple(step.otherwise ?? []),
    );
  return simple(stepsOf(doc));
}

/**
 * The Drive or Park step a path belongs to: the step that drives it, or, for a spot's park path
 * (parkFrom.ts, the builder's P), the drive whose spot it parks from (`viaPark`). Null for any
 * other path, such as a link.
 */
export function stepForLine(
  doc: ProjectDoc,
  lineId: string,
): { step: Step; viaPark: boolean } | null {
  const all = stepsOf(doc).flatMap((step) => [step, ...(step.otherwise ?? [])]);
  const drives = all.filter(
    (step) => step.kind === "drive" || step.kind === "park",
  );
  const own = drives.find((step) => step.lineId === lineId);
  if (own) return { step: own, viaPark: false };
  const parkFrom = doc.auto?.parkFrom ?? {};
  const from = drives.find((step) => parkFrom[step.cardId] === lineId);
  return from ? { step: from, viaPark: true } : null;
}

/**
 * The start spot the Auto begins on (…_START), or null for any other start. An older Auto (its
 * start named START, or none) whose start sits on one of `starts` counts as that one.
 */
export function startName(
  doc: ProjectDoc,
  starts: Readonly<Record<string, NamedPoint>> = DEFAULT_STARTS,
): string | null {
  const at = doc.auto?.startAt;
  if (at && (at.endsWith("_START") || at.startsWith("START_"))) return at;
  const { x, y, headingDeg } = doc.startPoint;
  for (const [name, [sx, sy, sh]] of Object.entries(starts)) {
    if (
      Math.abs(x - sx) < 0.05 &&
      Math.abs(y - sy) < 0.05 &&
      Math.abs(headingDeg - (sh ?? 0)) < 0.5
    )
      return name;
  }
  return null;
}

/**
 * Starts the Auto on the start spot `name`, linked to the team's list: the robot is placed there.
 * The start it leaves goes, unless a drive ends on it.
 */
export function setStart(
  doc: ProjectDoc,
  name: string,
  pose: NamedPoint,
): ProjectDoc {
  return edit(doc, (next, auto) => {
    const [x, y, h] = pose;
    const old = auto.startAt;
    next.startPoint = { ...next.startPoint, x, y, headingDeg: h ?? 0 };
    auto.points[name] = [x, y, h ?? 0];
    auto.startAt = name;
    auto.teamSpots = [...new Set([...(auto.teamSpots ?? []), name])].sort();
    if (
      old &&
      old !== name &&
      isStartName(old) &&
      !Object.values(auto.pathEnds).includes(old)
    ) {
      delete auto.points[old];
      auto.teamSpots = auto.teamSpots.filter((n) => n !== old);
    }
    if (!auto.teamSpots.length) delete auto.teamSpots;
  });
}

/** Adds a named spot (or moves one), heading rounded to the degree. */
export function addSpot(
  doc: ProjectDoc,
  name: string,
  x: number,
  y: number,
  headingDeg: number,
): ProjectDoc {
  return edit(doc, (_next, auto) => {
    auto.points[name] = [
      round1(x),
      round1(y),
      Math.round(normalizeDeg(headingDeg)),
    ];
  });
}

/** Turns a spot: every drive that ends on it now ends facing `headingDeg`. */
export function setSpotHeading(
  doc: ProjectDoc,
  name: string,
  headingDeg: number,
): ProjectDoc {
  return edit(doc, (_next, auto) => {
    const point = auto.points[name];
    if (point)
      auto.points[name] = [
        point[0],
        point[1],
        Math.round(normalizeDeg(headingDeg)),
      ];
  });
}

/**
 * Turns the start: the robot starts facing `headingDeg` (rounded to the degree), the start's named
 * spot with it, and the first drive turns from there. A partner stand-in that never drives has no
 * other way to say which way it faces.
 */
export function setStartHeading(
  doc: ProjectDoc,
  headingDeg: number,
): ProjectDoc {
  const h = Math.round(normalizeDeg(headingDeg));
  if (!doc.auto)
    return { ...doc, startPoint: { ...doc.startPoint, headingDeg: h } };
  return edit(doc, (next, auto) => {
    next.startPoint = { ...next.startPoint, headingDeg: h };
    const point = auto.startAt ? auto.points[auto.startAt] : undefined;
    if (auto.startAt && point)
      auto.points[auto.startAt] = [point[0], point[1], h];
  });
}

/**
 * Adds a step at `index` of the main list (the end when past it), or of a wait's Otherwise list
 * (`into`). A drive or park needs `spot`, a named point; its path runs from wherever the step
 * before leaves the robot. One park only: adding a park clears the others, in every list. A wait
 * cannot go inside an Otherwise.
 */
export function addStep(
  doc: ProjectDoc,
  kind: Exclude<StepKind, "other">,
  index: number,
  spot?: string,
  into: StepList = null,
): { doc: ProjectDoc; cardId: string } {
  let cardId = "";
  const next = edit(doc, (draft, auto, parking) => {
    const list = listOf(auto, into);
    if (!list) throw new Error("No such Wait step for an Otherwise");
    let card: AutoCard;
    if (kind === "wait") {
      if (into) throw new Error("A wait cannot go inside an Otherwise");
      card = {
        id: makeCardId(),
        kind: "firstOf",
        label: "Wait for TIP or CELL up",
        rows: [
          { when: ["CellUp"], cards: [] },
          { afterMs: WAIT_DEFAULT_S * 1000, cards: [] },
        ],
      };
    } else if (kind === "spinup") {
      card = { id: makeCardId(), kind: "action", name: SPIN_UP };
    } else if (kind === "launch" || kind === "pick" || kind === "gather") {
      card =
        kind === "launch"
          ? { id: makeCardId(), kind: "action", name: LAUNCH_ALL }
          : {
              id: makeCardId(),
              kind: "action",
              name: kind === "pick" ? PICK_FLOWER : GARDEN_GATHER,
              timeoutS: PICK_TIMEOUT_S,
            };
    } else {
      const point = spot ? auto.points[spot] : undefined;
      if (!spot || !point) throw new Error(`No spot named ${spot ?? "(none)"}`);
      const path = createSegment(point[0], point[1]);
      path.name = `to ${spot}`;
      draft.lines = [...draft.lines, path];
      draft.sequence = [...draft.sequence, { kind: "path", lineId: path.id }];
      auto.pathEnds[path.id] = spot;
      // One park per route: the main one, and each Otherwise that parks instead of going on.
      if (kind === "park")
        if (into && parking.has(into.waitCardId)) clearParks(list);
        else clearRouteParks(auto, parking);
      card = {
        id: makeCardId(),
        kind: "path",
        lineId: path.id,
        park: kind === "park",
      };
    }
    list.splice(Math.max(0, Math.min(index, list.length)), 0, card);
    cardId = card.id;
  });
  return { doc: next, cardId };
}

/** The cards of the main list, or of the Otherwise (time) row of the wait `into` names. */
function listOf(auto: AutoSection, into: StepList): AutoCard[] | null {
  if (!into) return auto.cards;
  const card = auto.cards.find((c) => c.id === into.waitCardId);
  if (card?.kind !== "firstOf" || !waitOf(card)) return null;
  const row = card.rows.find((r) => "afterMs" in r);
  return row ? row.cards : null;
}

/** Every list a step may be in: the main one and each wait's Otherwise. */
function allLists(auto: AutoSection): AutoCard[][] {
  const lists = [auto.cards];
  for (const card of auto.cards)
    if (card.kind === "firstOf" && waitOf(card))
      for (const row of card.rows) if ("afterMs" in row) lists.push(row.cards);
  return lists;
}

/** The list holding the card, and its index there. */
function findCard(
  auto: AutoSection,
  cardId: string,
): { list: AutoCard[]; index: number } | null {
  for (const list of allLists(auto)) {
    const index = list.findIndex((c) => c.id === cardId);
    if (index >= 0) return { list, index };
  }
  return null;
}

/** Points a drive or park at another spot. */
export function setStepSpot(
  doc: ProjectDoc,
  cardId: string,
  spot: string,
): ProjectDoc {
  return edit(doc, (draft, auto) => {
    const found = findCard(auto, cardId);
    const card = found?.list[found.index];
    const point = auto.points[spot];
    if (card?.kind !== "path" || !point) return;
    // One PARK spot per Auto: every route's Park goes there (and INIT's choices are about it).
    if (card.park) {
      for (const other of allCardsOf(auto.cards))
        if (other.kind === "path" && other.park && other !== card) {
          auto.pathEnds[other.lineId] = spot;
          draft.lines = draft.lines.map((line) =>
            line.id === other.lineId && line.kind === "atomic"
              ? {
                  ...line,
                  name: `to ${spot}`,
                  endPoint: { ...line.endPoint, x: point[0], y: point[1] },
                }
              : line,
          );
        }
    }
    // Park on a spot the drive team was offered: the two swap, so the old park is offered instead.
    const old = auto.pathEnds[card.lineId];
    if (card.park && auto.parkChoices?.includes(spot)) {
      auto.parkChoices = [
        ...auto.parkChoices.filter((n) => n !== spot),
        ...(old ? [old] : []),
      ].sort();
    }
    auto.pathEnds[card.lineId] = spot;
    draft.lines = draft.lines.map((line) =>
      line.id === card.lineId && line.kind === "atomic"
        ? {
            ...line,
            name: `to ${spot}`,
            endPoint: { ...line.endPoint, x: point[0], y: point[1] },
          }
        : line,
    );
  });
}

/** Removes a step; a drive takes its path with it, a wait its Otherwise steps and their paths. */
export function removeStep(doc: ProjectDoc, cardId: string): ProjectDoc {
  return edit(doc, (draft, auto) => {
    const found = findCard(auto, cardId);
    if (!found) return;
    const [card] = found.list.splice(found.index, 1);
    // No park left, nothing to offer in its place.
    if (card.kind === "path" && card.park) dropParkChoices(auto);
    const gone: AutoCard[] = [card];
    if (card.kind === "firstOf")
      for (const row of card.rows) gone.push(...row.cards);
    const lineIds = new Set(
      gone.flatMap((c) => (c.kind === "path" ? [c.lineId] : [])),
    );
    if (!lineIds.size) return;
    draft.lines = draft.lines.filter((line) => !lineIds.has(line.id));
    draft.sequence = draft.sequence.filter(
      (item) => item.kind !== "path" || !lineIds.has(item.lineId),
    );
    for (const lineId of lineIds) delete auto.pathEnds[lineId];
  });
}

/**
 * Moves a step to `index` (as counted before the move) of the main list, or of a wait's Otherwise
 * (`into`); a step may move between the lists, but a wait never into an Otherwise.
 */
export function moveStep(
  doc: ProjectDoc,
  cardId: string,
  index: number,
  into: StepList = null,
): ProjectDoc {
  return edit(doc, (_draft, auto) => {
    const found = findCard(auto, cardId);
    const target = listOf(auto, into);
    if (!found || !target) return;
    const card = found.list[found.index];
    if (card.kind === "firstOf" && into) return;
    found.list.splice(found.index, 1);
    const to = target === found.list && index > found.index ? index - 1 : index;
    target.splice(Math.max(0, Math.min(to, target.length)), 0, card);
  });
}

/**
 * Changes what a Wait step waits for, the most it waits (seconds, at least 0.1), or whether the
 * launcher spins up while it waits.
 */
export function setWait(
  doc: ProjectDoc,
  cardId: string,
  change: {
    waitFor?: string;
    seconds?: number;
    spinUp?: boolean;
    /** The limit is a time on the match clock; turning it off makes it a plain limit again. */
    matchClock?: boolean;
    /** The drive team may move it in INIT; only on the match clock, one wait per Auto. */
    adjustable?: boolean;
  },
): ProjectDoc {
  return edit(doc, (_draft, auto) => {
    const card = auto.cards.find((c) => c.id === cardId);
    if (card?.kind !== "firstOf" || !waitOf(card)) return;
    for (const row of card.rows) {
      if ("when" in row && change.waitFor) row.when = [change.waitFor];
      if (!("afterMs" in row)) continue;
      if (change.seconds !== undefined)
        row.afterMs = Math.round(Math.max(0.1, change.seconds) * 10) * 100;
      if (change.matchClock === true) row.matchClock = true;
      if (change.matchClock === false) {
        delete row.matchClock;
        delete row.adjustable;
      }
      if (change.adjustable === true && row.matchClock) {
        // One wait per Auto: the D-pad's up and down move only one.
        for (const other of auto.cards)
          if (other.kind === "firstOf" && other !== card)
            for (const r of other.rows) if ("afterMs" in r) delete r.adjustable;
        row.adjustable = true;
      }
      if (change.adjustable === false) delete row.adjustable;
    }
    if (change.spinUp === true) card.alongside = SPIN_UP;
    if (change.spinUp === false) delete card.alongside;
    const wait = waitOf(card)!;
    card.label = `Wait for ${WAIT_FOR.find((w) => w.trigger === wait.trigger)?.label ?? wait.trigger}`;
  });
}

/**
 * Fork: whether a Wait's Otherwise goes on with the steps below the wait afterwards (`rejoin`), or
 * parks instead. Parking adds a Park step at the end of the Otherwise, on the Auto's PARK spot, and
 * the steps below the wait then run only when the trigger comes (in the file: the trigger row's
 * cards, the wait last in the main list). Going on again takes that Park step out. Needs a Park
 * step below the wait.
 */
export function setWaitRejoin(
  doc: ProjectDoc,
  cardId: string,
  rejoin: boolean,
): ProjectDoc {
  return edit(doc, (draft, auto, parking) => {
    const index = auto.cards.findIndex((c) => c.id === cardId);
    const card = auto.cards[index];
    if (card?.kind !== "firstOf" || !waitOf(card)) return;
    const row = card.rows.find((r) => "afterMs" in r)!;
    const isPark = (c: AutoCard) => c.kind === "path" && c.park;
    if (rejoin) {
      parking.delete(cardId);
      row.cards = row.cards.filter((c) => !isPark(c));
      return;
    }
    const park = auto.cards.slice(index + 1).find(isPark);
    const spot = park?.kind === "path" ? auto.pathEnds[park.lineId] : undefined;
    const point = spot ? auto.points[spot] : undefined;
    if (!spot || !point) return;
    parking.add(cardId);
    if (row.cards.some(isPark)) return;
    const path = createSegment(point[0], point[1]);
    path.name = `to ${spot}`;
    draft.lines = [...draft.lines, path];
    draft.sequence = [...draft.sequence, { kind: "path", lineId: path.id }];
    auto.pathEnds[path.id] = spot;
    row.cards.push({
      id: makeCardId(),
      kind: "path",
      lineId: path.id,
      park: true,
    });
  });
}

/**
 * Fork: offers the drive team another PARK spot during INIT (`on`), or stops offering it
 * (types.ts parkChoices). An offered spot is one of the Auto's named points (link a team spot in
 * first); one no longer offered, and used by nothing else, leaves the Auto.
 */
export function setParkChoice(
  doc: ProjectDoc,
  name: string,
  on: boolean,
): ProjectDoc {
  return edit(doc, (_draft, auto) => {
    const now = new Set(auto.parkChoices ?? []);
    if (on && auto.points[name]) now.add(name);
    if (!on) {
      now.delete(name);
      auto.parkChoices = [name];
      dropParkChoices(auto);
    }
    if (now.size) auto.parkChoices = [...now].sort();
    else delete auto.parkChoices;
  });
}

/**
 * Renames one of this Auto's own spots: every drive that ends on it, its paths' names ("to X",
 * "X park") and the start, if it sits there, follow. A team spot is not renamed here (its name is
 * shared by every Auto that uses it), nor is a start. Returns the reason it cannot, or the new
 * document.
 */
export function renameSpot(
  doc: ProjectDoc,
  from: string,
  to: string,
): { doc: ProjectDoc } | { problem: string } {
  const auto = doc.auto;
  const name = cleanSpotName(to);
  if (!auto?.points[from]) return { problem: `There is no spot ${from}.` };
  if (!name) return { problem: "A spot needs a name: letters, digits and _." };
  if (name === from) return { doc };
  if (isStartName(from) || isStartName(name))
    return { problem: "Starts keep their _START names." };
  if (auto.teamSpots?.includes(from))
    return {
      problem: `${from} is a team spot: its name is shared by every Auto that uses it.`,
    };
  if (auto.points[name])
    return { problem: `This Auto already has a spot ${name}.` };
  const next = edit(doc, (draft, a) => {
    a.points[name] = a.points[from];
    delete a.points[from];
    for (const id of Object.keys(a.pathEnds))
      if (a.pathEnds[id] === from) a.pathEnds[id] = name;
    if (a.startAt === from) a.startAt = name;
    draft.lines = draft.lines.map((line) =>
      line.name === `to ${from}`
        ? { ...line, name: `to ${name}` }
        : line.name === `${from} park`
          ? { ...line, name: `${name} park` }
          : line,
    );
  });
  return { doc: next };
}

/** A name for a new spot that no spot has yet: SPOT_1, SPOT_2... */
export function freeSpotName(auto: AutoSection, base = "SPOT"): string {
  for (let n = 1; ; n++)
    if (!auto.points[`${base}_${n}`]) return `${base}_${n}`;
}

/** Spot names as the robot code takes them: letters, digits and _, upper case. */
export function cleanSpotName(text: string): string {
  return text
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * The document with each drive turning from the heading the step before left the robot at to its
 * spot's heading, as every edit here leaves it. For a change made elsewhere: a team spot updated
 * (lib/team/teamSpots.ts).
 */
export function layHeadings(doc: ProjectDoc): ProjectDoc {
  if (!doc.auto) return doc;
  const lines = withHeadings(doc);
  return lines === doc.lines ? doc : { ...doc, lines };
}

/**
 * The document without the paths no step drives: a path left behind by an earlier version of
 * the Auto (a file rebuilt in the builder keeps the old file's lines) draws as a stray dashed
 * line and chains the paths after it from the wrong place. Kept: every drive's and park's path,
 * in the main list and each Otherwise, the spots' parks (parkFrom.ts) and the link paths the
 * layout needs (lib/auto/links.ts). Every edit here prunes; the builder prunes once when it
 * opens a file. The same document when nothing is pruned.
 */
export function pruneUnusedPaths(doc: ProjectDoc): ProjectDoc {
  const auto = doc.auto;
  if (!auto) return doc;
  const keep = new Set<string>([
    ...(auto.linkPaths ?? []),
    ...Object.values(auto.parkFrom ?? {}),
  ]);
  const walk = (cards: AutoCard[]) => {
    for (const card of cards) {
      if (card.kind === "path" || card.kind === "rejoin") keep.add(card.lineId);
      if (card.kind === "firstOf") for (const row of card.rows) walk(row.cards);
    }
  };
  walk(auto.cards);
  const stale = doc.lines.filter((line) => !keep.has(line.id));
  if (!stale.length) return doc;
  const gone = new Set(stale.map((line) => line.id));
  const pathEnds = { ...auto.pathEnds };
  for (const id of gone) delete pathEnds[id];
  return {
    ...doc,
    lines: doc.lines.filter((line) => !gone.has(line.id)),
    sequence: doc.sequence.filter(
      (item) => item.kind !== "path" || !gone.has(item.lineId),
    ),
    auto: { ...auto, pathEnds },
  };
}

// --- inside -------------------------------------------------------------------------------------

/**
 * Applies `change` to a copy of the document, then lays each drive's heading out again: a drive
 * turns from the heading the step before left the robot at to its spot's heading, so reordering,
 * removing or turning a spot never leaves a drive starting at a stale heading.
 */
function edit(
  doc: ProjectDoc,
  change: (draft: ProjectDoc, auto: AutoSection, parking: Set<string>) => void,
): ProjectDoc {
  if (!doc.auto) return doc;
  const draft: ProjectDoc = {
    ...doc,
    auto: structuredClone(doc.auto),
    lines: doc.lines,
  };
  // Edits see the builder's view (unfold); the file keeps the trigger row's steps (refold).
  const parking = unfold(draft.auto!);
  change(draft, draft.auto!, parking);
  refold(draft.auto!, parking);
  const pruned = pruneUnusedPaths(draft);
  pruned.lines = withHeadings(pruned);
  return pruned;
}

function withHeadings(doc: ProjectDoc): Path[] {
  const auto = doc.auto!;
  const turned = new Map<string, AtomicPath["heading"]>();
  // Returns the heading the list leaves the robot at. A wait's Otherwise is laid from the heading
  // at the wait; the list after the wait goes on from that heading too (see walkSteps).
  const lay = (cards: AutoCard[], from: number): number => {
    let h = from;
    for (const card of cards) {
      if (card.kind === "firstOf" && waitOf(card, true)) {
        for (const row of card.rows) if ("afterMs" in row) lay(row.cards, h);
        // A wait that parks instead of going on: the steps below it are its trigger row's.
        for (const row of card.rows) if ("when" in row) h = lay(row.cards, h);
        continue;
      }
      if (card.kind !== "path") continue;
      const spot = auto.pathEnds[card.lineId];
      const point = spot ? auto.points[spot] : undefined;
      if (!point) continue;
      // A spot with no heading (the parks) is reached at whatever heading the robot arrives with.
      const end = point[2] ?? h;
      turned.set(
        card.lineId,
        Math.abs(end - h) < 1e-9
          ? { type: "constant", degrees: end }
          : { type: "linear", startDeg: h, endDeg: end },
      );
      h = end;
    }
    return h;
  };
  lay(auto.cards, doc.startPoint.headingDeg);
  if (!turned.size) return doc.lines;
  return doc.lines.map((line) => {
    const heading = turned.get(line.id);
    if (!heading || line.kind !== "atomic") return line;
    return sameHeading(line.heading, heading) ? line : { ...line, heading };
  });
}

function sameHeading(
  a: AtomicPath["heading"],
  b: AtomicPath["heading"],
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function spotOf(
  auto: AutoSection,
  lines: Path[],
  lineId: string,
): string | null {
  let node = lines.find((line) => line.id === lineId);
  while (node && node.kind === "compound")
    node = node.segments[node.segments.length - 1];
  return node ? (auto.pathEnds[node.id] ?? null) : null;
}

/**
 * A Wait step's trigger, limit and Otherwise cards, when `card` is one: a trigger row with nothing
 * after it, a time row (its cards are the Otherwise list), and nothing run alongside but SpinUp.
 * Any other wait is an advanced step.
 */
function waitOf(
  card: FirstOfCard,
  allowWhenCards = false,
): {
  trigger: string;
  seconds: number;
  matchClock: boolean;
  adjustable: boolean;
  spinUp: boolean;
  otherwise: AutoCard[];
} | null {
  if (card.alongside && card.alongside !== SPIN_UP) return null;
  if (card.ladder || card.rows.length !== 2) return null;
  const when = card.rows.find((row) => "when" in row) as
    { when: string[]; cards: AutoCard[] } | undefined;
  const time = card.rows.find((row) => "afterMs" in row) as
    | {
        afterMs: number;
        matchClock?: boolean;
        adjustable?: boolean;
        cards: AutoCard[];
      }
    | undefined;
  if (!when || !time || when.when.length !== 1) return null;
  if (when.cards.length && !allowWhenCards) return null;
  if (!WAIT_FOR.some((w) => w.trigger === when.when[0])) return null;
  return {
    trigger: when.when[0],
    seconds: time.afterMs / 1000,
    matchClock: !!time.matchClock,
    adjustable: !!time.adjustable,
    spinUp: card.alongside === SPIN_UP,
    otherwise: time.cards,
  };
}

/** Stops offering other parks in INIT; a spot that was only offered leaves the Auto. */
function dropParkChoices(auto: AutoSection): void {
  for (const name of auto.parkChoices ?? []) {
    if (auto.startAt === name || Object.values(auto.pathEnds).includes(name))
      continue;
    delete auto.points[name];
    auto.teamSpots = auto.teamSpots?.filter((n) => n !== name);
    if (!auto.teamSpots?.length) delete auto.teamSpots;
  }
  delete auto.parkChoices;
}

/**
 * The builder's view of a wait that parks instead of going on: in the file it is the main list's
 * last card and the steps below it are its trigger row's (each route holds the rest of itself, as
 * a decision does); here they follow it in the main list, as for any wait. Changes `auto`; returns
 * the ids of those waits, for {@link refold}. Only a wait last in the main list unfolds, so an
 * Auto drawn elsewhere, with steps after such a wait, reads as it runs.
 */
export function unfold(auto: AutoSection): Set<string> {
  const parking = new Set<string>();
  for (;;) {
    const last = auto.cards[auto.cards.length - 1];
    if (last?.kind !== "firstOf" || parking.has(last.id)) break;
    if (!waitOf(last, true)) break;
    const when = last.rows.find((r) => "when" in r)!;
    if (!when.cards.length) break;
    parking.add(last.id);
    auto.cards.push(...when.cards);
    when.cards = [];
  }
  return parking;
}

/** Back to the file's form: the steps below each such wait go into its trigger row. */
export function refold(auto: AutoSection, parking: Set<string>): void {
  for (let i = auto.cards.length - 1; i >= 0; i--) {
    const card = auto.cards[i];
    if (card.kind !== "firstOf" || !parking.has(card.id)) continue;
    const when = card.rows.find((r) => "when" in r);
    if (when) when.cards = auto.cards.splice(i + 1);
  }
}

function allCardsOf(cards: AutoCard[]): AutoCard[] {
  return cards.flatMap((card) =>
    card.kind === "firstOf"
      ? [card, ...card.rows.flatMap((row) => allCardsOf(row.cards))]
      : [card],
  );
}

/** Clears the main route's parks: the main list's and each going-on Otherwise's. */
function clearRouteParks(auto: AutoSection, parking: Set<string>): void {
  for (const card of auto.cards) {
    if (card.kind === "path") card.park = false;
    if (card.kind === "firstOf" && !parking.has(card.id))
      for (const row of card.rows) clearParks(row.cards);
  }
}

function clearParks(cards: AutoCard[]): void {
  for (const card of cards) {
    if (card.kind === "path") card.park = false;
    if (card.kind === "firstOf")
      for (const row of card.rows) clearParks(row.cards);
  }
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Degrees in [0, 360). */
function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}
