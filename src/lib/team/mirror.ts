/**
 * The site's own copy of biobuzz's Autos and scouting plans, for devices that cannot reach GitHub's
 * file server (the pit tablets, Android 5.1.1, load this site but not raw.githubusercontent.com).
 * The Pages workflow writes it (scripts/mirror-biobuzz.mjs) at `mirror/<branch>/<path>`, with each
 * folder's listing as `contents.json`, on every deploy and every half hour. It can be that old, so
 * GitHub itself is always tried first.
 */
// Not imported from teamAutos, which imports this module.
const TEAM_REPO = "Mona-Shores-FTC-Robotics/biobuzz";
const RAW = `https://raw.githubusercontent.com/${TEAM_REPO}/`;
const API = `https://api.github.com/repos/${TEAM_REPO}/contents/`;

/** The mirror's copy of a raw biobuzz file or a contents listing; null for anything else. */
export function mirrorUrl(url: string, base = siteBase()): string | null {
  if (url.startsWith(RAW))
    return new URL(`mirror/${url.slice(RAW.length)}`, base).href;
  if (url.startsWith(API)) {
    const parsed = new URL(url);
    const ref = parsed.searchParams.get("ref");
    if (!ref) return null;
    const path = parsed.pathname.slice(new URL(API).pathname.length);
    const refPath = ref.split("/").map(encodeURIComponent).join("/");
    return new URL(`mirror/${refPath}/${path}/contents.json`, base).href;
  }
  return null;
}

function siteBase(): string {
  return typeof document === "undefined"
    ? "http://localhost/"
    : document.baseURI;
}

/**
 * The mirror's copy of `url` when GitHub could not be reached: its text, or `undefined` when the
 * mirror cannot answer either (so the caller reports GitHub's own failure). A file the mirror does
 * not have is null only when `missingIsNone` (a branch the mirror always copies, such as the
 * scouting plans'); otherwise it may just be on a branch the mirror does not copy.
 */
export async function readMirror(
  url: string,
  missingIsNone = false,
): Promise<string | null | undefined> {
  const mirror = mirrorUrl(url);
  if (!mirror) return undefined;
  try {
    const response = await fetch(mirror, { cache: "no-cache" });
    if (response.ok) return response.text();
    return response.status === 404 && missingIsNone ? null : undefined;
  } catch {
    return undefined;
  }
}
