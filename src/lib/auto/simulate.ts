import type { BasePoint, StartPose, TimelineEvent } from "../../types";
import { pointAlong, timeAtFraction, type PathCatalog, type PathInfo } from "./geometry";
import { describeRow, parkCardOf, rowLabel } from "./tree";
import {
  rowKind,
  type AutoCard,
  type AutoRow,
  type AutoSection,
  type FirstOfCard,
  type PathCard,
} from "./types";

/** Length of the Autonomous period, as `AutoKit.AUTO_LENGTH_S`. */
export const AUTO_LENGTH_S = 30;

/**
 * When a registered condition becomes true in the preview: `seconds` after
 * the card waiting on it starts ("card"), or `seconds` into the Auto
 * ("start"). A disabled condition never becomes true.
 */
export interface ConditionScenario {
  enabled: boolean;
  seconds: number;
  from: "card" | "start";
}

export type Scenario = Record<string, ConditionScenario>;

export const DEFAULT_CONDITION: ConditionScenario = {
  enabled: true,
  seconds: 1,
  from: "card",
};

export type LogKind = "card" | "row" | "event" | "guard" | "warn" | "end";

export interface LogEntry {
  t: number;
  text: string;
  kind: LogKind;
  cardId?: string;
}

export interface DriveRecord {
  cardId: string;
  pathId: string;
  t0: number;
  t1: number;
}

export interface PreviewResult {
  /** Robot motion in the app's own timeline format, for the playback bar. */
  timeline: TimelineEvent[];
  log: LogEntry[];
  endTime: number;
  /** Cards that started in this preview. */
  ran: Set<string>;
  /** Decision id → index of the row that fired. */
  taken: Map<string, number>;
  drives: DriveRecord[];
  /** Set when the endgame guard cut a branch short. */
  guard: { t: number; label: string } | null;
  /** True when a wait had no row that could ever fire. */
  stalled: boolean;
}

interface Guard {
  deadline: number;
  park: PathCard;
  path: PathInfo;
  label: string;
  parked: boolean;
}

type Signal = { abortTo: Guard } | null;

/** Seconds the endgame guard reserves for a park path. */
export function guardSeconds(path: PathInfo): number {
  return path.seconds;
}

export function simulateAuto(
  auto: AutoSection,
  catalog: PathCatalog,
  startPoint: StartPose,
  scenario: Scenario,
): PreviewResult {
  const timeline: TimelineEvent[] = [];
  const log: LogEntry[] = [];
  const ran = new Set<string>();
  const taken = new Map<string, number>();
  const drives: DriveRecord[] = [];
  let guardFired: PreviewResult["guard"] = null;
  let stalled = false;

  let t = 0;
  let pos: BasePoint = { x: startPoint.x, y: startPoint.y };
  let heading = startPoint.headingDeg;

  const note = (text: string, kind: LogKind, cardId?: string, at = t) =>
    log.push({ t: at, text, kind, cardId });

  const stay = (seconds: number) => {
    if (!(seconds > 1e-6)) return;
    timeline.push({
      type: "wait",
      duration: seconds,
      startTime: t,
      endTime: t + seconds,
      startHeading: heading,
      targetHeading: heading,
      atPoint: { ...pos },
    });
    t += seconds;
  };

  /** Drive the path, or only its first `until` seconds when cut short. */
  const drive = (card: PathCard, path: PathInfo, until = Infinity) => {
    const t0 = t;
    const stop = Math.min(path.seconds, until);
    for (const event of path.travel) {
      if (event.startTime >= stop - 1e-9) break;
      const end = Math.min(event.endTime, stop);
      timeline.push({
        ...event,
        startTime: event.startTime + t0,
        endTime: end + t0,
        duration: end - event.startTime,
      });
    }
    const extras = [
      ...card.while.map((name) => `while ${name}`),
      card.park ? "park" : "",
    ].filter(Boolean);
    note(`Drive ${path.name}${extras.length ? ` · ${extras.join(", ")}` : ""}`, "card", card.id);
    for (const event of card.events) {
      if (timeAtFraction(path, event.at) > stop + 1e-9) continue;
      note(
        `${event.action} (${Math.round(event.at * 100)}% of ${path.name})`,
        "event",
        card.id,
        t0 + timeAtFraction(path, event.at),
      );
    }
    t = t0 + stop;
    drives.push({ cardId: card.id, pathId: path.id, t0, t1: t });
    if (stop < path.seconds) {
      // Where the robot was when the guard stopped it.
      const along = path.distanceAt(stop);
      pos = pointAlong(path, path.length > 0 ? along / path.length : 1);
    } else {
      pos = { ...path.end };
      heading = path.endHeadingDeg;
    }
  };

  const fireTime = (row: AutoRow, t0: number): number => {
    switch (rowKind(row)) {
      case "when": {
        let best = Infinity;
        for (const name of (row as { when: string[] }).when) {
          const sc = scenario[name] ?? DEFAULT_CONDITION;
          if (!sc.enabled) continue;
          const at = sc.from === "card" ? t0 + sc.seconds : Math.max(t0, sc.seconds);
          best = Math.min(best, at);
        }
        return best;
      }
      case "afterMs":
        return t0 + (row as { afterMs: number }).afterMs / 1000;
      case "timeLeftBelowS":
        return Math.max(t0, AUTO_LENGTH_S - (row as { timeLeftBelowS: number }).timeLeftBelowS);
      case "otherwise":
        return t0;
      case "nearPoint": {
        const near = row as { nearPoint: string; radiusIn: number };
        const point = auto.points[near.nearPoint];
        if (!point) return Infinity;
        return Math.hypot(pos.x - point[0], pos.y - point[1]) <= near.radiusIn ? t0 : Infinity;
      }
      case "inArea": {
        const [a, b] = (row as { inArea: [string, string] }).inArea.map((name) => auto.points[name]);
        if (!a || !b) return Infinity;
        const inside =
          pos.x >= Math.min(a[0], b[0]) &&
          pos.x <= Math.max(a[0], b[0]) &&
          pos.y >= Math.min(a[1], b[1]) &&
          pos.y <= Math.max(a[1], b[1]);
        return inside ? t0 : Infinity;
      }
    }
  };

  const whyRow = (row: AutoRow, waited: number): string => {
    const kind = rowKind(row);
    if (kind === "when") {
      const first = (row as { when: string[] }).when.find((name) => {
        const sc = scenario[name] ?? DEFAULT_CONDITION;
        return sc.enabled;
      });
      return `${first ?? "condition"} after ${waited.toFixed(2)} s`;
    }
    return describeRow(row);
  };

  const pendingDeadline = (guards: Guard[]): Guard | null => {
    let soonest: Guard | null = null;
    for (const guard of guards) {
      if (guard.parked) continue;
      if (!soonest || guard.deadline < soonest.deadline) soonest = guard;
    }
    return soonest;
  };

  const passedGuard = (guards: Guard[]): Guard | null => {
    // The innermost guard whose deadline has passed parks the robot.
    for (let i = guards.length - 1; i >= 0; i--) {
      const guard = guards[i];
      if (!guard.parked && t >= guard.deadline - 1e-9) return guard;
    }
    return null;
  };

  const park = (guard: Guard) => {
    guard.parked = true;
    guardFired ??= { t, label: guard.label };
    note(
      `Endgame (${guard.label}): ${(AUTO_LENGTH_S - t).toFixed(1)} s left, ${guard.path.name} needs ${guard.path.seconds.toFixed(1)} s → park now`,
      "guard",
      guard.park.id,
    );
    ran.add(guard.park.id);
    drive(guard.park, guard.path);
  };

  const runFirstOf = (card: FirstOfCard, guards: Guard[]): Signal => {
    const t0 = t;
    let winner = -1;
    let at = Infinity;
    card.rows.forEach((row, index) => {
      const fire = fireTime(row, t0);
      if (fire < at - 1e-9) {
        at = fire;
        winner = index;
      }
    });
    const label = card.label || "Wait";
    const deadline = pendingDeadline(guards);
    if (deadline && deadline.deadline < at) {
      stay(Math.max(0, deadline.deadline - t0));
      note(`${label}: cut short by the endgame guard`, "warn", card.id);
      return { abortTo: deadline };
    }
    if (winner < 0) {
      note(`${label}: no row can ever fire; the robot would wait here forever`, "warn", card.id);
      stalled = true;
      return null;
    }
    stay(at - t0);
    const row = card.rows[winner];
    taken.set(card.id, winner);
    const hasCards = card.rows.some((r) => r.cards.length > 0);
    note(
      hasCards
        ? `${label} → ${rowLabel(row)} (${whyRow(row, at - t0)})`
        : `${label}: ${whyRow(row, at - t0)}`,
      "row",
      card.id,
    );
    return runList(row.cards, guards, rowLabel(row));
  };

  const runCard = (card: AutoCard, guards: Guard[]): Signal => {
    ran.add(card.id);
    switch (card.kind) {
      case "action": {
        note(card.name || "(no action)", "card", card.id);
        const deadline = pendingDeadline(guards);
        const busy = (card.previewMs ?? 0) / 1000;
        if (deadline && deadline.deadline < t + busy) {
          stay(Math.max(0, deadline.deadline - t));
          return { abortTo: deadline };
        }
        stay(busy);
        return null;
      }
      case "path": {
        const path = catalog.byId.get(card.lineId);
        if (!path) {
          note("Path card with no path: skipped", "warn", card.id);
          return null;
        }
        // The guard does not wait for a path to finish.
        const deadline = pendingDeadline(guards);
        if (deadline && deadline.deadline < t + path.seconds - 1e-9) {
          drive(card, path, Math.max(0, deadline.deadline - t));
          note(`${path.name}: stopped by the endgame guard`, "warn", card.id);
          return { abortTo: deadline };
        }
        drive(card, path);
        return null;
      }
      case "firstOf":
        return runFirstOf(card, guards);
    }
  };

  const runList = (list: AutoCard[], outer: Guard[], label: string): Signal => {
    const parkCard = parkCardOf(list);
    const parkPath = parkCard ? catalog.byId.get(parkCard.lineId) : undefined;
    const own: Guard | null =
      parkCard && parkPath
        ? {
            deadline: AUTO_LENGTH_S - guardSeconds(parkPath),
            park: parkCard,
            path: parkPath,
            label,
            parked: false,
          }
        : null;
    const guards = own ? [...outer, own] : outer;

    for (const card of list) {
      if (stalled) return null;
      if (card === parkCard && own) {
        own.parked = true;
        const signal = runCard(card, outer);
        if (signal) return signal;
        continue;
      }
      const due = passedGuard(guards);
      if (due) {
        if (due === own) {
          park(own);
          return null;
        }
        return { abortTo: due };
      }
      const signal = runCard(card, guards);
      if (signal) {
        if (signal.abortTo === own && own) {
          park(own);
          return null;
        }
        return signal;
      }
    }
    return null;
  };

  note("Auto start", "end");
  runList(auto.cards, [], "Auto");
  note(
    stalled
      ? "Stopped: a wait can never finish"
      : t <= AUTO_LENGTH_S
        ? `Done · ${(AUTO_LENGTH_S - t).toFixed(1)} s spare`
        : `Over the 30 s Auto by ${(t - AUTO_LENGTH_S).toFixed(1)} s`,
    t <= AUTO_LENGTH_S && !stalled ? "end" : "warn",
  );
  log.sort((a, b) => a.t - b.t);
  return { timeline, log, endTime: t, ran, taken, drives, guard: guardFired, stalled };
}

// --- worst case -------------------------------------------------------------

/**
 * Worst-case timing: every wait runs until its time row fires (the robot's
 * conditions never help), and each decision may take any row that can fire.
 */
export interface WorstCase {
  /** The Auto's latest possible end time. */
  total: number;
  /** Decision id → per row: the latest end of the Auto when that row is taken (null: can never fire). */
  rows: Map<string, (number | null)[]>;
}

function waitLimit(card: FirstOfCard, t0: number): number {
  let limit = Infinity;
  for (const row of card.rows) {
    switch (rowKind(row)) {
      case "afterMs":
        limit = Math.min(limit, t0 + (row as { afterMs: number }).afterMs / 1000);
        break;
      case "timeLeftBelowS":
        limit = Math.min(
          limit,
          Math.max(t0, AUTO_LENGTH_S - (row as { timeLeftBelowS: number }).timeLeftBelowS),
        );
        break;
      case "otherwise":
        limit = Math.min(limit, t0);
        break;
    }
  }
  return limit;
}

export function worstCase(auto: AutoSection, catalog: PathCatalog): WorstCase {
  const rows = new Map<string, (number | null)[]>();
  const record = (id: string, index: number, count: number, value: number | null) => {
    const list = rows.get(id) ?? new Array<number | null>(count).fill(null);
    const current = list[index];
    if (value !== null && (current === null || value > current)) list[index] = value;
    rows.set(id, list);
  };

  const endOf = (list: AutoCard[], start: number, index: number, rest: (t: number) => number): number => {
    let t = start;
    for (let i = index; i < list.length; i++) {
      const card = list[i];
      if (card.kind === "action") t += (card.previewMs ?? 0) / 1000;
      else if (card.kind === "path") t += catalog.byId.get(card.lineId)?.seconds ?? 0;
      else {
        const limit = waitLimit(card, t);
        if (!Number.isFinite(limit)) return Infinity;
        const after = (end: number) => endOf(list, end, i + 1, rest);
        let worst = -Infinity;
        card.rows.forEach((row, rowIndex) => {
          const kind = rowKind(row);
          const time = kind === "afterMs" || kind === "timeLeftBelowS" || kind === "otherwise"
            ? waitLimit({ ...card, rows: [row] }, t)
            : limit;
          // A time row later than the earliest one never wins.
          if (time > limit + 1e-9) {
            record(card.id, rowIndex, card.rows.length, null);
            return;
          }
          const end = endOf(row.cards, time, 0, after);
          record(card.id, rowIndex, card.rows.length, end);
          worst = Math.max(worst, end);
        });
        return worst;
      }
    }
    return rest(t);
  };

  const total = endOf(auto.cards, 0, 0, (t) => t);
  return { total, rows };
}
