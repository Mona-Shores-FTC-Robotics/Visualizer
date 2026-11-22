/**
 * A partner's Auto as the drive team describes it in the pits: where it starts, then a few steps
 * (shoot, pick a FLOWER, gather at the GARDEN, drive to a spot, wait until a time), with the times
 * they give: "we shoot at 5", "we're parked by 20". Each spot is dragged on the field, and a drive
 * may bend through one point (Pedro curves through it). A route is turned into a small project the
 * preview runs like any stand-in (`routeRobot`).
 *
 * Times, in the team's words (biobuzz TeamCode/autos/timing-terms.md):
 * - A shot's `at` is when its launch starts; the robot's volley, `volleyS` (3.5 s unless they say
 *   otherwise), runs from there to its last ball leaving. The page then shows when their CELL
 *   settles, from the HIVE model.
 * - A drive's `by` is when they say they are there. The page times the drive alone first, then
 *   holds the robot at its last spot until the moment it must leave (a wait on the match clock).
 *   Where the steps before it run late, it leaves at once and arrives late, and the page says so.
 * - `delayS` is a "they wait": every time in the route moves that much later, as when a partner
 *   agrees to start a second later to let us by.
 *
 * Field inches, red's frame (blue is turned half a turn by the page, never stored).
 */
import { DEFAULT_SETTINGS, FIELD_SIZE } from "../config/defaults";
import { robotConfigOf, type ProjectDoc } from "../io";
import type { PreviewResult } from "../lib/auto/simulate";
import { TEAM_ROBOT, teamRegistry } from "../lib/auto/teamRobot";
import type { AutoCard, AutoSection } from "../lib/auto/types";
import type { TimingValues } from "../lib/timing/model";
import { previewTogether } from "../lib/timing/together";
import type { BasePoint, Settings } from "../types";
import type { Robot } from "./beside";

/** A spot: x, y (inches) and the heading the robot faces there (degrees). */
export interface Spot {
  x: number;
  y: number;
  h: number;
}

export type RouteStep =
  /** Shoots: its launch starts at `at` (null: as soon as the step before is done). */
  /**
   * Shoots. `at`: a time its launch starts ("we shoot at 5"); "up": as soon as its CELL is up (at
   * the latest at UP_SHOT_BY_S, so it still parks); null: as soon as the step before is done.
   */
  | { kind: "shoot"; at: number | "up" | null }
  /** Picks up a FLOWER where it is. */
  | { kind: "pick" }
  /**
   * The SUPER FLOWER (a robot with a turret): it waits at the FLOWER with its preloads, and when its
   * CELL comes up (TIP 1, for a left start) takes the FLOWER's four and fires all eight in one go.
   */
  | { kind: "superFlower" }
  /** Gathers at the GARDEN where it is. */
  | { kind: "gather" }
  /**
   * Drives to a spot, curving through `bend` if set; with `by`, gets there by that time; `park`:
   * it is the park.
   */
  | {
      kind: "drive";
      to: Spot;
      bend: BasePoint | null;
      by: number | null;
      park: boolean;
    }
  /** Stays where it is until this time on the match clock. */
  | { kind: "wait"; until: number };

export interface PartnerRoute {
  /** The Auto's name as the partner calls it ("X", "Close side"), or a preset's. */
  name: string;
  start: Spot;
  steps: RouteStep[];
  /** Seconds from a shot's launch starting to its last ball leaving. */
  volleyS: number;
  /** "They wait": every time in the route this much later, seconds. */
  delayS: number;
}

/** A shot waiting for its CELL up fires at this time on the match clock at the latest. */
export const UP_SHOT_BY_S = 25;
/** A volley's length when the partner does not say: launch starts to last ball leaves. */
export const DEFAULT_VOLLEY_S = 3.5;
/** A spot is kept this far inside the walls: half the robot's 15.44 in, as a start on the wall is. */
const INSET = 7.7;
const round = (n: number) => Math.round(n * 10) / 10;

export function clampSpot(s: Spot): Spot {
  const c = (v: number) =>
    round(Math.min(FIELD_SIZE - INSET, Math.max(INSET, v)));
  return { x: c(s.x), y: c(s.y), h: ((Math.round(s.h) % 360) + 360) % 360 };
}

export function clampPoint(p: BasePoint): BasePoint {
  const c = (v: number) =>
    round(Math.min(FIELD_SIZE - INSET, Math.max(INSET, v)));
  return { x: c(p.x), y: c(p.y) };
}

// ---- The page's stand-ins -------------------------------------------------------------------

const spot = (x: number, y: number, h: number): Spot => ({ x, y, h });
const drive = (
  to: Spot,
  park = false,
  bend: BasePoint | null = null,
  by: number | null = null,
): RouteStep => ({
  kind: "drive",
  to,
  bend,
  by,
  park,
});
const shoot: RouteStep = { kind: "shoot", at: "up" };
const pick: RouteStep = { kind: "pick" };
const route = (
  name: string,
  start: Spot,
  steps: RouteStep[],
): PartnerRoute => ({
  name,
  start,
  steps,
  volleyS: DEFAULT_VOLLEY_S,
  delayS: 0,
});

/** The team's spots (biobuzz TeamCode/autos/spots.json), red's. */
const LEFT_START = spot(62.3, 133.8, 270);
const RIGHT_START = spot(55.6, 7.7, 90);
const LEFT_PARK = spot(14.5, 117.4, 0);
const RIGHT_PARK = spot(14.5, 98.7, 0);
const SCORING_FLOWER_STAGING = spot(47.2, 119.3, 90);
const WALL_FLOWER_STAGING = spot(23.1, 47.2, 180);
/** The middle of the right start's tile (58.75, 10.75: a tile is 24 in, the edge tiles 1.25 in under the walls), to a tenth. */
const RIGHT_START_TILE = spot(58.8, 10.8, 90);
/** Out of the top of the HIVE on the lane under it, on the way from under it to LEFT_PARK. */
const OUT_OF_THE_HIVE: BasePoint = { x: 58, y: 110 };
/** Below the SCORING FLOWER on the way from the left start to LEFT_PARK. */
const PAST_SCORING_FLOWER: BasePoint = { x: 45, y: 112 };
/** Under the HIVE's left half, on the lane L-LeftUnderHive drives under it. */
const UNDER_HIVE_LEFT = spot(59, 85, 270);

/**
 * The page's stand-ins: a starting point to change to what the partner says, by picture. A
 * left-start one parks on the left (LEFT_PARK), a right-start one on the right (RIGHT_PARK).
 * "R: shoot, FLOWER, shoot, park" is our R-NoCross's main route (without its GARDEN trip, which only
 * fits with our endgame guard). The SUPER FLOWER is for a partner with a turret: staged at the
 * SCORING FLOWER, it fires eight in a row as soon as TIP 1 brings its CELL up. The simulator's
 * stand-ins are not these.
 */
export const PRESETS: PartnerRoute[] = [
  // Off the wall first and past the SCORING FLOWER below it (the FLOWER stands out from the wall
  // at x about 47), not in a straight line through it.
  route("L: shoot, park", LEFT_START, [
    shoot,
    drive(LEFT_PARK, true, PAST_SCORING_FLOWER),
  ]),
  // Out of the way after its preloads: onto the lane our L-LeftUnderHive crosses under the HIVE
  // by (LEFT_AUTO_HIVE to RIGHT_AUTO_FIX_TIP, x about 59), just inside the HIVE's left half.
  // It stays there until it must leave to be parked with about 4.5 s left, and leaves the way it
  // came in: back out the top of the HIVE along the lane, then over to LEFT_PARK, never through the
  // HIVE's side.
  route("L: shoot, hide under the HIVE", LEFT_START, [
    shoot,
    drive(UNDER_HIVE_LEFT),
    drive(LEFT_PARK, true, OUT_OF_THE_HIVE, 25.5),
  ]),
  route("L: SUPER FLOWER (turret)", LEFT_START, [
    drive(SCORING_FLOWER_STAGING),
    { kind: "superFlower" },
    drive(LEFT_PARK, true),
  ]),
  // Up the field in an arc toward the left wall, not straight across the middle; drag the bend.
  route("R: shoot, park", RIGHT_START, [
    shoot,
    drive(RIGHT_PARK, true, { x: 26, y: 55 }),
  ]),
  // Shoots from its start (no move up to the HIVE, as ours does), the WALL FLOWER, back to the
  // middle of its start tile to shoot again when its CELL is back up (TIP 2), then up the field in
  // an arc to its park.
  route("R: shoot, FLOWER, shoot, park", RIGHT_START, [
    shoot,
    drive(WALL_FLOWER_STAGING),
    pick,
    drive(RIGHT_START_TILE),
    shoot,
    drive(RIGHT_PARK, true, { x: 26, y: 55 }),
  ]),
  route("Corner and park", spot(15, 133.8, 270), [drive(LEFT_PARK, true)]),
  route("Still: out of the way", spot(15, 133.8, 270), []),
];

export const STILL_PRESET = PRESETS[PRESETS.length - 1];

// ---- Running it ------------------------------------------------------------------------------

const cardId = (i: number) => `c-r${i}`;
const lineId = (i: number) => `line-r${i}`;
const SETTINGS: Settings = { ...DEFAULT_SETTINGS, ...TEAM_ROBOT };

/** The partner robot's own timing: its volley as they say it, from launch start (no spin-up). */
export function routeFacts(r: PartnerRoute): Partial<TimingValues> {
  return { volleyS: r.volleyS, spinUpS: 0 };
}

const holdUntil = (id: string, label: string, s: number): AutoCard => ({
  id,
  kind: "firstOf",
  label,
  rows: [{ afterMs: Math.round(s * 1000), matchClock: true, cards: [] }],
});

/**
 * The route as a project. `leaveAt[i]`, when given, holds drive `i` until that time on the match
 * clock (the page's arrive-by, already with the delay); every other time gets `delayS` added.
 */
export function routeDoc(
  r: PartnerRoute,
  leaveAt: Record<number, number> = {},
): ProjectDoc {
  const start = clampSpot(r.start);
  const lines: ProjectDoc["lines"] = [];
  const cards: AutoCard[] = [];
  const delay = Math.max(0, r.delayS);
  let heading = start.h;
  if (delay > 0)
    cards.push(holdUntil("c-delay", `They wait ${delay} s`, delay));
  r.steps.forEach((step, i) => {
    if (step.kind === "shoot") {
      if (step.at === "up")
        cards.push({
          id: `${cardId(i)}-at`,
          kind: "firstOf",
          label: "Shoots when its CELL is up",
          rows: [
            { when: ["CellUp"], cards: [] },
            {
              afterMs: Math.round((UP_SHOT_BY_S + delay) * 1000),
              matchClock: true,
              cards: [],
            },
          ],
        });
      else if (step.at !== null)
        cards.push(
          holdUntil(
            `${cardId(i)}-at`,
            `Shoots at ${step.at + delay} s`,
            step.at + delay,
          ),
        );
      cards.push({ id: cardId(i), kind: "action", name: "LaunchAll" });
    } else if (step.kind === "superFlower") {
      cards.push(
        {
          id: `${cardId(i)}-up`,
          kind: "firstOf",
          label: "Waits at the FLOWER for its CELL up",
          rows: [
            { when: ["CellUp"], cards: [] },
            { afterMs: 30000, matchClock: true, cards: [] },
          ],
        },
        { id: cardId(i), kind: "action", name: "PickFlowerLaunch" },
      );
    } else if (step.kind === "pick" || step.kind === "gather") {
      cards.push({
        id: cardId(i),
        kind: "action",
        name: step.kind === "pick" ? "PickFlower" : "GardenGather",
        timeoutS: 8,
      });
    } else if (step.kind === "wait") {
      cards.push(
        holdUntil(
          cardId(i),
          `Waits until ${step.until + delay} s`,
          step.until + delay,
        ),
      );
    } else {
      const to = clampSpot(step.to);
      const leave = leaveAt[i];
      if (leave !== undefined && leave > 0)
        cards.push(
          holdUntil(`${cardId(i)}-leave`, `Leaves at ${round(leave)} s`, leave),
        );
      lines.push({
        kind: "atomic",
        id: lineId(i),
        name: step.park ? "Park" : `Drive ${i + 1}`,
        endPoint: { x: to.x, y: to.y },
        controlPoints: [],
        ...(step.bend ? { throughPoints: [clampPoint(step.bend)] } : {}),
        heading: { type: "linear", startDeg: heading, endDeg: to.h },
        color: "#4ECDC4",
        locked: false,
        waitBeforeMs: 0,
        waitAfterMs: 0,
        waitBeforeName: "",
        waitAfterName: "",
      });
      // Never a park card: that would give the partner our robot's endgame guard, which parks
      // early when its cards will not fit by 30 s. A partner runs its own code; the page only
      // calls its last drive the park.
      cards.push({
        id: cardId(i),
        kind: "path",
        lineId: lineId(i),
        park: false,
      });
      heading = to.h;
    }
  });
  const auto: AutoSection = {
    version: 1,
    drawnFor: "RED",
    registry: teamRegistry(),
    points: {},
    pathEnds: {},
    cards,
    exportName: r.name || "Partner",
  };
  return {
    startPoint: { x: start.x, y: start.y, headingDeg: start.h, locked: false },
    lines,
    shapes: [],
    sequence: lines.map((l) => ({ kind: "path" as const, lineId: l.id })),
    fieldPoints: [],
    robot: robotConfigOf(SETTINGS),
    activePaths: [],
    auto,
  };
}

/** Each drive's seconds, by step index, from the route previewed alone with no times held. */
export function driveSeconds(
  r: PartnerRoute,
  values: TimingValues,
): Record<number, number> {
  const doc = routeDoc(r);
  const { previews } = previewTogether(
    [
      {
        auto: doc.auto!,
        startPoint: doc.startPoint,
        lines: doc.lines,
        settings: SETTINGS,
        scenario: {},
        own: routeFacts(r),
      },
    ],
    values,
    false,
    { tipsCome: true },
  );
  const out: Record<number, number> = {};
  for (const d of previews[0].drives) {
    const m = /^c-r(\d+)$/.exec(d.cardId);
    if (m) out[Number(m[1])] = d.t1 - d.t0;
  }
  return out;
}

/** The route as a robot to run: each drive with a `by` leaves in time to arrive then. */
export function routeRobot(r: PartnerRoute, values: TimingValues): Robot {
  const seconds = driveSeconds(r, values);
  const leaveAt: Record<number, number> = {};
  r.steps.forEach((step, i) => {
    if (step.kind === "drive" && step.by !== null && seconds[i] !== undefined)
      leaveAt[i] = Math.max(0, step.by + Math.max(0, r.delayS) - seconds[i]);
  });
  return {
    name: r.name || "Partner",
    doc: routeDoc(r, leaveAt),
    settings: SETTINGS,
    own: routeFacts(r),
  };
}

/** When each drive of the route got there in a preview, by step index. */
export function arrivals(
  preview: PreviewResult | undefined,
): Record<number, number> {
  const out: Record<number, number> = {};
  for (const d of preview?.drives ?? []) {
    const m = /^c-r(\d+)$/.exec(d.cardId);
    if (m) out[Number(m[1])] = d.t1;
  }
  return out;
}

/** Each shot's launch, start to last ball leaving, by step index, in a preview. */
export function launches(
  preview: PreviewResult | undefined,
): Record<number, { t0: number; t1: number }> {
  const out: Record<number, { t0: number; t1: number }> = {};
  for (const a of preview?.actions ?? []) {
    const m = /^c-r(\d+)$/.exec(a.cardId ?? "");
    if (m && (a.command === "LaunchAll" || a.command === "PickFlowerLaunch"))
      out[Number(m[1])] = { t0: a.t0, t1: a.t1 };
  }
  return out;
}

/** The route's path on the field: its start, then each spot it drives to, through its bends. */
export function routePath(r: PartnerRoute): BasePoint[] {
  return [
    r.start,
    ...r.steps.flatMap((s) =>
      s.kind === "drive" ? (s.bend ? [s.bend, s.to] : [s.to]) : [],
    ),
  ];
}

// ---- Editing --------------------------------------------------------------------------------

/** A copy with its steps changed; at most one park, and only the last drive. */
export function withSteps(r: PartnerRoute, steps: RouteStep[]): PartnerRoute {
  const lastDrive = steps.map((s) => s.kind).lastIndexOf("drive");
  return {
    ...r,
    steps: steps.map((s, i) =>
      s.kind === "drive" ? { ...s, park: s.park && i === lastDrive } : s,
    ),
  };
}

/** Where a new drive goes: a little way on from the robot's last spot, toward the field's middle. */
export function nextSpot(r: PartnerRoute): Spot {
  const drives = r.steps.flatMap((s) => (s.kind === "drive" ? [s] : []));
  const from = drives.length ? drives[drives.length - 1].to : r.start;
  const toward = (v: number) => v + Math.sign(FIELD_SIZE / 2 - v) * 18;
  return clampSpot({ x: toward(from.x), y: toward(from.y), h: from.h });
}

/** Where drive `i` starts: the spot before it. */
export function driveFrom(r: PartnerRoute, i: number): Spot {
  for (let k = i - 1; k >= 0; k--) {
    const s = r.steps[k];
    if (s.kind === "drive") return s.to;
  }
  return r.start;
}

// ---- Keeping -------------------------------------------------------------------------------

const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const time = (v: unknown) =>
  num(v) ? Math.min(30, Math.max(0, v as number)) : null;

function cleanSpot(raw: unknown): Spot | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  return num(s.x) && num(s.y) && num(s.h)
    ? clampSpot({ x: s.x as number, y: s.y as number, h: s.h as number })
    : null;
}

function cleanPoint(raw: unknown): BasePoint | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  return num(s.x) && num(s.y)
    ? clampPoint({ x: s.x as number, y: s.y as number })
    : null;
}

/**
 * A route read from a saved plan, the team library or a link; anything unreadable makes it null.
 * A shot's own `volleyS` (as the library format allows) sets the route's when the route has none.
 */
export function cleanRoute(raw: unknown): PartnerRoute | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const start = cleanSpot(r.start);
  if (!start || !Array.isArray(r.steps) || r.steps.length > 30) return null;
  const steps: RouteStep[] = [];
  let shotVolley: number | null = null;
  for (const raw of r.steps) {
    const s = raw as Record<string, unknown>;
    if (s?.kind === "shoot") {
      steps.push({ kind: "shoot", at: s.at === "up" ? "up" : time(s.at) });
      if (shotVolley === null && num(s.volleyS))
        shotVolley = s.volleyS as number;
    } else if (
      s?.kind === "pick" ||
      s?.kind === "gather" ||
      s?.kind === "superFlower"
    )
      steps.push({ kind: s.kind });
    else if (s?.kind === "wait" && num(s.until))
      steps.push({ kind: "wait", until: time(s.until)! });
    else if (s?.kind === "drive") {
      const to = cleanSpot(s.to);
      if (!to) return null;
      steps.push({
        kind: "drive",
        to,
        bend: cleanPoint(s.bend),
        by: time(s.by),
        park: s.park === true,
      });
    } else return null;
  }
  const volley = num(r.volleyS) ? (r.volleyS as number) : shotVolley;
  return withSteps(
    {
      name: typeof r.name === "string" ? r.name.slice(0, 40) : "",
      start,
      steps,
      volleyS:
        volley !== null
          ? Math.min(10, Math.max(0.5, volley))
          : DEFAULT_VOLLEY_S,
      delayS: num(r.delayS) ? Math.min(15, Math.max(0, r.delayS as number)) : 0,
    },
    steps,
  );
}

/** A route for a link: compact JSON, base64url. */
export function encodeRoute(r: PartnerRoute): string {
  const bytes = new TextEncoder().encode(JSON.stringify(r));
  let text = "";
  for (const b of bytes) text += String.fromCharCode(b);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * A route in a link's `r=`, as short as it goes and only in QR's alphanumeric characters (capitals,
 * digits and ` $%*+-./:`), which a QR code packs at 5.5 bits each, not 8: a partner's Auto fits a
 * code an old tablet's camera still reads. Fields are split by `$`: `1` (the format), the name
 * (capitals, `+` for a space), the start `x/y/h`, the volley, the delay, then the steps split by `*`:
 * `S` shoot (`SU` when its CELL is up, `S12` at 12 s), `P` pick, `G` gather, `F` SUPER FLOWER,
 * `W12` wait until 12 s, `Dx/y/h` drive, then `/Bx/y` its bend, `/T9` by 9 s, `/K` the park.
 */
export function encodeShort(r: PartnerRoute): string {
  const n = (v: number) => String(Math.round(v * 10) / 10);
  const spot = (s: Spot) => `${n(s.x)}/${n(s.y)}/${n(s.h)}`;
  const name = r.name
    .toUpperCase()
    .replace(/[^0-9A-Z .:-]/g, "")
    .trim()
    .replace(/ +/g, "+");
  const steps = r.steps.map((s) => {
    switch (s.kind) {
      case "shoot":
        return `S${s.at === "up" ? "U" : s.at === null ? "" : n(s.at)}`;
      case "pick":
        return "P";
      case "gather":
        return "G";
      case "superFlower":
        return "F";
      case "wait":
        return `W${n(s.until)}`;
      case "drive":
        return (
          `D${spot(s.to)}` +
          (s.bend ? `/B${n(s.bend.x)}/${n(s.bend.y)}` : "") +
          (s.by !== null ? `/T${n(s.by)}` : "") +
          (s.park ? "/K" : "")
        );
    }
  });
  return [
    "1",
    name,
    spot(r.start),
    n(r.volleyS),
    n(r.delayS),
    steps.join("*"),
  ].join("$");
}

export function decodeShort(code: string): PartnerRoute | null {
  const [format, name, start, volley, delay, steps = ""] = code.split("$");
  if (format !== "1" || start === undefined) return null;
  const nums = (text: string) => text.split("/").map(Number);
  const spotOf = (text: string) => {
    const [x, y, h] = nums(text);
    return { x, y, h };
  };
  const raw = {
    name: (name ?? "").replace(/\+/g, " "),
    start: spotOf(start),
    volleyS: Number(volley),
    delayS: Number(delay),
    steps: (steps ? steps.split("*") : []).map((token) => {
      const head = token[0];
      const rest = token.slice(1);
      if (head === "S")
        return {
          kind: "shoot",
          at: rest === "U" ? "up" : rest === "" ? null : Number(rest),
        };
      if (head === "P") return { kind: "pick" };
      if (head === "G") return { kind: "gather" };
      if (head === "F") return { kind: "superFlower" };
      if (head === "W") return { kind: "wait", until: Number(rest) };
      if (head === "D") {
        const parts = rest.split("/");
        const step: Record<string, unknown> = {
          kind: "drive",
          to: spotOf(parts.slice(0, 3).join("/")),
          bend: null,
          by: null,
          park: false,
        };
        for (let i = 3; i < parts.length; i++) {
          const p = parts[i];
          if (p.startsWith("B")) {
            step.bend = { x: Number(p.slice(1)), y: Number(parts[++i]) };
          } else if (p.startsWith("T")) step.by = Number(p.slice(1));
          else if (p === "K") step.park = true;
        }
        return step;
      }
      return { kind: "?" };
    }),
  };
  return cleanRoute(raw);
}

export function decodeRoute(code: string): PartnerRoute | null {
  try {
    const text = atob(code.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(text, (c) => c.charCodeAt(0));
    return cleanRoute(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}
