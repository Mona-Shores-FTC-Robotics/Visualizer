/**
 * Our two robots' numbers, measured, never guessed. Each says where it came from: the match and
 * practice logs of Fruitport and Belding (biobuzz branches `events/2026-11-fruitport` and
 * `events/2026-11-belding`, 104 logs of 19429 and 95 of 20245), read with biobuzz's
 * `tools/pull-logs/read_logs.py` (`cycles`, `steps`, `legs`) and the drive series
 * (`/Drive/OdometrySpeedInPerSec`, `/Drive/Command*`, `/Odometry/PedroInches/HeadingDeg`), on
 * 23 Nov 2026. The TIP lag is `TeamCode/autos/timing-terms.md` and `FieldSim`'s dwell.
 *
 * Everything a button does comes from the robot's own controls export instead
 * (`TeamCode/cheat-sheets/controls.json`, see ./controls.ts).
 */

export const IN = 0.0254;

export type TeamNumber = 19429 | 20245;

export interface RobotPreset {
  team: TeamNumber;
  name: string;
  /** Top speed at full stick, in/s: the fastest Auto legs (`read_logs.py legs`, peak in/s). */
  topSpeedInPerS: number;
  /**
   * Acceleration, in/s²: the 98th percentile of the rise in odometry speed under a full stick
   * below 35 in/s, across every TeleOp and Auto. The drive's command limiter
   * (`DriveSubsystem.accelPerSec`, exported) is faster than this, so traction and the motors set it.
   */
  accelInPerS2: number;
  /** Turn rate at a full right stick, deg/s: the 98th percentile of heading rate. */
  turnRateDegPerS: number;
  /** Angular acceleration, deg/s², to that rate: the turn limiter (`turnAccelPerSec`, 1/s) times it. */
  turnAccelDegPerS2: number;
  /** The robot's frame, square, in: twice `ResetPositions.WALL_TO_CENTRE_IN` (8.1). */
  frameIn: number;
  /** The intake's width, in: `FieldSim`'s standard design (`INTAKE_HALF_WIDTH_IN` 7). */
  intakeWidthIn: number;
  /** Pieces the lane holds: `LaneTracker.SLOTS`. */
  laneCapacity: number;
  /**
   * A FLOWER pick (Cross held): the Auto's PickFlower card, `read_logs.py steps`, median length in
   * s, and the pieces each brought into the lane, as counts by how many it brought (0, 1, 2, ...).
   */
  flowerPick: { seconds: number; yield: number[] };
  /** A GARDEN gather (Triangle held): the GardenGather card, the same way. Few samples. */
  gardenGather: { seconds: number; yield: number[] };
  /**
   * The driver's fire press to the gate opening, s, launcher idling (`cycles`, "spin-up and aim",
   * the driver's own volleys, median), and with the operator's spin-up already on (the Auto's
   * gate wait after SpinUp, `steps`, median).
   */
  spinUpFromIdleS: number;
  spinUpWhenSpunS: number;
  /**
   * The volley: gate open to the first ball out and to the last of four
   * (`steps`, "gate to last ball", four-ball volleys, median; first ball 0.6 to 0.95 s,
   * timing-terms.md), and the gate staying open after the last ball in TeleOp (`cycles`, the
   * four-ball feeds' median, minus gate to last ball).
   */
  gateToFirstBallS: number;
  gateToLastOfFourS: number;
  gateOpenAfterLastS: number;
  /** `RobotDifferences`: 20245's TeleOp feeds outside the firing arc (mentor, 20 Nov 2026). */
  enforceFiringArc: boolean;
  /** Where the numbers came from, shown on the page. */
  sources: string[];
}

const SHARED_SOURCES = [
  "Fruitport and Belding match and practice logs (biobuzz events/2026-11-fruitport, events/2026-11-belding)",
  "biobuzz tools/pull-logs/read_logs.py cycles, steps, legs",
  "TeamCode/autos/timing-terms.md and FieldSim's TIP dwell",
];

export const PRESETS: Record<TeamNumber, RobotPreset> = {
  19429: {
    team: 19429,
    name: "Infrared",
    topSpeedInPerS: 61,
    accelInPerS2: 82,
    turnRateDegPerS: 299,
    turnAccelDegPerS2: 8 * 299,
    frameIn: 16.2,
    intakeWidthIn: 14,
    laneCapacity: 4,
    // 46 picks, median 3.74 s; brought 0: 18, 1: 16, 2: 7, 3: 5.
    flowerPick: { seconds: 3.74, yield: [18, 16, 7, 5] },
    // 8 gathers, median 4.45 s; brought 0: 5, 1: 3.
    gardenGather: { seconds: 4.45, yield: [5, 3] },
    // 40 driver volleys: 0.60 s (0.43 to 0.70). 78 Auto volleys: 0.29 s.
    spinUpFromIdleS: 0.6,
    spinUpWhenSpunS: 0.29,
    gateToFirstBallS: 0.75,
    // 14 four-ball volleys: 2.04 s (1.60 to 3.54). TeleOp four-ball feeds 3.00 s.
    gateToLastOfFourS: 2.04,
    gateOpenAfterLastS: 0.96,
    enforceFiringArc: true,
    sources: SHARED_SOURCES,
  },
  20245: {
    team: 20245,
    name: "Ultraviolet",
    topSpeedInPerS: 64,
    accelInPerS2: 79,
    turnRateDegPerS: 306,
    turnAccelDegPerS2: 8 * 306,
    frameIn: 16.2,
    intakeWidthIn: 14,
    laneCapacity: 4,
    // 60 picks, median 3.62 s; brought 0: 8, 1: 16, 2: 21, 3: 12, 4: 3.
    flowerPick: { seconds: 3.62, yield: [8, 16, 21, 12, 3] },
    // 3 gathers, median 4.16 s; brought 1, 2 and 3.
    gardenGather: { seconds: 4.16, yield: [0, 1, 1, 1] },
    // 111 driver volleys: 0.40 s (0.20 to 0.90). 92 Auto volleys: 0.41 s.
    spinUpFromIdleS: 0.4,
    spinUpWhenSpunS: 0.4,
    gateToFirstBallS: 0.75,
    // 36 four-ball volleys: 2.08 s (1.63 to 3.54). TeleOp four-ball feeds 2.50 s.
    gateToLastOfFourS: 2.08,
    gateOpenAfterLastS: 0.42,
    enforceFiringArc: false,
    sources: SHARED_SOURCES,
  },
};

/**
 * The TIP: a raised CELL over its tipping weight dwells on its stop, counted from the last piece
 * to land, before the rocker swings (biobuzz `FieldSim`: `MEASURED_TIP_DWELL_SECONDS` 2.0 to 5.1
 * s, skewed by `MEASURED_TIP_DWELL_SKEW` 2.6; well past its weight 1.1 s; at weight up to 2.0
 * POLLEN past it, well past from 2.5). With the swing, last ball out to CELL settled comes to the
 * films' 3.4 to 6.5 s, median 3.9, at weight, and 2.2 to 2.5 s well past (timing-terms.md);
 * `test/drill/tipLag.test.ts` checks the simulator lands there.
 */
export const TIP_DWELL = {
  // FieldSim's 2.0 to 5.1 s, less 0.45 s: this simulator's rocker swings that much slower at
  // weight than FieldSim's filmed 0.58 to 1.12 s, and the lag end to end is what was measured.
  atWeightRangeS: [1.55, 4.65] as const,
  skew: 2.6,
  wellPastS: 1.1,
  atWeightUpToPollen: 2.0,
  wellPastFromPollen: 2.5,
};

/** The dwell for a CELL `pastPollen` over its tipping weight, with `draw` a uniform number in [0, 1). */
export function tipDwellS(pastPollen: number, draw: number): number {
  const d = TIP_DWELL;
  const atWeight =
    d.atWeightRangeS[0] +
    Math.pow(draw, d.skew) * (d.atWeightRangeS[1] - d.atWeightRangeS[0]);
  const wellPast = Math.max(
    0,
    Math.min(
      1,
      (pastPollen - d.atWeightUpToPollen) /
        (d.wellPastFromPollen - d.atWeightUpToPollen),
    ),
  );
  return atWeight + (d.wellPastS - atWeight) * wellPast;
}

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
