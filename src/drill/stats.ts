/**
 * The team's drill stats: every finished run goes to a shared Google Sheet as one row, with who
 * drove it, so the drivers' progress can be tracked across laptops. The site has no server, so the
 * sheet has a small Google Apps Script web app that appends each row it is sent
 * (docs/drill-stats.md has the script and the setup).
 *
 * The web app's URL is TEAM_SHEET_URL below, for every laptop; a laptop can also be pointed at one by
 * opening the drill with ?stats=<url> once (kept in this browser). Rows go as a text/plain POST in
 * no-cors mode, the one way a static page can post to Apps Script; the reply can't be read, so a row
 * counts as sent once the request has gone. A row that could not go (offline, or no sheet yet) waits
 * in this browser's outbox and goes with the next run, or with "Send saved runs".
 */
import type { RunResult } from "./session";
import type { StoredRun } from "./history";
import { fullPickUps } from "./readout";

/**
 * The team sheet's Apps Script web app (docs/drill-stats.md), deployed by the mentor on 26 Nov 2026
 * on the "Team Sim Stats" sheet: every laptop sends there without setup of its own. A browser opened
 * once with ?stats=<url> sends there instead.
 */
export const TEAM_SHEET_URL =
  "https://script.google.com/macros/s/AKfycbylLNjsB6fiHWqVCy4tHg4skzxZxdLznO9bHhfmqxGKYCNpiETJg2ZHkWhio6C5Bgd_7A/exec";

const URL_KEY = "biobuzz-drill-stats-url";
const OUTBOX_KEY = "biobuzz-drill-stats-outbox";
const SENT_KEY = "biobuzz-drill-stats-sent";
const PEOPLE_KEY = "biobuzz-drill-people";
const LAPTOP_KEY = "biobuzz-drill-laptop";

/** One row of the sheet. The Apps Script writes the columns in this order (ROW_COLUMNS). */
export interface StatsRow {
  id: string;
  date: string;
  driver: string;
  operator: string;
  robot: string;
  players: string;
  match: string;
  field: string;
  intake: string;
  cornerWheels: string;
  totalTips: number;
  autoTips: number | "";
  teleopTips: number | "";
  reached7: string;
  seventhAtS: number | "";
  balls: number;
  cycles: number;
  bestCycleS: number | "";
  medianCycleS: number | "";
  bestPickUpS: number | "";
  nectarEntered: number | "";
  opponentsTips: number | "";
  laptop: string;
  source: string;
}

/** The sheet's columns, in order: the Apps Script's header row. */
export const ROW_COLUMNS: (keyof StatsRow)[] = [
  "id",
  "date",
  "driver",
  "operator",
  "robot",
  "players",
  "match",
  "field",
  "intake",
  "cornerWheels",
  "totalTips",
  "autoTips",
  "teleopTips",
  "reached7",
  "seventhAtS",
  "balls",
  "cycles",
  "bestCycleS",
  "medianCycleS",
  "bestPickUpS",
  "nectarEntered",
  "opponentsTips",
  "laptop",
  "source",
];

const r1 = (v: number | null | undefined): number | "" =>
  v == null || !Number.isFinite(v) ? "" : Math.round(v * 10) / 10;

const PLAYERS: Record<string, string> = {
  two: "driver + operator",
  driver: "driver only",
  alliance: "alliance, drivers",
  "alliance-ops": "alliance, drivers + operators",
};

/** A finished run as a sheet row. */
export function rowFromRun(
  r: RunResult,
  who: { driver: string; operator: string },
  laptop = laptopId(),
): StatsRow {
  const c = r.cycles.map((x) => x.cycleS).sort((a, b) => a - b);
  // Full pick-ups only (readout.ts fullPickUps); "" when the run had none.
  const p = fullPickUps(r.pickUps);
  const autoTips = (r.auto?.tips ?? 0) + (r.openingTips ?? 0);
  const total = r.tips + autoTips;
  return {
    id: runId(r.date, laptop),
    date: r.date,
    driver: who.driver.trim(),
    operator: who.operator.trim(),
    robot: r.robots.map((x) => x.team).join(" + "),
    players: PLAYERS[r.mode] ?? r.mode,
    match: r.auto
      ? `full match: ${r.auto.name}`
      : r.openingAuto
        ? `2:00 from ${r.openingAuto} (${r.openingTips ?? 0} TIP${r.openingTips === 1 ? "" : "s"}${r.openingCell ? `, ${r.openingCell} in CELL` : ""})`
        : r.openingTips
          ? `2:00 after a ${r.openingTips}-TIP Auto`
          : "2:00",
    field: r.opponents
      ? `match: opponents skill ${r.opponents.skill}`
      : "empty",
    intake: r.pollenOnly ? "POLLEN only" : "colour gate",
    cornerWheels: r.cornerWheels ? "on" : "off",
    totalTips: total,
    autoTips,
    teleopTips: r.tips,
    reached7: total >= r.goal ? "yes" : "no",
    seventhAtS: r1(r.goalAtS),
    balls: r.balls,
    cycles: c.length,
    bestCycleS: r1(c[0]),
    medianCycleS: r1(c[Math.floor(c.length / 2)]),
    bestPickUpS: r1(p.length ? Math.min(...p) : null),
    nectarEntered: r.nectarEntered,
    opponentsTips: r.opponents ? r.opponents.tips : "",
    laptop,
    source: "drill",
  };
}

/** A run saved on this laptop before names were asked: a row with what it kept. */
export function rowFromStored(s: StoredRun, laptop = laptopId()): StatsRow {
  return {
    id: runId(s.date, laptop),
    date: s.date,
    driver: s.driver ?? "",
    operator: s.operator ?? "",
    robot: (s.teams ?? [s.team]).join(" + "),
    players: PLAYERS[s.mode] ?? s.mode,
    match: s.auto ? `full match: ${s.auto}` : "2:00",
    field: "",
    intake: "",
    cornerWheels: "",
    totalTips: s.tips,
    autoTips: "",
    teleopTips: "",
    reached7: s.goalAtS != null ? "yes" : "no",
    seventhAtS: r1(s.goalAtS),
    balls: s.balls,
    cycles: s.cycles,
    bestCycleS: r1(s.bestCycleS),
    medianCycleS: r1(s.medianCycleS),
    bestPickUpS: r1(s.bestPickUpS),
    nectarEntered: "",
    opponentsTips: "",
    laptop,
    source: "saved on this laptop",
  };
}

/** The same run always gets the same id, so the sheet can drop a row sent twice. */
export function runId(date: string, laptop: string): string {
  return `${laptop}-${date}`;
}

// ---------- this browser's storage (every read and write guarded) ----------

function store(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
function read<T>(key: string, fallback: T, s = store()): T {
  try {
    const v = s?.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown, s = store()): void {
  try {
    s?.setItem(key, JSON.stringify(value));
  } catch {
    /* full or blocked: the row stays in memory only */
  }
}

/** A random name for this laptop's browser, so rows from different laptops are told apart. */
export function laptopId(s = store()): string {
  let id = read<string>(LAPTOP_KEY, "", s);
  if (!id) {
    id = `laptop-${Math.random().toString(36).slice(2, 8)}`;
    write(LAPTOP_KEY, id, s);
  }
  return id;
}

/** The sheet this laptop sends to: ?stats=<url> once, else the team's. "" for none. */
export function sheetUrl(
  search = typeof location === "undefined" ? "" : location.search,
  s = store(),
): string {
  const fromPage = new URLSearchParams(search).get("stats");
  if (fromPage !== null) write(URL_KEY, fromPage, s);
  const url = read<string>(URL_KEY, "", s) || TEAM_SHEET_URL;
  return /^https:\/\/script\.google(usercontent)?\.com\//.test(url) ? url : "";
}

/** The names typed on this laptop, most recent first, and the last driver and operator. */
export interface People {
  names: string[];
  driver: string;
  operator: string;
}
export function loadPeople(s = store()): People {
  return read<People>(PEOPLE_KEY, { names: [], driver: "", operator: "" }, s);
}
export function savePeople(driver: string, operator: string, s = store()) {
  const p = loadPeople(s);
  const names = [driver, operator, ...p.names]
    .map((n) => n.trim())
    .filter((n, i, all) => n && all.indexOf(n) === i)
    .slice(0, 20);
  write(
    PEOPLE_KEY,
    { names, driver: driver.trim(), operator: operator.trim() },
    s,
  );
}

/** Ids already sent from this laptop. */
function sentIds(s = store()): Set<string> {
  return new Set(read<string[]>(SENT_KEY, [], s));
}
function markSent(ids: string[], s = store()) {
  const all = [...sentIds(s), ...ids].slice(-2000);
  write(SENT_KEY, all, s);
}

export function outbox(s = store()): StatsRow[] {
  return read<StatsRow[]>(OUTBOX_KEY, [], s);
}

/**
 * Sends `rows` (and anything waiting in the outbox) to the sheet. Rows already sent from this laptop
 * are skipped. What could not go stays in the outbox. Resolves with how many went and how many wait.
 */
export async function sendRows(
  rows: StatsRow[],
  opts: { url?: string; fetcher?: typeof fetch; storage?: Storage | null } = {},
): Promise<{ sent: number; waiting: number; url: string }> {
  const s = opts.storage === undefined ? store() : opts.storage;
  const url = opts.url ?? sheetUrl(undefined, s);
  const done = sentIds(s);
  const queue = [...outbox(s), ...rows].filter(
    (r, i, all) => !done.has(r.id) && all.findIndex((q) => q.id === r.id) === i,
  );
  if (!url || !queue.length) {
    write(OUTBOX_KEY, queue, s);
    return { sent: 0, waiting: queue.length, url };
  }
  const fetcher = opts.fetcher ?? fetch;
  try {
    // One request with every row: the script appends them all, skipping ids it already has.
    await fetcher(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ columns: ROW_COLUMNS, rows: queue }),
    });
  } catch {
    write(OUTBOX_KEY, queue, s);
    return { sent: 0, waiting: queue.length, url };
  }
  markSent(
    queue.map((r) => r.id),
    s,
  );
  write(OUTBOX_KEY, [], s);
  return { sent: queue.length, waiting: 0, url };
}
