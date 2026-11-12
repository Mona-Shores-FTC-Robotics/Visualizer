/**
 * The preview's timing: on or off, the team's facts from biobuzz `TeamCode/autos/timing.json`, and
 * this laptop's own changes to them (kept in the browser until copied into the team's file).
 */
import { derived, get, writable } from "svelte/store";
import { repoFolder } from "../repo/repoStore";
import {
  DEFAULT_REF,
  fetchText,
  teamRawUrl,
  type FetchText,
} from "../team/teamAutos";
import {
  FACTS,
  cleanValue,
  fallbackValues,
  parseTimingFile,
  type TimingFile,
  type TimingValues,
} from "./model";

export const TIMING_FILE = "timing.json";
const OVERRIDES_KEY = "previewTimingOverrides";
let overridesKey = OVERRIDES_KEY;
/** The Team Autos dialog's remembered branch. */
const BRANCH_KEY = "teamAutosRef";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private window: not remembered */
  }
}

function savedOverrides(): TimingValues {
  try {
    const raw = JSON.parse(read(overridesKey) ?? "{}");
    const out: TimingValues = {};
    for (const fact of FACTS) {
      const value = cleanValue(fact, raw?.[fact.id]);
      if (value !== null) out[fact.id] = value;
    }
    return out;
  } catch {
    return {};
  }
}

// Fork: there is one timing, the team's facts. "Instant" (every trigger true at once) is gone:
// it hid the match view and was remembered across reloads.
try {
  localStorage.removeItem("previewTimingMode");
} catch {
  // No storage: nothing was remembered.
}

/** The team's facts and the branch they came from; null until loaded or if the branch has none. */
export const teamTiming = writable<{ ref: string; file: TimingFile } | null>(
  null,
);

/** This laptop's changes, by fact id. */
export const timingOverrides = writable<TimingValues>(savedOverrides());
timingOverrides.subscribe((values) =>
  write(overridesKey, JSON.stringify(values)),
);
repoFolder.subscribe((folder) => {
  const key = folder
    ? `${OVERRIDES_KEY}:${folder.id}:${folder.branch ?? "unknown"}`
    : OVERRIDES_KEY;
  if (key === overridesKey) return;
  overridesKey = key;
  timingOverrides.set(savedOverrides());
  teamTiming.set(null);
});

/** The values the preview uses: the simulator's, then the team's, then this laptop's. */
export const timingValues = derived(
  [teamTiming, timingOverrides],
  ([team, overrides]) => {
    const values = fallbackValues();
    for (const [id, fact] of Object.entries(team?.file.facts ?? {}))
      values[id] = fact.value;
    return { ...values, ...overrides };
  },
);

/** The branch the team's file is read from: the one Team Autos last listed. */
export function timingBranch(): string {
  return read(BRANCH_KEY) || DEFAULT_REF;
}

/** Fetches the team's timing.json; returns an error message, or null when it loaded (or is absent). */
export async function loadTeamTiming(
  ref = timingBranch(),
  getText: FetchText = fetchText,
): Promise<string | null> {
  try {
    const checkout = get(repoFolder);
    if (checkout) {
      if (checkout.permission !== "granted")
        throw new Error("Allow the checkout to read its timing facts.");
      const text = await checkout.folder.readText(
        `TeamCode/autos/${TIMING_FILE}`,
      );
      if (
        get(repoFolder)?.id !== checkout.id ||
        get(repoFolder)?.branch !== checkout.branch
      )
        return null;
      teamTiming.set(
        text === null
          ? null
          : {
              ref: `${checkout.name} · ${checkout.branch ?? "branch unavailable"}`,
              file: parseTimingFile(text),
            },
      );
      return null;
    }
    const text = await getText(teamRawUrl(ref, TIMING_FILE));
    if (get(repoFolder)) return null;
    teamTiming.set(text === null ? null : { ref, file: parseTimingFile(text) });
    return null;
  } catch (error) {
    return `Could not read ${TIMING_FILE} on ${ref}: ${(error as Error).message}`;
  }
}

/**
 * A team link's own timing: the facts on the branch its drawings came from, so a branch that
 * previews at different values (a study's what-if) shows them. A checkout's file still wins, and a
 * branch without the file, or one that cannot be read, leaves the facts as they are.
 */
export async function loadTeamTimingFor(
  ref: string,
  getText: FetchText = fetchText,
): Promise<void> {
  if (get(repoFolder)) return;
  try {
    const text = await getText(teamRawUrl(ref, TIMING_FILE));
    if (text === null || get(repoFolder)) return;
    teamTiming.set({ ref, file: parseTimingFile(text) });
  } catch {
    /* the facts already loaded stay */
  }
}

export function setOverride(id: string, value: number | null) {
  const next = { ...get(timingOverrides) };
  if (value === null) delete next[id];
  else next[id] = value;
  timingOverrides.set(next);
}
