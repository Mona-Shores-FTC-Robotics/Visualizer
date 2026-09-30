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

/** An action fired when the robot is `at` (0..1) of the way along a path. */
export interface PathEvent {
  at: number;
  action: string;
}

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
  /** Actions started when the path starts and run while it is driven. */
  while: string[];
  events: PathEvent[];
  /** The branch's park path, used by the endgame guard. */
  park: boolean;
}

/**
 * Waits for the first of its rows to become true and runs that row's cards.
 * With no cards on any row it is a "Wait for" card; with cards it is a
 * decision. Cards after it continue once the chosen row's cards are done.
 */
export interface FirstOfCard {
  id: string;
  kind: "firstOf";
  label: string;
  rows: AutoRow[];
}

/**
 * Runs a routine (a pattern defined relative to where it starts) placed at a
 * named point, facing `facingDeg`, optionally mirrored left↔right. It ends
 * when the routine's condition turns true, its time runs out or the pattern
 * is done, then drives straight to the `exit` point.
 */
export interface RoutineCard {
  id: string;
  kind: "routine";
  routine: string;
  at: string;
  facingDeg: number;
  mirror: boolean;
  exit: string;
}

/**
 * Drives straight to a named point if it is no more than `maxDistanceIn`
 * away; otherwise runs the `ifRefused` cards instead.
 */
export interface GoToCard {
  id: string;
  kind: "goTo";
  label: string;
  point: string;
  maxDistanceIn: number;
  ifRefused: AutoCard[];
}

/** Runs its cards at the same time; done when ALL are, or the FIRST is. */
export interface TogetherCard {
  id: string;
  kind: "together";
  label: string;
  ends: "ALL" | "FIRST";
  cards: AutoCard[];
}

export type AutoCard =
  | ActionCard
  | PathCard
  | FirstOfCard
  | RoutineCard
  | GoToCard
  | TogetherCard;
export type AutoCardKind = AutoCard["kind"];

interface RowCommon {
  cards: AutoCard[];
  /** Branch name shown in the editor and used as the guard label. */
  label?: string;
}

export type WhenRow = RowCommon & { when: string[] };
export type AfterMsRow = RowCommon & { afterMs: number };
export type TimeLeftRow = RowCommon & { timeLeftBelowS: number };
export type OtherwiseRow = RowCommon & { otherwise: true };
export type NearPointRow = RowCommon & { nearPoint: string; radiusIn: number };
export type InAreaRow = RowCommon & { inArea: [string, string] };

export type AutoRow =
  | WhenRow
  | AfterMsRow
  | TimeLeftRow
  | OtherwiseRow
  | NearPointRow
  | InAreaRow;

export type RowKind =
  | "when"
  | "afterMs"
  | "timeLeftBelowS"
  | "otherwise"
  | "nearPoint"
  | "inArea";

/**
 * One step of a routine's pattern, in inches relative to where the routine
 * starts: `forward` along its facing, `left` to its left. With `control` the
 * step is a curve through that control point, otherwise a straight line.
 */
export interface RoutineStep {
  forward: number;
  left: number;
  control?: [number, number];
}

export interface RoutineDef {
  /** The pattern, after the implicit start at (0, 0). */
  steps: RoutineStep[];
  /** Registered condition that ends the routine early. */
  endsWhen: string;
  timeoutMs: number;
  while: string[];
  /** Actions started as the robot leaves for the exit point. */
  exit: string[];
}

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
  /** Routine definitions by name; placed on the field by routine cards. */
  routines: Record<string, RoutineDef>;
  cards: AutoCard[];
}

export function rowKind(row: AutoRow): RowKind {
  if ("when" in row) return "when";
  if ("afterMs" in row) return "afterMs";
  if ("timeLeftBelowS" in row) return "timeLeftBelowS";
  if ("nearPoint" in row) return "nearPoint";
  if ("inArea" in row) return "inArea";
  return "otherwise";
}

/** A row that becomes true on the clock alone, so a wait with one cannot hang. */
export function isTimeRow(row: AutoRow): boolean {
  const kind = rowKind(row);
  return kind === "afterMs" || kind === "timeLeftBelowS" || kind === "otherwise";
}
