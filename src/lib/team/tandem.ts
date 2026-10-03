/**
 * Two (or more) Autos played together: the tandem view's model.
 *
 * - **Partner links** (`links` in a pair of `pairs.json`): a wait in one robot's Auto fires when
 *   the other robot reaches a card ("left's TIP 1 fires when right's TIP 1? does"). The robots are
 *   simulated against each other until neither moves (`simulatePair`).
 * - **Lanes**: each robot's drives, waits and commands on one 0–30 s axis (`laneOf`).
 * - **Near-collisions**: when two robots' footprints come within a margin (`nearMisses`).
 *
 * No DOM here, so it is tested directly (tandem.test.ts).
 */
import * as d3 from "d3";
import type { Path, Settings, StartPose, TimelineEvent } from "../../types";
import { calculateRobotState } from "../../utils/animation";
import type { PathCatalog } from "../auto/geometry";
import {
  motionPoseAt,
  simulateAuto,
  type PartnerTimes,
  type PreviewResult,
  type Scenario,
} from "../auto/simulate";
import { allCards, cardTitle } from "../auto/tree";
import type { AutoSection } from "../auto/types";

/** "`file`'s wait `wait` fires when `partner` reaches `card`" (cards by id or by name). */
export interface PairLink {
  file: string;
  wait: string;
  partner: string;
  card: string;
}

/** Reads a pair's `links`; drops entries that are not four strings. */
export function parseLinks(value: unknown): PairLink[] {
  if (!Array.isArray(value)) return [];
  const out: PairLink[] = [];
  for (const link of value) {
    if (!link || typeof link !== "object") continue;
    const { file, wait, partner, card } = link as Record<string, unknown>;
    if (
      [file, wait, partner, card].every(
        (v) => typeof v === "string" && v.trim() !== "",
      )
    ) {
      out.push({ file, wait, partner, card } as PairLink);
    }
  }
  return out;
}

/**
 * The name a robot goes by on screen and in pairs.json: its file without the folder, the
 * `biobuzz-` of a team copy, or `.pp`. (A file added from disk keeps its `disk-`: team files
 * such as `partner-preloads-park.pp` already start with words like "partner".)
 */
export function robotName(file: string): string {
  return file
    .slice(file.lastIndexOf("/") + 1)
    .replace(/^biobuzz-/, "")
    .replace(/\.pp$/, "");
}

/** One robot of a pair, as the simulator needs it. */
export interface TandemRobot {
  /** The file it came from; links name it with or without the `biobuzz-` prefix. */
  file: string;
  auto: AutoSection | null;
  catalog: PathCatalog;
  start: StartPose;
  scenario: Scenario;
}

/** The ids of the cards `name` refers to: a card id, or a card's name as the list shows it. */
export function matchCards(
  auto: AutoSection,
  catalog: PathCatalog,
  name: string,
): string[] {
  const cards = allCards(auto.cards);
  const byId = cards.filter((card) => card.id === name);
  if (byId.length > 0) return byId.map((card) => card.id);
  return cards
    .filter((card) => {
      const path =
        "lineId" in card ? catalog.byId.get(card.lineId)?.name : undefined;
      return cardTitle(card, path) === name;
    })
    .map((card) => card.id);
}

/**
 * When a card first "happens" in a preview: a wait when its trigger fires (not when it times
 * out), a command when it finishes, a path when the robot gets to its end. Infinity: never.
 */
export function happensAt(preview: PreviewResult, ids: string[]): number {
  let at = Infinity;
  for (const span of preview.spans) {
    if (span.fired && ids.includes(span.cardId)) at = Math.min(at, span.t1);
  }
  for (const drive of preview.drives) {
    if (ids.includes(drive.cardId)) at = Math.min(at, drive.t1);
  }
  return at;
}

const sameFile = (a: string, b: string) => robotName(a) === robotName(b);

/** A link the pair could not use, and why. */
export interface LinkProblem {
  link: PairLink;
  problem: string;
}

export interface PairPreview {
  /** Per robot, in order; null for a file without an Auto. */
  previews: (PreviewResult | null)[];
  /** Per robot: its linked waits and when the partner fires them. */
  partnerTimes: PartnerTimes[];
  /** False when the robots kept changing each other's timing and the preview gave up. */
  settled: boolean;
  problems: LinkProblem[];
}

/** How many times the robots are re-simulated against each other before giving up. */
const MAX_ROUNDS = 8;

interface ResolvedLink {
  robot: number;
  waits: string[];
  partner: number;
  cards: string[];
  text: string;
}

function resolveLinks(robots: TandemRobot[], links: PairLink[]) {
  const resolved: ResolvedLink[] = [];
  const problems: LinkProblem[] = [];
  for (const link of links) {
    const robot = robots.findIndex((r) => sameFile(r.file, link.file));
    const partner = robots.findIndex((r) => sameFile(r.file, link.partner));
    if (robot < 0 || partner < 0) {
      // A link to a robot not on screen is not a problem: the pair may be shown in part.
      continue;
    }
    const own = robots[robot];
    const other = robots[partner];
    if (!own.auto || !other.auto) {
      problems.push({ link, problem: "both files need an Auto" });
      continue;
    }
    const waits = matchCards(own.auto, own.catalog, link.wait).filter((id) =>
      allCards(own.auto!.cards).some(
        (card) => card.id === id && card.kind === "firstOf",
      ),
    );
    if (waits.length === 0) {
      problems.push({
        link,
        problem: `${robotName(link.file)} has no wait called "${link.wait}"`,
      });
      continue;
    }
    const cards = matchCards(other.auto, other.catalog, link.card);
    if (cards.length === 0) {
      problems.push({
        link,
        problem: `${robotName(link.partner)} has no card called "${link.card}"`,
      });
      continue;
    }
    resolved.push({
      robot,
      waits,
      partner,
      cards,
      text: `${robotName(link.partner)}: ${link.card}`,
    });
  }
  return { resolved, problems };
}

function sameTimes(a: PartnerTimes[], b: PartnerTimes[]): boolean {
  return a.every((map, i) => {
    if (map.size !== b[i].size) return false;
    for (const [id, { at }] of map) {
      const other = b[i].get(id);
      if (!other) return false;
      if (
        at === Infinity ? other.at !== Infinity : Math.abs(at - other.at) > 1e-6
      )
        return false;
    }
    return true;
  });
}

/**
 * Plays the robots' Autos against each other. A linked wait fires when its partner card happens
 * (or at once if that was earlier); if the partner never gets there, it runs to its time limit.
 * Starts with every linked wait unanswered, then re-plays each robot with the others' latest
 * times until nothing changes.
 */
export function simulatePair(
  robots: TandemRobot[],
  links: PairLink[] = [],
): PairPreview {
  const { resolved, problems } = resolveLinks(robots, links);
  const play = (times: PartnerTimes[]) =>
    robots.map((robot, i) =>
      robot.auto
        ? simulateAuto(
            robot.auto,
            robot.catalog,
            robot.start,
            robot.scenario,
            times[i],
          )
        : null,
    );
  const timesFrom = (previews: (PreviewResult | null)[]): PartnerTimes[] => {
    const times: PartnerTimes[] = robots.map(() => new Map());
    for (const link of resolved) {
      const partner = previews[link.partner];
      const at = partner ? happensAt(partner, link.cards) : Infinity;
      const why = Number.isFinite(at)
        ? `${link.text} at ${at.toFixed(1)} s`
        : `${link.text} never happens`;
      for (const wait of link.waits) {
        const current = times[link.robot].get(wait);
        // Two links on one wait: the first partner to get there fires it.
        if (!current || at < current.at)
          times[link.robot].set(wait, { at, why });
      }
    }
    return times;
  };

  // Round 0: nothing linked has happened yet.
  let times: PartnerTimes[] = robots.map(() => new Map());
  for (const link of resolved) {
    for (const wait of link.waits)
      times[link.robot].set(wait, {
        at: Infinity,
        why: `${link.text} never happens`,
      });
  }
  let previews = play(times);
  if (resolved.length === 0)
    return { previews, partnerTimes: times, settled: true, problems };
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const next = timesFrom(previews);
    if (sameTimes(next, times))
      return { previews, partnerTimes: times, settled: true, problems };
    times = next;
    previews = play(times);
  }
  return {
    previews,
    partnerTimes: times,
    settled: sameTimes(timesFrom(previews), times),
    problems,
  };
}

// --- lanes ------------------------------------------------------------------

export type BlockKind = "drive" | "wait" | "command";

/** One stretch of a robot's lane. */
export interface LaneBlock {
  kind: BlockKind;
  t0: number;
  t1: number;
  label: string;
  cardId: string | null;
  /** A wait that the partner fires. */
  linked: boolean;
  /** A wait that ran to its time limit (or was cut short). */
  timedOut: boolean;
}

/** A robot's lane from its Auto preview: drives, waits and commands, by start time. */
export function laneOf(
  preview: PreviewResult,
  catalog: PathCatalog,
  partner?: PartnerTimes,
): LaneBlock[] {
  const blocks: LaneBlock[] = [];
  for (const drive of preview.drives) {
    blocks.push({
      kind: "drive",
      t0: drive.t0,
      t1: drive.t1,
      label: catalog.byId.get(drive.pathId)?.name ?? "Drive",
      cardId: drive.cardId,
      linked: false,
      timedOut: false,
    });
  }
  for (const span of preview.spans) {
    blocks.push({
      kind: span.kind,
      t0: span.t0,
      t1: span.t1,
      label: span.label,
      cardId: span.cardId,
      linked: span.kind === "wait" && !!partner?.has(span.cardId),
      timedOut: span.kind === "wait" && !span.fired,
    });
  }
  return blocks.sort((a, b) => a.t0 - b.t0 || a.t1 - b.t1);
}

/** A lane for a file without an Auto: its paths, back to back. */
export function laneOfPaths(
  timeline: TimelineEvent[],
  lines: Path[],
): LaneBlock[] {
  const names = new Map<string, string>();
  let n = 0;
  const walk = (nodes: Path[]) => {
    for (const node of nodes) {
      if (node.kind === "compound") walk(node.segments);
      else names.set(node.id, node.name || `Path ${++n}`);
    }
  };
  walk(lines);
  const blocks: LaneBlock[] = [];
  for (const event of timeline) {
    if (event.type === "wait") {
      if (event.duration > 1e-6)
        blocks.push({
          kind: "wait",
          t0: event.startTime,
          t1: event.endTime,
          label: "Wait",
          cardId: null,
          linked: false,
          timedOut: false,
        });
      continue;
    }
    const label = (event.lineId && names.get(event.lineId)) || "Drive";
    const last = blocks[blocks.length - 1];
    if (
      last &&
      last.kind === "drive" &&
      last.label === label &&
      Math.abs(last.t1 - event.startTime) < 1e-6
    ) {
      last.t1 = event.endTime;
    } else {
      blocks.push({
        kind: "drive",
        t0: event.startTime,
        t1: event.endTime,
        label,
        cardId: null,
        linked: false,
        timedOut: false,
      });
    }
  }
  return blocks;
}

// --- poses and near-collisions ------------------------------------------------

export interface Pose {
  x: number;
  y: number;
  headingDeg: number;
}

/** What it takes to place a robot on the field at a time: the app's own playback maths. */
export interface RobotTrack {
  timeline: TimelineEvent[];
  lines: Path[];
  start: StartPose;
  settings: Settings;
  preview: PreviewResult | null;
  /** When it stops moving, s. */
  total: number;
}

const identity = d3.scaleLinear();

/** The robot's pose (field inches, degrees CCW) `t` seconds in; it stays put once done. */
export function poseAt(track: RobotTrack, t: number): Pose {
  const time = Math.max(0, Math.min(t, track.total));
  const motion = track.preview ? motionPoseAt(track.preview, time) : null;
  if (motion) return motion;
  const percent = track.total > 0 ? (time / track.total) * 100 : 0;
  const state = calculateRobotState(
    percent,
    track.timeline,
    track.lines,
    track.start,
    track.settings,
    identity,
    identity,
  );
  // The app's heading is screen-clockwise; the field's is counter-clockwise.
  return { x: state.x, y: state.y, headingDeg: -state.heading };
}

/** A robot's footprint: `length` along its heading, `width` across, inches. */
export interface Footprint {
  length: number;
  width: number;
}

/** The four corners of a footprint at a pose, grown by `grow` inches on every side. */
function corners(
  pose: Pose,
  size: Footprint,
  grow: number,
): [number, number][] {
  const a = (pose.headingDeg * Math.PI) / 180;
  const ux = [Math.cos(a), Math.sin(a)];
  const uy = [-Math.sin(a), Math.cos(a)];
  const hl = size.length / 2 + grow;
  const hw = size.width / 2 + grow;
  return [
    [1, 1],
    [1, -1],
    [-1, -1],
    [-1, 1],
  ].map(([s, r]) => [
    pose.x + s * hl * ux[0] + r * hw * uy[0],
    pose.y + s * hl * ux[1] + r * hw * uy[1],
  ]);
}

/** Whether two convex quadrilaterals overlap (separating axis test). */
function overlap(p: [number, number][], q: [number, number][]): boolean {
  for (const poly of [p, q]) {
    for (let i = 0; i < 4; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % 4];
      const nx = y2 - y1;
      const ny = x1 - x2;
      let minP = Infinity,
        maxP = -Infinity,
        minQ = Infinity,
        maxQ = -Infinity;
      for (const [x, y] of p) {
        const d = x * nx + y * ny;
        minP = Math.min(minP, d);
        maxP = Math.max(maxP, d);
      }
      for (const [x, y] of q) {
        const d = x * nx + y * ny;
        minQ = Math.min(minQ, d);
        maxQ = Math.max(maxQ, d);
      }
      if (maxP < minQ || maxQ < minP) return false;
    }
  }
  return true;
}

/** Two robots too close for a while. */
export interface NearMiss {
  /** Indices of the two robots. */
  a: number;
  b: number;
  t0: number;
  t1: number;
  /** True when the footprints themselves overlap at some point (a collision, not a near one). */
  contact: boolean;
  /** Where it starts: halfway between the two robots. */
  at: { x: number; y: number };
}

/** The gap two footprints may leave before it counts, inches. */
export const NEAR_MARGIN_IN = 3;

/**
 * Times two robots come within `margin` inches of each other (each footprint grown by half of
 * it), sampled every `step` seconds up to `until`.
 */
export function nearMisses(
  poses: ((t: number) => Pose)[],
  sizes: Footprint[],
  until: number,
  margin = NEAR_MARGIN_IN,
  step = 0.05,
): NearMiss[] {
  const out: NearMiss[] = [];
  for (let a = 0; a < poses.length; a++) {
    for (let b = a + 1; b < poses.length; b++) {
      let open: NearMiss | null = null;
      for (let i = 0; i * step <= until + 1e-9; i++) {
        const t = i * step;
        const pa = poses[a](t);
        const pb = poses[b](t);
        const near = overlap(
          corners(pa, sizes[a], margin / 2),
          corners(pb, sizes[b], margin / 2),
        );
        if (near) {
          const contact = overlap(
            corners(pa, sizes[a], 0),
            corners(pb, sizes[b], 0),
          );
          if (!open) {
            open = {
              a,
              b,
              t0: t,
              t1: t,
              contact,
              at: { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 },
            };
            out.push(open);
          }
          open.t1 = t;
          open.contact ||= contact;
        } else {
          open = null;
        }
      }
    }
  }
  return out.sort((m, n) => m.t0 - n.t0);
}
