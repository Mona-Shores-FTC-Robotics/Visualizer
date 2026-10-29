import { get, writable } from "svelte/store";
import type { ProjectStore } from "../../state/project.svelte";
import type { Scenario } from "./simulate";
import type { AutoSection } from "./types";
import { foldedBranches } from "./fold";

/**
 * The open project's `auto` section, mirrored from `project.doc.auto` (see
 * `connectAutoStore`) so components can read it as `$autoSection`. Null when
 * the project has no Auto. Edit it through `updateAuto`, never `set`.
 */
export const autoSection = writable<AutoSection | null>(null);

let project: ProjectStore | null = null;

/** Called once by App: the Auto lives in the project document from then on. */
export function connectAutoStore(store: ProjectStore): void {
  project = store;
}

/**
 * What is selected in the card list: a card id, or `<decision id>#<row>` for
 * a branch (new cards then go at the end of that branch).
 */
export const selectedCardId = writable<string | null>(null);

/**
 * Fork: set while the simple builder waits for a spot to be clicked on the field; the field calls
 * it with the click, in inches, instead of selecting.
 */
export const spotPicker = writable<((at: { x: number; y: number }) => void) | null>(null);

/** Fork: where the mouse is over the field, in inches, or null: spot names show near it. */
export const fieldHover = writable<{ x: number; y: number } | null>(null);

/** The preview's answers: whether each card's condition is true when it asks. Not saved. */
export const previewScenario = writable<Scenario>({});

let newPathHandler: ((where: "after" | "branchEnd") => void) | null = null;

/** The app's "add a path here", which needs the Path List (App.svelte). */
export function setNewPathHandler(handler: (where: "after" | "branchEnd") => void): void {
  newPathHandler = handler;
}

/** Adds a new path and the card that drives it, starting where the robot is. */
export function addNewPath(where: "after" | "branchEnd"): void {
  newPathHandler?.(where);
}

/**
 * Edit the Auto: `mutate` works on a copy, which replaces the document's.
 * Pass `record: false` while typing: those edits merge into one undo step
 * (the project store coalesces them), so undo goes back a whole value.
 */
export function updateAuto(mutate: (auto: AutoSection) => void, record = true): void {
  const current = project?.doc.auto;
  if (!project || !current) return;
  const draft = structuredClone(current) as AutoSection;
  mutate(draft);
  project.apply((doc) => ({ ...doc, auto: draft }), record ? {} : { coalesce: "auto" });
}

/**
 * Adjust the Auto without an undo step, for what follows from an edit (pins,
 * link paths) rather than being one.
 */
export function amendAuto(mutate: (auto: AutoSection) => void): void {
  const current = project?.doc.auto;
  if (!project || !current) return;
  const draft = structuredClone(current) as AutoSection;
  mutate(draft);
  project.amend((doc) => ({ ...doc, auto: draft }));
}

/** The end of a typed edit. Coalescing already made it one step. */
export function commitAuto(): void {}

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

/** Forget the previous project's selection and preview answers, after a load. */
export function resetAutoView(): void {
  selectedCardId.set(null);
  foldedBranches.set(new Set());
  previewScenario.set({});
}

/** The current Auto, for the save paths that build a project document. */
export function currentAuto(): AutoSection | null {
  return project?.doc.auto ?? get(autoSection);
}
