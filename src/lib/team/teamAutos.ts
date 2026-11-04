/**
 * The team's Autos, straight from biobuzz: several at once, always the latest pushed.
 *
 * A team link `#team=<branch>/<a>.pp,<b>.pp` (up to 4 files, or a pair's name from
 * `pairs.json`, e.g. `#team=claude/simulator/recycle3`) fetches those files from
 * `TeamCode/autos/` on that branch (a partner stand-in from its `partners/` subfolder, or a draft from
 * `drafts/`, is named with it: `#team=master/drafts/r-solo-push.pp,partners/partner-push-start.pp`), keeps a copy of each in the browser's file list (named
 * `biobuzz-<file>`, replaced on every open, so the viewer's own files are never touched) and
 * shows them together in multi-path mode. Opening the same link again, or Reload in the
 * Team Autos dialog, picks up whatever was pushed since.
 *
 * Read only: nothing is written to GitHub. Files come from raw.githubusercontent.com and the
 * folder listing from GitHub's API, both without a login while biobuzz is public (the API
 * allows about 60 listings an hour per laptop).
 */

export const TEAM_HASH_PREFIX = "#team=";
export const TEAM_REPO = "Mona-Shores-FTC-Robotics/biobuzz";
export const TEAM_DIR = "TeamCode/autos";
/** The branch the team's Autos are on: master, where each Auto's .pp sits next to its Java. */
export const DEFAULT_REF = "master";
export const PAIRS_FILE = "pairs.json";
/** Multi-path mode shows at most this many files. */
export const MAX_FILES = 4;
/** Prefix of the copies kept in the browser's file list. */
export const COPY_PREFIX = "biobuzz-";

/**
 * The subfolders of TeamCode/autos a link may name a file in: `partners/`, the partner stand-ins
 * the simulator runs beside an Auto, and `drafts/`, Autos of ours that the robot does not run yet
 * (no OpMode). The file list ({@link listTeamFiles}) shows the folder's own files only; Team Autos
 * lists the drafts ({@link listDraftFiles}) and the stand-ins ({@link listPartnerFiles}) apart.
 */
export const TEAM_SUBDIRS = ["partners", "drafts"] as const;
/** The stand-ins' folder under {@link TEAM_DIR}. */
export const PARTNERS_DIR = "partners";
/** The drafts' folder under {@link TEAM_DIR}: Autos of ours, opened and edited like any other. */
export const DRAFTS_DIR = "drafts";

/** Whether a team file is a partner stand-in (`partners/partner-l-still.pp`), not an Auto of ours. */
export function isStandIn(file: string): boolean {
  return file.startsWith(`${PARTNERS_DIR}/`);
}

/**
 * The order to open `files` in: the project is the first, so the first Auto of ours goes first and a
 * stand-in is only ever drawn beside one. Null when every file is a stand-in (nothing of ours to
 * open); the Team Autos dialog then offers nothing to show.
 */
export function openOrder(files: string[]): string[] | null {
  const at = files.findIndex((f) => !isStandIn(f));
  if (at < 0) return null;
  return [files[at], ...files.filter((_, i) => i !== at)];
}

const FILE = /^[A-Za-z0-9._ -]+\.pp$/;
const NAME = /^[A-Za-z0-9._-]+$/;

/** A plain file name, or one in a known subfolder (`partners/partner-l-still.pp`). */
export function isTeamFile(file: string): boolean {
  const slash = file.indexOf("/");
  if (slash < 0) return FILE.test(file);
  return (
    (TEAM_SUBDIRS as readonly string[]).includes(file.slice(0, slash)) &&
    FILE.test(file.slice(slash + 1))
  );
}

/** Whether `tail` (what follows the branch in a link) names files or a pair this code can open. */
function readableTail(tail: string): boolean {
  const parts = tail
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0 || parts.length > MAX_FILES) return false;
  if (parts.length === 1 && !parts[0].endsWith(".pp"))
    return NAME.test(parts[0]);
  return parts.every(isTeamFile);
}
const REF = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;

/** What a team link asks for: the branch, and either files or a pair's name. */
export interface TeamLink {
  ref: string;
  files: string[];
  /** A pair named in pairs.json, to look up; null when the link lists files. */
  pair: string | null;
}

/** A named group of Autos that run together, from `TeamCode/autos/pairs.json`. */
export interface TeamPair {
  name: string;
  files: string[];
  note?: string;
}

/** Reads a `#team=` fragment: the link, an error message, or null if it is not one. */
export function parseTeamHash(
  hash: string,
): TeamLink | { error: string } | null {
  if (!hash.startsWith(TEAM_HASH_PREFIX)) return null;
  let body: string;
  try {
    body = decodeURIComponent(hash.slice(TEAM_HASH_PREFIX.length)).trim();
  } catch {
    return { error: "This team link is damaged." };
  }
  // The branch may have slashes (claude/simulator) and so may a file (partners/x.pp): the branch
  // is the shortest prefix after which the rest reads as files or a pair, so `master/partners/x.pp`
  // is master's partners/x.pp, not a branch called master/partners. When nothing reads, the last
  // slash splits it, and the checks below say what is wrong.
  const segments = body.split("/");
  let split = segments.findIndex(
    (_, i) => i > 0 && readableTail(segments.slice(i).join("/")),
  );
  if (split < 0) split = segments.length - 1;
  if (split <= 0) {
    return {
      error:
        "A team link names a branch, then the files: #team=<branch>/<file>.pp,<file>.pp",
    };
  }
  const ref = segments.slice(0, split).join("/");
  const tail = segments.slice(split).join("/");
  if (!REF.test(ref) || ref.split("/").includes("..")) {
    return { error: `"${ref}" is not a branch or commit.` };
  }
  const parts = tail
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 1 && !parts[0].endsWith(".pp")) {
    if (!NAME.test(parts[0]))
      return { error: `"${parts[0]}" is not a pair's name.` };
    return { ref, files: [], pair: parts[0] };
  }
  if (parts.length === 0) return { error: "This team link names no files." };
  if (parts.length > MAX_FILES) {
    return {
      error: `A team link shows at most ${MAX_FILES} files; this one names ${parts.length}.`,
    };
  }
  for (const file of parts) {
    if (!isTeamFile(file))
      return { error: `"${file}" is not a .pp file name.` };
  }
  return { ref, files: parts, pair: null };
}

/** The fragment for files on a branch (the reverse of `parseTeamHash`). */
export function teamHash(ref: string, filesOrPair: string[] | string): string {
  const tail = Array.isArray(filesOrPair)
    ? filesOrPair.map(encodeURIComponent).join(",")
    : encodeURIComponent(filesOrPair);
  return `${TEAM_HASH_PREFIX}${ref}/${tail}`;
}

/** A raw file in the team's Autos folder on GitHub (or its `partners/` subfolder). */
export function teamRawUrl(ref: string, file: string): string {
  const r = ref.split("/").map(encodeURIComponent).join("/");
  const f = file.split("/").map(encodeURIComponent).join("/");
  return `https://raw.githubusercontent.com/${TEAM_REPO}/${r}/${TEAM_DIR}/${f}`;
}

/** GitHub's listing of the team's Autos folder on a branch. */
export function teamListUrl(ref: string): string {
  return `https://api.github.com/repos/${TEAM_REPO}/contents/${TEAM_DIR}?ref=${encodeURIComponent(ref)}`;
}

/** GitHub's listing of the partner stand-ins' folder on a branch. */
export function teamPartnersListUrl(ref: string): string {
  return `https://api.github.com/repos/${TEAM_REPO}/contents/${TEAM_DIR}/${PARTNERS_DIR}?ref=${encodeURIComponent(ref)}`;
}

/** GitHub's listing of the drafts' folder on a branch. */
export function teamDraftsListUrl(ref: string): string {
  return `https://api.github.com/repos/${TEAM_REPO}/contents/${TEAM_DIR}/${DRAFTS_DIR}?ref=${encodeURIComponent(ref)}`;
}

/** The name of the browser copy of a team file: `biobuzz-partners-x.pp` for `partners/x.pp`. */
export function copyName(file: string): string {
  return `${COPY_PREFIX}${file.replace(/\//g, "-")}`;
}

/**
 * The team file a browser copy was made from, or null: `biobuzz-r-solo.pp` → `r-solo.pp`, and a
 * subfolder's copy back to its path, `biobuzz-drafts-r-solo-push.pp` → `drafts/r-solo-push.pp`.
 */
export function teamFileOf(name: string): string | null {
  if (!name.startsWith(COPY_PREFIX) || name.length <= COPY_PREFIX.length)
    return null;
  const rest = name.slice(COPY_PREFIX.length);
  for (const dir of TEAM_SUBDIRS) {
    if (rest.startsWith(`${dir}-`) && rest.length > dir.length + 1)
      return `${dir}/${rest.slice(dir.length + 1)}`;
  }
  return rest;
}

/** Reads pairs.json: the pairs that name only plain .pp files, in order. */
export function parsePairs(text: string): TeamPair[] {
  const data = JSON.parse(text);
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.pairs)
      ? data.pairs
      : [];
  const out: TeamPair[] = [];
  for (const p of list) {
    if (!p || typeof p.name !== "string" || !Array.isArray(p.files)) continue;
    const files = p.files
      .filter((f: unknown) => typeof f === "string" && FILE.test(f))
      .slice(0, MAX_FILES);
    if (files.length === 0) continue;
    out.push({
      name: p.name,
      files,
      note: typeof p.note === "string" ? p.note : undefined,
    });
  }
  return out;
}

/** Fetches text; null for "not found"; throws when GitHub cannot be reached. */
export type FetchText = (url: string) => Promise<string | null>;

/** How long a read from GitHub may take before it counts as no answer, ms. */
export const FETCH_TIMEOUT_MS = 8000;

export const fetchText: FetchText = async (url) => {
  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-cache",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    // A laptop on the robot's Wi-Fi has no internet: the read hangs or fails outright.
    throw new Error(
      error instanceof DOMException && error.name === "TimeoutError"
        ? `No answer from GitHub in ${FETCH_TIMEOUT_MS / 1000} s. Is this laptop on the robot's Wi-Fi?`
        : "Could not reach GitHub. Is this laptop on the robot's Wi-Fi?",
      { cause: error },
    );
  }
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
  return response.text();
};

/** The pairs on a branch (none if it has no pairs.json). */
export async function loadPairs(
  ref: string,
  get: FetchText = fetchText,
): Promise<TeamPair[]> {
  const text = await get(teamRawUrl(ref, PAIRS_FILE));
  return text === null ? [] : parsePairs(text);
}

/** The .pp file names in a GitHub folder listing, sorted. */
function ppNames(text: string): string[] {
  const entries = JSON.parse(text);
  if (!Array.isArray(entries))
    throw new Error("GitHub's listing was not readable.");
  return entries
    .filter(
      (e) =>
        e &&
        e.type === "file" &&
        typeof e.name === "string" &&
        FILE.test(e.name),
    )
    .map((e) => e.name as string)
    .sort();
}

/**
 * The .pp files in the team's Autos folder on a branch, sorted. The folder's own files only: the
 * `partners/` stand-ins are the simulator's, not Autos the robot runs, so this leaves them out
 * (see {@link listPartnerFiles}).
 */
export async function listTeamFiles(
  ref: string,
  get: FetchText = fetchText,
): Promise<string[]> {
  const text = await get(teamListUrl(ref));
  if (text === null) throw new Error(`biobuzz has no ${TEAM_DIR} on ${ref}.`);
  return ppNames(text);
}

/**
 * The partner stand-ins on a branch, sorted, as the paths a link names (`partners/partner-l-still.pp`).
 * A branch without the folder has none; that is not an error.
 */
export async function listPartnerFiles(
  ref: string,
  get: FetchText = fetchText,
): Promise<string[]> {
  const text = await get(teamPartnersListUrl(ref));
  return text === null ? [] : ppNames(text).map((n) => `${PARTNERS_DIR}/${n}`);
}

/**
 * The drafts on a branch, sorted, as the paths a link names (`drafts/r-solo-push.pp`). A branch
 * without the folder has none; that is not an error.
 */
export async function listDraftFiles(
  ref: string,
  get: FetchText = fetchText,
): Promise<string[]> {
  const text = await get(teamDraftsListUrl(ref));
  return text === null ? [] : ppNames(text).map((n) => `${DRAFTS_DIR}/${n}`);
}

/** The files a link opens: its own, or its pair's from pairs.json. */
export async function resolveTeamFiles(
  link: TeamLink,
  get: FetchText = fetchText,
): Promise<string[]> {
  if (link.pair === null) return link.files;
  const pairs = await loadPairs(link.ref, get);
  const pair = pairs.find((p) => p.name === link.pair);
  if (!pair) {
    throw new Error(
      `There is no pair called "${link.pair}" in ${TEAM_DIR}/${PAIRS_FILE} on ${link.ref}.`,
    );
  }
  return pair.files;
}

/**
 * Fetches each file and checks it is a path project; returns the texts in order. Throws a
 * message naming the first file that is missing or unreadable.
 */
export async function fetchTeamFiles(
  ref: string,
  files: string[],
  get: FetchText = fetchText,
): Promise<{ file: string; text: string }[]> {
  const out: { file: string; text: string }[] = [];
  for (const file of files) {
    let text: string | null;
    try {
      text = await get(teamRawUrl(ref, file));
    } catch {
      throw new Error(
        `Could not reach GitHub to open ${file}. Check the internet connection and try again.`,
      );
    }
    if (text === null) {
      throw new Error(
        `biobuzz has no ${TEAM_DIR}/${file} on ${ref}. Check the name and the branch, and that it was pushed.`,
      );
    }
    let project: Record<string, unknown>;
    try {
      project = JSON.parse(text);
    } catch {
      throw new Error(`${file} on ${ref} is not a readable .pp file.`);
    }
    if (
      !project ||
      typeof project !== "object" ||
      !project.startPoint ||
      !Array.isArray(project.lines)
    ) {
      throw new Error(`${file} on ${ref} does not contain a path project.`);
    }
    out.push({ file, text });
  }
  return out;
}
