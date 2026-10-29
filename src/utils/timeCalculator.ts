import type {
  BasePoint,
  Path,
  Settings,
  StartPose,
  TimePrediction,
  TimelineEvent,
  SequenceItem,
} from "../types";
import {
  motionProfile,
  timeAtDistance,
  turnLimitedTimes,
} from "../sim/motionProfile";
import { getAngularDifference } from "./math";
import { segmentHeadingAt } from "./headingInterpolation";
import {
  atomicSegments,
  flattenToAtomicSegments,
  type FlatSegment,
} from "./pathTraversal";

export function calculatePathTime(
  startPoint: StartPose,
  lines: Path[],
  settings: Settings,
  sequence?: SequenceItem[],
): TimePrediction {
  const msToSeconds = (value?: number | string) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return numeric / 1000;
  };

  const segmentLengths: number[] = [];
  const segmentTimes: number[] = [];
  const timeline: TimelineEvent[] = [];

  let currentTime = 0;
  let currentHeading = startPoint.headingDeg;

  // Create map by order of segments
  const pathSegments = flattenToAtomicSegments(startPoint, lines);
  const segmentById = new Map(
    pathSegments.map((segment) => [segment.line.id, segment]),
  );

  // Each top-level path (a group included) is exported as one Pedro path, so
  // it is also one motion: Pedro slows only toward the end of the path it is
  // following, not at the joins inside it.
  const exportedPathOf = new Map<string, number>();
  lines.forEach((node, index) => {
    for (const segment of atomicSegments([node])) {
      exportedPathOf.set(segment.id, index);
    }
  });

  // The default sequence drives every leaf, not every top-level entry: a group
  // is not itself drivable.
  const seq: SequenceItem[] =
    sequence && sequence.length
      ? sequence
      : atomicSegments(lines).map((ln) => ({ kind: "path", lineId: ln.id }));

  // Split the sequence the way the code export does: consecutive segments of
  // one top-level path become one follow() call, and a wait ends it.
  type Step =
    | { kind: "wait"; item: Extract<SequenceItem, { kind: "wait" }> }
    | { kind: "run"; segments: FlatSegment[] };
  const steps: Step[] = [];
  let previousPath: number | null = null;
  seq.forEach((item) => {
    if (item.kind === "wait") {
      steps.push({ kind: "wait", item });
      previousPath = null;
      return;
    }
    const segment = segmentById.get(item.lineId);
    if (!segment) return; // Skip missing or malformed lines in sequence
    const exportedPath = exportedPathOf.get(item.lineId) ?? -1;
    const last = steps[steps.length - 1];
    if (last?.kind === "run" && previousPath === exportedPath) {
      last.segments.push(segment);
    } else {
      steps.push({ kind: "run", segments: [segment] });
    }
    previousPath = exportedPath;
  });

  // Where the robot actually sits, which does follow execution order.
  let robotPoint: BasePoint = startPoint;
  let firstTravel = true;

  steps.forEach((step) => {
    if (step.kind === "wait") {
      const waitSeconds = msToSeconds(step.item.durationMs);
      if (waitSeconds > 0) {
        timeline.push({
          type: "wait",
          name: step.item.name,
          duration: waitSeconds,
          startTime: currentTime,
          endTime: currentTime + waitSeconds,
          startHeading: currentHeading,
          targetHeading: currentHeading,
          atPoint: robotPoint,
        });
        currentTime += waitSeconds;
      }
      return;
    }

    // --- ROTATION CHECK ---
    // Only where the robot starts from rest. Inside a path it turns while it
    // drives.
    const first = step.segments[0];
    const requiredStartHeading = segmentHeadingAt(pathSegments, first.index, 0);
    if (firstTravel) currentHeading = requiredStartHeading;
    firstTravel = false;
    const diff = Math.abs(
      getAngularDifference(currentHeading, requiredStartHeading),
    );
    if (diff > 0.1) {
      const diffRad = diff * (Math.PI / 180);
      const rotTime = diffRad / settings.aVelocity;
      timeline.push({
        type: "wait",
        duration: rotTime,
        startTime: currentTime,
        endTime: currentTime + rotTime,
        startHeading: currentHeading,
        targetHeading: requiredStartHeading,
        atPoint: first.start,
      });
      currentTime += rotTime;
      currentHeading = requiredStartHeading;
    }

    // --- TRAVEL ---
    // One profile over the whole path, cut at each segment's start and end.
    const totalLength = step.segments.reduce(
      (sum, segment) => sum + segment.curve.length,
      0,
    );
    const profile = motionProfile(totalLength, settings);
    // Fork: the run slows where the heading turns faster than the robot can.
    const starts: number[] = [];
    step.segments.reduce(
      (at, segment) => (starts.push(at), at + segment.curve.length),
      0,
    );
    const turn = turnLimitedTimes(
      profile,
      totalLength,
      (d) => {
        let k = step.segments.length - 1;
        while (k > 0 && starts[k] > d) k--;
        const length = step.segments[k].curve.length;
        const s =
          length > 0 ? Math.min(1, Math.max(0, (d - starts[k]) / length)) : 1;
        return segmentHeadingAt(pathSegments, step.segments[k].index, s);
      },
      settings.aVelocity,
    );
    const timeAt = (d: number) =>
      turn ? timeInTable(turn, d) : timeAtDistance(profile, d);
    const runTime = turn ? turn.times[turn.times.length - 1] : profile.duration;
    const runStart = currentTime;
    let distance = 0;
    step.segments.forEach((segment) => {
      const length = segment.curve.length;
      const segmentStart = timeAt(distance);
      const segmentEnd = timeAt(distance + length);
      segmentLengths.push(length);
      segmentTimes.push(segmentEnd - segmentStart);
      timeline.push({
        type: "travel",
        duration: segmentEnd - segmentStart,
        startTime: runStart + segmentStart,
        endTime: runStart + segmentEnd,
        lineId: segment.line.id,
        run: {
          totalLength,
          totalTime: runTime,
          startDistance: distance,
          startTime: segmentStart,
          ...(turn ? { turn } : {}),
        },
      });
      distance += length;
      currentHeading = segmentHeadingAt(pathSegments, segment.index, 1);
      robotPoint = segment.line.endPoint;
    });
    currentTime = runStart + runTime;
  });

  const totalTime = currentTime;
  const totalDistance = segmentLengths.reduce((sum, length) => sum + length, 0);

  return {
    totalTime,
    segmentTimes,
    totalDistance,
    timeline,
  };
}

/**
 * Calculate playback timing with path-level visualization pauses.
 * These waits are intentionally kept out of calculatePathTime so exports keep
 * using the trajectory's actual timing.
 */
export function calculateVisualizationPathTime(
  startPoint: StartPose,
  lines: Path[],
  settings: Settings,
  sequence?: SequenceItem[],
): TimePrediction {
  const waitsByPathId = new Map(
    flattenToAtomicSegments(startPoint, lines).map(({ line }) => [
      line.id,
      Math.max(0, Number(line.waitAfterMs) || 0),
    ]),
  );
  const baseSequence =
    sequence && sequence.length
      ? sequence
      : atomicSegments(lines).map((line) => ({
          kind: "path" as const,
          lineId: line.id,
        }));
  const visualizationSequence: SequenceItem[] = [];

  baseSequence.forEach((item) => {
    visualizationSequence.push(item);
    if (item.kind === "path") {
      const durationMs = waitsByPathId.get(item.lineId) ?? 0;
      if (durationMs > 0) {
        visualizationSequence.push({
          kind: "wait",
          id: `visualization-wait-${item.lineId}`,
          name: "Path visualization wait",
          durationMs,
        });
      }
    }
  });

  return calculatePathTime(startPoint, lines, settings, visualizationSequence);
}

export function formatTime(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0.0s";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}s`;
  }
  return `${seconds.toFixed(1)}s`;
}

export function getAnimationDuration(
  totalTime: number,
  speedFactor: number = 1.0,
): number {
  return (totalTime * 1000) / speedFactor;
}

/** Seconds into a turn table at which `distance` inches are covered. */
function timeInTable(
  table: { distances: number[]; times: number[] },
  distance: number,
): number {
  const { distances, times } = table;
  const last = distances.length - 1;
  if (distance <= 0) return 0;
  if (distance >= distances[last]) return times[last];
  let low = 0;
  let high = last;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (distances[mid] <= distance) low = mid;
    else high = mid;
  }
  const span = distances[high] - distances[low];
  const f = span > 0 ? (distance - distances[low]) / span : 1;
  return times[low] + f * (times[high] - times[low]);
}
