/** The trunk is drawn in the Visualizer's path yellow. */
export const TRUNK_COLOR = "#ffc516";

const BRANCH_COLORS = ["#3fcf8e", "#ff8a3d", "#a594ff", "#4ea1ff", "#ff6fb5", "#5fd4e6"];

/** A branch's colour: by its row, so row 1 of every decision matches. */
export function branchColor(rowIndex: number): string {
  return BRANCH_COLORS[rowIndex % BRANCH_COLORS.length];
}

export function seconds(value: number): string {
  return Number.isFinite(value) ? `${value.toFixed(1)} s` : "∞";
}

import type { AutoCard } from "../types";

/** Each card's colour: the trunk's, or that of the branch it sits in. */
export function cardColors(cards: AutoCard[]): Map<string, string> {
  const colors = new Map<string, string>();
  const walk = (list: AutoCard[], color: string) => {
    for (const card of list) {
      colors.set(card.id, color);
      if (card.kind === "firstOf") {
        card.rows.forEach((row, index) => walk(row.cards, branchColor(index)));
      }
    }
  };
  walk(cards, TRUNK_COLOR);
  return colors;
}
