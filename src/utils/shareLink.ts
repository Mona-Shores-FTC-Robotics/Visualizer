/**
 * Share links: a whole project, compressed into the URL fragment, so opening
 * the link shows it. The fragment never reaches the server.
 *
 *   https://…/Visualizer/#data=1.<base64url(zlib deflate of the payload JSON)>
 *
 * `1` is the link format version. The payload is `{ name, project }`, where
 * `project` is the `.pp` document exactly as the app writes it (the `auto`
 * section included), so an old link loads through the same normalizers an old
 * file does. Nothing is converted: coordinates stay in Pedro's field frame.
 *
 * A link is a copy, not the file: git holds the Auto that runs.
 */

export const SHARE_LINK_VERSION = 1;
export const SHARE_HASH_PREFIX = "#data=";
/** Longest message Discord accepts without Nitro; longer links become a .txt. */
export const DISCORD_MESSAGE_LIMIT = 2000;

export interface SharedProject {
  /** File name of the shared project, when it had one. */
  name: string | null;
  /** The `.pp` document. */
  project: Record<string, unknown>;
  /** Where it was read from when that is git ("biobuzz master"); absent for a copy in the link. */
  from?: string;
  /** The file in biobuzz it was read from, when that is git: where "Save to GitHub" saves it back. */
  git?: { ref: string | null; path: string };
}

export type ShareLinkResult =
  | { kind: "none" }
  | { kind: "ok"; shared: SharedProject }
  | { kind: "error"; message: string };

const ASK_FOR_FILE = "Ask whoever sent it for the .pp file instead.";

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlToBytes(text: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error("not base64url");
  let base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

async function pipe(
  bytes: Uint8Array<ArrayBuffer>,
  transform: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** The fragment (`#data=1.…`) for a project. */
export async function encodeShareHash(shared: SharedProject): Promise<string> {
  const json = JSON.stringify({ name: shared.name, project: shared.project });
  const compressed = await pipe(
    new TextEncoder().encode(json),
    new CompressionStream("deflate"),
  );
  return `${SHARE_HASH_PREFIX}${SHARE_LINK_VERSION}.${bytesToBase64Url(compressed)}`;
}

/** The full link: this page's address with the fragment. */
export function shareUrl(
  hash: string,
  location: { origin: string; pathname: string },
): string {
  return `${location.origin}${location.pathname}${hash}`;
}

/**
 * Reads a fragment. `none` when it is not a share link at all; otherwise the
 * project, or a message saying plainly why it cannot be opened.
 */
export async function decodeShareHash(hash: string): Promise<ShareLinkResult> {
  if (!hash.startsWith(SHARE_HASH_PREFIX)) return { kind: "none" };
  const body = hash.slice(SHARE_HASH_PREFIX.length);

  const match = /^(\d+)\.(.*)$/s.exec(body);
  if (!match) {
    return {
      kind: "error",
      message: `This is not a Visualizer share link. ${ASK_FOR_FILE}`,
    };
  }
  const version = Number(match[1]);
  if (version > SHARE_LINK_VERSION) {
    return {
      kind: "error",
      message: `This link was made by a newer Visualizer (link format ${version}; this page reads format ${SHARE_LINK_VERSION}). Reload the page to get the latest version, or ask for the .pp file.`,
    };
  }
  if (version !== SHARE_LINK_VERSION) {
    return {
      kind: "error",
      message: `This link uses an unknown format (${version}). ${ASK_FOR_FILE}`,
    };
  }

  if (typeof DecompressionStream === "undefined") {
    return {
      kind: "error",
      message: `This browser cannot open share links. Use a current Chrome, Edge, Firefox or Safari, or ask for the .pp file.`,
    };
  }

  let payload: unknown;
  try {
    const json = new TextDecoder("utf-8", { fatal: true }).decode(
      await pipe(
        base64UrlToBytes(match[2]),
        new DecompressionStream("deflate"),
      ),
    );
    payload = JSON.parse(json);
  } catch {
    return {
      kind: "error",
      message: `This link is incomplete or damaged; it may have been cut off when it was pasted. ${ASK_FOR_FILE}`,
    };
  }

  const project = (payload as { project?: unknown } | null)?.project as
    Record<string, unknown> | undefined;
  if (
    !project ||
    typeof project !== "object" ||
    !project.startPoint ||
    !Array.isArray(project.lines)
  ) {
    return {
      kind: "error",
      message: `This link does not contain a path project. ${ASK_FOR_FILE}`,
    };
  }

  const name = (payload as { name?: unknown }).name;
  return {
    kind: "ok",
    shared: { name: typeof name === "string" && name ? name : null, project },
  };
}
