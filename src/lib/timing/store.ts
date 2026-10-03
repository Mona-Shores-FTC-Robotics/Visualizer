/**
 * The preview's timing: on or off, the team's facts from biobuzz `TeamCode/autos/timing.json`, and
 * this laptop's own changes to them (kept in the browser until copied into the team's file).
 */
import { derived, get, writable } from "svelte/store";
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
const MODE_KEY = "previewTimingMode";
const OVERRIDES_KEY = "previewTimingOverrides";
/** The Team Autos dialog's remembered branch. */
const BRANCH_KEY = "teamAutosRef";

export type TimingMode = "typical" | "instant";

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
    const raw = JSON.parse(read(OVERRIDES_KEY) ?? "{}");
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

/** "typical": waits end when they typically would; "instant": every ✓ is true at once. */
export const timingMode = writable<TimingMode>(
  read(MODE_KEY) === "instant" ? "instant" : "typical",
);
timingMode.subscribe((mode) => write(MODE_KEY, mode));

/** The team's facts and the branch they came from; null until loaded or if the branch has none. */
export const teamTiming = writable<{ ref: string; file: TimingFile } | null>(
  null,
);

/** This laptop's changes, by fact id. */
export const timingOverrides = writable<TimingValues>(savedOverrides());
timingOverrides.subscribe((values) =>
  write(OVERRIDES_KEY, JSON.stringify(values)),
);

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
    const text = await getText(teamRawUrl(ref, TIMING_FILE));
    teamTiming.set(text === null ? null : { ref, file: parseTimingFile(text) });
    return null;
  } catch (error) {
    return `Could not read ${TIMING_FILE} on ${ref}: ${(error as Error).message}`;
  }
}

export function setOverride(id: string, value: number | null) {
  const next = { ...get(timingOverrides) };
  if (value === null) delete next[id];
  else next[id] = value;
  timingOverrides.set(next);
}
