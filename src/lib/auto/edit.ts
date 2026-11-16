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
