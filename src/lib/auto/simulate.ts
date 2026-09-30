import type { BasePoint, StartPose, TimelineEvent } from "../../types";
import { pointAlong, timeAtFraction, type PathCatalog, type PathInfo } from "./geometry";
import { allCards, cardTitle, describeRow, parkCardOf, rowLabel } from "./tree";
import {
  motionAlong,
  placementAt,
  placeRoutine,
  poseAlong,
  segmentSamples,
  straightMotion,
  type Motion,
} from "./motion";
import {
  DEFAULT_TIMEOUT_S,
  rowKind,
  type ActionCard,
  type AutoCard,
  type AutoRow,
  type AutoSection,
  type FirstOfCard,
  type GoToCard,
  type PathCard,
  type RoutineCard,
  type TogetherCard,
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
 * The preview's answers, one per condition: true, the condition is true
 * whenever a card asks it (a row fires at once); false, it never is (every
 * wait on it runs to its time row). Events are separate names (Tip1, Tip2),
 * so "not tipped at the first decision, tipped at the later one" is Tip1
 * false, Tip2 true. Unanswered conditions are true.
 */
export type Scenario = Record<string, boolean>;

/** What a question is before anyone answers it: the happy path. */
export const DEFAULT_ANSWER = true;

/** Where a condition's answer is kept. The asking card does not matter. */
export function questionKey(_cardId: string, condition: string): string {
  return condition;
}

export function answerOf(scenario: Scenario, cardId: string, condition: string): boolean {
  return scenario[questionKey(cardId, condition)] ?? DEFAULT_ANSWER;
}

/** A question the preview asks: a condition in a card's row, or a routine's end condition. */
export interface PreviewQuestion {
  cardId: string;
  condition: string;
  /** The card asking, as the list names it. */
  card: string;
}

/** Every question in the Auto, in the order the Auto reaches the cards. */
export function previewQuestions(auto: AutoSection): PreviewQuestion[] {
  const questions: PreviewQuestion[] = [];
  const add = (card: AutoCard, condition: string) => {
    if (!questions.some((q) => q.cardId === card.id && q.condition === condition)) {
      questions.push({ cardId: card.id, condition, card: cardTitle(card) });
    }
  };
  for (const card of allCards(auto.cards)) {
    if (card.kind === "firstOf") {
      for (const row of card.rows) {
        if (rowKind(row) === "when") (row as { when: string[] }).when.forEach((name) => add(card, name));
      }
    } else if (card.kind === "routine") {
      const endsWhen = auto.routines[card.routine]?.endsWhen;
      if (endsWhen) add(card, endsWhen);
    }
  }
  return questions;
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
  const settings = catalog.settings;
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

  /** Drive a motion, or only its first `until` seconds when cut short. */
  const move = (cardId: string, motion: Motion, until = Infinity) => {
    const seconds = Math.min(motion.seconds, until);
    const end = poseAlong(motion, motion.distanceAt(seconds));
    if (seconds > 1e-6) {
      timeline.push({
        type: "wait",
        duration: seconds,
        startTime: t,
        endTime: t + seconds,
        startHeading: heading,
        targetHeading: end.headingDeg,
        atPoint: { ...pos },
      });
      motions.push({ cardId, t0: t, t1: t + seconds, motion });
      t += seconds;
    }
    pos = { x: end.x, y: end.y };
    heading = end.headingDeg;
  };

  /**
   * A row asking conditions fires the moment it is asked if any is answered true; while a command
   * runs alongside, answered true means "by the time it finishes" (the launch is what tips the
   * HIVE), so ✓ never looks faster than the command it waits on.
   */
  const fireTime = (card: FirstOfCard, row: AutoRow, t0: number): number => {
    const cardId = card.id;
    const alongEnd = card.alongside ? t0 + alongsideSeconds(auto, card) : Infinity;
    switch (rowKind(row)) {
      case "finished":
        return alongEnd;
      case "when":
        return (row as { when: string[] }).when.some((name) => answerOf(scenario, cardId, name))
          ? (card.alongside ? alongEnd : t0)
          : Infinity;
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

  const whyRow = (cardId: string, row: AutoRow): string => {
    if (rowKind(row) === "when") {
      const first = (row as { when: string[] }).when.find((name) => answerOf(scenario, cardId, name));
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
        ? `${label} → ${rowLabel(row)} (${whyRow(card.id, row)})`
        : `${label}: ${whyRow(card.id, row)}`,
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
      case "routine":
        return runRoutine(card, guards);
      case "goTo":
        return runGoTo(card, guards);
      case "together":
        return runTogether(card, guards);
    }
  };

  /** Move, unless the endgame guard's deadline comes first. */
  const guardedMove = (cardId: string, motion: Motion, until: number, guards: Guard[], what: string): Signal => {
    const deadline = pendingDeadline(guards);
    const seconds = Math.min(motion.seconds, until);
    if (deadline && deadline.deadline < t + seconds - 1e-9) {
      move(cardId, motion, Math.max(0, deadline.deadline - t));
      note(`${what}: stopped by the endgame guard`, "warn", cardId);
      return { abortTo: deadline };
    }
    move(cardId, motion, seconds);
    return null;
  };

  const runRoutine = (card: RoutineCard, guards: Guard[]): Signal => {
    const routine = auto.routines[card.routine];
    const placement = placementAt(auto.points, card.at, card.facingDeg, card.mirror);
    const exit = auto.points[card.exit];
    const title = cardTitle(card);
    if (!routine || !placement || routine.steps.length === 0) {
      note(`${title}: routine or point missing; skipped`, "warn", card.id);
      return null;
    }
    const origin = { x: placement.x, y: placement.y };
    pos = origin;
    heading = card.facingDeg;
    const motion = motionAlong(segmentSamples(placeRoutine(routine, placement), origin), settings, card.facingDeg);
    const t0 = t;
    const timeout = t0 + routine.timeoutMs / 1000;
    const done = t0 + motion.seconds;
    // Answered true, the end condition is met by the time the pattern is done;
    // answered false, the routine ends at its timeout or the pattern's end.
    const condition =
      routine.endsWhen && answerOf(scenario, card.id, routine.endsWhen) ? done : Infinity;
    const end = Math.min(condition, timeout, done);
    note(
      `Routine ${title}${routine.while.length ? ` · while ${routine.while.join(", ")}` : ""}`,
      "card",
      card.id,
    );
    const signal = guardedMove(card.id, motion, end - t0, guards, title);
    if (signal) return signal;
    note(
      end === condition
        ? `${title}: ${routine.endsWhen} true, done after ${(end - t0).toFixed(2)} s`
        : end === timeout
          ? `${title}: timed out at ${routine.timeoutMs} ms`
          : `${title}: pattern done (${(end - t0).toFixed(2)} s), ${routine.endsWhen || "no condition"} not true`,
      end === condition ? "row" : "warn",
      card.id,
    );
    if (!exit) return null;
    note(
      `Exit to ${card.exit}${routine.exit.length ? ` · ${routine.exit.join(", ")}` : ""}`,
      "card",
      card.id,
    );
    return guardedMove(card.id, straightMotion(pos, { x: exit[0], y: exit[1] }, settings), Infinity, guards, `${title} exit`);
  };

  const runGoTo = (card: GoToCard, guards: Guard[]): Signal => {
    const target = auto.points[card.point];
    const title = cardTitle(card);
    if (!target) {
      note(`${title}: point missing; skipped`, "warn", card.id);
      return null;
    }
    const distance = Math.hypot(target[0] - pos.x, target[1] - pos.y);
    if (distance <= card.maxDistanceIn) {
      note(`${title} (${distance.toFixed(1)} in)`, "card", card.id);
      const motion = motionAlong([pos, { x: target[0], y: target[1] }], settings, target[2] ?? heading);
      return guardedMove(card.id, motion, Infinity, guards, title);
    }
    taken.set(card.id, 0);
    note(`${title}: refused, ${distance.toFixed(1)} in is over ${card.maxDistanceIn} in`, "row", card.id);
    return runList(card.ifRefused, guards, `${title}: if refused`);
  };

  const moves = (card: AutoCard): boolean =>
    card.kind === "path" || card.kind === "routine" || card.kind === "goTo";

  const runTogether = (card: TogetherCard, guards: Guard[]): Signal => {
    const title = cardTitle(card);
    note(`${title} (${card.ends === "ALL" ? "until all are done" : "until the first is done"})`, "card", card.id);
    if (card.cards.length === 0) return null;
    // The robot follows one card; the others' time counts but not their motion.
    const lead = Math.max(0, card.cards.findIndex(moves));
    const t0 = t;
    const start = { pos: { ...pos }, heading };
    const ends: number[] = [];
    card.cards.forEach((child, index) => {
      if (index === lead) return;
      const mark = { timeline: timeline.length, motions: motions.length, drives: drives.length };
      t = t0;
      pos = { ...start.pos };
      heading = start.heading;
      runCard(child, []);
      ends.push(t);
      timeline.length = mark.timeline;
      motions.length = mark.motions;
      drives.length = mark.drives;
    });
    t = t0;
    pos = { ...start.pos };
    heading = start.heading;
    const signal = runCard(card.cards[lead], guards);
    if (signal) return signal;
    const leadEnd = t;
    const end = card.ends === "ALL" ? Math.max(leadEnd, ...ends) : Math.min(leadEnd, ...ends);
    if (end > leadEnd) stay(end - leadEnd);
    else if (end < leadEnd - 1e-9) {
      cutAt(end);
      // What would have happened after the first card finished did not.
      for (let i = log.length - 1; i >= 0; i--) if (log[i].t > end + 1e-9) log.splice(i, 1);
    }
    note(`${title}: done after ${(end - t0).toFixed(2)} s`, "row", card.id);
    return null;
  };

  /** Stop the robot at `end`: drop what happens after it and put the robot there. */
  const cutAt = (end: number) => {
    const at = poseAt(end);
    while (timeline.length && timeline[timeline.length - 1].startTime >= end - 1e-9) timeline.pop();
    const last = timeline[timeline.length - 1];
    if (last && last.endTime > end) {
      last.endTime = end;
      last.duration = end - last.startTime;
    }
    for (const record of motions) if (record.t1 > end) record.t1 = end;
    for (const record of drives) if (record.t1 > end) record.t1 = end;
    t = end;
    pos = { x: at.x, y: at.y };
    heading = at.headingDeg;
  };

  /** Where the preview has put the robot at `time` so far. */
  const poseAt = (time: number): { x: number; y: number; headingDeg: number } => {
    for (const record of motions) {
      if (time >= record.t0 && time <= record.t1) {
        return poseAlong(record.motion, record.motion.distanceAt(time - record.t0));
      }
    }
    for (const record of drives) {
      if (time >= record.t0 && time <= record.t1) {
        const path = catalog.byId.get(record.pathId)!;
        const along = path.distanceAt(time - record.t0);
        return { ...pointAlong(path, path.length > 0 ? along / path.length : 1), headingDeg: heading };
      }
    }
    return { x: pos.x, y: pos.y, headingDeg: heading };
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

/** The robot's pose during a preview motion (routine, exit, goTo), else null. */
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

function waitLimit(card: FirstOfCard, t0: number, alongS = 0): number {
  let limit = Infinity;
  for (const row of card.rows) {
    switch (rowKind(row)) {
      case "finished":
        if (card.alongside) limit = Math.min(limit, t0 + alongS);
        break;
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

  const straightSeconds = (distance: number) =>
    straightMotion({ x: 0, y: 0 }, { x: distance, y: 0 }, catalog.settings).seconds;

  /** Upper bound on a routine's time: pattern or timeout, then the longest exit. */
  const routineSeconds = (card: RoutineCard): number => {
    const routine = auto.routines[card.routine];
    const placement = placementAt(auto.points, card.at, card.facingDeg, card.mirror);
    if (!routine || !placement) return 0;
    const origin = { x: placement.x, y: placement.y };
    const samples = segmentSamples(placeRoutine(routine, placement), origin);
    const pattern = motionAlong(samples, catalog.settings, card.facingDeg).seconds;
    const exit = auto.points[card.exit];
    const longestExit = exit
      ? Math.max(...samples.map((s) => Math.hypot(exit[0] - s.x, exit[1] - s.y)))
      : 0;
    return Math.min(pattern, routine.timeoutMs / 1000) + straightSeconds(longestExit);
  };

  const endOf = (list: AutoCard[], start: number, index: number, rest: (t: number) => number): number => {
    let t = start;
    for (let i = index; i < list.length; i++) {
      const card = list[i];
      if (card.kind === "action") t += commandSeconds(auto, card);
      else if (card.kind === "path") t += catalog.byId.get(card.lineId)?.seconds ?? 0;
      else if (card.kind === "routine") t += routineSeconds(card);
      else if (card.kind === "together") {
        const lengths = card.cards.map((child) => endOf([child], t, 0, (x) => x) - t);
        if (lengths.length) t += card.ends === "ALL" ? Math.max(...lengths) : Math.min(...lengths);
      } else if (card.kind === "goTo") {
        const after = (end: number) => endOf(list, end, i + 1, rest);
        const drove = after(t + straightSeconds(card.maxDistanceIn));
        const refused = endOf(card.ifRefused, t, 0, after);
        record(card.id, 0, 1, refused);
        return Math.max(drove, refused);
      } else {
        const alongS = alongsideSeconds(auto, card);
        const limit = waitLimit(card, t, alongS);
        if (!Number.isFinite(limit)) return Infinity;
        const after = (end: number) => endOf(list, end, i + 1, rest);
        let worst = -Infinity;
        card.rows.forEach((row, rowIndex) => {
          const kind = rowKind(row);
          const time = kind === "afterMs" || kind === "timeLeftBelowS" || kind === "otherwise" || kind === "finished"
            ? waitLimit({ ...card, rows: [row] }, t, alongS)
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
