/**
 * Our two robots' numbers for the drill, read from the simulator's one robot file,
 * `sim/src/sim/robots/mona-shores.json`. That file is data only and gives a source for every value:
 * biobuzz code, or our Fruitport and Belding logs (read_logs.py `cycles`, `steps`, `legs` and the
 * drive series). The drill drives the same robot the simulator calibrates.
 *
 * Everything a button does comes from the robot's own controls export instead
 * (`TeamCode/cheat-sheets/controls.json`, see ./controls.ts).
 */
import model from "../../sim/src/sim/robots/mona-shores.json";

export const IN = 0.0254;

export type TeamNumber = 19429 | 20245;

export interface RobotPreset {
  team: TeamNumber;
  name: string;
  topSpeedInPerS: number;
  accelInPerS2: number;
  turnRateDegPerS: number;
  /** Angular acceleration, deg/s²: the turn limiter (`DriveSubsystem.turnAccelPerSec`, 8 /s) times the rate. */
  turnAccelDegPerS2: number;
  frameIn: number;
  intakeWidthIn: number;
  laneCapacity: number;
  /** How long the pick takes, s, and how many pieces each brought (counts by 0, 1, 2, ...). */
  flowerPick: { seconds: number; yield: number[] };
  gardenGather: { seconds: number; yield: number[] };
  /** Fire press to gate open, s: launcher idling, and with the operator's spin-up already on. */
  spinUpFromIdleS: number;
  spinUpWhenSpunS: number;
  gateToFirstBallS: number;
  gateToLastOfFourS: number;
  gateOpenAfterLastS: number;
  /** `RobotDifferences`: 20245's TeleOp feeds outside the firing arc. */
  enforceFiringArc: boolean;
  sources: string[];
}

/** `DriveSubsystem.turnAccelPerSec`: the turn command's limiter, per second. */
const TURN_ACCEL_PER_S = 8;

/** Counts by value from the file's `{ "0": n, "1": n, ... }`. */
function counts(byValue: Record<string, number>): number[] {
  const out: number[] = [];
  for (const [k, v] of Object.entries(byValue)) out[Number(k)] = v;
  return Array.from(out, (v) => v ?? 0);
}

const mid = (r: number[]) => (r[0] + r[1]) / 2;

function preset(team: TeamNumber): RobotPreset {
  const s = model.shared,
    r = model.robots[String(team) as "19429" | "20245"];
  return {
    team,
    name: r.name,
    topSpeedInPerS: r.drive.topSpeedInPerS.value,
    accelInPerS2: r.drive.accelInPerS2.value,
    turnRateDegPerS: r.drive.turnDegPerS.value,
    turnAccelDegPerS2: TURN_ACCEL_PER_S * r.drive.turnDegPerS.value,
    frameIn: s.frameIn.value,
    intakeWidthIn: s.intakeWidthIn.value,
    laneCapacity: s.laneCapacity.value,
    flowerPick: {
      seconds: r.flowerPick.cardS.value,
      yield: counts(r.flowerPick.piecesPerPick.value),
    },
    gardenGather: {
      seconds: r.gardenGather.cardS.value,
      yield: counts(r.gardenGather.piecesPerGather.value),
    },
    spinUpFromIdleS: r.firePressToGateS.value,
    spinUpWhenSpunS: r.autoGateWaitS.value,
    gateToFirstBallS: mid(s.launch.gateToFirstBallS.value),
    gateToLastOfFourS: r.gateToFourthBallS.value,
    gateOpenAfterLastS: r.teleopGateOpenAfterLastBallS.value,
    enforceFiringArc: r.enforceFiringArcTeleOp.value,
    sources: [
      "sim/src/sim/robots/mona-shores.json (each value's source is in the file)",
      "Fruitport and Belding logs (biobuzz events/2026-11-fruitport, events/2026-11-belding)",
    ],
  };
}

export const PRESETS: Record<TeamNumber, RobotPreset> = {
  19429: preset(19429),
  20245: preset(20245),
};

/** A draw from counts by value (`yield`): how many pieces a pick brings. */
export function drawCount(counts: number[], u: number): number {
  const total = counts.reduce((a, b) => a + b, 0);
  let x = u * total;
  for (let i = 0; i < counts.length; i++) {
    x -= counts[i];
    if (x < 0) return i;
  }
  return counts.length - 1;
}
