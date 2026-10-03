/**
 * The simulator's latest result for a pair, read from biobuzz's `sim-results` branch
 * (`<first Auto>/latest.json`, written by the "Simulate Auto" workflow), for the tandem view:
 * the summary, and each robot's simulated timeline as lane blocks next to the preview's.
 */
import { SIM_RESULTS_BRANCH } from "../sim/biobuzz";
import { fetchText, TEAM_DIR, TEAM_REPO, type FetchText } from "./teamAutos";
import { robotName, type LaneBlock } from "./tandem";

/** One robot in one simulated run. */
export interface SimRobot {
  auto: string;
  launched: number | null;
  finishedAt: number | null;
  park: boolean | null;
  timeline: string[];
}

export interface SimRun {
  seed: number;
  points: number | null;
  autoTips: number | null;
  tipsAt: number[];
  robotsCollidedAt: number | null;
  robots: SimRobot[];
}

export interface SimResult {
  auto: string;
  design: string | null;
  partnerDesign: string | null;
  commit: string | null;
  branch: string | null;
  finishedAt: string | null;
  runUrl: string | null;
  typicalSeed: number | null;
  bestSeed: number | null;
  runs: SimRun[];
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

/** Reads latest.json; throws a message when it is not a result. */
export function parseSimResult(text: string): SimResult {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("The simulation result is not readable.");
  }
  if (!data || typeof data !== "object" || !Array.isArray(data.runs)) {
    throw new Error("The simulation result has no runs.");
  }
  const runs: SimRun[] = [];
  for (const raw of data.runs as Record<string, unknown>[]) {
    if (!raw || typeof raw !== "object" || num(raw.seed) === null) continue;
    const robots: SimRobot[] = Array.isArray(raw.robots)
      ? (raw.robots as Record<string, unknown>[])
          .filter((r) => r && typeof r.auto === "string")
          .map((r) => ({
            auto: r.auto as string,
            launched: num(r.launched),
            finishedAt: num(r.finishedAt),
            park: typeof r.park === "boolean" ? r.park : null,
            timeline: Array.isArray(r.timeline)
              ? r.timeline.filter((l): l is string => typeof l === "string")
              : [],
          }))
      : [];
    runs.push({
      seed: raw.seed as number,
      points: num(raw.points),
      autoTips: num(raw.autoTips),
      tipsAt: Array.isArray(raw.tipsAt)
        ? raw.tipsAt.filter((t): t is number => typeof t === "number")
        : [],
      robotsCollidedAt: num(raw.robotsCollidedAt),
      robots,
    });
  }
  return {
    auto: str(data.auto) ?? "",
    design: str(data.design),
    partnerDesign: str(data.partnerDesign),
    commit: str(data.commit),
    branch: str(data.branch),
    finishedAt: str(data.finishedAt),
    runUrl: str(data.runUrl),
    typicalSeed: num(data.typicalSeed),
    bestSeed: num(data.bestSeed),
    runs,
  };
}

/** Where the latest result for a pair is: under its first Auto's name. */
export function simResultUrl(files: string[]): string {
  return `https://raw.githubusercontent.com/${TEAM_REPO}/${SIM_RESULTS_BRANCH}/${encodeURIComponent(robotName(files[0]))}/latest.json`;
}

/**
 * Why a result is not this pair's (null when it is): the result names the robots it ran, and a
 * solo run, or a run with another partner, says nothing about this pair.
 */
export function pairMismatch(
  result: SimResult,
  files: string[],
): string | null {
  const run = result.runs[0];
  if (!run) return "it has no runs";
  const ran = run.robots.map((r) => r.auto).sort();
  const want = files.map(robotName).sort();
  if (ran.length === want.length && ran.every((name, i) => name === want[i]))
    return null;
  return `its latest run was ${ran.join(" + ") || "no robots"}, not ${want.join(" + ")}`;
}

/** A run by seed, or the typical one, or the first. */
export function pickRun(
  result: SimResult,
  which: "typical" | "best",
): SimRun | null {
  const seed = which === "best" ? result.bestSeed : result.typicalSeed;
  return result.runs.find((run) => run.seed === seed) ?? result.runs[0] ?? null;
}

const LINE = /^\s*(\d+(?:\.\d+)?)\s+(.*)$/;

/**
 * A simulated timeline as lane blocks. The simulator logs `wait <label>` when a wait starts and
 * `<label>: <why> after <s> s` when it ends, `path <from> to <to>` when a drive starts (it ends
 * when the next step starts) and `command <name>` (a mark: commands run alongside).
 */
export function simLane(lines: string[], end: number | null): LaneBlock[] {
  const entries = lines
    .map((line) => LINE.exec(line))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ t: Number(m[1]), text: m[2] }));
  const last = end ?? Math.max(30, entries[entries.length - 1]?.t ?? 0);
  const blocks: LaneBlock[] = [];
  const openWaits = new Map<string, LaneBlock>();
  let drive: LaneBlock | null = null;
  const closeDrive = (t: number) => {
    if (drive) drive.t1 = Math.max(drive.t0, t);
    drive = null;
  };
  for (const { t, text } of entries) {
    if (text.startsWith("path ")) {
      closeDrive(t);
      drive = {
        kind: "drive",
        t0: t,
        t1: t,
        label: text.slice(5),
        cardId: null,
        linked: false,
        timedOut: false,
      };
      blocks.push(drive);
    } else if (text.startsWith("wait ")) {
      closeDrive(t);
      const label = text.slice(5);
      const block: LaneBlock = {
        kind: "wait",
        t0: t,
        t1: last,
        label,
        cardId: null,
        linked: false,
        timedOut: false,
      };
      openWaits.set(label, block);
      blocks.push(block);
    } else if (text.startsWith("command ")) {
      blocks.push({
        kind: "command",
        t0: t,
        t1: t,
        label: text.slice(8),
        cardId: null,
        linked: false,
        timedOut: false,
      });
    } else {
      const colon = text.indexOf(": ");
      const wait = colon > 0 ? openWaits.get(text.slice(0, colon)) : undefined;
      if (wait) {
        wait.t1 = t;
        wait.timedOut = /ms passed/.test(text);
        openWaits.delete(text.slice(0, colon));
      }
    }
  }
  closeDrive(last);
  return blocks;
}

/** The last change to a file on a branch, from GitHub's API (null when it cannot tell). */
export async function lastChange(
  ref: string,
  file: string,
  get: FetchText = fetchText,
): Promise<{ sha: string; date: string } | null> {
  const url = `https://api.github.com/repos/${TEAM_REPO}/commits?sha=${encodeURIComponent(ref)}&path=${encodeURIComponent(`${TEAM_DIR}/${file}`)}&per_page=1`;
  try {
    const text = await get(url);
    if (!text) return null;
    const list = JSON.parse(text);
    const top = Array.isArray(list) ? list[0] : null;
    const date = top?.commit?.committer?.date;
    return typeof top?.sha === "string" && typeof date === "string"
      ? { sha: top.sha, date }
      : null;
  } catch {
    return null;
  }
}

/** The pair's result, or why there is none to show. */
export async function loadSimResult(
  files: string[],
  get: FetchText = fetchText,
): Promise<{ result: SimResult } | { missing: string }> {
  let text: string | null;
  try {
    text = await get(simResultUrl(files));
  } catch {
    return {
      missing: "GitHub could not be reached for the simulation result.",
    };
  }
  if (text === null)
    return { missing: `${robotName(files[0])} has not been simulated yet.` };
  try {
    return { result: parseSimResult(text) };
  } catch (error) {
    return { missing: (error as Error).message };
  }
}
