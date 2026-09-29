import { writable } from "svelte/store";
import { allCards, childLists } from "./tree";
import type { AutoCard } from "./types";

/**
 * Which branches the card list shows folded: `<card id>#<branch index>`, the
 * branch index being the card's `childLists` index (a decision's row, a
 * go-to's fallback, a together's cards). How the list is viewed, not part of
 * the Auto: never saved, and not in undo history.
 */
export const foldedBranches = writable<Set<string>>(new Set());

export function branchKey(cardId: string, index: number): string {
  return `${cardId}#${index}`;
}

/** The branches that hold `cardId`, outermost first; empty on the trunk. */
export function branchesAround(cards: AutoCard[], cardId: string): string[] {
  for (const card of cards) {
    if (card.id === cardId) return [];
    const lists = childLists(card);
    for (let index = 0; index < lists.length; index++) {
      const inner = branchesAround(lists[index], cardId);
      if (inner.length || lists[index].some((c) => c.id === cardId)) {
        return [branchKey(card.id, index), ...inner];
      }
    }
  }
  return [];
}

/** The folded keys with `key` flipped: folded if it was open, open if folded. */
export function toggleFolded(folded: Set<string>, key: string): Set<string> {
  const next = new Set(folded);
  if (!next.delete(key)) next.add(key);
  return next;
}

/** The folded keys minus every branch that holds `cardId`, or the same set. */
export function unfoldAround(
  folded: Set<string>,
  cards: AutoCard[],
  cardId: string,
): Set<string> {
  const around = branchesAround(cards, cardId).filter((key) => folded.has(key));
  if (!around.length) return folded;
  const next = new Set(folded);
  around.forEach((key) => next.delete(key));
  return next;
}

/** One line for a folded branch: how many cards, and the first few in order. */
export function foldSummary(
  list: AutoCard[],
  nameOf: (card: AutoCard) => string,
  shown = 4,
): string {
  const count = allCards(list).length;
  const names = list.slice(0, shown).map(nameOf);
  if (list.length > shown) names.push("…");
  return `${count} card${count === 1 ? "" : "s"} · ${names.join(" → ")}`;
}
