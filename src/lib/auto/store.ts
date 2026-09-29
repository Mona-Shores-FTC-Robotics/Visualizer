import { get, writable } from "svelte/store";
import { FIELD_SIZE } from "../../config";
import { isUnsaved } from "../../stores";
import { normalizeAuto } from "./normalize";
import type { Scenario } from "./simulate";
import type { AutoSection, NamedPoint } from "./types";
import { foldedBranches } from "./fold";

/**
 * The open project's `auto` section. A store rather than a prop so the many
 * places that load and save a project can carry it without threading it
 * through every upstream component. Null when the project has no Auto.
 */
export const autoSection = writable<AutoSection | null>(null);

/** Whether the left and right panels show the Auto instead of the paths. */
export const autoMode = writable(false);

/**
 * What is selected in the card list: a card id, or `<decision id>#<row>` for
 * a branch (new cards then go at the end of that branch).
 */
export const selectedCardId = writable<string | null>(null);

/** The preview's answers: whether each card's condition is true when it asks. Not saved. */
export const previewScenario = writable<Scenario>({});

let recorder: (() => void) | null = null;

/** The app's undo recorder, called after each committed Auto edit. */
export function setAutoRecorder(record: () => void): void {
  recorder = record;
}

/**
 * Edit the Auto: `mutate` works on a copy, which then replaces the store's
 * value. Pass `record: false` while typing and call `commitAuto()` when the
 * edit is done, so undo gets one step per edit rather than per keystroke.
 */
export function updateAuto(mutate: (auto: AutoSection) => void, record = true): void {
  const current = get(autoSection);
  if (!current) return;
  const draft = JSON.parse(JSON.stringify(current)) as AutoSection;
  mutate(draft);
  autoSection.set(draft);
  isUnsaved.set(true);
  if (record) recorder?.();
}

export function commitAuto(): void {
  recorder?.();
}

export function parseSelection(
  selection: string | null,
): { cardId: string | null; rowIndex: number | null } {
  if (!selection) return { cardId: null, rowIndex: null };
  const hash = selection.lastIndexOf("#");
  if (hash < 0) return { cardId: selection, rowIndex: null };
  return {
    cardId: selection.slice(0, hash),
    rowIndex: Number(selection.slice(hash + 1)),
  };
}

/**
 * Replace the Auto with the one in a freshly read file. Returns what the
 * loader had to repair, for the caller to show.
 */
export function loadAutoFrom(data: unknown): string[] {
  const raw =
    typeof data === "object" && data !== null
      ? (data as { auto?: unknown }).auto
      : undefined;
  const { auto, problems } = normalizeAuto(raw);
  autoSection.set(auto);
  selectedCardId.set(null);
  foldedBranches.set(new Set());
  previewScenario.set({});
  if (!auto) autoMode.set(false);
  return problems;
}

/** The current Auto, for the save paths that build a project document. */
export function currentAuto(): AutoSection | null {
  return get(autoSection);
}

/**
 * The Auto of a mirrored copy of the project: drawn for the other alliance,
 * its named points mirrored with the paths. Cards refer to paths by id and so
 * follow the mirrored paths on their own.
 */
export function mirrorAutoData(auto: unknown): unknown {
  const { auto: normalized } = normalizeAuto(auto);
  if (!normalized) return auto;
  normalized.drawnFor = normalized.drawnFor === "RED" ? "BLUE" : "RED";
  for (const [name, point] of Object.entries(normalized.points)) {
    const mirrored: NamedPoint =
      point.length === 3
        ? [FIELD_SIZE - point[0], point[1], 180 - point[2]]
        : [FIELD_SIZE - point[0], point[1]];
    normalized.points[name] = mirrored;
  }
  return normalized;
}
