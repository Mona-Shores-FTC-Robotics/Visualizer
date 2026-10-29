/**
 * The park from each late spot (AutoSection.parkFrom). When time runs short the robot's endgame
 * guard parks from the spot it is on, not along the Park step's own path, which starts from
 * wherever the drive before Park ends (biobuzz AutoKit `path(label, path, parkPath, parkSeconds)`).
 *
 * A spot gets its own park path when the guard could fire while the robot is there: the robot
 * leaves it, at the worst case, later than LATE_CUSHION_S before the Park step's guard time. The
 * path is a straight line to the park spot, which a student may bend like any other path; a bent
 * one is kept even once its spot is no longer late. The drive just before Park needs none: the
 * Park step's own path already starts there.
 */
import type { ProjectDoc } from "../../io/project";
import type { AtomicPath } from "../../types";
import { createSegment } from "../../utils/normalize";
import type { PathCatalog } from "../auto/geometry";
import { AUTO_LENGTH_S, commandSeconds, guardSeconds } from "../auto/simulate";
import { isSimple } from "./steps";

/** Seconds before the guard's time from which a spot counts as late. */
export const LATE_CUSHION_S = 5;

/** A spot's park, for the builder: the path card it parks after, the path, and when it is late. */
export interface SpotPark {
  cardId: string;
  lineId: string;
  /** The latest, at the worst case, the robot leaves the spot. */
  leaveS: number;
}

/**
 * The document with a park path for each late spot, and none for the others (unless bent).
 * Returns `doc` itself when nothing changes, so it can run after every edit.
 */
export function withSpotParks(
  doc: ProjectDoc,
  catalog: PathCatalog | null,
): ProjectDoc {
  const auto = doc.auto;
  if (!auto || !catalog || !isSimple(doc)) return doc;
  const wanted = lateSpots(doc, catalog);
  const parkCard = auto.cards.find((c) => c.kind === "path" && c.park);
  const parkSpot =
    parkCard?.kind === "path" ? auto.pathEnds[parkCard.lineId] : undefined;
  const parkPoint = parkSpot ? auto.points[parkSpot] : undefined;

  const current = auto.parkFrom ?? {};
  const lines = new Map(doc.lines.map((line) => [line.id, line]));
  const next: Record<string, string> = {};
  const removed = new Set<string>();
  const added: AtomicPath[] = [];
  const moved = new Map<string, AtomicPath>();
  const cardIds = new Set(auto.cards.map((c) => c.id));

  for (const [cardId, lineId] of Object.entries(current)) {
    const line = lines.get(lineId);
    const keep =
      !!line &&
      !!parkSpot &&
      cardIds.has(cardId) &&
      (wanted.has(cardId) || bent(line));
    if (!keep) {
      removed.add(lineId);
      continue;
    }
    next[cardId] = lineId;
    // The park spot moved, or Park now goes elsewhere: the line follows.
    if (
      line.kind === "atomic" &&
      parkPoint &&
      (line.endPoint.x !== parkPoint[0] || line.endPoint.y !== parkPoint[1])
    ) {
      moved.set(lineId, {
        ...line,
        endPoint: { ...line.endPoint, x: parkPoint[0], y: parkPoint[1] },
      });
    }
  }
  if (parkPoint && parkSpot) {
    for (const [cardId, spot] of wanted) {
      if (next[cardId]) continue;
      const line = createSegment(parkPoint[0], parkPoint[1]);
      line.name = `${spot} park`;
      const from = auto.points[spot]?.[2];
      const to = parkPoint[2];
      if (from !== undefined && to !== undefined)
        line.heading =
          Math.abs(from - to) < 1e-9
            ? { type: "constant", degrees: to }
            : { type: "linear", startDeg: from, endDeg: to };
      added.push(line);
      next[cardId] = line.id;
    }
  }

  const ends = new Set(Object.values(next));
  const pinsRight = [...ends].every((id) => auto.pathEnds[id] === parkSpot);
  if (
    !removed.size &&
    !added.length &&
    !moved.size &&
    pinsRight &&
    sameKeys(current, next)
  )
    return doc;

  const pathEnds = { ...auto.pathEnds };
  for (const id of removed) delete pathEnds[id];
  if (parkSpot) for (const id of ends) pathEnds[id] = parkSpot;
  const parkFrom = Object.keys(next).length ? next : undefined;
  return {
    ...doc,
    lines: [
      ...doc.lines
        .filter((line) => !removed.has(line.id))
        .map((line) => moved.get(line.id) ?? line),
      ...added,
    ],
    sequence: [
      ...doc.sequence.filter(
        (item) => item.kind !== "path" || !removed.has(item.lineId),
      ),
      ...added.map((line) => ({ kind: "path" as const, lineId: line.id })),
    ],
    auto: { ...auto, pathEnds, parkFrom },
  };
}

/** The builder's view: each spot that has a park, with when the robot leaves it. */
export function spotParks(
  doc: ProjectDoc,
  catalog: PathCatalog | null,
): Map<string, SpotPark> {
  const out = new Map<string, SpotPark>();
  const auto = doc.auto;
  if (!auto?.parkFrom || !catalog) return out;
  const leaves = leaveTimes(doc, catalog);
  for (const [cardId, lineId] of Object.entries(auto.parkFrom))
    out.set(cardId, { cardId, lineId, leaveS: leaves.get(cardId) ?? 0 });
  return out;
}

/** Whether a path is one of the spots' parks. */
export function isSpotPark(doc: ProjectDoc, lineId: string): boolean {
  return Object.values(doc.auto?.parkFrom ?? {}).includes(lineId);
}

// --- inside -------------------------------------------------------------------------------------

/** Drive card id → its spot, for the drives whose spot is late. */
function lateSpots(doc: ProjectDoc, catalog: PathCatalog): Map<string, string> {
  const auto = doc.auto!;
  const out = new Map<string, string>();
  const parkIndex = auto.cards.findIndex((c) => c.kind === "path" && c.park);
  if (parkIndex < 0) return out;
  const parkCard = auto.cards[parkIndex];
  const parkPath =
    parkCard.kind === "path" ? catalog.byId.get(parkCard.lineId) : undefined;
  if (!parkPath) return out;
  const late = AUTO_LENGTH_S - guardSeconds(parkPath) - LATE_CUSHION_S;
  const leaves = leaveTimes(doc, catalog);
  // The last drive before Park: Park's own path starts on its spot.
  let lastBefore: string | null = null;
  for (let i = parkIndex - 1; i >= 0; i--) {
    if (auto.cards[i].kind === "path") {
      lastBefore = auto.cards[i].id;
      break;
    }
  }
  for (const card of auto.cards.slice(0, parkIndex)) {
    if (card.kind !== "path" || card.id === lastBefore) continue;
    const spot = auto.pathEnds[card.lineId];
    const leave = leaves.get(card.id);
    if (spot && leave !== undefined && leave >= late) out.set(card.id, spot);
  }
  return out;
}

/**
 * Drive card id → the latest the robot leaves its spot: when the next drive starts, every step
 * taking its typical time (the builder's steps have no waits, so that is the worst case).
 */
function leaveTimes(
  doc: ProjectDoc,
  catalog: PathCatalog,
): Map<string, number> {
  const auto = doc.auto!;
  const out = new Map<string, number>();
  let t = 0;
  let at: string | null = null;
  for (const card of auto.cards) {
    if (card.kind === "action") t += commandSeconds(auto, card);
    else if (card.kind === "path") {
      if (at) out.set(at, t);
      t += catalog.byId.get(card.lineId)?.seconds ?? 0;
      at = card.id;
    }
  }
  if (at) out.set(at, t);
  return out;
}

/** Whether a student bent the path: it no longer is the straight line it was made as. */
function bent(line: ProjectDoc["lines"][number]): boolean {
  return line.kind !== "atomic" || line.controlPoints.length > 0;
}

function sameKeys(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
}
