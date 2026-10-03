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
  MAX_FILES,
  fetchTeamFiles,
  parseTeamHash,
  resolveTeamLink,
  teamHash,
  TEAM_HASH_PREFIX,
  type FetchText,
  fetchText,
} from "./teamAutos";
import type { PairLink } from "./tandem";

/** What is on screen from the team: the branch, the files, and when they were fetched. */
export interface TeamView {
  ref: string;
  files: string[];
  /** The pair's name when opened by name, so a shared link keeps following the pair. */
  pair: string | null;
  /** The pair's partner links from pairs.json (none when opened by file names). */
  links: PairLink[];
  fetchedAt: number;
}

export const teamView = writable<TeamView | null>(null);

/** Fetches the files and shows them together; returns false (after a message) on failure. */
export async function showTeamView(
  ref: string,
  files: string[],
  pair: string | null = null,
  links: PairLink[] = [],
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
  tandemEdit.set(null);
  activePaths.set(fetched.map(({ file }) => copyName(file)));
  teamView.set({ ref, files, pair, links, fetchedAt: Date.now() });
  showToast(`Showing ${files.join(" + ")} from biobuzz ${ref}`, "success");
  return true;
}

/** Fetches the current view again: whatever was pushed since. */
export async function reloadTeamView(): Promise<boolean> {
  const view = get(teamView);
  if (!view) return false;
  if (view.pair === null) return showTeamView(view.ref, view.files, null, view.links);
  // A pair is looked up again, so files and links pushed since come too.
  try {
    const { files, links } = await resolveTeamLink({ ref: view.ref, files: [], pair: view.pair });
    return showTeamView(view.ref, files, view.pair, links);
  } catch (error) {
    showToast((error as Error).message, "error");
    return false;
  }
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
  let resolved: { files: string[]; links: PairLink[] };
  try {
    resolved = await resolveTeamLink(link);
  } catch (error) {
    showToast((error as Error).message, "error");
    return;
  }
  await showTeamView(link.ref, resolved.files, link.pair, resolved.links);
}

/**
 * One robot of the pair open in the Auto editor, the others playing alongside as ghosts:
 * `files` is the pair's browser copies (to go back to), `editing` the one in the editor.
 */
export interface TandemEdit {
  files: string[];
  editing: string;
}

export const tandemEdit = writable<TandemEdit | null>(null);

/** A file from disk (another team's, say) added to the pair as a partner: its browser copy. */
export async function addPartnerFile(name: string, text: string): Promise<boolean> {
  let project: Record<string, unknown>;
  try {
    project = JSON.parse(text);
  } catch {
    showToast(`${name} is not a readable .pp file.`, "error");
    return false;
  }
  if (!project || typeof project !== "object" || !project.startPoint || !Array.isArray(project.lines)) {
    showToast(`${name} does not contain a path project.`, "error");
    return false;
  }
  const current = get(activePaths);
  const copy = `${PARTNER_PREFIX}${name.slice(name.lastIndexOf("/") + 1)}`;
  if (!current.includes(copy) && current.length >= MAX_FILES) {
    showToast(`At most ${MAX_FILES} robots at once.`, "warning");
    return false;
  }
  await browserFileStore.writeFile(copy, text);
  autoMode.set(false);
  // Written again, so the list reloads even when this partner was already shown.
  activePaths.set([...current.filter((f) => f !== copy), copy]);
  showToast(`Added ${name} as a partner`, "success");
  return true;
}

/** Prefix of the browser copy of a partner file added from disk. */
export const PARTNER_PREFIX = "disk-";
