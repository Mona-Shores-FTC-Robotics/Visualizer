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
import { isSimple, layHeadings } from "../simple/steps";
import { GENERATED_DIRS } from "../sim/biobuzz";
import { fetchText, teamRawUrl, type FetchText } from "./teamAutos";

/** The file, in the team's Autos folder (TeamCode/autos). */
export const SPOTS_FILE = "spots.json";
export const SPOTS_PATH = `TeamCode/autos/${SPOTS_FILE}`;
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
      value.length !== 3 ||
      !value.every((n) => typeof n === "number" && Number.isFinite(n))
    )
      return {
        ok: false,
        problem: `${SPOTS_FILE}: "${name}" is not NAME: [x, y, heading].`,
      };
    spots[name] = [value[0], value[1], value[2]];
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
    '  "about": "The team\'s spots, shared by every Auto (the Visualizer links them). x, y in inches, heading in degrees, Pedro field frame, drawn for RED. Change them in the Visualizer: saving re-exports every Auto that uses one.",',
    '  "spots": {',
    ...rows,
    "  }",
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
  return (
    !!a && !!b && a[0] === b[0] && a[1] === b[1] && (a[2] ?? 0) === (b[2] ?? 0)
  );
}

/** The names whose pose differs between two lists, or that one has and the other not. */
export function changedSpots(before: TeamSpots, after: TeamSpots): string[] {
  const names = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...names].filter((n) => !samePose(before[n], after[n])).sort();
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
 * Every file saving `edits` writes: spots.json with the changes, and each Auto in TeamCode/autos
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
