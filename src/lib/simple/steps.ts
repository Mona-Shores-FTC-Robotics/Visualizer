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
 * builder only hides what a first Auto does not need. A card the builder did not make (a wait, a
 * decision) shows as an advanced step and is left alone.
 *
 * Every edit returns a new document, so the caller applies it as one undo step.
 */
import type { ProjectDoc } from "../../io/project";
import type { AtomicPath, Path } from "../../types";
import { createSegment } from "../../utils/normalize";
import { createEmptyAuto } from "../auto/normalize";
import { cardTitle, makeCardId } from "../auto/tree";
import type { AutoCard, AutoSection, NamedPoint } from "../auto/types";
import { flowerAhead, type Flower } from "./flowers";

export type StepKind = "launch" | "pick" | "drive" | "park" | "other";

export interface Step {
  cardId: string;
  kind: StepKind;
  /** "Launch all", "Drive to WALL_PICK", or an advanced card's own title. */
  label: string;
  /** The named point a drive or park ends on. */
  spot: string | null;
  /** The path a drive or park drives. */
  lineId: string | null;
  /** Pick flower: the FLOWER the robot is lined up with, or null when none is. */
  flower?: Flower | null;
}

/** The two places our Autos start, drawn for RED (the robot turns them for BLUE). */
export const STARTS = {
  // biobuzz StartPositions.RED_AUDIENCE: back on the audience wall, left side on the B-C seam.
  right: { label: "Right start", pose: [55.17, 7.72, 90] as NamedPoint },
  // The left-side Autos' start (L-Quals, L-Simple): back on the far wall, facing the audience.
  left: { label: "Left start", pose: [59, 133.69, 270] as NamedPoint },
};
export type StartSide = keyof typeof STARTS;

/** The named point the start sits on. */
export const START_SPOT = "START";

export const LAUNCH_ALL = "LaunchAll";
export const PICK_FLOWER = "PickFlower";

/** The steps of the Auto's main list, in order. */
export function stepsOf(doc: ProjectDoc): Step[] {
  const auto = doc.auto;
  if (!auto) return [];
  let here = {
    x: doc.startPoint.x,
    y: doc.startPoint.y,
    h: doc.startPoint.headingDeg,
  };
  return auto.cards.map((card): Step => {
    const base = { cardId: card.id, spot: null, lineId: null };
    if (card.kind === "action" && card.name === LAUNCH_ALL) {
      return { ...base, kind: "launch", label: "Launch all" };
    }
    if (card.kind === "action" && card.name === PICK_FLOWER) {
      return {
        ...base,
        kind: "pick",
        label: "Pick flower",
        flower: flowerAhead(here.x, here.y, here.h),
      };
    }
    if (card.kind === "path") {
      const spot = spotOf(auto, doc.lines, card.lineId);
      const point = spot ? auto.points[spot] : null;
      if (point) here = { x: point[0], y: point[1], h: point[2] ?? here.h };
      const park = card.park;
      return {
        ...base,
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
    "right",
  );
}

/** Whether every step is one the simple builder makes, so it can show the whole Auto. */
export function isSimple(doc: ProjectDoc): boolean {
  return stepsOf(doc).every((step) => step.kind !== "other");
}

/** Which of our two starts the Auto begins at, or null for any other start. */
export function startSide(doc: ProjectDoc): StartSide | null {
  const { x, y, headingDeg } = doc.startPoint;
  for (const side of Object.keys(STARTS) as StartSide[]) {
    const [sx, sy, sh] = STARTS[side].pose;
    if (
      Math.abs(x - sx) < 0.05 &&
      Math.abs(y - sy) < 0.05 &&
      Math.abs(headingDeg - (sh ?? 0)) < 0.5
    ) {
      return side;
    }
  }
  return null;
}

/** Starts the Auto at one of our starts: the robot is placed there, on the START spot. */
export function setStart(doc: ProjectDoc, side: StartSide): ProjectDoc {
  return edit(doc, (next, auto) => {
    const [x, y, h] = STARTS[side].pose;
    next.startPoint = { ...next.startPoint, x, y, headingDeg: h ?? 0 };
    auto.points[START_SPOT] = [x, y, h ?? 0];
    auto.startAt = START_SPOT;
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
 * Adds a step at `index` of the main list (the end when past it). A drive or park needs `spot`,
 * a named point; its path runs from wherever the step before leaves the robot. One park only:
 * adding a park clears the others.
 */
export function addStep(
  doc: ProjectDoc,
  kind: Exclude<StepKind, "other">,
  index: number,
  spot?: string,
): { doc: ProjectDoc; cardId: string } {
  let cardId = "";
  const next = edit(doc, (draft, auto) => {
    let card: AutoCard;
    if (kind === "launch" || kind === "pick") {
      card = {
        id: makeCardId(),
        kind: "action",
        name: kind === "launch" ? LAUNCH_ALL : PICK_FLOWER,
      };
    } else {
      const point = spot ? auto.points[spot] : undefined;
      if (!spot || !point) throw new Error(`No spot named ${spot ?? "(none)"}`);
      const path = createSegment(point[0], point[1]);
      path.name = `to ${spot}`;
      draft.lines = [...draft.lines, path];
      draft.sequence = [...draft.sequence, { kind: "path", lineId: path.id }];
      auto.pathEnds[path.id] = spot;
      if (kind === "park") clearParks(auto.cards);
      card = {
        id: makeCardId(),
        kind: "path",
        lineId: path.id,
        park: kind === "park",
      };
    }
    auto.cards.splice(Math.max(0, Math.min(index, auto.cards.length)), 0, card);
    cardId = card.id;
  });
  return { doc: next, cardId };
}

/** Points a drive or park at another spot. */
export function setStepSpot(
  doc: ProjectDoc,
  cardId: string,
  spot: string,
): ProjectDoc {
  return edit(doc, (draft, auto) => {
    const card = auto.cards.find((c) => c.id === cardId);
    const point = auto.points[spot];
    if (card?.kind !== "path" || !point) return;
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

/** Removes a step; a drive takes its path with it. */
export function removeStep(doc: ProjectDoc, cardId: string): ProjectDoc {
  return edit(doc, (draft, auto) => {
    const index = auto.cards.findIndex((c) => c.id === cardId);
    if (index < 0) return;
    const [card] = auto.cards.splice(index, 1);
    if (card.kind !== "path") return;
    const lineId = card.lineId;
    draft.lines = draft.lines.filter((line) => line.id !== lineId);
    draft.sequence = draft.sequence.filter(
      (item) => item.kind !== "path" || item.lineId !== lineId,
    );
    delete auto.pathEnds[lineId];
  });
}

/** Moves a step to `index` of the main list (as counted before the move). */
export function moveStep(
  doc: ProjectDoc,
  cardId: string,
  index: number,
): ProjectDoc {
  return edit(doc, (_draft, auto) => {
    const from = auto.cards.findIndex((c) => c.id === cardId);
    if (from < 0) return;
    const [card] = auto.cards.splice(from, 1);
    const to = index > from ? index - 1 : index;
    auto.cards.splice(Math.max(0, Math.min(to, auto.cards.length)), 0, card);
  });
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

// --- inside -------------------------------------------------------------------------------------

/**
 * Applies `change` to a copy of the document, then lays each drive's heading out again: a drive
 * turns from the heading the step before left the robot at to its spot's heading, so reordering,
 * removing or turning a spot never leaves a drive starting at a stale heading.
 */
function edit(
  doc: ProjectDoc,
  change: (draft: ProjectDoc, auto: AutoSection) => void,
): ProjectDoc {
  if (!doc.auto) return doc;
  const draft: ProjectDoc = {
    ...doc,
    auto: structuredClone(doc.auto),
    lines: doc.lines,
  };
  change(draft, draft.auto!);
  draft.lines = withHeadings(draft);
  return draft;
}

function withHeadings(doc: ProjectDoc): Path[] {
  const auto = doc.auto!;
  const turned = new Map<string, AtomicPath["heading"]>();
  let h = doc.startPoint.headingDeg;
  for (const card of auto.cards) {
    if (card.kind !== "path") continue;
    const spot = auto.pathEnds[card.lineId];
    const end = spot ? auto.points[spot]?.[2] : undefined;
    if (end === undefined) continue;
    turned.set(
      card.lineId,
      Math.abs(end - h) < 1e-9
        ? { type: "constant", degrees: end }
        : { type: "linear", startDeg: h, endDeg: end },
    );
    h = end;
  }
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

function clearParks(cards: AutoCard[]): void {
  for (const card of cards) if (card.kind === "path") card.park = false;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Degrees in [0, 360). */
function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}
