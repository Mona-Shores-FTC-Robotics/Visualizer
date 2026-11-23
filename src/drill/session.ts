/**
 * One drill: a 2:00 TeleOp from the start, solo, counting TIPs toward the goal, with the
 * practice readout's split for every cycle and pick-up. No DOM: the page and the tests drive it.
 */
import type RAPIER_NS from "@dimforge/rapier3d-compat";
import { DEFAULT_ROBOT, setSquareSize } from "./vendor/biobuzz-sim/config";
import { DT, NO_INPUT, Sim } from "./vendor/biobuzz-sim/world";
import { Controls, NO_PAD, type ControlsFile, type PadRead } from "./controls";
import { CycleReadout, type CycleResult, type PickUpResult } from "./readout";
import {
  IN,
  PRESETS,
  tipDwellS,
  type RobotPreset,
  type TeamNumber,
} from "./presets";
import { TeleOp, pastTippingPollen } from "./teleop";

export const GOAL_TIPS = 7;
export const TELEOP_S = 120;

export interface TipRecord {
  /** When the CELL settled the other way, s from PLAY. */
  atS: number;
  /** The last ball out before it, s from PLAY (NaN if none), and the lag from it. */
  lastBallS: number;
  lagS: number;
}

export interface RunResult {
  team: TeamNumber;
  mode: "two" | "driver";
  date: string;
  tips: number;
  goal: number;
  /** Seconds from PLAY at which each TIP settled. */
  tipTimes: number[];
  cycles: CycleResult[];
  pickUps: PickUpResult[];
  balls: number;
  /** When the 7th TIP settled, or null. */
  goalAtS: number | null;
}

/** A seeded uniform draw, so a run (and a test) can be repeated. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class DrillSession {
  readonly sim: Sim;
  readonly teleop: TeleOp;
  readonly readout = new CycleReadout();
  readonly preset: RobotPreset;
  readonly tips: TipRecord[] = [];
  private rand: () => number;
  private dwellFrom = NaN;
  private dwellCount = 0;
  private dwellDraw = 0;
  private lastCarried = 0;
  private started = false;
  finished = false;

  constructor(
    rapier: typeof RAPIER_NS,
    controlsFile: ControlsFile,
    public team: TeamNumber,
    public mode: "two" | "driver",
    seed = Date.now() & 0xffff,
  ) {
    this.preset = PRESETS[team];
    this.rand = mulberry32(seed);
    const cfg = structuredClone(DEFAULT_ROBOT);
    setSquareSize(cfg, this.preset.frameIn * IN);
    cfg.intake.width = this.preset.intakeWidthIn * IN;
    cfg.capacity = this.preset.laneCapacity;
    cfg.intake.successP = 1;
    this.sim = new Sim(rapier, cfg, "teleop", seed, {
      flowerPullByPush: false,
    });
    // TeleOp after the Auto shot the preloads: the lane starts empty.
    this.sim.carried = [];
    this.teleop = new TeleOp(
      this.sim,
      this.preset,
      new Controls(controlsFile),
      this.rand,
      mode === "driver",
    );
    this.dwellDraw = this.rand();
  }

  /** Seconds from PLAY. */
  get t(): number {
    return this.sim.time;
  }

  get remainingS(): number {
    return this.started ? Math.max(0, this.sim.clock) : TELEOP_S;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.sim.start();
    this.readout.start(0);
  }

  /** Advances the drill by `seconds` of simulated time with these pads. */
  advance(
    seconds: number,
    driver: PadRead = NO_PAD,
    operator: PadRead = NO_PAD,
  ): void {
    const steps = Math.max(1, Math.round(seconds / DT));
    // The TeleOp's loop runs at about the robot's 50 Hz; the physics at the simulator's 240 Hz.
    for (let i = 0; i < steps; i++) {
      const loop = i % 5 === 0;
      if (loop && this.started && !this.finished)
        this.teleop.update(driver, operator, this.t, DT * 5);
      if (this.finished) this.sim.robots[0].velDrive = { vx: 0, vz: 0, w: 0 };
      this.dwell();
      const tipsBefore = this.sim.hives[this.sim.alliance].tips;
      this.sim.step({
        ...NO_INPUT,
        intake: this.finished ? "none" : this.teleop.intakeFilter,
      });
      if (this.sim.hives[this.sim.alliance].tips > tipsBefore) this.onTip();
      if (loop && this.started) {
        const n = this.sim.carried.length;
        const pieceIn = n > this.lastCarried && !this.finished;
        this.lastCarried = n;
        if (!this.finished)
          this.readout.update(
            this.t,
            pieceIn,
            n >= this.preset.laneCapacity,
            this.teleop.firePress,
            this.teleop.gateOpen,
            this.teleop.launched,
          );
        this.teleop.firePress = false;
      }
      if (this.started && !this.finished && this.sim.phase === "post")
        this.finished = true;
    }
  }

  /** The CELL over its weight dwells on its stop, from the last piece to land (presets.TIP_DWELL). */
  private dwell(): void {
    const a = this.sim.alliance,
      hive = this.sim.hives[a];
    const count = this.sim.cellCount(a);
    if (count > this.dwellCount || Number.isNaN(this.dwellFrom))
      this.dwellFrom = this.sim.simTime;
    this.dwellCount = count;
    hive.held =
      this.sim.simTime - this.dwellFrom <
      tipDwellS(pastTippingPollen(this.sim), this.dwellDraw);
  }

  private onTip(): void {
    const at = this.t;
    const shots = this.teleop.shots.filter((s) => s <= at);
    const last = shots.length ? shots[shots.length - 1] : NaN;
    if (this.started && at <= TELEOP_S + 1e-9)
      this.tips.push({ atS: at, lastBallS: last, lagS: at - last });
    this.dwellDraw = this.rand();
    this.dwellCount = 0;
    this.dwellFrom = NaN;
  }

  result(date = new Date().toISOString()): RunResult {
    return {
      team: this.team,
      mode: this.mode,
      date,
      tips: this.tips.length,
      goal: GOAL_TIPS,
      tipTimes: this.tips.map((t) => t.atS),
      cycles: [...this.readout.cycles],
      pickUps: [...this.readout.pickUps],
      balls: this.teleop.launched,
      goalAtS:
        this.tips.length >= GOAL_TIPS ? this.tips[GOAL_TIPS - 1].atS : null,
    };
  }
}
