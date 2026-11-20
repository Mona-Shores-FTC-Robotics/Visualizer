/**
 * The Auto Match Planning page (partner.html): one of our Autos and one partner, run
 * together by the Visualizer's own preview, as the Match view runs Autos shown together
 * (state/auto.svelte.ts overlayTogether, matchLanes, matchContactAt). Nothing here is new physics:
 * it is that code without the editor around it, so the page and the app give the same answer.
 *
 * The partner is a route (route.ts): where it starts and a few timed steps, from one of the
 * page's stand-ins or a team's saved Auto.
 */
import { DEFAULT_SETTINGS } from "../config/defaults";
import { parseProject, robotConfigOf, type ProjectDoc } from "../io";
import { layOutDoc } from "../lib/auto/links";
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
  /** This robot's own timing over the team's (a partner's volley length). */
  own?: Partial<TimingValues>;
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
    own: robot.own,
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
  /** Also find the TIP switches (each a few more previews): off for a summary. */
  withToggles = true,
  /**
   * A wait for a TIP or a CELL ends as soon as a TIP could bring it, as the app previews an Auto
   * alone: for the partner shown before ours is picked, when nothing on the field TIPs the HIVE.
   */
  tipsCome = false,
): BesideResult {
  const robots = [ours, partner];
  const entries = [
    entryOf(ours, ourScenario(ours.doc.auto!, look)),
    entryOf(partner, {}),
  ];
  const shared = lookValues(values, look);
  const { previews, tips } = previewTogether(entries, shared, true, {
    tipsCome,
  });
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
    toggles: withToggles ? tipToggles(entries, shared) : [],
    ends: [endOf(lanes, previews[0], 0), endOf(lanes, previews[1], 1)],
    contact: firstContact(robots, previews, span),
    span,
  };
}

/**
 * Our Auto previewed alone, for the field while there is no partner yet (one being drawn): as the
 * app previews an Auto alone, a TIP it waits for from its partner is taken to come.
 */
export function previewAlone(
  robot: Robot,
  look: Look,
  values: TimingValues,
): PreviewResult {
  return previewTogether(
    [entryOf(robot, ourScenario(robot.doc.auto!, look))],
    lookValues(values, look),
    false,
    { tipsCome: true },
  ).previews[0];
}

// ---- Our INIT wait, and what avoids contact --------------------------------------------------

/**
 * Our Auto's one time the drive team may move in INIT (biobuzz InitOptions: "waiting for TIP 1
 * until 9 s"): a wait's match-clock row marked `adjustable`. Null for an Auto without one.
 */
export interface InitWait {
  cardId: string;
  /** Seconds on the match clock, as drawn. */
  s: number;
  /** The TIP it waits for, when the drawing says. */
  tip: number | null;
}

export function initWait(auto: AutoSection): InitWait | null {
  let found: InitWait | null = null;
  const walk = (cards: AutoCard[]) => {
    for (const card of cards) {
      if (card.kind !== "firstOf") continue;
      for (const row of card.rows) {
        if (!found && "afterMs" in row && row.adjustable)
          found = {
            cardId: card.id,
            s: row.afterMs / 1000,
            tip: row.tip ?? null,
          };
        walk(row.cards);
      }
    }
  };
  walk(auto.cards);
  return found;
}

/** Our robot with its INIT wait set to `s` (null or no such wait: as drawn). */
export function withInitWait(robot: Robot, s: number | null): Robot {
  const wait = robot.doc.auto ? initWait(robot.doc.auto) : null;
  if (s === null || !wait || Math.abs(wait.s - s) < 1e-9) return robot;
  const set = (cards: AutoCard[]): AutoCard[] =>
    cards.map((card) =>
      card.kind !== "firstOf"
        ? card
        : {
            ...card,
            rows: card.rows.map((row) => ({
              ...row,
              ...(card.id === wait.cardId && "afterMs" in row && row.adjustable
                ? { afterMs: Math.round(s * 1000) }
                : {}),
              cards: set(row.cards),
            })),
          },
    );
  const auto = robot.doc.auto!;
  return {
    ...robot,
    doc: { ...robot.doc, auto: { ...auto, cards: set(auto.cards) } },
  };
}

/** Only when the two first touch (no TIP switches, no lanes): for trying what-ifs quickly. */
export function contactOnly(
  ours: Robot,
  partner: Robot,
  look: Look,
  values: TimingValues,
): Contact | null {
  const shared = lookValues(values, look);
  const { previews } = previewTogether(
    [entryOf(ours, ourScenario(ours.doc.auto!, look)), entryOf(partner, {})],
    shared,
    false,
  );
  const span = Math.max(AUTO_S, ...previews.map((p) => p.endTime));
  return firstContact([ours, partner], previews, span);
}

/** The smallest change, in half seconds, that makes `touches` false; null if none up to `max`. */
export function smallestFix(
  touches: (extra: number) => boolean,
  max: number,
): number | null {
  for (let extra = 0.5; extra <= max + 1e-9; extra += 0.5)
    if (!touches(extra)) return extra;
  return null;
}
