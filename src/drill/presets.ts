/**
 * Our two robots' numbers for the drill, read from the simulator's one robot file,
 * `sim/src/sim/robots/mona-shores.json`. That file is data only and gives a source for every value:
 * biobuzz code, or our Fruitport and Belding logs (read_logs.py `cycles`, `steps`, `legs` and the
 * drive series). The drill drives the same robot the simulator calibrates.
 *
 * `NOT_YET_IN_MODEL` holds the few drill values the file does not carry yet, each with its source.
 * They move into the file as the sim chat adds them.
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

/**
 * Drill values mona-shores.json does not carry yet. From the same logs (events/2026-11-fruitport
 * and -belding, 104 logs of 19429 and 95 of 20245).
 */
const NOT_YET_IN_MODEL: Record<
  TeamNumber,
  {
    gardenYield: number[];
    gateToLastOfFourS: number;
    gateOpenAfterLastS: number;
  }
> = {
  // GardenGather cards (steps): 19429 8 gathers brought 0: 5, 1: 3; 20245 3 gathers brought 1, 2 and 3.
  // Gate to the last of four (steps, four-ball volleys): 19429 2.04 s (n=14); 20245 2.08 s (n=36).
  // Gate open after the last ball: the TeleOp four-ball feed (cycles) less that: 19429 3.00 s, 20245 2.50 s.
  19429: {
    gardenYield: [5, 3],
    gateToLastOfFourS: 2.04,
    gateOpenAfterLastS: 0.96,
  },
  20245: {
    gardenYield: [0, 1, 1, 1],
    gateToLastOfFourS: 2.08,
    gateOpenAfterLastS: 0.42,
  },
};

/** Counts by value from the file's `{ "0": n, "1": n, ... }`. */
function counts(byValue: Record<string, number>): number[] {
  const out: number[] = [];
  for (const [k, v] of Object.entries(byValue)) out[Number(k)] = v;
  return Array.from(out, (v) => v ?? 0);
}

const mid = (r: number[]) => (r[0] + r[1]) / 2;

function preset(team: TeamNumber): RobotPreset {
  const s = model.shared,
    r = model.robots[String(team) as "19429" | "20245"],
    extra = NOT_YET_IN_MODEL[team];
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
      yield: extra.gardenYield,
    },
    spinUpFromIdleS: r.firePressToGateS.value,
    spinUpWhenSpunS: r.autoGateWaitS.value,
    gateToFirstBallS: mid(s.launch.gateToFirstBallS.value),
    gateToLastOfFourS: extra.gateToLastOfFourS,
    gateOpenAfterLastS: extra.gateOpenAfterLastS,
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
