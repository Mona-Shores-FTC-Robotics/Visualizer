/**
 * Full Match: one of our Autos plays out (the 30 s AUTO, then the 8 s transition), and the driver
 * takes over at 2:00 TeleOp from exactly where it ended. The AUTO is not simulated here: it is the
 * Java AutoSim's typical run of that Auto, as biobuzz's "Simulate Auto" workflow published it
 * (scripts/drill-auto-traces.py writes public/drill/autos/<auto>.json from it). The drill replays
 * the robot's pose and both HIVEs' tilt at 10 Hz, then hands over: the robot's pose and lane, each
 * HIVE's raised CELL and TIPs (counted as AUTO TIPs, `Sim.handoff`), and the pieces in our raised
 * CELL.
 *
 * Every trace is drawn for red (the AutoSim runs our Autos as red); the drill plays red.
 */
import type { Sim } from "../../sim/src/sim/world";
import type { CellSide } from "../../sim/src/sim/hive";
import { fromPedro } from "./launchSpot";

export const AUTO_S = 30;
export const TRANSITION_S = 8;
export const HANDOFF_S = AUTO_S + TRANSITION_S;

export interface AutoTraceHive {
  up: CellSide;
  tips: number;
  raisedCellPieces: number;
}

export interface AutoTrace {
  auto: string;
  source: string;
  design: string | null;
  calibration: string | null;
  alliance: "RED" | "BLUE";
  seed: number;
  commit: string | null;
  branch: string | null;
  finishedAt: string | null;
  runUrl: string | null;
  autoTips: number;
  tipsAt: number[] | null;
  launched: number | null;
  scored: number | null;
  /** t, x, y (Pedro inches), headingDeg, held, redAngleDeg, redTips, blueAngleDeg, blueTips. */
  columns: string[];
  frames: number[][];
  handoff: {
    pose: { x: number; y: number; headingDeg: number };
    held: number;
    hives: { red: AutoTraceHive; blue: AutoTraceHive };
    pieces: {
      pollen: number[][];
      nectarRed: number[][];
      nectarBlue: number[][];
    };
  };
}

export interface AutoIndexEntry {
  auto: string;
  alliance: string;
  design: string | null;
  seed: number;
  autoTips: number;
  finishedAt: string | null;
  commit: string | null;
}

/** The Autos the drill offers: public/drill/autos/index.json, beside the page. */
export async function loadAutoIndex(
  fetcher: typeof fetch = fetch,
): Promise<AutoIndexEntry[]> {
  const r = await fetcher("autos/index.json", { cache: "no-cache" });
  if (!r.ok) throw new Error(`autos/index.json: HTTP ${r.status}`);
  return ((await r.json()) as { autos: AutoIndexEntry[] }).autos;
}

export async function loadAutoTrace(
  auto: string,
  fetcher: typeof fetch = fetch,
): Promise<AutoTrace> {
  const r = await fetcher(`autos/${auto}.json`, { cache: "no-cache" });
  if (!r.ok) throw new Error(`autos/${auto}.json: HTTP ${r.status}`);
  return (await r.json()) as AutoTrace;
}

const rad = (d: number) => (d * Math.PI) / 180;

/**
 * Replays an AUTO trace onto robot `k` of the simulator, and hands over at 38 s. The physics does not
 * step during the replay: the robot and the HIVEs are posed from the trace each frame.
 */
export class AutoPlayback {
  /** Seconds from the AUTO's start. */
  t = 0;
  handedOver = false;

  constructor(
    readonly trace: AutoTrace,
    private sim: Sim,
    private k = 0,
  ) {
    this.pose(0);
  }

  get phase(): "auto" | "transition" | "teleop" {
    return this.handedOver ? "teleop" : this.t < AUTO_S ? "auto" : "transition";
  }

  /** Seconds left on the field timer: the AUTO's 30 s, then the transition's 8. */
  get timer(): number {
    return this.t < AUTO_S ? AUTO_S - this.t : Math.max(0, HANDOFF_S - this.t);
  }

  /** Our HIVE's TIPs so far in the replay. */
  get tipsSoFar(): number {
    return this.frame(this.t)[6] ?? 0;
  }

  /** Advances the replay; true once it has handed over. */
  advance(seconds: number): boolean {
    if (this.handedOver) return true;
    this.t = Math.min(HANDOFF_S, this.t + seconds);
    this.pose(this.t);
    if (this.t >= HANDOFF_S) this.handOver();
    return this.handedOver;
  }

  /** The frame at or before `t`. */
  private frame(t: number): number[] {
    const f = this.trace.frames;
    const i = Math.max(0, Math.min(f.length - 1, Math.floor(t * 10 + 1e-6)));
    return f[i];
  }

  private pose(t: number) {
    const fr = this.frame(t);
    const v = this.sim.view(this.k);
    const p = fromPedro([fr[1], fr[2], fr[3]]);
    const b = v.robot;
    b.setTranslation({ x: p.x, y: b.translation().y, z: p.z }, true);
    b.setRotation(
      { x: 0, y: Math.sin(p.h / 2), z: 0, w: Math.cos(p.h / 2) },
      true,
    );
    b.setLinvel({ x: 0, y: 0, z: 0 }, true);
    b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    v.carried = Array.from({ length: fr[4] }, () => "pollen" as const);
    // The HIVEs' tilt (positive with the rear CELL up, as the simulator has it).
    for (const [a, i] of [
      ["red", 5],
      ["blue", 7],
    ] as const) {
      const phi = rad(fr[i]);
      const h = this.sim.hives[a].body;
      h.setRotation(
        { x: Math.sin(phi / 2), y: 0, z: 0, w: Math.cos(phi / 2) },
        true,
      );
      h.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  }

  /**
   * The hand-off at 38 s: the robot where the AUTO left it, its lane, and each HIVE at rest on its
   * raised CELL with the AUTO's TIPs (Sim.handoff, which counts them as AUTO TIPs). Our raised
   * CELL gets the pieces the AutoSim had in it (at most 12, as POLLEN).
   */
  private handOver() {
    const h = this.trace.handoff;
    this.pose(HANDOFF_S);
    const v = this.sim.view(this.k);
    v.carried = Array.from({ length: h.held }, () => "pollen" as const);
    this.sim.handoff({
      red: {
        up: h.hives.red.up,
        tips: h.hives.red.tips,
        cellPollen: Math.min(12, h.hives.red.raisedCellPieces),
      },
      blue: {
        up: h.hives.blue.up,
        tips: h.hives.blue.tips,
        cellPollen: Math.min(12, h.hives.blue.raisedCellPieces),
      },
    });
    this.handedOver = true;
  }
}
