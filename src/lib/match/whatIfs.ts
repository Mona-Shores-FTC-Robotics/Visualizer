/**
 * Fork: what a robot's panel in the Match view lets you change about its Auto, beyond the sliders,
 * and how each is worded.
 *
 * A wait's trigger row asks one of three kinds of question, and only one kind is a what-if:
 * - **A route choice** (`FirstOfCard.choice`): the drive team picks a leg in INIT. The trigger is
 *   the option's name ("Pickup"), so ticking it never meant "it comes". It is a dropdown, worded as
 *   the Driver Station's INIT row: "Pickup: WALL_FLOWER".
 * - **The clock check** (`ALWAYS`, steps.ts): "If before 17.6 s". Its trigger is always true on the
 *   robot (biobuzz AutoRegistration: `trigger("Always", () -> true)`); only the clock decides, so it
 *   is no what-if and has no control.
 * - **Something the robot senses**: a CELL read up, the intake full. Each wait on one is a stop
 *   (`stops`) with its own row: "In time" (it comes before its limit) or "Too late" (its limit passes first
 *   and it takes its Otherwise). The planned outcome is always first and is the default.
 */
import type { AutoCard, AutoSection, FirstOfCard } from "../auto/types";
import { previewQuestions } from "../auto/simulate";
import { allCards } from "../auto/tree";
import { ALWAYS } from "../simple/steps";
import { aimedLeft } from "../timing/model";

/** A route choice on the INIT menu, as the Match view offers it. */
export interface RouteChoice {
  /** The INIT row's name, "Pickup". */
  option: string;
  /** The trigger its drawn leg waits on (the option's name), for the scenario. */
  condition: string;
  /** The two legs' names: the drawn one (the trigger row) first. */
  legs: [string, string];
}

/** Every route choice in the Auto, once each, in the order the Auto reaches them. */
export function routeChoices(auto: AutoSection): RouteChoice[] {
  const out: RouteChoice[] = [];
  for (const card of allCards(auto.cards)) {
    if (card.kind !== "firstOf" || !card.choice) continue;
    const legs = choiceLegs(card);
    if (!legs) continue;
    if (out.some((c) => c.condition === legs.condition)) continue;
    out.push({ option: card.choice, ...legs });
  }
  return out;
}

function choiceLegs(
  card: FirstOfCard,
): { condition: string; legs: [string, string] } | null {
  const drawn = card.rows.find((row) => "when" in row);
  const other = card.rows.find((row) => "afterMs" in row);
  if (!drawn || !other || !("when" in drawn) || !drawn.when[0]) return null;
  return {
    condition: drawn.when[0],
    legs: [drawn.label || "drawn", other.label || "other"],
  };
}

/**
 * The robot's triggers that are what-ifs: each condition a wait asks, once, but not a route
 * choice's option (a dropdown instead) and not the clock check's always-true trigger.
 */
export function senseTriggers(auto: AutoSection): string[] {
  const choices = new Set(routeChoices(auto).map((c) => c.condition));
  const seen: string[] = [];
  for (const q of previewQuestions(auto)) {
    if (q.condition === ALWAYS || choices.has(q.condition)) continue;
    if (!seen.includes(q.condition)) seen.push(q.condition);
  }
  return seen;
}

/**
 * What each trigger is true on, in the robot's terms (biobuzz AutoRegistration). A CELL counts only
 * once the camera has seen it settle up, never on the HIVE's assumed start or a TIP it expects: the
 * moment biobuzz TeamCode/autos/timing-terms.md calls "CELL read up", so the label says "read up".
 */
const TRIGGER: Record<string, { label: string; means: string }> = {
  CellUp: {
    label: "Aimed CELL read up",
    means:
      "the CELL at the robot's end of the field, the one it is aimed at, read up by the camera (at once if it already was)",
  },
  Tip: {
    label: "TIP read",
    means: "one of our CELLs read settled the other way since the wait began",
  },
  LeftCellUp: {
    label: "LEFT CELL read up",
    means:
      "the LEFT CELL, as our drive team sees it, read up by the camera (at once if it already was)",
  },
  RightCellUp: {
    label: "RIGHT CELL read up",
    means:
      "the RIGHT CELL, as our drive team sees it, read up by the camera (at once if it already was)",
  },
  IntakeFull: {
    label: "Intake full",
    means: "the colour sensor sees a piece held at the top of the intake",
  },
  Empty: { label: "Launcher empty", means: "the launcher has fired its load" },
  CameraBlind: {
    label: "Camera blind",
    means: "the camera has seen no CELL for a while",
  },
};

/** A trigger's checkbox label: "LEFT CELL read up". */
export function triggerLabel(condition: string): string {
  return TRIGGER[condition]?.label ?? condition;
}

/** A trigger's checkbox tooltip, for its state. */
export function triggerHint(condition: string, comes: boolean): string {
  const means = TRIGGER[condition]?.means;
  const what = means
    ? `${triggerLabel(condition)}: ${means}`
    : triggerLabel(condition);
  return comes
    ? `${what}. In time: it comes when the timing says, and the robot goes on as drawn`
    : `${what}. Too late: it never comes, so the wait runs to its limit and takes its Otherwise`;
}

/** A route choice's dropdown entry, as the Driver Station's INIT row reads: "Pickup: WALL_FLOWER". */
export function choiceLabel(choice: RouteChoice, leg: 0 | 1): string {
  return `${choice.option}: ${choice.legs[leg]}`;
}

/**
 * A stop: one wait in the Auto that asks something the robot senses, by a time limit. The Match
 * view gives each its own row, the planned outcome first: "In time" (the trigger comes before
 * its limit: the steps the drawing follows) or "Too late" (the limit passes first: the Otherwise).
 */
export interface Stop {
  cardId: string;
  /** The wait's name in the Auto (its `.pp` label), else one made from its trigger. */
  name: string;
  condition: string;
  /** What it waits for and until when: "LEFT CELL read up · until 15.5 s". */
  asks: string;
  /** What the robot does when the trigger comes in time: "shoot LEFT, if before 17.6 s, …". */
  planned: string;
  /** What it does when the limit passes first: "park". */
  late: string;
  /**
   * True when the wait has steps of its own on a row, so it can be answered alone. A plain wait
   * (no steps on either row) shares the answer of every wait on its trigger.
   */
  own: boolean;
}

/** Where the robot is: a spot's name when known, and its y (drawn frame) for which CELL it faces. */
interface Here {
  name: string | null;
  y: number | null;
}

/** The paths, for where each ends: a project's `lines` (an end's name, else the path's own). */
export type PathEnds = readonly {
  id: string;
  name?: string;
  endPoint?: { x: number; y: number };
}[];

/** Every stop in the Auto, in the order the Auto reaches them. */
export function stops(auto: AutoSection, lines: PathEnds = []): Stop[] {
  const out: Stop[] = [];
  const byId = new Map(lines.map((line) => [line.id, line]));
  /** Where a drive ends: its named end, else the spot its name says ("… to LEFT_CLOSE_HIVE"). */
  const endOf = (lineId: string, here: Here): Here => {
    const line = byId.get(lineId);
    const named =
      auto.pathEnds[lineId] ??
      line?.name?.match(/ to ([A-Z][A-Z0-9_]*)$/)?.[1] ??
      null;
    const point = named ? auto.points[named] : undefined;
    return {
      name: named ?? null,
      y: point?.[1] ?? line?.endPoint?.y ?? here.y,
    };
  };
  const visit = (cards: AutoCard[], here: Here): Here => {
    for (const card of cards) {
      if (card.kind === "path") {
        here = endOf(card.lineId, here);
        continue;
      }
      if (card.kind !== "firstOf") continue;
      const stop = stopOf(card, here, endOf);
      if (stop) out.push(stop);
      // Each row starts where the wait is; the cards after it go on from the trigger row's end.
      let after = here;
      for (const row of card.rows) {
        const end = visit(row.cards, here);
        if ("when" in row) after = end;
      }
      here = after;
    }
    return here;
  };
  const start = auto.startAt ? auto.points[auto.startAt] : undefined;
  visit(auto.cards, { name: auto.startAt ?? null, y: start?.[1] ?? null });
  return out;
}

type EndOf = (lineId: string, here: Here) => Here;

function stopOf(card: FirstOfCard, here: Here, endOf: EndOf): Stop | null {
  if (card.choice) return null;
  const when = card.rows.find((row) => "when" in row);
  const time = card.rows.find((row) => "afterMs" in row);
  if (!when || !time || !("when" in when) || !("afterMs" in time)) return null;
  const condition = when.when[0];
  if (!condition || condition === ALWAYS) return null;
  const seconds = Number((time.afterMs / 1000).toFixed(2));
  const limit = time.matchClock
    ? `until ${seconds} s${time.adjustable ? " (set in INIT)" : ""}`
    : `within ${seconds} s`;
  // CellUp is the CELL the robot faces: name it when the spot is known.
  const what =
    condition === "CellUp" && here.y !== null
      ? `${aimedLeft(here.y) ? "LEFT" : "RIGHT"} CELL read up`
      : triggerLabel(condition);
  return {
    cardId: card.id,
    name: card.label?.trim() || `Wait for ${what}`,
    condition,
    asks: `${what} · ${limit}`,
    planned: steps(when.cards, here, endOf),
    late: steps(time.cards, here, endOf),
    own: card.rows.some((row) => row.cards.length > 0),
  };
}

/** A row's steps in a few words: "shoot LEFT, pick a FLOWER, …"; "go on" with none. */
function steps(cards: AutoCard[], start: Here, endOf: EndOf): string {
  const words: string[] = [];
  let here = start;
  for (const card of cards) {
    if (card.kind === "path") {
      here = endOf(card.lineId, here);
      words.push(
        card.park ? "park" : `drive to ${here.name ?? "the next spot"}`,
      );
      continue;
    }
    const word = stepWord(card, here);
    if (word) words.push(word);
  }
  if (!words.length) return "go on";
  const shown = words.slice(0, 3);
  return `${shown.join(", ")}${words.length > shown.length ? ", …" : ""}`;
}

function stepWord(card: AutoCard, here: Here): string | null {
  switch (card.kind) {
    case "path":
      return null;
    case "rejoin":
      return "rejoin";
    case "action": {
      const cell =
        here.y === null ? null : aimedLeft(here.y) ? "LEFT" : "RIGHT";
      if (card.name === "LaunchAll") return cell ? `shoot ${cell}` : "shoot";
      if (card.name === "LaunchOne")
        return cell ? `shoot one at ${cell}` : "shoot one";
      if (card.name === "PickFlower") return "pick a FLOWER";
      if (card.name === "GardenGather") return "GARDEN gather";
      if (card.name === "SpinUp") return null;
      return card.name;
    }
    case "firstOf": {
      if (card.choice) return `INIT ${card.choice}`;
      const when = card.rows.find((row) => "when" in row);
      const time = card.rows.find((row) => "afterMs" in row);
      const s =
        time && "afterMs" in time
          ? Number((time.afterMs / 1000).toFixed(2))
          : null;
      const trigger = when && "when" in when ? when.when[0] : undefined;
      if (trigger === ALWAYS && s !== null) return `if before ${s} s`;
      if (!trigger && s !== null && time && "afterMs" in time)
        return time.matchClock ? `hold until ${s} s` : `wait ${s} s`;
      return `wait for ${trigger ? triggerLabel(trigger) : "a trigger"}`;
    }
  }
}
