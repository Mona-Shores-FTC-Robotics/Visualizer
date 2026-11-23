/**
 * Past runs, kept in this browser's localStorage: each driver's laptop keeps its own. Every read
 * and write is guarded, so a private window or blocked storage only loses the history.
 */
import type { DrillMode, RunResult } from "./session";

export const HISTORY_KEY = "biobuzz-drill-history-v1";
const KEEP = 200;

export interface StoredRun {
  /** Robot 1's team; an alliance run lists both in `teams`. */
  team: number;
  teams?: number[];
  mode: DrillMode;
  date: string;
  tips: number;
  goalAtS: number | null;
  balls: number;
  cycles: number;
  bestCycleS: number | null;
  medianCycleS: number | null;
  bestPickUpS: number | null;
}

export function summarize(r: RunResult): StoredRun {
  const c = r.cycles.map((x) => x.cycleS).sort((a, b) => a - b);
  const p = r.pickUps.map((x) => x.s);
  return {
    team: r.team,
    teams: r.robots.map((x) => x.team),
    mode: r.mode,
    date: r.date,
    tips: r.tips,
    goalAtS: r.goalAtS,
    balls: r.balls,
    cycles: c.length,
    bestCycleS: c.length ? c[0] : null,
    medianCycleS: c.length ? c[Math.floor(c.length / 2)] : null,
    bestPickUpS: p.length ? Math.min(...p) : null,
  };
}

export function loadHistory(
  storage: Storage | null = safeStorage(),
): StoredRun[] {
  try {
    const raw = storage?.getItem(HISTORY_KEY);
    const list = raw ? (JSON.parse(raw) as StoredRun[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveRun(
  run: StoredRun,
  storage: Storage | null = safeStorage(),
): StoredRun[] {
  const list = [...loadHistory(storage), run].slice(-KEEP);
  try {
    storage?.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked: the run is still shown */
  }
  return list;
}

/** Better first: more TIPs, then the 7th sooner, then the faster median cycle. */
export function compareRuns(a: StoredRun, b: StoredRun): number {
  if (a.tips !== b.tips) return b.tips - a.tips;
  const ga = a.goalAtS ?? Infinity,
    gb = b.goalAtS ?? Infinity;
  if (ga !== gb) return ga - gb;
  return (a.medianCycleS ?? Infinity) - (b.medianCycleS ?? Infinity);
}

export function bestRun(
  list: StoredRun[],
  team: number,
  mode?: string,
): StoredRun | null {
  const mine = list.filter(
    (r) => r.team === team && (!mode || r.mode === mode),
  );
  return mine.length ? [...mine].sort(compareRuns)[0] : null;
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
