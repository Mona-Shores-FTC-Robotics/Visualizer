/**
 * Our TeleOp (biobuzz `opmodes/BasicDriveTeleOp`) on the simulated robot: what each button does,
 * as the robot does it. Which button is which comes from the robot's controls export
 * (./controls.ts); how fast things happen comes from our logs (./presets.ts).
 *
 * - Field-centric drive from the alliance wall, linear sticks with the TeleOp's 0.05 deadband,
 *   L1 slow (`slowSpeed`, which also caps the turn).
 * - The intake runs all the time (`intakeAlwaysOn`) until the lane is full; R2 holds it in, L2
 *   (either pad) unjams.
 * - Circle fires. R1 toggles the turret: AIM, the turret tracks the raised CELL and Circle fires;
 *   LOCKED, the turret holds forward and Circle turns the robot onto the CELL, then fires.
 *   In AIM with `circleTurnsIntoArc`, an aim behind the firing arc turns the robot just far
 *   enough to bring it in (`ArcTurn`), and the feed waits for it.
 * - Cross held picks at the nearest FLOWER; Triangle held gathers at our GARDEN. A stick moved
 *   after the press (`CANCEL_STICK`) hands the robot back.
 * - The operator: Cross spins the launcher up or idles it, L1/R1 trim its speed, the D-pad trims
 *   the aim (Circle held for fine steps), R2/L2 intake and unjam, Square the FLOWER stick.
 */
import { BALL, FIELD, HIVE } from "../../sim/src/sim/config";
import type { Alliance, CellSide } from "../../sim/src/sim/hive";
import type { Sim } from "../../sim/src/sim/world";
import { Controls, type PadRead } from "./controls";
import { IN, type RobotPreset } from "./presets";
import { limitDrive } from "../../sim/src/sim/robots/mona-shores";
import robotModel from "../../sim/src/sim/robots/mona-shores.json";
import { LaunchSpotDrive, type SpotStep } from "./launchSpot";
import { FreshSticks } from "./freshSticks";
import {
  CornerGather,
  FlowerPick,
  GardenGather,
  type RoutineStep,
} from "../../sim/src/sim/robots/routines";

const STICK_DEADBAND = 0.05;
/** `TurretAimer.SWITCH_BAND_IN`: the band about the HIVE's axle line, inches. */
const SWITCH_BAND_IN = 19.75;
const CANCEL_STICK = 0.2;
/** `TurretSubsystem.turretForwardIn`, `turretLeftIn`: where the turret sits on the robot. */
const TURRET_FORWARD_IN = -3.33;
const TURRET_LEFT_IN = -2.68;
/** Launch height above the tiles, m: the simulator's (`DEFAULT_ROBOT.shooter.pollen.offset`). */
const LAUNCH_HEIGHT = 0.38;
/** The simulator's launch spread for POLLEN (`DEFAULT_ROBOT.shooter.pollen`): elevation, speed, yaw. */
const ELEVATION_DEG = 67;
const ELEVATION_STD_DEG = 1.0;
const SPEED_STD = 0.015;
const YAW_STD_DEG = 1.2;
/** `TeleOpConfig.launcherTrimStepTps` over `LauncherSubsystem.targetTicksPerSecond`. */
const RESET_HOLD_S = 0.5;
const UNJAM_EJECT_S = 0.4;
/**
 * The NECTAR gate (biobuzz `NectarReject`, `ColorSensorSubsystem`): a wrong NECTAR at the lane
 * entrance is burst back out (`rejectBurstS`), the intake then stays stopped (`rejectHoldOffS`), and
 * the feed gate stays shut while one may be in the lane, until the lane reads clean after it left
 * (`wrongNectarClearS`) or an eject has run that long (`wrongNectarEjectClearS`).
 */
const REJECT_BURST_S = 0.5;
const REJECT_HOLD_OFF_S = 0.3;
const WRONG_NECTAR_CLEAR_S = 1.0;
const WRONG_NECTAR_EJECT_CLEAR_S = 1.0;

export type TurretMode = "AIM" | "LOCKED";
/** A FLOWER pick or GARDEN gather in progress: master's routine, run by the simulator. */
type Routine = {
  kind: "pick" | "gather";
  r: FlowerPick | GardenGather | CornerGather;
  /** Let go in the dwell or the back-out: it finishes on its own (GrabRoutine.releaseFinishes). */
  finishing?: boolean;
  last: RoutineStep | null;
};

const wrap180 = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;
const deg = (r: number) => (r * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
const deadband = (v: number) => (Math.abs(v) < STICK_DEADBAND ? 0 : v);

export interface TeleOpStatus {
  turretMode: TurretMode;
  turretDeg: number;
  aimDeg: number;
  insideArc: boolean;
  /** Our CELL at the robot's end, which the turret aims at, and whether it is the raised one. */
  nearCell: CellSide;
  nearCellUp: boolean;
  launcher: "IDLE" | "SPINNING UP" | "AT SPEED";
  gateOpen: boolean;
  lane: number;
  routine: string | null;
  arcTurning: boolean;
  chassisAiming: boolean;
  aimTrimDeg: number;
  launcherTrim: number;
  slow: boolean;
  note: string;
  /** "" or what the NECTAR gate is doing: rejecting a wrong one, or holding the feed shut. */
  nectarGate: string;
}

/** One gauss draw. */
function gauss(rand: () => number): number {
  const u = Math.max(1e-12, rand()),
    v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export class TeleOp {
  turretMode: TurretMode;
  /** Turret angle from the robot's forward, deg, + left (counter-clockwise). */
  turretDeg = 0;
  private vel = { vx: 0, vz: 0, w: 0 };
  /** The heading field-centric forward points along (a gyro reset sets it). */
  private fieldForward: number;
  private operatorSpin = false;
  private spinSince = -Infinity;
  private fireHeldWas = false;
  private readyAt = Infinity;
  private gate = false;
  private nextShotAt = 0;
  private emptySince = Infinity;
  private routine: Routine | null = null;
  /** FreshSticks per routine, as BasicDriveTeleOp keeps one for each button. */
  private pickSticks = new FreshSticks();
  private gatherSticks = new FreshSticks();
  private spotSticks = new FreshSticks();
  /** The operator's FLOWER stick toggle (FlowerStickSubsystem.toggle); a grab runs the stick itself. */
  private stickOut = false;
  /** After Square is let go the launcher keeps spinning until this (launcherKeepSpinningAfterSquareS). */
  private squareKeepUntil = -Infinity;
  /** The driver's Square (LaunchSpotDrive); null with a controls file that has no launch spots. */
  private spot: LaunchSpotDrive | null = null;
  private spotStep: SpotStep = {
    drive: null,
    feed: false,
    wantsLauncher: false,
  };
  private spotWas = false;
  private spotStartS = Infinity;
  private lastNow = 0;
  private arcTurning = false;
  private arcCancelled = false;
  private chassisAiming = false;
  private aimTrimDeg = 0;
  private launcherTrim = 0;
  private holdStart: Record<string, number> = {};
  private unjamSince = Infinity;
  private note = "";
  private noteUntil = 0;
  private lastAimDeg = 0;
  private slow = false;
  /** NECTAR launched (ours: the gate never feeds the other alliance's). */
  nectarLaunched = 0;
  private rejectUntil = -Infinity;
  private holdOffUntil = -Infinity;
  private suspectUntil = -Infinity;
  /** Wrong NECTAR rejected at the lane entrance. */
  rejects = 0;
  /** Launches so far: the launcher's shot count. */
  launched = 0;
  /** The time each ball left, s from PLAY. */
  readonly shots: number[] = [];
  /** Each volley (the gate opening): the CELL aimed at, and whether it was up. */
  readonly volleys: { atS: number; cell: CellSide; up: boolean }[] = [];
  /** This loop, for the readout. */
  firePress = false;

  constructor(
    private sim: Sim,
    private preset: RobotPreset,
    private controls: Controls,
    private rand: () => number,
    /** Only gamepad 1: no operator (the turret still aims in AIM). */
    public driverOnly = false,
  ) {
    const t = controls.teleOp;
    this.turretMode = t.startTurretAiming === false ? "LOCKED" : "AIM";
    this.fieldForward = sim.alliance === "red" ? 0 : Math.PI;
    const spots = controls.launchSpots;
    if (spots)
      this.spot = new LaunchSpotDrive(
        spots,
        String(preset.team) as "19429" | "20245",
        t.goToSpotAlsoFires !== false,
      );
    sim.robots[sim.me].velDrive = { vx: 0, vz: 0, w: 0 };
  }

  private get t(): Record<string, number | boolean> {
    return this.controls.teleOp;
  }
  private num(k: string, d: number): number {
    const v = this.t[k];
    return typeof v === "number" ? v : d;
  }
  private flag(k: string, d: boolean): boolean {
    const v = this.t[k];
    return typeof v === "boolean" ? v : d;
  }

  private say(text: string, now: number, s = 2.5) {
    this.note = text;
    this.noteUntil = now + s;
  }

  /** One loop, before the physics step. `now` is seconds from PLAY, `dt` the loop. */
  update(driver: PadRead, operator: PadRead, now: number, dt: number): void {
    const sim = this.sim;
    this.lastNow = now;
    if (this.driverOnly) operator = { lx: 0, ly: 0, rx: 0, held: () => false };
    this.controls.poll(driver, operator);
    const c = this.controls;

    // --- sticks -------------------------------------------------------------------------
    this.slow = c.held("SLOW");
    const scale = clamp(
      this.slow ? this.num("slowSpeed", 0.76) : this.num("normalSpeed", 1),
      0,
      1,
    );
    const fwd = -deadband(driver.ly) * scale;
    const right = deadband(driver.lx) * scale;
    const turn = -deadband(driver.rx) * scale; // + counter-clockwise
    const leftStick =
      Math.abs(fwd) > CANCEL_STICK || Math.abs(right) > CANCEL_STICK;
    const rightStick = Math.abs(turn) > CANCEL_STICK;

    // --- turret mode (driver's R1) ------------------------------------------------------
    if (c.on("TURRET_LOCK")) {
      this.turretMode = this.turretMode === "AIM" ? "LOCKED" : "AIM";
      this.say(
        `Turret ${this.turretMode}${this.turretMode === "AIM" ? " (1 buzz)" : " (2 buzzes)"}`,
        now,
      );
    }

    // --- operator: launcher, trims, stick -------------------------------------------------
    if (c.on("LAUNCHER_TOGGLE")) {
      this.operatorSpin = !this.operatorSpin;
      // LauncherOwner.operatorToggle: during Square's volley the launcher keeps spinning, and
      // idles once Square is let go.
      this.say(
        this.spotStep.wantsLauncher && !this.operatorSpin
          ? "Launcher: kept spinning for Square's volley (idles after Square is let go)"
          : `Launcher ${this.operatorSpin ? "spinning up" : "idle"}`,
        now,
      );
    }
    // The trims: TeleOpConfig's steps (fine with Circle held) and caps, from the controls export.
    // The launcher trim is in ticks/s on the robot: here a fraction of the launch speed.
    const fine = c.held("FINE_TRIM");
    const tps = this.num("launcherTargetTps", 1595);
    const lStep =
      (fine
        ? this.num("launcherTrimFineStepTps", 10)
        : this.num("launcherTrimStepTps", 25)) / tps;
    const lCap = this.num("maxLauncherTrimTps", 150) / tps;
    const aStep = fine
      ? this.num("trimFineStepDeg", 0.5)
      : this.num("trimStepDeg", 1.5);
    const aCap = this.num("maxAimTrimDeg", 180);
    if (c.on("LAUNCHER_TRIM_UP"))
      this.launcherTrim = clamp(this.launcherTrim + lStep, -lCap, lCap);
    if (c.on("LAUNCHER_TRIM_DOWN"))
      this.launcherTrim = clamp(this.launcherTrim - lStep, -lCap, lCap);
    if (c.on("LAUNCHER_TRIM_RESET")) this.launcherTrim = 0;
    if (c.on("TRIM_LEFT"))
      this.aimTrimDeg = clamp(this.aimTrimDeg + aStep, -aCap, aCap);
    if (c.on("TRIM_RIGHT"))
      this.aimTrimDeg = clamp(this.aimTrimDeg - aStep, -aCap, aCap);
    if (c.on("TRIM_RESET")) {
      this.aimTrimDeg = 0;
      this.launcherTrim = 0;
    }
    if (c.on("FLOWER_STICK")) {
      this.stickOut = !this.stickOut;
      this.say(`FLOWER stick ${this.stickOut ? "deployed" : "retracted"}`, now);
    }

    // --- held resets (D-pad, 0.5 s) -----------------------------------------------------------
    for (const a of [
      "RESET_HEADING",
      "RESET_LEFT_CORNER",
      "RESET_RIGHT_CORNER",
      "CAMERA_RELOCALIZE",
      "TURRET_ZERO",
    ]) {
      if (!c.held(a)) {
        delete this.holdStart[a];
        continue;
      }
      this.holdStart[a] ??= now;
      if (now - this.holdStart[a] >= RESET_HOLD_S && this.holdStart[a] > -1) {
        this.holdStart[a] = -Infinity;
        if (a === "RESET_HEADING") {
          this.fieldForward = sim.heading;
          this.say("Gyro reset: forward is where the robot faces", now);
        } else if (a === "TURRET_ZERO") {
          // A trim that corrected the old zero would now aim that far off: the new zero starts clean.
          const hadTrim = this.aimTrimDeg !== 0;
          this.aimTrimDeg = 0;
          this.say(
            `Turret zeroed here${hadTrim ? ", aim trim back to 0" : ""} (the simulated turret never slips)`,
            now,
          );
        } else
          this.say(
            `${c.binding(a)?.description.split(" (")[0] ?? a}: the simulated pose is exact`,
            now,
          );
      }
    }

    // --- aim ------------------------------------------------------------------------------
    const aim = this.aimNow();
    this.lastAimDeg = aim.deg;
    const arcLeft = this.num("turretArcLeftDeg", 90);
    const arcRight = this.num("turretArcRightDeg", 90);
    const rel = wrap180(aim.deg - this.aimTrimDeg);
    const insideArc = rel <= arcLeft && rel >= -arcRight;

    // --- fire (driver's Circle) -------------------------------------------------------------
    // A Square press that fires owns the shot: Circle feeds nothing until it ends (BasicDriveTeleOp.fire).
    const fireHeld = c.held("CHASSIS_AIM") && !this.spotStep.wantsLauncher;
    this.firePress = fireHeld && !this.fireHeldWas;
    if (this.firePress) {
      const spun =
        this.spinning(now) &&
        now - this.spinSince >= this.preset.spinUpFromIdleS;
      this.readyAt =
        now +
        (spun ? this.preset.spinUpWhenSpunS : this.preset.spinUpFromIdleS);
      this.arcCancelled = false;
    }
    if (!fireHeld) this.readyAt = Infinity;
    this.fireHeldWas = fireHeld;
    if (this.spinning(now) && this.spinSince === -Infinity)
      this.spinSince = now;
    if (!this.spinning(now)) this.spinSince = -Infinity;

    // The arc turn (AIM) and the chassis aim (LOCKED): either holds the feed until the shot is on.
    const tol = this.num("aimToleranceDeg", 3);
    let turnCmd = turn;
    this.arcTurning = false;
    this.chassisAiming = false;
    if (fireHeld && !this.routine) {
      if (this.turretMode === "AIM" && this.flag("circleTurnsIntoArc", true)) {
        const margin = Math.min(
          this.num("arcTurnMarginDeg", 10),
          0.5 * Math.min(arcLeft, arcRight),
        );
        let err = 0;
        if (rel > arcLeft - margin) err = rel - (arcLeft - margin);
        else if (rel < -(arcRight - margin)) err = rel + (arcRight - margin);
        const wants = this.arcTurningWas
          ? Math.abs(err) > 0.5 * tol
          : !insideArc;
        if (wants && rightStick && !this.arcCancelled) {
          this.arcCancelled = true;
          this.say("Arc turn cancelled: right stick", now);
        }
        this.arcTurning = wants && !this.arcCancelled;
        if (this.arcTurning)
          turnCmd = this.aimTurnPower(err, 0.5 * tol) * scale;
      } else if (this.turretMode === "LOCKED") {
        const err = wrap180(aim.deg - this.turretDeg);
        this.chassisAiming = !rightStick;
        if (this.chassisAiming)
          turnCmd = this.aimTurnPower(err, 0.5 * tol) * scale;
      }
    }
    this.arcTurningWas = this.arcTurning;

    // --- turret ------------------------------------------------------------------------------
    let want: number;
    if (this.turretMode === "AIM") {
      // An aim behind the arc is held at its edge; the turret never turns through the back.
      want = this.aimTrimDeg + clamp(rel, -arcRight, arcLeft);
    } else want = this.aimTrimDeg;
    const step = this.num("turretTopSpeedDps", 180) * dt;
    this.turretDeg += clamp(wrap180(want - this.turretDeg), -step, step);

    // --- routines: FLOWER pick, GARDEN gather ----------------------------------------------
    this.updateRoutine(c, now, leftStick || rightStick, dt);

    // --- Square: go to launch spot ------------------------------------------------------------
    this.updateSpot(c, now, dt, leftStick || rightStick);

    // --- drive --------------------------------------------------------------------------------
    // Full stick is the forward top speed; `limitDrive` caps it to the robot's envelope in the
    // direction of travel (a mecanum strafes slower than it drives forward), and the change to
    // that direction's acceleration.
    const vmax = this.preset.topSpeedInPerS * IN;
    let target: { vx: number; vz: number; w: number };
    if (this.routine?.last) target = this.routine.last.drive;
    else if (this.spotStep.drive) target = { ...this.spotStep.drive };
    else {
      const a = this.fieldForward;
      const F = { x: Math.cos(a), z: -Math.sin(a) },
        R = { x: Math.sin(a), z: Math.cos(a) };
      let vx = (F.x * fwd + R.x * right) * vmax,
        vz = (F.z * fwd + R.z * right) * vmax;
      const sp = Math.hypot(vx, vz),
        cap = vmax * scale;
      if (sp > cap) {
        vx *= cap / sp;
        vz *= cap / sp;
      }
      target = { vx, vz, w: turnCmd * rad(this.preset.turnRateDegPerS) };
    }
    const lim = limitDrive(
      String(this.preset.team) as "19429" | "20245",
      sim.heading,
      this.vel,
      target,
      dt,
    );
    this.vel.vx = lim.vx;
    this.vel.vz = lim.vz;
    target.w = lim.w;
    const wacc = rad(this.preset.turnAccelDegPerS2) * dt;
    this.vel.w += clamp(target.w - this.vel.w, -wacc, wacc);
    sim.robots[sim.me].velDrive = { ...this.vel };

    // --- intake -------------------------------------------------------------------------------
    const unjam = c.held("DRIVER_UNJAM") || c.held("UNJAM");
    if (unjam) {
      if (this.unjamSince === Infinity) this.unjamSince = now;
      if (now - this.unjamSince >= UNJAM_EJECT_S && sim.carried.length) {
        this.eject();
        this.unjamSince = now;
      }
    } else this.unjamSince = Infinity;
    // An eject run long enough clears a suspect lane.
    if (unjam && now - this.unjamSince >= WRONG_NECTAR_EJECT_CLEAR_S)
      this.suspectUntil = Math.min(this.suspectUntil, now);
    this.nectarGate(now);
    this.intakeFilter =
      unjam ||
      (this.routine?.last && !this.routine.last.intake) ||
      now < this.holdOffUntil
        ? "none"
        : "all";

    // --- the feed ---------------------------------------------------------------------------------
    const aimed = Math.abs(wrap180(aim.deg - this.turretDeg)) <= tol;
    const arcOk =
      !this.flag("enforceFiringArc", true) ||
      !this.preset.enforceFiringArc ||
      insideArc ||
      this.turretMode === "LOCKED";
    const arcTurnDone = !this.arcTurning;
    const suspect = now < this.suspectUntil;
    if (this.gate && suspect) this.gate = false;
    // Square's volley has waited for speed and settle itself (SpotVolley): only the firing arc
    // (and the NECTAR hold) gates it, as on the robot.
    const spotFeed = !fireHeld && this.spotStep.feed;
    const circleOpen =
      fireHeld && now >= this.readyAt && aimed && arcOk && arcTurnDone;
    if (!this.gate) {
      if (
        !suspect &&
        (circleOpen || (spotFeed && arcOk)) &&
        sim.carried.length > 0 &&
        !this.routine
      ) {
        this.gate = true;
        this.volleys.push({
          atS: now,
          cell: this.nearCell,
          up: this.nearCellUp,
        });
        this.nextShotAt = now + this.preset.gateToFirstBallS;
        this.emptySince = Infinity;
      }
    } else {
      if (!fireHeld && !spotFeed) this.gate = false;
      else if (spotFeed && !arcOk)
        this.gate = false; // the arc also stops a feed already going
      else if (now >= this.nextShotAt && sim.carried.length > 0) {
        this.launch(aim, now);
        this.nextShotAt =
          now +
          (this.preset.gateToLastOfFourS - this.preset.gateToFirstBallS) / 3;
      }
      if (sim.carried.length === 0) {
        if (this.emptySince === Infinity) this.emptySince = now;
        if (now - this.emptySince >= this.preset.gateOpenAfterLastS)
          this.gate = false;
      } else this.emptySince = Infinity;
    }
    if (now > this.noteUntil) this.note = "";
  }
  private arcTurningWas = false;
  /** What the simulator's intake takes this loop. */
  intakeFilter: "all" | "none" = "all";

  /**
   * The other alliance's NECTAR in front of the intake: burst it back out, stop the intake for the
   * hold-off, and hold the feed shut until the lane reads clean. The simulator's intake never takes
   * one in (G408); this is what our robot does about it.
   */
  private nectarGate(now: number): void {
    const sim = this.sim,
      c = sim.cfg;
    if (now < this.rejectUntil || now < this.holdOffUntil) return;
    const wrong = sim.alliance === "red" ? "nectar_blue" : "nectar_red";
    for (const b of sim.balls.values()) {
      if (b.kind !== wrong) continue;
      const p = b.body.translation();
      if (p.y > 0.13) continue;
      const r = sim.toRobot(p.x, p.z);
      if (
        r.f < c.length / 2 - 0.01 ||
        r.f > c.length / 2 + c.intake.reach + b.radius ||
        Math.abs(r.l) > c.intake.width / 2
      )
        continue;
      this.rejects++;
      this.rejectUntil = now + REJECT_BURST_S;
      this.holdOffUntil = now + REJECT_BURST_S + REJECT_HOLD_OFF_S;
      this.suspectUntil = now + REJECT_BURST_S + WRONG_NECTAR_CLEAR_S;
      // The burst runs the roller outward: the piece goes back out in front of the robot.
      const th = sim.heading;
      b.body.setLinvel(
        { x: Math.cos(th) * 0.8, y: 0, z: -Math.sin(th) * 0.8 },
        true,
      );
      this.say("Wrong NECTAR: rejected", now);
      return;
    }
  }

  /** `ChassisAimTurn.power`: kP on the error in radians, between the min and max turn. */
  private aimTurnPower(errDeg: number, stopDeg: number): number {
    const max = clamp(this.num("chassisAimMaxTurn", 0.5), 0, 1);
    const min = Math.min(clamp(this.num("chassisAimMinTurn", 0.2), 0, 1), max);
    if (Math.abs(errDeg) <= stopDeg) return 0;
    const t = Math.abs(this.num("chassisAimKp", 1) * rad(errDeg));
    return Math.sign(errDeg) * Math.min(max, Math.max(min, t));
  }

  /**
   * Which of our CELLs the turret aims at: the one at the robot's end of the field, up or down,
   * with a band about the HIVE's axle line so it does not flick between them (`TurretAimer`,
   * `TurretAim.nearEndCell`, `SWITCH_BAND_IN`). Whether it is up is the drive team's call.
   */
  nearCell: CellSide = "audience";

  /** Our CELL at the robot's end is the raised one. */
  get nearCellUp(): boolean {
    return this.sim.hives[this.sim.alliance].upCell === this.nearCell;
  }

  /** The turret's spot on the field and the aim, from the robot's forward, at our CELL at this end. */
  private aimNow(): {
    deg: number;
    ox: number;
    oz: number;
    mouth: { x: number; y: number; z: number };
  } {
    const sim = this.sim,
      p = sim.robot.translation(),
      th = sim.heading;
    const f = TURRET_FORWARD_IN * IN,
      l = TURRET_LEFT_IN * IN;
    const ox = p.x + Math.cos(th) * f - Math.sin(th) * l;
    const oz = p.z - Math.sin(th) * f - Math.cos(th) * l;
    const band = SWITCH_BAND_IN * IN;
    if (p.z > band) this.nearCell = "audience";
    else if (p.z < -band) this.nearCell = "rear";
    const mouth = raisedMouth(sim.alliance, this.nearCell);
    const dx = mouth.x - ox,
      dz = mouth.z - oz;
    const fwd = dx * Math.cos(th) - dz * Math.sin(th);
    const left = -dx * Math.sin(th) - dz * Math.cos(th);
    return { deg: deg(Math.atan2(left, fwd)) + this.aimTrimDeg, ox, oz, mouth };
  }

  /** One ball out of the launcher, at the speed the speed table would pick for the range. */
  private launch(
    aim: { ox: number; oz: number; mouth: { x: number; y: number; z: number } },
    now: number,
  ) {
    const sim = this.sim,
      kind = sim.carried.shift()!;
    if (kind !== "pollen") this.nectarLaunched++;
    const th =
      sim.heading + rad(this.turretDeg) + rad(gauss(this.rand) * YAW_STD_DEG);
    const el = rad(ELEVATION_DEG + gauss(this.rand) * ELEVATION_STD_DEG);
    const radius = kind === "pollen" ? FIELD.pollenRadius : FIELD.nectarRadius;
    const mass = kind === "pollen" ? BALL.pollenMass : BALL.nectarMass;
    const d = Math.hypot(aim.mouth.x - aim.ox, aim.mouth.z - aim.oz);
    const speed =
      solveSpeed(
        d,
        aim.mouth.y - LAUNCH_HEIGHT,
        rad(ELEVATION_DEG),
        radius,
        mass,
      ) *
      (1 + this.launcherTrim) *
      (1 + gauss(this.rand) * SPEED_STD);
    const rv = sim.robot.linvel();
    const fx = Math.cos(th),
      fz = -Math.sin(th);
    const b = sim.spawn(
      kind,
      aim.ox + fx * 0.05,
      LAUNCH_HEIGHT,
      aim.oz + fz * 0.05,
      {
        x: rv.x + speed * Math.cos(el) * fx,
        y: speed * Math.sin(el),
        z: rv.z + speed * Math.cos(el) * fz,
      },
      { x: 0, y: 0, z: 0 },
    );
    b.retryAt = sim.simNow + 1; // as the simulator's own launch: not taken back in on its way out
    this.launched++;
    this.shots.push(now);
  }

  private eject() {
    const sim = this.sim,
      kind = sim.carried.pop()!;
    const th = sim.heading,
      p = sim.robot.translation(),
      reach = (this.preset.frameIn / 2 + 3) * IN;
    const b = sim.spawn(
      kind,
      p.x + Math.cos(th) * reach,
      0.05,
      p.z - Math.sin(th) * reach,
      {
        x: Math.cos(th) * 0.6,
        y: 0,
        z: -Math.sin(th) * 0.6,
      },
    );
    b.retryAt = sim.simNow + 1;
  }

  // ---------------------------------------------------------------------- routines

  /**
   * Cross held: a FLOWER pick; Triangle held: the corner gather (the TeleOp's GARDEN gather button,
   * `GardenGather` with `anyCorner`: the nearest field corner, facing the wall the robot nearly
   * faces). Both are master's routines as the simulator runs them (sim/src/sim/robots/routines.ts):
   * they drive the robot, lower the FLOWER stick and run the intake, and the pieces come in
   * physically. A stick moved after the press (FreshSticks) hands the robot back at once. Letting go
   * hands it back too, but in the dwell or the back-out the grab finishes on its own first, as on
   * the robot (GrabRoutine.releaseFinishes).
   */
  private updateRoutine(
    c: Controls,
    now: number,
    sticksMoved: boolean,
    dt: number,
  ) {
    const pickHeld = c.held("FLOWER_PICK");
    const gatherHeld = c.held("GARDEN_GATHER");
    const stale = this.num("staleStickCancelsAfterS", 0.6);
    const pickMoved = this.pickSticks.moved(pickHeld, sticksMoved, now, stale);
    const gatherMoved = this.gatherSticks.moved(
      gatherHeld,
      sticksMoved,
      now,
      stale,
    );
    const r = this.routine;
    if (r) {
      const held = r.kind === "pick" ? pickHeld : gatherHeld;
      const name = r.kind === "pick" ? "FLOWER pick" : "GARDEN gather";
      // FreshSticks: a stick still held from the drive up to the press counts once it centres, or
      // once it has been held staleStickCancelsAfterS past the press.
      const moved = r.kind === "pick" ? pickMoved : gatherMoved;
      const finishes =
        r.last &&
        (r.last.phase === "dwell" ||
          r.last.phase === "back" ||
          r.last.phase === "raise");
      if (!held && !moved && finishes && !r.finishing) {
        r.finishing = true;
        this.say(`${name}: let go, backing out`, now);
      }
      if (moved || (!held && !r.finishing)) {
        this.say(
          `${name} stopped (${moved ? "sticks moved" : "released"})`,
          now,
        );
        this.endRoutine();
        return;
      }
      r.last = r.r.step(dt);
      this.sim.robots[this.sim.me].stickDown = r.last.stickDown;
      if (r.last.done) {
        this.say(`${name} done`, now);
        this.endRoutine();
      }
      return;
    }
    const start = (kind: "pick" | "gather") => {
      const team = String(this.preset.team) as "19429" | "20245";
      this.routine = {
        kind,
        r:
          kind === "pick"
            ? new FlowerPick(this.sim, team)
            : robotModel.routines.gardenGather.anyCorner.value
              ? new CornerGather(this.sim, team)
              : new GardenGather(this.sim, team),
        last: null,
      };
      this.routine.last = this.routine.r.step(dt);
      this.sim.robots[this.sim.me].stickDown = this.routine.last.stickDown;
      if (this.routine.last.done) {
        // Refused (no corner in range): the robot's own line, nothing moves.
        this.say(this.routine.last.note, now, 4);
        this.endRoutine();
      }
    };
    if (this.spot?.active) return;
    // The operator's stick toggle holds while no grab runs.
    this.sim.robots[this.sim.me].stickDown = this.stickOut;
    if (c.on("FLOWER_PICK")) start("pick");
    else if (c.on("GARDEN_GATHER")) start("gather");
  }

  /**
   * Square held (`LAUNCH_SPOT`): the launch-spot drive and its volley (./launchSpot.ts). Never with a
   * FLOWER pick or GARDEN gather running, and neither starts while it drives. The press spins the
   * launcher up as it starts (with `goToSpotAlsoFires`).
   */
  private updateSpot(
    c: Controls,
    now: number,
    dt: number,
    sticksMoved: boolean,
  ) {
    const none: SpotStep = { drive: null, feed: false, wantsLauncher: false };
    if (!this.spot || !c.binding("LAUNCH_SPOT")) {
      if (c.on("LAUNCH_SPOT"))
        this.say(
          "Square: this controls file has no launch spots (biobuzz's export is older than them)",
          now,
          4,
        );
      this.spotStep = none;
      return;
    }
    const held = c.held("LAUNCH_SPOT") && !this.routine;
    if (held && !this.spotWas) this.spotStartS = now;
    if (!held) this.spotStartS = Infinity;
    // Spinning from before the press, or since it: at speed spinUpFromIdleS after it started.
    const since = Math.min(
      this.spinning(now) ? this.spinSince : Infinity,
      this.spotStartS,
    );
    const spun = now - since >= this.preset.spinUpFromIdleS;
    const moved = this.spotSticks.moved(
      held,
      sticksMoved,
      now,
      this.num("staleStickCancelsAfterS", 0.6),
    );
    const wasActive = this.spot.active,
      wasPhase = this.spot.phase,
      wasFiring = this.spotStep.wantsLauncher;
    this.spotStep = this.spot.step(this.sim, held, moved, spun, now, dt);
    if (wasFiring && !this.spotStep.wantsLauncher) {
      // LauncherOwner.spotPressEnded: letting go is "done shooting", whoever spun it up.
      this.operatorSpin = false;
      this.squareKeepUntil =
        now + clamp(this.num("launcherKeepSpinningAfterSquareS", 3), 0, 10);
    }
    if (this.spot.phase === "REFUSED" && wasPhase !== "REFUSED")
      this.say(this.spot.result, now, 4);
    else if (wasActive && !this.spot.active) this.say(this.spot.result, now, 4);
    this.spotWas = held;
  }

  private endRoutine() {
    // The robot carries on from the routine's speed; the stick comes up.
    if (this.routine?.last) this.vel = { ...this.routine.last.drive };
    this.routine = null;
    this.stickOut = false;
    this.sim.robots[this.sim.me].stickDown = false;
  }

  /**
   * The launcher spins (LauncherOwner): the operator's toggle, Square's press while it fires, and
   * launcherKeepSpinningAfterSquareS after Square is let go.
   */
  private spinning(now: number): boolean {
    return (
      this.operatorSpin ||
      this.spotStep.wantsLauncher ||
      now < this.squareKeepUntil
    );
  }

  status(): TeleOpStatus {
    const arcLeft = this.num("turretArcLeftDeg", 90),
      arcRight = this.num("turretArcRightDeg", 90);
    const rel = wrap180(this.lastAimDeg - this.aimTrimDeg);
    const now = this.readyAt;
    return {
      nearCell: this.nearCell,
      nearCellUp: this.nearCellUp,
      turretMode: this.turretMode,
      turretDeg: this.turretDeg,
      aimDeg: this.lastAimDeg,
      insideArc: rel <= arcLeft && rel >= -arcRight,
      launcher:
        this.gate ||
        (Number.isFinite(now) && this.fireHeldWas && this.sim.time >= now)
          ? "AT SPEED"
          : this.fireHeldWas || this.spinning(this.lastNow)
            ? "SPINNING UP"
            : "IDLE",
      gateOpen: this.gate,
      lane: this.sim.carried.length,
      routine: this.routine
        ? `${this.routine.kind === "pick" ? "FLOWER pick" : "GARDEN gather"}: ${this.routine.last?.phase ?? "starting"}`
        : this.spot?.active
          ? this.spot.line(this.sim, this.lastNow)
          : null,
      arcTurning: this.arcTurning,
      chassisAiming: this.chassisAiming,
      aimTrimDeg: this.aimTrimDeg,
      launcherTrim: this.launcherTrim,
      slow: this.slow,
      note: this.note,
      nectarGate:
        this.sim.time < this.rejectUntil
          ? "rejecting a wrong NECTAR"
          : this.sim.time < this.suspectUntil
            ? "feed held: a wrong NECTAR may be in"
            : "",
    };
  }

  get gateOpen(): boolean {
    return this.gate;
  }
}

/**
 * The launch speed that carries a ball `d` m across and `h` m up at elevation `el`, with the
 * simulator's drag: what the robot's speed table does for a range.
 */
export function solveSpeed(
  d: number,
  h: number,
  el: number,
  radius: number,
  mass: number,
): number {
  const k =
    (0.5 * BALL.airDensity * Math.PI * radius * radius * BALL.dragCd) / mass;
  const heightAt = (s: number) => {
    let x = 0,
      y = 0,
      vx = s * Math.cos(el),
      vy = s * Math.sin(el);
    const dt = 1 / 240;
    for (let i = 0; i < 2400; i++) {
      const sp = Math.hypot(vx, vy);
      vx += -k * sp * vx * dt;
      vy += (-k * sp * vy - 9.81) * dt;
      const nx = x + vx * dt,
        ny = y + vy * dt;
      if (nx >= d) return y + ((ny - y) * (d - x)) / (nx - x);
      x = nx;
      y = ny;
      if (y < -2) return -Infinity;
    }
    return -Infinity;
  };
  let lo = 1,
    hi = 15;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (heightAt(mid) < h) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * The mouth of our CELL at `side` as it sits when raised: where the robot aims whether that CELL is
 * up or down (`TurretAimer` aims at the raised point; the two differ by about an inch and a half).
 * As the simulator's `Hive.mouthCenter`, for a given side.
 */
export function raisedMouth(
  alliance: Alliance,
  side: CellSide,
): { x: number; y: number; z: number } {
  const phi = side === "rear" ? HIVE.tiltLimit : -HIVE.tiltLimit;
  const c = Math.cos(phi),
    s = Math.sin(phi);
  const ly = (HIVE.cellFloorY + HIVE.cellPeakY) / 2 - 0.03;
  const lz = side === "rear" ? -HIVE.cellMouth : HIVE.cellMouth;
  return {
    x: HIVE.pivotX[alliance],
    y: HIVE.pivotY + ly * c - lz * s,
    z: ly * s + lz * c,
  };
}
