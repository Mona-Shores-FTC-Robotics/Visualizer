/**
 * The park from each spot (AutoSection.parkFrom). When time runs short the robot's endgame
 * guard parks from the spot it is on, not along the Park step's own path, which starts from
 * wherever the drive before Park ends (biobuzz AutoKit `path(label, path, parkPath, parkSeconds)`).
 *
 * Every drive before Park gets one: the plan's times say when the robot should reach a spot, but
 * a slow launch or a long pick can put it there seconds later, and the guard parks from wherever
 * it is. The path is a straight line to the park spot, which a student may bend like any other
 * path. Every drive to the same spot shares that spot's park. The drive just before Park needs
 * none: the Park step's own path already starts there.
 */
import type { ProjectDoc } from "../../io/project";
import type { AtomicPath } from "../../types";
import { createSegment } from "../../utils/normalize";
import type { PathCatalog } from "../auto/geometry";
import { commandSeconds } from "../auto/simulate";
import { isSimple } from "./steps";

/** A spot's park, for the builder: the path card it parks after, the path, and when it leaves. */
export interface SpotPark {
  cardId: string;
  lineId: string;
  /** When the plan has the robot leave the spot, every step taking its typical time. */
  leaveS: number;
}

/**
 * The document with a park path for each drive before Park, and none for the others (unless bent).
 * Returns `doc` itself when nothing changes, so it can run after every edit.
 */
export function withSpotParks(
  doc: ProjectDoc,
  catalog: PathCatalog | null,
): ProjectDoc {
  const auto = doc.auto;
  if (!auto || !catalog || !isSimple(doc)) return doc;
  const wanted = parkedSpots(doc);
  const parkCard = auto.cards.find((c) => c.kind === "path" && c.park);
  const parkSpot =
    parkCard?.kind === "path" ? auto.pathEnds[parkCard.lineId] : undefined;
  const parkPoint = parkSpot ? auto.points[parkSpot] : undefined;

  const current = auto.parkFrom ?? {};
  const lines = new Map(doc.lines.map((line) => [line.id, line]));
  const cards = new Map(auto.cards.map((c) => [c.id, c]));
  const spotOf = (cardId: string) => {
    const card = cards.get(cardId);
    return card?.kind === "path" ? auto.pathEnds[card.lineId] : undefined;
  };

  // One park per spot: every drive to the same spot parks along the same path. A spot's park
  // is the one a student bent, if any, else the first kept.
  const bySpot = new Map<string, string>();
  const next: Record<string, string> = {};
  for (const [cardId, lineId] of Object.entries(current)) {
    const line = lines.get(lineId);
    const spot = spotOf(cardId);
    if (!line || !parkSpot || !spot || !(wanted.has(cardId) || bent(line)))
      continue;
    next[cardId] = lineId;
    const chosen = bySpot.get(spot);
    if (!chosen || (!bent(lines.get(chosen)!) && bent(line)))
      bySpot.set(spot, lineId);
  }
  for (const cardId of Object.keys(next))
    next[cardId] = bySpot.get(spotOf(cardId)!)!;

  const added: AtomicPath[] = [];
  if (parkPoint && parkSpot) {
    for (const [cardId, spot] of wanted) {
      if (next[cardId]) continue;
      let lineId = bySpot.get(spot);
      if (!lineId) {
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
        lineId = line.id;
        bySpot.set(spot, lineId);
      }
      next[cardId] = lineId;
    }
  }

  const kept = new Set(Object.values(next));
  const removed = new Set(Object.values(current).filter((id) => !kept.has(id)));
  // The park spot moved, or Park now goes elsewhere: the lines follow.
  const moved = new Map<string, AtomicPath>();
  for (const id of kept) {
    const line = lines.get(id);
    if (
      line?.kind === "atomic" &&
      parkPoint &&
      (line.endPoint.x !== parkPoint[0] || line.endPoint.y !== parkPoint[1])
    )
      moved.set(id, {
        ...line,
        endPoint: { ...line.endPoint, x: parkPoint[0], y: parkPoint[1] },
      });
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

/**
 * Drive card id → its spot, for every drive before Park: the robot may run behind its plan and
 * reach any of them late, so each has its own park. The last drive before Park needs none.
 */
function parkedSpots(doc: ProjectDoc): Map<string, string> {
  const auto = doc.auto!;
  const out = new Map<string, string>();
  const parkIndex = auto.cards.findIndex((c) => c.kind === "path" && c.park);
  if (parkIndex < 0) return out;
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
    if (spot) out.set(card.id, spot);
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
