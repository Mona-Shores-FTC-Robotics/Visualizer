/**
 * "Save to GitHub"'s rules: where in biobuzz an Auto's files go, what the
 * "Simulate Auto" workflow is asked to run (TeamCode/sim-request.json), where
 * it publishes the result (the sim-results branch), and how seeds add up.
 */

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
 * What every save asks the simulator to run (mentor, 3 Nov 2026): the one robot the team has, its
 * turret locked forward and POLLEN only, over ten seeds, as RED. The dialog offers no choice: a
 * student presses Save, and like is compared with like.
 */
export const SAVE_DESIGN = "real robot, turret locked forward, POLLEN only";
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
   * master), or null for an Auto with none yet. Its `runs` (the partners a mentor curated) and any
   * other field the Visualizer does not own are kept as they are.
   */
  existing?: SimRequest | null;
}

/**
 * One run of an Auto in biobuzz's request: alone (`partner` null) or with a partner stand-in, a
 * generated class from `TeamCode/autos/partners/` (`"PartnerLStillAuto"`). `label` is optional, the
 * words the mentor chose for the stand-in ("L just parks"); without one the class name is read.
 */
export interface SimRunPlan {
  partner: string | null;
  label?: string;
}

/** TeamCode/sim-requests/<name>.json as biobuzz holds it; only the fields the Visualizer reads. */
export interface SimRequest {
  pp?: string;
  spec?: string;
  design?: string;
  seeds?: number[];
  alliance?: string;
  runs?: unknown;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/** The fields of a request the Visualizer writes; everything else in it is biobuzz's. */
const OWN_FIELDS = ["pp", "spec", "design", "seeds", "alliance", "metadata"];
/** The old per-save partner choice (gone 3 Nov 2026): a run's partner is in `runs` now. */
const RETIRED_FIELDS = ["partnerDesign", "partnerSpeed"];

/**
 * The request's text: the Auto's own fields (what to run, on which robot, how often, as whom, and
 * what to stamp on each log), then whatever biobuzz's copy had besides, its `runs` first of all.
 */
export function simRequestText(o: SimRequestOptions, now = new Date()): string {
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(o.existing ?? {})) {
    if (!OWN_FIELDS.includes(key) && !RETIRED_FIELDS.includes(key))
      kept[key] = value;
  }
  const request = {
    pp: o.ppPath,
    spec: o.spec,
    design: SAVE_DESIGN,
    seeds: Array.from({ length: SAVE_SEEDS }, (_, i) => i + 1),
    alliance: SAVE_ALLIANCE,
    metadata: {
      AutoSource: baseName(o.ppPath),
      SavedBy: o.savedBy,
      SavedAt: now.toISOString(),
    },
    ...kept,
  };
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

/**
 * The runs a request asks for: its `runs` that name a partner class or none, in order, the Auto
 * alone when it lists none (or has none). A run is never added by the Visualizer: a mentor curates
 * the partners in biobuzz.
 */
export function simRuns(request: SimRequest | null): SimRunPlan[] {
  const out: SimRunPlan[] = [];
  if (Array.isArray(request?.runs)) {
    for (const run of request.runs) {
      if (!run || typeof run !== "object") continue;
      const partner = (run as { partner?: unknown }).partner;
      if (
        partner !== null &&
        !(typeof partner === "string" && NAME.test(partner))
      )
        continue;
      if (out.some((r) => r.partner === (partner ?? null))) continue;
      const label = (run as { label?: unknown }).label;
      out.push(
        typeof label === "string" && label.trim()
          ? { partner: partner ?? null, label: label.trim() }
          : { partner: partner ?? null },
      );
    }
  }
  return out.length ? out : [{ partner: null }];
}

/** A run's words: "alone", or "with L just parks" (the label, else the class name in words). */
export function runLabel(run: SimRunPlan): string {
  if (run.partner === null) return "alone";
  return `with ${run.label ?? partnerWords(run.partner)}`;
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

/** "Will simulate: alone, with L just parks, with L does nothing". */
export function simPlanSentence(runs: SimRunPlan[]): string {
  return `Will simulate: ${runs.map(runLabel).join(", ")}`;
}

/** The key a run is filed under in a map: "" alone, else the partner's class. */
export function runKey(run: SimRunPlan): string {
  return run.partner ?? "";
}

/** The Auto's name on sim-results: its .pp file name without ".pp". */
export function simAutoName(ppPath: string): string {
  return baseName(ppPath).replace(/\.pp$/, "");
}

/**
 * Where a run's results sit on sim-results: the Auto's folder for the Auto alone, and
 * `<auto>/partners/<PartnerClass>` for a run with that partner (layout agreed with biobuzz's
 * "Simulate Auto" workflow, 3 Nov 2026). Each holds `latest.json` and `<commit>/result.json`
 * with that commit's logs beside it.
 */
export function simRunFolder(
  ppPath: string,
  partner: string | null = null,
): string {
  const auto = simAutoName(ppPath);
  return partner === null ? auto : `${auto}/partners/${partner}`;
}

export function simResultPath(
  ppPath: string,
  commit: string,
  partner: string | null = null,
): string {
  return `${simRunFolder(ppPath, partner)}/${commit}/result.json`;
}

export function simLatestPath(
  ppPath: string,
  partner: string | null = null,
): string {
  return `${simRunFolder(ppPath, partner)}/latest.json`;
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

/** What the workflow publishes: SimRunTest's result.json, and where it came from. */
export interface SimResult {
  designs?: string[];
  spec?: string;
  design?: string;
  alliance?: string;
  /** The partner stand-in this result ran with, null or absent for the Auto alone. */
  partner?: string | null;
  /** The folder on sim-results its files are in (`r-solo/partners/PartnerLStillAuto`); the Auto's when absent. */
  folder?: string;
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

/** A published log's path on sim-results. */
export function simLogPath(result: SimResult, file: string): string {
  return `${result.folder ?? result.auto}/${result.commit}/${file}`;
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
