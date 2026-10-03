/**
 * Typical timing for the preview: a few facts about how the robot and the HIVE behave (how long a
 * volley takes, how soon a TIP follows it, how long a catch takes), so a wait in the preview ends
 * when it typically would instead of the moment it is asked.
 *
 * The facts describe the world, not one Auto: they live in one file the team edits,
 * `TeamCode/autos/timing.json` in biobuzz, never in a `.pp`. A `.pp` says what the robot does
 * (paths, cards, and how long each wait may last); this says how the world behaves. Nothing here
 * changes what the robot does or what the exporter writes.
 *
 * TIPs come from the Autos themselves: every volley (a wait with LaunchAll alongside) that ends
 * while the HIVE is settled lands `volleyLoad` in the raised CELL. Once that CELL holds `tipLoad`
 * (the one raised at the start begins with `startLoad`, its 3 NECTAR), the HIVE starts to swing
 * `tipStartS` after the volley ends and settles the other way `tipSwingS` later; the CELL it raises
 * starts empty. With several Autos on the field together their volleys share one HIVE, so
 * the left robot's "our CELL up" waits on the right robot's volley.
 */
import type { PreviewTiming } from "../auto/simulate";

/** One fact the team estimates, then measures. */
export interface TimingFact {
  id: string;
  /** What it is, in plain words. */
  label: string;
  /** What in an Auto it times. */
  times: string;
  /** The value before anyone sets one: the simulator's. */
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
    label: "Spin up the launcher",
    times: "the SpinUp command",
    fallback: 0.1,
    range: [0, 3],
  },
  {
    id: "volleyS",
    label: "Volley: LaunchAll starts → robot empty",
    times: "LaunchAll (and Empty while it runs)",
    fallback: 0.8,
    range: [0, 5],
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
    times: "LeftCellUp / RightCellUp / HiveTipped",
    fallback: 0.7,
    range: [0, 4],
  },
  {
    id: "intakeFullS",
    label: "Intake full: catching a spill or taking a FLOWER, once there",
    times:
      "IntakeFull, from the start of the wait; full stays full until a volley or set-down",
    fallback: 1.5,
    range: [0, 6],
  },
  {
    id: "collectSeenS",
    label: "Collect what the webcam sees",
    times: "the CollectSeen command",
    fallback: 2.0,
    range: [0, 6],
  },
  {
    id: "setDownS",
    label: "Set 4 pieces down (reversed intake)",
    times: "the SetDown command",
    fallback: 1.0,
    range: [0, 4],
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
  {
    id: "launcherReadyS",
    label: "Launcher ready again",
    times: "LauncherReady, from the start of the wait",
    fallback: 0.8,
    range: [0, 3],
  },
];

/** The command whose run is a volley. */
export const VOLLEY_COMMAND = "LaunchAll";

const ACTION_FACT: Record<string, string> = {
  SpinUp: "spinUpS",
  LaunchAll: "volleyS",
  CollectSeen: "collectSeenS",
  SetDown: "setDownS",
};
const WAIT_FACT: Record<string, string> = {
  LauncherReady: "launcherReadyS",
};

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

/**
 * The TIPs a set of volley end times makes: each volley ending on a settled HIVE adds to the raised
 * CELL, and the one that brings it to `tipLoad` TIPs it.
 */
export function tipsFrom(volleyEnds: number[], values: TimingValues): Tip[] {
  const tips: Tip[] = [];
  let settledAt = -Infinity;
  let load = values.startLoad;
  for (const end of [...volleyEnds].sort((a, b) => a - b)) {
    if (end < settledAt - 1e-9) continue; // mid-swing: the pieces do not count
    load += values.volleyLoad;
    if (load < values.tipLoad - 1e-9) continue;
    load = 0;
    const start = Math.max(0, end + values.tipStartS);
    const settled = start + Math.max(0, values.tipSwingS);
    tips.push({ start, settled });
    settledAt = settled;
  }
  return tips;
}

/** Which CELL is settled up at `t`, counting TIPs; null while one swings. The match starts right up. */
function cellUpAt(tips: Tip[], t: number): "right" | "left" | null {
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

/** Commands that leave the robot empty. */
const EMPTIES = new Set([VOLLEY_COMMAND, "SetDown"]);

/**
 * The preview's answers for one robot, for these values and TIPs. It keeps that robot's state (is
 * the intake full?), so make one per robot per preview.
 */
export function previewTiming(
  values: TimingValues,
  tips: Tip[],
): PreviewTiming {
  // The robot starts with its preloads: full.
  let full = true;
  return {
    commandRan(name) {
      if (EMPTIES.has(name)) full = false;
    },
    becameTrue(condition) {
      if (condition === "IntakeFull") full = true;
    },
    actionSeconds(name) {
      const fact = ACTION_FACT[name];
      return fact ? values[fact] : undefined;
    },
    trueAt(condition, t0) {
      switch (condition) {
        case "RightCellUp":
          return cellUpFrom(tips, t0, "right");
        case "LeftCellUp":
        case "HiveTipped":
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
      const fact = WAIT_FACT[condition];
      return fact ? t0 + values[fact] : undefined;
    },
  };
}
