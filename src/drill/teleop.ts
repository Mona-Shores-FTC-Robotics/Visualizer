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
import { BALL, FIELD, HIVE, TIP_LOAD } from "./vendor/biobuzz-sim/config";
import type { Alliance, CellSide } from "./vendor/biobuzz-sim/hive";
import type { Sim } from "./vendor/biobuzz-sim/world";
import { Controls, type PadRead } from "./controls";
import { IN, drawCount, type RobotPreset } from "./presets";

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
const LAUNCHER_TRIM_STEP = 25 / 1595;
const LAUNCHER_TRIM_FINE_STEP = 10 / 1595;
const AIM_TRIM_STEP_DEG = 1.5;
const AIM_TRIM_FINE_STEP_DEG = 0.5;
const RESET_HOLD_S = 0.5;
const UNJAM_EJECT_S = 0.4;

export type TurretMode = "AIM" | "LOCKED";
type Routine =
  | {
      kind: "pick";
      phase: "drive" | "work";
      flower: string;
      until: number;
      due: number[];
      start: number;
    }
  | {
      kind: "gather";
      phase: "drive" | "work";
      until: number;
      due: number[];
      start: number;
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
  private routineSticks = { armed: false };
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
      this.say(`Launcher ${this.operatorSpin ? "spinning up" : "idle"}`, now);
    }
    const fine = c.held("FINE_TRIM");
    if (c.on("LAUNCHER_TRIM_UP"))
      this.launcherTrim += fine ? LAUNCHER_TRIM_FINE_STEP : LAUNCHER_TRIM_STEP;
    if (c.on("LAUNCHER_TRIM_DOWN"))
      this.launcherTrim -= fine ? LAUNCHER_TRIM_FINE_STEP : LAUNCHER_TRIM_STEP;
    if (c.on("LAUNCHER_TRIM_RESET")) this.launcherTrim = 0;
    if (c.on("TRIM_LEFT"))
      this.aimTrimDeg += fine ? AIM_TRIM_FINE_STEP_DEG : AIM_TRIM_STEP_DEG;
    if (c.on("TRIM_RIGHT"))
      this.aimTrimDeg -= fine ? AIM_TRIM_FINE_STEP_DEG : AIM_TRIM_STEP_DEG;
    if (c.on("TRIM_RESET")) {
      this.aimTrimDeg = 0;
      this.launcherTrim = 0;
    }
    if (c.on("FLOWER_STICK"))
      this.say("FLOWER stick toggled (Cross runs it itself)", now);

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
    const fireHeld = c.held("CHASSIS_AIM");
    this.firePress = fireHeld && !this.fireHeldWas;
    if (this.firePress) {
      const spun =
        this.operatorSpin &&
        now - this.spinSince >= this.preset.spinUpFromIdleS;
      this.readyAt =
        now +
        (spun ? this.preset.spinUpWhenSpunS : this.preset.spinUpFromIdleS);
      this.arcCancelled = false;
    }
    if (!fireHeld) this.readyAt = Infinity;
    this.fireHeldWas = fireHeld;
    if (this.operatorSpin && this.spinSince === -Infinity) this.spinSince = now;
    if (!this.operatorSpin) this.spinSince = -Infinity;

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
    this.updateRoutine(c, now, leftStick || rightStick);

    // --- drive --------------------------------------------------------------------------------
    const vmax = this.preset.topSpeedInPerS * IN;
    let target: { vx: number; vz: number; w: number };
    if (this.routine) target = this.routineDrive(now);
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
    const acc = this.preset.accelInPerS2 * IN * dt;
    const dvx = target.vx - this.vel.vx,
      dvz = target.vz - this.vel.vz,
      dv = Math.hypot(dvx, dvz);
    const k = dv > acc ? acc / dv : 1;
    this.vel.vx += dvx * k;
    this.vel.vz += dvz * k;
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
    this.intakeFilter =
      unjam || this.routine?.phase === "work" ? "none" : "all";

    // --- the feed ---------------------------------------------------------------------------------
    const aimed = Math.abs(wrap180(aim.deg - this.turretDeg)) <= tol;
    const arcOk =
      !this.flag("enforceFiringArc", true) ||
      !this.preset.enforceFiringArc ||
      insideArc ||
      this.turretMode === "LOCKED";
    const arcTurnDone = !this.arcTurning;
    if (!this.gate) {
      if (
        fireHeld &&
        now >= this.readyAt &&
        aimed &&
        arcOk &&
        arcTurnDone &&
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
      if (!fireHeld) this.gate = false;
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
    b.retryAt = sim.simTime + 1; // as the simulator's own launch: not taken back in on its way out
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
    b.retryAt = sim.simTime + 1;
  }

  // ---------------------------------------------------------------------- routines

  private updateRoutine(c: Controls, now: number, sticksMoved: boolean) {
    const pickHeld = c.held("FLOWER_PICK");
    const gatherHeld = c.held("GARDEN_GATHER");
    const r = this.routine;
    if (r) {
      const held = r.kind === "pick" ? pickHeld : gatherHeld;
      // FreshSticks: a stick still moving from the drive up to the press counts once it centres.
      if (!sticksMoved) this.routineSticks.armed = true;
      if (!held || (sticksMoved && this.routineSticks.armed)) {
        this.say(
          `${r.kind === "pick" ? "FLOWER pick" : "GARDEN gather"} stopped (${held ? "sticks moved" : "released"})`,
          now,
        );
        this.routine = null;
        return;
      }
      if (r.phase === "work") {
        while (r.due.length && now >= r.due[0]) {
          r.due.shift();
          if (r.kind === "pick") this.takeFromFlower(r.flower);
          else this.takeFromGarden();
        }
        if (now >= r.until) {
          this.say(
            `${r.kind === "pick" ? "FLOWER pick" : "GARDEN gather"} done`,
            now,
          );
          this.routine = null;
        }
      }
      return;
    }
    if (c.on("FLOWER_PICK")) this.startPick(now, sticksMoved);
    else if (c.on("GARDEN_GATHER")) this.startGather(now, sticksMoved);
  }

  /** The FLOWER pick's square-up spot: facing the FLOWER, the intake against it. */
  private flowerSpot(id: string): { x: number; z: number; heading: number } {
    const f = this.sim.flowers.find((q) => q.id === id)!;
    const n =
      Math.abs(f.x) > Math.abs(f.z)
        ? { x: -Math.sign(f.x), z: 0 }
        : { x: 0, z: -Math.sign(f.z) };
    const off = FIELD.flowerHalfSize + (this.preset.frameIn / 2) * IN + 0.01;
    return {
      x: f.x + n.x * off,
      z: f.z + n.z * off,
      heading: Math.atan2(n.z, -n.x),
    };
  }

  private gardenSpot(): { x: number; z: number; heading: number } {
    const g = FIELD.garden[this.sim.alliance];
    const cz = (g[2] + g[3]) / 2,
      sz = Math.sign(cz);
    const half = (this.preset.frameIn / 2) * IN;
    // Facing the wall the GARDEN is on, the intake toward it.
    return {
      x: (g[0] + g[1]) / 2,
      z: sz * (FIELD.half - half - 0.02),
      heading: Math.atan2(-sz, 0),
    };
  }

  private startPick(now: number, sticksMoved: boolean) {
    const p = this.sim.robot.translation();
    let best: { id: string; d: number } | null = null;
    for (const f of this.sim.flowers) {
      const d = Math.hypot(f.x - p.x, f.z - p.z);
      if (d < 1.0 && (!best || d < best.d)) best = { id: f.id, d };
    }
    if (!best) {
      this.say("FLOWER pick: no FLOWER within reach", now);
      return;
    }
    this.routineSticks.armed = !sticksMoved;
    this.routine = {
      kind: "pick",
      phase: "drive",
      flower: best.id,
      until: Infinity,
      due: [],
      start: now,
    };
  }

  private startGather(now: number, sticksMoved: boolean) {
    const s = this.gardenSpot(),
      p = this.sim.robot.translation();
    if (Math.hypot(s.x - p.x, s.z - p.z) > 1.2) {
      this.say("GARDEN gather: drive to our GARDEN first", now);
      return;
    }
    this.routineSticks.armed = !sticksMoved;
    this.routine = {
      kind: "gather",
      phase: "drive",
      until: Infinity,
      due: [],
      start: now,
    };
  }

  /** Drives to the routine's spot; once there, holds still while it works. */
  private routineDrive(now: number): { vx: number; vz: number; w: number } {
    const r = this.routine!;
    if (r.phase === "work") return { vx: 0, vz: 0, w: 0 };
    const s = r.kind === "pick" ? this.flowerSpot(r.flower) : this.gardenSpot();
    const p = this.sim.robot.translation();
    const dx = s.x - p.x,
      dz = s.z - p.z,
      d = Math.hypot(dx, dz);
    const herr = Math.atan2(
      Math.sin(s.heading - this.sim.heading),
      Math.cos(s.heading - this.sim.heading),
    );
    if (d < 0.025 && Math.abs(herr) < rad(4)) {
      const spec =
        r.kind === "pick" ? this.preset.flowerPick : this.preset.gardenGather;
      const n = drawCount(spec.yield, this.rand());
      r.phase = "work";
      r.until = now + spec.seconds;
      r.due = Array.from(
        { length: n },
        (_, i) => now + (spec.seconds * (i + 1)) / (n + 1),
      );
      return { vx: 0, vz: 0, w: 0 };
    }
    const v = Math.min(0.7 * this.preset.topSpeedInPerS * IN, 2.5 * d);
    const w = clamp(
      4 * herr,
      -rad(this.preset.turnRateDegPerS) * 0.6,
      rad(this.preset.turnRateDegPerS) * 0.6,
    );
    return {
      vx: d > 1e-6 ? (dx / d) * v : 0,
      vz: d > 1e-6 ? (dz / d) * v : 0,
      w,
    };
  }

  private takeFromFlower(id: string) {
    const f = this.sim.flowers.find((q) => q.id === id);
    if (
      !f ||
      f.stack[0] !== "pollen" ||
      this.sim.carried.length >= this.preset.laneCapacity
    )
      return;
    f.stack.shift();
    this.sim.carried.push("pollen");
  }

  private takeFromGarden() {
    const sim = this.sim,
      g = FIELD.garden[sim.alliance];
    if (sim.carried.length >= this.preset.laneCapacity) return;
    const p = sim.robot.translation();
    let best: { id: number; d: number } | null = null;
    for (const b of sim.balls.values()) {
      if (b.kind !== "pollen") continue;
      const q = b.body.translation();
      if (
        q.y > 0.12 ||
        q.x < g[0] - 0.1 ||
        q.x > g[1] + 0.1 ||
        q.z < g[2] - 0.15 ||
        q.z > g[3] + 0.1
      )
        continue;
      const d = Math.hypot(q.x - p.x, q.z - p.z);
      if (!best || d < best.d) best = { id: b.id, d };
    }
    if (!best) return;
    const b = sim.balls.get(best.id)!;
    sim.world.removeRigidBody(b.body);
    sim.balls.delete(b.id);
    sim.carried.push("pollen");
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
          : this.fireHeldWas || this.operatorSpin
            ? "SPINNING UP"
            : "IDLE",
      gateOpen: this.gate,
      lane: this.sim.carried.length,
      routine: this.routine
        ? `${this.routine.kind === "pick" ? "FLOWER pick" : "GARDEN gather"}: ${this.routine.phase === "drive" ? "squaring up" : "picking"}`
        : null,
      arcTurning: this.arcTurning,
      chassisAiming: this.chassisAiming,
      aimTrimDeg: this.aimTrimDeg,
      launcherTrim: this.launcherTrim,
      slow: this.slow,
      note: this.note,
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

/** The load in our raised CELL past its tipping weight, in POLLEN. */
export function pastTippingPollen(sim: Sim): number {
  return Math.max(0, sim.cellLoad(sim.alliance) - TIP_LOAD.threshold);
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
