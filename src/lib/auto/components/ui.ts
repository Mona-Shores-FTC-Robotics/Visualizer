/**
 * Class strings shared by the Auto panels. They are the stock inspector's
 * (SelectedPathInspector, PiecewiseHeadingEditor), so Auto mode looks like
 * the rest of the Visualizer.
 */
export const FIELD_CLASS =
  "w-full rounded border border-[#444444] bg-[#111111] px-2 py-1 text-gray-100 focus:outline-none focus:ring-1 focus:ring-green-500 disabled:cursor-not-allowed disabled:opacity-50";
export const ACTION_CLASS =
  "rounded border border-[#444444] px-2 py-1 font-semibold text-gray-100 hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-50";
export const DANGER_CLASS =
  "rounded border border-red-700 bg-red-600 px-2 py-1 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50";
export const LABEL_CLASS = "mb-1 block font-semibold uppercase tracking-wide text-gray-500";
export const CELL_CLASS = "border border-[#333333] bg-[#1f1f1f] px-2 py-1.5";
export const SECTION_CLASS =
  "w-full border border-[#333333] bg-[#222222] p-3 text-xs text-gray-400 space-y-3";

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
      // A together's cards run in the same branch; a goTo's fallback is its own.
      if (card.kind === "together") walk(card.cards, color);
      if (card.kind === "goTo") walk(card.ifRefused, "#ff8a3d");
    }
  };
  walk(cards, TRUNK_COLOR);
  return colors;
}
