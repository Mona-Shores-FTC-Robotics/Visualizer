/**
 * Typical timing for the preview: a few facts about how the robot and the HIVE behave (how long a
 * volley takes, how soon a TIP follows it, how soon a FLOWER pick fills the intake), so a wait in
 * the preview ends when it typically would instead of the moment it is asked.
 *
 * The facts describe the world, not one Auto: they live in one file the team edits,
 * `TeamCode/autos/timing.json` in biobuzz, never in a `.pp`. A `.pp` says what the robot does
 * (paths, cards, and how long each wait may last); this says how the world behaves. Nothing here
 * changes what the robot does or what the exporter writes.
 *
 * TIPs come from the Autos themselves: every volley (a Launch all step, or a wait with LaunchAll
 * alongside) that ends while the HIVE is settled lands `volleyLoad` in the raised CELL. Once that CELL holds `tipLoad`
 * (the one raised at the start begins with `startLoad`, its 3 NECTAR), the HIVE starts to swing
 * `tipStartS` after the volley ends and settles the other way `tipSwingS` later; the CELL it raises
 * starts empty. With several Autos on the field together their volleys share one HIVE, so
 * the left robot's "our CELL up" waits on the right robot's volley. `CellUp` (the simple builder's
 * wait) is the CELL at the robot's end of the field, as on the robot.
 */
import type { PreviewTiming } from "../auto/simulate";
import { FIELD_SIZE } from "../../config/defaults";

/** One fact the team estimates, then measures. */
export interface TimingFact {
  id: string;
  /** What it is, in plain words. */
  label: string;
  /** What in an Auto it times. */
  times: string;
  /**
   * The value before the team's file sets one: the simulator's, which the tests' fixture Autos were
   * run with. The current robot's values are in the team's `timing.json`.
   */
  fallback: number;
  /** Negative allowed (a TIP can start before the last piece lands). */
  allowNegative?: boolean;
  /** "s" (seconds, the default), "POLLEN" (weight, in POLLEN) or "×" (a factor). */
  unit?: "s" | "POLLEN" | "×";
  /** The range the breakpoint search looks in. */
  range: [number, number];
}

export const FACTS: TimingFact[] = [
  {
    id: "spinUpS",
    label: "Launcher from rest to launch speed",
    times:
      "how long the first LaunchAll waits after SpinUp (SpinUp itself finishes at once; the wheels come up while the robot drives)",
    fallback: 0.1,
    range: [0, 3],
  },
  {
    id: "volleyS",
    label: "LaunchAll with the launcher at speed: settle, then the set feed",
    times: "LaunchAll (and Empty once it ends)",
    fallback: 0.8,
    range: [0, 8],
  },
  {
    id: "tipStartS",
    label: "Volley ends → HIVE starts to swing (flight + landing)",
    times: "Tip; negative if it starts before the last shot",
    fallback: 0.6,
    range: [-2, 3],
    allowNegative: true,
  },
  {
    id: "tipSwingS",
    label: "HIVE swing, start → other CELL settled up",
    times: "LeftCellUp / RightCellUp",
    fallback: 0.7,
    range: [0, 4],
  },
  {
    id: "intakeFullS",
    label: "Intake full in a FLOWER pick: push starts → full",
    times:
      "IntakeFull, from the start of the wait; full stays full until a volley",
    fallback: 1.5,
    range: [0, 6],
  },
  {
    id: "tipLoad",
    label: "Weight that TIPs an empty raised CELL",
    times: "how many volleys a TIP needs",
    fallback: 8,
    range: [4, 16],
    unit: "POLLEN",
  },
  {
    id: "startLoad",
    label: "Weight already in the CELL raised at the start (3 NECTAR)",
    times: "TIP 1: the 3rd POLLEN tips it",
    fallback: 5,
    range: [0, 10],
    unit: "POLLEN",
  },
  {
    id: "volleyLoad",
    label: "Weight one volley lands in the CELL (4 POLLEN, less for misses)",
    times: "how much each volley adds",
    fallback: 4,
    range: [1, 8],
    unit: "POLLEN",
  },
  {
    id: "driveSpeed",
    label: "Driving speed, against the paths' planned speed",
    times: "every path (1 = as planned, 0.8 = 20% slower)",
    fallback: 1,
    unit: "×",
    range: [0.5, 1.5],
  },
];

/**
 * The facts that belong to one robot (how it drives, launches and intakes, and how many of its
 * shots land); the rest are the HIVE's, shared by every robot on the field.
 */
export const ROBOT_FACTS: readonly string[] = [
  "driveSpeed",
  "spinUpS",
  "volleyS",
  "intakeFullS",
  "volleyLoad",
];

/** The command whose run is a volley. */
export const VOLLEY_COMMAND = "LaunchAll";
/** The command that starts the launcher and finishes at once (biobuzz LaunchCards.spinUp). */
export const SPIN_UP_COMMAND = "SpinUp";

export type TimingValues = Record<string, number>;

/** One fact as the team's file has it. */
export interface TeamFact {
  value: number;
  /** Where the number came from: "sim", "estimate", "measured". */
  source?: string;
  note?: string;
}

/** `TeamCode/autos/timing.json`. */
export interface TimingFile {
  version: 1;
  facts: Record<string, TeamFact>;
}

export function fallbackValues(): TimingValues {
  return Object.fromEntries(FACTS.map((f) => [f.id, f.fallback]));
}

/** A usable number for `fact`, else null. */
export function cleanValue(fact: TimingFact, raw: unknown): number | null {
  const n = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
  if (typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 60)
    return null;
  if (n < 0 && !fact.allowNegative) return null;
  if (n <= 0 && (fact.unit === "×" || fact.id === "tipLoad")) return null;
  return n;
}

/** Reads timing.json: the facts it knows, each checked; unknown or bad entries are dropped. */
export function parseTimingFile(text: string): TimingFile {
  const data = JSON.parse(text);
  const raw =
    data &&
    typeof data === "object" &&
    data.facts &&
    typeof data.facts === "object"
      ? data.facts
      : {};
  const facts: Record<string, TeamFact> = {};
  for (const fact of FACTS) {
    const entry = raw[fact.id];
    const value = cleanValue(
      fact,
      entry && typeof entry === "object" ? entry.value : entry,
    );
    if (value === null) continue;
    facts[fact.id] = {
      value,
      source: typeof entry?.source === "string" ? entry.source : undefined,
      note: typeof entry?.note === "string" ? entry.note : undefined,
    };
  }
  return { version: 1, facts };
}

/** The file for `values`, keeping the team file's notes and marking changed values as estimates. */
export function timingFileText(
  values: TimingValues,
  team: TimingFile | null,
): string {
  const facts: Record<string, TeamFact> = {};
  for (const fact of FACTS) {
    const before = team?.facts[fact.id];
    const value = values[fact.id] ?? fact.fallback;
    const changed = !before || Math.abs(before.value - value) > 1e-9;
    facts[fact.id] = {
      value,
      source: changed ? "estimate" : before?.source,
      ...(before?.note ? { note: before.note } : {}),
    };
  }
  return JSON.stringify({ version: 1, facts }, null, 2) + "\n";
}

/** One TIP: the HIVE leaves its stop at `start` and settles the other way at `settled`. */
export interface Tip {
  start: number;
  settled: number;
}

/** A volley on the field's clock: when it ended, and which robot (its index in the entries) fired it. */
export interface Volley {
  t: number;
  robot: number;
  /** What it lands in the raised CELL, when its robot's differs from `volleyLoad`. */
  load?: number;
}

/** What one volley did to the HIVE. */
export interface VolleyEffect extends Volley {
  /** False when it landed mid-swing, so its pieces did not count. */
  counted: boolean;
  /** Weight in the raised CELL just after it landed (before the TIP it may start). */
  load: number;
  /** The TIP it started, by index in `tips`, or null. */
  tip: number | null;
}

/** A TIP and the volley that started it (index in `volleys`). */
export interface CausedTip extends Tip {
  cause: number;
}

/**
 * The HIVE over the Auto: each volley ending on a settled HIVE adds to the raised CELL, and the one
 * that brings it to `tipLoad` TIPs it. Volleys come back sorted by time.
 */
export function hiveHistory(
  volleys: Volley[],
  values: TimingValues,
): { volleys: VolleyEffect[]; tips: CausedTip[] } {
  const tips: CausedTip[] = [];
  const effects: VolleyEffect[] = [];
  let settledAt = -Infinity;
  let load = values.startLoad;
  for (const volley of [...volleys].sort((a, b) => a.t - b.t)) {
    if (volley.t < settledAt - 1e-9) {
      // Mid-swing: the pieces do not count.
      effects.push({ ...volley, counted: false, load, tip: null });
      continue;
    }
    load += volley.load ?? values.volleyLoad;
    const effect: VolleyEffect = { ...volley, counted: true, load, tip: null };
    effects.push(effect);
    if (load < values.tipLoad - 1e-9) continue;
    load = 0;
    const start = Math.max(0, volley.t + values.tipStartS);
    const settled = start + Math.max(0, values.tipSwingS);
    effect.tip = tips.length;
    tips.push({ start, settled, cause: effects.length - 1 });
    settledAt = settled;
  }
  return { volleys: effects, tips };
}

/**
 * The TIPs a set of volley end times makes: each volley ending on a settled HIVE adds to the raised
 * CELL, and the one that brings it to `tipLoad` TIPs it.
 */
export function tipsFrom(volleyEnds: number[], values: TimingValues): Tip[] {
  return hiveHistory(
    volleyEnds.map((t) => ({ t, robot: 0 })),
    values,
  ).tips.map(({ start, settled }) => ({ start, settled }));
}

/**
 * Whether a robot at `y` (Pedro frame, inches) is aimed at its LEFT CELL with the turret at home:
 * the CELL at its end of the field. The Visualizer draws RED, whose LEFT is the scoring end, past
 * the field's centre (biobuzz `AutoRegistration.aimedLeft`).
 */
export function aimedLeft(y: number): boolean {
  return y >= FIELD_SIZE / 2;
}

/** Which CELL is settled up at `t`, counting TIPs; null while one swings. The match starts right up. */
export function cellUpAt(tips: Tip[], t: number): "right" | "left" | null {
  let done = 0;
  for (const tip of tips) {
    if (t >= tip.settled - 1e-9) done += 1;
    else if (t >= tip.start - 1e-9) return null;
  }
  return done % 2 === 0 ? "right" : "left";
}

/** The first time at or after t0 the given CELL is settled up (Infinity: never). */
function cellUpFrom(tips: Tip[], t0: number, cell: "right" | "left"): number {
  const candidates = [
    t0,
    ...tips.map((tip) => tip.settled).filter((s) => s > t0),
  ];
  for (const t of candidates) if (cellUpAt(tips, t) === cell) return t;
  return Infinity;
}

/**
 * Conditions that mean "a CELL tipped". `Tip` is the camera's; the others are the tracker's, and
 * `CellUp` is the CELL the robot is aimed at (the simple builder's one wait).
 */
export const TIP_CONDITIONS = ["Tip", "LeftCellUp", "RightCellUp", "CellUp"];

/**
 * The preview's answers for one robot, for these values and TIPs. It keeps that robot's state (is
 * the intake full? since when has the launcher spun?), so make one per robot per preview.
 */
export function previewTiming(
  values: TimingValues,
  tips: Tip[],
): PreviewTiming {
  // The robot starts with its preloads: full.
  let full = true;
  // When the launcher was first asked to spin (SpinUp or a LaunchAll); it is left spinning after.
  let spunAt: number | null = null;
  return {
    commandRan(name, t0, _t1, fed = true) {
      if (
        (name === SPIN_UP_COMMAND || name === VOLLEY_COMMAND) &&
        spunAt === null
      )
        spunAt = t0;
      if (name === VOLLEY_COMMAND && fed) full = false;
    },
    becameTrue(condition) {
      if (condition === "IntakeFull") full = true;
    },
    actionSeconds(name, t0 = 0) {
      if (name === SPIN_UP_COMMAND) return 0;
      if (name === VOLLEY_COMMAND) {
        // A launch waits for speed first: the rest of the spin-up from when it was asked, or all
        // of it from rest.
        const ready = (spunAt ?? t0) + values.spinUpS;
        return Math.max(0, ready - t0) + values.volleyS;
      }
      return undefined;
    },
    feedStartsAt(name, t0) {
      // The feeder runs once the launcher is at speed (the settle is counted with the feed).
      if (name !== VOLLEY_COMMAND) return undefined;
      return Math.max(t0, (spunAt ?? t0) + values.spinUpS);
    },
    trueAt(condition, t0, at) {
      switch (condition) {
        case "CellUp":
          // With no pose (never in a preview), the robot's end is taken to be RIGHT's.
          return cellUpFrom(tips, t0, at && aimedLeft(at.y) ? "left" : "right");
        case "RightCellUp":
          return cellUpFrom(tips, t0, "right");
        case "LeftCellUp":
          return cellUpFrom(tips, t0, "left");
        case "Tip": {
          // A TIP already under way when the wait starts counts, as on the robot.
          const tip = tips.find((tip) => tip.settled > t0 + 1e-9);
          return tip ? Math.max(t0, tip.start) : Infinity;
        }
        case "CameraBlind":
          return Infinity;
        case "IntakeFull":
          return full ? t0 : t0 + values.intakeFullS;
        case "Empty":
          return full ? undefined : t0;
      }
      return undefined;
    },
  };
}
