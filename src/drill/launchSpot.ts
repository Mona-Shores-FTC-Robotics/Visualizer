/**
 * The driver's Square, held: go to launch spot. A port of biobuzz's `LaunchSpots.choose` (which spot)
 * and `LaunchSpotDrive` with its `SpotVolley` (the drive there and the volley on arrival), on the
 * numbers biobuzz exports with the controls (`launchSpots` in `controls.json`, from
 * `LaunchSpotsExport`). The spots themselves are never typed in here: each comes from the file, as
 * drawn and where the button drives for each alliance.
 *
 * - The pick: the robot's half of the field picks LEFT or RIGHT, and the tile row its centre is in
 *   picks the row: against the end wall, the nearest WALL spot; the next row in, the nearest CLOSE
 *   one; the two rows beside the centre line, refused. The HIVE-column spot counts a bias nearer.
 *   Refused more than `maxPastCentreIn` past the centre line.
 * - The drive: one straight path, its heading turned linearly from the start's to the spot's along
 *   the way (Pedro's `Interpolator.linear`), at `speed` of the top speed, within the robot's drive
 *   envelope (`limitDrive`). At the spot it holds there until the button is let go. Letting go,
 *   or a drive stick moved, hands the sticks back; it gives up after `timeoutMs`.
 * - With `goToSpotAlsoFires`, the launcher spins up as the drive starts, and the feed opens once the
 *   robot is at the spot, at speed and settled (each wait capped), or already on the approach
 *   (`gateOnApproach`: near the spot, aimed, at speed). It feeds until the button is let go, through
 *   the TeleOp's own gates (aim, firing arc, NECTAR).
 *
 * Pedro's frame: inches from the red audience corner, x toward blue, y away from the audience,
 * headings counter-clockwise. The simulator's: metres about the centre, X toward blue, Z toward the
 * audience, the same headings (sim/src/sim/robots/routines.ts).
 */
import type { Sim } from "../../sim/src/sim/world";
import {
  driveEnvelope,
  limitDrive,
  type Team,
} from "../../sim/src/sim/robots/mona-shores";

const IN = 0.0254;

export type Row = "WALL" | "CLOSE";
export type Column = "NEAR" | "HIVE" | "FAR";
/** x, y in inches, heading in degrees (Pedro's frame). */
export type PedroPose = [number, number, number];

export interface LaunchSpotFile {
  about: string;
  tileIn: number;
  fieldCentreIn: number;
  axleYIn: number;
  maxPastCentreIn: number;
  wallCentreBiasIn: number;
  closeCentreBiasIn: number;
  closeBackIn: number;
  wallGapIn: number;
  speed: number;
  timeoutMs: number;
  turretForwardIn: number;
  turretLeftIn: number;
  gateOnApproach: boolean;
  maxSpinUpWaitS: number;
  maxSettleWaitS: number;
  settleAimToleranceDeg: number;
  settleSpeedInPerS: number;
  settleTurnDegPerS: number;
  approachWithinIn: number;
  approachTurnDegPerS: number;
  spots: {
    name: string;
    row: Row;
    column: Column;
    left: boolean;
    drawn: PedroPose;
    red: PedroPose;
    blue: PedroPose;
  }[];
  examples: {
    alliance: "RED" | "BLUE";
    x: number;
    y: number;
    spot: string | null;
  }[];
}

export type Spot = LaunchSpotFile["spots"][number];

export type Choice =
  | { spot: Spot; target: PedroPose; distanceIn: number; refusal?: undefined }
  | { spot?: undefined; refusal: string };

/** `LaunchSpots.choose`, the pose always on the field (the simulator's is exact). */
export function chooseSpot(
  f: LaunchSpotFile,
  alliance: "red" | "blue",
  x: number,
  y: number,
): Choice {
  const c = f.fieldCentreIn,
    blue = alliance === "blue";
  const past = blue ? c - x : x - c;
  const reach = f.maxPastCentreIn > 0 ? f.maxPastCentreIn : 0;
  if (!(past < reach))
    return {
      refusal: `robot ${past.toFixed(0)} in past the centre line, more than the ${reach.toFixed(0)} in it may drive back from`,
    };
  const xr = blue ? 2 * c - x : x,
    yr = blue ? 2 * c - y : y;
  const t = f.tileIn;
  const row: Row | null =
    yr < t || yr >= 5 * t ? "WALL" : yr < 2 * t || yr >= 4 * t ? "CLOSE" : null;
  if (!row)
    return {
      refusal:
        "robot on the two tile rows beside the centre line (drive toward an end wall first)",
    };
  // LaunchSpots.leftHalf: red's LEFT CELL is at the scoring end (past the axle), blue's turned.
  const scoringEnd = y >= f.axleYIn;
  const left = blue ? !scoringEnd : scoringEnd;
  const bias = Math.max(
    0,
    (row === "WALL" ? f.wallCentreBiasIn : f.closeCentreBiasIn) || 0,
  );
  let best: Spot | null = null,
    bestIn = Infinity;
  for (const column of ["HIVE", "NEAR", "FAR"] as const) {
    const s = f.spots.find(
      (q) => q.left === left && q.row === row && q.column === column,
    );
    if (!s) continue;
    let d = Math.hypot(s.drawn[0] - xr, s.drawn[1] - yr);
    if (column === "HIVE") d -= bias;
    if (d < bestIn) {
      best = s;
      bestIn = d;
    }
  }
  if (!best) return { refusal: `no ${left ? "LEFT" : "RIGHT"} ${row} spot` };
  const target = blue ? best.blue : best.red;
  return {
    spot: best,
    target,
    distanceIn: Math.hypot(target[0] - x, target[1] - y),
  };
}

/** The simulator's pose (metres, radians) in Pedro's frame (inches, degrees). */
export function toPedro(
  X: number,
  Z: number,
  h: number,
  centreIn = 70.75,
): PedroPose {
  return [X / IN + centreIn, centreIn - Z / IN, (h * 180) / Math.PI];
}

/** A Pedro pose in the simulator's frame. */
export function fromPedro(
  p: PedroPose,
  centreIn = 70.75,
): { x: number; z: number; h: number } {
  return {
    x: (p[0] - centreIn) * IN,
    z: -(p[1] - centreIn) * IN,
    h: (p[2] * Math.PI) / 180,
  };
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const within = (v: number, tol: number) => !(tol > 0) || v <= tol;
const nonNegative = (s: number) => (s > 0 ? s : 0);

type Phase = "IDLE" | "DRIVING" | "HOLDING" | "REFUSED" | "ENDED";
type VolleyPhase = "OFF" | "DRIVING" | "WAITING" | "FEEDING";

/** The drive's arrival, Pedro's path end: within this of the spot, and of its heading. */
const ARRIVE_IN = 1.0;
const ARRIVE_DEG = 2.0;
/** Heading hold: turn rate per radian of heading error, as Pedro's heading PID roughly does. */
const HEADING_GAIN = 6;

export interface SpotStep {
  /** The drive this loop, world m/s and rad/s; null when the button is not driving. */
  drive: { vx: number; vz: number; w: number } | null;
  /** The button's volley asks the feeder to feed this loop. */
  feed: boolean;
  /** The press asks the launcher to spin (driving or holding, with `goToSpotAlsoFires`). */
  wantsLauncher: boolean;
}

/**
 * `LaunchSpotDrive` and its `SpotVolley`: one press of Square, stepped once per loop. `atSpeed` is
 * the launcher at launch speed, which the TeleOp keeps.
 */
export class LaunchSpotDrive {
  phase: Phase = "IDLE";
  private volley: VolleyPhase = "OFF";
  private choice: Choice | null = null;
  private from = { x: 0, z: 0, h: 0 };
  private to = { x: 0, z: 0, h: 0 };
  private startS = 0;
  private arriveS = NaN;
  private arrivedVolleyS = NaN;
  private fires = false;
  /** When the button's feed started, s; NaN before. */
  feedStartS = NaN;
  feedWhy = "";
  /** How the last press ended, or why it was refused, for the status line. */
  result = "";

  constructor(
    private file: LaunchSpotFile,
    private team: Team,
    private alsoFires: boolean,
  ) {}

  get active(): boolean {
    return this.phase === "DRIVING" || this.phase === "HOLDING";
  }

  get spotName(): string | null {
    return this.choice?.spot?.name ?? null;
  }

  /** Where the button drives, the simulator's frame; null when not driving. */
  get target(): { x: number; z: number; h: number } | null {
    return this.active ? this.to : null;
  }

  /** Inches from the robot to the spot. */
  remainingIn(sim: Sim): number {
    const p = sim.robot.translation();
    return Math.hypot(this.to.x - p.x, this.to.z - p.z) / IN;
  }

  step(
    sim: Sim,
    held: boolean,
    sticksMoved: boolean,
    atSpeed: boolean,
    now: number,
    dt: number,
  ): SpotStep {
    const idle: SpotStep = { drive: null, feed: false, wantsLauncher: false };
    if (!held) {
      if (this.active) this.end(sim, now, "let go");
      this.phase = "IDLE";
      return idle;
    }
    if (this.phase === "IDLE") this.start(sim, now);
    if (!this.active) return idle;
    // `sticksMoved` is FreshSticks' answer (the TeleOp keeps one for Square).
    if (sticksMoved) {
      this.end(sim, now, "sticks moved");
      return idle;
    }
    const s = now - this.startS;
    const remaining = this.remainingIn(sim);
    const headingErr = wrap(this.to.h - sim.heading);
    if (this.phase === "DRIVING") {
      if (
        remaining < ARRIVE_IN &&
        Math.abs(headingErr) < (ARRIVE_DEG * Math.PI) / 180
      ) {
        this.phase = "HOLDING";
        this.arriveS = s;
      } else if (!(s * 1000 <= this.file.timeoutMs)) {
        this.end(sim, now, "timed out");
        return idle;
      }
    }
    const drive = this.drive(sim, dt);
    let feed = false;
    if (this.fires) feed = this.updateVolley(sim, now, atSpeed, remaining);
    return { drive, feed, wantsLauncher: this.fires };
  }

  /** The status line: what it is doing, or how the last press ended. */
  line(sim: Sim, now: number): string {
    const name = this.spotName;
    if (this.phase === "DRIVING")
      return `Launch spot: driving to ${name}, ${this.remainingIn(sim).toFixed(0)} in to go · ${(now - this.startS).toFixed(1)} s${this.volleyNote()}`;
    if (this.phase === "HOLDING")
      return `Launch spot: AT ${name}, holding (arrived in ${this.arriveS.toFixed(1)} s)${this.volleyNote()} · let go to drive`;
    return this.result;
  }

  private volleyNote(): string {
    if (!this.fires) return "";
    if (this.volley === "WAITING")
      return " · volley: waiting for speed and settle";
    if (this.volley === "FEEDING") return " · volley: FEEDING, let go to stop";
    return "";
  }

  private start(sim: Sim, now: number) {
    this.startS = now;
    this.arriveS = NaN;
    this.arrivedVolleyS = NaN;
    this.feedStartS = NaN;
    this.feedWhy = "";
    const p = sim.robot.translation();
    const [x, y] = toPedro(p.x, p.z, sim.heading, this.file.fieldCentreIn);
    this.choice = chooseSpot(this.file, sim.alliance, x, y);
    if (this.choice.refusal !== undefined) {
      this.phase = "REFUSED";
      this.result = `Launch spot REFUSED: ${this.choice.refusal}`;
      return;
    }
    this.from = { x: p.x, z: p.z, h: sim.heading };
    this.to = fromPedro(this.choice.target, this.file.fieldCentreIn);
    this.phase = "DRIVING";
    this.fires = this.alsoFires;
    this.volley = this.fires ? "DRIVING" : "OFF";
  }

  private end(sim: Sim, now: number, why: string) {
    const name = this.spotName;
    const s = now - this.startS;
    this.result =
      this.phase === "DRIVING"
        ? `Last launch spot: ${why} early after ${s.toFixed(2)} s, ${this.remainingIn(sim).toFixed(0)} in short of ${name}`
        : `Last launch spot: ${why} after arriving at ${name} in ${this.arriveS.toFixed(2)} s`;
    if (this.fires)
      this.result += Number.isNaN(this.feedStartS)
        ? "; gate never opened by the button"
        : `; gate opened ${(this.feedStartS - this.startS).toFixed(2)} s after the press (${this.feedWhy})`;
    this.volley = "OFF";
    this.phase = "ENDED";
  }

  /**
   * One straight path: along the line to the spot at `speed` of the envelope's top in the direction
   * of travel, braking to arrive, the heading following the path's progress (linear from the
   * start's to the spot's); then holding the spot.
   */
  private drive(sim: Sim, dt: number) {
    const p = sim.robot.translation(),
      h = sim.heading;
    const dx = this.to.x - p.x,
      dz = this.to.z - p.z,
      d = Math.hypot(dx, dz);
    const total = Math.hypot(this.to.x - this.from.x, this.to.z - this.from.z);
    const progress =
      this.phase === "HOLDING" || total < 1e-6
        ? 1
        : Math.min(1, Math.max(0, 1 - d / total));
    const wantH = this.from.h + wrap(this.to.h - this.from.h) * progress;
    // The direction of travel in robot axes sets the envelope (forward (cos h, -sin h)).
    const f = dx * Math.cos(h) - dz * Math.sin(h),
      l = -dx * Math.sin(h) - dz * Math.cos(h);
    const env = driveEnvelope(this.team, Math.atan2(l, f));
    const v = Math.min(
      this.file.speed * env.top,
      Math.sqrt(2 * env.accel * 0.8 * d),
    );
    const want = {
      vx: d > 1e-4 ? (dx / d) * v : 0,
      vz: d > 1e-4 ? (dz / d) * v : 0,
      w: HEADING_GAIN * wrap(wantH - h),
    };
    const lv = sim.robot.linvel();
    return limitDrive(this.team, h, { vx: lv.x, vz: lv.z }, want, dt);
  }

  /** `SpotVolley.update`, with `PathEndSettle`'s settle and approach checks. */
  private updateVolley(
    sim: Sim,
    now: number,
    atSpeed: boolean,
    remainingIn: number,
  ): boolean {
    const f = this.file;
    const lv = sim.robot.linvel();
    const speedIn = Math.hypot(lv.x, lv.z) / IN;
    const turnDeg = Math.abs((sim.robot.angvel().y * 180) / Math.PI);
    const errDeg = Math.abs((wrap(sim.heading - this.to.h) * 180) / Math.PI);
    const settled =
      within(speedIn, f.settleSpeedInPerS) &&
      within(turnDeg, f.settleTurnDegPerS) &&
      within(errDeg, f.settleAimToleranceDeg);
    const arrived = this.phase === "HOLDING";
    if (this.volley === "OFF") return false;
    if (this.volley === "DRIVING") {
      const onApproach =
        f.gateOnApproach &&
        !arrived &&
        f.approachWithinIn > 0 &&
        remainingIn <= f.approachWithinIn &&
        within(errDeg, f.settleAimToleranceDeg) &&
        within(turnDeg, f.approachTurnDegPerS);
      if (!arrived && onApproach && atSpeed) {
        this.feedWhy = "on the approach, at speed";
        this.feedStartS = now;
        this.volley = "FEEDING";
        return true;
      }
      if (!arrived) return false;
      this.arrivedVolleyS = now;
      this.volley = "WAITING";
    }
    if (this.volley === "WAITING") {
      const waited = now - this.arrivedVolleyS;
      if (!atSpeed && waited < nonNegative(f.maxSpinUpWaitS)) return false;
      if (atSpeed && !settled && waited < nonNegative(f.maxSettleWaitS))
        return false;
      this.feedWhy = !atSpeed
        ? "below launch speed (spin-up wait over)"
        : !settled
          ? "before settled (settle wait over)"
          : "at speed, settled";
      this.feedStartS = now;
      this.volley = "FEEDING";
    }
    return true;
  }
}
