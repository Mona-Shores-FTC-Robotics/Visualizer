/**
 * The team's Autos, straight from biobuzz: several at once, always the latest pushed.
 *
 * A team link `#team=<branch>/<a>.pp,<b>.pp` (up to 4 files, or a pair's name from
 * `pairs.json`, e.g. `#team=claude/simulator/recycle3`) fetches those files from
 * `TeamCode/autos/` on that branch, keeps a copy of each in the browser's file list (named
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
/** The branch the team's Autos are on; master stays robot code only. */
export const DEFAULT_REF = "claude/simulator";
export const PAIRS_FILE = "pairs.json";
/** Multi-path mode shows at most this many files. */
export const MAX_FILES = 4;
/** Prefix of the copies kept in the browser's file list. */
export const COPY_PREFIX = "biobuzz-";

const FILE = /^[A-Za-z0-9._ -]+\.pp$/;
const NAME = /^[A-Za-z0-9._-]+$/;
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
  const slash = body.lastIndexOf("/");
  if (slash <= 0) {
    return {
      error:
        "A team link names a branch, then the files: #team=<branch>/<file>.pp,<file>.pp",
    };
  }
  const ref = body.slice(0, slash);
  const tail = body.slice(slash + 1);
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
    if (!FILE.test(file)) return { error: `"${file}" is not a .pp file name.` };
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

/** A raw file in the team's Autos folder on GitHub. */
export function teamRawUrl(ref: string, file: string): string {
  const r = ref.split("/").map(encodeURIComponent).join("/");
  return `https://raw.githubusercontent.com/${TEAM_REPO}/${r}/${TEAM_DIR}/${encodeURIComponent(file)}`;
}

/** GitHub's listing of the team's Autos folder on a branch. */
export function teamListUrl(ref: string): string {
  return `https://api.github.com/repos/${TEAM_REPO}/contents/${TEAM_DIR}?ref=${encodeURIComponent(ref)}`;
}

/** The name of the browser copy of a team file. */
export function copyName(file: string): string {
  return `${COPY_PREFIX}${file}`;
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

export const fetchText: FetchText = async (url) => {
  const response = await fetch(url, { cache: "no-cache" });
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

/** The .pp files in the team's Autos folder on a branch, sorted. */
export async function listTeamFiles(
  ref: string,
  get: FetchText = fetchText,
): Promise<string[]> {
  const text = await get(teamListUrl(ref));
  if (text === null) throw new Error(`biobuzz has no ${TEAM_DIR} on ${ref}.`);
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
