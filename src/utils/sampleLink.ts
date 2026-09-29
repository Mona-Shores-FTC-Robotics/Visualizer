/**
 * Sample links: `#sample=<name>` opens `samples/<name>.pp` from this site as a
 * shared copy, like a share link. The link stays short, so it survives chat
 * apps that cut long links, and it always opens the sample as last deployed.
 */
import { decodeShareHash, type ShareLinkResult } from "./shareLink";

export const SAMPLE_HASH_PREFIX = "#sample=";

/** Sample names: lower-case letters, digits and dashes (the file stem). */
const SAMPLE_NAME = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Reads a fragment: a sample link, a share link, or neither. `load` fetches a
 * sample's text by file name (`red-garden-basic.pp`), or null if there is none.
 */
export async function resolveProjectHash(
  hash: string,
  load: (fileName: string) => Promise<string | null>,
): Promise<ShareLinkResult> {
  if (!hash.startsWith(SAMPLE_HASH_PREFIX)) return decodeShareHash(hash);
  const name = decodeURIComponent(hash.slice(SAMPLE_HASH_PREFIX.length)).trim();
  if (!SAMPLE_NAME.test(name)) {
    return { kind: "error", message: `"${name}" is not a sample name.` };
  }
  const fileName = `${name}.pp`;
  let text: string | null;
  try {
    text = await load(fileName);
  } catch {
    text = null;
  }
  if (text === null) {
    return { kind: "error", message: `There is no sample called "${name}" on this site.` };
  }
  try {
    const project = JSON.parse(text);
    if (typeof project !== "object" || project === null || !Array.isArray(project.lines)) {
      throw new Error("not a project");
    }
    return { kind: "ok", shared: { name: fileName, project } };
  } catch {
    return { kind: "error", message: `The sample "${name}" could not be read.` };
  }
}
