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
 *   the turret's axis sits 3.33 in behind the robot's centre and 1.87 in to its right
 *     (TurretSubsystem.turretForwardIn -3.33, turretLeftIn -1.87);
 *   a shot is on when the heading is within 3 degrees (PathEndSettle.aimToleranceDeg,
 *     TeleOpConfig.aimToleranceDeg).
 */
import { FIELD_SIZE } from "../../config/defaults";
import type { Alliance } from "../auto/types";

const CENTRE = FIELD_SIZE / 2;
const HIVE_CENTRE_TO_CENTRE_IN = 25.5;
const ROW_FROM_AXLE_IN = (13.1 + 11.58) / 2;
const TURRET_FORWARD_IN = -3.33;
const TURRET_LEFT_IN = -1.87;
/** How far off the CELL a launch may face and still be on, degrees. */
export const AIM_TOLERANCE_DEG = 3;

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
