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

/** What a trace was matched against on biobuzz master (scripts/drill-auto-traces.py). */
export interface AutoTraceMaster {
  /** The run is of master's .pp (the same file); false: master changed it since, no run yet. */
  fresh: boolean;
  /** For a pair run: the partner's .pp is master's too; null without a partner. */
  partnerFresh: boolean | null;
  /** Master's commit that last changed the Auto's .pp, its date (ISO) and subject. */
  commit: string;
  date: string;
  subject: string;
}

export interface AutoTrace {
  auto: string;
  /** As the Driver Station's menu has it (R-RightUnderHive); older traces have none. */
  name?: string;
  source: string;
  /** The run's scenario ("best": every shot lands), and its entry ("alone", "pair: …"). */
  scenario?: string | null;
  entry?: string | null;
  /** The partner Auto the run had beside ours (a pair run), or null. */
  partnerAuto?: string | null;
  /** The run's folder of logs on biobuzz's sim-results branch. */
  logsUrl?: string;
  master?: AutoTraceMaster;
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
  /**
   * t, x, y (Pedro inches), headingDeg, held, redAngleDeg, redTips, blueAngleDeg, blueTips, stickDeg
   * (newer traces), heldNectar (of `held`, the NECTAR; newer traces).
   */
  columns: string[];
  frames: number[][];
  /** A pair run's partner robot, frame by frame: x, y, headingDeg, held, heldNectar, stickDeg. */
  partnerFrames?: number[][];
  /**
   * Every game piece on the field each frame (not those in a robot), so the replay shows the
   * volleys and the CELLs filling: per kind, per frame, X, height, Z flattened, in centimetres in
   * the simulator's frame. Older traces have none.
   */
  pieceFrames?: Record<"pollen" | "nectarRed" | "nectarBlue", number[][]>;
  handoff: {
    pose: { x: number; y: number; headingDeg: number };
    held: number;
    heldNectar?: number;
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
  name?: string;
  alliance: string;
  design: string | null;
  seed: number;
  scenario?: string | null;
  entry?: string | null;
  partnerAuto?: string | null;
  autoTips: number;
  tipsAt?: number[] | null;
  finishedAt: string | null;
  commit: string | null;
  branch?: string | null;
  runUrl?: string | null;
  logsUrl?: string;
  master?: AutoTraceMaster;
}

/** r-right-under-hive → R-RightUnderHive, as the Driver Station's menu has it. */
export function autoDisplayName(a: { auto: string; name?: string }): string {
  if (a.name) return a.name;
  const [side, ...rest] = a.auto.split("-");
  return `${side.toUpperCase()}-${rest.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("")}`;
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Detroit",
  });

/**
 * What the drill plays for an Auto, in words, for the picker and the HUD: "as on master, Nov 28"
 * (the run is of master's .pp, simulated that day), or "not simulated since <change> (Nov 28);
 * plays the run of Nov 27" when master's version has no run yet.
 */
export function autoFreshness(a: AutoIndexEntry | AutoTrace): {
  fresh: boolean | null;
  words: string;
} {
  const run = a.finishedAt ? shortDate(a.finishedAt) : "an unknown day";
  const m = a.master;
  if (!m) return { fresh: null, words: `simulated ${run}` };
  if (!m.fresh) {
    const pr = /\(#(\d+)\)\s*$/.exec(m.subject)?.[1];
    return {
      fresh: false,
      words: `not simulated since ${pr ? `#${pr}` : m.commit.slice(0, 7)} (${shortDate(m.date)}); plays the run of ${run}`,
    };
  }
  return {
    fresh: true,
    words: `as on master, ${run}${m.partnerFresh === false ? " (partner not master's)" : ""}`,
  };
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

/**
 * The Auto our partner runs beside ours, whose start a dead partner stands at: the other side's half
 * of a pair (r-clockwise with l-clockwise, and so on), and L-NoCross beside R-Solo (the Hub,
 * 24 Nov 2026). Null for an Auto with no partner Auto.
 */
export function partnerAutoFor(auto: string): string | null {
  if (auto === "r-solo") return "l-no-cross";
  if (auto.startsWith("r-")) return `l-${auto.slice(2)}`;
  if (auto.startsWith("l-")) return `r-${auto.slice(2)}`;
  return null;
}

/**
 * Where an Auto starts, in the simulator's frame: its trace's first pose, which is the start its
 * .pp file and biobuzz's TeamCode/autos/spots.json give (L-NoCross: LEFT_START, 62.3, 133.8, 270).
 */
export function startPose(trace: AutoTrace): {
  x: number;
  z: number;
  h: number;
} {
  const f = trace.frames[0];
  return fromPedro([f[1], f[2], f[3]]);
}

/**
 * Where R-Solo's partner waits: R-Solo is the Auto we run when the partner keeps out of the way
 * (the mentor, 24 Nov 2026), so it stands in the left corner of our alliance wall, as its drivers
 * see it (red: the rear corner, Pedro x 0, y 141.5), backed in: its back to our wall, its side to
 * the rear wall, facing the field, 6 mm off each. biobuzz's spots.json has no corner spot. From
 * the field's walls and the robot's size, not a typed pose; clear of the LOADING ZONE and of
 * R-Solo's path and park.
 */
export function cornerPartnerPose(
  alliance: "red" | "blue",
  size: { length: number; width: number },
): { x: number; z: number; h: number } {
  const s = alliance === "red" ? -1 : 1;
  return {
    x: s * (FIELD.half - size.length / 2 - 0.006),
    z: s * (FIELD.half - size.width / 2 - 0.006),
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

  /**
   * `partner`: the robot a pair run's partner (`trace.partnerFrames`) is posed onto during the
   * replay, where it stays, dead, for TeleOp; -1 for none.
   */
  constructor(
    readonly trace: AutoTrace,
    private sim: Sim,
    private k = 0,
    private partner = -1,
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

  /**
   * The FLOWER stick's swing now, degrees (0 stowed, about 162 on the tile), as the AutoSim logged
   * it (/Internals/FlowerStickDeg); null for a trace without it.
   */
  get stickDeg(): number | null {
    const v = this.frame(this.t)[9];
    return v === undefined ? null : v;
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
    return this.trace.frames[this.frameIndex(t)];
  }

  private frameIndex(t: number): number {
    const n = this.trace.frames.length;
    return Math.max(0, Math.min(n - 1, Math.floor(t * 10 + 1e-6)));
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
    v.carried = carriedOf(fr[4], fr[10]);
    // A pair run's partner: robot `partner`, posed from the trace as ours is.
    const pf = this.trace.partnerFrames;
    if (pf && this.partner >= 0) {
      const q = pf[Math.min(pf.length - 1, this.frameIndex(t))];
      placeRobot(this.sim, this.partner, fromPedro([q[0], q[1], q[2]]));
      this.sim.robots[this.partner].carried = carriedOf(q[3], q[4]);
    }
    // The HIVEs' tilt (positive with the rear CELL up, as the simulator has it).
    for (const [a, i] of [
      ["red", 5],
      ["blue", 7],
    ] as const) {
      const phi = rad(fr[i]);
      const hive = this.sim.hives[a],
        h = hive.body;
      h.setRotation(
        { x: Math.sin(phi / 2), y: 0, z: 0, w: Math.cos(phi / 2) },
        true,
      );
      h.setAngvel({ x: 0, y: 0, z: 0 }, true);
      // The HIVE caches its tilt until the next world step (Hive.epoch), and the replay never steps:
      // a new epoch, so the rocker's tilt (and the view drawing it) follows the trace.
      if (hive.epoch !== null) hive.epoch++;
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
    v.carried = carriedOf(h.held, h.heldNectar);
    // A HIVE that has not tipped still has its own 3 NECTAR racked in the raised CELL (as the
    // simulator staged them, and counted in the trace's pieces): seed only the rest.
    const seed = (a: "red" | "blue") => {
      const st = h.hives[a];
      const racked = st.up === START_UP[a] && st.tips === 0 ? STAGED_NECTAR : 0;
      return Math.max(0, Math.min(12, st.raisedCellPieces - racked));
    };
    const field = fieldAtHandoff(this.trace, this.sim);
    // A pair run's partner holds pieces at the hand-off. With no robot to pose it on (a field without
    // our dead partner), they go on the floor where it stood, so every piece stays in play.
    const pf = this.trace.partnerFrames;
    const q = pf?.[pf.length - 1];
    if (q && this.partner < 0) {
      const p = fromPedro([q[0], q[1], q[2]]);
      carriedOf(q[3], q[4]).forEach((kind, i) => {
        const r = kind === "pollen" ? FIELD.pollenRadius : FIELD.nectarRadius;
        const d = (i - (q[3] - 1) / 2) * 0.14;
        field.pieces.push({
          kind,
          x: Math.max(
            -FIELD.half + r,
            Math.min(FIELD.half - r, p.x + d * Math.sin(p.h)),
          ),
          y: r,
          z: Math.max(
            -FIELD.half + r,
            Math.min(FIELD.half - r, p.z + d * Math.cos(p.h)),
          ),
        });
      });
    }
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

/** A robot's lane: `held` pieces, the first `nectar` of them our NECTAR (red: the drill plays red). */
function carriedOf(held: number, nectar = 0): BallKind[] {
  return Array.from({ length: held }, (_, i) =>
    i < (nectar ?? 0) ? ("nectar_red" as const) : ("pollen" as const),
  );
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
