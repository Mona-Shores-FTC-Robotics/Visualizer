/**
 * Fork: where a launch goes with the turret locked straight ahead, as it is for a whole Auto (the
 * robot's Autos never turn the turret): the robot's heading is the aim. Every number here is
 * biobuzz's own; change one, change the other.
 *
 *   the target is our CELL at the robot's end of the field (TurretAim.nearEndCell): on the audience
 *     side of the HIVEs' axle (HiveFieldPoints.AXLE_Y_IN, the field's centre line) the AUDIENCE
 *     CELL, past it the SCORING CELL;
 *   a CELL's row is at our HIVE's x (HiveFieldPoints.hiveX: the centre less half of
 *     HiveGeometry.HIVE_CENTER_TO_CENTER_IN, 25.5, for red) and 12.34 in from the axle, between the
 *     raised row (13.10) and the lowered one (11.58), which aim within a fraction of a degree;
 *   the turret's axis sits 3.33 in behind the robot's centre and 2.68 in to its right
 *     (TurretSubsystem.turretForwardIn -3.33, turretLeftIn -2.68);
 *   a shot is on when the heading is within 3 degrees (PathEndSettle.aimToleranceDeg,
 *     TeleOpConfig.aimToleranceDeg).
 */
import { FIELD_SIZE } from "../../config/defaults";
import type { Alliance } from "../auto/types";

const CENTRE = FIELD_SIZE / 2;
const HIVE_CENTRE_TO_CENTRE_IN = 25.5;
const ROW_FROM_AXLE_IN = (13.1 + 11.58) / 2;
const TURRET_FORWARD_IN = -3.33;
const TURRET_LEFT_IN = -2.68;
/** The turret's axis from the robot's centre, inches: ahead (negative: behind) and to its left. */
export const TURRET_AXIS = {
  forwardIn: TURRET_FORWARD_IN,
  leftIn: TURRET_LEFT_IN,
};
/** A CELL takes a shot from within this of square to the HIVE, degrees (FlowerVolley.maxOffSquareDeg). */
export const MAX_OFF_SQUARE_DEG = 26;
/** The launcher's speed table's nearest measured row, inches (LaunchSpeedTable.row1RangeIn). */
export const MIN_MEASURED_RANGE_IN = 42.4;
/** A raised CELL's row from the axle (HiveFieldPoints.UP_ROW_FROM_AXLE_IN): what an Auto launch spot aims at. */
const RAISED_ROW_FROM_AXLE_IN = 13.1;
/** How far off the CELL a launch may face and still be on, degrees. */
export const AIM_TOLERANCE_DEG = 3;

/** The heading that points the turret at (tx, ty) from a robot centred at (x, y), radians. */
function aimAt(x: number, y: number, tx: number, ty: number): number {
  // The turret's axis moves as the robot turns, so the heading that aims it is found by settling.
  let th = Math.atan2(ty - y, tx - x);
  for (let i = 0; i < 30; i++) {
    const ax =
      x + TURRET_FORWARD_IN * Math.cos(th) - TURRET_LEFT_IN * Math.sin(th);
    const ay =
      y + TURRET_FORWARD_IN * Math.sin(th) + TURRET_LEFT_IN * Math.cos(th);
    th = Math.atan2(ty - ay, tx - ax);
  }
  return th;
}

/** Whether a team spot is an Auto launch spot: every one named …_AUTO_… is (biobuzz AutoLaunchSpots). */
export function isLaunchSpotName(name: string): boolean {
  return name.includes("_AUTO_");
}

/**
 * The heading an Auto launch spot at (x, y), drawn for RED, faces: the turret, locked, on the
 * raised row of the CELL at its end, as biobuzz's AutoLaunchSpotsTest checks it (within 0.3°).
 * Degrees in [0, 360), to a tenth, as spots.json keeps them.
 */
export function launchSpotHeadingDeg(x: number, y: number): number {
  const ty =
    y < CENTRE
      ? CENTRE - RAISED_ROW_FROM_AXLE_IN
      : CENTRE + RAISED_ROW_FROM_AXLE_IN;
  const deg =
    (aimAt(x, y, CENTRE - HIVE_CENTRE_TO_CENTRE_IN / 2, ty) * 180) / Math.PI;
  return Math.round((((deg % 360) + 360) % 360) * 10) / 10;
}

export interface Aim {
  /** "AUDIENCE" or "SCORING": which of our CELLs the launch is at. */
  cell: "AUDIENCE" | "SCORING";
  /** The heading that puts the turret's line on the CELL, degrees in [0, 360). */
  needDeg: number;
  /** How far the heading is off that, degrees: positive is turned too far counter-clockwise. */
  offDeg: number;
  /** From the turret's axis to the CELL's row, inches. */
  rangeIn: number;
  /** Within the robot's aim tolerance. */
  on: boolean;
}

/** Where a launch from (x, y), facing `headingDeg`, goes with the turret locked. */
export function aimFrom(
  x: number,
  y: number,
  headingDeg: number,
  alliance: Alliance,
): Aim {
  const hiveX =
    alliance === "BLUE"
      ? CENTRE + HIVE_CENTRE_TO_CENTRE_IN / 2
      : CENTRE - HIVE_CENTRE_TO_CENTRE_IN / 2;
  const audience = y < CENTRE;
  const tx = hiveX;
  const ty = audience ? CENTRE - ROW_FROM_AXLE_IN : CENTRE + ROW_FROM_AXLE_IN;
  // The turret's axis moves as the robot turns, so the heading that aims it is found by settling.
  let th = Math.atan2(ty - y, tx - x);
  let ax = x;
  let ay = y;
  for (let i = 0; i < 30; i++) {
    ax = x + TURRET_FORWARD_IN * Math.cos(th) - TURRET_LEFT_IN * Math.sin(th);
    ay = y + TURRET_FORWARD_IN * Math.sin(th) + TURRET_LEFT_IN * Math.cos(th);
    th = Math.atan2(ty - ay, tx - ax);
  }
  const needDeg = ((((th * 180) / Math.PI) % 360) + 360) % 360;
  const offDeg = ((((headingDeg - needDeg) % 360) + 540) % 360) - 180;
  return {
    cell: audience ? "AUDIENCE" : "SCORING",
    needDeg,
    offDeg,
    rangeIn: Math.hypot(tx - ax, ty - ay),
    on: Math.abs(offDeg) <= AIM_TOLERANCE_DEG,
  };
}

/** Where a turret that tracks points from a pose (TurretAimer, by odometry). */
export interface TurretAim {
  cell: "AUDIENCE" | "SCORING";
  /** The turret's angle from the robot's forward, degrees in (-180, 180], counter-clockwise positive. */
  turretDeg: number;
  /** The turret's axis and the CELL's row on the field, inches. */
  axis: { x: number; y: number };
  target: { x: number; y: number };
  /** From the axis to the row, inches. */
  rangeIn: number;
  /** How far the shot is off square to the HIVE, degrees, 0 to 90 (0: straight into the CELL). */
  offSquareDeg: number;
}

/** The turret's aim at our CELL at the robot's end of the field, from (x, y) facing `headingDeg`. */
export function turretAimFrom(
  x: number,
  y: number,
  headingDeg: number,
  alliance: Alliance,
): TurretAim {
  const hiveX =
    alliance === "BLUE"
      ? CENTRE + HIVE_CENTRE_TO_CENTRE_IN / 2
      : CENTRE - HIVE_CENTRE_TO_CENTRE_IN / 2;
  const audience = y < CENTRE;
  const target = {
    x: hiveX,
    y: audience ? CENTRE - ROW_FROM_AXLE_IN : CENTRE + ROW_FROM_AXLE_IN,
  };
  const h = (headingDeg * Math.PI) / 180;
  const axis = {
    x: x + TURRET_FORWARD_IN * Math.cos(h) - TURRET_LEFT_IN * Math.sin(h),
    y: y + TURRET_FORWARD_IN * Math.sin(h) + TURRET_LEFT_IN * Math.cos(h),
  };
  const bearing =
    (Math.atan2(target.y - axis.y, target.x - axis.x) * 180) / Math.PI;
  return {
    cell: audience ? "AUDIENCE" : "SCORING",
    turretDeg: wrap180(bearing - headingDeg),
    axis,
    target,
    rangeIn: Math.hypot(target.x - axis.x, target.y - axis.y),
    offSquareDeg:
      (Math.atan2(Math.abs(target.x - axis.x), Math.abs(target.y - axis.y)) *
        180) /
      Math.PI,
  };
}

/** Degrees into (-180, 180]. */
export function wrap180(deg: number): number {
  const d = ((((deg + 180) % 360) + 360) % 360) - 180;
  return d === -180 ? 180 : d;
}

/** The robot's command that fires from a FLOWER while it picks it (biobuzz FlowerVolley). */
export const PICK_FLOWER_LAUNCH = "PickFlowerLaunch";

/** A stretch of an Auto during which the turret is on the CELL, seconds. */
export interface TurretSpan {
  t0: number;
  t1: number;
}

/**
 * When the robot's own cards turn the turret: a Pick flower and launch aims it for as long as it
 * runs, and from the start of the drive right before it (its approach: biobuzz
 * FlowerVolley.approach), so it has swung round by the FLOWER. Every other card leaves it straight
 * ahead.
 */
export function turretSpans(preview: {
  actions: { command: string; t0: number; t1: number }[];
  drives: { t0: number; t1: number }[];
}): TurretSpan[] {
  return preview.actions
    .filter((action) => action.command === PICK_FLOWER_LAUNCH)
    .map((action) => {
      const before = preview.drives.find(
        (drive) => Math.abs(drive.t1 - action.t0) < 1e-6,
      );
      return { t0: before ? before.t0 : action.t0, t1: action.t1 };
    });
}

/** How long the drawn turret takes to swing onto or off the CELL, seconds: a picture, not a measurement. */
export const TURRET_SWING_S = 0.4;

/**
 * How far onto the CELL the drawn turret is at `t`, 0 (straight ahead) to 1 (on it): 1 while a span
 * holds it there (or always, with `always`: a robot run with BuiltAuto.turretTracks on), ramping
 * over TURRET_SWING_S at each end of a span.
 */
export function turretOnAt(
  t: number,
  spans: TurretSpan[],
  always = false,
): number {
  if (always) return 1;
  let on = 0;
  for (const span of spans) {
    if (t < span.t0 || t > span.t1 + TURRET_SWING_S) continue;
    const up = Math.min(1, (t - span.t0) / TURRET_SWING_S);
    const down = t <= span.t1 ? 1 : 1 - (t - span.t1) / TURRET_SWING_S;
    on = Math.max(on, Math.min(up, down));
  }
  return on;
}

/** The drawn turret's angle at `t`, degrees from the robot's forward: `aimDeg` scaled by {@link turretOnAt}, the short way round. */
export function turretDegAt(
  t: number,
  aimDeg: number,
  spans: TurretSpan[],
  always = false,
): number {
  const on = turretOnAt(t, spans, always);
  return on === 0 ? 0 : aimDeg * on;
}
