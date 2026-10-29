import type { RobotConfig } from "../../types";
import { projectFromJson, type LoadResult } from "../../io";
import { pathStem } from "../../utils/filename";

/**
 * A project opened from a share link. It is shown instead of the person's own
 * work, which is set aside (not saved over) until the shared copy is closed.
 */
export interface SharedCopyView {
  /** File name the sender had open, when there was one. */
  name: string | null;
  /** When the link was made (the project's timestamp). */
  madeAt: string | null;
  /** File this copy was last saved to, from the banner. */
  savedAs: string | null;
  /** Where it was read from when that is git ("biobuzz master"), else null. */
  from?: string | null;
}

/**
 * The document for a shared project, read the way a file is read: its own
 * robot, and `ownRobot` for anything it does not record.
 */
export function sharedCopyState(
  project: Record<string, unknown>,
  ownRobot: RobotConfig,
): LoadResult {
  return projectFromJson(project, ownRobot);
}

export function sharedCopyTitle(view: SharedCopyView): string {
  const what = view.name ? `Shared copy of ${view.name}` : "Shared copy";
  const made = view.madeAt ? new Date(view.madeAt) : null;
  if (!made || Number.isNaN(made.getTime())) return what;
  return `${what}, made ${made.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;
}

/** A file name for saving the copy that does not collide with an existing file. */
export async function freeSharedFileName(
  name: string | null,
  exists: (fileName: string) => Promise<boolean>,
): Promise<string> {
  // The file store accepts letters, digits, spaces, dots, _ and - only.
  const stem =
    pathStem(name)
      .replace(/[^a-zA-Z0-9_\-. ]/g, "-")
      .trim() || "shared";
  for (let index = 1; index < 100; index++) {
    const candidate = `${stem}-shared${index === 1 ? "" : `-${index}`}.pp`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${stem}-shared-${Date.now()}.pp`;
}
