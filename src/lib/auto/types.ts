/**
 * The `auto` section of a .pp file: a whole Autonomous built from cards.
 *
 * Everything the Auto builder adds to a project lives under this one
 * top-level key, so a stock Visualizer opens the file and ignores it, and
 * upstream merges stay mechanical. The format is documented in
 * docs/auto-format.md; keep the two in step.
 */

export const AUTO_FORMAT_VERSION = 1;

export type Alliance = "RED" | "BLUE";

/** Names the robot code registers. The editor cannot read robot code. */
export interface AutoRegistry {
  actions: string[];
  conditions: string[];
  /**
   * The conditions that are events: once true, true for the rest of the match
   * ("HiveTip1": the first TIP has happened). The others are states, which can
   * turn false again ("IntakeFull": holding 4 right now). Only the editor uses
   * the difference, to say how to read a condition.
   */
  events?: string[];
  /** Each command's typical time in seconds, from the robot's list: what the preview uses. */
  typicalS?: Record<string, number>;
}

/** `[x, y]` or `[x, y, headingDeg]`, inches in the Pedro field frame. */
export type NamedPoint = [number, number] | [number, number, number];

/**
 * Runs a registered command (the file calls it an action). On the robot it runs until it finishes
 * or `timeoutS` (5 s when unset) has passed, whichever is first.
 */
export interface ActionCard {
  id: string;
  kind: "action";
  name: string;
  /** Seconds before the robot cuts the command off; unset means `DEFAULT_TIMEOUT_S`. */
  timeoutS?: number;
  /** Preview only, from older files: how long it keeps the robot busy. The robot's typical time wins. */
  previewMs?: number;
}

/** A command step's timeout when it sets none, as `AutoKit.DEFAULT_TIMEOUT_S`. */
export const DEFAULT_TIMEOUT_S = 5;

export interface PathCard {
  id: string;
  kind: "path";
  /** A top-level path (a single path or a group) of the project's `lines`. */
  lineId: string;
  /** The branch's park path, used by the endgame guard. */
  park: boolean;
}

/**
 * The one branching block: wait for a trigger, at most some time. Its two rows are the ways out: a
 * `when` row (the trigger fired, ✓) and an `afterMs` row (timed out). With no cards on either row
 * it is a plain wait and the cards after it continue; with cards, each row holds the rest of its
 * route.
 */
export interface FirstOfCard {
  id: string;
  kind: "firstOf";
  label: string;
  rows: AutoRow[];
  /**
   * A command run while the card waits ("LaunchAll · wait for Tip"): it starts with the wait and is
   * stopped when a row fires, if still running.
   */
  alongside?: string;
}

export type AutoCard = ActionCard | PathCard | FirstOfCard;
export type AutoCardKind = AutoCard["kind"];

interface RowCommon {
  cards: AutoCard[];
  /** Branch name shown in the editor and used as the guard label. */
  label?: string;
}

/** The trigger fired. The file keeps a list for older files; it holds exactly one name. */
export type WhenRow = RowCommon & { when: string[] };
/** The wait's time limit passed. */
export type AfterMsRow = RowCommon & { afterMs: number };

export type AutoRow = WhenRow | AfterMsRow;

export type RowKind = "when" | "afterMs";

export interface AutoSection {
  version: typeof AUTO_FORMAT_VERSION;
  /** The alliance the Auto is drawn for; the robot turns it half a turn about the field centre for the other. */
  drawnFor: Alliance;
  /** Name of the generated class, before the `Auto` suffix. Defaults to the file name. */
  exportName?: string;
  registry: AutoRegistry;
  points: Record<string, NamedPoint>;
  /**
   * Path ends that are named points, by path id. Such an end has no position
   * of its own: it is wherever the point is, and dragging it moves the point
   * and every other end on it. The paths still carry the position, so a stock
   * Visualizer draws them; the editor keeps the two equal (see pins.ts).
   */
  pathEnds: Record<string, string>;
  /** The named point the start pose is on, if any; same rules as `pathEnds`. */
  startAt?: string;
  cards: AutoCard[];
}

export function rowKind(row: AutoRow): RowKind {
  return "when" in row ? "when" : "afterMs";
}

/** The time-limit row, which every wait needs so it cannot hang. */
export function isTimeRow(row: AutoRow): boolean {
  return rowKind(row) === "afterMs";
}
