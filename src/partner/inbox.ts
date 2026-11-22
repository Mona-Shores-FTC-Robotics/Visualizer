/**
 * The inbox: a partner online sends us their Auto through a Google Form (share.html's "Send to
 * Mona Shores"), and the planning page reads the form's published response sheet back as CSV.
 *
 * The form asks only for a team number and the Auto's link (the one the QR code holds). Both are
 * public by design. Anyone can submit the form, so every row is untrusted: a row counts only when
 * its team number is a number and its link is our own planning link with a partner's Auto in it,
 * and what the page keeps of it is that Auto read and written again by our own code (`parseState`
 * then `stateHash`), never the row's text. Nothing from a row is ever put in as HTML.
 */
import { timeoutSignal } from "../lib/timeoutSignal";
import { parseState, stateHash } from "./load";

/** The form, pre-filled: Team Number and Auto Link. */
const FORM =
  "https://docs.google.com/forms/d/e/1FAIpQLSfVC3cvg-UW4qLBcPC3HufUKP9LTTeLcwltSwo6pkPAhGrW0g/viewform";
const TEAM_ENTRY = "entry.1253318350";
const LINK_ENTRY = "entry.1690950498";

/** The form's responses, published as CSV (Timestamp, Team Number, Auto Link). */
export const INBOX_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRrLe9mD6MI5BHqsEcxh0bRigBpxkq7Pe3PW4VdEVbJfZMJqvzFTn0jEh7z479TkvqjmxqwvNRebzjs/pub?gid=223926015&single=true&output=csv";

/** Where the site lives; a link from it counts on any copy of the planning page. */
const SITE = "https://mona-shores-ftc-robotics.github.io";

/** How long the sheet may take before it counts as no answer, ms. */
export const INBOX_TIMEOUT_MS = 8000;
/** The most rows the inbox lists: the newest. */
export const INBOX_MAX = 40;

/** The form, with the partner's team number and their Auto's link filled in. */
export function formLink(team: number, link: string): string {
  const params = new URLSearchParams({
    usp: "pp_url",
    [TEAM_ENTRY]: String(team),
    [LINK_ENTRY]: link,
  });
  return `${FORM}?${params}`;
}

/** CSV rows (RFC 4180: quoted fields, doubled quotes, line breaks inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export interface InboxEntry {
  team: number;
  /** When it was sent, as a time (ms), or null when the sheet's timestamp is unreadable. */
  time: number | null;
  /** The planning page's fragment for it, written by our own code. */
  hash: string;
  /** The Auto's name as they gave it (text only). */
  name: string;
}

/** Google's "11/22/2026 14:03:05" (the sheet's US locale), or an ISO time. */
export function parseTimestamp(text: string): number | null {
  const m =
    /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/.exec(
      text,
    );
  if (m) {
    const [, mo, d, y, h, mi, s] = m.map(Number);
    const t = new Date(y, mo - 1, d, h, mi, s || 0).getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:?\d{2})?$/.test(text.trim())) {
    const t = Date.parse(text.trim());
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

/**
 * A row's Auto link as our planning page's fragment, or null when it is not one: it must be a
 * `partner.html` link on this site (or the one the page is on), and carry a partner's Auto.
 */
export function inboxHash(
  link: string,
  team: number,
  here: string = SITE,
): string | null {
  if (link.length > 4000) return null;
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  const origins = new Set([SITE, new URL(here).origin]);
  if (!origins.has(url.origin) || !/\/partner\.html$/.test(url.pathname))
    return null;
  const state = parseState(url.hash);
  if (!state.partner) return null;
  return stateHash({
    ours: state.ours,
    partner: state.partner,
    alliance: state.alliance,
    off: state.off,
    miss: [],
    event: null,
    team,
    match: null,
  });
}

/** The sheet's rows that are a partner's Auto, newest first; every other row is left out. */
export function readInbox(csv: string, here: string = SITE): InboxEntry[] {
  const rows = parseCsv(csv);
  const header = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
  const col = (name: string, fallback: number) => {
    const i = header.indexOf(name);
    return i >= 0 ? i : fallback;
  };
  const timeCol = col("timestamp", 0);
  const teamCol = col("team number", 1);
  const linkCol = col("auto link", 2);
  const entries: (InboxEntry & { row: number })[] = [];
  rows.slice(1).forEach((r, row) => {
    const teamText = (r[teamCol] ?? "").trim();
    if (!/^\d{1,5}$/.test(teamText)) return;
    const team = Number(teamText);
    if (team < 1) return;
    const hash = inboxHash(r[linkCol] ?? "", team, here);
    if (!hash) return;
    const name = parseState(hash).partner?.name ?? "";
    entries.push({
      team,
      time: parseTimestamp(r[timeCol] ?? ""),
      hash,
      name,
      row,
    });
  });
  entries.sort(
    (a, b) => (b.time ?? -Infinity) - (a.time ?? -Infinity) || b.row - a.row,
  );
  return entries
    .slice(0, INBOX_MAX)
    .map(({ team, time, hash, name }) => ({ team, time, hash, name }));
}

/** The sheet's CSV; throws a message that says why when it cannot be read. */
export async function fetchInbox(url: string = INBOX_CSV): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-cache",
      signal: timeoutSignal(INBOX_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(
      error instanceof DOMException && error.name === "TimeoutError"
        ? `No answer from Google in ${INBOX_TIMEOUT_MS / 1000} s.`
        : "Could not reach Google (no internet here?).",
      { cause: error },
    );
  }
  if (!response.ok) throw new Error(`Google answered ${response.status}.`);
  return response.text();
}
