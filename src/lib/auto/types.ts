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
}

/** `[x, y]` or `[x, y, headingDeg]`, inches in the Pedro field frame. */
export type NamedPoint = [number, number] | [number, number, number];

/** An action fired when the robot is `at` (0..1) of the way along a path. */
export interface PathEvent {
  at: number;
  action: string;
}

export interface ActionCard {
  id: string;
  kind: "action";
  name: string;
  /** Preview only: how long the action keeps the robot busy. Not exported. */
  previewMs?: number;
}

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

export type AutoCard = ActionCard | PathCard | FirstOfCard;
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

export interface AutoSection {
  version: typeof AUTO_FORMAT_VERSION;
  /** The alliance the Auto is drawn for; the robot mirrors it for the other. */
  drawnFor: Alliance;
  /** Name of the generated class, before the `Auto` suffix. Defaults to the file name. */
  exportName?: string;
  registry: AutoRegistry;
  points: Record<string, NamedPoint>;
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
