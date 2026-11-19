/**
 * Fork: the HIVE as the field draws it, at a moment of the preview: which CELL is up, how far a TIP
 * has swung it, and what the raised CELL holds. The field image shows the HIVE as the match starts
 * (RIGHT up, its 3 NECTAR in it); the field lays this over it, so every TIP the preview computes is
 * seen to happen, and a CELL that goes down loses what was in it (the pieces spill out).
 *
 * Only the red HIVE: the Visualizer draws the red alliance. Blue is red turned half a turn about
 * the field's centre, so a blue view turns the whole drawing.
 */
import type { CausedTip, TimingValues, VolleyEffect } from "../timing/model";

export type Cell = "right" | "left";

/** The HIVE's history in a preview (timing/model.ts hiveHistory). */
export interface HiveHistory {
  tips: CausedTip[];
  volleys: VolleyEffect[];
}

/** One CELL at a moment. */
export interface CellView {
  /** 0: up and settled; 1: down; in between while a TIP swings it. */
  down: number;
  /** POLLEN in it (rounded weight; NECTAR is apart). */
  pollen: number;
  /** Whether its 3 NECTAR are still in it (only the CELL up at the start has any, until TIP 1). */
  nectar: boolean;
}

export type HiveView = Record<Cell, CellView>;

const other = (cell: Cell): Cell => (cell === "right" ? "left" : "right");

/** The CELL up after `n` TIPs: RIGHT at the start. */
export function upAfter(n: number): Cell {
  return n % 2 === 0 ? "right" : "left";
}

/** The HIVE at `t` seconds after PLAY. */
export function hiveAt(
  history: HiveHistory,
  values: TimingValues,
  t: number,
): HiveView {
  const { tips, volleys } = history;
  const started = tips.filter((tip) => tip.start <= t + 1e-9).length;
  const swinging =
    started > 0 && t < tips[started - 1].settled - 1e-9
      ? tips[started - 1]
      : null;
  const view: HiveView = {
    right: { down: 0, pollen: 0, nectar: false },
    left: { down: 0, pollen: 0, nectar: false },
  };
  /** Weight in the CELL raised after `n` TIPs, as at `t`: what landed since the TIP that raised it. */
  const loadAfter = (n: number): number => {
    const from = n === 0 ? -1 : tips[n - 1].cause;
    let load = n === 0 ? values.startLoad : 0;
    for (let i = from + 1; i < volleys.length; i++) {
      const v = volleys[i];
      if (v.t > t + 1e-9) break;
      if (!v.counted) continue;
      load = v.load;
      if (v.tip !== null) break;
    }
    return load;
  };
  const pollenIn = (n: number, load: number) =>
    Math.max(0, Math.round(n === 0 ? load - values.startLoad : load));
  if (swinging) {
    // The CELL that was up goes down over the swing, with what tipped it; the other comes up empty.
    const n = started - 1;
    const from = upAfter(n);
    const p = Math.min(
      1,
      Math.max(
        0,
        (t - swinging.start) /
          Math.max(1e-6, swinging.settled - swinging.start),
      ),
    );
    view[from] = {
      down: p,
      pollen: pollenIn(n, volleys[swinging.cause]?.load ?? 0),
      nectar: n === 0,
    };
    view[other(from)] = { down: 1 - p, pollen: 0, nectar: false };
    return view;
  }
  const up = upAfter(started);
  view[up] = {
    down: 0,
    pollen: pollenIn(started, loadAfter(started)),
    nectar: started === 0,
  };
  view[other(up)] = { down: 1, pollen: 0, nectar: false };
  return view;
}

/**
 * The red HIVE's two CELLs on the field image, Pedro's frame, inches: the outlines the field draws
 * (measured on biobuzz-dark.webp). LEFT is the CELL at the scoring end, past the centre line.
 */
export const RED_CELLS: Record<
  Cell,
  { x: number; y: number; w: number; h: number }
> = {
  left: { x: 47.3, y: 77.5, w: 21.3, h: 18.3 },
  right: { x: 47.3, y: 50.6, w: 21.3, h: 16.8 },
};
