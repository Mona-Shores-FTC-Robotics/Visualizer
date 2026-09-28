import type { BasePoint } from "../../types";
import type { PathCatalog } from "./geometry";
import { childLists, cloneCard, locateCard, makeCardId } from "./tree";
import {
  type AutoCard,
  type AutoRow,
  type AutoSection,
  type FirstOfCard,
  type RowKind,
} from "./types";

/**
 * Structural edits on a draft Auto (see `updateAuto`). Each returns the id to
 * select afterwards, or null to keep the selection.
 */

export type NewCardKind =
  | "action"
  | "wait"
  | "decision"
  | "path"
  | "routine"
  | "goTo"
  | "together";

/** Where a new card goes: after the selected card, into a selected branch, or at the end. */
function insertionPoint(
  auto: AutoSection,
  cardId: string | null,
  rowIndex: number | null,
): { list: AutoCard[]; index: number } {
  if (cardId) {
    const location = locateCard(auto.cards, cardId);
    if (location) {
      const card = location.list[location.index];
      const list = rowIndex !== null ? childLists(card)[rowIndex] : undefined;
      if (list) return { list, index: list.length };
      return { list: location.list, index: location.index + 1 };
    }
  }
  return { list: auto.cards, index: auto.cards.length };
}

/** Where the robot is before `index` of `list`: the last path it drove there. */
function robotBefore(
  auto: AutoSection,
  list: AutoCard[],
  index: number,
  catalog: PathCatalog,
): BasePoint | null {
  for (let i = index - 1; i >= 0; i--) {
    const card = list[i];
    if (card.kind === "path") return catalog.byId.get(card.lineId)?.end ?? null;
  }
  // Nothing earlier in this list: look before the decision that owns it.
  const owner = findOwner(auto.cards, list);
  return owner ? robotBefore(auto, owner.list, owner.index, catalog) : null;
}

function findOwner(
  cards: AutoCard[],
  list: AutoCard[],
): { list: AutoCard[]; index: number } | null {
  for (let i = 0; i < cards.length; i++) {
    for (const child of childLists(cards[i])) {
      if (child === list) return { list: cards, index: i };
      const deeper = findOwner(child, list);
      if (deeper) return deeper;
    }
  }
  return null;
}

function nearestPoint(auto: AutoSection, from: BasePoint | null): string | null {
  if (!from) return null;
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const [name, point] of Object.entries(auto.points)) {
    const distance = Math.hypot(point[0] - from.x, point[1] - from.y);
    if (distance < bestDistance) {
      best = name;
      bestDistance = distance;
    }
  }
  return best;
}

export function newCard(
  kind: NewCardKind,
  auto: AutoSection,
  catalog: PathCatalog,
  at: { list: AutoCard[]; index: number },
): AutoCard {
  const firstCondition = auto.registry.conditions[0];
  switch (kind) {
    case "action":
      return { id: makeCardId(), kind: "action", name: auto.registry.actions[0] ?? "" };
    case "wait":
      return {
        id: makeCardId(),
        kind: "firstOf",
        label: firstCondition ? `Wait for ${firstCondition}` : "Wait",
        rows: [
          ...(firstCondition ? [{ when: [firstCondition], cards: [] }] : []),
          { afterMs: 1000, cards: [] },
        ],
      };
    case "decision":
      return {
        id: makeCardId(),
        kind: "firstOf",
        label: firstCondition ? `${firstCondition}?` : "Decision",
        rows: [
          ...(firstCondition
            ? [{ when: [firstCondition], label: `If ${firstCondition}`, cards: [] }]
            : [{ afterMs: 500, cards: [] }]),
          { otherwise: true, cards: [] },
        ],
      };
    case "routine": {
      const from = robotBefore(auto, at.list, at.index, catalog);
      const point = nearestPoint(auto, from) ?? Object.keys(auto.points)[0] ?? "";
      let routine = Object.keys(auto.routines)[0];
      if (!routine) {
        routine = "NewRoutine";
        auto.routines[routine] = {
          steps: [
            { forward: 12, left: 0 },
            { forward: 12, left: -12 },
          ],
          endsWhen: auto.registry.conditions[0] ?? "",
          timeoutMs: 2000,
          while: [],
          exit: [],
        };
      }
      return {
        id: makeCardId(),
        kind: "routine",
        routine,
        at: point,
        facingDeg: auto.points[point]?.[2] ?? 0,
        mirror: false,
        exit: point,
      };
    }
    case "goTo":
      return {
        id: makeCardId(),
        kind: "goTo",
        label: "",
        point: Object.keys(auto.points)[0] ?? "",
        maxDistanceIn: 24,
        ifRefused: [],
      };
    case "together":
      return { id: makeCardId(), kind: "together", label: "", ends: "ALL", cards: [] };
    case "path": {
      const from = robotBefore(auto, at.list, at.index, catalog);
      const fits = from
        ? catalog.paths.find((path) => Math.hypot(path.start.x - from.x, path.start.y - from.y) <= 2)
        : catalog.paths[0];
      return {
        id: makeCardId(),
        kind: "path",
        lineId: (fits ?? catalog.paths[0])?.id ?? "",
        while: [],
        events: [],
        park: false,
      };
    }
  }
}

export function insertNewCard(
  auto: AutoSection,
  kind: NewCardKind,
  catalog: PathCatalog,
  selection: { cardId: string | null; rowIndex: number | null },
): string {
  const at = insertionPoint(auto, selection.cardId, selection.rowIndex);
  const card = newCard(kind, auto, catalog, at);
  at.list.splice(at.index, 0, card);
  return card.id;
}

export function removeCard(auto: AutoSection, id: string): string | null {
  const location = locateCard(auto.cards, id);
  if (!location) return null;
  location.list.splice(location.index, 1);
  const next = location.list[location.index] ?? location.list[location.index - 1];
  if (next) return next.id;
  return location.parent ? `${location.parent.card.id}#${location.parent.rowIndex}` : null;
}

export function duplicateCard(auto: AutoSection, id: string): string | null {
  const location = locateCard(auto.cards, id);
  if (!location) return null;
  const copy = cloneCard(location.list[location.index]);
  location.list.splice(location.index + 1, 0, copy);
  return copy.id;
}

/** Move a card one place up or down within its list. */
export function moveCard(auto: AutoSection, id: string, delta: -1 | 1): boolean {
  const location = locateCard(auto.cards, id);
  if (!location) return false;
  const target = location.index + delta;
  if (target < 0 || target >= location.list.length) return false;
  const [card] = location.list.splice(location.index, 1);
  location.list.splice(target, 0, card);
  return true;
}

export function canMove(auto: AutoSection, id: string, delta: -1 | 1): boolean {
  const location = locateCard(auto.cards, id);
  if (!location) return false;
  const target = location.index + delta;
  return target >= 0 && target < location.list.length;
}

export function findFirstOf(auto: AutoSection, id: string): FirstOfCard | null {
  const location = locateCard(auto.cards, id);
  const card = location ? location.list[location.index] : null;
  return card?.kind === "firstOf" ? card : null;
}

/** A row of the given kind, keeping the old row's cards and label. */
export function rowOfKind(kind: RowKind, old: AutoRow | null, auto: AutoSection): AutoRow {
  const common: { cards: AutoCard[]; label?: string } = { cards: old?.cards ?? [] };
  if (old?.label) common.label = old.label;
  const points = Object.keys(auto.points);
  switch (kind) {
    case "when":
      return { ...common, when: auto.registry.conditions.slice(0, 1) };
    case "afterMs":
      return { ...common, afterMs: 1000 };
    case "timeLeftBelowS":
      return { ...common, timeLeftBelowS: 5 };
    case "otherwise":
      return { ...common, otherwise: true };
    case "nearPoint":
      return { ...common, nearPoint: points[0] ?? "", radiusIn: 6 };
    case "inArea":
      return { ...common, inArea: [points[0] ?? "", points[1] ?? points[0] ?? ""] };
  }
}
