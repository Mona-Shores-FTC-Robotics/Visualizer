/**
 * Fork: the POLLEN a volley fires, as the field draws it: each piece leaves the turret and flies to
 * the CELL at the robot's end (the only one it can score), the last landing as the volley ends, when
 * the preview's HIVE counts them (hiveView.ts). The pieces leave {@link PIECE_GAP_S} apart, the
 * feed's pace; a picture of the volley, not a measurement. The human player's NECTAR is nectar.ts's.
 */
import { volleysIn, oneShotWeight, aimedLeft } from "../timing/model";
import { RED_CELLS } from "./hiveView";
import {
  NECTAR_FLIGHT_S,
  NECTAR_SHOT_COMMAND,
  turretAxisAt,
  type NectarRobot,
} from "./nectar";

/** Between two pieces of a volley leaving the turret, seconds (4 in about 0.75 s). */
export const PIECE_GAP_S = 0.25;

interface Point {
  x: number;
  y: number;
}

/** One piece's flight from the turret to the CELL. */
export interface PieceFlight {
  key: string;
  t0: number;
  t1: number;
  from: Point;
  to: Point;
}

/**
 * When each of a volley's `pieces` lands, for a volley from `t0` to `t1`: the last at `t1`, the
 * others {@link PIECE_GAP_S} apart before it, never before `t0` plus a flight.
 */
export function landTimes(t0: number, t1: number, pieces: number): number[] {
  return Array.from({ length: pieces }, (_, i) =>
    Math.max(
      Math.min(t1, t0 + NECTAR_FLIGHT_S),
      t1 - (pieces - 1 - i) * PIECE_GAP_S,
    ),
  );
}

/** Every POLLEN flight of the robots' previews; `volleyLoad` is a volley's pieces. */
export function pollenFlights(
  robots: NectarRobot[],
  volleyLoad: number,
): PieceFlight[] {
  const out: PieceFlight[] = [];
  robots.forEach((robot, r) => {
    const shots = [...robot.preview.actions, ...robot.preview.launches];
    shots.forEach((shot, s) => {
      if ("unfired" in shot && shot.unfired) return;
      if (shot.command === NECTAR_SHOT_COMMAND) return;
      const pieces =
        volleysIn(shot.command) > 0
          ? Math.max(1, Math.round(volleyLoad * volleysIn(shot.command)))
          : oneShotWeight(shot.command) > 0
            ? 1
            : 0;
      if (!pieces) return;
      landTimes(shot.t0, shot.t1, pieces).forEach((t1, i) => {
        const t0 = Math.max(shot.t0, t1 - NECTAR_FLIGHT_S);
        const cell =
          RED_CELLS[aimedLeft(robot.poseAt(t0).y) ? "left" : "right"];
        // Spread over the CELL's row, as four pieces land side by side.
        const spread = ((i % 4) - 1.5) / 4;
        out.push({
          key: `${r}-${s}-${i}`,
          t0,
          t1,
          from: turretAxisAt(robot, t0),
          to: {
            x: cell.x + cell.w * (0.5 + spread * 0.6),
            y: cell.y + cell.h / 2,
          },
        });
      });
    });
  });
  return out;
}

/** The POLLEN in the air at `t`. */
export function pollenAt(
  flights: PieceFlight[],
  t: number,
): (Point & { key: string })[] {
  const out: (Point & { key: string })[] = [];
  for (const f of flights) {
    if (t < f.t0 - 1e-9 || t >= f.t1) continue;
    const p = (t - f.t0) / Math.max(1e-6, f.t1 - f.t0);
    out.push({
      key: f.key,
      x: f.from.x + (f.to.x - f.from.x) * p,
      y: f.from.y + (f.to.y - f.from.y) * p,
    });
  }
  return out;
}
