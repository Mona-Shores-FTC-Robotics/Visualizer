/**
 * One drill: a 2:00 TeleOp from the start, solo or our two robots as an alliance, counting TIPs
 * toward the goal, with the practice readout's split for every cycle and pick-up of each robot. No DOM: the page and the tests drive it.
 */
import type RAPIER_NS from "@dimforge/rapier3d-compat";
import { monaShoresConfig } from "../../sim/src/sim/robots/mona-shores";
import { DT, NO_INPUT, Sim } from "../../sim/src/sim/world";
import { Controls, NO_PAD, type ControlsFile, type PadRead } from "./controls";
import type { Alliance, CellSide } from "../../sim/src/sim/hive";
import { TIP_TIMINGS, type TipTiming } from "../../sim/src/sim/tip-lag";
import { CycleReadout, type CycleResult, type PickUpResult } from "./readout";
import { PRESETS, type RobotPreset, type TeamNumber } from "./presets";
import { TeleOp } from "./teleop";
import { Coach } from "../../sim/src/auto/coach";
import {
  OPPONENT_SKILL_TELEOP,
  defaultBot,
  opponentSetup,
  robotConfig,
  sanitize,
} from "../../sim/src/setup";
import {
  AutoPlayback,
  HANDOFF_S,
  fieldAtHandoff,
  loadingZonePose,
  placeRobot,
  startPose,
  cornerPartnerPose,
  type AutoTrace,
} from "./fullMatch";
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

/** The opponents' strength: the TIPs a match they average (sim/src/setup.ts OPPONENT_SKILL). */
export type OpponentSkill = 1 | 3 | 5 | 7;

/**
 * Who else is on the field. "empty": nobody, for testing. "match": our partner robot dead in its
 * start (an obstacle that never moves; in an alliance drill both our robots are driven), and two
 * opponent robots on the simulator's planner at a skill drawn per match from 1, 3, 5 or 7 TIPs a
 * match, or a fixed one. Their TIPs spill POLLEN back onto the field as a real match's do.
 */
export type Population =
  { kind: "empty" } | { kind: "match"; skill: OpponentSkill | "random" };

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
  /** A match population: the opponents' skill this match, and their TIPs. */
  opponents?: { skill: OpponentSkill; tips: number };
  /** The 2:00 drill opened after an Auto: the AUTO TIPs it started with (openingAuto, opensAfterAuto). */
  openingTips?: number;
  /** The Auto whose hand-off the 2:00 drill opened on (openingAuto), absent for the generic opening. */
  openingAuto?: string;
  /** Our robots rejected every NECTAR (POLLEN only, DrillSession.pollenOnly). */
  pollenOnly?: boolean;
  /** Our robots had the corner wheels (DrillSession.cornerWheels; on by default since 26 Nov 2026). */
  cornerWheels?: boolean;
  /** POLLEN in our raised CELL at the opening (the 1-TIP opening's ONE_TIP_CELL), with openingAuto. */
  openingCell?: number;
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

/** R-Solo's opening: varied, or always its 2-TIP or its 1-TIP outcome (DrillSession.openingKind). */
export type OpeningKind = "varied" | "two" | "one";
/**
 * How often the varied opening is the 1-TIP one: 2 to 1, as the mentor finds it on the field. The
 * AutoSim's real-robot runs of R-Solo (sim-results, 23 Nov 2026) are more hopeful: 1 of 10 seeds.
 */
export const ONE_TIP_SHARE = 2 / 3;
/**
 * POLLEN in the raised CELL after the 1-TIP opening. The mentor finds 6 or 7 typical; in the
 * simulator 7 tips the CELL within a second (the TIP weight of 7.4 is a median, and the HIVE's
 * tip lag spreads around it), so 6: the most that waits for TeleOp's first volley.
 */
export const ONE_TIP_CELL = 6;

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
  /** The opponents' skill this match (a match population), or null on an empty field. */
  readonly opponentSkill: OpponentSkill | null = null;
  /** The planner driving each opponent (blue), null for ours and the dead partner. */
  private coaches: (Coach | null)[] = [];
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
    population: Population = { kind: "empty" },
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
    const match = population.kind === "match";
    if (match) {
      const skills: OpponentSkill[] = [1, 3, 5, 7];
      this.opponentSkill =
        population.skill === "random"
          ? skills[Math.floor(this.rand() * skills.length)]
          : population.skill;
    }
    // The dead partner, when only one of ours is driven: our other robot, standing at its start.
    const partnerPreset = PRESETS[this.slots[0].team === 20245 ? 19429 : 20245];
    // The opponents (blue): the planner's robot at the skill's dial setting. They play TeleOp only
    // on the planner (a full match replays only our Auto), so the TeleOp-calibrated dial.
    const opponentCfg = (slot: number) =>
      robotConfig(
        sanitize(
          {
            ...defaultBot(2 + slot),
            ...opponentSetup(OPPONENT_SKILL_TELEOP[this.opponentSkill!]),
          },
          2 + slot,
        ),
      );
    // The simulator's partner starts on the rear wall by the rear FLOWER, the first robot on the
    // alliance wall: one at each end, as the cycle playbook splits them.
    // Ours are the Sim's first robots and always red (it builds red first); only theirs pull POLLEN
    // from a FLOWER by pushing into it, the planner's way. Ours pick by the FLOWER pick routine.
    const ours: Alliance = "red";
    this.sim = new Sim(rapier, cfgFor(this.presets[0]), "teleop", seed, {
      flowerPullByPush: (a) => a !== ours,
      tipTiming,
      partners: this.slots.length > 1 || match,
      opponent: match,
      configFor: (a, slot) =>
        a === "blue"
          ? opponentCfg(slot)
          : cfgFor(this.presets[slot] ?? partnerPreset),
    });
    if (match)
      this.coaches = this.sim.robots.map((r) => {
        if (r.alliance !== "blue") return null;
        const c = new Coach();
        c.autoRoutine = "default";
        c.flowerStartSec = 0;
        return c;
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

  /**
   * POLLEN only: our robots reject every NECTAR at the intake, ours too, as the robot does with
   * `ColorSensorSubsystem.rejectAllNectar` on (TeleOp.rejectAllNectar). The page has it on for now
   * (the mentor, 23 Nov 2026: we can't take NECTAR yet); off is the colour gate as before.
   */
  get pollenOnly(): boolean {
    return this.teleops.some((t) => t.rejectAllNectar);
  }
  set pollenOnly(on: boolean) {
    for (const t of this.teleops) t.rejectAllNectar = on;
  }

  /** Corner wheels on our robots' intakes (TeleOp.cornerWheels). On by default: both robots have them. */
  get cornerWheels(): boolean {
    return this.teleops.some((t) => t.cornerWheels);
  }
  set cornerWheels(on: boolean) {
    for (const t of this.teleops) t.cornerWheels = on;
  }

  /**
   * Stands our dead partner (a match field with one of our robots driven) at the start of its Auto
   * (fullMatch.partnerAutoFor): dead from the beginning, it never leaves it. Call before start().
   * Returns false when there is no dead partner to place.
   */
  placeDeadPartner(partnerTrace: AutoTrace): boolean {
    return this.placeDeadPartnerAt(
      startPose(partnerTrace),
      `${partnerTrace.auto}'s start`,
    );
  }

  /**
   * Beside our R-Solo, the dead partner keeps out of the way in the left corner of our alliance
   * wall (fullMatch.cornerPartnerPose), not at another Auto's start.
   */
  placeDeadPartnerInCorner(): boolean {
    const k = this.deadPartnerIndex();
    if (k < 0) return false;
    const c = this.sim.robots[k].cfg;
    return this.placeDeadPartnerAt(
      cornerPartnerPose(this.sim.alliance, c),
      "the left corner of our alliance wall",
    );
  }

  private deadPartnerIndex(): number {
    return this.sim.robots.findIndex(
      (r, i) => i >= this.teleops.length && r.alliance === this.sim.alliance,
    );
  }

  private placeDeadPartnerAt(
    p: { x: number; z: number; h: number },
    where: string,
  ): boolean {
    const k = this.deadPartnerIndex();
    if (k < 0) return false;
    placeRobot(this.sim, k, p);
    this.deadPartnerAt = where;
    return true;
  }
  /** Where our dead partner stands ("l-no-cross's start", "the left corner of …"), or null. */
  deadPartnerAt: string | null = null;

  /** The FLOWER stick's swing for the view during the AUTO replay, degrees; null otherwise. */
  get replayStickDeg(): number | null {
    return this.playback && !this.playback.handedOver
      ? this.playback.stickDeg
      : null;
  }

  /** The Auto replay's pieces for the view to draw (a full match before 2:00), else null. */
  get replayPieces(): ReturnType<AutoPlayback["pieces"]> | null {
    return this.playback && !this.playback.handedOver
      ? this.playback.pieces()
      : null;
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
      : this.openingTips;
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

  /**
   * The 2:00 drill opens after a 1-TIP Auto (Hub, 23 Nov 2026): our robot's 4 preloads go into our
   * raised CELL with its 3 NECTAR, over the TIP weight, and the field runs (clock stopped) until the
   * TIP settles and spills, as most of our Autos leave it. That TIP counts as the AUTO's. Off by
   * default; the page turns it on. Ignored in a full match, whose AUTO is the trace's.
   */
  opensAfterAuto = false;
  /**
   * The 2:00 drill opens on the field as this Auto's trace hands it over (the mentor, 23 Nov 2026:
   * our R-Solo): both HIVEs with the AUTO's TIPs, the loose pieces and the FLOWERs, with no
   * replay; then our robot moves into our LOADING ZONE to start TeleOp. The trace's TIPs count as
   * AUTO TIPs. Takes the place of opensAfterAuto; ignored in a full match.
   */
  openingAuto: AutoTrace | null = null;
  /**
   * Which of R-Solo's outcomes the opening is (the mentor, 23 Nov 2026): "two" is its best case,
   * 2 TIPs and the raised CELL empty; "one" is 1 TIP with ONE_TIP_CELL POLLEN in the raised CELL,
   * short of the second, which the mentor finds typical on the field; "varied" draws one each run,
   * "one" ONE_TIP_SHARE of the time.
   */
  openingKind: OpeningKind = "varied";
  /** POLLEN in our raised CELL at the opening: 0 after the 2-TIP opening, ONE_TIP_CELL after the 1-TIP. */
  openingCell = 0;
  /** The AUTO TIPs the 2:00 drill opened with (opensAfterAuto). */
  openingTips = 0;

  start(): void {
    if (this.started) return;
    this.started = true;
    if (this.playback) return; // TeleOp starts at the hand-off
    if (this.openingAuto) this.openOnAuto(this.openingAuto);
    else if (this.opensAfterAuto) this.openAfterAuto();
    this.sim.start();
    for (const r of this.readouts) r.start(0);
    for (const t of this.teleops) t.lockUsed = t.lock.held;
  }

  private openOnAuto(trace: AutoTrace) {
    new AutoPlayback(trace, this.sim, 0).advance(HANDOFF_S);
    const one =
      this.openingKind === "one" ||
      (this.openingKind === "varied" && this.rand() < ONE_TIP_SHARE);
    if (one && this.sim.hives[this.sim.alliance].tips >= 1)
      this.shortOfLastTip(trace, ONE_TIP_CELL);
    placeRobot(
      this.sim,
      0,
      loadingZonePose(this.sim.alliance, this.sim.view(0).cfg.length),
    );
    this.openingTips = this.sim.hives[this.sim.alliance].tips;
  }

  /**
   * The 1-TIP opening from a trace's hand-off: its last TIP not reached. The HIVE goes back to the
   * CELL it had raised before that TIP, with `n` POLLEN in it (under the TIP weight), and those `n`
   * come off the floor: the ones nearest our HIVE, where that TIP spilled them. Every POLLEN stays
   * accounted for.
   */
  private shortOfLastTip(trace: AutoTrace, n: number) {
    const a = this.sim.alliance,
      hive = this.sim.hives[a];
    const field = fieldAtHandoff(trace, this.sim);
    const c = hive.body.translation();
    const taken = new Set(
      field.pieces
        .map((q, i) => ({ q, i }))
        .filter((o) => o.q.kind === "pollen")
        .sort(
          (x, y) =>
            Math.hypot(x.q.x - c.x, x.q.z - c.z) -
            Math.hypot(y.q.x - c.x, y.q.z - c.z),
        )
        .slice(0, n)
        .map((o) => o.i),
    );
    this.sim.handoff(
      {
        [a]: {
          up: hive.upCell === "audience" ? "rear" : "audience",
          tips: hive.tips - 1,
          cellPollen: taken.size,
        },
      },
      1,
      {
        pieces: field.pieces.filter((_, i) => !taken.has(i)),
        flowers: field.flowers,
      },
    );
    this.openingCell = taken.size;
  }

  private openAfterAuto() {
    const a = this.sim.alliance,
      hive = this.sim.hives[a];
    this.sim.handoff({ [a]: { up: hive.upCell, tips: 0, cellPollen: 4 } });
    // Before PLAY the clock stands and nobody drives: only the HIVE and the pieces move.
    for (let i = 0; i < 12 / DT && hive.tips === 0; i++)
      this.sim.step(NO_INPUT);
    for (let i = 0; i < 3 / DT; i++) this.sim.step(NO_INPUT); // the spill comes to rest
    this.openingTips = hive.tips;
    this.sim.handoff({ [a]: { up: hive.upCell, tips: hive.tips } });
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
      for (const t of this.teleops) t.lockUsed = t.lock.held;
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
        this.sim.robots.map((_, k) => {
          const tele = this.teleops[k];
          if (tele)
            return {
              ...NO_INPUT,
              intake: this.finished ? ("none" as const) : tele.intakeFilter,
            };
          // The opponents play on; the dead partner never moves.
          const c = this.coaches[k];
          return c && !this.finished
            ? c.update(this.sim.view(k), DT)
            : NO_INPUT;
        }),
        this.sim.robots.map((_, k) => !!this.coaches[k]),
      );
      if (this.sim.hives[this.sim.alliance].tips > tipsBefore) this.onTip();
      if (loop && this.started) {
        this.teleops.forEach((tele, k) => {
          const n = this.sim.robots[k].carried.length;
          const pieceIn = n > this.lastCarried[k] && !this.finished;
          this.lastCarried[k] = n;
          const before = this.readouts[k].cycles.length;
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
          // The heading-lock comparison: a cycle that just ended is tagged with whether R1 was
          // held in it; the next starts with R1 as it is now.
          const cycles = this.readouts[k].cycles;
          if (cycles.length > before) {
            cycles[cycles.length - 1].headingLock = tele.lockUsed;
            tele.lockUsed = tele.lock.held;
          }
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
      ...(this.opponentSkill
        ? {
            opponents: {
              skill: this.opponentSkill,
              tips: this.sim.hives[this.sim.alliance === "red" ? "blue" : "red"]
                .tips,
            },
          }
        : {}),
      ...(!this.playback && this.openingTips
        ? { openingTips: this.openingTips }
        : {}),
      ...(this.pollenOnly ? { pollenOnly: true } : {}),
      ...(this.cornerWheels ? { cornerWheels: true } : {}),
      ...(!this.playback && this.openingAuto
        ? { openingAuto: this.openingAuto.auto, openingCell: this.openingCell }
        : {}),
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
    const auto = this.playback
      ? this.playback.trace.autoTips
      : this.openingTips;
    if (auto >= GOAL_TIPS) return 0;
    const k = GOAL_TIPS - auto;
    return this.tips.length >= k ? this.tips[k - 1].atS : null;
  }
}
