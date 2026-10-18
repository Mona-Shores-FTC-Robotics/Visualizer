import { insertionPoint } from "./edit";
import { makeCardId } from "./tree";
import { rowKind, type AutoRow, type AutoSection, type FirstOfCard } from "./types";

/**
 * The game's verbs, as presets of the one branching block. A student says "fire", "load" or
 * "wait for a TIP"; each is a `firstOf` card (wait for a trigger, at most some time, maybe while
 * a command runs) built from the names the robot registers (`AutoRegistration` in biobuzz). The
 * file format, the preview and the export see an ordinary wait card: nothing new to export.
 */

/** The robot's names the presets use; `AutoRegistration` in biobuzz registers them. */
export const ROBOT = {
  launchAll: "LaunchAll",
  empty: "Empty",
  intakeFull: "IntakeFull",
  tip: "Tip",
} as const;

/** `LaunchAll`'s typical time when a preset first adds it to a file's registry (seconds). */
const LAUNCH_ALL_TYPICAL_S = 2;

export type PresetKind = "fire" | "load" | "tip";

export interface Preset {
  kind: PresetKind;
  /** The button's text. */
  button: string;
  /** What the button does, for its tooltip. */
  hint: string;
  /** The card's label. */
  label: string;
  trigger: string;
  /** Default time limit. */
  limitMs: number;
  alongside?: string;
  /** True when the trigger is an event (once true, true for the rest of the match). */
  event?: boolean;
}

export const PRESETS: Preset[] = [
  {
    kind: "fire",
    button: "Fire",
    hint: "Launch everything, until the launcher is empty or the time limit passes",
    label: "Fire",
    trigger: ROBOT.empty,
    limitMs: 3000,
    alongside: ROBOT.launchAll,
  },
  {
    kind: "load",
    button: "Load",
    hint: "Wait for the intake to fill, at most the time limit",
    label: "Load",
    trigger: ROBOT.intakeFull,
    limitMs: 3000,
  },
  {
    kind: "tip",
    button: "Wait for TIP",
    hint: "Wait for our HIVE to tip, at most the time limit",
    label: "Wait for TIP",
    trigger: ROBOT.tip,
    limitMs: 5000,
    event: true,
  },
];

export function presetOf(kind: PresetKind): Preset {
  const preset = PRESETS.find((candidate) => candidate.kind === kind);
  if (!preset) throw new Error(`no preset ${kind}`);
  return preset;
}

/** The preset as a card: a wait with a ✓ exit (the trigger) and a ✗ exit (the time limit). */
export function presetCard(preset: Preset): FirstOfCard {
  const card: FirstOfCard = {
    id: makeCardId(),
    kind: "firstOf",
    label: preset.label,
    rows: [
      { when: [preset.trigger], cards: [] },
      { afterMs: preset.limitMs, cards: [] },
    ],
  };
  if (preset.alongside) card.alongside = preset.alongside;
  return card;
}

/** Puts the preset's names in the file's registry, so the card is valid as soon as it is added. */
export function registerPreset(auto: AutoSection, preset: Preset): void {
  const registry = auto.registry;
  if (!registry.conditions.includes(preset.trigger)) registry.conditions.push(preset.trigger);
  if (preset.event) {
    registry.events ??= [];
    if (!registry.events.includes(preset.trigger)) registry.events.push(preset.trigger);
  }
  if (preset.alongside && !registry.actions.includes(preset.alongside)) {
    registry.actions.push(preset.alongside);
    if (preset.alongside === ROBOT.launchAll && registry.typicalS?.[ROBOT.launchAll] === undefined) {
      registry.typicalS = { ...registry.typicalS, [ROBOT.launchAll]: LAUNCH_ALL_TYPICAL_S };
    }
  }
}

/** Adds the preset's card after the selection (or at the end of a selected branch); returns its id. */
export function insertPreset(
  auto: AutoSection,
  kind: PresetKind,
  selection: { cardId: string | null; rowIndex: number | null },
): string {
  const preset = presetOf(kind);
  registerPreset(auto, preset);
  const card = presetCard(preset);
  const at = insertionPoint(auto, selection.cardId, selection.rowIndex);
  at.list.splice(at.index, 0, card);
  return card.id;
}

// --- plain words for a wait card -------------------------------------------

/** A time limit in plain words: `3000` → "3.0 s". */
export function limitText(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

/** The ✓ row of a wait, if it has one. */
export function triggerRow(card: FirstOfCard): (AutoRow & { when: string[] }) | undefined {
  return card.rows.find((row) => rowKind(row) === "when") as (AutoRow & { when: string[] }) | undefined;
}

/** The ✗ row of a wait, if it has one. */
export function limitRow(card: FirstOfCard): (AutoRow & { afterMs: number }) | undefined {
  return card.rows.find((row) => rowKind(row) === "afterMs") as (AutoRow & { afterMs: number }) | undefined;
}

/** True when the card is the simple shape every wait should have: one trigger row and one time row. */
export function isSimpleWait(card: FirstOfCard): boolean {
  return card.rows.length === 2 && !!triggerRow(card) && !!limitRow(card);
}

/**
 * The wait as one line a person would say: "LaunchAll until Empty · at most 3.0 s",
 * "until IntakeFull · at most 3.0 s".
 */
export function waitSentence(card: FirstOfCard): string {
  const trigger = triggerRow(card)?.when[0];
  const limit = limitRow(card);
  const parts: string[] = [];
  if (card.alongside) parts.push(trigger ? `${card.alongside} until ${trigger}` : card.alongside);
  else if (trigger) parts.push(`until ${trigger}`);
  if (limit) parts.push(`at most ${limitText(limit.afterMs)}`);
  if (!parts.length) parts.push("no trigger and no time limit");
  const extra = card.rows.length - (trigger ? 1 : 0) - (limit ? 1 : 0);
  if (extra > 0) parts.push(`${extra} more row${extra === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

/** A wait's exit in plain words: "✓ Empty" or "✗ not after 3.0 s". */
export function exitText(row: AutoRow): string {
  return rowKind(row) === "when"
    ? `✓ ${(row as { when: string[] }).when[0] || "(no trigger)"}`
    : `✗ not after ${limitText((row as { afterMs: number }).afterMs)}`;
}
