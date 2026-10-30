/**
 * The four FLOWERs, and the robot's FLOWER pick as the preview draws it. Game-specific on purpose,
 * like lib/ladder/plays.ts: next season this file is rewritten.
 *
 * Positions are biobuzz `localization/FlowerFieldPoints` (the official field model): each FLOWER's
 * centre is 2.71 in off a wall and 47.36 in along it, and the other two are those two turned half
 * a turn about the field centre.
 *
 * The pick is biobuzz `opmodes/FlowerPicker`, the one routine the driver's D-pad up and an Auto's
 * PickFlower card both run, and every number here is one of its own. Change one, change the other.
 * An Auto's card (what the preview shows) does not line up first: the Auto's drive has put the
 * robot where it picks from.
 *   the nearest FLOWER within 48 in (maxRangeIn); it refuses when that FLOWER is more than 6 in
 *     off the robot's line ahead (aheadToleranceIn) or not far enough ahead to push;
 *   stick: 0.7 s for the stick to come down (stickDownMs);
 *   push: a path straight ahead to 12 in from the FLOWER's centre (contactStandoffIn);
 *   dwell: 2 s, the worst case: the robot's dwell ends by itself from the intake current, typically
 *     after 1.0-1.3 s, but runs to its cap (dwellMs, 2 s) while pieces keep trickling in, and an
 *     Auto's timing plans for that;
 *   back: a path straight back to where the push started. So a pick ends where it started.
 * A pick spot (approachStandoffIn, 24 in out, square to the FLOWER) is where the button lines up
 * to, and where the builder puts a spot clicked on a FLOWER's line.
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
/** FlowerPicker.aheadToleranceIn: how far off the line ahead the FLOWER may be, inches. */
export const AHEAD_TOLERANCE_IN = 6;
/** FlowerPicker.stickDownMs, and dwellMs (the dwell's cap, its worst case), in seconds. */
const STICK_S = 0.7;
const DWELL_S = 2.0;

const angleOff = (a: number, b: number) =>
  Math.abs(((a - b + 540) % 360) - 180);

/**
 * Whether a target at `targetX` is on the same side of the centre line as a robot at `robotX`
 * (GrabRoutine.ownHalf): an Auto may not cross it, so its grabs only go to their own half.
 */
export function ownHalf(robotX: number, targetX: number): boolean {
  const c = FIELD_SIZE / 2;
  return robotX < c === targetX < c;
}

/** The FLOWER an Auto's pick from (x, y) goes to: the nearest in range on its half, as the robot chooses. */
export function flowerFor(x: number, y: number): Flower | null {
  let best: Flower | null = null;
  let bestRange = MAX_RANGE_IN;
  for (const flower of FLOWERS) {
    if (!ownHalf(x, flower.x)) continue;
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

/** What an Auto's pick from a pose does: where its push stops, or why the robot refuses. */
export type PickFrom =
  | {
      ok: true;
      flower: Flower;
      contact: { x: number; y: number };
      offIn: number;
    }
  | { ok: false; flower: Flower | null; why: string };

/** An Auto's pick from (x, y, headingDeg), as FlowerPicker decides it. */
export function pickFrom(x: number, y: number, headingDeg: number): PickFrom {
  const flower = flowerFor(x, y);
  if (!flower)
    return {
      ok: false,
      flower,
      why: `No FLOWER on our side of the centre line within ${MAX_RANGE_IN} in`,
    };
  const rad = (headingDeg * Math.PI) / 180;
  const dx = flower.x - x;
  const dy = flower.y - y;
  const ahead = dx * Math.cos(rad) + dy * Math.sin(rad);
  const offIn = Math.abs(-dx * Math.sin(rad) + dy * Math.cos(rad));
  if (offIn > AHEAD_TOLERANCE_IN)
    return {
      ok: false,
      flower,
      why: `The ${flower.name} is ${offIn.toFixed(1)} in off the robot's line ahead`,
    };
  const drive = ahead - CONTACT_STANDOFF_IN;
  if (!(drive > 0.5))
    return {
      ok: false,
      flower,
      why: `The ${flower.name} is not far enough ahead to push`,
    };
  return {
    ok: true,
    flower,
    contact: { x: x + drive * Math.cos(rad), y: y + drive * Math.sin(rad) },
    offIn,
  };
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

/**
 * The preview's picture of an Auto's pick lasting `busy` seconds from `t0`, from `from`: the stick
 * coming down, the push straight ahead to `contact`, the dwell, and the back-out to `from`, where it
 * ends.
 */
export function pickMotions(
  cardId: string,
  from: { x: number; y: number; headingDeg: number },
  contact: { x: number; y: number },
  t0: number,
  busy: number,
): MotionRecord[] {
  // The stick and the dwell take their own times; the push and back-out share what is left.
  const fixed = STICK_S + DWELL_S;
  const scale = busy < fixed + 0.4 ? busy / (fixed + 0.4) : 1;
  const stick = STICK_S * scale;
  const dwell = DWELL_S * scale;
  const leg = (busy - stick - dwell) / 2;
  const home: BasePoint = { x: from.x, y: from.y };
  const at: BasePoint = { x: contact.x, y: contact.y };
  const h = from.headingDeg;
  const records: MotionRecord[] = [];
  let t = t0;
  const add = (seconds: number, motion: Motion) => {
    records.push({ cardId, t0: t, t1: t + seconds, motion });
    t += seconds;
  };
  add(stick, easedLine(home, home, stick, h));
  add(leg, easedLine(home, at, leg, h));
  add(dwell, easedLine(at, at, dwell, h));
  add(leg, easedLine(at, home, leg, h));
  return records;
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
