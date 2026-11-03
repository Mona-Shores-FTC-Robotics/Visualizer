/**
 * The Match view's tipping points (breakpoints.ts), shared by its pieces: the bar under the field
 * runs the search, and each robot's sliders, in the side panels or under the field, show what it
 * found. One match view at a time, so one state.
 */
import type { KnobBreaks } from "./breakpoints";

class Tipping {
  /** Tipping points found for the what-ifs as they are now, by slider (`robot:id` or `hive:id`). */
  ticks = $state<Record<string, KnobBreaks>>({});
  searching = $state(false);
  searched = $state(false);
  /** Bumped by every change, so a search that is overtaken stops. */
  generation = 0;

  clear() {
    this.generation += 1;
    this.ticks = {};
    this.searched = false;
    this.searching = false;
  }
}

export const tipping = new Tipping();
