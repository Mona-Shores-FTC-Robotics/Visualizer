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
import { FIELD } from "../../sim/src/sim/config";
import type { BallKind } from "../../sim/src/sim/world";
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
  /**
   * Every game piece on the field each frame (not those in a robot), so the replay shows the
   * volleys and the CELLs filling: per kind, per frame, X, height, Z flattened, in centimetres in
   * the simulator's frame. Older traces have none.
   */
  pieceFrames?: Record<"pollen" | "nectarRed" | "nectarBlue", number[][]>;
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
 * Where TeleOp starts the robot in its alliance's LOADING ZONE: the zone from the field CAD's
 * gaffer-tape box (FIELD.loadingZone, sim/src/sim/config.ts), centred along it, the robot's back
 * 2 cm off our wall and facing the field. PARK needs only part of the robot in the zone (section
 * 10.5.4); this puts the whole chassis inside it along the wall.
 */
export function loadingZonePose(
  alliance: "red" | "blue",
  robotLength: number,
): { x: number; z: number; h: number } {
  const [, , z0, z1] = FIELD.loadingZone[alliance];
  const s = alliance === "red" ? -1 : 1;
  return {
    x: s * (FIELD.half - robotLength / 2 - 0.02),
    z: (z0 + z1) / 2,
    h: alliance === "red" ? 0 : Math.PI,
  };
}

/** Puts robot `k` at `p` (sim X, Z, heading), at rest. */
export function placeRobot(
  sim: Sim,
  k: number,
  p: { x: number; z: number; h: number },
): void {
  const b = sim.view(k).robot;
  b.setTranslation({ x: p.x, y: b.translation().y, z: p.z }, true);
  b.setRotation(
    { x: 0, y: Math.sin(p.h / 2), z: 0, w: Math.cos(p.h / 2) },
    true,
  );
  b.setLinvel({ x: 0, y: 0, z: 0 }, true);
  b.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

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

  /**
   * The trace's pieces at the replay's time, for the view to draw in place of the simulator's
   * (which stand still until the hand-off): between two frames with the same pieces, part way.
   */
  pieces(): { kind: BallKind; x: number; y: number; z: number }[] {
    const pf = this.trace.pieceFrames;
    if (!pf) return [];
    const n = this.trace.frames.length;
    const u = Math.max(0, Math.min(n - 1, this.t * 10));
    const i = Math.min(n - 1, Math.floor(u + 1e-6)),
      j = Math.min(n - 1, i + 1),
      w = u - i;
    const out: { kind: BallKind; x: number; y: number; z: number }[] = [];
    for (const [key, kind] of [
      ["pollen", "pollen"],
      ["nectarRed", "nectar_red"],
      ["nectarBlue", "nectar_blue"],
    ] as const) {
      const a = pf[key][i] ?? [],
        b = pf[key][j] ?? [];
      const mix = a.length === b.length ? w : 0;
      for (let k = 0; k + 2 < a.length; k += 3)
        out.push({
          kind,
          x: (a[k] + (b[k] - a[k]) * mix) / 100,
          y: (a[k + 1] + (b[k + 1] - a[k + 1]) * mix) / 100,
          z: (a[k + 2] + (b[k + 2] - a[k + 2]) * mix) / 100,
        });
    }
    return out;
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
   * CELL gets the pieces the AutoSim had in it (at most 12, as POLLEN). The field's pieces go where
   * the Auto left them: each FLOWER's stack, and every piece on the floor (`fieldAtHandoff`).
   */
  private handOver() {
    const h = this.trace.handoff;
    this.pose(HANDOFF_S);
    const v = this.sim.view(this.k);
    v.carried = Array.from({ length: h.held }, () => "pollen" as const);
    // A HIVE that has not tipped still has its own 3 NECTAR racked in the raised CELL (as the
    // simulator staged them, and counted in the trace's pieces): seed only the rest.
    const seed = (a: "red" | "blue") => {
      const st = h.hives[a];
      const racked = st.up === START_UP[a] && st.tips === 0 ? STAGED_NECTAR : 0;
      return Math.max(0, Math.min(12, st.raisedCellPieces - racked));
    };
    const field = fieldAtHandoff(this.trace, this.sim);
    // A HIVE that tipped twice (or 4 times) has its starting CELL raised again, but its staged NECTAR
    // spilled at the first TIP and are among the trace's pieces. The replay never ran the physics,
    // so the simulator still has them racked: raise the other CELL first, and the hand-off clears
    // them with the floor.
    const stale = (["red", "blue"] as const).filter(
      (a) => h.hives[a].tips > 0 && h.hives[a].up === START_UP[a],
    );
    if (stale.length)
      this.sim.handoff(
        Object.fromEntries(
          stale.map((a) => [
            a,
            {
              up: h.hives[a].up === "rear" ? "audience" : "rear",
              tips: h.hives[a].tips,
            },
          ]),
        ),
        1,
        field,
      );
    this.sim.handoff(
      {
        red: {
          up: h.hives.red.up,
          tips: h.hives.red.tips,
          cellPollen: seed("red"),
        },
        blue: {
          up: h.hives.blue.up,
          tips: h.hives.blue.tips,
          cellPollen: seed("blue"),
        },
      },
      1,
      field,
    );
    this.handedOver = true;
  }
}

/** Each HIVE's raised CELL at the start, and the NECTAR staged in it (Competition Manual 10.3.1). */
const START_UP = { red: "audience", blue: "rear" } as const;
const STAGED_NECTAR = 3;

/** A piece within this of a FLOWER's centre, horizontally, is in its stack (metres). */
const FLOWER_RADIUS_M = 0.08;
/** A piece lower than this (its centre, metres) is on the floor. */
const FLOOR_M = 0.15;
/** A floor piece this far past a wall (metres) is the AutoSim's stock for an absent robot. */
const PAST_WALL_M = 0.12;

/**
 * The trace's pieces at the hand-off, for `Sim.handoff`'s field: each FLOWER's stack (the pieces
 * standing on its site, bottom first) and every piece on the floor. The AutoSim keeps the absent
 * robots' preloads in rows just past the walls, where the simulator keeps them just inside: those are
 * brought in to touch the wall, so all 40 POLLEN stay in play. Pieces up in a CELL are the HIVE's
 * (`cellPollen`); the NECTAR stash stays the simulator's own count.
 */
export function fieldAtHandoff(
  trace: AutoTrace,
  sim: Pick<Sim, "flowers">,
): {
  pieces: { kind: BallKind; x: number; y: number; z: number }[];
  flowers: Record<string, BallKind[]>;
} {
  const all: { kind: BallKind; x: number; y: number; z: number }[] = [];
  const add = (list: number[][], kind: BallKind) => {
    for (const [x, y, z] of list) all.push({ kind, x, y, z });
  };
  add(trace.handoff.pieces.pollen, "pollen");
  add(trace.handoff.pieces.nectarRed, "nectar_red");
  add(trace.handoff.pieces.nectarBlue, "nectar_blue");
  const onFlower = (q: { x: number; z: number }) =>
    sim.flowers.find((o) => Math.hypot(o.x - q.x, o.z - q.z) < FLOWER_RADIUS_M);
  const inside = (v: number, r: number) =>
    Math.max(-FIELD.half + r, Math.min(FIELD.half - r, v));
  const pieces = all
    .filter(
      (q) =>
        !onFlower(q) &&
        q.y < FLOOR_M &&
        (q.kind === "pollen"
          ? Math.abs(q.x) < FIELD.half + PAST_WALL_M &&
            Math.abs(q.z) < FIELD.half + PAST_WALL_M
          : Math.abs(q.x) < FIELD.half && Math.abs(q.z) < FIELD.half),
    )
    .map((q) => {
      const r = q.kind === "pollen" ? FIELD.pollenRadius : FIELD.nectarRadius;
      return { ...q, x: inside(q.x, r + 0.002), z: inside(q.z, r + 0.002) };
    });
  const flowers: Record<string, BallKind[]> = {};
  for (const f of sim.flowers)
    flowers[f.id] = all
      .filter((q) => onFlower(q)?.id === f.id)
      .sort((a, b) => a.y - b.y)
      .map((q) => q.kind);
  return { pieces, flowers };
}
