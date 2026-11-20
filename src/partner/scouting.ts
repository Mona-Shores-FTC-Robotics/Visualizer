/**
 * The team's partner plans from the pits: for each partner team at an event, what their Auto does
 * (a stand-in or a drawing) and which of our Autos we run beside it, with notes. A plan is for the
 * team at that event, and a match may have its own, which wins in that match.
 *
 * Each event's plans are one JSON file on biobuzz's `scouting` branch, `scouting/<season>/<event>.json`,
 * so everyone sees everyone's plans and git keeps the history. Reading needs no login (the raw
 * file, which GitHub's cache may serve up to 5 minutes old; with a token, the API, which is fresh).
 * Saving needs the GitHub token the Visualizer's Save to GitHub uses: a save reads the file as it
 * is now, puts its own plan in, and commits; if someone else saved in between, it reads again and
 * retries, so nobody's plan is lost. The branch is made from master the first time.
 */
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
import type { BasePoint } from "../types";

export const SCOUTING_BRANCH = "scouting";
const BASE_BRANCH = "master";

/** What the partner does, as the page draws it. Field inches, red's frame. */
export type PartnerPlan =
  | { kind: "standin"; file: string }
  | {
      kind: "drawn";
      points: [number, number][];
      startS: number;
      shoots: boolean;
    };

export interface PlanRecord {
  team: number;
  /** "Q12" for a plan for that match only; null for the team's plan at this event. */
  match: string | null;
  /** Our Auto beside them (its .pp in TeamCode/autos). */
  ours: string | null;
  /** Our route choices set to their other leg, by condition. */
  off: string[];
  partner: PartnerPlan | null;
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

export function planKey(team: number, match: string | null): string {
  return match ? `${team}@${match}` : String(team);
}

export function plansPath(season: number, event: string): string {
  return `scouting/${season}/${event}.json`;
}

export function emptyPlans(season: number, event: string): EventPlans {
  return { version: 1, season, event, plans: {} };
}

const round = (n: number) => Math.round(n * 10) / 10;

/** A drawing as a plan keeps it: start first, a tenth of an inch. */
export function drawnPlan(
  points: BasePoint[],
  startS: number,
  shoots: boolean,
): PartnerPlan {
  return {
    kind: "drawn",
    points: points.map((p) => [round(p.x), round(p.y)]),
    startS: round(startS),
    shoots,
  };
}

function cleanRecord(raw: unknown): PlanRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Number.isInteger(r.team)) return null;
  let partner: PartnerPlan | null = null;
  const p = r.partner as Record<string, unknown> | null;
  if (p?.kind === "standin" && typeof p.file === "string")
    partner = { kind: "standin", file: p.file };
  else if (
    p?.kind === "drawn" &&
    Array.isArray(p.points) &&
    p.points.length > 0 &&
    p.points.every(
      (q) =>
        Array.isArray(q) &&
        q.length === 2 &&
        q.every((n) => typeof n === "number" && Number.isFinite(n)),
    )
  )
    partner = {
      kind: "drawn",
      points: p.points as [number, number][],
      startS: typeof p.startS === "number" ? p.startS : 0,
      shoots: p.shoots === true,
    };
  return {
    team: r.team as number,
    match: typeof r.match === "string" && r.match ? r.match : null,
    ours: typeof r.ours === "string" ? r.ours : null,
    off: Array.isArray(r.off)
      ? r.off.filter((s): s is string => typeof s === "string")
      : [],
    partner,
    notes: typeof r.notes === "string" ? r.notes : "",
    savedBy: typeof r.savedBy === "string" ? r.savedBy : "",
    savedAt: typeof r.savedAt === "string" ? r.savedAt : "",
  };
}

/** Reads an event's file; anything unreadable in it is dropped, never fatal. */
export function parsePlans(
  text: string,
  season: number,
  event: string,
): EventPlans {
  const out = emptyPlans(season, event);
  try {
    const data = JSON.parse(text);
    for (const raw of Object.values(data?.plans ?? {})) {
      const record = cleanRecord(raw);
      if (record) out.plans[planKey(record.team, record.match)] = record;
    }
  } catch {
    // An unreadable file reads as no plans.
  }
  return out;
}

export function serializePlans(plans: EventPlans): string {
  const sorted = Object.fromEntries(
    Object.entries(plans.plans).sort(([a], [b]) =>
      a.localeCompare(b, "en", { numeric: true }),
    ),
  );
  return `${JSON.stringify({ ...plans, plans: sorted }, null, 2)}\n`;
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

/** An event's plans, freshest available; none yet if the branch or file does not exist. */
export async function loadPlans(
  season: number,
  event: string,
): Promise<EventPlans> {
  const path = plansPath(season, event);
  const token = savedToken();
  let text: string | null = null;
  if (token) {
    text = await readText(token, path, SCOUTING_BRANCH).catch((error) => {
      if (error instanceof GitHubError && error.status === 404) return null;
      throw error;
    });
  } else {
    const url = `https://raw.githubusercontent.com/${GIT_REPO}/${SCOUTING_BRANCH}/${path}`;
    const response = await fetch(url, { cache: "no-cache" }).catch((error) => {
      throw new Error("Could not reach GitHub. Is this phone online?", {
        cause: error,
      });
    });
    if (response.ok) text = await response.text();
    else if (response.status !== 404)
      throw new Error(`GitHub answered ${response.status}`);
  }
  return text === null
    ? emptyPlans(season, event)
    : parsePlans(text, season, event);
}

/**
 * Saves one plan (or removes it, with `record` null) into the event's file on the scouting branch,
 * on top of whatever is there now. Returns the file as saved.
 */
export async function savePlan(
  season: number,
  event: string,
  key: string,
  record: Omit<PlanRecord, "savedBy" | "savedAt"> | null,
  eventName: string,
): Promise<EventPlans> {
  const token = savedToken();
  if (!token) throw new Error("Connect GitHub first: paste the team's token.");
  const login = await whoAmI(token);
  const path = plansPath(season, event);
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
    const text = await readText(token, path, head);
    const plans = text
      ? parsePlans(text, season, event)
      : emptyPlans(season, event);
    if (record)
      plans.plans[key] = {
        ...record,
        savedBy: login,
        savedAt: new Date().toISOString(),
      };
    else delete plans.plans[key];
    const what = record
      ? `${record.team}${record.match ? ` in ${record.match}` : ""}`
      : key;
    try {
      await commitFiles(
        token,
        SCOUTING_BRANCH,
        head,
        { [path]: serializePlans(plans) },
        `Scouting ${eventName}: ${record ? "plan for" : "remove plan for"} ${what}`,
      );
      return plans;
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
