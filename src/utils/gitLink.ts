/**
 * Links to Autos committed in biobuzz: `#gh=<file>.pp` opens
 * `TeamCode/autos/<file>.pp` from the default branch, and
 * `#gh=<branch or commit>/<file>.pp` from that branch or commit, as a shared
 * copy. The link holds only where the file is, so it stays short (about 70
 * characters) and shows what is in git: pinned to a commit it never changes.
 *
 * The file is read from raw.githubusercontent.com, which needs no login while
 * biobuzz is public. A branch is served up to about 5 minutes stale after a
 * push; a commit is exact.
 */
import type { ShareLinkResult } from "./shareLink";

export const GIT_HASH_PREFIX = "#gh=";
export const GIT_REPO = "Mona-Shores-FTC-Robotics/biobuzz";
export const GIT_AUTOS_DIR = "TeamCode/autos";

const FILE = /^[A-Za-z0-9._ -]+\.pp$/;
const REF = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;

export interface GitLink {
  /** Branch, tag or commit; null for the default branch. */
  ref: string | null;
  file: string;
}

/** Where a `#gh=` fragment points, or an error message; null if it is not one. */
export function parseGitHash(hash: string): GitLink | { error: string } | null {
  if (!hash.startsWith(GIT_HASH_PREFIX)) return null;
  let body: string;
  try {
    body = decodeURIComponent(hash.slice(GIT_HASH_PREFIX.length)).trim();
  } catch {
    return { error: "This link to a committed Auto is damaged." };
  }
  const slash = body.lastIndexOf("/");
  const file = body.slice(slash + 1);
  const ref = slash >= 0 ? body.slice(0, slash) : null;
  if (!FILE.test(file)) {
    return { error: `"${file}" is not a .pp file name.` };
  }
  if (ref !== null && (!REF.test(ref) || ref.split("/").includes(".."))) {
    return { error: `"${ref}" is not a branch or commit.` };
  }
  return { ref, file };
}

/** The raw file on GitHub. */
export function gitRawUrl(link: GitLink): string {
  const ref = (link.ref ?? "HEAD").split("/").map(encodeURIComponent).join("/");
  return `https://raw.githubusercontent.com/${GIT_REPO}/${ref}/${GIT_AUTOS_DIR}/${encodeURIComponent(link.file)}`;
}

/** The fragment for a committed Auto (the reverse of `parseGitHash`). */
export function gitHash(link: GitLink): string {
  return `${GIT_HASH_PREFIX}${link.ref ? `${link.ref}/` : ""}${encodeURIComponent(link.file)}`;
}

/** Where the file came from, for the banner: "biobuzz master" or "biobuzz a1b2c3d". */
export function gitSource(link: GitLink): string {
  return `biobuzz ${link.ref ?? "(default branch)"}`;
}

/**
 * Reads a `#gh=` fragment: `none` when it is not one, else the project or a
 * plain message. `fetchText` returns the body, null for "not found", and
 * throws when GitHub cannot be reached.
 */
export async function resolveGitHash(
  hash: string,
  fetchText: (url: string) => Promise<string | null>,
): Promise<ShareLinkResult> {
  const link = parseGitHash(hash);
  if (link === null) return { kind: "none" };
  if ("error" in link) return { kind: "error", message: link.error };

  const where = `${GIT_AUTOS_DIR}/${link.file} at ${link.ref ?? "biobuzz's default branch"}`;
  let text: string | null;
  try {
    text = await fetchText(gitRawUrl(link));
  } catch {
    return {
      kind: "error",
      message: `Could not reach GitHub to open ${where}. Check the internet connection and try again.`,
    };
  }
  if (text === null) {
    return {
      kind: "error",
      message: `biobuzz has no ${where}. Check the file name and the branch or commit, and that it was pushed.`,
    };
  }
  let project: Record<string, unknown>;
  try {
    project = JSON.parse(text);
  } catch {
    return { kind: "error", message: `${where} is not a readable .pp file.` };
  }
  if (!project || typeof project !== "object" || !project.startPoint || !Array.isArray(project.lines)) {
    return { kind: "error", message: `${where} does not contain a path project.` };
  }
  return { kind: "ok", shared: { name: link.file, project, from: gitSource(link) } };
}
