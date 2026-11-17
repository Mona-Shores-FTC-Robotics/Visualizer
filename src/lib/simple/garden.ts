/**
 * The two GARDENs, and the robot's GARDEN gather as the preview draws it. Game-specific on purpose,
 * like flowers.ts: next season this file is rewritten.
 *
 * The gather is biobuzz `opmodes/GardenGather` (on the same sequence as the FLOWER pick, its
 * `GrabRoutine`), and every number here is one of its own or of `GardenFieldPoints`. Change one,
 * change the other. An Auto's card (what the preview shows) does not line up first: it drives in to
 * the nearest GARDEN's gather pose from wherever it is called, the intake on, dwells, and drives
 * back to where it started.
 *   red's GARDEN: gather at (8.5, 9.5) facing the audience, lined up at (8.5, 19.1), 9.6 in
 *     behind it (GardenFieldPoints.RED, from the robot's size: the nose at the audience wall, the
 *     side 0.4 in off the red-side wall); blue's is red's turned half a turn;
 *   only a GARDEN on the robot's own half (an Auto may not cross the centre line), within 45 in
 *     (maxRangeIn; 45 since 14 Nov 2026, the whole half before). An Auto's card starts at the team
 *     spot GARDEN_STAGING, about 13 in away;
 *   in at the robot's top path speed (inSpeed 1.0, since 14 Nov 2026), back at 0.8 (backSpeed,
 *     since 6 Nov 2026), dwell 0.4 s (dwellMs, since 6 Nov 2026): the dwell's cap, which a full
 *     lane ends sooner.
 * Not drawn here: the robot's 1 in past the gather pose (extraDepthIn) and its curve toward the
 * side wall on the way in and back (curveToWall, curveBackOut).
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

/** GardenGather.maxRangeIn: only a GARDEN this close is gathered from, inches. */
export const MAX_RANGE_IN = 45;
/** GardenGather.inSpeed and backSpeed: fractions of the robot's top path speed. */
const IN_SPEED = 1.0;
const BACK_SPEED = 0.8;
/** GardenGather.dwellMs (the dwell's cap), in seconds. */
const DWELL_S = 0.4;
/** The robot's top path speed, inches/s, and the time a short path spends speeding up and slowing down: estimates. */
const TOP_IN_PER_S = 60;
const RAMP_S = 0.4;

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

/** Seconds for a leg of `inches` at `speed` of the robot's top path speed: an estimate. */
function legSeconds(inches: number, speed: number): number {
  return RAMP_S + inches / (TOP_IN_PER_S * speed);
}

/**
 * An Auto's gather from `from`: the GARDEN it goes to, how long it takes (in, dwell, back), and the
 * preview's picture of it from `t0`. It ends where it started.
 */
export function gatherPlan(
  cardId: string,
  from: { x: number; y: number; headingDeg: number },
  t0: number,
  /**
   * The whole step's seconds, when the timing sets it (`gardenGatherS`, capped at the step's limit):
   * the drives in and back keep their time and the gather gets the rest; a step shorter than the
   * two drives shortens them alike, with no gather.
   */
  total?: number,
): { garden: Garden; seconds: number; motions: MotionRecord[] } | null {
  const garden = gardenFor(from.x, from.y);
  if (!garden) return null;
  const to = garden.gather;
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  let inS = legSeconds(distance, IN_SPEED);
  let backS = legSeconds(distance, BACK_SPEED);
  let dwellS = DWELL_S;
  if (total !== undefined && Number.isFinite(total) && total >= 0) {
    const drives = inS + backS;
    if (total >= drives) dwellS = total - drives;
    else {
      const scale = drives > 0 ? total / drives : 0;
      inS *= scale;
      backS *= scale;
      dwellS = 0;
    }
  }
  const records: MotionRecord[] = [];
  let t = t0;
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
  records.push({
    cardId,
    t0: t,
    t1: t + dwellS,
    motion: line(to, to, dwellS, to.headingDeg),
  });
  t += dwellS;
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
