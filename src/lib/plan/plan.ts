/**
 * The Auto as a plan: the good path (the route when every tip comes), cut into chapters at the
 * waits for a tip, and for each wait that branches, what the robot does when the tip doesn't
 * come (its miss).
 *
 * A view over today's `auto` section, read from its cards: nothing here is saved. Edits go back
 * to the cards (see `setLimit`).
 */
import type { PathCatalog } from "../auto/geometry";
import type { AutoCard, AutoSection, FirstOfCard } from "../auto/types";
import { isPlainWait } from "../auto/tree";
import { switchKey, type PreviewResult, type Scenario } from "../auto/simulate";
import { TIP_CONDITIONS } from "../timing/model";
import type { LadderInfo } from "../ladder/compile";

export { TIP_CONDITIONS };

/** What can end a wait early, as the robot senses it. Anything else is a timer. */
export type Sense = "tip" | "full" | "empty" | "other";

export type StepKind =
  "drive" | "park" | "shoot" | "collect" | "wait" | "command" | "rejoin";

export interface PlanStep {
  /** The card this step shows. */
  cardId: string;
  kind: StepKind;
  label: string;
  /** Drive: the top-level path it drives. */
  lineId?: string;
  /** Wait: what ends it early, the condition's name, and its time limit in seconds. */
  sense?: Sense;
  condition?: string;
  limitS?: number;
  /** Set on the wait that ends a chapter: "TIP 1". */
  tip?: string;
  /** Set on a wait that branches: what happens when the condition never comes. */
  miss?: PlanStep[];
  /**
   * Set on a wait that branches when its miss carries on with the plan after it: the step it goes
   * back to. Unset when the miss ends in a park or a rejoin, or nothing follows.
   */
  then?: PlanStep;
}

export interface Chapter {
  name: string;
  steps: PlanStep[];
}

export interface Plan {
  steps: PlanStep[];
  chapters: Chapter[];
  /** The waits that branch, in the order the good path meets them. */
  branches: PlanStep[];
}

/**
 * Conditions the robot code registers but cannot sense yet (biobuzz `AutoRegistration.PLACEHOLDERS`):
 * a wait on one always runs to its time limit on the robot.
 */
export const NOT_SENSED_YET = ["IntakeFull", "LeftCellUp", "RightCellUp"];

export function senseOf(condition: string | undefined): Sense {
  if (!condition) return "other";
  if (TIP_CONDITIONS.includes(condition)) return "tip";
  if (condition === "IntakeFull") return "full";
  if (condition === "Empty") return "empty";
  return "other";
}

function waitStep(card: FirstOfCard): PlanStep {
  const when = card.rows.find((row) => "when" in row) as
    { when: string[] } | undefined;
  const time = card.rows.find((row) => "afterMs" in row) as
    { afterMs: number } | undefined;
  const condition = when?.when[0];
  const sense = senseOf(condition);
  const kind: StepKind =
    card.alongside === "LaunchAll"
      ? "shoot"
      : sense === "full"
        ? "collect"
        : "wait";
  return {
    cardId: card.id,
    kind,
    label:
      card.label ||
      (kind === "shoot" ? "Shoot" : kind === "collect" ? "Collect" : "Wait"),
    sense,
    condition,
    limitS: time ? time.afterMs / 1000 : undefined,
  };
}

function stepsOf(cards: AutoCard[], names: Map<string, string>): PlanStep[] {
  const out: PlanStep[] = [];
  /** Branches whose miss carries on with whatever comes after them in this list. */
  let fallingThrough: PlanStep[] = [];
  for (const card of cards) {
    const at = out.length;
    let branch: PlanStep | null = null;
    switch (card.kind) {
      case "path":
        out.push({
          cardId: card.id,
          kind: card.park ? "park" : "drive",
          label: names.get(card.lineId) ?? "Drive",
          lineId: card.lineId,
        });
        break;
      case "action":
        out.push({
          cardId: card.id,
          kind: "command",
          label: card.name || "Command",
        });
        break;
      case "rejoin":
        out.push({
          cardId: card.id,
          kind: "rejoin",
          label: `Back to the plan via ${names.get(card.lineId) ?? "a path"}`,
          lineId: card.lineId,
        });
        break;
      case "firstOf": {
        const step = waitStep(card);
        if (isPlainWait(card)) {
          out.push(step);
          break;
        }
        // A branch: the good path goes on with the row that fires when the condition comes; the
        // time-limit row is the miss.
        const good = card.rows.find((row) => "when" in row);
        const timeout = card.rows.find((row) => "afterMs" in row);
        branch = { ...step, miss: stepsOf(timeout?.cards ?? [], names) };
        out.push(branch);
        out.push(...stepsOf(good?.cards ?? [], names));
        break;
      }
    }
    // The miss of a branch before this card goes back to the plan here, at this card.
    if (out.length > at && fallingThrough.length) {
      for (const waiting of fallingThrough) waiting.then = out[at];
      fallingThrough = [];
    }
    const last = branch?.miss?.at(-1);
    if (branch && last?.kind !== "park" && last?.kind !== "rejoin")
      fallingThrough.push(branch);
  }
  return out;
}

const TIP_IN_LABEL = /TIP\s*(\d+)/i;
/** A label that names the attempt itself: "TIP 1", "Shoot (TIP 2)", not "Catch TIP 1's spill". */
const TIP_NAMED = /^TIP\s*(\d+)\b|\(TIP\s*(\d+)\)/i;

/**
 * Where each chapter ends: one chapter per TIP, ending at the wait that senses that tip, or at
 * the shot named for it when nothing senses it. A wait that senses a tip but names none is a
 * TIP of its own.
 */
function chapterEnds(steps: PlanStep[]): Map<PlanStep, string> {
  const named = new Map<number, PlanStep>();
  const sensing = new Map<number, PlanStep>();
  const unnamed: PlanStep[] = [];
  for (const step of steps) {
    if (step.limitS === undefined) continue;
    const n = Number(TIP_NAMED.exec(step.label)?.slice(1).find(Boolean) ?? NaN);
    if (step.sense === "tip") {
      const mentioned = Number(TIP_IN_LABEL.exec(step.label)?.[1] ?? NaN);
      const num = Number.isFinite(n) ? n : mentioned;
      if (Number.isFinite(num)) sensing.set(num, step);
      else unnamed.push(step);
    } else if (Number.isFinite(n)) {
      named.set(n, step);
    }
  }
  const ends = new Map<PlanStep, string>();
  for (const [n, step] of named)
    if (!sensing.has(n)) ends.set(step, `TIP ${n}`);
  for (const [n, step] of sensing) ends.set(step, `TIP ${n}`);
  let next = Math.max(0, ...named.keys(), ...sensing.keys());
  for (const step of unnamed) ends.set(step, `TIP ${++next}`);
  return ends;
}

/** Reads the plan out of an Auto. `names` are the paths' display names (`catalog.names`). */
export function planOf(auto: AutoSection, names: Map<string, string>): Plan {
  const steps = stepsOf(auto.cards, names);
  const ends = chapterEnds(steps);
  const chapters: Chapter[] = [];
  let current: PlanStep[] = [];
  for (const step of steps) {
    current.push(step);
    const tip = ends.get(step);
    if (tip) {
      step.tip = tip;
      chapters.push({ name: tip, steps: current });
      current = [];
    }
  }
  if (current.length) chapters.push({ name: "Park", steps: current });
  return { steps, chapters, branches: steps.filter((step) => step.miss) };
}

/** The scenario that previews the good path: every wait's condition comes. */
export const GOOD_PATH: Scenario = {};

/** The scenario that previews `branch`'s miss: its condition never comes; every other one does. */
export function missScenario(branch: PlanStep): Scenario {
  return { [switchKey(branch.cardId)]: false };
}

/**
 * The scenario for one outcome of a ladder: the wait's tip doesn't come, the tries before kept
 * try `k` miss and try `k` works. `k` past the last try: every try misses and the robot parks.
 */
export function ladderScenario(
  waitId: string,
  ladder: LadderInfo | null,
  k: number,
): Scenario {
  const scenario: Scenario = { [switchKey(waitId)]: false };
  const kept = ladder?.tries.filter((t) => t.status === "kept") ?? [];
  kept.slice(0, k).forEach((t) => (scenario[switchKey(t.waitId!)] = false));
  return scenario;
}

/** The outcomes of a ladder, in order: each kept try working, then all of them missing. */
export function ladderOutcomes(
  ladder: LadderInfo,
): { k: number; label: string }[] {
  const kept = ladder.tries.filter((t) => t.status === "kept");
  return [
    ...kept.map((t, k) => ({ k, label: `Try ${t.index + 1} works` })),
    { k: kept.length, label: kept.length ? "Every try misses: park" : "Park" },
  ];
}

/**
 * When each card started and ended in a preview, from its log. A drive or a command logs its
 * start ("card"); a wait logs when it ends ("row"), so it started when the step before it ended.
 */
export function cardTimes(
  preview: PreviewResult,
): Map<string, { t0: number; t1: number }> {
  const times = new Map<string, { t0: number; t1: number }>();
  /** Cards in the order they ran; waits that only logged their end are marked. */
  const order: { id: string; endOnly: boolean }[] = [];
  for (const entry of preview.log) {
    if (!entry.cardId) continue;
    const known = times.get(entry.cardId);
    if (entry.kind === "card" && !known) {
      times.set(entry.cardId, { t0: entry.t, t1: entry.t });
      order.push({ id: entry.cardId, endOnly: false });
    } else if (entry.kind === "row") {
      if (known) known.t1 = Math.max(known.t1, entry.t);
      else {
        times.set(entry.cardId, { t0: entry.t, t1: entry.t });
        order.push({ id: entry.cardId, endOnly: true });
      }
    }
  }
  for (const drive of preview.drives)
    times.set(drive.cardId, { t0: drive.t0, t1: drive.t1 });
  // A command runs until the next step starts; a wait that only logged its end started when the
  // step before it ended.
  order.forEach(({ id, endOnly }, i) => {
    const own = times.get(id)!;
    const before = i > 0 ? times.get(order[i - 1].id)! : null;
    if (endOnly) own.t0 = Math.min(own.t1, before ? before.t1 : 0);
    const after = order[i + 1] ? times.get(order[i + 1].id)! : null;
    if (
      !endOnly &&
      own.t1 <= own.t0 &&
      !preview.drives.some((d) => d.cardId === id)
    ) {
      own.t1 = after && !order[i + 1].endOnly ? after.t0 : own.t0;
    }
  });
  return times;
}

/** Seconds a chapter takes in a preview (0 when none of it ran). */
export function chapterSeconds(
  chapter: Chapter,
  times: ReadonlyMap<string, { t0: number; t1: number }>,
): number {
  const ran = chapter.steps
    .map((step) => times.get(step.cardId))
    .filter((x): x is { t0: number; t1: number } => !!x);
  return ran.length
    ? Math.max(...ran.map((x) => x.t1)) - Math.min(...ran.map((x) => x.t0))
    : 0;
}

/** A plan step's path, for drawing: the catalog entry it drives, if any. */
export function pathOf(step: PlanStep, catalog: PathCatalog) {
  return step.lineId ? (catalog.byId.get(step.lineId) ?? null) : null;
}

/** Sets a wait's time limit (seconds) on its card: the edit behind the − / + buttons. */
export function setLimit(
  auto: AutoSection,
  cardId: string,
  seconds: number,
): void {
  const walk = (cards: AutoCard[]): boolean => {
    for (const card of cards) {
      if (card.kind === "firstOf") {
        if (card.id === cardId) {
          for (const row of card.rows)
            if ("afterMs" in row) row.afterMs = Math.round(seconds * 1000);
          return true;
        }
        if (card.rows.some((row) => walk(row.cards))) return true;
      }
    }
    return false;
  };
  walk(auto.cards);
}
