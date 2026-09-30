import type { BasePoint, StartPose, TimelineEvent } from "../../types";
import { pointAlong, type PathCatalog, type PathInfo } from "./geometry";
import { allCards, cardTitle, describeRow, isPlainWait, parkCardOf, rowLabel } from "./tree";
import { poseAlong, type Motion } from "./motion";
import {
  DEFAULT_TIMEOUT_S,
  rowKind,
  type ActionCard,
  type AutoCard,
  type AutoRow,
  type AutoSection,
  type FirstOfCard,
  type PathCard,
} from "./types";

/**
 * How long a command step keeps the robot busy in the preview: the command's typical time from
 * the robot's list, else an older file's preview time, else instant; never past its timeout.
 */
export function commandSeconds(auto: AutoSection, card: ActionCard): number {
  const typical = auto.registry.typicalS?.[card.name] ?? (card.previewMs ?? 0) / 1000;
  return Math.min(typical, card.timeoutS ?? DEFAULT_TIMEOUT_S);
}

/**
 * How long a wait's `alongside` command runs in the preview: its typical time, capped at the
 * default timeout (the robot runs it with `kit.command(name)`). 0 with none.
 */
export function alongsideSeconds(auto: AutoSection, card: FirstOfCard): number {
  if (!card.alongside) return 0;
  return Math.min(auto.registry.typicalS?.[card.alongside] ?? 0, DEFAULT_TIMEOUT_S);
}

/** Length of the Autonomous period, as `AutoKit.AUTO_LENGTH_S`. */
export const AUTO_LENGTH_S = 30;

/**
 * The preview's answers. Each wait that branches has its own switch, keyed by `switchKey(card)`:
 * true, its trigger fires (✓); false, its time limit passes. A plain wait (no cards on either row)
 * is not a switch: its trigger's answer, keyed by the trigger's name, holds for every plain wait on
 * it (IntakeFull ✓ or ✗). A branching wait with no switch of its own falls back to its trigger's
 * answer, so setting a trigger sets every wait on it. Unanswered questions are true.
 */
export type Scenario = Record<string, boolean>;

/** What a question is before anyone answers it: the happy path. */
export const DEFAULT_ANSWER = true;

/** Where a branching wait's own answer is kept. */
export function switchKey(cardId: string): string {
  return `wait:${cardId}`;
}

/** Whether `card`'s trigger fires in `scenario`. */
export function answerFor(scenario: Scenario, card: FirstOfCard, condition: string): boolean {
  const own = isPlainWait(card) ? undefined : scenario[switchKey(card.id)];
  return own ?? scenario[condition] ?? DEFAULT_ANSWER;
}

/** A question the preview asks: a wait's trigger. */
export interface PreviewQuestion {
  cardId: string;
  condition: string;
  /** The card asking, as the list names it. */
  card: string;
  /** True when the wait branches, so it has a switch of its own. */
  branching: boolean;
}

/** Every question in the Auto, in the order the Auto reaches the cards. */
export function previewQuestions(auto: AutoSection): PreviewQuestion[] {
  const questions: PreviewQuestion[] = [];
  for (const card of allCards(auto.cards)) {
    if (card.kind !== "firstOf") continue;
    for (const row of card.rows) {
      if (!("when" in row)) continue;
      for (const condition of row.when) {
        if (questions.some((q) => q.cardId === card.id && q.condition === condition)) continue;
        questions.push({ cardId: card.id, condition, card: cardTitle(card), branching: !isPlainWait(card) });
      }
    }
  }
  return questions;
}

/** A scenario where every wait on `condition` answers `yes`: its own switches cleared. */
export function setTrigger(scenario: Scenario, auto: AutoSection, condition: string, yes: boolean): Scenario {
  const next: Scenario = { ...scenario, [condition]: yes };
  for (const q of previewQuestions(auto)) {
    if (q.condition === condition) delete next[switchKey(q.cardId)];
  }
  return next;
}

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

/** A drive that is not a project path (routine pattern, exit, goTo). */
export interface MotionRecord {
  cardId: string;
  t0: number;
  t1: number;
  motion: Motion;
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
  /**
   * Drives that are not project paths. The timeline holds a stand-in wait
   * for each; `motionPoseAt` gives the robot's pose during them.
   */
  motions: MotionRecord[];
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
  const motions: MotionRecord[] = [];
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
    note(`Drive ${path.name}${card.park ? " · park" : ""}`, "card", card.id);
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

  /**
   * A row asking conditions fires the moment it is asked if any is answered true; while a command
   * runs alongside, answered true means "by the time it finishes" (the launch is what tips the
   * HIVE), so ✓ never looks faster than the command it waits on.
   */
  const fireTime = (card: FirstOfCard, row: AutoRow, t0: number): number => {
    const alongEnd = card.alongside ? t0 + alongsideSeconds(auto, card) : Infinity;
    if ("when" in row) {
      return row.when.some((name) => answerFor(scenario, card, name))
        ? (card.alongside ? alongEnd : t0)
        : Infinity;
    }
    return t0 + row.afterMs / 1000;
  };

  const whyRow = (card: FirstOfCard, row: AutoRow): string => {
    if (rowKind(row) === "when") {
      const first = (row as { when: string[] }).when.find((name) => answerFor(scenario, card, name));
      return `${first ?? "condition"} true`;
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
      const fire = fireTime(card, row, t0);
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
    if (card.alongside) {
      const along = alongsideSeconds(auto, card);
      note(`${label}: ${card.alongside} alongside`, "card", card.id);
      if (at < t0 + along - 1e-9) note(`${card.alongside} stopped after ${(at - t0).toFixed(2)} s`, "event", card.id);
    }
    stay(at - t0);
    const row = card.rows[winner];
    taken.set(card.id, winner);
    const hasCards = card.rows.some((r) => r.cards.length > 0);
    note(
      hasCards
        ? `${label} → ${rowLabel(row)} (${whyRow(card, row)})`
        : `${label}: ${whyRow(card, row)}`,
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
        const busy = commandSeconds(auto, card);
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
  return { timeline, log, endTime: t, ran, taken, drives, motions, guard: guardFired, stalled };
}

/** The robot's pose during a preview motion that is not a project path, else null (none today). */
export function motionPoseAt(
  preview: PreviewResult,
  time: number,
): { x: number; y: number; headingDeg: number } | null {
  for (const record of preview.motions) {
    if (time >= record.t0 - 1e-9 && time <= record.t1 + 1e-9) {
      return poseAlong(record.motion, record.motion.distanceAt(time - record.t0));
    }
  }
  return null;
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
    if ("afterMs" in row) limit = Math.min(limit, t0 + row.afterMs / 1000);
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
      if (card.kind === "action") t += commandSeconds(auto, card);
      else if (card.kind === "path") t += catalog.byId.get(card.lineId)?.seconds ?? 0;
      else {
        const limit = waitLimit(card, t);
        if (!Number.isFinite(limit)) return Infinity;
        const after = (end: number) => endOf(list, end, i + 1, rest);
        let worst = -Infinity;
        card.rows.forEach((row, rowIndex) => {
          // The trigger may fire as late as the limit.
          const time = "afterMs" in row ? t + row.afterMs / 1000 : limit;
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
