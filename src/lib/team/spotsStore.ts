/**
 * The team's spots in this browser (lib/team/teamSpots.ts): the list as biobuzz master has it,
 * the changes made here and not saved yet, and which spots are unlocked for moving.
 *
 * Every spot starts locked: an end linked to it snaps back when dragged. Unlocking one lets its
 * ends move it; the move is a change here until "Save team spots" writes it to biobuzz, with every
 * Auto that uses it. Unsaved changes survive a reload; which spots are unlocked does not.
 */
import { derived, get, writable } from "svelte/store";
import type { NamedPoint } from "../auto/types";
import { repoSpotsText } from "../repo/repoStore";
import {
  loadTeamSpots,
  parseTeamSpots,
  samePose,
  type TeamSpots,
} from "./teamSpots";

const EDITS_KEY = "biobuzz-team-spot-edits";

/** The list on biobuzz master, once read. */
export const savedSpots = writable<TeamSpots>({});
/** "loading", "ok", or why the list could not be read. */
export const spotsStatus = writable<string>("loading");
/** Where the list came from: GitHub, or the checkout on this laptop when GitHub was out of reach. */
export const spotsFrom = writable<"github" | "folder" | null>(null);
/** Changes made here, by name: a new or moved spot. */
export const spotEdits = writable<TeamSpots>(readEdits());
/** Whether the Save team spots dialog is open (it lives with the app's dialogs). */
export const saveSpotsOpen = writable(false);
/** Spots unlocked for moving, by name. */
export const unlockedSpots = writable<ReadonlySet<string>>(new Set());

/** The list as this browser sees it: master, with the changes made here. */
export const teamSpots = derived(
  [savedSpots, spotEdits],
  ([saved, edits]) => ({ ...saved, ...edits }) as TeamSpots,
);

spotEdits.subscribe((edits) => {
  try {
    if (Object.keys(edits).length)
      localStorage.setItem(EDITS_KEY, JSON.stringify(edits));
    else localStorage.removeItem(EDITS_KEY);
  } catch {
    // A private window: the changes last until the tab closes.
  }
});

/**
 * Reads the list from biobuzz master; with GitHub out of reach, from the checkout this browser
 * was given (lib/repo), if it may read it. Changes made here that the list now has are dropped.
 */
export async function refreshTeamSpots(): Promise<void> {
  spotsStatus.set("loading");
  let spots: TeamSpots;
  try {
    spots = await loadTeamSpots();
    spotsFrom.set("github");
  } catch (error) {
    const fromFolder = await folderSpots();
    if (!fromFolder) {
      spotsFrom.set(null);
      spotsStatus.set(
        `Could not read the team's spots from GitHub (${error instanceof Error ? error.message : String(error)}): a school network may block raw.githubusercontent.com.`,
      );
      return;
    }
    spots = fromFolder;
    spotsFrom.set("folder");
  }
  savedSpots.set(spots);
  spotEdits.update((edits) => {
    const left = Object.fromEntries(
      Object.entries(edits).filter(
        ([name, pose]) => !samePose(spots[name], pose),
      ),
    );
    return Object.keys(left).length === Object.keys(edits).length
      ? edits
      : left;
  });
  spotsStatus.set("ok");
}

/** The checkout's spots.json, parsed, when the folder is there and allowed; else null. */
async function folderSpots(): Promise<TeamSpots | null> {
  const text = await repoSpotsText();
  if (text === null) return null;
  const parsed = parseTeamSpots(text);
  return parsed.ok ? parsed.spots : null;
}

/** Adds or moves a spot here (not saved until "Save team spots"). */
export function editSpot(name: string, pose: NamedPoint): void {
  const saved = get(savedSpots)[name];
  spotEdits.update((edits) => {
    const next = { ...edits };
    if (samePose(saved, pose)) delete next[name];
    else next[name] = [pose[0], pose[1], pose[2] ?? 0];
    return next;
  });
}

/** Drops the changes made here, and locks every spot, so each Auto's copies go back too. */
export function discardSpotEdits(): void {
  unlockedSpots.set(new Set());
  spotEdits.set({});
}

export function setSpotUnlocked(name: string, unlocked: boolean): void {
  unlockedSpots.update((set) => {
    const next = new Set(set);
    if (unlocked) next.add(name);
    else next.delete(name);
    return next;
  });
}

function readEdits(): TeamSpots {
  try {
    const raw = localStorage.getItem(EDITS_KEY);
    return raw ? (JSON.parse(raw) as TeamSpots) : {};
  } catch {
    return {};
  }
}
