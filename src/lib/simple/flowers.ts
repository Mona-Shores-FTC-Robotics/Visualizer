/**
 * The four FLOWERs, and the robot's FLOWER pick as the preview draws it. Game-specific on purpose,
 * like lib/ladder/plays.ts: next season this file is rewritten.
 *
 * Positions are biobuzz `localization/FlowerFieldPoints` (the official field model): each FLOWER's
 * centre is 2.71 in off a wall and 47.36 in along it, and the other two are those two turned half
 * a turn about the field centre.
 *
 * The pick is biobuzz `opmodes/FlowerPicker`, the one routine the driver's D-pad up and an Auto's
 * PickFlower card both run, and every number here is one of its own. Change one, change the other:
 *   the nearest FLOWER within 48 in (maxRangeIn), else it refuses;
 *   approach: a path to 24 in back from the FLOWER, square to it (approachStandoffIn), skipped
 *     when already within 1.5 in and 5° of there (atApproachIn, atApproachDeg);
 *   stick: 0.7 s for the stick to come down (stickDownMs);
 *   push: a path straight in to 12 in from the FLOWER's centre (contactStandoffIn);
 *   dwell: 1.5 s (dwellMs);
 *   back: a path straight back out to the approach pose. So a pick that starts at the approach pose
 *     ends there: the pick spot an Auto drives to.
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

/** FlowerPicker.maxRangeIn: only a FLOWER this close is picked, inches. */
export const MAX_RANGE_IN = 48;
/** FlowerPicker.approachStandoffIn: the pick spot, this far back from the FLOWER's centre. */
export const APPROACH_STANDOFF_IN = 24;
/** FlowerPicker.contactStandoffIn: where the push stops, from the FLOWER's centre. */
export const CONTACT_STANDOFF_IN = 12;
/** FlowerPicker.atApproachIn and atApproachDeg: already at the pick spot. */
export const AT_APPROACH_IN = 1.5;
export const AT_APPROACH_DEG = 5;
/** FlowerPicker.stickDownMs and dwellMs, in seconds. */
const STICK_S = 0.7;
const DWELL_S = 1.5;
/** The preview's speed for an approach path, when one is needed, inches/s: an estimate. */
const APPROACH_IN_PER_S = 30;

const angleOff = (a: number, b: number) =>
  Math.abs(((a - b + 540) % 360) - 180);

/** The FLOWER a pick from (x, y) goes to: the nearest within range, as the robot chooses. */
export function flowerFor(x: number, y: number): Flower | null {
  let best: Flower | null = null;
  let bestRange = MAX_RANGE_IN;
  for (const flower of FLOWERS) {
    const range = Math.hypot(flower.x - x, flower.y - y);
    if (range <= bestRange) {
      best = flower;
      bestRange = range;
    }
  }
  return best;
}

/** A pose `inches` back from the FLOWER's centre, facing it. */
function standoff(flower: Flower, inches: number) {
  const rad = (flower.facingDeg * Math.PI) / 180;
  return {
    x: flower.x - inches * Math.cos(rad),
    y: flower.y - inches * Math.sin(rad),
    headingDeg: flower.facingDeg,
  };
}

/** The pick spot: where a pick starts and ends. */
export function pickSpot(flower: Flower): {
  x: number;
  y: number;
  headingDeg: number;
} {
  return standoff(flower, APPROACH_STANDOFF_IN);
}

/** Where the robot's centre is at the end of the push. */
export function contactPose(flower: Flower): {
  x: number;
  y: number;
  headingDeg: number;
} {
  return standoff(flower, CONTACT_STANDOFF_IN);
}

/** Whether a robot at (x, y, headingDeg) is at `flower`'s pick spot, so the pick skips its approach. */
export function atPickSpot(
  x: number,
  y: number,
  headingDeg: number,
  flower: Flower,
): boolean {
  const spot = pickSpot(flower);
  return (
    Math.hypot(x - spot.x, y - spot.y) <= AT_APPROACH_IN + 0.05 &&
    angleOff(headingDeg, spot.headingDeg) <= AT_APPROACH_DEG
  );
}

/**
 * The FLOWER whose approach line a point is on, for a new spot: within 6 in of the line straight
 * out from the FLOWER, between the contact and the range. A new spot there goes on the pick spot.
 */
export function flowerLinedUp(x: number, y: number): Flower | null {
  for (const flower of FLOWERS) {
    const rad = (flower.facingDeg * Math.PI) / 180;
    const dx = flower.x - x;
    const dy = flower.y - y;
    const out = dx * Math.cos(rad) + dy * Math.sin(rad);
    const sideways = Math.abs(-dx * Math.sin(rad) + dy * Math.cos(rad));
    if (out >= CONTACT_STANDOFF_IN && out <= MAX_RANGE_IN && sideways <= 6)
      return flower;
  }
  return null;
}

/** Seconds of approach a pick from `from` needs before its own time: none at the pick spot. */
export function approachSeconds(
  from: { x: number; y: number; headingDeg: number },
  flower: Flower,
): number {
  if (atPickSpot(from.x, from.y, from.headingDeg, flower)) return 0;
  const spot = pickSpot(flower);
  const turn = angleOff(from.headingDeg, spot.headingDeg) / 180;
  return Math.max(
    0.5,
    Math.hypot(spot.x - from.x, spot.y - from.y) / APPROACH_IN_PER_S + turn,
  );
}

/**
 * The preview's picture of a pick lasting `busy` seconds from `t0`, its approach included: the
 * approach to the pick spot when the robot is not there, the stick coming down, the push in along
 * the FLOWER's line, the dwell, and the back-out to the pick spot. It ends at the pick spot.
 */
export function pickMotions(
  cardId: string,
  from: { x: number; y: number; headingDeg: number },
  flower: Flower,
  t0: number,
  busy: number,
): MotionRecord[] {
  const spot = pickSpot(flower);
  const contact = contactPose(flower);
  const approach = Math.min(busy, approachSeconds(from, flower));
  const pick = busy - approach;
  // The stick and the dwell take their own times; the push and back-out share what is left.
  const fixed = STICK_S + DWELL_S;
  const scale = pick < fixed + 0.4 ? pick / (fixed + 0.4) : 1;
  const stick = STICK_S * scale;
  const dwell = DWELL_S * scale;
  const leg = (pick - stick - dwell) / 2;
  const at = (p: { x: number; y: number }): BasePoint => ({ x: p.x, y: p.y });
  const records: MotionRecord[] = [];
  let t = t0;
  const add = (seconds: number, motion: Motion) => {
    records.push({ cardId, t0: t, t1: t + seconds, motion });
    t += seconds;
  };
  if (approach > 0)
    add(approach, easedLine(at(from), at(spot), approach, null));
  add(stick, easedLine(at(spot), at(spot), stick, spot.headingDeg));
  add(leg, easedLine(at(spot), at(contact), leg, spot.headingDeg));
  add(dwell, easedLine(at(contact), at(contact), dwell, spot.headingDeg));
  add(leg, easedLine(at(contact), at(spot), leg, spot.headingDeg));
  return records;
}

/** A straight drive over `seconds`, easing in and out; `headingDeg` null faces along it. */
function easedLine(
  from: BasePoint,
  to: BasePoint,
  seconds: number,
  headingDeg: number | null,
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
