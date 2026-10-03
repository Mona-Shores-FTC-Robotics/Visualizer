import type { BasePoint, StartPose, TimelineEvent } from "../../types";
import { chainInfo, pointAlong, type PathCatalog, type PathInfo } from "./geometry";
import { allCards, cardTitle, describeRow, isPlainWait, parkCardOf, rejoinTail, rowLabel } from "./tree";
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
export function commandSeconds(auto: AutoSection, card: ActionCard, timing?: PreviewTiming): number {
  const typical =
    timing?.actionSeconds(card.name) ?? auto.registry.typicalS?.[card.name] ?? (card.previewMs ?? 0) / 1000;
  return Math.min(typical, card.timeoutS ?? DEFAULT_TIMEOUT_S);
}

/**
 * How long a wait's `alongside` command runs in the preview: its typical time, capped at the
 * default timeout (the robot runs it with `kit.command(name)`). 0 with none.
 */
export function alongsideSeconds(auto: AutoSection, card: FirstOfCard, timing?: PreviewTiming): number {
  if (!card.alongside) return 0;
  const typical = timing?.actionSeconds(card.alongside) ?? auto.registry.typicalS?.[card.alongside] ?? 0;
  return Math.min(typical, DEFAULT_TIMEOUT_S);
}

/**
 * Typical timing for the preview (see lib/timing): when each trigger answered ✓ actually becomes
 * true, and how long commands take. Without it a ✓ trigger is true the moment it is asked.
 */
export interface PreviewTiming {
  /** Seconds a command typically takes, or undefined to use the robot's list. */
  actionSeconds(name: string): number | undefined;
  /** The first time at or after `t0` that `condition` is true (Infinity: never), or undefined for "at once". */
  trueAt(condition: string, t0: number): number | undefined;
  /** Told when a command runs (from t0 to t1), so state such as a full intake can change. */
  commandRan?(name: string, t0: number, t1: number): void;
  /** Told when a wait ends because `condition` became true at `t`. */
  becameTrue?(condition: string, t: number): void;
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

/** A command run alongside a wait, from its start until it finished or the wait ended. */
export interface LaunchRecord {
  cardId: string;
  command: string;
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
  /** Commands run alongside a wait (a volley is LaunchAll), for the timing model's TIPs. */
  launches: LaunchRecord[];
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

/** How many rejoins one preview follows before calling it a loop. */
const MAX_REJOINS = 20;

/** Seconds the endgame guard reserves for a park path. */
export function guardSeconds(path: PathInfo): number {
  return path.seconds;
}

export function simulateAuto(
  auto: AutoSection,
  catalog: PathCatalog,
  startPoint: StartPose,
  scenario: Scenario,
  timing?: PreviewTiming,
): PreviewResult {
  const timeline: TimelineEvent[] = [];
  const log: LogEntry[] = [];
  const ran = new Set<string>();
  const taken = new Map<string, number>();
  const drives: DriveRecord[] = [];
  const motions: MotionRecord[] = [];
  const launches: LaunchRecord[] = [];
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
    const alongEnd = card.alongside ? t0 + alongsideSeconds(auto, card, timing) : Infinity;
    if ("when" in row) {
      let soonest = Infinity;
      for (const name of row.when) {
        if (!answerFor(scenario, card, name)) continue;
        const at = Math.max(timing?.trueAt(name, t0) ?? t0, card.alongside ? alongEnd : t0);
        soonest = Math.min(soonest, at);
      }
      return soonest;
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
      const along = alongsideSeconds(auto, card, timing);
      launches.push({ cardId: card.id, command: card.alongside, t0, t1: Math.min(at, t0 + along) });
      note(`${label}: ${card.alongside} alongside`, "card", card.id);
      if (at < t0 + along - 1e-9) note(`${card.alongside} stopped after ${(at - t0).toFixed(2)} s`, "event", card.id);
    }
    stay(at - t0);
    const row = card.rows[winner];
    taken.set(card.id, winner);
    if (card.alongside) timing?.commandRan?.(card.alongside, t0, at);
    if ("when" in row) {
      for (const name of row.when) {
        if (answerFor(scenario, card, name) && fireTime(card, { ...row, when: [name] }, t0) <= at + 1e-9) {
          timing?.becameTrue?.(name, at);
        }
      }
    }
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
        const busy = commandSeconds(auto, card, timing);
        if (deadline && deadline.deadline < t + busy) {
          stay(Math.max(0, deadline.deadline - t));
          return { abortTo: deadline };
        }
        stay(busy);
        timing?.commandRan?.(card.name, t - busy, t);
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
      case "rejoin": {
        const own: PathCard = { id: card.id, kind: "path", lineId: card.lineId, park: false };
        const tail = rejoinTail(auto.cards, card.target);
        // Joining a drive-through: drive on through the rest of its chain without stopping.
        const signal = tail?.through.length
          ? runChain([{ ...own, through: true }, ...tail.through], guards)
          : runCard(own, guards);
        if (signal) return signal;
        if (!tail) {
          note("Rejoin: its target stop is missing", "warn", card.id);
          return null;
        }
        if (++rejoins > MAX_REJOINS) {
          note("Rejoin: the routes loop; stopped", "warn", card.id);
          stalled = true;
          return null;
        }
        note(`Rejoin at ${pathName(tail.target.lineId)}`, "row", card.id);
        return runList(tail.list.slice(tail.index), guards, `Rejoined at ${pathName(tail.target.lineId)}`);
      }
    }
  };

  const pathName = (lineId: string) => catalog.byId.get(lineId)?.name ?? lineId;
  let rejoins = 0;

  /** Drive a chain of paths as one: the robot passes the ends between them without stopping. */
  const runChain = (cards: PathCard[], guards: Guard[]): Signal => {
    if (cards.some((card) => !catalog.byId.get(card.lineId))) {
      for (const card of cards) {
        const signal = runCard(card, guards);
        if (signal) return signal;
      }
      return null;
    }
    cards.forEach((card) => ran.add(card.id));
    const chain = chainInfo(catalog, cards.map((card) => card.lineId));
    const t0 = t;
    const deadline = pendingDeadline(guards);
    const cut = !!deadline && deadline.deadline < t0 + chain.seconds - 1e-9;
    const stop = cut && deadline ? Math.max(0, deadline.deadline - t0) : chain.seconds;
    for (const event of chain.travel) {
      if (event.startTime >= stop - 1e-9) break;
      const end = Math.min(event.endTime, stop);
      timeline.push({ ...event, startTime: event.startTime + t0, endTime: end + t0, duration: end - event.startTime });
    }
    for (const [i, card] of cards.entries()) {
      const path = catalog.byId.get(card.lineId)!;
      const at = chain.times.get(path.id) ?? { t0: 0, t1: 0 };
      if (at.t0 >= stop - 1e-9) break;
      note(`Drive ${path.name}${i < cards.length - 1 ? " · through" : ""}${card.park ? " · park" : ""}`, "card", card.id, t0 + at.t0);
      drives.push({ cardId: card.id, pathId: path.id, t0: t0 + at.t0, t1: t0 + Math.min(at.t1, stop) });
      if (at.t1 > stop + 1e-9) {
        const fraction = at.t1 > at.t0 ? (stop - at.t0) / (at.t1 - at.t0) : 1;
        pos = pointAlong(path, fraction);
      } else {
        pos = { ...path.end };
        heading = path.endHeadingDeg;
      }
    }
    t = t0 + stop;
    if (cut && deadline) {
      note("Drive-through: stopped by the endgame guard", "warn", cards[0].id);
      return { abortTo: deadline };
    }
    return null;
  };

  /** The drive-through chain starting at `list[index]`: that path and the ones it drives on into. */
  const chainFrom = (list: AutoCard[], index: number): PathCard[] => {
    const chain: PathCard[] = [];
    for (let i = index; i < list.length; i++) {
      const card = list[i];
      if (card.kind !== "path") break;
      chain.push(card);
      if (!card.through) break;
    }
    return chain;
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

    for (let i = 0; i < list.length; i++) {
      const card = list[i];
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
      const chain = card.kind === "path" && card.through ? chainFrom(list, i) : [];
      if (chain.length > 1) i += chain.length - 1;
      if (chain.length > 1 && own && chain.includes(parkCard!)) own.parked = true;
      const signal = chain.length > 1 ? runChain(chain, own?.parked ? outer : guards) : runCard(card, guards);
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
  return { timeline, log, endTime: t, ran, taken, drives, motions, launches, guard: guardFired, stalled };
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

  // Every duration here is a fixed number of seconds, so whatever follows a card
  // ends a fixed time after it starts: starting later only shifts it. Each
  // decision therefore works out the cards after it once, from the latest any of
  // its rows reaches them, instead of once per row and per combination of the
  // decisions before it (that is 2^n for n two-row waits in a row, and froze the
  // page for an Auto with twenty). `recording` is off for the pass that only
  // finds that latest time, so the table keeps each row's true worst end.
  const endOf = (
    list: AutoCard[],
    start: number,
    index: number,
    rest: (t: number) => number,
    rejoins: number,
    recording: boolean,
  ): number => {
    let t = start;
    for (let i = index; i < list.length; i++) {
      const card = list[i];
      if (card.kind === "action") t += commandSeconds(auto, card);
      else if (card.kind === "path") {
        // A drive-through chain is one drive.
        const ids = [card.lineId];
        let j = i;
        while (list[j]?.kind === "path" && (list[j] as { through?: boolean }).through && list[j + 1]?.kind === "path") {
          j++;
          ids.push((list[j] as { lineId: string }).lineId);
        }
        t += ids.length > 1 ? chainInfo(catalog, ids).seconds : catalog.byId.get(card.lineId)?.seconds ?? 0;
        i = j;
      } else if (card.kind === "rejoin") {
        const tail = rejoinTail(auto.cards, card.target);
        t += tail?.through.length
          ? chainInfo(catalog, [card.lineId, ...tail.through.map((c) => c.lineId)]).seconds
          : catalog.byId.get(card.lineId)?.seconds ?? 0;
        if (!tail || rejoins + 1 > MAX_REJOINS) return rest(t);
        return endOf(tail.list, t, tail.index, (x) => x, rejoins + 1, recording);
      } else {
        const limit = waitLimit(card, t);
        if (!Number.isFinite(limit)) return Infinity;
        // The trigger may fire as late as the limit; a time row later than the
        // earliest one never wins (null).
        const times = card.rows.map((row) => {
          const time = "afterMs" in row ? t + row.afterMs / 1000 : limit;
          return time > limit + 1e-9 ? null : time;
        });
        // The latest any row comes back to the cards after this one…
        let latest = -Infinity;
        times.forEach((time, k) => {
          if (time === null) return;
          const fallsThrough = (x: number) => {
            latest = Math.max(latest, x);
            return x;
          };
          endOf(card.rows[k].cards, time, 0, fallsThrough, rejoins, false);
        });
        // …so those cards are worked out once, from there.
        const afterwards = latest === -Infinity ? 0 : endOf(list, latest, i + 1, rest, rejoins, recording) - latest;
        let worst = -Infinity;
        times.forEach((time, k) => {
          if (time === null) {
            if (recording) record(card.id, k, card.rows.length, null);
            return;
          }
          const end = endOf(card.rows[k].cards, time, 0, (x) => x + afterwards, rejoins, recording);
          if (recording) record(card.id, k, card.rows.length, end);
          worst = Math.max(worst, end);
        });
        return worst;
      }
    }
    return rest(t);
  };

  const total = endOf(auto.cards, 0, 0, (t) => t, 0, true);
  return { total, rows };
}
