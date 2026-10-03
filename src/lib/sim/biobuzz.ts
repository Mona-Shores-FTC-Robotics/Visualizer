/**
 * The "Run in simulator" button's shared rules: where in a biobuzz checkout
 * the Auto's files go, what the simulator is asked to run, and how its
 * seeds add up. Used by the dev server's bridge (vite/biobuzzBridge.ts) and
 * by the Simulator dialog, so both agree. Nothing here touches the disk.
 */

/** Folders of a biobuzz checkout that hold Auto Builder .pp files. */
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

/** The robot design the review set uses, until the simulator lists its own. */
export const DEFAULT_DESIGN = "two spring hoods, full-width intake";

/** Why `path` is not a .pp the bridge may read or write, or null if it is. */
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

export function baseName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/**
 * Where an Auto's generated class goes when none exists yet: the robot's
 * folder for TeamCode/autos, the simulation's for everything else.
 */
export function generatedDirFor(ppPath: string): string {
  return ppPath.startsWith(`${PP_DIRS[0]}/`)
    ? GENERATED_DIRS[0]
    : GENERATED_DIRS[1];
}

/** The `SOURCE` a generated class names, e.g. "hive-rush.pp", or null. */
export function sourceOf(java: string): string | null {
  return (
    /public static final String SOURCE = "([^"]+)";/.exec(java)?.[1] ?? null
  );
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
 * The .pp in biobuzz that a file open in the editor most likely is: the
 * one it was opened from, else the only one with its name, else a new one
 * beside the simulator's Autos.
 */
export function suggestPpPath(
  fileName: string,
  openedFrom: string | null,
  known: string[],
): string {
  if (openedFrom && known.includes(openedFrom)) return openedFrom;
  const name = fileName.endsWith(".pp") ? fileName : `${fileName}.pp`;
  const same = known.filter((path) => baseName(path) === name);
  if (same.length === 1) return same[0];
  return `${PP_DIRS[1]}/${name}`;
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

/** SimRunTest's result.json. */
export interface SimResult {
  designs: string[];
  spec?: string;
  design?: string;
  partnerDesign?: string | null;
  alliance?: string;
  runs?: SimRun[];
  error?: string;
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
