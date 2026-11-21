/**
 * The team's partner plans from the pits, kept on biobuzz's `scouting` branch so everyone sees
 * everyone's and git keeps the history:
 *
 * - `scouting/<season>/<event>.json`, an event's plans: for each partner team, the ways the match
 *   could go (options: their Auto, a route.ts route, beside one of ours as set in INIT), the one the
 *   team is going with, and notes. A plan is for the team at that event, and a match may have its
 *   own, which wins in that match.
 * - `scouting/<season>/partners.json`, every team's known Autos by name, across events ("X" and
 *   "Y" for a team with two): each option's partner Auto is kept there too when it has a name, so
 *   at the next event it is one tap. An entry may carry a `note` (where it was seen).
 *
 * Reading needs no login (the raw files, which GitHub's cache may serve up to 5 minutes old; with a
 * token, the API, which is fresh). Saving needs the GitHub token the Visualizer's Save to GitHub
 * uses: a save reads the files as they are now, puts its own plan in, and commits both at once; if
 * someone else saved in between, it reads again and retries, so nobody's plan is lost. The branch
 * is made from master the first time.
 */
import { readMirror } from "../lib/team/mirror";
import {
  branchHeadOrNull,
  commitFiles,
  createBranch,
  branchHead,
  GitHubError,
  readText,
  savedToken,
  whoAmI,
} from "../lib/github/api";
import { GIT_REPO } from "../utils/gitLink";
import { cleanRoute, type PartnerRoute } from "./route";

export const SCOUTING_BRANCH = "scouting";
const BASE_BRANCH = "master";

/** One way the match could go: their Auto beside one of ours, as set in INIT. */
export interface PlanOption {
  /** What the partner does. */
  partner: PartnerRoute;
  /** Our Auto beside them (its .pp in TeamCode/autos), or null while not picked. */
  ours: string | null;
  /** Our route choices set to their other leg, by condition. */
  off: string[];
  /** Our INIT wait (InitWait), seconds on the match clock; null: as drawn. */
  ourWaitS: number | null;
}

export interface PlanRecord {
  team: number;
  /** "Q12" for a plan for that match only; null for the team's plan at this event. */
  match: string | null;
  /** The ways the match could go, to flip between (at least one). */
  options: PlanOption[];
  /** The option the team is going with (an index into `options`). */
  chosen: number;
  notes: string;
  savedBy: string;
  /** ISO time. */
  savedAt: string;
}

export interface EventPlans {
  version: 1;
  season: number;
  event: string;
  /** By record key: "11228", or "11228@Q12" for a match's own. */
  plans: Record<string, PlanRecord>;
}

export interface KnownAuto {
  route: PartnerRoute;
  /** Where it was seen, or what it is based on. */
  note?: string;
  savedBy: string;
  savedAt: string;
}

/** Every team's known Autos this season, by team number, then by the Auto's name. */
export interface PartnerLibrary {
  version: 1;
  season: number;
  teams: Record<string, Record<string, KnownAuto>>;
}

export function planKey(team: number, match: string | null): string {
  return match ? `${team}@${match}` : String(team);
}

export function plansPath(season: number, event: string): string {
  return `scouting/${season}/${event}.json`;
}

export function libraryPath(season: number): string {
  return `scouting/${season}/partners.json`;
}

export function emptyPlans(season: number, event: string): EventPlans {
  return { version: 1, season, event, plans: {} };
}

export function emptyLibrary(season: number): PartnerLibrary {
  return { version: 1, season, teams: {} };
}

const text = (v: unknown) => (typeof v === "string" ? v : "");

export function cleanOption(raw: unknown): PlanOption | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const partner = cleanRoute(o.partner);
  if (!partner) return null;
  return {
    partner,
    ours: typeof o.ours === "string" ? o.ours : null,
    off: Array.isArray(o.off)
      ? o.off.filter((s): s is string => typeof s === "string")
      : [],
    ourWaitS:
      typeof o.ourWaitS === "number" && Number.isFinite(o.ourWaitS)
        ? Math.min(30, Math.max(0, o.ourWaitS))
        : null,
  };
}

function cleanRecord(raw: unknown): PlanRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Number.isInteger(r.team)) return null;
  // A plan saved before options (one partner, one Auto of ours) reads as one option.
  const options = (Array.isArray(r.options) ? r.options : [r])
    .map(cleanOption)
    .filter((o): o is PlanOption => o !== null)
    .slice(0, 6);
  if (!options.length) return null;
  const chosen = Number.isInteger(r.chosen) ? (r.chosen as number) : 0;
  return {
    team: r.team as number,
    match: typeof r.match === "string" && r.match ? r.match : null,
    options,
    chosen: chosen >= 0 && chosen < options.length ? chosen : 0,
    notes: text(r.notes),
    savedBy: text(r.savedBy),
    savedAt: text(r.savedAt),
  };
}

/** Reads an event's file; anything unreadable in it is dropped, never fatal. */
export function parsePlans(
  json: string,
  season: number,
  event: string,
): EventPlans {
  const out = emptyPlans(season, event);
  try {
    const data = JSON.parse(json);
    for (const raw of Object.values(data?.plans ?? {})) {
      const record = cleanRecord(raw);
      if (record) out.plans[planKey(record.team, record.match)] = record;
    }
  } catch {
    // An unreadable file reads as no plans.
  }
  return out;
}

/** Reads the known Autos; anything unreadable in it is dropped, never fatal. */
export function parseLibrary(json: string, season: number): PartnerLibrary {
  const out = emptyLibrary(season);
  try {
    const data = JSON.parse(json);
    for (const [team, autos] of Object.entries(data?.teams ?? {})) {
      if (!/^\d+$/.test(team) || !autos || typeof autos !== "object") continue;
      for (const [name, raw] of Object.entries(autos as object)) {
        const known = raw as Record<string, unknown>;
        const route = cleanRoute(known?.route);
        if (!route) continue;
        (out.teams[team] ??= {})[name] = {
          route: { ...route, name },
          ...(typeof known.note === "string" && known.note
            ? { note: known.note }
            : {}),
          savedBy: text(known.savedBy),
          savedAt: text(known.savedAt),
        };
      }
    }
  } catch {
    // An unreadable file reads as no known Autos.
  }
  return out;
}

const sortedKeys = <T>(o: Record<string, T>) =>
  Object.fromEntries(
    Object.entries(o).sort(([a], [b]) =>
      a.localeCompare(b, "en", { numeric: true }),
    ),
  );

export function serializePlans(plans: EventPlans): string {
  return `${JSON.stringify({ ...plans, plans: sortedKeys(plans.plans) }, null, 2)}\n`;
}

export function serializeLibrary(library: PartnerLibrary): string {
  const teams = Object.fromEntries(
    Object.entries(sortedKeys(library.teams)).map(([t, autos]) => [
      t,
      sortedKeys(autos),
    ]),
  );
  return `${JSON.stringify({ ...library, teams }, null, 2)}\n`;
}

/** The plan that holds for `team` in `match`: the match's own, else the team's. */
export function planFor(
  plans: EventPlans | null,
  team: number,
  match: string | null,
): PlanRecord | null {
  if (!plans) return null;
  return (
    (match ? plans.plans[planKey(team, match)] : undefined) ??
    plans.plans[planKey(team, null)] ??
    null
  );
}

/** A team's known Autos, by name. */
export function knownAutos(
  library: PartnerLibrary | null,
  team: number,
): KnownAuto[] {
  return Object.values(library?.teams[String(team)] ?? {});
}

/** A file on the scouting branch, freshest available; null if it (or the branch) is not there. */
async function loadText(path: string): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${GIT_REPO}/${SCOUTING_BRANCH}/${path}`;
  const token = savedToken();
  if (token) {
    return readText(token, path, SCOUTING_BRANCH).catch(async (error) => {
      if (error instanceof GitHubError && error.status === 404) return null;
      if (!(error instanceof GitHubError)) {
        const mirrored = await readMirror(url, true);
        if (mirrored !== undefined) return mirrored;
      }
      throw error;
    });
  }
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-cache" });
  } catch (error) {
    // A device that reaches this site but not GitHub's file server (the pit tablets) reads the
    // site's own copy, up to half an hour old.
    const mirrored = await readMirror(url, true);
    if (mirrored !== undefined) return mirrored;
    throw new Error(
      `Could not reach GitHub (${error instanceof Error ? error.message : String(error)})`,
      { cause: error },
    );
  }
  if (response.ok) return response.text();
  if (response.status === 404) return null;
  throw new Error(`GitHub answered ${response.status}`);
}

/** An event's plans; none yet if the branch or file does not exist. */
export async function loadPlans(
  season: number,
  event: string,
): Promise<EventPlans> {
  const json = await loadText(plansPath(season, event));
  return json === null
    ? emptyPlans(season, event)
    : parsePlans(json, season, event);
}

/** Every team's known Autos this season; none yet if the branch or file does not exist. */
export async function loadLibrary(season: number): Promise<PartnerLibrary> {
  const json = await loadText(libraryPath(season));
  return json === null ? emptyLibrary(season) : parseLibrary(json, season);
}

export interface Saved {
  plans: EventPlans;
  library: PartnerLibrary;
}

/**
 * Saves one plan (or removes it, with `record` null) into the event's file on the scouting branch,
 * on top of whatever is there now; a plan's partner Auto with a name goes into the team's known
 * Autos too, in the same commit. Returns both files as saved.
 */
export async function savePlan(
  season: number,
  event: string,
  key: string,
  record: Omit<PlanRecord, "savedBy" | "savedAt"> | null,
  eventName: string,
): Promise<Saved> {
  const token = savedToken();
  if (!token) throw new Error("Connect GitHub first: paste the team's token.");
  const login = await whoAmI(token);
  const path = plansPath(season, event);
  const libPath = libraryPath(season);
  for (let attempt = 0; attempt < 4; attempt++) {
    let head = await branchHeadOrNull(token, SCOUTING_BRANCH);
    if (!head) {
      try {
        await createBranch(
          token,
          SCOUTING_BRANCH,
          await branchHead(token, BASE_BRANCH),
        );
      } catch (error) {
        // Someone else made it a moment ago: use theirs.
        if (!(error instanceof GitHubError && error.status === 422))
          throw error;
      }
      head = await branchHead(token, SCOUTING_BRANCH);
    }
    const [plansText, libText] = await Promise.all([
      readText(token, path, head),
      readText(token, libPath, head),
    ]);
    const plans = plansText
      ? parsePlans(plansText, season, event)
      : emptyPlans(season, event);
    const library = libText
      ? parseLibrary(libText, season)
      : emptyLibrary(season);
    const savedAt = new Date().toISOString();
    const files: Record<string, string> = {};
    if (record) {
      plans.plans[key] = { ...record, savedBy: login, savedAt };
      // Each option's partner Auto with a name is one of that team's known Autos.
      for (const option of record.options) {
        const name = option.partner.name.trim();
        if (!name) continue;
        const autos = (library.teams[String(record.team)] ??= {});
        autos[name] = {
          route: { ...option.partner, name },
          // Where it was seen stays with it.
          ...(autos[name]?.note ? { note: autos[name].note } : {}),
          savedBy: login,
          savedAt,
        };
        files[libPath] = serializeLibrary(library);
      }
    } else delete plans.plans[key];
    files[path] = serializePlans(plans);
    const what = record
      ? `${record.team}${record.match ? ` in ${record.match}` : ""}`
      : key;
    try {
      await commitFiles(
        token,
        SCOUTING_BRANCH,
        head,
        files,
        `Scouting ${eventName}: ${record ? "plan for" : "remove plan for"} ${what}`,
      );
      return { plans, library };
    } catch (error) {
      // The branch moved (someone else saved): read it again and retry.
      if (error instanceof GitHubError && error.status === 422) continue;
      throw error;
    }
  }
  throw new Error(
    "Others kept saving at the same moment. Try again in a few seconds.",
  );
}
