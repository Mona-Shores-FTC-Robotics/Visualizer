import type { StartPose } from "../../types";
import type { PathCatalog } from "./geometry";
import { AUTO_LENGTH_S, simulateAuto, switchKey, type Scenario } from "./simulate";
import { isPlainWait, rowLabel } from "./tree";
import type { AutoCard, AutoSection, FirstOfCard } from "./types";

/**
 * Routes: every way through the Auto. Each wait that branches splits the Auto in two (its trigger
 * fired, ✓, or its time limit passed); a route is one choice at each branching wait it reaches.
 * Plain waits (IntakeFull at a FLOWER) do not split it: they only change its time, so a route is
 * timed twice, with every plain wait ✓ and with every plain wait ✗.
 */

export interface RouteChoice {
  cardId: string;
  /** The row taken: 0 is the trigger, 1 the time limit (in file order). */
  rowIndex: number;
  /** True when the row taken is the trigger row. */
  fired: boolean;
  /** The row's branch name. */
  label: string;
}

export interface Route {
  choices: RouteChoice[];
  /** "✓", "✗ → ✓", …: the choices in order, ✓ fired and ✗ timed out. */
  marks: string;
  /** The branch names in order: "If tipped → No tip back". */
  label: string;
}

/** Every route through the Auto, in the order the list shows them (✓ before ✗ at each wait). */
export function enumerateRoutes(auto: AutoSection): Route[] {
  const suffixes = (list: AutoCard[], from: number): RouteChoice[][] => {
    for (let i = from; i < list.length; i++) {
      const card = list[i];
      if (card.kind !== "firstOf" || isPlainWait(card)) continue;
      const out: RouteChoice[][] = [];
      const order = rowOrder(card);
      for (const rowIndex of order) {
        const row = card.rows[rowIndex];
        const choice: RouteChoice = { cardId: card.id, rowIndex, fired: "when" in row, label: rowLabel(row) };
        for (const inside of suffixes(row.cards, 0)) {
          for (const after of suffixes(list, i + 1)) out.push([choice, ...inside, ...after]);
        }
      }
      return out;
    }
    return [[]];
  };
  return suffixes(auto.cards, 0).map((choices) => ({
    choices,
    marks: choices.map((c) => (c.fired ? "✓" : "✗")).join(" → "),
    label: choices.map((c) => c.label).join(" → "),
  }));
}

/** The trigger row first, then the time row, whatever the file's order. */
function rowOrder(card: FirstOfCard): number[] {
  const indices = card.rows.map((_, i) => i);
  return indices.sort((a, b) => Number("afterMs" in card.rows[a]) - Number("afterMs" in card.rows[b]));
}

/** The preview answers that drive `route`, with every plain wait answered `plain`. */
export function routeScenario(auto: AutoSection, route: Route, plain: boolean): Scenario {
  const scenario: Scenario = {};
  for (const name of auto.registry.conditions) scenario[name] = plain;
  for (const choice of route.choices) scenario[switchKey(choice.cardId)] = choice.fired;
  return scenario;
}

/** Whether the switches in `scenario` pick `route`. */
export function scenarioPicks(scenario: Scenario, route: Route): boolean {
  return route.choices.every((choice) => (scenario[switchKey(choice.cardId)] ?? true) === choice.fired);
}

export interface RouteTime {
  /** When the Auto ends on this route, in seconds. */
  endTime: number;
  /** True when the endgame guard parked the robot early. */
  parked: boolean;
  /** True when the route ends after the 30 s Auto. */
  over: boolean;
}

export interface RouteOutcome {
  route: Route;
  /** Every plain wait ✓ (fires at once). */
  yes: RouteTime;
  /** Every plain wait ✗ (runs to its limit). */
  no: RouteTime;
}

/** Every route, timed with plain waits ✓ and ✗. */
export function routeOutcomes(
  auto: AutoSection,
  catalog: PathCatalog,
  startPoint: StartPose,
): RouteOutcome[] {
  const time = (scenario: Scenario): RouteTime => {
    const result = simulateAuto(auto, catalog, startPoint, scenario);
    return {
      endTime: result.endTime,
      parked: result.guard !== null,
      over: result.endTime > AUTO_LENGTH_S + 1e-9,
    };
  };
  return enumerateRoutes(auto).map((route) => ({
    route,
    yes: time(routeScenario(auto, route, true)),
    no: time(routeScenario(auto, route, false)),
  }));
}
