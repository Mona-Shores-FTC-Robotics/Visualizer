/**
 * Class strings shared by the Auto panels, on the same theme tokens as
 * upstream's inspector (lib/components/ui/styles.ts), so Auto mode looks like
 * the rest of the Visualizer in both themes.
 */
export const FIELD_CLASS =
  "w-full min-w-0 rounded-lg border border-border bg-base px-2 py-1 text-heading tabular-nums outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50";
export const ACTION_CLASS =
  "rounded-lg border border-border bg-base px-2 py-1 font-medium text-heading transition hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50";
export const DANGER_CLASS =
  "rounded-lg border border-danger bg-danger px-2 py-1 font-medium text-white transition hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-50";
export const LABEL_CLASS = "mb-1 block font-medium text-body";
export const CELL_CLASS = "rounded-lg border border-border bg-base/60 px-2 py-1.5";
export const SECTION_CLASS =
  "w-full rounded-xl border border-border bg-base/60 p-3 text-xs text-body space-y-3";

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
