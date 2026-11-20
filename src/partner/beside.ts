/**
 * The "Our Auto beside a partner" page (partner.html): one of our Autos and one partner, run
 * together by the Visualizer's own preview, as the Match view runs Autos shown together
 * (state/auto.svelte.ts overlayTogether, matchLanes, matchContactAt). Nothing here is new physics:
 * it is that code without the editor around it, so the page and the app give the same answer.
 *
 * The partner is a stand-in from biobuzz `TeamCode/autos/partners/`, or one drawn with a finger
 * (`drawnPartner`): a start, a rough path, a time to start driving, and whether it shoots its
 * preloads first.
 */
import { DEFAULT_SETTINGS } from "../config/defaults";
import { parseProject, robotConfigOf, type ProjectDoc } from "../io";
import { layOutDoc } from "../lib/auto/links";
import { TEAM_ROBOT, teamRegistry } from "../lib/auto/teamRobot";
import {
  setTrigger,
  type PreviewResult,
  type Scenario,
} from "../lib/auto/simulate";
import type { AutoCard, AutoSection } from "../lib/auto/types";
import { matchLanes, robotOutcome, type MatchLanes } from "../lib/match/lanes";
import { tipToggles, type TipToggle } from "../lib/match/tipToggles";
import { tipMissesKey, type Tip, type TimingValues } from "../lib/timing/model";
import { previewTogether, type FieldEntry } from "../lib/timing/together";
import { robotFootprint } from "../model/collision";
import { previewPose } from "../lib/auto/previewPose";
import type { RobotPose } from "../sim/pose";
import type { BasePoint, Settings } from "../types";
import { polygonsOverlap } from "../utils/geometry";
import { FIELD_SIZE } from "../config/defaults";

/** Our robot's colour and the partner's, as the Match view draws the first two Autos. */
export const OUR_COLOR = "#FF6B6B";
export const PARTNER_COLOR = "#4ECDC4";
/** AUTO's length, seconds. */
export const AUTO_S = 30;
/** How often the contact check looks, seconds (as the Match view's). */
export const CONTACT_STEP_S = 0.1;

export interface Robot {
  name: string;
  doc: ProjectDoc;
  settings: Settings;
}

/** The settings a file's robot is timed with: the app's defaults with the file's own robot. */
export function settingsOf(doc: ProjectDoc): Settings {
  return {
    ...DEFAULT_SETTINGS,
    rForward: undefined,
    features: undefined,
    ...doc.robot,
  };
}

/** A .pp file's text as a robot to run, laid out as its Auto drives it; throws if unreadable. */
export function robotFromText(name: string, text: string): Robot {
  const result = parseProject(text, robotConfigOf(DEFAULT_SETTINGS));
  if (!result.ok) throw new Error(`${name} is not a readable .pp file.`);
  if (!result.doc.auto) throw new Error(`${name} has no Auto in it.`);
  const settings = settingsOf(result.doc);
  return { name, doc: layOutDoc(result.doc, settings), settings };
}

/** An INIT route choice of the Auto (a wait drawn as `choice`): its option, trigger and two legs. */
export interface RouteChoice {
  option: string;
  /** The trigger its default leg names: answering it "no" takes the other leg. */
  condition: string;
  /** [the drawing's default leg, the other]. */
  legs: [string, string];
}

/** The Auto's INIT route choices, in the order the drawing reaches them. */
export function routeChoices(auto: AutoSection): RouteChoice[] {
  const out: RouteChoice[] = [];
  const walk = (cards: AutoCard[]) => {
    for (const card of cards) {
      if (card.kind !== "firstOf") continue;
      if (card.choice && !out.some((c) => c.option === card.choice)) {
        const yes = card.rows.findIndex((r) => "when" in r);
        const yesRow = card.rows[yes];
        const noRow = card.rows[1 - yes];
        if (yesRow && "when" in yesRow && noRow) {
          out.push({
            option: card.choice,
            condition: yesRow.when[0],
            legs: [yesRow.label ?? "yes", noRow.label ?? "no"],
          });
        }
      }
      for (const row of card.rows) walk(row.cards);
    }
  };
  walk(auto.cards);
  return out;
}

/** What the page asks: our Auto's choices (true: the default leg) and each TIP landing or missing. */
export interface Look {
  /** By choice condition: false takes the other leg. */
  choices: Record<string, boolean>;
  /** By TIP number (1-based): false, its first try misses (a later volley can still TIP it). */
  tips: Record<number, boolean>;
}

export interface RobotEnd {
  /** Seconds after PLAY it parked, or null when it did not. */
  parkedAt: number | null;
  /** The endgame guard parked it. */
  byGuard: boolean;
  /** Why it did not park, when it did not. */
  why: string | null;
  /** The Match view's words for it ("parked at 24.9 s"). */
  words: string;
}

export interface Contact {
  /** Seconds after PLAY. */
  t: number;
  /** Where on the field: between the two robots' centres. */
  at: BasePoint;
}

export interface BesideResult {
  previews: PreviewResult[];
  lanes: MatchLanes | null;
  /** Every TIP the HIVE model makes, in order. */
  tips: Tip[];
  /** The TIPs that count as AUTO (last ball out by 30 s, settled by 38 s). */
  tipsInAuto: Tip[];
  /** The TIP switches the two robots' volleys offer (lib/match/tipToggles.ts). */
  toggles: TipToggle[];
  ends: [RobotEnd, RobotEnd];
  contact: Contact | null;
  /** Seconds the animation spans: AUTO, or longer when a robot runs over. */
  span: number;
}

function entryOf(robot: Robot, scenario: Scenario): FieldEntry {
  return {
    auto: robot.doc.auto!,
    startPoint: robot.doc.startPoint,
    lines: robot.doc.lines,
    settings: robot.settings,
    scenario,
  };
}

/** The shared facts for a look: the team's, with each TIP that misses its first try. */
export function lookValues(values: TimingValues, look: Look): TimingValues {
  const out = { ...values };
  for (const [tip, lands] of Object.entries(look.tips))
    if (!lands) out[tipMissesKey(Number(tip))] = 1;
  return out;
}

/** Our Auto's answers for a look: each route choice set to "no" takes its other leg. */
export function ourScenario(auto: AutoSection, look: Look): Scenario {
  let scenario: Scenario = {};
  for (const [condition, yes] of Object.entries(look.choices))
    if (!yes) scenario = setTrigger(scenario, auto, condition, false);
  return scenario;
}

/** Where robot `i` is at `t`, as the field draws it. */
export function poseOf(
  robot: Robot,
  preview: PreviewResult,
  t: number,
): RobotPose {
  return previewPose(
    preview,
    Math.min(t, preview.endTime),
    robot.doc,
    robot.settings,
  );
}

/** The two robots' frames (drive base, no safety margin) at `t`, as the Match view checks them. */
export function framesAt(
  robots: Robot[],
  previews: PreviewResult[],
  t: number,
): BasePoint[][] {
  return robots.map((robot, i) =>
    robotFootprint(poseOf(robot, previews[i], t), {
      ...robot.settings,
      safetyMargin: 0,
    }),
  );
}

/** When the two first touch, every tenth of a second through `span`; null when they never do. */
export function firstContact(
  robots: Robot[],
  previews: PreviewResult[],
  span: number,
): Contact | null {
  const steps = Math.round(span / CONTACT_STEP_S);
  for (let i = 0; i <= steps; i++) {
    const t = i * CONTACT_STEP_S;
    const frames = framesAt(robots, previews, t);
    if (polygonsOverlap(frames[0], frames[1])) {
      const a = poseOf(robots[0], previews[0], t);
      const b = poseOf(robots[1], previews[1], t);
      return { t, at: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    }
  }
  return null;
}

function endOf(
  lanes: MatchLanes | null,
  preview: PreviewResult | undefined,
  i: number,
): RobotEnd {
  const robot = lanes?.robots[i];
  if (!robot || !preview)
    return { parkedAt: null, byGuard: false, why: "no preview", words: "" };
  // A stand-in that never drives (broken down, out of the way) has nowhere it parked.
  const neverDrives = !preview.drives.length && !preview.motions.length;
  const words = neverDrives ? "stays on its start" : robotOutcome(robot);
  const why = neverDrives
    ? "stays on its start"
    : robot.still
      ? "no-show"
      : robot.stalled
        ? "stuck in a wait"
        : robot.unparked
          ? "AUTO ends on the way to the park"
          : robot.spareS < 0
            ? `over 30 s by ${(-robot.spareS).toFixed(1)} s`
            : null;
  return {
    parkedAt: why ? null : robot.endTime,
    byGuard: !why && robot.guard !== null,
    why,
    words,
  };
}

/** Our Auto (first) and the partner (second), run together for one look. */
export function runBeside(
  ours: Robot,
  partner: Robot,
  look: Look,
  values: TimingValues,
): BesideResult {
  const robots = [ours, partner];
  const entries = [
    entryOf(ours, ourScenario(ours.doc.auto!, look)),
    entryOf(partner, {}),
  ];
  const shared = lookValues(values, look);
  const { previews, tips } = previewTogether(entries, shared);
  const lanes = matchLanes(
    entries,
    previews,
    shared,
    [ours.name, partner.name],
    [OUR_COLOR, PARTNER_COLOR],
  );
  const span = Math.max(AUTO_S, ...previews.map((p) => p.endTime));
  const tipsInAuto = tips.filter(
    (t) => (t.lastBall ?? t.start) <= AUTO_S + 1e-6 && t.settled <= 38 + 1e-6,
  );
  return {
    previews,
    lanes,
    tips,
    tipsInAuto,
    toggles: tipToggles(entries, shared),
    ends: [endOf(lanes, previews[0], 0), endOf(lanes, previews[1], 1)],
    contact: firstContact(robots, previews, span),
    span,
  };
}

// ---- A partner drawn with a finger --------------------------------------------------------------

/** What the page knows of a drawn partner. Field inches, red's frame. */
export interface DrawnPartner {
  start: BasePoint;
  /** The finger's path after the start, in order (may be empty: it stays where it starts). */
  stroke: BasePoint[];
  /** Seconds after PLAY it starts to drive. */
  startS: number;
  /** It shoots its preloads before it drives (a LaunchAll at its start). */
  shoots: boolean;
}

/** At most this many interior points: Pedro's `Paths.through()` curve the preview draws. */
export const MAX_THROUGH = 4;
/** Half the robot: a drawn start or point is kept this far inside the walls. */
const INSET = 8;

function clampToField(p: BasePoint): BasePoint {
  const c = (v: number) => Math.min(FIELD_SIZE - INSET, Math.max(INSET, v));
  return { x: Math.round(c(p.x) * 10) / 10, y: Math.round(c(p.y) * 10) / 10 };
}

/** Distance from `p` to the segment a-b. */
function toSegment(p: BasePoint, a: BasePoint, b: BasePoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const u =
    len2 > 0
      ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
      : 0;
  return Math.hypot(p.x - (a.x + u * dx), p.y - (a.y + u * dy));
}

/** Ramer–Douglas–Peucker: the points of `line` that keep it within `tolerance`. */
function simplify(line: BasePoint[], tolerance: number): BasePoint[] {
  if (line.length <= 2) return line;
  let worst = 0;
  let at = 0;
  for (let i = 1; i < line.length - 1; i++) {
    const d = toSegment(line[i], line[0], line[line.length - 1]);
    if (d > worst) {
      worst = d;
      at = i;
    }
  }
  if (worst <= tolerance) return [line[0], line[line.length - 1]];
  const left = simplify(line.slice(0, at + 1), tolerance);
  const right = simplify(line.slice(at), tolerance);
  return [...left.slice(0, -1), ...right];
}

/**
 * A finger's stroke as a start and a few points: the corners that matter, at most
 * {@link MAX_THROUGH} between the start and the end, each inside the field.
 */
export function strokeWaypoints(
  start: BasePoint,
  stroke: BasePoint[],
): BasePoint[] {
  const line = [start, ...stroke].map(clampToField);
  // Drop jitter: points closer than 2 in to the last one kept.
  const kept: BasePoint[] = [line[0]];
  for (const p of line.slice(1)) {
    const last = kept[kept.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) >= 2) kept.push(p);
  }
  if (kept.length < 2) return [];
  let tolerance = 2;
  let points = simplify(kept, tolerance);
  while (points.length - 2 > MAX_THROUGH) {
    tolerance *= 1.5;
    points = simplify(kept, tolerance);
  }
  return points.slice(1);
}

/** The heading a drawn start faces: away from the nearest wall, square to it. */
export function startHeading(start: BasePoint): number {
  const walls: [number, number][] = [
    [start.x, 0], // left wall (x = 0): face +x
    [FIELD_SIZE - start.x, 180],
    [start.y, 90], // bottom wall (y = 0): face +y
    [FIELD_SIZE - start.y, 270],
  ];
  walls.sort((a, b) => a[0] - b[0]);
  return walls[0][1];
}

/** A drawn partner as a project the preview runs: its start, one path through the stroke, a park. */
export function drawnPartner(drawn: DrawnPartner): Robot {
  const settings: Settings = { ...DEFAULT_SETTINGS, ...TEAM_ROBOT };
  const start = clampToField(drawn.start);
  const heading = startHeading(start);
  const points = strokeWaypoints(start, drawn.stroke);
  const lineId = "line-drawn-partner";
  const lines: ProjectDoc["lines"] = points.length
    ? [
        {
          kind: "atomic",
          id: lineId,
          name: "Drawn path",
          endPoint: points[points.length - 1],
          controlPoints: [],
          throughPoints: points.slice(0, -1),
          heading: { type: "constant", degrees: heading },
          color: PARTNER_COLOR,
          locked: false,
          waitBeforeMs: 0,
          waitAfterMs: 0,
          waitBeforeName: "",
          waitAfterName: "",
        },
      ]
    : [];
  const cards: AutoCard[] = [];
  if (drawn.shoots)
    cards.push({ id: "c-drawn-shoot", kind: "action", name: "LaunchAll" });
  const startMs = Math.max(0, Math.round(drawn.startS * 1000));
  if (lines.length && startMs > 0) {
    cards.push({
      id: "c-drawn-wait",
      kind: "firstOf",
      label: `Starts driving at ${drawn.startS} s`,
      rows: [{ afterMs: startMs, matchClock: true, cards: [] }],
    });
  }
  if (lines.length)
    cards.push({ id: "c-drawn-path", kind: "path", lineId, park: true });
  const auto: AutoSection = {
    version: 1,
    drawnFor: "RED",
    registry: teamRegistry(),
    points: {},
    pathEnds: {},
    cards,
    exportName: "Drawn-Partner",
  };
  const doc: ProjectDoc = {
    startPoint: { x: start.x, y: start.y, headingDeg: heading, locked: false },
    lines,
    shapes: [],
    sequence: lines.map((l) => ({ kind: "path" as const, lineId: l.id })),
    fieldPoints: [],
    robot: robotConfigOf(settings),
    activePaths: [],
    auto,
  };
  return { name: "Drawn partner", doc, settings };
}

/** Red's field turned half a turn about the centre: blue's (the field is rotationally symmetric). */
export function turnHalf(p: BasePoint): BasePoint {
  return { x: FIELD_SIZE - p.x, y: FIELD_SIZE - p.y };
}

/**
 * Our Auto previewed alone, for the field while there is no partner yet (one being drawn): as the
 * app previews an Auto alone, a TIP it waits for from its partner is taken to come.
 */
export function previewAlone(
  ours: Robot,
  look: Look,
  values: TimingValues,
): PreviewResult {
  return previewTogether(
    [entryOf(ours, ourScenario(ours.doc.auto!, look))],
    lookValues(values, look),
    false,
    { tipsCome: true },
  ).previews[0];
}
