/**
 * The four FLOWERs, and which one a robot is lined up to pick from. Game-specific on purpose, like
 * lib/ladder/plays.ts: next season this file is rewritten.
 *
 * Positions are biobuzz `localization/FlowerFieldPoints` (the official field model): each FLOWER's
 * centre is 2.71 in off a wall and 47.36 in along it, and the other two are those two turned half
 * a turn about the field centre. A robot picks facing the FLOWER's wall, its centre 12.15 in from
 * the FLOWER's centre (where R-Quals drove for the far FLOWER).
 */
import { FIELD_SIZE } from "../../config/defaults";
import type { BasePoint } from "../../types";
import type { Motion } from "../auto/motion";
import type { MotionRecord } from "../auto/simulate";

export interface Flower {
  name: string;
  x: number;
  y: number;
  /** The heading, degrees, that points a robot's front at the FLOWER's wall. */
  facingDeg: number;
}

const OFF_WALL = 2.71;
const ALONG = 47.36;
const S = FIELD_SIZE;

export const FLOWERS: Flower[] = [
  { name: "WALL FLOWER", x: OFF_WALL, y: ALONG, facingDeg: 180 },
  { name: "FAR FLOWER", x: ALONG, y: S - OFF_WALL, facingDeg: 90 },
  { name: "blue WALL FLOWER", x: S - OFF_WALL, y: S - ALONG, facingDeg: 0 },
  { name: "blue FAR FLOWER", x: S - ALONG, y: OFF_WALL, facingDeg: 270 },
];

/** From the robot's centre to the FLOWER's centre while picking, inches. */
export const PICK_REACH_IN = 12.15;

/** How far out a robot may stage and still be lined up, inches from the FLOWER's centre. */
export const STAGE_MAX_IN = 48;

/** How far the robot's heading may be off the FLOWER's facing, degrees. */
const FACING_TOLERANCE_DEG = 25;

/** How far the FLOWER may be off the robot's centre line, inches. */
const SIDEWAYS_TOLERANCE_IN = 6;

const angleOff = (a: number, b: number) =>
  Math.abs(((a - b + 540) % 360) - 180);

/**
 * The FLOWER straight ahead of a robot at (x, y) facing `headingDeg`: within reach, the robot
 * turned to its wall, and the FLOWER on its centre line. Null when none is.
 */
export function flowerAhead(
  x: number,
  y: number,
  headingDeg: number,
): Flower | null {
  const rad = (headingDeg * Math.PI) / 180;
  let best: Flower | null = null;
  let bestAhead = Infinity;
  for (const flower of FLOWERS) {
    if (angleOff(headingDeg, flower.facingDeg) > FACING_TOLERANCE_DEG) continue;
    const dx = flower.x - x;
    const dy = flower.y - y;
    const ahead = dx * Math.cos(rad) + dy * Math.sin(rad);
    const sideways = Math.abs(-dx * Math.sin(rad) + dy * Math.cos(rad));
    if (ahead < PICK_REACH_IN - 2 || ahead > STAGE_MAX_IN) continue;
    if (sideways > SIDEWAYS_TOLERANCE_IN) continue;
    if (ahead < bestAhead) {
      best = flower;
      bestAhead = ahead;
    }
  }
  return best;
}

/**
 * The FLOWER a spot at (x, y) is lined up to pick from: on the FLOWER's approach line, within
 * staging distance. A new spot there faces the FLOWER; any other spot keeps the robot's heading.
 */
export function flowerLinedUp(x: number, y: number): Flower | null {
  return (
    FLOWERS.find((flower) => flowerAhead(x, y, flower.facingDeg) === flower) ??
    null
  );
}

/** Where the robot's centre is while it picks `flower`, facing its wall. */
export function pickPose(flower: Flower): {
  x: number;
  y: number;
  headingDeg: number;
} {
  const rad = (flower.facingDeg * Math.PI) / 180;
  return {
    x: flower.x - PICK_REACH_IN * Math.cos(rad),
    y: flower.y - PICK_REACH_IN * Math.sin(rad),
    headingDeg: flower.facingDeg,
  };
}

/**
 * The preview's picture of a PickFlower that lasts `busy` seconds from `t0`, for a robot at
 * `from` lined up with `flower`: it drives straight in to the pick pose in the first quarter,
 * holds there for the middle half, and backs out to where it was in the last quarter. The time is
 * the command's own (its typical seconds), so the clock is the same with or without the picture.
 */
export function pickMotions(
  cardId: string,
  from: { x: number; y: number; headingDeg: number },
  flower: Flower,
  t0: number,
  busy: number,
): MotionRecord[] {
  const at = pickPose(flower);
  const start = { x: from.x, y: from.y };
  const end = { x: at.x, y: at.y };
  const leg = busy / 4;
  return [
    {
      cardId,
      t0,
      t1: t0 + leg,
      motion: easedLine(start, end, leg, from.headingDeg),
    },
    {
      cardId,
      t0: t0 + leg,
      t1: t0 + busy - leg,
      motion: easedLine(end, end, busy - 2 * leg, from.headingDeg),
    },
    {
      cardId,
      t0: t0 + busy - leg,
      t1: t0 + busy,
      motion: easedLine(end, start, leg, from.headingDeg),
    },
  ];
}

/** A straight drive over `seconds`, easing in and out, holding `headingDeg`. */
function easedLine(
  from: BasePoint,
  to: BasePoint,
  seconds: number,
  headingDeg: number,
): Motion {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  return {
    samples: [from, to],
    distances: [0, length],
    length,
    seconds,
    headingDeg,
    distanceAt: (time: number) => {
      if (!(seconds > 0)) return length;
      const u = Math.max(0, Math.min(1, time / seconds));
      return length * u * u * (3 - 2 * u);
    },
  };
}
