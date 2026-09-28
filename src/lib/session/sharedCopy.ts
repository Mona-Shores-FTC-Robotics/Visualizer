import type { Settings } from "../../types";
import { normalizeFieldPoints } from "../../utils/fieldPoints";
import { pathStem } from "../../utils/filename";
import {
  deriveSequence,
  normalizePaths,
  normalizeStartPose,
} from "../../utils/normalize";
import { projectSettings } from "../../utils/shareLink";

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
}

/** The on-screen state for a shared project, read the way a file is read. */
export function sharedCopyState(
  project: Record<string, unknown>,
  ownSettings: Settings,
) {
  const lines = normalizePaths((project.lines as never) ?? []);
  return {
    startPoint: normalizeStartPose(project.startPoint as never),
    lines,
    sequence: deriveSequence(project, lines),
    shapes: Array.isArray(project.shapes) ? project.shapes : [],
    fieldPoints: normalizeFieldPoints(project),
    // Robot size and motion model come with the Auto; display
    // preferences stay the viewer's own.
    settings: {
      ...ownSettings,
      ...projectSettings(project.settings as object),
    } as Settings,
  };
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
