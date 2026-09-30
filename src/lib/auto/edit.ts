import type { BasePoint } from "../../types";
import type { PathCatalog } from "./geometry";
import { allCards, childLists, cloneCard, locateCard, makeCardId } from "./tree";
import { createEmptyAuto } from "./normalize";
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
  | "rejoin";

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

/** Where the robot is before `index` of `list`, and which way it faces. */
function robotPoseBefore(
  auto: AutoSection,
  list: AutoCard[],
  index: number,
  catalog: PathCatalog,
): { x: number; y: number; headingDeg: number } | null {
  for (let i = index - 1; i >= 0; i--) {
    const card = list[i];
    if (card.kind !== "path") continue;
    const path = catalog.byId.get(card.lineId);
    return path ? { x: path.end.x, y: path.end.y, headingDeg: path.endHeadingDeg } : null;
  }
  const owner = findOwner(auto.cards, list);
  return owner ? robotPoseBefore(auto, owner.list, owner.index, catalog) : null;
}

/**
 * Where a new path card goes. "after": after the selected card, or at the end
 * of a selected branch (as every other + button). "branchEnd": at the end of
 * the selected card's branch, or of the selected branch; else of the Auto.
 */
function pathInsertionPoint(
  auto: AutoSection,
  selection: { cardId: string | null; rowIndex: number | null },
  where: "after" | "branchEnd",
): { list: AutoCard[]; index: number } {
  const at = insertionPoint(auto, selection.cardId, selection.rowIndex);
  return where === "branchEnd" ? { list: at.list, index: at.list.length } : at;
}

/** Where the robot will be when a new path card starts (see `pathInsertionPoint`). */
export function newPathStart(
  auto: AutoSection,
  catalog: PathCatalog,
  startPoint: { x: number; y: number; headingDeg: number },
  selection: { cardId: string | null; rowIndex: number | null },
  where: "after" | "branchEnd",
): { x: number; y: number; headingDeg: number } {
  const at = pathInsertionPoint(auto, selection, where);
  return robotPoseBefore(auto, at.list, at.index, catalog) ?? {
    x: startPoint.x,
    y: startPoint.y,
    headingDeg: startPoint.headingDeg,
  };
}

/** Adds a card that drives `lineId` where `newPathStart` said; returns its id. */
export function insertPathCard(
  auto: AutoSection,
  lineId: string,
  selection: { cardId: string | null; rowIndex: number | null },
  where: "after" | "branchEnd",
): string {
  const at = pathInsertionPoint(auto, selection, where);
  const card: AutoCard = { id: makeCardId(), kind: "path", lineId, park: false };
  at.list.splice(at.index, 0, card);
  return card.id;
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
          { when: firstCondition ? [firstCondition] : [], ...(firstCondition ? { label: `If ${firstCondition}` } : {}), cards: [] },
          { afterMs: 3000, label: "Timed out", cards: [] },
        ],
      };
    case "path": {
      const from = robotBefore(auto, at.list, at.index, catalog);
      const fits = from
        ? catalog.paths.find((path) => Math.hypot(path.start.x - from.x, path.start.y - from.y) <= 2)
        : catalog.paths[0];
      return {
        id: makeCardId(),
        kind: "path",
        lineId: (fits ?? catalog.paths[0])?.id ?? "",
        park: false,
      };
    }
    case "rejoin": {
      // Joins the first stop of the main plan until one is picked; the path is picked too.
      const firstStop = allCards(auto.cards).find((card) => card.kind === "path" && !card.through);
      return { id: makeCardId(), kind: "rejoin", lineId: catalog.paths[0]?.id ?? "", target: firstStop?.id ?? "" };
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
  return kind === "when"
    ? { ...common, when: auto.registry.conditions.slice(0, 1) }
    : { ...common, afterMs: 1000 };
}

/**
 * An Auto for a project that has none: drive each top-level path once, in
 * Path List order. So a file from the stock Visualizer opens as an Auto that
 * does what its Path List did.
 */
export function autoFromPaths(lineIds: string[]): AutoSection {
  const auto = createEmptyAuto();
  auto.cards = lineIds.map((lineId) => ({
    id: makeCardId(),
    kind: "path",
    lineId,
    park: false,
  }));
  return auto;
}
