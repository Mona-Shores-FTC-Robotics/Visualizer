import type { AtomicPath, BasePoint, Path, StartPose } from "../../types";
import type { AutoSection, NamedPoint } from "./types";

/**
 * Pins: path ends (and the start pose) that are named points.
 *
 * A pinned end has no position of its own. It is wherever its point is:
 * edit the point and every end pinned to it follows; drag a pinned end and
 * the point, and so every other end on it, moves with it. The path still
 * stores the position (a stock Visualizer reads only that), so the editor
 * keeps the two equal with `resolvePins` after every change.
 */

/** Pinned positions snap to this, the one decimal the files are written in. */
const round1 = (value: number) => Math.round(value * 10) / 10;

/** Two positions closer than this are the same place. */
const SAME_PLACE_IN = 0.05;

const samePlace = (a: BasePoint, b: { 0: number; 1: number }) =>
  Math.abs(a.x - b[0]) < SAME_PLACE_IN && Math.abs(a.y - b[1]) < SAME_PLACE_IN;

/** Every single path in the list, groups' segments included, by id. */
export function atomicPaths(lines: Path[]): Map<string, AtomicPath> {
  const found = new Map<string, AtomicPath>();
  const walk = (nodes: Path[]) => {
    for (const node of nodes) {
      if (node.kind === "compound") walk(node.segments);
      else found.set(node.id, node);
    }
  };
  walk(lines);
  return found;
}

/**
 * The end of a top-level path or group: a group ends where its last segment
 * does, so that is the segment its pin goes on.
 */
export function endSegmentId(lines: Path[], lineId: string): string | null {
  let node = lines.find((line) => line.id === lineId);
  while (node && node.kind === "compound") node = node.segments[node.segments.length - 1];
  return node ? node.id : null;
}

/** Whether a file's raw `auto` section was saved before pins existed. */
export function predatesPins(raw: unknown): boolean {
  return typeof raw === "object" && raw !== null && !("pathEnds" in raw) && !("startAt" in raw);
}

/**
 * For a file saved before pins existed: every path end and the start that
 * already sit on a named point are pinned to it.
 */
export function adoptPins(auto: AutoSection, startPoint: BasePoint | null, lines: Path[]): void {
  const names = Object.keys(auto.points);
  for (const [id, path] of atomicPaths(lines)) {
    const name = names.find((n) => samePlace(path.endPoint, auto.points[n]));
    if (name) auto.pathEnds[id] = name;
  }
  if (startPoint) {
    const name = names.find((n) => samePlace(startPoint, auto.points[n]));
    if (name) auto.startAt = name;
  }
}

/** Where each named point is used: pinned ends, the start, and cards. */
export interface PointUse {
  /** Ids of the path segments whose end is on the point. */
  ends: string[];
  start: boolean;
  /** Cards and decision rows that name the point. */
  cards: number;
}

export function pointUses(auto: AutoSection): Map<string, PointUse> {
  const uses = new Map<string, PointUse>();
  for (const name of Object.keys(auto.points)) uses.set(name, { ends: [], start: false, cards: 0 });
  for (const [id, name] of Object.entries(auto.pathEnds)) uses.get(name)?.ends.push(id);
  if (auto.startAt && uses.has(auto.startAt)) uses.get(auto.startAt)!.start = true;
  return uses;
}

export const isUsed = (use: PointUse | undefined) =>
  !!use && (use.ends.length > 0 || use.start || use.cards > 0);

/** What `resolvePins` compares against: the pins as they last held. */
export interface PinState {
  points: Record<string, NamedPoint>;
  pathEnds: Record<string, string>;
  startAt?: string;
}

export const pinState = (auto: AutoSection): PinState => ({
  points: auto.points,
  pathEnds: auto.pathEnds,
  startAt: auto.startAt,
});

/** A move for `resolvePins`' caller to make: a segment's end, or the start. */
export interface PinMove {
  /** A segment id, or null for the start pose. */
  segmentId: string | null;
  x: number;
  y: number;
}

export interface PinResolution {
  /** The named points after the change, when any moved; else null. */
  points: Record<string, NamedPoint> | null;
  moves: PinMove[];
}

/**
 * Makes the pins hold again after an edit.
 *
 * `before` is the pins as they last held. A point that differs from it was
 * edited, and a pin not in it was just made; either way the ends follow the
 * point. Otherwise an end
 * that is off its point was dragged, so the point (rounded to 0.1 in) follows
 * the end, and then every other end on that point follows the point. With no
 * `before` (a file just opened) the points win.
 */
export function resolvePins(
  auto: AutoSection,
  startPoint: StartPose,
  lines: Path[],
  before: PinState | null,
): PinResolution {
  const paths = atomicPaths(lines);
  const points: Record<string, NamedPoint> = { ...auto.points };
  const edited = (name: string) => {
    const was = before?.points[name];
    const now = auto.points[name];
    return !was || was[0] !== now[0] || was[1] !== now[1];
  };

  // A pin made since `before` moves its end onto the point, never the reverse.
  const pins: { segmentId: string | null; at: BasePoint; name: string; isNew: boolean }[] = [];
  for (const [id, name] of Object.entries(auto.pathEnds)) {
    const path = paths.get(id);
    if (path && points[name]) {
      pins.push({ segmentId: id, at: path.endPoint, name, isNew: before?.pathEnds[id] !== name });
    }
  }
  if (auto.startAt && points[auto.startAt]) {
    pins.push({ segmentId: null, at: startPoint, name: auto.startAt, isNew: before?.startAt !== auto.startAt });
  }

  let pointsChanged = false;
  const settled = new Set<string>();
  for (const pin of pins) {
    if (pin.isNew || settled.has(pin.name) || edited(pin.name)) continue;
    const point = points[pin.name];
    if (point[0] === pin.at.x && point[1] === pin.at.y) continue;
    const moved = [round1(pin.at.x), round1(pin.at.y), ...point.slice(2)] as NamedPoint;
    points[pin.name] = moved;
    settled.add(pin.name);
    pointsChanged = true;
  }

  const moves: PinMove[] = [];
  for (const pin of pins) {
    const point = points[pin.name];
    if (point[0] !== pin.at.x || point[1] !== pin.at.y) {
      moves.push({ segmentId: pin.segmentId, x: point[0], y: point[1] });
    }
  }
  return { points: pointsChanged ? points : null, moves };
}
