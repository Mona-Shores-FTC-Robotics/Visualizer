/**
 * A partner's own Pedro Visualizer file (.pp) as one of the page's routes, so it can be edited,
 * shared in a QR code and run beside ours like any stand-in. Each path becomes a drive to its end,
 * curving through one bend (its control point, or the middle of several); each wait becomes a wait
 * until the time it would end; the last drive is the park. A file drawn on blue's side is turned
 * half a turn onto red's, as the page stores every route. Its shots are not in a Pedro file: the
 * partner adds them.
 */
import { DEFAULT_SETTINGS, FIELD_SIZE } from "../config/defaults";
import { parseProject, robotConfigOf, type ProjectDoc } from "../io";
import { fallbackValues, type TimingValues } from "../lib/timing/model";
import type { AtomicPath, BasePoint, Heading, Path } from "../types";
import {
  clampPoint,
  clampSpot,
  DEFAULT_VOLLEY_S,
  driveSeconds,
  type PartnerRoute,
  type RouteStep,
  type Spot,
} from "./route";

const round = (n: number) => Math.round(n * 10) / 10;

/** A route from a .pp file's text; throws a message a person can read. */
export function routeFromPp(
  name: string,
  text: string,
  values: TimingValues = fallbackValues(),
): PartnerRoute {
  const parsed = parseProject(text, robotConfigOf(DEFAULT_SETTINGS));
  if (!parsed.ok)
    throw new Error(`${name} is not a Pedro Visualizer file: ${parsed.error}`);
  return routeFromDoc(name, parsed.doc, values);
}

export function routeFromDoc(
  name: string,
  doc: ProjectDoc,
  values: TimingValues = fallbackValues(),
): PartnerRoute {
  const blue = doc.startPoint.x > FIELD_SIZE / 2;
  const turn = (p: BasePoint): BasePoint =>
    blue ? { x: FIELD_SIZE - p.x, y: FIELD_SIZE - p.y } : { x: p.x, y: p.y };
  const turnH = (h: number) => (blue ? h + 180 : h);

  const byId = new Map(doc.lines.map((l) => [l.id, l]));
  /** Each step, with the seconds a wait lasts (drives are timed below). */
  const items: ({ step: RouteStep } | { waitS: number })[] = [];
  let from: BasePoint = doc.startPoint;
  const addWait = (ms: number | undefined) => {
    if (ms && ms > 0) items.push({ waitS: ms / 1000 });
  };
  const addPath = (path: Path) => {
    addWait(path.waitBefore?.durationMs ?? path.waitBeforeMs);
    if (path.kind === "compound") {
      path.segments.forEach(addPath);
    } else {
      const end = turn(path.endPoint);
      const bend = bendOf(path);
      items.push({
        step: {
          kind: "drive",
          to: clampSpot({
            ...end,
            h: turnH(endHeading(path, from, path.heading)),
          }),
          bend: bend ? clampPoint(turn(bend)) : null,
          by: null,
          park: false,
        },
      });
      from = path.endPoint;
    }
    addWait(path.waitAfter?.durationMs ?? path.waitAfterMs);
  };
  for (const item of doc.sequence) {
    if (item.kind === "wait") addWait(item.durationMs);
    else {
      const path = byId.get(item.lineId);
      if (path) addPath(path);
    }
  }

  const start = clampSpot({
    ...turn(doc.startPoint),
    h: turnH(doc.startPoint.headingDeg),
  });
  const drives = items.flatMap((i) => ("step" in i ? [i.step] : []));
  const lastDrive = drives.length - 1;
  drives.forEach((d, i) => {
    if (d.kind === "drive") d.park = i === lastDrive;
  });
  const route: PartnerRoute = {
    name: name.replace(/\.pp$/i, ""),
    start,
    steps: drives,
    volleyS: DEFAULT_VOLLEY_S,
    delayS: 0,
  };
  if (!items.some((i) => "waitS" in i)) return route;

  // A wait ends at a time on the match clock: the drives before it, timed as the page drives them.
  const seconds = driveSeconds(route, values);
  const steps: RouteStep[] = [];
  let t = 0;
  let k = 0;
  for (const item of items) {
    if ("step" in item) {
      steps.push(item.step);
      t += seconds[k++] ?? 0;
    } else {
      t += item.waitS;
      steps.push({ kind: "wait", until: round(t) });
    }
  }
  return { ...route, steps };
}

/** One point a drive curves through: its control point, or the middle of several. */
function bendOf(path: AtomicPath): BasePoint | null {
  const points = path.controlPoints.length
    ? path.controlPoints
    : (path.throughPoints ?? []);
  if (!points.length) return null;
  if (points.length === 1) return points[0];
  const x = points.reduce((s, p) => s + p.x, 0) / points.length;
  const y = points.reduce((s, p) => s + p.y, 0) / points.length;
  return { x, y };
}

/** The way the robot faces at a path's end, degrees. */
function endHeading(path: AtomicPath, from: BasePoint, h: Heading): number {
  switch (h.type) {
    case "constant":
      return h.degrees;
    case "linear":
      return h.endDeg;
    case "piecewise": {
      const last = h.piecewiseHeading.segments.at(-1)?.parameters;
      return last?.endDeg ?? last?.degrees ?? 0;
    }
    case "tangential": {
      const before = path.controlPoints.at(-1) ?? from;
      const deg =
        (Math.atan2(path.endPoint.y - before.y, path.endPoint.x - before.x) *
          180) /
        Math.PI;
      return h.reverse ? deg + 180 : deg;
    }
  }
}

export type { Spot };
