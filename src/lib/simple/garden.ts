/**
 * The two GARDENs, and the robot's GARDEN gather as the preview draws it. Game-specific on purpose,
 * like flowers.ts: next season this file is rewritten.
 *
 * The gather is biobuzz `opmodes/GardenGather` (on the same sequence as the FLOWER pick, its
 * `GrabRoutine`), and every number here is one of its own or of `GardenFieldPoints`. Change one,
 * change the other. An Auto's card (what the preview shows) does not line up first: it drives in to
 * the nearest GARDEN's gather pose from wherever it is called, the intake on, dwells, and drives
 * back to where it started.
 *   red's GARDEN: gather at (8.5, 9.5) facing the audience, lined up at (8.5, 19.1)
 *     (GardenFieldPoints); blue's is red's turned half a turn;
 *   only a GARDEN on the robot's own half (an Auto may not cross the centre line), within 160 in
 *     (maxRangeIn);
 *   stick: 0.7 s for the FLOWER stick to come down (stickDownMs) before the drive in. After a drive
 *     card that arrives facing the GARDEN there is no such pause: the robot lowers the stick over
 *     the last 24 in of that drive, once it faces the GARDEN to within 10 degrees
 *     (GardenGather.approach, approachLowerWithinIn, lowerWithinDeg);
 *   in: the stick meets the audience wall first, so the robot stops 3.6 in short of the gather
 *     pose and stands 0.36 s before its stall rule ends the drive in;
 *   dwell 0.4 s (dwellMs), back at 0.8 of the robot's top path speed (backSpeed).
 * The times are fitted to the robot's match logs (36 gathers, 1 to 12 Nov 2026; biobuzz PR "GARDEN
 * gather study"): from GARDEN_STAGING the drive in moved for 0.8 to 1.3 s (median 0.95), the stall
 * wait was 0.27 to 0.47 s, and the back out took 0.61 to 0.67 s at 0.8.
 */
import { FIELD_SIZE } from "../../config/defaults";
import type { BasePoint } from "../../types";
import type { Motion } from "../auto/motion";
import type { MotionRecord } from "../auto/simulate";
import { ownHalf } from "./flowers";

export interface Garden {
  name: string;
  gather: { x: number; y: number; headingDeg: number };
  lineUp: { x: number; y: number; headingDeg: number };
}

const C = FIELD_SIZE / 2;
const turned = (p: { x: number; y: number; headingDeg: number }) => ({
  x: 2 * C - p.x,
  y: 2 * C - p.y,
  headingDeg: (p.headingDeg + 180) % 360,
});
const RED: Garden = {
  name: "red GARDEN",
  gather: { x: 8.5, y: 9.5, headingDeg: 270 },
  lineUp: { x: 8.5, y: 19.1, headingDeg: 270 },
};
export const GARDENS: Garden[] = [
  RED,
  {
    name: "blue GARDEN",
    gather: turned(RED.gather),
    lineUp: turned(RED.lineUp),
  },
];

/** GardenGather.maxRangeIn: the whole half, since in an Auto the centre line is the limit. */
export const MAX_RANGE_IN = 160;
/** GardenGather.inSpeed and backSpeed: fractions of the robot's top path speed. */
const IN_SPEED = 0.5;
const BACK_SPEED = 0.8;
/** GardenGather.dwellMs, in seconds. */
const DWELL_S = 0.4;
/** GardenGather.stickDownMs, in seconds: the stick's swing down, before the drive in may start. */
export const STICK_S = 0.7;
/**
 * GardenGather.approachLowerWithinIn and lowerWithinDeg: on the drive before a gather, the stick
 * comes down once the robot is this close to the drive's end and faces the GARDEN this closely.
 */
export const LOWER_WITHIN_IN = 24;
export const LOWER_WITHIN_DEG = 10;
/**
 * With the stick down the robot stops this far short of the gather pose, inches: the stick is on
 * the audience wall (measured: 32 of the 36 logged gathers, 2.0 to 5.3 in, median 3.6).
 */
const STALL_SHORT_IN = 3.6;
/** Seconds the robot stands at the wall before its stall rule ends the drive in (measured median). */
const STALL_WAIT_S = 0.36;
/**
 * The robot's top path speed, inches/s, and the time a short path spends speeding up and slowing
 * down, fitted so a 9 in drive in takes 0.95 s and a 9 in back out 0.64 s, as the logs have them.
 */
const TOP_IN_PER_S = 60;
const IN_RAMP_S = 0.65;
const BACK_RAMP_S = 0.45;

/** The GARDEN an Auto's gather from (x, y) goes to: the nearest on its half, as the robot chooses. */
export function gardenFor(x: number, y: number): Garden | null {
  let best: Garden | null = null;
  let bestRange = MAX_RANGE_IN;
  for (const garden of GARDENS) {
    if (!ownHalf(x, garden.gather.x)) continue;
    const range = Math.hypot(garden.gather.x - x, garden.gather.y - y);
    if (range <= bestRange) {
      best = garden;
      bestRange = range;
    }
  }
  return best;
}

/** Seconds for a leg of `inches` at `speed` of the robot's top path speed, with its ramp. */
function legSeconds(inches: number, speed: number, rampS: number): number {
  return rampS + inches / (TOP_IN_PER_S * speed);
}

/**
 * An Auto's gather from `from`: the GARDEN it goes to, how long it takes (stick, in, dwell, back),
 * and the preview's picture of it from `t0`. It ends where it started. `stickDownAt` is when the
 * drive card before it lowered the stick on its way in, or null when none did: the stick's wait
 * counts from then.
 */
export function gatherPlan(
  cardId: string,
  from: { x: number; y: number; headingDeg: number },
  t0: number,
  stickDownAt: number | null = null,
): { garden: Garden; seconds: number; motions: MotionRecord[] } | null {
  const garden = gardenFor(from.x, from.y);
  if (!garden) return null;
  const pose = garden.gather;
  const whole = Math.hypot(pose.x - from.x, pose.y - from.y);
  // The robot stops short of the gather pose, the stick on the wall.
  const distance = Math.max(0, whole - STALL_SHORT_IN);
  const reach = whole > 1e-9 ? distance / whole : 0;
  const to = {
    x: from.x + (pose.x - from.x) * reach,
    y: from.y + (pose.y - from.y) * reach,
    headingDeg: pose.headingDeg,
  };
  const stickS =
    stickDownAt === null ? STICK_S : Math.max(0, STICK_S - (t0 - stickDownAt));
  const inS = legSeconds(distance, IN_SPEED, IN_RAMP_S);
  const backS = legSeconds(distance, BACK_SPEED, BACK_RAMP_S);
  const records: MotionRecord[] = [];
  let t = t0;
  if (stickS > 0) {
    records.push({
      cardId,
      t0: t,
      t1: t + stickS,
      motion: line(from, from, stickS, from.headingDeg),
    });
    t += stickS;
  }
  const leg = (
    a: { x: number; y: number; headingDeg: number },
    b: { x: number; y: number; headingDeg: number },
    seconds: number,
  ) => {
    // A Pedro path turning linearly from one heading to the other: drawn as short straight pieces,
    // each at its own heading, the robot easing in and out over the whole leg.
    const pieces = 8;
    const turn = ((b.headingDeg - a.headingDeg + 540) % 360) - 180;
    const ease = (u: number) => u * u * (3 - 2 * u);
    for (let i = 0; i < pieces; i++) {
      const u0 = ease(i / pieces);
      const u1 = ease((i + 1) / pieces);
      const p0 = { x: a.x + (b.x - a.x) * u0, y: a.y + (b.y - a.y) * u0 };
      const p1 = { x: a.x + (b.x - a.x) * u1, y: a.y + (b.y - a.y) * u1 };
      const step = seconds / pieces;
      records.push({
        cardId,
        t0: t,
        t1: t + step,
        motion: line(p0, p1, step, a.headingDeg + turn * ((i + 0.5) / pieces)),
      });
      t += step;
    }
  };
  leg(from, to, inS);
  // Standing at the wall: the stall rule's wait, then the dwell.
  const atWallS = STALL_WAIT_S + DWELL_S;
  records.push({
    cardId,
    t0: t,
    t1: t + atWallS,
    motion: line(to, to, atWallS, to.headingDeg),
  });
  t += atWallS;
  leg(to, from, backS);
  return { garden, seconds: t - t0, motions: records };
}

/** A straight drive at an even speed over `seconds`, holding `headingDeg`. */
function line(
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
    distanceAt: (time: number) =>
      seconds > 0 ? length * Math.max(0, Math.min(1, time / seconds)) : length,
  };
}
