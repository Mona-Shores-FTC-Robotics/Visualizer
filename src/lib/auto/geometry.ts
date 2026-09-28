import type {
  BasePoint,
  Path,
  Settings,
  StartPose,
  TimelineEvent,
} from "../../types";
import { calculatePathTime, runDistanceAt } from "../../utils/timeCalculator";
import {
  atomicSegments,
  effectiveHeadingAt,
  flattenToAtomicSegments,
  type FlatSegment,
} from "../../utils/pathTraversal";
import { getLineEndHeading, getLineStartHeading } from "../../utils/headingInterpolation";
import { easeInOutQuad, getCurvePoint } from "../../utils/math";

/**
 * What the Auto needs to know about one of the project's paths.
 *
 * A path card names a top-level entry of the Path List: a single path or a
 * group, which Pedro follows as one path. Its geometry is exactly the stock
 * Visualizer's: each path starts where the previous one in the list ends.
 */
export interface PathInfo {
  id: string;
  /** Position in the top-level list. */
  index: number;
  name: string;
  segments: FlatSegment[];
  start: BasePoint;
  end: BasePoint;
  startHeadingDeg: number;
  endHeadingDeg: number;
  length: number;
  /** Seconds to drive it from rest to rest, by the app's motion model. */
  seconds: number;
  /** The app's travel events for it alone, starting at time 0. */
  travel: TimelineEvent[];
  /** Sampled points along the whole path, for drawing and event markers. */
  samples: BasePoint[];
  /** Cumulative arc length at each sample. */
  sampleDistances: number[];
  /** Inches covered `time` seconds after the path starts. */
  distanceAt: (time: number) => number;
}

export interface PathCatalog {
  /** Top-level paths, in list order. */
  paths: PathInfo[];
  byId: Map<string, PathInfo>;
  /** Ids of segments nested inside a group (not valid path-card targets). */
  nestedIds: Set<string>;
  /** Display name of every path and group, nested ones included. */
  names: Map<string, string>;
  /** The robot settings the times were computed with. */
  settings: Settings;
}

/** Names as the Path List shows them: "Path N" counts segments, "Group N" groups. */
export function pathDisplayNames(lines: Path[]): Map<string, string> {
  const names = new Map<string, string>();
  let segmentNumber = 0;
  let groupNumber = 0;
  const walk = (nodes: Path[]) => {
    for (const node of nodes) {
      if (node.kind === "compound") {
        groupNumber += 1;
        names.set(node.id, node.name || `Group ${groupNumber}`);
        walk(node.segments);
      } else {
        segmentNumber += 1;
        names.set(node.id, node.name || `Path ${segmentNumber}`);
      }
    }
  };
  walk(lines);
  return names;
}

const SAMPLES_PER_SEGMENT = 40;

export function buildPathCatalog(
  startPoint: StartPose,
  lines: Path[],
  settings: Settings,
): PathCatalog {
  const flat = flattenToAtomicSegments(startPoint, lines);
  const names = pathDisplayNames(lines);
  const bySegmentId = new Map(flat.map((segment) => [segment.line.id, segment]));
  const nestedIds = new Set<string>();
  const paths: PathInfo[] = [];

  lines.forEach((node, index) => {
    const segments = atomicSegments([node])
      .map((line) => bySegmentId.get(line.id))
      .filter((segment): segment is FlatSegment => Boolean(segment));
    if (node.kind === "compound") {
      atomicSegments(node.segments).forEach((line) => nestedIds.add(line.id));
      const collectGroups = (children: Path[]) =>
        children.forEach((child) => {
          if (child.kind === "compound") {
            nestedIds.add(child.id);
            collectGroups(child.segments);
          }
        });
      collectGroups(node.segments);
    }
    if (segments.length === 0) return;

    const first = segments[0];
    const last = segments[segments.length - 1];
    const startHeading = effectiveHeadingAt(flat, first.index, 0);
    const endHeading = effectiveHeadingAt(flat, last.index, 1);
    const prediction = calculatePathTime(
      startPoint,
      lines,
      settings,
      segments.map((segment) => ({ kind: "path", lineId: segment.line.id })),
    );

    const samples: BasePoint[] = [];
    const sampleDistances: number[] = [];
    let travelled = 0;
    segments.forEach((segment, segmentIndex) => {
      for (let k = segmentIndex === 0 ? 0 : 1; k <= SAMPLES_PER_SEGMENT; k++) {
        const point = getCurvePoint(k / SAMPLES_PER_SEGMENT, segment.points);
        const previous = samples[samples.length - 1];
        if (previous) travelled += Math.hypot(point.x - previous.x, point.y - previous.y);
        samples.push(point);
        sampleDistances.push(travelled);
      }
    });

    paths.push({
      id: node.id,
      index,
      name: names.get(node.id) ?? `Path ${index + 1}`,
      segments,
      start: first.start,
      end: last.line.endPoint,
      startHeadingDeg: getLineStartHeading(
        first.line,
        first.start,
        startHeading.heading,
        startHeading.t,
      ),
      endHeadingDeg: getLineEndHeading(
        last.line,
        last.start,
        endHeading.heading,
        endHeading.t,
      ),
      length: segments.reduce((sum, segment) => sum + segment.arcLength, 0),
      seconds: prediction.totalTime,
      travel: prediction.timeline.filter((event) => event.type === "travel"),
      samples,
      sampleDistances,
      distanceAt: (time: number) => {
        const run = prediction.timeline.find((event) => event.run)?.run;
        if (!run) return 0;
        return Math.min(
          run.totalLength,
          runDistanceAt(run, Math.min(time, run.totalTime), settings, easeInOutQuad),
        );
      },
    });
  });

  return {
    paths,
    byId: new Map(paths.map((path) => [path.id, path])),
    nestedIds,
    names,
    settings,
  };
}

/** The point `fraction` (0..1) of the way along the path by distance. */
export function pointAlong(path: PathInfo, fraction: number): BasePoint {
  const { samples, sampleDistances } = path;
  if (samples.length === 0) return path.start;
  const target = Math.max(0, Math.min(1, fraction)) * path.length;
  let index = 1;
  while (index < samples.length - 1 && sampleDistances[index] < target) index++;
  const a = samples[index - 1] ?? samples[0];
  const b = samples[index] ?? a;
  const span = sampleDistances[index] - (sampleDistances[index - 1] ?? 0);
  const within = span > 1e-9 ? (target - sampleDistances[index - 1]) / span : 0;
  return { x: a.x + (b.x - a.x) * within, y: a.y + (b.y - a.y) * within };
}

/**
 * Seconds from the start of the path until the robot has covered `fraction`
 * of it, on the same profile the app animates.
 */
export function timeAtFraction(path: PathInfo, fraction: number): number {
  if (path.length <= 1e-9 || path.seconds <= 0) return 0;
  const target = Math.max(0, Math.min(1, fraction)) * path.length;
  // Distance only grows with time, so bisect.
  let low = 0;
  let high = path.seconds;
  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    if (path.distanceAt(mid) < target) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}
