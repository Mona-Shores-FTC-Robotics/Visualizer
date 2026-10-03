/**
 * Shows team Autos together: fetches them (teamAutos.ts), keeps a `biobuzz-<file>` copy of
 * each in the browser's file list, and selects those copies in multi-path mode, which draws
 * and plays only them. The last view is remembered so Reload can fetch it again.
 */
import { get, writable } from "svelte/store";
import { activePaths } from "../../stores";
import { autoMode } from "../auto/store";
import * as browserFileStore from "../../utils/browserFileStore";
import { showToast } from "../toast";
import {
  copyName,
  fetchTeamFiles,
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
  // Auto mode shows one Auto; multi-path mode is for several.
  autoMode.set(false);
  activePaths.set(fetched.map(({ file }) => copyName(file)));
  teamView.set({ ref, files, pair, fetchedAt: Date.now() });
  showToast(`Showing ${files.join(" + ")} from biobuzz ${ref}`, "success");
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
