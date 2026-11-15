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
 * - **Something the robot senses**: a CELL read up, the intake full. A checkbox: ticked, it comes
 *   when the timing says; unticked, it never comes and each wait on it runs to its limit.
 */
import type { AutoSection, FirstOfCard } from "../auto/types";
import { previewQuestions } from "../auto/simulate";
import { allCards } from "../auto/tree";
import { ALWAYS } from "../simple/steps";

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
  const what = means ? `${triggerLabel(condition)}: ${means}. ` : "";
  return comes
    ? `${what}Ticked: it comes when the timing says. Untick: it never comes, and each wait on it runs to its limit and takes its Otherwise`
    : `${what}Never comes: each wait on it runs to its limit and takes its Otherwise`;
}

/** A route choice's dropdown entry, as the Driver Station's INIT row reads: "Pickup: WALL_FLOWER". */
export function choiceLabel(choice: RouteChoice, leg: 0 | 1): string {
  return `${choice.option}: ${choice.legs[leg]}`;
}
