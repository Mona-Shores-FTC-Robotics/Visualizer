/**
 * Links to Autos committed in biobuzz: `#gh=<file>.pp` opens
 * `TeamCode/autos/<file>.pp` from the default branch, and
 * `#gh=<branch or commit>/<file>.pp` from that branch or commit, as a shared
 * copy. A file elsewhere in biobuzz is named by its whole path, which starts
 * at `TeamCode/`: `#gh=claude/simulator/TeamCode/src/test/resources/auto-builder/x.pp`. The link holds only where the file is, so it stays short (about 70
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
  /** The folder in biobuzz, when not TeamCode/autos (it then starts with "TeamCode"). */
  dir?: string;
}

/** The file's path in biobuzz. */
export function gitPath(link: GitLink): string {
  return `${link.dir ?? GIT_AUTOS_DIR}/${link.file}`;
}

/** A link to the file at `path` in biobuzz (the short form when it is in TeamCode/autos). */
export function gitLinkFor(ref: string | null, path: string): GitLink {
  const slash = path.lastIndexOf("/");
  const dir = path.slice(0, slash);
  const file = path.slice(slash + 1);
  return dir === GIT_AUTOS_DIR ? { ref, file } : { ref, file, dir };
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
  let ref = slash >= 0 ? body.slice(0, slash) : null;
  if (!FILE.test(file)) {
    return { error: `"${file}" is not a .pp file name.` };
  }
  // A whole path: from "TeamCode" on is the folder, and before it the ref.
  let dir: string | undefined;
  if (ref !== null) {
    const inner = ref.indexOf("/TeamCode/");
    const at = ref === "TeamCode" || ref.startsWith("TeamCode/") ? 0 : inner >= 0 ? inner + 1 : -1;
    if (at >= 0) {
      dir = ref.slice(at);
      ref = at === 0 ? null : ref.slice(0, at - 1);
      if (!REF.test(dir) || dir.split("/").some((part) => part === "." || part === "..")) {
        return { error: `"${dir}" is not a folder in biobuzz.` };
      }
    }
  }
  if (ref !== null && (!REF.test(ref) || ref.split("/").includes(".."))) {
    return { error: `"${ref}" is not a branch or commit.` };
  }
  return dir === undefined || dir === GIT_AUTOS_DIR ? { ref, file } : { ref, file, dir };
}

/** The raw file on GitHub. */
export function gitRawUrl(link: GitLink): string {
  const ref = (link.ref ?? "HEAD").split("/").map(encodeURIComponent).join("/");
  const dir = (link.dir ?? GIT_AUTOS_DIR).split("/").map(encodeURIComponent).join("/");
  return `https://raw.githubusercontent.com/${GIT_REPO}/${ref}/${dir}/${encodeURIComponent(link.file)}`;
}

/** The fragment for a committed Auto (the reverse of `parseGitHash`). */
export function gitHash(link: GitLink): string {
  const dir = link.dir ? `${link.dir}/` : "";
  return `${GIT_HASH_PREFIX}${link.ref ? `${link.ref}/` : ""}${dir}${encodeURIComponent(link.file)}`;
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
  fetchText: (url: string, link: GitLink) => Promise<string | null>,
): Promise<ShareLinkResult> {
  const link = parseGitHash(hash);
  if (link === null) return { kind: "none" };
  if ("error" in link) return { kind: "error", message: link.error };

  const where = `${gitPath(link)} at ${link.ref ?? "biobuzz's default branch"}`;
  let text: string | null;
  try {
    text = await fetchText(gitRawUrl(link), link);
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
  const git = { ref: link.ref, path: gitPath(link), text: text as string };
  return { kind: "ok", shared: { name: link.file, project, from: gitSource(link), git } };
}
