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
  /** biobuzz #734: a press that stalls short of its spot fires Circle's AIM shot from there. Absent before it. */
  fireOnStall?: boolean;
  stallS?: number;
  stallToleranceIn?: number;
  stallSpeedInPerSec?: number;
  stallTurnDegPerSec?: number;
  stallProgressIn?: number;
  /** The speed table's measured rows: a stall shot only from inside them. */
  stallRangeLowIn?: number;
  stallRangeHighIn?: number;
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

type Phase =
  "IDLE" | "DRIVING" | "HOLDING" | "STALL_FIRING" | "REFUSED" | "ENDED";

/** SpotStall.guarded: NaN or missing is the fallback; held to [lo, hi]. */
const guarded = (
  v: number | undefined,
  fallback: number,
  lo: number,
  hi: number,
) =>
  v === undefined || !Number.isFinite(v)
    ? fallback
    : Math.max(lo, Math.min(hi, v));

/**
 * biobuzz `opmodes/SpotStall`: whether a press still driving has stalled short of its spot. Slow
 * (under `slowInPerSec` and `slowTurnDegPerSec`), more than `toleranceIn` from the spot, and closing
 * on it by less than `progressIn` since the slow began, for `stallS`.
 */
export class SpotStall {
  private sinceS = NaN;
  private remainingAtSinceIn = NaN;

  reset() {
    this.sinceS = NaN;
    this.remainingAtSinceIn = NaN;
  }

  update(
    nowS: number,
    remainingIn: number,
    speedInPerSec: number,
    turnDegPerSec: number,
    stallS: number,
    toleranceIn: number,
    slowInPerSec: number,
    slowTurnDegPerSec: number,
    progressIn: number,
  ): boolean {
    const slow =
      remainingIn > toleranceIn &&
      Math.abs(speedInPerSec) < slowInPerSec &&
      Math.abs(turnDegPerSec) < slowTurnDegPerSec;
    if (!slow) {
      this.reset();
      return false;
    }
    if (
      Number.isNaN(this.sinceS) ||
      this.remainingAtSinceIn - remainingIn > progressIn
    ) {
      this.sinceS = nowS;
      this.remainingAtSinceIn = remainingIn;
      return false;
    }
    return nowS - this.sinceS >= stallS;
  }
}

/** What a stalled press asks the TeleOp: may Circle's AIM shot fire from here (null), or why not; and its range. */
export interface StallShot {
  refusal(): string | null;
  rangeIn(): number;
}

/**
 * SpotStall.refusal: why Circle's AIM shot may not fire from where the press stalled, or null. The
 * turret must be aiming, the robot short of the centre line, the range inside the speed table's
 * measured rows, and the aim inside the firing arc (or Circle turns into it).
 */
export function stallRefusal(
  turretAims: boolean,
  pastLineIn: number,
  rangeIn: number,
  rangeMeasured: boolean,
  aimInsideArc: boolean,
  turnsIntoArc: boolean,
): string | null {
  if (!turretAims) return "turret not aiming (AIM needed)";
  if (!(pastLineIn < 0)) return "past the centre line";
  if (Number.isNaN(rangeIn)) return "range unknown";
  if (!rangeMeasured) return `out of range (${rangeIn.toFixed(0)} in)`;
  if (!aimInsideArc && !turnsIntoArc) return "aim outside the firing arc";
  return null;
}
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
  private stall = new SpotStall();
  private stallAtS = NaN;
  private stallShortIn = NaN;
  private stallRangeIn = NaN;
  /** How the last press ended, or why it was refused, for the status line. */
  result = "";

  constructor(
    private file: LaunchSpotFile,
    private team: Team,
    private alsoFires: boolean,
    /** Circle's AIM shot for a press that stalls; null: a stalled press just ends. */
    private stallShot: StallShot | null = null,
  ) {}

  get active(): boolean {
    return this.phase === "DRIVING" || this.phase === "HOLDING";
  }

  /** Stalled short of its spot and handed its shot to Circle's AIM path (biobuzz #734). */
  get firingFromStall(): boolean {
    return this.phase === "STALL_FIRING";
  }

  /** The press owns the robot one way or another: driving, holding, or firing from a stall. */
  get busy(): boolean {
    return this.active || this.firingFromStall;
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
      if (this.busy) this.end(sim, now, "let go");
      this.phase = "IDLE";
      return idle;
    }
    if (this.phase === "IDLE") this.start(sim, now);
    if (!this.busy) return idle;
    // `sticksMoved` is FreshSticks' answer (the TeleOp keeps one for Square).
    if (sticksMoved) {
      this.end(sim, now, "sticks moved");
      return idle;
    }
    // Circle's AIM shot fires from here until Square is let go or a stick moves; the robot stays put.
    if (this.phase === "STALL_FIRING")
      return { drive: null, feed: false, wantsLauncher: this.fires };
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
      } else {
        const f = this.file;
        const timedOut = !(s * 1000 <= f.timeoutMs);
        const lv = sim.robot.linvel();
        const stalled =
          !!f.fireOnStall &&
          this.fires &&
          this.volley !== "FEEDING" &&
          this.stall.update(
            s,
            remaining,
            Math.hypot(lv.x, lv.z) / IN,
            (sim.robot.angvel().y * 180) / Math.PI,
            guarded(f.stallS, 0.6, 0.2, 5),
            guarded(f.stallToleranceIn, 2, 0, 24),
            guarded(f.stallSpeedInPerSec, 3, 0, 20),
            guarded(f.stallTurnDegPerSec, 20, 0, 180),
            guarded(f.stallProgressIn, 1, 0.1, 12),
          );
        if (stalled || timedOut) {
          this.stalled(sim, now, timedOut ? "timed out" : "stalled");
          return this.busy
            ? { drive: null, feed: false, wantsLauncher: this.fires }
            : idle;
        }
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
    if (this.phase === "STALL_FIRING")
      return `Launch spot: STALLED ${this.stallShortIn.toFixed(0)} in short of ${name} · firing from ${this.stallRangeIn.toFixed(0)} in (Circle's shot) · let go to stop`;
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
    this.stallAtS = NaN;
    this.stallShortIn = NaN;
    this.stallRangeIn = NaN;
    this.stall.reset();
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

  /** LaunchSpotDrive.stalled: hand the shot to Circle's AIM path from here, or end with why not. */
  private stalled(sim: Sim, now: number, why: string) {
    if (!this.file.fireOnStall || !this.fires) {
      this.end(sim, now, why);
      return;
    }
    const refusal = this.stallShot
      ? this.stallShot.refusal()
      : "no stall shot here";
    if (refusal !== null) {
      this.end(sim, now, `${why}, ${refusal}`);
      return;
    }
    this.stallAtS = now - this.startS;
    this.stallShortIn = this.remainingIn(sim);
    this.stallRangeIn = this.stallShot!.rangeIn();
    this.volley = "OFF";
    this.phase = "STALL_FIRING";
  }

  private end(sim: Sim, now: number, why: string) {
    const name = this.spotName;
    const s = now - this.startS;
    const fromStall = this.phase === "STALL_FIRING";
    this.result = fromStall
      ? `Last launch spot: ${why} after ${s.toFixed(2)} s, stalled ${this.stallShortIn.toFixed(0)} in short of ${name} at ${this.stallAtS.toFixed(2)} s and fired from ${this.stallRangeIn.toFixed(0)} in (Circle's AIM shot)`
      : this.phase === "DRIVING"
        ? `Last launch spot: ${why} early after ${s.toFixed(2)} s, ${this.remainingIn(sim).toFixed(0)} in short of ${name}`
        : `Last launch spot: ${why} after arriving at ${name} in ${this.arriveS.toFixed(2)} s`;
    if (this.fires)
      this.result += fromStall
        ? "; fired by Circle's AIM shot (stalled)"
        : Number.isNaN(this.feedStartS)
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
