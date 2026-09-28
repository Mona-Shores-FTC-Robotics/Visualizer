import type { BasePoint, Settings } from "../../types";
import {
  calculateMotionProfileTime,
  motionProfileDistanceAt,
} from "../../utils/timeCalculator";
import { getCurvePoint } from "../../utils/math";
import type { NamedPoint, RoutineDef } from "./types";

/**
 * A drive that is not one of the project's paths (a routine's pattern, a
 * straight line to a point), timed on the same rest-to-rest profile the app
 * uses for paths.
 */
export interface Motion {
  samples: BasePoint[];
  distances: number[];
  length: number;
  seconds: number;
  /** Held heading in degrees, or null to face along the motion. */
  headingDeg: number | null;
  distanceAt: (time: number) => number;
}

export function motionAlong(
  samples: BasePoint[],
  settings: Settings,
  headingDeg: number | null,
): Motion {
  const distances = [0];
  for (let i = 1; i < samples.length; i++) {
    distances.push(
      distances[i - 1] +
        Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y),
    );
  }
  const length = distances[distances.length - 1] ?? 0;
  const profiled =
    settings.maxVelocity !== undefined && settings.maxAcceleration !== undefined;
  const speed = Math.max(1e-6, (settings.xVelocity + settings.yVelocity) / 2);
  const seconds =
    length <= 1e-9
      ? 0
      : profiled
        ? calculateMotionProfileTime(
            length,
            settings.maxVelocity,
            settings.maxAcceleration,
            settings.maxDeceleration,
          )
        : length / speed;
  return {
    samples,
    distances,
    length,
    seconds,
    headingDeg,
    distanceAt: (time: number) => {
      if (seconds <= 0) return length;
      const t = Math.max(0, Math.min(time, seconds));
      return profiled
        ? motionProfileDistanceAt(
            t,
            length,
            settings.maxVelocity,
            settings.maxAcceleration,
            settings.maxDeceleration,
          )
        : (length * t) / seconds;
    },
  };
}

export function straightMotion(
  from: BasePoint,
  to: BasePoint,
  settings: Settings,
): Motion {
  return motionAlong([from, to], settings, null);
}

/** The point `distance` inches along the motion, and the heading there. */
export function poseAlong(motion: Motion, distance: number): { x: number; y: number; headingDeg: number } {
  const { samples, distances } = motion;
  if (samples.length === 0) return { x: 0, y: 0, headingDeg: motion.headingDeg ?? 0 };
  if (samples.length === 1) return { ...samples[0], headingDeg: motion.headingDeg ?? 0 };
  const target = Math.max(0, Math.min(distance, motion.length));
  let i = 1;
  while (i < samples.length - 1 && distances[i] < target) i++;
  const a = samples[i - 1];
  const b = samples[i];
  const span = distances[i] - distances[i - 1];
  const within = span > 1e-9 ? (target - distances[i - 1]) / span : 0;
  const tangent = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  return {
    x: a.x + (b.x - a.x) * within,
    y: a.y + (b.y - a.y) * within,
    headingDeg: motion.headingDeg ?? tangent,
  };
}

// --- routines -----------------------------------------------------------------

export interface Placement {
  x: number;
  y: number;
  facingDeg: number;
  mirror: boolean;
}

/** A routine point (forward, left from its start) on the field. */
export function placePoint(
  forward: number,
  left: number,
  placement: Placement,
): BasePoint {
  const h = (placement.facingDeg * Math.PI) / 180;
  const l = placement.mirror ? -left : left;
  return {
    x: placement.x + forward * Math.cos(h) - l * Math.sin(h),
    y: placement.y + forward * Math.sin(h) + l * Math.cos(h),
  };
}

export interface PlacedSegment {
  start: BasePoint;
  control: BasePoint | null;
  end: BasePoint;
}

/** The routine's pattern as field segments, starting at the placement. */
export function placeRoutine(routine: RoutineDef, placement: Placement): PlacedSegment[] {
  let previous: BasePoint = { x: placement.x, y: placement.y };
  return routine.steps.map((step) => {
    const segment: PlacedSegment = {
      start: previous,
      control: step.control ? placePoint(step.control[0], step.control[1], placement) : null,
      end: placePoint(step.forward, step.left, placement),
    };
    previous = segment.end;
    return segment;
  });
}

const SAMPLES_PER_STEP = 30;

export function segmentSamples(segments: PlacedSegment[], origin: BasePoint): BasePoint[] {
  const samples: BasePoint[] = [origin];
  for (const segment of segments) {
    const points = segment.control
      ? [segment.start, segment.control, segment.end]
      : [segment.start, segment.end];
    for (let k = 1; k <= SAMPLES_PER_STEP; k++) {
      samples.push(getCurvePoint(k / SAMPLES_PER_STEP, points));
    }
  }
  return samples;
}

export function placementAt(
  points: Record<string, NamedPoint>,
  at: string,
  facingDeg: number,
  mirror: boolean,
): Placement | null {
  const point = points[at];
  if (!point) return null;
  return { x: point[0], y: point[1], facingDeg, mirror };
}

import { minDistanceToPolygon, pointInPolygon } from "../../utils/geometry";
import type { Shape } from "../../types";
import { FIELD_SIZE } from "../../config";

export interface FitCheck {
  ok: boolean;
  problems: string[];
  /** Smallest gap between the robot and a wall along the pattern, in inches. */
  wallMargin: number;
}

/**
 * Whether a robot `robotSize` inches across can drive these field points:
 * clear of the walls and of every keep-out shape.
 */
export function checkFit(samples: BasePoint[], shapes: Shape[], robotSize: number): FitCheck {
  const half = robotSize / 2;
  let wallMargin = Infinity;
  let worstWall: { side: string; by: number } | null = null;
  const hits = new Set<string>();
  for (const point of samples) {
    const sides: [string, number][] = [
      ["left", point.x - half],
      ["right", FIELD_SIZE - half - point.x],
      ["bottom", point.y - half],
      ["top", FIELD_SIZE - half - point.y],
    ];
    for (const [side, margin] of sides) {
      wallMargin = Math.min(wallMargin, margin);
      if (margin < 0 && (!worstWall || -margin > worstWall.by)) worstWall = { side, by: -margin };
    }
    for (const shape of shapes) {
      if ((shape.vertices?.length ?? 0) < 3) continue;
      const inside = pointInPolygon([point.x, point.y], shape.vertices);
      if (inside || minDistanceToPolygon([point.x, point.y], shape.vertices) < half) {
        hits.add(shape.name || "a keep-out zone");
      }
    }
  }
  const problems: string[] = [];
  if (worstWall) problems.push(`hits the ${worstWall.side} wall by ${worstWall.by.toFixed(1)} in`);
  hits.forEach((name) => problems.push(`runs into ${name}`));
  return { ok: problems.length === 0, problems, wallMargin };
}
