/**
 * "Save to repo folder": the same two files "Save to GitHub" commits, written straight into the
 * biobuzz checkout on this laptop instead, so a competition-day change needs no internet and no
 * file juggling: save here, then Sloth Load from Android Studio. The .pp goes to
 * `TeamCode/autos/<name>.pp` (or `TeamCode/autos/drafts/<name>.pp` for a draft) and its Java to the robot's generated folder, byte for byte what the
 * GitHub save would commit (same serializer, same export, same SAVED stamp). Nothing else in the
 * checkout is touched: no simulation request, no spots.json.
 *
 * The folder is reached through the File System Access API (Chrome and Edge). This file knows
 * nothing of that API: it works on a {@link Folder}, so the rules are tested without a browser;
 * `repoStore.ts` wraps a real directory handle in one.
 */
import { generateAutoJavaFromText } from "../codegen/auto/fromFile";
import { DRAFTS_DIR, TEAM_DIR } from "../team/teamAutos";
import { SPOTS_PATH } from "../team/teamSpots";
import { baseName, generatedPathFor, ppPathProblem } from "../sim/biobuzz";

/** The file that says a folder is a biobuzz checkout: the team's spots. */
export const CHECKOUT_MARKER = SPOTS_PATH;
/** Where the saved .pp goes: the team's Autos folder, the only one the folder save writes to. */
export const REPO_PP_DIR = TEAM_DIR;

const FILE = /^[A-Za-z0-9._ -]+\.pp$/;
/** A name the folder save takes: a plain .pp name, or one in the drafts' folder (`drafts/x.pp`). */
const SAVE_NAME = new RegExp(`^(${DRAFTS_DIR}/)?[A-Za-z0-9._ -]+\\.pp$`);

/** A folder on this laptop, as much of it as the save needs. Paths are relative, with `/`. */
export interface Folder {
  /** The folder's own name, for messages ("Saved into biobuzz"). */
  readonly name: string;
  /** The file's text, or null when there is no such file. */
  readText(path: string): Promise<string | null>;
  /** Replaces the file's whole text, making it (and missing folders on the way) if needed. */
  writeText(path: string, text: string): Promise<void>;
  /** The names of the files directly in `dir`, or null when there is no such folder. */
  listFiles(dir: string): Promise<string[] | null>;
}

/** Why `name` cannot be the .pp file to save, or null if it can. */
export function repoFileProblem(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Name the Auto's .pp file, e.g. r-solo.pp";
  if (!SAVE_NAME.test(trimmed))
    return `${trimmed}: use letters, numbers, dots, dashes and underscores, ending in .pp (a draft: ${DRAFTS_DIR}/name.pp)`;
  return ppPathProblem(`${REPO_PP_DIR}/${trimmed}`);
}

/** The .pp's path in the checkout. */
export function repoPpPath(name: string): string {
  return `${REPO_PP_DIR}/${name.trim()}`;
}

export type RepoSaveFiles =
  | {
      ok: true;
      /** Path in the checkout → text to write: the .pp, then its Java. */
      files: Record<string, string>;
      ppPath: string;
      javaPath: string;
      className: string;
      warnings: string[];
    }
  | { ok: false; errors: string[] };

/**
 * What a save writes, from the project's saved text: `TeamCode/autos/<name>` with exactly that
 * text, and the class the Java export makes of it in the robot's generated folder. The same
 * export as "Save to GitHub" ({@link generateAutoJavaFromText}), so the two saves agree.
 */
export function repoSaveFiles(
  name: string,
  projectText: string,
): RepoSaveFiles {
  const problem = repoFileProblem(name);
  if (problem) return { ok: false, errors: [problem] };
  const ppPath = repoPpPath(name);
  const exported = generateAutoJavaFromText(projectText, baseName(ppPath));
  if (!exported.ok) return { ok: false, errors: exported.errors };
  // A TeamCode/autos Auto's class goes in the robot's generated folder; the folder save never
  // lists the checkout's classes, so it never follows one into the simulation-only folder.
  const javaPath = generatedPathFor(ppPath, exported.fileName, []);
  return {
    ok: true,
    files: { [ppPath]: projectText, [javaPath]: exported.source },
    ppPath,
    javaPath,
    className: exported.className,
    warnings: exported.warnings,
  };
}

/** Whether the folder is a biobuzz checkout: it has the team's spots file. */
export async function isCheckout(folder: Folder): Promise<boolean> {
  return (await folder.readText(CHECKOUT_MARKER)) !== null;
}

/** Writes the save's files into the checkout; the result says which, or what blocked it. */
export async function saveToFolder(
  folder: Folder,
  name: string,
  projectText: string,
): Promise<RepoSaveFiles> {
  const plan = repoSaveFiles(name, projectText);
  if (!plan.ok) return plan;
  for (const [path, text] of Object.entries(plan.files)) {
    await folder.writeText(path, text);
  }
  return plan;
}

/** The Autos in the checkout's TeamCode/autos, sorted; empty when the folder is not there. */
export async function listRepoAutos(folder: Folder): Promise<string[]> {
  const names = (await folder.listFiles(REPO_PP_DIR)) ?? [];
  return names.filter((n) => FILE.test(n)).sort();
}

/** The checkout's drafts, sorted, as the names the save takes (`drafts/<name>.pp`). */
export async function listRepoDrafts(folder: Folder): Promise<string[]> {
  const names = (await folder.listFiles(`${REPO_PP_DIR}/${DRAFTS_DIR}`)) ?? [];
  return names
    .filter((n) => FILE.test(n))
    .sort()
    .map((n) => `${DRAFTS_DIR}/${n}`);
}

/** One Auto's text from the checkout, or null when it has none by that name. */
export function readRepoAuto(
  folder: Folder,
  name: string,
): Promise<string | null> {
  return repoFileProblem(name)
    ? Promise.resolve(null)
    : folder.readText(repoPpPath(name));
}

/** The checkout's spots.json text, or null when it has none. */
export function readRepoSpots(folder: Folder): Promise<string | null> {
  return folder.readText(CHECKOUT_MARKER);
}

/**
 * A folder kept in memory: the tests' stand-in for a checkout, and a record of what a save
 * wrote. Paths are relative, with `/`.
 */
export class MemoryFolder implements Folder {
  readonly files = new Map<string, string>();
  readonly writes: string[] = [];

  constructor(
    readonly name: string,
    files: Record<string, string> = {},
  ) {
    for (const [path, text] of Object.entries(files))
      this.files.set(path, text);
  }

  async readText(path: string): Promise<string | null> {
    return this.files.get(path) ?? null;
  }

  async writeText(path: string, text: string): Promise<void> {
    this.files.set(path, text);
    this.writes.push(path);
  }

  async listFiles(dir: string): Promise<string[] | null> {
    const prefix = `${dir}/`;
    const names = [...this.files.keys()]
      .filter(
        (p) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/"),
      )
      .map((p) => p.slice(prefix.length));
    const anyBelow = [...this.files.keys()].some((p) => p.startsWith(prefix));
    return anyBelow ? names : null;
  }
}
