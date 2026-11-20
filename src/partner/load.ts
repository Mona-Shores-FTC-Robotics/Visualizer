/**
 * What the partner page reads from biobuzz master, and the link that brings a look back.
 *
 * Our Autos' list comes from GitHub's folder listing (about 60 an hour per address without a
 * login: a venue's shared Wi-Fi can use that up), so when it fails the page falls back on the files
 * below, the ones on master when this page was written, and says the list may be out of date. The
 * files themselves come from raw.githubusercontent.com, which has no such limit. The partner's
 * stand-ins are the page's own (route.ts PRESETS), not biobuzz's.
 */
import {
  DEFAULT_REF,
  fetchText,
  listTeamFiles,
  teamRawUrl,
  type FetchText,
} from "../lib/team/teamAutos";
import { TIMING_FILE } from "../lib/timing/store";
import {
  fallbackValues,
  parseTimingFile,
  type TimingValues,
} from "../lib/timing/model";
import { decodeRoute, encodeRoute, type PartnerRoute } from "./route";

export const REF = DEFAULT_REF;

/** biobuzz master's Autos on 20 Nov 2026: used only when GitHub will not list them. */
export const FALLBACK_AUTOS = [
  "l-clockwise.pp",
  "l-left-under-hive.pp",
  "l-no-cross.pp",
  "r-clockwise.pp",
  "r-left-under-hive.pp",
  "r-no-cross.pp",
  "r-solo.pp",
];
export interface Lists {
  autos: string[];
  /** GitHub would not list the folders: these are the fallback lists. */
  stale: boolean;
}

export async function loadLists(get: FetchText = fetchText): Promise<Lists> {
  try {
    const autos = await listTeamFiles(REF, get);
    if (autos.length) return { autos, stale: false };
  } catch {
    // Rate-limited or offline: fall back below.
  }
  return { autos: FALLBACK_AUTOS, stale: true };
}

/** A team file's text from master; throws a message naming it when it cannot be read. */
export async function loadFile(
  file: string,
  get: FetchText = fetchText,
): Promise<string> {
  const text = await get(teamRawUrl(REF, file));
  if (text === null) throw new Error(`${file} is not on biobuzz ${REF}.`);
  return text;
}

/** The team's timing facts on master, over the preview's own; the preview's own if unreadable. */
export async function loadTiming(
  get: FetchText = fetchText,
): Promise<TimingValues> {
  const values = fallbackValues();
  try {
    const text = await get(teamRawUrl(REF, TIMING_FILE));
    if (text) {
      for (const [id, fact] of Object.entries(parseTimingFile(text).facts))
        values[id] = fact.value;
    }
  } catch {
    // The preview's own facts.
  }
  return values;
}

/** "r-solo.pp" → "R-Solo". */
export function displayName(file: string): string {
  const base = file.replace(/^.*\//, "").replace(/\.pp$/, "");
  return base
    .split("-")
    .map((w) =>
      w.length <= 1 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1),
    )
    .join("-");
}

// ---- The link -----------------------------------------------------------------------------------

/** Everything a look is, as the page's link carries it. */
export interface PageState {
  ours: string | null;
  /** The partner's Auto, or null for none yet. */
  partner: PartnerRoute | null;
  alliance: "red" | "blue";
  /** Our route choices answered "no", by condition. */
  off: string[];
  /** TIPs whose first try misses. */
  miss: number[];
  /** The scouting menu: an FTCScout event code, a partner team, and one of our matches. */
  event: string | null;
  team: number | null;
  match: string | null;
}

export const EMPTY_STATE: PageState = {
  ours: null,
  partner: null,
  alliance: "red",
  off: [],
  miss: [],
  event: null,
  team: null,
  match: null,
};

const FILE = /^[A-Za-z0-9._-]+\.pp$/;

/** Reads `#ours=r-solo.pp&partner=<route>&…`; anything unreadable is left at its default. */
export function parseState(hash: string): PageState {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const file = (key: string) => {
    const v = params.get(key);
    return v && FILE.test(v) ? v : null;
  };
  const ours = file("ours");
  const code = params.get("partner");
  const partner = code ? decodeRoute(code) : null;
  const event = params.get("event") ?? "";
  const team = Number(params.get("team") ?? NaN);
  const match = params.get("match") ?? "";
  const list = (key: string) =>
    (params.get(key) ?? "").split(",").filter(Boolean);
  return {
    ours,
    partner,
    alliance: params.get("alliance") === "blue" ? "blue" : "red",
    off: list("off").filter((s) => /^[A-Za-z0-9_]+$/.test(s)),
    miss: list("miss")
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0 && n < 10),
    event: /^[A-Z0-9]{3,16}$/.test(event) ? event : null,
    team: Number.isInteger(team) && team > 0 && team < 100000 ? team : null,
    match: /^(Q\d{1,3}|P\d{1,3}(-\d)?)$/.test(match) ? match : null,
  };
}

/** The link's fragment for a look (the reverse of `parseState`). */
export function stateHash(state: PageState): string {
  const parts: string[] = [];
  if (state.event) parts.push(`event=${state.event}`);
  if (state.team) parts.push(`team=${state.team}`);
  if (state.match) parts.push(`match=${state.match}`);
  if (state.ours) parts.push(`ours=${state.ours}`);
  if (state.partner) parts.push(`partner=${encodeRoute(state.partner)}`);
  if (state.alliance === "blue") parts.push("alliance=blue");
  if (state.off.length) parts.push(`off=${state.off.join(",")}`);
  if (state.miss.length) parts.push(`miss=${state.miss.join(",")}`);
  return parts.length ? `#${parts.join("&")}` : "";
}
