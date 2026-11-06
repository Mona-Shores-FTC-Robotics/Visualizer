import { writable, get } from "svelte/store";
import {
  repoFolder,
  readyRepoFolder,
  refreshRepoBranch,
  type RepoFolder,
} from "./repoStore";
import type { FileSet } from "./workspaceFiles";

export interface WorkspaceDocument {
  checkoutId: string;
  branch: string | null;
  name: string;
  baseline: FileSet;
}

/** A save destination is attached only by explicitly opening/saving into the checkout. */
export const workspaceDocument = writable<WorkspaceDocument | null>(null);
export const workspaceBusy = writable(false);
export const workspaceError = writable("");
export const workspaceChanged = writable(0);
export const workspaceFileKey = (id: string, name: string) =>
  `checkout-${id}/${name}`;

export async function requireWorkspace(
  binding?: WorkspaceDocument | null,
): Promise<RepoFolder> {
  const folder = await readyRepoFolder();
  if (!folder) throw new Error("Allow access to the BIOBUZZ checkout first.");
  await refreshRepoBranch();
  const current = get(repoFolder)!;
  if (
    binding &&
    (binding.checkoutId !== current.id || binding.branch !== current.branch)
  )
    throw new Error(
      "The checkout or branch changed. Reopen the auto from the intended checkout before saving. Your editor changes have been kept.",
    );
  return current;
}

/** Serialize disk mutations across dialogs and shortcuts. */
export async function workspaceOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  if (get(workspaceBusy))
    throw new Error("A checkout operation is already running.");
  workspaceBusy.set(true);
  workspaceError.set("");
  try {
    // Tabs on the same Visualizer origin must not recover another tab's active save journal.
    return typeof navigator !== "undefined" && navigator.locks
      ? await navigator.locks.request("biobuzz-auto-checkout", operation)
      : await operation();
  } catch (error) {
    workspaceError.set(error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    workspaceBusy.set(false);
  }
}
