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

/** The file the workflow watches; one commit carries it with the .pp and its Java. */
export const SIM_REQUEST_PATH = "TeamCode/sim-request.json";
export const SIM_RESULTS_BRANCH = "sim-results";
/** The workflow's name, as GitHub lists its runs. */
export const SIM_WORKFLOW = "Simulate Auto";
/** Where saves go unless the file was opened from another branch. */
export const DEFAULT_BRANCH = "claude/simulator";

/** The robot design the review set uses, until a result lists the simulator's own. */
export const DEFAULT_DESIGN = "two spring hoods, full-width intake";

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

/** The run in AutoStudyTest's terms: `OursAuto[,PartnerAuto]@speed`. */
export function simSpec(
  autoClass: string,
  partnerClass: string | null,
  speed: number,
): string {
  return `${autoClass}${partnerClass ? `,${partnerClass}` : ""}@${speed}`;
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
  design: string;
  partnerDesign: string | null;
  partnerSpeed: number | null;
  seeds: number;
  alliance: "RED" | "BLUE";
  savedBy: string;
}

/** TeamCode/sim-request.json's text: SimRunTest's request, and what to stamp on each log. */
export function simRequestText(o: SimRequestOptions, now = new Date()): string {
  const count = Math.min(50, Math.max(1, Math.round(o.seeds)));
  const request = {
    pp: o.ppPath,
    spec: o.spec,
    design: o.design,
    partnerDesign: o.partnerDesign,
    partnerSpeed: o.partnerSpeed,
    seeds: Array.from({ length: count }, (_, i) => i + 1),
    alliance: o.alliance,
    metadata: {
      AutoSource: baseName(o.ppPath),
      SavedBy: o.savedBy,
      SavedAt: now.toISOString(),
    },
  };
  return `${JSON.stringify(request, null, 2)}\n`;
}

/** The Auto's name on sim-results: its .pp file name without ".pp". */
export function simAutoName(ppPath: string): string {
  return baseName(ppPath).replace(/\.pp$/, "");
}

export function simResultPath(ppPath: string, commit: string): string {
  return `${simAutoName(ppPath)}/${commit}/result.json`;
}

export function simLatestPath(ppPath: string): string {
  return `${simAutoName(ppPath)}/latest.json`;
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
  partnerDesign?: string | null;
  alliance?: string;
  runs?: SimRun[];
  error?: string;
  auto: string;
  commit: string;
  branch: string;
  pp: string;
  runUrl: string;
  finishedAt: string;
  typicalSeed: number | null;
  /** Seed → the .wpilog published for it, beside result.json. */
  logs: Record<string, string>;
}

/** A published log's path on sim-results. */
export function simLogPath(result: SimResult, file: string): string {
  return `${result.auto}/${result.commit}/${file}`;
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
  };
}
