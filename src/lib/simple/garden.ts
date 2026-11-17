/**
 * The two GARDENs, and the robot's GARDEN gather as the preview draws it. Game-specific on purpose,
 * like flowers.ts: next season this file is rewritten.
 *
 * The gather is biobuzz `opmodes/GardenGather` (on the same sequence as the FLOWER pick, its
 * `GrabRoutine`), and every number here is one of its own or of `GardenFieldPoints`. Change one,
 * change the other. An Auto's card (what the preview shows) does not line up first: it drives in to
 * the nearest GARDEN from wherever it is called, the intake on, dwells, and drives back to where it
 * started.
 *   red's GARDEN: gather at (8.5, 9.5) facing the audience, lined up at (8.5, 19.1), 9.6 in
 *     behind it (GardenFieldPoints.RED, from the robot's size: the nose at the audience wall, the
 *     side 0.4 in off the red-side wall); blue's is red's turned half a turn;
 *   only a GARDEN on the robot's own half (an Auto may not cross the centre line), within 45 in
 *     (maxRangeIn; 45 since 14 Nov 2026, the whole half before). An Auto's card starts at the team
 *     spot GARDEN_STAGING, about 13 in away;
 *   in at the robot's top path speed (inSpeed 1.0, since 14 Nov 2026), back at 0.8 (backSpeed,
 *     since 6 Nov 2026), dwell 0.4 s (dwellMs, since 6 Nov 2026): the dwell's cap, which a full
 *     lane ends sooner.
 *   the drive in aims past the gather pose: 1 in deeper (extraDepthIn) and 2 in nearer the side
 *     wall (laneTowardWallIn), more than the robot can go, so the walls stop it: the preview holds
 *     the frame's side on the side wall and the nose where the gather pose puts it, on the audience
 *     wall (biobuzz AutoSim.gardenInPose does the same). For the team's robot it ends at (8, 9.5);
 *   the drive in curves over to the side wall first (curveToWall): a Pedro curve whose control
 *     point is on the side wall's line into the corner, level with the start (wallControl). The
 *     drive back is that run backwards (curveBackOut): up the side wall, then over to the start.
 *     Both turn linearly from one end's heading to the other's, as a straight path would.
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
/** GardenGather.extraDepthIn: how much deeper than the gather pose the drive in aims, inches. */
const EXTRA_DEPTH_IN = 1.0;
/** GardenGather.laneTowardWallIn: and how much nearer the side wall (with curveToWall, on). */
const LANE_TOWARD_WALL_IN = 2.0;
/** The frame's half width when the caller gives none: 20245's, as GardenFieldPoints has it. */
const HALF_WIDTH_IN = 8.1;
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
  /** Half the robot's width, inches: how near the side wall its centre gets. */
  halfWidthIn = HALF_WIDTH_IN,
): { garden: Garden; seconds: number; motions: MotionRecord[] } | null {
  const garden = gardenFor(from.x, from.y);
  if (!garden) return null;
  const aim = inAim(garden);
  const stops = (p: BasePoint) => stoppedByWalls(garden, p, halfWidthIn);
  const to = { ...stops(aim), headingDeg: aim.headingDeg };
  // In: toward the side wall first, then down it into the corner. Back: that run backwards, from
  // where the walls stopped the robot.
  const inPoints = curve(from, wallControl(from, aim), aim).map(stops);
  const home = { ...from, headingDeg: aim.headingDeg };
  const backPoints = curve(to, wallControl(home, to), from);
  let inS = legSeconds(lengthOf(inPoints), IN_SPEED);
  let backS = legSeconds(lengthOf(backPoints), BACK_SPEED);
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
    points: BasePoint[],
    a: { headingDeg: number },
    b: { headingDeg: number },
    seconds: number,
  ) => {
    // A Pedro path turning linearly from one heading to the other: drawn as short straight pieces,
    // each at its own heading, the robot easing in and out over the whole leg.
    const turn = ((b.headingDeg - a.headingDeg + 540) % 360) - 180;
    for (let i = 0; i < PIECES; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const step = seconds / PIECES;
      records.push({
        cardId,
        t0: t,
        t1: t + step,
        motion: line(p0, p1, step, a.headingDeg + turn * ((i + 0.5) / PIECES)),
      });
      t += step;
    }
  };
  leg(inPoints, from, to, inS);
  records.push({
    cardId,
    t0: t,
    t1: t + dwellS,
    motion: line(to, to, dwellS, to.headingDeg),
  });
  t += dwellS;
  leg(backPoints, to, from, backS);
  return { garden, seconds: t - t0, motions: records };
}

/** The short straight pieces a leg is drawn as. */
const PIECES = 8;

/**
 * Where the drive in aims (GardenGather.inPose): the gather pose, EXTRA_DEPTH_IN deeper along its
 * heading and LANE_TOWARD_WALL_IN to the robot's right, the side wall for both alliances.
 */
function inAim(garden: Garden): { x: number; y: number; headingDeg: number } {
  const g = garden.gather;
  const rad = (g.headingDeg * Math.PI) / 180;
  return {
    x:
      g.x +
      EXTRA_DEPTH_IN * Math.cos(rad) +
      LANE_TOWARD_WALL_IN * Math.sin(rad),
    y:
      g.y +
      EXTRA_DEPTH_IN * Math.sin(rad) -
      LANE_TOWARD_WALL_IN * Math.cos(rad),
    headingDeg: g.headingDeg,
  };
}

/**
 * A point the robot is driven to, held where the walls stop it in the GARDEN's corner (biobuzz
 * AutoSim.gardenInPose): the frame's side on the side wall, and no deeper than the gather pose,
 * which has the nose on the audience (or back) wall.
 */
function stoppedByWalls(
  garden: Garden,
  p: BasePoint,
  halfWidthIn: number,
): BasePoint {
  const red = garden.gather.x < C;
  return red
    ? { x: Math.max(p.x, halfWidthIn), y: Math.max(p.y, garden.gather.y) }
    : {
        x: Math.min(p.x, FIELD_SIZE - halfWidthIn),
        y: Math.min(p.y, garden.gather.y),
      };
}

/**
 * GardenGather.wallControl: the point on the line through `to` along its heading (the side wall's
 * line into the corner) that is level with `from`.
 */
function wallControl(
  from: BasePoint,
  to: { x: number; y: number; headingDeg: number },
): BasePoint {
  const rad = (to.headingDeg * Math.PI) / 180;
  const along =
    (from.x - to.x) * Math.cos(rad) + (from.y - to.y) * Math.sin(rad);
  return { x: to.x + along * Math.cos(rad), y: to.y + along * Math.sin(rad) };
}

/** A curve from `a` through the control point to `b`, as PIECES + 1 points, eased in and out. */
function curve(a: BasePoint, control: BasePoint, b: BasePoint): BasePoint[] {
  const ease = (u: number) => u * u * (3 - 2 * u);
  const points: BasePoint[] = [];
  for (let i = 0; i <= PIECES; i++) {
    const u = ease(i / PIECES);
    const v = 1 - u;
    points.push({
      x: v * v * a.x + 2 * v * u * control.x + u * u * b.x,
      y: v * v * a.y + 2 * v * u * control.y + u * u * b.y,
    });
  }
  return points;
}

function lengthOf(points: BasePoint[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++)
    length += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y,
    );
  return length;
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
