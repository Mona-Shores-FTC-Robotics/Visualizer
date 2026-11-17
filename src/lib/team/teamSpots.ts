/**
 * The team's spots: named poses every Auto can use, kept in one file in biobuzz
 * (`TeamCode/autos/spots.json`) and linked the way PathPlanner links waypoints. An Auto that
 * uses a team spot keeps a copy in its own named points and lists the name in
 * `auto.teamSpots`; the editor keeps the copy equal to the team's list, and saving a change to
 * a spot writes the list and re-exports every Auto linked to it, .pp and Java, in one commit, so
 * the robot code changes with it.
 *
 * Spots are drawn for RED, in Pedro's frame (inches, degrees), as everything in an Auto is; the
 * robot turns them for BLUE.
 */
import { DEFAULT_SETTINGS } from "../../config";
import {
  projectFromJson,
  robotConfigOf,
  serializeProject,
  type ProjectDoc,
} from "../../io";
import type { Settings } from "../../types";
import { buildPathCatalog } from "../auto/geometry";
import { pinState } from "../auto/pins";
import { settleDoc } from "../auto/settle";
import type { NamedPoint } from "../auto/types";
import { generateAutoJava } from "../codegen/auto/javaAuto";
import { withSpotParks } from "../simple/parkFrom";
import { isSimple, isStartName, layHeadings } from "../simple/steps";
import { GENERATED_DIRS } from "../sim/biobuzz";
import { fetchText, teamRawUrl, type FetchText } from "./teamAutos";

/** The file, in the team's Autos folder (TeamCode/autos). */
export const SPOTS_FILE = "spots.json";
export const SPOTS_PATH = `TeamCode/autos/${SPOTS_FILE}`;
/**
 * The Java twin of spots.json, written with it on every save of the team's spots, so the robot code
 * that needs a spot (biobuzz's StartPositions and AutoLaunchSpots) reads it and keeps no copy of its
 * own. biobuzz's TeamSpotsTest fails while the two differ.
 */
export const TEAM_SPOTS_JAVA_PATH =
  "TeamCode/src/main/java/org/firstinspires/ftc/teamcode/localization/generated/TeamSpots.java";
/** Where the robot's generated Autos live (lib/sim/biobuzz.ts GENERATED_DIRS). */
const GENERATED_DIR = GENERATED_DIRS[0];

/** Spot name → [x, y, heading°]. */
export type TeamSpots = Record<string, NamedPoint>;

const NAME = /^[A-Z][A-Z0-9_]*$/;

/** Reads spots.json; a problem names what is wrong. */
export function parseTeamSpots(
  text: string,
): { ok: true; spots: TeamSpots } | { ok: false; problem: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, problem: `${SPOTS_FILE} is not valid JSON.` };
  }
  const list = (raw as { spots?: unknown } | null)?.spots;
  if (!list || typeof list !== "object" || Array.isArray(list))
    return { ok: false, problem: `${SPOTS_FILE} has no "spots" object.` };
  const spots: TeamSpots = {};
  for (const [name, value] of Object.entries(list)) {
    if (
      !NAME.test(name) ||
      !Array.isArray(value) ||
      (value.length !== 3 && value.length !== 2) ||
      !value.every((n) => typeof n === "number" && Number.isFinite(n))
    )
      return {
        ok: false,
        problem: `${SPOTS_FILE}: "${name}" is not NAME: [x, y, heading] (or [x, y]: reached at any heading).`,
      };
    // A spot with no heading (a park) is reached at whatever heading the robot arrives with.
    spots[name] =
      value.length === 3
        ? [value[0], value[1], value[2]]
        : [value[0], value[1]];
  }
  return { ok: true, spots };
}

/** spots.json's text: names in order, one spot a line, so a change is a one-line diff. */
export function serializeTeamSpots(spots: TeamSpots): string {
  const names = Object.keys(spots).sort();
  const rows = names.map(
    (name, i) =>
      `    ${JSON.stringify(name)}: [${spots[name].join(", ")}]${i < names.length - 1 ? "," : ""}`,
  );
  return [
    "{",
    '  "about": "The team\'s spots, shared by every Auto (the Visualizer links them). x, y in inches, heading in degrees (none: reached at any heading), Pedro field frame, drawn for RED. Change them in the Visualizer: saving re-exports every Auto that uses one.",',
    '  "spots": {',
    ...rows,
    "  }",
    "}",
    "",
  ].join("\n");
}

/** A number as a Java double literal: JavaScript's shortest form, which Java reads back the same. */
function javaNumber(n: number): string {
  return Number.isInteger(n) ? `${n}.0` : String(n);
}

/**
 * TeamSpots.java's text for `spots`: one constant per spot, in spots.json's order, and `all()`. A
 * spot with no heading gets NaN, which biobuzz's TeamSpot reads as "reached at any heading".
 */
export function teamSpotsJava(spots: TeamSpots): string {
  const names = Object.keys(spots).sort();
  const constants = names.map((name) => {
    const [x, y, h] = spots[name];
    const heading = h === undefined ? "Double.NaN" : javaNumber(h);
    return `    public static final TeamSpot ${name} = new TeamSpot("${name}", ${javaNumber(x)}, ${javaNumber(y)}, ${heading});`;
  });
  return [
    "// Written by the Visualizer from TeamCode/autos/spots.json, together with it, whenever the team's",
    "// spots are saved. Never edit it by hand: move the spot in the Visualizer and save.",
    "// TeamSpotsTest fails while this file and spots.json differ.",
    "package org.firstinspires.ftc.teamcode.localization.generated;",
    "",
    "import org.firstinspires.ftc.teamcode.localization.TeamSpot;",
    "",
    "/** The team's spots, drawn for RED: x, y in inches, heading in degrees (NaN: reached at any heading). */",
    "public final class TeamSpots {",
    "",
    "    private TeamSpots() {",
    "    }",
    "",
    ...constants,
    "",
    "    /** Every spot, in spots.json's order. */",
    "    public static TeamSpot[] all() {",
    `        return new TeamSpot[] {${names.join(", ")}};`,
    "    }",
    "}",
    "",
  ].join("\n");
}

/** The team's spots on a branch: none when biobuzz has no spots.json yet. */
export async function loadTeamSpots(
  ref = "master",
  fetch: FetchText = fetchText,
): Promise<TeamSpots> {
  const text = await fetch(teamRawUrl(ref, SPOTS_FILE));
  if (text === null) return {};
  const parsed = parseTeamSpots(text);
  if (!parsed.ok) throw new Error(parsed.problem);
  return parsed.spots;
}

/** Whether two poses are the same spot. */
export function samePose(a: NamedPoint | undefined, b: NamedPoint | undefined) {
  return !!a && !!b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

/** The names whose pose differs between two lists, or that one has and the other not. */
export function changedSpots(before: TeamSpots, after: TeamSpots): string[] {
  const names = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...names].filter((n) => !samePose(before[n], after[n])).sort();
}

/**
 * The spots changed in this browser and not saved, sorted for the open Auto: the ones it uses
 * (`here`), and the rest (`elsewhere`), of which `gone` are names the team's list does not have at
 * all. A browser keeps its changes until they are saved or undone, so a change made before the team
 * renamed or moved its spots lingers under the old name; listing it beside this Auto's own changes
 * read as if this Auto had them. `gone` is empty while the list is not read (`saved` null).
 */
export function sortSpotEdits(
  edits: TeamSpots,
  used: ReadonlySet<string>,
  saved: TeamSpots | null,
): { here: string[]; elsewhere: string[]; gone: string[] } {
  const names = Object.keys(edits).sort();
  const elsewhere = names.filter((n) => !used.has(n));
  return {
    here: names.filter((n) => used.has(n)),
    elsewhere,
    gone: saved ? elsewhere.filter((n) => !saved[n]) : [],
  };
}

/**
 * Links a named point to the team spot `name`: the Auto gets the spot as a named point (or its
 * copy is replaced) and lists it, and `lineId`'s end, when given, sits on it from now on.
 */
export function linkSpot(
  doc: ProjectDoc,
  name: string,
  pose: NamedPoint,
  lineId?: string,
): ProjectDoc {
  const auto = doc.auto;
  if (!auto) return doc;
  const pathEnds = lineId
    ? { ...auto.pathEnds, [lineId]: name }
    : auto.pathEnds;
  return {
    ...doc,
    auto: {
      ...auto,
      points: { ...auto.points, [name]: [...pose] as NamedPoint },
      pathEnds,
      teamSpots: [...new Set([...(auto.teamSpots ?? []), name])].sort(),
    },
  };
}

/**
 * A free name for this Auto's own copy of team spot `from`: `LEFT_AUTO_HIVE_2`, or for a start
 * `RIGHT_2_START` (a start keeps its _START ending). `taken` holds every name in use.
 */
export function forkName(from: string, taken: ReadonlySet<string>): string {
  const start = from.endsWith("_START");
  const base = start ? from.slice(0, -"_START".length) : from;
  for (let n = 2; ; n++) {
    const name = start ? `${base}_${n}_START` : `${base}_${n}`;
    if (!taken.has(name)) return name;
  }
}

/**
 * This Auto's own team spot `to`, a copy of team spot `from` where it is now: every end, the start,
 * the park choices and the drives named after `from` go to `to`, and the Auto no longer links
 * `from`, so moving `to` moves this Auto alone. The caller adds `to` to the team's list (editSpot).
 */
export function forkSpot(
  doc: ProjectDoc,
  from: string,
  to: string,
): { doc: ProjectDoc } | { problem: string } {
  const auto = doc.auto;
  const pose = auto?.points[from];
  if (!auto || !pose || !auto.teamSpots?.includes(from))
    return { problem: `${from} is not a team spot of this Auto.` };
  if (!NAME.test(to))
    return { problem: "A spot's name is capitals, digits and _." };
  if (to === from || auto.points[to])
    return { problem: `This Auto already has a spot ${to}.` };
  if (isStartName(from) !== isStartName(to))
    return {
      problem: isStartName(from)
        ? "A start's name ends in _START."
        : "Only a start's name ends in _START.",
    };
  const points = { ...auto.points, [to]: [...pose] as NamedPoint };
  delete points[from];
  const pathEnds = Object.fromEntries(
    Object.entries(auto.pathEnds).map(([id, end]) => [
      id,
      end === from ? to : end,
    ]),
  );
  const next = {
    ...auto,
    points,
    pathEnds,
    teamSpots: [
      ...new Set(auto.teamSpots.map((n) => (n === from ? to : n))),
    ].sort(),
  };
  if (auto.startAt === from) next.startAt = to;
  if (auto.parkChoices)
    next.parkChoices = auto.parkChoices.map((n) => (n === from ? to : n));
  const lines = doc.lines.map((line) =>
    line.name === `to ${from}`
      ? { ...line, name: `to ${to}` }
      : line.name === `${from} park`
        ? { ...line, name: `${to} park` }
        : line,
  );
  return { doc: { ...doc, lines, auto: next } };
}

/** Unlinks a team spot: the Auto keeps the point, as its own, where it is. */
export function unlinkSpot(doc: ProjectDoc, name: string): ProjectDoc {
  const auto = doc.auto;
  if (!auto?.teamSpots?.includes(name)) return doc;
  const teamSpots = auto.teamSpots.filter((n) => n !== name);
  const next = { ...auto };
  if (teamSpots.length) next.teamSpots = teamSpots;
  else delete next.teamSpots;
  return { ...doc, auto: next };
}

/**
 * The document with its linked spots' copies equal to `spots` (and a simple Auto's drives turned
 * to their spots' headings); `doc` itself when nothing differs. A spot the list no longer has
 * stays as the Auto's own point.
 */
export function applyTeamSpots(doc: ProjectDoc, spots: TeamSpots): ProjectDoc {
  const auto = doc.auto;
  if (!auto?.teamSpots?.length) return doc;
  const stale = auto.teamSpots.filter(
    (name) => spots[name] && !samePose(auto.points[name], spots[name]),
  );
  if (!stale.length) return doc;
  const points = { ...auto.points };
  for (const name of stale) points[name] = [...spots[name]] as NamedPoint;
  // The start sits on its spot too (setStart), so the start pose follows.
  let startPoint = doc.startPoint;
  if (auto.startAt && stale.includes(auto.startAt)) {
    const [x, y, h] = points[auto.startAt];
    startPoint = {
      ...startPoint,
      x,
      y,
      headingDeg: h ?? startPoint.headingDeg,
    };
  }
  const next = { ...doc, startPoint, auto: { ...auto, points } };
  return isSimple(next) ? layHeadings(next) : next;
}

/**
 * The document with its start spot's copy moved to where the start is, when that spot is
 * unlocked: the START panel's X, Y and heading, or a drag of the start, move the start pose, and
 * an unlocked start spot follows it (then the list follows the copy, as a change to save). `doc`
 * itself when the start is not on an unlocked spot, or already there.
 */
export function startSpotFollowsStart(
  doc: ProjectDoc,
  unlocked: ReadonlySet<string>,
): ProjectDoc {
  const auto = doc.auto;
  const name = auto?.startAt;
  if (!auto || !name || !unlocked.has(name) || !auto.teamSpots?.includes(name))
    return doc;
  const { x, y, headingDeg } = doc.startPoint;
  const pose: NamedPoint = [x, y, headingDeg ?? 0];
  if (samePose(auto.points[name], pose)) return doc;
  return {
    ...doc,
    auto: { ...auto, points: { ...auto.points, [name]: pose } },
  };
}

/**
 * One Auto's .pp, as it is with `spots` applied: its paths moved onto the spots, laid out and
 * parked from as the editor would, and its Java exported. Null when it links none of `names`.
 */
export function reexportWithSpots(
  ppText: string,
  ppPath: string,
  spots: TeamSpots,
  names: string[],
):
  | { ppText: string; java: string; javaFileName: string }
  | { error: string }
  | null {
  let data: unknown;
  try {
    data = JSON.parse(ppText);
  } catch {
    return { error: `${ppPath} is not valid JSON.` };
  }
  const loaded = projectFromJson(data, robotConfigOf(DEFAULT_SETTINGS));
  if (!loaded.ok) return { error: `${ppPath}: ${loaded.error}` };
  const opened = loaded.doc;
  if (!opened.auto?.teamSpots?.some((n) => names.includes(n))) return null;
  const settings: Settings = { ...DEFAULT_SETTINGS, ...opened.robot };

  // As the editor would: settle the file as opened, then change its spots and settle again, so
  // the ends follow the moved spots; then the spots' parks.
  let doc = settleDoc(opened, settings, null).doc;
  let pinned = pinState(doc.auto!);
  doc = applyTeamSpots(doc, spots);
  for (let i = 0; i < 4; i++) {
    const settled = settleDoc(doc, settings, pinned);
    pinned = settled.pinned;
    const catalog = buildPathCatalog(
      settled.doc.startPoint,
      settled.doc.lines,
      settings,
    );
    const next = withSpotParks(settled.doc, catalog);
    if (next === doc) break;
    doc = next;
  }

  const name = ppPath.split("/").pop()!;
  // The .pp first, so the Java's SAVED is the time the .pp records.
  const savedText = serializeProject(doc, { pretty: true });
  const java = generateAutoJava({
    auto: doc.auto!,
    startPoint: doc.startPoint,
    lines: doc.lines,
    shapes: doc.shapes,
    settings,
    sourceFileName: name,
    savedAt: JSON.parse(savedText).timestamp,
  });
  if (!java.ok) return { error: `${name}: ${java.errors.join("; ")}` };
  return {
    ppText: savedText,
    java: java.source,
    javaFileName: java.fileName,
  };
}

/**
 * Every file saving `edits` writes: spots.json with the changes, its Java twin (TeamSpots.java), and each Auto in TeamCode/autos
 * that links a changed spot, re-exported (.pp and Java). `read` reads a file at the commit the
 * save starts from; `files` lists that commit's paths.
 */
export async function teamSpotSave(
  read: (path: string) => Promise<string | null>,
  files: string[],
  edits: TeamSpots,
): Promise<
  | { ok: true; files: Record<string, string>; autos: string[] }
  | { ok: false; errors: string[] }
> {
  const savedText = await read(SPOTS_PATH);
  let saved: TeamSpots = {};
  if (savedText !== null) {
    const parsed = parseTeamSpots(savedText);
    if (!parsed.ok) return { ok: false, errors: [parsed.problem] };
    saved = parsed.spots;
  }
  const spots = { ...saved, ...edits };
  const names = changedSpots(saved, spots);
  const out: Record<string, string> = {
    [SPOTS_PATH]: serializeTeamSpots(spots),
    [TEAM_SPOTS_JAVA_PATH]: teamSpotsJava(spots),
  };
  const autos: string[] = [];
  const errors: string[] = [];
  const ppPaths = files.filter(
    (path) => path.startsWith("TeamCode/autos/") && path.endsWith(".pp"),
  );
  for (const path of ppPaths) {
    const text = await read(path);
    if (text === null) continue;
    const result = reexportWithSpots(text, path, spots, names);
    if (!result) continue;
    if ("error" in result) {
      errors.push(result.error);
      continue;
    }
    out[path] = result.ppText;
    out[`${GENERATED_DIR}/${result.javaFileName}`] = result.java;
    autos.push(path.split("/").pop()!);
  }
  return errors.length
    ? { ok: false, errors }
    : { ok: true, files: out, autos };
}
