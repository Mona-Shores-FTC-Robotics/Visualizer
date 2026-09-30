import type {
  AutoCard,
  AutoRow,
  AutoSection,
  FirstOfCard,
  PathCard,
} from "./types";
import { rowKind } from "./types";

/** Where a card sits: the list holding it and its index there. */
export interface CardLocation {
  list: AutoCard[];
  index: number;
  /** The wait that owns the list and which of its rows it is; null for the top level. */
  parent: { card: AutoCard; rowIndex: number } | null;
}

/** The card lists a card holds: a wait's rows. */
export function childLists(card: AutoCard): AutoCard[][] {
  return card.kind === "firstOf" ? card.rows.map((row) => row.cards) : [];
}

export function makeCardId(): string {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Every card in the tree, depth first, in the order the Auto would reach them. */
export function allCards(cards: AutoCard[]): AutoCard[] {
  const out: AutoCard[] = [];
  const walk = (list: AutoCard[]) => {
    for (const card of list) {
      out.push(card);
      childLists(card).forEach(walk);
    }
  };
  walk(cards);
  return out;
}

export function locateCard(
  cards: AutoCard[],
  id: string,
  parent: CardLocation["parent"] = null,
): CardLocation | null {
  const index = cards.findIndex((card) => card.id === id);
  if (index >= 0) return { list: cards, index, parent };
  for (const card of cards) {
    const lists = childLists(card);
    for (let rowIndex = 0; rowIndex < lists.length; rowIndex++) {
      const found = locateCard(lists[rowIndex], id, { card, rowIndex });
      if (found) return found;
    }
  }
  return null;
}

export function findCard(cards: AutoCard[], id: string | null): AutoCard | null {
  if (!id) return null;
  const location = locateCard(cards, id);
  return location ? location.list[location.index] : null;
}

/** Deep copy with fresh ids, so a duplicated card is independent. */
export function cloneCard(card: AutoCard): AutoCard {
  const copy = JSON.parse(JSON.stringify(card)) as AutoCard;
  const refresh = (c: AutoCard) => {
    c.id = makeCardId();
    childLists(c).forEach((list) => list.forEach(refresh));
  };
  refresh(copy);
  return copy;
}

/** Names of registered things the Auto uses, each with its use count. */
export function usedNames(auto: AutoSection): {
  actions: Map<string, number>;
  conditions: Map<string, number>;
} {
  const actions = new Map<string, number>();
  const conditions = new Map<string, number>();
  const bump = (map: Map<string, number>, name: string) =>
    map.set(name, (map.get(name) ?? 0) + 1);

  for (const card of allCards(auto.cards)) {
    if (card.kind === "action") bump(actions, card.name);
    if (card.kind === "firstOf") {
      if (card.alongside) bump(actions, card.alongside);
      for (const row of card.rows) {
        if ("when" in row) row.when.forEach((name) => bump(conditions, name));
      }
    }
  }
  return { actions, conditions };
}

/** The park card directly in this list, if any. */
export function parkCardOf(list: AutoCard[]): PathCard | null {
  return (
    (list.find((card) => card.kind === "path" && card.park) as
      | PathCard
      | undefined) ?? null
  );
}

/** A short human description of a row's condition. */
export function describeRow(row: AutoRow): string {
  return "when" in row ? row.when[0] || "(no trigger)" : `${row.afterMs} ms passed`;
}

/** The branch's name: its own label, or one made from its condition. */
export function rowLabel(row: AutoRow): string {
  if (row.label && row.label.trim()) return row.label.trim();
  return rowKind(row) === "when" ? `If ${describeRow(row)}` : "Timed out";
}

/** A card's display name; path cards need the path's name from the caller. */
export function cardTitle(card: AutoCard, pathName?: string): string {
  switch (card.kind) {
    case "action":
      return card.name || "(no action)";
    case "path":
      return pathName ?? "(missing path)";
    case "firstOf":
      return card.label || "Wait";
  }
}

/** Label used for a card list's endgame guard and in the editor. */
export function listLabel(parent: { card: AutoCard; rowIndex: number } | null): string {
  if (!parent) return "Auto";
  const { card, rowIndex } = parent;
  return card.kind === "firstOf" ? rowLabel(card.rows[rowIndex]) : cardTitle(card);
}

/** True when no row has cards: shown as a "Wait for" card, not a decision. */
export function isPlainWait(card: FirstOfCard): boolean {
  return card.rows.every((row) => row.cards.length === 0);
}
