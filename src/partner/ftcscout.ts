/**
 * Our events and matches, from FTCScout (https://ftcscout.org), for the partner page's match menu.
 * Its GraphQL API allows calls from the Visualizer's own site, so no server is needed. Read only.
 */

import { timeoutSignal } from "../lib/timeoutSignal";

export const OUR_TEAMS = [19429, 20245] as const;
const GRAPHQL = "https://api.ftcscout.org/graphql";
const TIMEOUT_MS = 10000;

/** The FTC season a date is in: it starts at kickoff in September (2026 is the 2026–27 season). */
export function seasonOf(date: Date): number {
  return date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1;
}

export interface ScoutEvent {
  code: string;
  name: string;
  /** "2026-11-20" */
  start: string;
  end: string;
}

export interface ScoutTeam {
  number: number;
  name: string;
}

/** One match one of our teams plays in. */
export interface OurMatch {
  /** "Q12"; a playoff match by its bracket number, "P3" (a later game of it "P10-2"). */
  key: string;
  level: "Quals" | "Playoffs";
  number: number;
  /** The game within a playoff match (1, or 2 and 3 in a final); 1 for a qual. */
  game: number;
  /** Which of our teams plays it. */
  us: number;
  alliance: "red" | "blue";
  /** Our alliance partner, or null when the schedule has none (a surrogate slot not filled yet). */
  partner: number | null;
  /** ISO time, or null. */
  scheduled: string | null;
}

export interface EventInfo {
  event: ScoutEvent;
  teams: ScoutTeam[];
  matches: OurMatch[];
}

async function query<T>(text: string, variables: object): Promise<T> {
  let response: Response;
  try {
    response = await fetch(GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: text, variables }),
      signal: timeoutSignal(TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(
      error instanceof DOMException && error.name === "TimeoutError"
        ? `No answer from FTCScout in ${TIMEOUT_MS / 1000} s. Is this device online?`
        : `Could not reach FTCScout (${error instanceof Error ? error.message : String(error)})`,
      { cause: error },
    );
  }
  if (!response.ok) throw new Error(`FTCScout answered ${response.status}`);
  const body = await response.json();
  if (body.errors?.length)
    throw new Error(`FTCScout: ${body.errors[0].message ?? "error"}`);
  return body.data as T;
}

/** Our two teams' events this season, earliest first, each once. */
export async function ourEvents(season: number): Promise<ScoutEvent[]> {
  const data = await query<
    Record<string, { events: { event: ScoutEvent }[] } | null>
  >(
    `query($season: Int!) {
      ${OUR_TEAMS.map(
        (n) =>
          `t${n}: teamByNumber(number: ${n}) { events(season: $season) { event { code name start end } } }`,
      ).join("\n")}
    }`,
    { season },
  );
  const byCode = new Map<string, ScoutEvent>();
  for (const team of Object.values(data))
    for (const { event } of team?.events ?? []) byCode.set(event.code, event);
  return [...byCode.values()].sort((a, b) => a.start.localeCompare(b.start));
}

/** The event to open first: the one on now, else the next, else the last. */
export function currentEvent(
  events: ScoutEvent[],
  today: string,
): ScoutEvent | null {
  return (
    events.find((e) => e.start <= today && today <= e.end) ??
    events.find((e) => e.start > today) ??
    events[events.length - 1] ??
    null
  );
}

interface RawMatch {
  matchNum: number;
  series: number;
  tournamentLevel: string;
  scheduledStartTime: string | null;
  teams: { alliance: string; station: string; teamNumber: number }[];
}

/** Our matches in an event's schedule, in order. */
export function ourMatches(matches: RawMatch[]): OurMatch[] {
  const out: OurMatch[] = [];
  for (const m of matches) {
    const level = m.tournamentLevel === "Quals" ? "Quals" : "Playoffs";
    for (const us of OUR_TEAMS) {
      const mine = m.teams.find((t) => t.teamNumber === us);
      if (!mine) continue;
      const partner = m.teams.find(
        (t) => t.alliance === mine.alliance && t.teamNumber !== us,
      );
      // A playoff's `series` is its bracket match; `matchNum` the game within it.
      const quals = level === "Quals";
      const number = quals ? m.matchNum : m.series;
      const game = quals ? 1 : m.matchNum;
      out.push({
        key: quals ? `Q${number}` : `P${number}${game > 1 ? `-${game}` : ""}`,
        level,
        number,
        game,
        us,
        alliance: mine.alliance === "Blue" ? "blue" : "red",
        partner: partner?.teamNumber ?? null,
        scheduled: m.scheduledStartTime,
      });
    }
  }
  return out.sort(
    (a, b) =>
      (a.level === b.level ? 0 : a.level === "Quals" ? -1 : 1) ||
      a.number - b.number ||
      a.game - b.game,
  );
}

/** An event's name, teams and our matches in it (none until its schedule is posted). */
export async function eventInfo(
  season: number,
  code: string,
): Promise<EventInfo> {
  const data = await query<{
    eventByCode:
      | (ScoutEvent & {
          teams: { teamNumber: number; team: { name: string } | null }[];
          matches: RawMatch[];
        })
      | null;
  }>(
    `query($season: Int!, $code: String!) {
      eventByCode(season: $season, code: $code) {
        code name start end
        teams { teamNumber team { name } }
        matches { matchNum series tournamentLevel scheduledStartTime
          teams { alliance station teamNumber } }
      }
    }`,
    { season, code },
  );
  const e = data.eventByCode;
  if (!e) throw new Error(`FTCScout has no event ${code}.`);
  return {
    event: { code: e.code, name: e.name, start: e.start, end: e.end },
    teams: e.teams
      .map((t) => ({ number: t.teamNumber, name: t.team?.name ?? "" }))
      .sort((a, b) => a.number - b.number),
    matches: ourMatches(e.matches),
  };
}
