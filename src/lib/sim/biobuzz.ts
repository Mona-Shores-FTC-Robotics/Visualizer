/**
 * "Save to GitHub"'s rules: where in biobuzz an Auto's files go, what the
 * "Simulate Auto" workflow is asked to run (TeamCode/sim-request.json), where
 * it publishes the result (the sim-results branch), and how seeds add up.
 */

import { TEAM_DIR, teamFileOf } from "../team/teamAutos";

/** Folders of biobuzz that hold Auto Builder .pp files. */
export const PP_DIRS = [
  "TeamCode/autos",
  "TeamCode/src/test/resources/auto-builder",
] as const;

const GENERATED = "org/firstinspires/ftc/teamcode/opmodes/auto/generated";
/** Where generated Autos live: the robot's, and the simulation-only ones. */
export const GENERATED_DIRS = [
  `TeamCode/src/main/java/${GENERATED}`,
  `TeamCode/src/test/java/${GENERATED}`,
] as const;

/**
 * The file the workflow watches on a branch other than master's fast lane; one commit carries it
 * with the .pp and its Java.
 */
export const SIM_REQUEST_PATH = "TeamCode/sim-request.json";
/** On the fast lane each Auto has its own request, so two Autos in flight never conflict. */
export const SIM_REQUESTS_DIR = "TeamCode/sim-requests";
export const SIM_RESULTS_BRANCH = "sim-results";
/** The workflow's name, as GitHub lists its runs. */
export const SIM_WORKFLOW = "Simulate Auto";
/**
 * Where saves go unless the file was opened from another branch: master, through the fast lane
 * ({@link laneBranch}). The simulator is on master since 31 Oct 2026.
 */
export const DEFAULT_BRANCH = "master";
/** The branch the fast lane merges into. */
export const FAST_LANE_BASE = "master";

/**
 * What a request with no design of its own asks for: the one robot the team has, over ten seeds, as
 * RED. A request that names a design (or seeds, or an alliance) keeps its own: the Visualizer's
 * dialog has no choice of robot or partner, a mentor curates the request in biobuzz.
 */
export const DEFAULT_SIM_DESIGN = "real robot";
export const SAVE_SEEDS = 10;
export const SAVE_ALLIANCE = "RED";

/** Why `path` is not a .pp that "Save to GitHub" may write, or null if it is. */
export function ppPathProblem(path: string): string | null {
  if (!path.endsWith(".pp")) return `${path} is not a .pp file`;
  if (path.includes("\\") || path.startsWith("/") || /^[a-zA-Z]:/.test(path)) {
    return `${path}: use a path inside biobuzz, with forward slashes`;
  }
  const parts = path.split("/");
  if (parts.some((part) => part === "" || part === "." || part === ".."))
    return `${path} is not a plain path`;
  if (!PP_DIRS.some((dir) => path.startsWith(`${dir}/`))) {
    return `${path} is outside ${PP_DIRS.join(" and ")}`;
  }
  return null;
}

/**
 * The fast lane's branch for an Auto: one per Auto, so a second save while its pull request is
 * open adds to that pull request rather than opening another.
 */
export function laneBranch(ppPath: string): string {
  return `auto/${simAutoName(ppPath).replace(/[^A-Za-z0-9._-]+/g, "-")}`;
}

/**
 * The Auto's own request, TeamCode/sim-requests/<name>.json: where biobuzz keeps its runs (the
 * partners a mentor curated), whichever file a save writes.
 */
export function simOwnRequestPath(ppPath: string): string {
  return `${SIM_REQUESTS_DIR}/${simAutoName(ppPath)}.json`;
}

/** Where a save's simulation request goes: the Auto's own file on the fast lane, else the shared one. */
export function simRequestPath(ppPath: string, viaFastLane: boolean): string {
  return viaFastLane ? simOwnRequestPath(ppPath) : SIM_REQUEST_PATH;
}

/** The branches "Save to GitHub" never writes to: work reaches them by pull request. */
export function protectedBranch(branch: string): boolean {
  return branch === "master" || branch === "main";
}

export function baseName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/**
 * Where an Auto's generated class goes: where a class of that name already
 * is, else the robot's folder for TeamCode/autos and the simulation's for
 * everything else.
 */
export function generatedPathFor(
  ppPath: string,
  javaFileName: string,
  existing: string[],
): string {
  for (const dir of GENERATED_DIRS) {
    if (existing.includes(`${dir}/${javaFileName}`))
      return `${dir}/${javaFileName}`;
  }
  const dir = ppPath.startsWith(`${PP_DIRS[0]}/`)
    ? GENERATED_DIRS[0]
    : GENERATED_DIRS[1];
  return `${dir}/${javaFileName}`;
}

/**
 * The run in AutoStudyTest's terms: our Auto's class. No "@speed": the simulator's default (50 in/s)
 * is the Visualizer's preview speed. The partner, when there is one, is each run's own
 * ({@link SimRunPlan}), never part of the spec the Visualizer writes.
 */
export function simSpec(autoClass: string): string {
  return autoClass;
}

/**
 * The .pp in biobuzz that the project on screen is: the one it was opened
 * from, else the only one with its file name, else "" — never a guess at a
 * new file, which the person must name on purpose.
 */
export function suggestPpPath(
  fileName: string,
  openedFrom: string | null,
  known: string[],
): string {
  if (openedFrom) return openedFrom;
  if (!fileName) return "";
  // A Team Autos copy (biobuzz-drafts-x.pp) goes back to the file it was copied from.
  const team = teamFileOf(fileName);
  if (team) return `${TEAM_DIR}/${team}`;
  const name = fileName.endsWith(".pp") ? fileName : `${fileName}.pp`;
  const same = known.filter((path) => baseName(path) === name);
  return same.length === 1 ? same[0] : "";
}

export interface SimRequestOptions {
  ppPath: string;
  spec: string;
  savedBy: string;
  /**
   * The Auto's request as biobuzz has it (TeamCode/sim-requests/<name>.json on the branch, else
   * master), or null for an Auto with none yet. Everything in it that the save does not own
   * (`partners`, `partnerSeeds`, `design`, `seeds`, `alliance`, `title`, anything else) is kept as
   * it is, in the order it was in.
   */
  existing?: SimRequest | null;
}

/** One run beside a partner stand-in, as a mentor curated it in the request's `partners`. */
export interface SimPartnerEntry {
  /** The row's name in the results; SimRunTest falls back to the timing's own words. */
  name?: string;
  /** The stand-in's generated class (`PartnerLLaunchParkAuto`, from `TeamCode/autos/partners/`). */
  partner: string;
  timing?: Record<string, unknown>;
  [key: string]: unknown;
}

/** TeamCode/sim-requests/<name>.json as biobuzz holds it; only the fields the Visualizer reads. */
export interface SimRequest {
  pp?: string;
  spec?: string;
  design?: string;
  seeds?: number[];
  partnerSeeds?: number[];
  alliance?: string;
  partners?: unknown;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/** The fields of a request that every save writes; everything else in it is biobuzz's. */
const OWN_FIELDS = ["pp", "spec", "metadata"];

/**
 * The request's text. A save writes which Auto to run (`pp`, `spec`) and what to stamp on each log
 * (`metadata`). Whatever biobuzz's copy had besides is carried through unchanged and in its order,
 * above all the curation (`partners`, `partnerSeeds`): rewriting the file from the dialog alone
 * would drop it. A request with no robot design, seeds or alliance gets the defaults.
 */
export function simRequestText(o: SimRequestOptions, now = new Date()): string {
  const own: Record<string, unknown> = {
    pp: o.ppPath,
    spec: o.spec,
    metadata: {
      AutoSource: baseName(o.ppPath),
      SavedBy: o.savedBy,
      SavedAt: now.toISOString(),
    },
  };
  const defaults: Record<string, unknown> = {
    design: DEFAULT_SIM_DESIGN,
    seeds: Array.from({ length: SAVE_SEEDS }, (_, i) => i + 1),
    alliance: SAVE_ALLIANCE,
  };
  const request: Record<string, unknown> = {};
  // The file's own keys first, in its order (a small diff), then what it lacks.
  for (const [key, value] of Object.entries(o.existing ?? {})) {
    request[key] = OWN_FIELDS.includes(key) ? own[key] : value;
  }
  for (const key of ["pp", "spec", "design", "seeds", "alliance", "metadata"]) {
    if (!(key in request)) request[key] = own[key] ?? defaults[key];
  }
  return `${JSON.stringify(request, null, 2)}\n`;
}

/** Reads a request's text; null when it is not one. */
export function parseSimRequest(text: string | null): SimRequest | null {
  if (text === null) return null;
  try {
    const data = JSON.parse(text);
    return data && typeof data === "object" && !Array.isArray(data)
      ? (data as SimRequest)
      : null;
  } catch {
    return null;
  }
}

/** A Java class name, as a run's partner must be. */
const NAME = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** One run the request asks for, for the words before a save: the Auto alone, or beside a stand-in. */
export interface SimPlanRun {
  /** The stand-in's class, null for the Auto alone. */
  partner: string | null;
  /** The row's name: "alone", else the request's `name`, else the stand-in in words. */
  name: string;
}

/**
 * The runs a request asks for, as SimRunTest reads them: the Auto alone first, then each of its
 * `partners` that names a stand-in class, in order. The Visualizer never adds one: a mentor curates
 * the partners in biobuzz.
 */
export function simPlan(request: SimRequest | null): SimPlanRun[] {
  const out: SimPlanRun[] = [{ partner: null, name: "alone" }];
  if (Array.isArray(request?.partners)) {
    for (const entry of request.partners) {
      if (!entry || typeof entry !== "object") continue;
      const { partner, name } = entry as { partner?: unknown; name?: unknown };
      if (typeof partner !== "string" || !NAME.test(partner)) continue;
      out.push({
        partner,
        name:
          typeof name === "string" && name.trim()
            ? name.trim()
            : partnerWords(partner),
      });
    }
  }
  return out;
}

/** "PartnerLStillAuto" → "L Still": the class name as words, without the parts every stand-in has. */
export function partnerWords(partnerClass: string): string {
  const stem = partnerClass.replace(/^Partner/, "").replace(/Auto$/, "");
  const words = stem
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .trim();
  return words || partnerClass;
}

/** "Will simulate: alone; L Launch Park (lands at 2 s), …". */
export function simPlanSentence(runs: SimPlanRun[]): string {
  return `Will simulate: ${runs
    .map((r) =>
      r.partner === null || r.name === partnerWords(r.partner)
        ? r.name
        : `${partnerWords(r.partner)}, ${r.name}`,
    )
    .join("; ")}`;
}

/** The Auto's name on sim-results: its .pp file name without ".pp". */
export function simAutoName(ppPath: string): string {
  return baseName(ppPath).replace(/\.pp$/, "");
}

/**
 * Where the Auto's results sit on sim-results: `<auto>/<commit>/result.json` (with the Auto alone's
 * logs beside it, and `entries`, a row for every run), `<auto>/latest.json` for the newest. A
 * partner run's own result and logs are in {@link simEntryFolder}.
 */
export function simResultPath(ppPath: string, commit: string): string {
  return `${simAutoName(ppPath)}/${commit}/result.json`;
}

export function simLatestPath(ppPath: string): string {
  return `${simAutoName(ppPath)}/latest.json`;
}

/**
 * Where an entry's own result and logs sit: `<auto>/<commit>/<partner>/<timing>/`
 * (`r-solo/abc123/partner-l-still/default/`); the commit's own folder for the Auto alone, whose
 * entry has no folder. The newest of a partner run is `<auto>/with/<partner>/<timing>/latest.json`.
 */
export function simEntryFolder(result: SimResult, entry: SimEntry): string {
  return [result.auto, result.commit, entry.folder].filter(Boolean).join("/");
}

/** A published log's path on sim-results, for the entry (or the Auto alone, without one). */
export function simLogPath(
  result: SimResult,
  file: string,
  entry?: SimEntry,
): string {
  return `${entry ? simEntryFolder(result, entry) : `${result.auto}/${result.commit}`}/${file}`;
}

/** What the simulator writes for one robot in one run (SimRunTest). */
export interface SimRobot {
  auto: string;
  launched: number;
  finishedAt: number | null;
  leave: boolean;
  park: boolean;
  illegalStart: string | null;
  crossedAt: number | null;
  hitHiveAt: number | null;
  hitFlowerAt: number | null;
  timeline: string[];
}

/** One seed's run (SimRunTest). */
export interface SimRun {
  seed: number;
  log: string;
  points: number;
  autoTips: number;
  tipsAt: number[];
  launched: number;
  scored: number;
  cellLoad: number;
  held: number;
  robotsCollidedAt: number | null;
  robots: SimRobot[];
  summary: string;
}

/** How an Auto's first "wait for" ended in one seed (SimRunTest.waits). */
export interface SimWait {
  label: string;
  /** True when a trigger fired, false when the time ran out; null when AUTO ended first. */
  fired: boolean | null;
  /** The trigger that fired, or "timed out". */
  outcome: string | null;
  /** Seconds waited. */
  after: number | null;
  /** The match second the wait ended. */
  at: number | null;
}

/** One seed of an entry (SimRunTest.row): the compact line of the results table. */
export interface SimEntryRow {
  seed: number;
  log?: string;
  points: number;
  launched: number;
  /** The partner's launches; null without a partner. */
  partnerLaunched: number | null;
  tipsAt: number[];
  /** TIPs that count for AUTO; the rows before it was published count every TIP. */
  autoTips?: number;
  wait: SimWait | null;
  robotsCollidedAt: number | null;
  parked: boolean;
  partnerParked: boolean | null;
}

/**
 * One run in a result's `entries`: the Auto alone (first, no folder), then each partner at each
 * timing. A partner entry's own result and logs are in {@link simEntryFolder}.
 */
export interface SimEntry {
  name: string;
  folder: string;
  /** The stand-in's class, null for the Auto alone. */
  partner: string | null;
  /** The stand-in's `.pp` name (`partner-l-launch-park.pp`). */
  partnerSource?: string | null;
  timing?: Record<string, unknown> | null;
  meanPoints: number | null;
  bestSeed?: number | null;
  typicalSeed?: number | null;
  /** Seed → the .wpilog published for it, in the entry's folder. */
  logs?: Record<string, string>;
  rows: SimEntryRow[];
  error?: string;
}

/** What the workflow publishes: SimRunTest's result.json, and where it came from. */
export interface SimResult {
  designs?: string[];
  spec?: string;
  design?: string;
  alliance?: string;
  /** One row per run: the Auto alone, then each partner at each timing. Absent before 3 Nov 2026. */
  entries?: SimEntry[];
  runs?: SimRun[];
  error?: string;
  auto: string;
  commit: string;
  branch: string;
  pp: string;
  runUrl: string;
  finishedAt: string;
  typicalSeed: number | null;
  /** The best run's seed (absent in results from before it was published). */
  bestSeed?: number | null;
  /** Seed → the .wpilog published for it, beside result.json. */
  logs: Record<string, string>;
}

/**
 * The entry's best and typical seeds and logs. The Auto alone's entry carries none of its own: its
 * seeds and logs are the result's.
 */
export function entryLogs(
  result: SimResult,
  entry: SimEntry,
): {
  best: number | null;
  typical: number | null;
  logs: Record<string, string>;
} {
  const own = !!entry.folder;
  return {
    best: entry.bestSeed ?? (own ? null : (result.bestSeed ?? null)),
    typical: entry.typicalSeed ?? (own ? null : result.typicalSeed),
    logs: entry.logs ?? (own ? {} : result.logs),
  };
}

/** What went wrong for a robot in a run, in words; empty if nothing did. */
export function robotProblems(robot: SimRobot): string[] {
  const at = (t: number) => `${t.toFixed(1)} s`;
  const out: string[] = [];
  if (robot.illegalStart) out.push(`illegal start: ${robot.illegalStart}`);
  if (robot.crossedAt !== null)
    out.push(`crosses the centre line at ${at(robot.crossedAt)}`);
  if (robot.hitHiveAt !== null)
    out.push(`drives into the HIVE frame at ${at(robot.hitHiveAt)}`);
  if (robot.hitFlowerAt !== null)
    out.push(`drives into a FLOWER at ${at(robot.hitFlowerAt)}`);
  return out;
}

export function runProblems(run: SimRun): string[] {
  const out = run.robots.flatMap((robot) =>
    robotProblems(robot).map((p) => `${robot.auto}: ${p}`),
  );
  if (run.robotsCollidedAt !== null)
    out.push(`robots collide at ${run.robotsCollidedAt.toFixed(1)} s`);
  return out;
}

/** The seeds taken together, as AutoStudyTest prints them. */
export interface SimTally {
  runs: number;
  meanPoints: number;
  /** For TIP 1, 2, …: in how many runs it happened, and its mean time. */
  tips: { count: number; meanAt: number }[];
  parked: number;
  robots: number;
  /** Runs with an illegal start, a crossing, a collision or a robot in the HIVE or a FLOWER. */
  withProblems: number;
  /** The median run by points (the earlier seed on a tie): the one to watch. */
  typicalSeed: number | null;
  /** The best run: the most points, then the earliest last TIP, then the lower seed. */
  best: SimRun | null;
}

/** When a run's last TIP that counts for AUTO completed; Infinity with none. */
function lastTip(run: SimRun): number {
  return run.autoTips > 0 ? run.tipsAt[run.autoTips - 1] : Infinity;
}

export function tally(runs: SimRun[]): SimTally {
  const tips: { count: number; meanAt: number }[] = [];
  let points = 0;
  let parked = 0;
  let robots = 0;
  let withProblems = 0;
  for (const run of runs) {
    points += run.points;
    run.tipsAt.slice(0, run.autoTips).forEach((t, i) => {
      tips[i] ??= { count: 0, meanAt: 0 };
      tips[i].meanAt =
        (tips[i].meanAt * tips[i].count + t) / (tips[i].count + 1);
      tips[i].count++;
    });
    for (const robot of run.robots) {
      robots++;
      if (robot.leave && robot.park) parked++;
    }
    if (runProblems(run).length) withProblems++;
  }
  const sorted = [...runs].sort(
    (a, b) => a.points - b.points || a.seed - b.seed,
  );
  const typical = sorted.length
    ? sorted[Math.floor((sorted.length - 1) / 2)]
    : null;
  return {
    runs: runs.length,
    meanPoints: runs.length ? points / runs.length : 0,
    tips,
    parked,
    robots,
    withProblems,
    typicalSeed: typical ? typical.seed : null,
    best: runs.reduce<SimRun | null>(
      (best, run) =>
        !best ||
        run.points > best.points ||
        (run.points === best.points &&
          (lastTip(run) < lastTip(best) ||
            (lastTip(run) === lastTip(best) && run.seed < best.seed)))
          ? run
          : best,
      null,
    ),
  };
}

/** One results row's seeds taken together (see {@link tallyEntry}). */
export interface SimEntryTally {
  runs: number;
  meanPoints: number;
  /** For TIP 1, 2, …: in how many seeds it happened, and its mean time. */
  tips: { count: number; meanAt: number }[];
  /** Seeds in which we parked, and (with a partner) the partner did. */
  parked: number;
  partnerParked: number;
  /** Seeds whose first wait ended on a trigger, ran out its time, or was still open at the end. */
  waitFired: number;
  waitTimedOut: number;
  /** Mean seconds the first wait took, over the seeds that ended it; null if none did. */
  meanWaitAfter: number | null;
  /** Seeds in which the two robots' bodies overlapped, and the earliest second it happened. */
  collisions: number;
  firstCollisionAt: number | null;
  /** The seed's AUTO points, lowest to highest. */
  minPoints: number;
  maxPoints: number;
}

/** The seeds of one results row taken together: the row's cells in the Save & Simulate table. */
export function tallyEntry(rows: SimEntryRow[]): SimEntryTally {
  const tips: { count: number; meanAt: number }[] = [];
  let points = 0;
  let parked = 0;
  let partnerParked = 0;
  let waitFired = 0;
  let waitTimedOut = 0;
  let waitSum = 0;
  let waitEnded = 0;
  let collisions = 0;
  let firstCollisionAt: number | null = null;
  for (const row of rows) {
    points += row.points;
    row.tipsAt.slice(0, row.autoTips ?? row.tipsAt.length).forEach((t, i) => {
      tips[i] ??= { count: 0, meanAt: 0 };
      tips[i].meanAt =
        (tips[i].meanAt * tips[i].count + t) / (tips[i].count + 1);
      tips[i].count++;
    });
    if (row.parked) parked++;
    if (row.partnerParked) partnerParked++;
    if (row.wait?.fired === true) waitFired++;
    else if (row.wait?.fired === false) waitTimedOut++;
    if (row.wait?.after != null) {
      waitSum += row.wait.after;
      waitEnded++;
    }
    if (row.robotsCollidedAt !== null && row.robotsCollidedAt !== undefined) {
      collisions++;
      firstCollisionAt =
        firstCollisionAt === null
          ? row.robotsCollidedAt
          : Math.min(firstCollisionAt, row.robotsCollidedAt);
    }
  }
  return {
    runs: rows.length,
    meanPoints: rows.length ? points / rows.length : 0,
    tips,
    parked,
    partnerParked,
    waitFired,
    waitTimedOut,
    meanWaitAfter: waitEnded ? waitSum / waitEnded : null,
    collisions,
    firstCollisionAt,
    minPoints: rows.length ? Math.min(...rows.map((r) => r.points)) : 0,
    maxPoints: rows.length ? Math.max(...rows.map((r) => r.points)) : 0,
  };
}
