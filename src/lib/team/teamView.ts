/**
 * Shows team Autos: fetches them (teamAutos.ts) and keeps a `biobuzz-<file>` copy of each in the
 * browser's file list. The first is opened as the project, steps and all, so one Auto from a link
 * is there to read and edit. With more than one, all of them, the first too, are drawn as
 * overlays (multi-path mode, which draws the overlays in place of the project), so they play
 * together. The last view is remembered so Reload can fetch it again.
 */
import { get, writable } from "svelte/store";
import * as browserFileStore from "../../utils/browserFileStore";
import { showToast } from "../toast";
import {
  copyName,
  fetchTeamFiles,
  isStandIn,
  parseTeamHash,
  resolveTeamFiles,
  teamHash,
  TEAM_HASH_PREFIX,
  type FetchText,
  fetchText,
} from "./teamAutos";

/** What is on screen from the team: the branch, the files, and when they were fetched. */
export interface TeamView {
  ref: string;
  files: string[];
  /** The pair's name when opened by name, so a shared link keeps following the pair. */
  pair: string | null;
  fetchedAt: number;
}

export const teamView = writable<TeamView | null>(null);

/**
 * The copy a team view wants opened as the project (its first file): the app's dialogs, which
 * have the project store, open it and clear this.
 */
export const teamOpenRequest = writable<{
  path: string;
  text: string;
  /** Every Auto to draw together (none for one): set after the project opens, which resets them. */
  overlays: string[];
} | null>(null);

/** Fetches the files and shows them together; returns false (after a message) on failure. */
export async function showTeamView(
  ref: string,
  files: string[],
  pair: string | null = null,
  getText: FetchText = fetchText,
): Promise<boolean> {
  let fetched: { file: string; text: string }[];
  try {
    fetched = await fetchTeamFiles(ref, files, getText);
  } catch (error) {
    showToast((error as Error).message, "error");
    return false;
  }
  for (const { file, text } of fetched) {
    await browserFileStore.writeFile(copyName(file), text);
  }
  // The project is the first Auto of ours: a partner stand-in is only ever drawn beside one.
  const at = Math.max(
    0,
    fetched.findIndex(({ file }) => !isStandIn(file)),
  );
  const first = fetched[at];
  const others = fetched.filter((_, i) => i !== at);
  teamView.set({ ref, files, pair, fetchedAt: Date.now() });
  teamOpenRequest.set({
    path: copyName(first.file),
    text: first.text,
    // Overlay mode draws the overlays in place of the project, so the first goes in too: with
    // one Auto there are none, and the project is drawn as usual.
    overlays: others.length ? fetched.map(({ file }) => copyName(file)) : [],
  });
  showToast(
    others.length
      ? `Opened ${first.file} from biobuzz ${ref}, with ${others.map((o) => o.file).join(" + ")} drawn alongside`
      : `Opened ${first.file} from biobuzz ${ref}`,
    "success",
  );
  return true;
}

/** Fetches the current view again: whatever was pushed since. */
export async function reloadTeamView(): Promise<boolean> {
  const view = get(teamView);
  if (!view) return false;
  return showTeamView(view.ref, view.files, view.pair);
}

/** The link that opens the current view on any laptop. */
export function teamViewLink(
  view: TeamView,
  base = location.origin + location.pathname,
): string {
  return base + teamHash(view.ref, view.pair ?? view.files);
}

/** Opens a `#team=` link in the address bar, if there is one, and clears it. */
export async function openTeamHash(): Promise<void> {
  if (!location.hash.startsWith(TEAM_HASH_PREFIX)) return;
  const link = parseTeamHash(location.hash);
  history.replaceState(null, "", location.pathname + location.search);
  if (link === null) return;
  if ("error" in link) {
    showToast(link.error, "error");
    return;
  }
  let files: string[];
  try {
    files = await resolveTeamFiles(link);
  } catch (error) {
    showToast((error as Error).message, "error");
    return;
  }
  await showTeamView(link.ref, files, link.pair);
}
