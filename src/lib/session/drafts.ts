/**
 * Drafts of files opened from biobuzz. Opening a `#gh=` link shows the file
 * as a copy; every edit to it is kept here, in this browser, so closing the
 * tab loses nothing and the same link brings the draft back. "Save to GitHub"
 * is the one real save: after it, the draft is gone and the file matches
 * GitHub again. One draft per branch and path.
 *
 * Each draft remembers the text GitHub had when the draft began (`baseText`),
 * so a newer version on GitHub can be noticed instead of silently replaced.
 */

export interface Draft {
  ref: string | null;
  path: string;
  /** The project as edited: the app's own saved form (see `projectFingerprint`). */
  text: string;
  /** The file's text on GitHub when this draft began. */
  baseText: string;
  /** That version's fingerprint: the draft is edited while `text` differs from it. */
  baseFingerprint: string;
  /** When it was last edited (ms since 1970). */
  editedAt: number;
}

const KEY = "biobuzzDrafts";

/** Where drafts live: the browser's storage, or a stand-in in tests. */
export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): DraftStorage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export function draftKey(ref: string | null, path: string): string {
  return `${ref ?? "(default)"}:${path}`;
}

function readAll(storage: DraftStorage | null): Record<string, Draft> {
  try {
    const text = storage?.getItem(KEY);
    const parsed = text ? JSON.parse(text) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, Draft>) : {};
  } catch {
    return {};
  }
}

function writeAll(storage: DraftStorage | null, all: Record<string, Draft>): boolean {
  try {
    storage?.setItem(KEY, JSON.stringify(all));
    return !!storage;
  } catch {
    // Full or blocked storage: the draft lasts only while the tab is open.
    return false;
  }
}

export function loadDraft(
  ref: string | null,
  path: string,
  storage: DraftStorage | null = browserStorage(),
): Draft | null {
  return readAll(storage)[draftKey(ref, path)] ?? null;
}

/** Keeps a draft; false when this browser will not store it. */
export function saveDraft(draft: Draft, storage: DraftStorage | null = browserStorage()): boolean {
  const all = readAll(storage);
  all[draftKey(draft.ref, draft.path)] = draft;
  return writeAll(storage, all);
}

export function deleteDraft(ref: string | null, path: string, storage: DraftStorage | null = browserStorage()) {
  const all = readAll(storage);
  if (!(draftKey(ref, path) in all)) return;
  delete all[draftKey(ref, path)];
  writeAll(storage, all);
}

/**
 * What a draft has to say on its bar: whether it differs from the version it
 * began from, and whether GitHub has moved on since (null: not known yet).
 */
export function draftStatus(
  edited: boolean,
  baseText: string,
  githubText: string | null,
): "same" | "edited" | "newer-on-github" | "edited-and-newer" {
  const newer = githubText !== null && githubText !== baseText;
  if (edited) return newer ? "edited-and-newer" : "edited";
  return newer ? "newer-on-github" : "same";
}

/**
 * A project as it would be saved, minus what changes without anyone editing
 * it (the save time, the viewer's own display settings, which other files are
 * shown beside it): two projects with the same fingerprint are the same Auto.
 */
export function projectFingerprint(project: Record<string, unknown>, fileSettings: object): string {
  const { timestamp: _timestamp, activePaths: _activePaths, settings: _settings, ...rest } = project;
  return JSON.stringify({ ...rest, settings: fileSettings });
}
