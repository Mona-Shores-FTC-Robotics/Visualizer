/**
 * A partner's Auto as the drive team describes it in the pits: where it starts, then a few steps
 * (shoot its preloads, pick a FLOWER, drive to a spot, wait until a time, park), with the time it
 * says it is somewhere: "we're parked by 15". Each spot is dragged on the field; nothing is drawn by
 * hand. A route is turned into a small project the preview runs like any stand-in (`routeRobot`).
 *
 * A drive's `by` is when the partner says it gets there. The page times the drive alone first (the
 * preview, as the Match view drives it), then holds the robot at its last spot until the moment it
 * must leave to arrive by then (a wait on the match clock). Where the steps before it run late, it
 * leaves at once and arrives late, and the editor says so (`arrivals`).
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
import type { Settings } from "../types";
import type { Robot } from "./beside";

/** A spot: x, y (inches) and the heading the robot faces there (degrees). */
export interface Spot {
  x: number;
  y: number;
  h: number;
}

export type RouteStep =
  /** Shoots its preloads (or what it picked up) when its CELL is up, as the stand-ins do. */
  | { kind: "shoot" }
  /** Picks up a FLOWER where it is. */
  | { kind: "pick" }
  /** Drives to a spot; with `by`, gets there by that time; `park`: it is the park. */
  | { kind: "drive"; to: Spot; by: number | null; park: boolean }
  /** Stays where it is until this time on the match clock. */
  | { kind: "wait"; until: number };

export interface PartnerRoute {
  /** The Auto's name as the partner calls it ("X", "Close side"), or a preset's. */
  name: string;
  start: Spot;
  steps: RouteStep[];
}

/** How long a shoot waits for its CELL to come up before it fires anyway, seconds. */
export const SHOOT_WAIT_S = 12;
/** A spot is kept this far inside the walls: half the robot's 15.44 in, as a start on the wall is. */
const INSET = 7.7;
const round = (n: number) => Math.round(n * 10) / 10;

export function clampSpot(s: Spot): Spot {
  const c = (v: number) =>
    round(Math.min(FIELD_SIZE - INSET, Math.max(INSET, v)));
  return { x: c(s.x), y: c(s.y), h: ((Math.round(s.h) % 360) + 360) % 360 };
}

const spot = (x: number, y: number, h: number): Spot => ({ x, y, h });
const drive = (
  to: Spot,
  by: number | null = null,
  park = false,
): RouteStep => ({
  kind: "drive",
  to,
  by,
  park,
});

/**
 * The page's stand-ins: the partner Autos in biobuzz `TeamCode/autos/partners/` (20 Nov 2026), as
 * steps, without the broken-down ones. A starting point to change: pick one, then move its spots
 * and set its times to what the partner says. The simulator's own stand-ins are not changed.
 */
export const PRESETS: PartnerRoute[] = [
  {
    name: "L: shoot, park",
    start: spot(62.3, 133.8, 270),
    steps: [{ kind: "shoot" }, drive(spot(9.8, 117.4, 0), null, true)],
  },
  {
    name: "L: shoot, FLOWER, shoot, park",
    start: spot(62.3, 133.8, 270),
    steps: [
      drive(spot(57.5, 123.5, 273)),
      { kind: "shoot" },
      drive(spot(47.2, 119.3, 90)),
      { kind: "pick" },
      drive(spot(57.5, 123.5, 273)),
      { kind: "shoot" },
      drive(spot(9.8, 117.4, 0), null, true),
    ],
  },
  {
    name: "L: park at 15 s",
    start: spot(62.3, 133.8, 270),
    steps: [
      { kind: "wait", until: 15 },
      drive(spot(9.8, 117.4, 0), null, true),
    ],
  },
  {
    name: "L wall: park at 15 s",
    start: spot(38.3, 133.8, 270),
    steps: [{ kind: "wait", until: 15 }, drive(spot(9.8, 99.4, 0), null, true)],
  },
  {
    name: "L: leave POLLEN, park",
    start: spot(34.8, 133.4, 270),
    steps: [
      { kind: "wait", until: 2 },
      drive(spot(14.5, 133.4, 270)),
      drive(spot(9.8, 117.4, 0), null, true),
    ],
  },
  {
    name: "R: shoot, park",
    start: spot(55.6, 7.7, 90),
    steps: [{ kind: "shoot" }, drive(spot(9.6, 95.7, 0), null, true)],
  },
  {
    name: "Sits by the left wall",
    start: spot(10.3, 82, 70),
    steps: [],
  },
  {
    name: "Still: out of the way",
    start: spot(15, 133.8, 270),
    steps: [],
  },
];

export const STILL_PRESET = PRESETS[PRESETS.length - 1];

const cardId = (i: number) => `c-r${i}`;
const lineId = (i: number) => `line-r${i}`;

/**
 * The route as a project. `leaveAt[i]`, when given, holds drive `i` until that time on the match
 * clock (the page's arrive-by); without it every step goes as soon as the one before ends.
 */
export function routeDoc(
  route: PartnerRoute,
  leaveAt: Record<number, number> = {},
): ProjectDoc {
  const settings: Settings = { ...DEFAULT_SETTINGS, ...TEAM_ROBOT };
  const start = clampSpot(route.start);
  const lines: ProjectDoc["lines"] = [];
  const cards: AutoCard[] = [];
  let heading = start.h;
  route.steps.forEach((step, i) => {
    if (step.kind === "shoot") {
      cards.push(
        {
          id: `${cardId(i)}-up`,
          kind: "firstOf",
          label: "Waits for its CELL up",
          rows: [
            { when: ["CellUp"], cards: [] },
            { afterMs: SHOOT_WAIT_S * 1000, cards: [] },
          ],
        },
        { id: cardId(i), kind: "action", name: "LaunchAll" },
      );
    } else if (step.kind === "pick") {
      cards.push({
        id: cardId(i),
        kind: "action",
        name: "PickFlower",
        timeoutS: 8,
      });
    } else if (step.kind === "wait") {
      cards.push({
        id: cardId(i),
        kind: "firstOf",
        label: `Waits until ${step.until} s`,
        rows: [
          {
            afterMs: Math.round(step.until * 1000),
            matchClock: true,
            cards: [],
          },
        ],
      });
    } else {
      const to = clampSpot(step.to);
      const leave = leaveAt[i];
      if (leave !== undefined && leave > 0) {
        cards.push({
          id: `${cardId(i)}-leave`,
          kind: "firstOf",
          label: `Leaves at ${round(leave)} s`,
          rows: [
            { afterMs: Math.round(leave * 1000), matchClock: true, cards: [] },
          ],
        });
      }
      lines.push({
        kind: "atomic",
        id: lineId(i),
        name: step.park ? "Park" : `Drive ${i + 1}`,
        endPoint: { x: to.x, y: to.y },
        controlPoints: [],
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
    exportName: route.name || "Partner",
  };
  return {
    startPoint: { x: start.x, y: start.y, headingDeg: start.h, locked: false },
    lines,
    shapes: [],
    sequence: lines.map((l) => ({ kind: "path" as const, lineId: l.id })),
    fieldPoints: [],
    robot: robotConfigOf(settings),
    activePaths: [],
    auto,
  };
}

/** Each drive's seconds, by step index, from the route previewed alone with no times held. */
export function driveSeconds(
  route: PartnerRoute,
  values: TimingValues,
): Record<number, number> {
  const doc = routeDoc(route);
  const settings: Settings = { ...DEFAULT_SETTINGS, ...TEAM_ROBOT };
  const { previews } = previewTogether(
    [
      {
        auto: doc.auto!,
        startPoint: doc.startPoint,
        lines: doc.lines,
        settings,
        scenario: {},
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
export function routeRobot(route: PartnerRoute, values: TimingValues): Robot {
  const seconds = driveSeconds(route, values);
  const leaveAt: Record<number, number> = {};
  route.steps.forEach((step, i) => {
    if (step.kind === "drive" && step.by !== null && seconds[i] !== undefined)
      leaveAt[i] = Math.max(0, step.by - seconds[i]);
  });
  const doc = routeDoc(route, leaveAt);
  const settings: Settings = { ...DEFAULT_SETTINGS, ...TEAM_ROBOT };
  return { name: route.name || "Partner", doc, settings };
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

// ---- Editing --------------------------------------------------------------------------------

/** A copy with one step changed, added or removed; at most one park, and only the last drive. */
export function withSteps(
  route: PartnerRoute,
  steps: RouteStep[],
): PartnerRoute {
  const lastDrive = steps.map((s) => s.kind).lastIndexOf("drive");
  return {
    ...route,
    steps: steps.map((s, i) =>
      s.kind === "drive" ? { ...s, park: s.park && i === lastDrive } : s,
    ),
  };
}

/** Where a new drive goes: a little way on from the robot's last spot, toward the field's middle. */
export function nextSpot(route: PartnerRoute): Spot {
  const drives = route.steps.filter((s) => s.kind === "drive");
  const from = drives.length ? drives[drives.length - 1].to : route.start;
  const toward = (v: number) => v + Math.sign(FIELD_SIZE / 2 - v) * 18;
  return clampSpot({ x: toward(from.x), y: toward(from.y), h: from.h });
}

// ---- Keeping -------------------------------------------------------------------------------

function cleanSpot(raw: unknown): Spot | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const ok = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  return ok(s.x) && ok(s.y) && ok(s.h)
    ? clampSpot({ x: s.x as number, y: s.y as number, h: s.h as number })
    : null;
}

/** A route read from a saved plan or a link; anything unreadable makes it null. */
export function cleanRoute(raw: unknown): PartnerRoute | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const start = cleanSpot(r.start);
  if (!start || !Array.isArray(r.steps) || r.steps.length > 30) return null;
  const steps: RouteStep[] = [];
  for (const raw of r.steps) {
    const s = raw as Record<string, unknown>;
    if (s?.kind === "shoot" || s?.kind === "pick") steps.push({ kind: s.kind });
    else if (s?.kind === "wait" && typeof s.until === "number")
      steps.push({ kind: "wait", until: Math.min(30, Math.max(0, s.until)) });
    else if (s?.kind === "drive") {
      const to = cleanSpot(s.to);
      if (!to) return null;
      const by =
        typeof s.by === "number" && Number.isFinite(s.by)
          ? Math.min(30, Math.max(0, s.by))
          : null;
      steps.push({ kind: "drive", to, by, park: s.park === true });
    } else return null;
  }
  return withSteps(
    {
      name: typeof r.name === "string" ? r.name.slice(0, 40) : "",
      start,
      steps,
    },
    steps,
  );
}

/** A route for a link: compact JSON, base64url. */
export function encodeRoute(route: PartnerRoute): string {
  const bytes = new TextEncoder().encode(JSON.stringify(route));
  let text = "";
  for (const b of bytes) text += String.fromCharCode(b);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
