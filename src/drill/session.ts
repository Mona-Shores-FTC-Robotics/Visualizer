/**
 * One drill: a 2:00 TeleOp from the start, solo or our two robots as an alliance, counting TIPs
 * toward the goal, with the practice readout's split for every cycle and pick-up of each robot. No DOM: the page and the tests drive it.
 */
import type RAPIER_NS from "@dimforge/rapier3d-compat";
import { monaShoresConfig } from "../../sim/src/sim/robots/mona-shores";
import { DT, NO_INPUT, Sim } from "../../sim/src/sim/world";
import { Controls, NO_PAD, type ControlsFile, type PadRead } from "./controls";
import type { CellSide } from "../../sim/src/sim/hive";
import { TIP_TIMINGS, type TipTiming } from "../../sim/src/sim/tip-lag";
import { CycleReadout, type CycleResult, type PickUpResult } from "./readout";
import { PRESETS, type RobotPreset, type TeamNumber } from "./presets";
import { TeleOp } from "./teleop";
import { AutoPlayback, type AutoTrace } from "./fullMatch";
import {
  HUMAN_PLAYERS,
  PlaybookHumanPlayer,
  zoneEnd,
  type HumanPlayerKind,
} from "./nectar";

export { HUMAN_PLAYERS, type HumanPlayerKind };

export const GOAL_TIPS = 7;
export const TELEOP_S = 120;

export interface TipRecord {
  /** When the CELL settled the other way, s from PLAY. */
  atS: number;
  /** The last ball out before it, s from PLAY (NaN if none), and the lag from it. */
  lastBallS: number;
  lagS: number;
}

/**
 * Solo with an operator, solo driver only, alliance with a driver each (2 controllers), and
 * alliance with a driver and an operator each (4 controllers).
 */
export type DrillMode = "two" | "driver" | "alliance" | "alliance-ops";

/**
 * Which TIP timing the HIVE runs (mentor, 23 Nov 2026: neither is assumed right, so both stay
 * selectable): the simulator's own `SimOptions.tipTiming` (sim/src/sim/tip-lag.ts). "uv-ir", our
 * films, holds a CELL over its weight on its stop before it swings; "ncssm" is the rocker alone.
 */
export { TIP_TIMINGS, type TipTiming };

/** One robot in a drill: whose numbers it runs, and whether it has an operator. */
export interface RobotSlot {
  team: TeamNumber;
  driverOnly: boolean;
}

/** What one robot did in a run. */
export interface RobotRunResult {
  team: TeamNumber;
  /** The end of the field the robot started at, which it owns in an alliance drill. */
  end: CellSide;
  cycles: CycleResult[];
  pickUps: PickUpResult[];
  balls: number;
  /** Volleys (gate openings) at our CELL at its own end, and of those at a CELL that was down. */
  volleys: number;
  volleysOffEnd: number;
  volleysAtDown: number;
  /** Our NECTAR it launched, and wrong NECTAR it rejected at the lane entrance. */
  nectarLaunched: number;
  rejects: number;
}

export interface RunResult {
  /** Robot 1's team (gamepad 1); in an alliance drill every robot is in `robots`. */
  team: TeamNumber;
  mode: DrillMode;
  tipTiming: TipTiming;
  humanPlayer: HumanPlayerKind;
  /** NECTAR our human player entered. */
  nectarEntered: number;
  date: string;
  tips: number;
  goal: number;
  /** Seconds from PLAY at which each TIP settled. */
  tipTimes: number[];
  /** Robot 1's, as in `robots[0]`. */
  cycles: CycleResult[];
  pickUps: PickUpResult[];
  /** Every robot's launches. */
  balls: number;
  /** When the 7th TIP settled (the AUTO's counted, in a full match), or null. */
  goalAtS: number | null;
  /** A full match: the Auto played before TeleOp and its TIPs; absent for the 2:00 drill. */
  auto?: { name: string; tips: number; design: string | null; seed: number };
  robots: RobotRunResult[];
}

/** Our two robots as partners, in the order the page shows them. */
export const TEAM_NAMES: Record<TeamNumber, string> = {
  20245: "Ultraviolet (20245)",
  19429: "Infrared (19429)",
};

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
  readonly teleops: TeleOp[] = [];
  readonly readouts: CycleReadout[] = [];
  readonly presets: RobotPreset[] = [];
  readonly slots: RobotSlot[];
  /** The end each robot started at. */
  readonly ends: CellSide[] = [];
  readonly tips: TipRecord[] = [];
  private rand: () => number;
  private lastCarried: number[] = [];
  private started = false;
  finished = false;
  /** Full Match: the Auto being replayed before TeleOp (./fullMatch.ts), or null for the 2:00 drill. */
  playback: AutoPlayback | null = null;

  /**
   * One robot (`team`), or an alliance (an array of slots): our robots as partners on one field,
   * each with its own numbers, controls and readout, sharing our HIVE.
   */
  constructor(
    rapier: typeof RAPIER_NS,
    controlsFile: ControlsFile,
    team: TeamNumber | RobotSlot[],
    public mode: DrillMode,
    seed = Date.now() & 0xffff,
    public tipTiming: TipTiming = "uv-ir",
    public humanPlayer: HumanPlayerKind = "playbook",
  ) {
    this.slots = Array.isArray(team)
      ? team
      : [{ team, driverOnly: mode === "driver" }];
    this.rand = mulberry32(seed);
    // Our robot as the simulator models it (sim/src/sim/robots/mona-shores.ts), intake and
    // FLOWER stick included, so master's FLOWER pick and GARDEN gather routines pick up physically.
    const cfgFor = (p: RobotPreset) =>
      monaShoresConfig(String(p.team) as "19429" | "20245");
    for (const s of this.slots) this.presets.push(PRESETS[s.team]);
    // The simulator's partner starts on the rear wall by the rear FLOWER, the first robot on the
    // alliance wall: one at each end, as the cycle playbook splits them.
    this.sim = new Sim(rapier, cfgFor(this.presets[0]), "teleop", seed, {
      flowerPullByPush: false,
      tipTiming,
      partners: this.slots.length > 1,
      configFor: (_a, slot) =>
        this.presets[slot] ? cfgFor(this.presets[slot]) : undefined,
    });
    this.slots.forEach((slot, i) => {
      const v = this.sim.view(i);
      // TeleOp after the Auto shot the preloads: the lane starts empty.
      v.carried = [];
      this.teleops.push(
        new TeleOp(
          v,
          this.presets[i],
          new Controls(controlsFile),
          this.rand,
          slot.driverOnly,
        ),
      );
      this.readouts.push(new CycleReadout());
      this.ends.push(v.robot.translation().z >= 0 ? "audience" : "rear");
      this.teleops[i].nearCell = this.ends[i];
      this.lastCarried.push(0);
    });
    this.simStashAtStart = this.sim.stash[this.sim.alliance];
    if (humanPlayer === "playbook")
      this.hp = new PlaybookHumanPlayer(this.sim, this.sim.alliance);
  }

  /** NECTAR our human player has entered so far. */
  get nectarEntered(): number {
    return this.hp
      ? this.hp.entered
      : this.simStashAtStart - this.sim.stash[this.sim.alliance];
  }

  /** Our human player by the playbook, or null when the simulator's own enters our NECTAR. */
  readonly hp: PlaybookHumanPlayer | null = null;
  /** The robot the human player feeds: the one owning the LOADING ZONE's end (or the only one). */
  get fedRobot(): number {
    const k = this.ends.indexOf(zoneEnd(this.sim.alliance));
    return this.teleops.length > 1 && k >= 0 ? k : 0;
  }
  private simStashAtStart = 0;

  /** Robot 1 (gamepad 1). */
  get teleop(): TeleOp {
    return this.teleops[0];
  }
  get readout(): CycleReadout {
    return this.readouts[0];
  }
  get preset(): RobotPreset {
    return this.presets[0];
  }
  get team(): TeamNumber {
    return this.slots[0].team;
  }

  /** Seconds from PLAY. */
  get t(): number {
    return this.sim.time;
  }

  get remainingS(): number {
    if (this.playback && !this.playback.handedOver) return this.playback.timer;
    return this.started ? Math.max(0, this.sim.clock) : TELEOP_S;
  }

  /** Which part of the match is running: the AUTO and transition only in a full match. */
  get phase(): "pre" | "auto" | "transition" | "teleop" | "ended" {
    if (this.finished) return "ended";
    if (!this.started) return "pre";
    return this.playback ? this.playback.phase : "teleop";
  }

  /** TIPs that count toward 7: the AUTO's (a full match) and TeleOp's. */
  get totalTips(): number {
    const auto = this.playback
      ? this.playback.handedOver
        ? this.playback.trace.autoTips
        : this.playback.tipsSoFar
      : 0;
    return auto + this.tips.length;
  }

  /**
   * Full Match: play `trace` (one of our Autos, as the AutoSim ran it) for the AUTO and the
   * transition before TeleOp, robot 1 starting where it ends. Call before start().
   */
  playAuto(trace: AutoTrace): void {
    if (this.started) throw new Error("playAuto: the run has started");
    this.playback = new AutoPlayback(trace, this.sim, 0);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    if (this.playback) return; // TeleOp starts at the hand-off
    this.sim.start();
    for (const r of this.readouts) r.start(0);
  }

  /** Advances the drill by `seconds` of simulated time with robot 1's pads. */
  advance(
    seconds: number,
    driver: PadRead = NO_PAD,
    operator: PadRead = NO_PAD,
  ): void {
    this.advanceAll(seconds, [{ driver, operator }]);
  }

  /** Advances the drill with each robot's pads; a robot with none gets idle pads. */
  advanceAll(
    seconds: number,
    pads: { driver: PadRead; operator: PadRead }[],
  ): void {
    // Full Match: the AUTO and the transition replay the trace; the pads do nothing until 2:00.
    if (this.playback && !this.playback.handedOver) {
      if (!this.started) return;
      const before = this.playback.t;
      if (!this.playback.advance(seconds)) return;
      this.sim.start();
      for (const r of this.readouts) r.start(0);
      this.lastCarried = this.sim.robots.map((r) => r.carried.length);
      seconds -= this.playback.t - before;
      if (seconds <= 1e-9) return;
    }
    const steps = Math.max(1, Math.round(seconds / DT));
    // The TeleOp's loop runs at about the robot's 50 Hz; the physics at the simulator's 240 Hz.
    for (let i = 0; i < steps; i++) {
      const loop = i % 5 === 0;
      this.teleops.forEach((tele, k) => {
        if (loop && this.started && !this.finished)
          tele.update(
            pads[k]?.driver ?? NO_PAD,
            pads[k]?.operator ?? NO_PAD,
            this.t,
            DT * 5,
          );
        if (this.finished) this.sim.robots[k].velDrive = { vx: 0, vz: 0, w: 0 };
      });
      const tipsBefore = this.sim.hives[this.sim.alliance].tips;
      this.sim.step(
        this.teleops.map((tele) => ({
          ...NO_INPUT,
          intake: this.finished ? ("none" as const) : tele.intakeFilter,
        })),
      );
      if (this.sim.hives[this.sim.alliance].tips > tipsBefore) this.onTip();
      if (loop && this.started) {
        this.teleops.forEach((tele, k) => {
          const n = this.sim.robots[k].carried.length;
          const pieceIn = n > this.lastCarried[k] && !this.finished;
          this.lastCarried[k] = n;
          if (!this.finished)
            this.readouts[k].update(
              this.t,
              pieceIn,
              n >= this.presets[k].laneCapacity,
              tele.firePress,
              tele.gateOpen,
              tele.launched,
            );
          tele.firePress = false;
        });
        if (this.hp && !this.finished) {
          const fed = this.teleops[this.fedRobot];
          this.hp.update(
            this.tips.length,
            this.remainingS,
            !fed.gateOpen &&
              this.sim.robots[this.fedRobot].carried.length <
                this.presets[this.fedRobot].laneCapacity,
          );
        }
      }
      if (this.started && !this.finished && this.sim.phase === "post")
        this.finished = true;
    }
  }

  private onTip(): void {
    const at = this.t;
    const shots = this.teleops.flatMap((t) => t.shots).filter((s) => s <= at);
    const last = shots.length ? Math.max(...shots) : NaN;
    if (this.started && at <= TELEOP_S + 1e-9)
      this.tips.push({ atS: at, lastBallS: last, lagS: at - last });
  }

  result(date = new Date().toISOString()): RunResult {
    const robots: RobotRunResult[] = this.teleops.map((tele, k) => ({
      team: this.slots[k].team,
      end: this.ends[k],
      cycles: [...this.readouts[k].cycles],
      pickUps: [...this.readouts[k].pickUps],
      balls: tele.launched,
      volleys: tele.volleys.length,
      volleysOffEnd: tele.volleys.filter((v) => v.cell !== this.ends[k]).length,
      volleysAtDown: tele.volleys.filter((v) => !v.up).length,
      nectarLaunched: tele.nectarLaunched,
      rejects: tele.rejects,
    }));
    return {
      team: this.team,
      mode: this.mode,
      tipTiming: this.tipTiming,
      humanPlayer: this.humanPlayer,
      nectarEntered: this.nectarEntered,
      date,
      tips: this.tips.length,
      goal: GOAL_TIPS,
      tipTimes: this.tips.map((t) => t.atS),
      cycles: robots[0].cycles,
      pickUps: robots[0].pickUps,
      balls: robots.reduce((a, r) => a + r.balls, 0),
      goalAtS: this.goalAtS(),
      robots,
      ...(this.playback
        ? {
            auto: {
              name: this.playback.trace.auto,
              tips: this.playback.trace.autoTips,
              design: this.playback.trace.design,
              seed: this.playback.trace.seed,
            },
          }
        : {}),
    };
  }

  /** When the 7th TIP settled, seconds from TeleOp's start (the AUTO's TIPs counted first), or null. */
  private goalAtS(): number | null {
    const auto = this.playback ? this.playback.trace.autoTips : 0;
    if (auto >= GOAL_TIPS) return 0;
    const k = GOAL_TIPS - auto;
    return this.tips.length >= k ? this.tips[k - 1].atS : null;
  }
}
