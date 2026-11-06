/** Local save/checkpoint operations. No GitHub, shell, or deployment access. */
import { GENERATED_DIRS } from "../sim/biobuzz";
import { TEAM_DIR } from "../team/teamAutos";
import {
  type Folder,
  listRepoAutos,
  listRepoDrafts,
  repoSaveFiles,
} from "./repoFolder";
import { SPOTS_PATH, teamSpotSave, type TeamSpots } from "../team/teamSpots";

export const LOCAL_DIR = "TeamCode/.auto-workspace";
const JOURNAL = `${LOCAL_DIR}/pending.json`;
export const CHECKPOINT_DIR = `${LOCAL_DIR}/checkpoints`;
const AUTO_DIR =
  "TeamCode/src/main/java/org/firstinspires/ftc/teamcode/opmodes/auto";
export type FileSet = Record<string, string | null>;

export async function listPartners(folder: Folder): Promise<string[]> {
  return ((await folder.listFiles(`${TEAM_DIR}/partners`)) ?? [])
    .filter((n) => /^[A-Za-z0-9._ -]+\.pp$/.test(n))
    .sort()
    .map((n) => `partners/${n}`);
}

/** Capture linked autos together so restoring shared spots leaves their Java consistent. */
export async function autoAssetPaths(folder: Folder): Promise<string[]> {
  const pp = [
    ...(await listRepoAutos(folder)),
    ...(await listRepoDrafts(folder)),
    ...(await listPartners(folder)),
  ];
  const paths = pp.map((n) => `${TEAM_DIR}/${n}`);
  for (const dir of GENERATED_DIRS) {
    for (const name of (await folder.listFiles(dir)) ?? []) {
      if (/^[A-Za-z_$][\w$]*\.java$/.test(name)) paths.push(`${dir}/${name}`);
    }
  }
  for (const name of (await folder.listFiles(AUTO_DIR)) ?? []) {
    if (/^[A-Za-z_$][\w$]*AutoOpMode\.java$/.test(name))
      paths.push(`${AUTO_DIR}/${name}`);
  }
  for (const path of [
    SPOTS_PATH,
    `${TEAM_DIR}/timing.json`,
    "TeamCode/auto-registry.json",
  ]) {
    if ((await folder.readText(path)) !== null) paths.push(path);
  }
  return paths.sort();
}

function assetPath(path: string): boolean {
  return (
    !path.includes("..") &&
    (/^TeamCode\/autos\/(?:(?:drafts|partners)\/)?[A-Za-z0-9._ -]+\.pp$/.test(
      path,
    ) ||
      [
        SPOTS_PATH,
        `${TEAM_DIR}/timing.json`,
        "TeamCode/auto-registry.json",
      ].includes(path) ||
      GENERATED_DIRS.some(
        (dir) =>
          path.startsWith(`${dir}/`) &&
          /^[A-Za-z_$][\w$]*\.java$/.test(path.slice(dir.length + 1)),
      ) ||
      (path.startsWith(`${AUTO_DIR}/`) &&
        /^[A-Za-z_$][\w$]*AutoOpMode\.java$/.test(
          path.slice(AUTO_DIR.length + 1),
        )))
  );
}

function checkedFiles(raw: unknown): FileSet {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Invalid auto snapshot.");
  for (const [path, text] of Object.entries(raw)) {
    if (!assetPath(path) || (text !== null && typeof text !== "string"))
      throw new Error(`Invalid auto snapshot path: ${path}`);
  }
  return raw as FileSet;
}

export async function readFiles(
  folder: Folder,
  paths: string[],
): Promise<FileSet> {
  const files: FileSet = {};
  for (const path of paths) files[path] = await folder.readText(path);
  return files;
}

async function gitHead(folder: Folder): Promise<string | null> {
  try {
    return await folder.readText(".git/HEAD");
  } catch {
    return null;
  }
}

async function writeFiles(
  folder: Folder,
  files: FileSet,
  head: string | null,
): Promise<void> {
  for (const [path, text] of Object.entries(files)) {
    if ((await gitHead(folder)) !== head)
      throw new Error(
        "The branch changed during the save. Switch back to the original event branch and reopen the workspace to recover.",
      );
    if (text === null) await folder.removeText(path);
    else await folder.writeText(path, text);
  }
}

/** A durable undo journal also recovers interrupted multi-file writes on the next open. */
export async function recoverWrite(folder: Folder): Promise<void> {
  const pending = await folder.readText(JOURNAL);
  if (!pending) return;
  const journal = JSON.parse(pending);
  if (
    journal.version !== 1 ||
    !(journal.head === null || typeof journal.head === "string")
  )
    throw new Error("Invalid interrupted-save journal.");
  if (journal.head !== (await gitHead(folder)))
    throw new Error(
      "An interrupted save belongs to another branch. Switch back to that branch before reopening the workspace to recover.",
    );
  await writeFiles(folder, checkedFiles(journal.files), journal.head);
  await folder.removeText(JOURNAL);
}

export async function writeTransaction(
  folder: Folder,
  files: FileSet,
  expected?: FileSet,
): Promise<void> {
  checkedFiles(files);
  if (await folder.readText(JOURNAL))
    throw new Error(
      "An interrupted save needs recovery. Reopen the checkout first.",
    );
  const before = await readFiles(folder, Object.keys(files));
  const head = await gitHead(folder);
  for (const [path, text] of Object.entries(expected ?? {})) {
    if ((await folder.readText(path)) !== text)
      throw new Error(
        `${path} changed on disk. Reopen it before saving; your edits are still in the editor.`,
      );
  }
  await folder.writeText(
    JOURNAL,
    JSON.stringify({ version: 1, head, files: before }),
  );
  try {
    await writeFiles(folder, files, head);
    await folder.removeText(JOURNAL);
  } catch (error) {
    if ((await gitHead(folder)) !== head) throw error;
    try {
      await writeFiles(folder, before, head);
      await folder.removeText(JOURNAL);
    } catch {
      throw new Error(
        `Save interrupted. Reopen this checkout to recover the previous files. ${String(error)}`,
      );
    }
    throw error;
  }
}

/** Re-export every linked auto for local spot changes, then the editor candidate. */
export async function workspaceSavePlan(
  folder: Folder,
  name: string,
  text: string,
  edits: TeamSpots = {},
) {
  const plan = repoSaveFiles(name, text);
  if (!plan.ok) throw new Error(plan.errors.join("\n"));
  const sameName = (await autoAssetPaths(folder)).find(
    (path) =>
      path.endsWith(`/${name.split("/").pop()}`) && path !== plan.ppPath,
  );
  if (sameName)
    throw new Error(
      `That filename is already used by ${sameName}. Use a distinct name for this candidate.`,
    );
  const existingJava = await folder.readText(plan.javaPath);
  const previousSource = existingJava?.match(/\bSOURCE\s*=\s*"([^"]+)"/)?.[1];
  if (previousSource && previousSource !== name.split("/").pop())
    throw new Error(
      `The export class ${plan.className} belongs to ${previousSource}. Give this candidate its own export name before saving.`,
    );
  const files: FileSet = {};
  if (Object.keys(edits).length) {
    const spots = await teamSpotSave(
      (path) => folder.readText(path),
      await autoAssetPaths(folder),
      edits,
    );
    if (!spots.ok) throw new Error(spots.errors.join("\n"));
    Object.assign(files, spots.files);
  }
  Object.assign(files, plan.files);
  return { ...plan, files };
}

export interface Checkpoint {
  version: 1;
  id: string;
  name: string;
  branch: string | null;
  createdAt: string;
  tested: boolean;
  files: FileSet;
}

export async function createCheckpoint(
  folder: Folder,
  name: string,
  branch: string | null,
  tested: boolean,
): Promise<Checkpoint> {
  if (await folder.readText(JOURNAL))
    throw new Error(
      "Recover the interrupted save before creating a checkpoint.",
    );
  const point: Checkpoint = {
    version: 1,
    id: crypto.randomUUID(),
    name: name.trim() || "Auto checkpoint",
    branch,
    createdAt: new Date().toISOString(),
    tested,
    files: await readFiles(folder, await autoAssetPaths(folder)),
  };
  if (!Object.keys(point.files).some((p) => p.endsWith(".pp")))
    throw new Error("There are no saved autos to checkpoint.");
  await folder.writeText(
    `${CHECKPOINT_DIR}/${point.id}.json`,
    JSON.stringify(point, null, 2),
  );
  return point;
}

export async function listCheckpoints(folder: Folder): Promise<Checkpoint[]> {
  const points: Checkpoint[] = [];
  for (const name of (await folder.listFiles(CHECKPOINT_DIR)) ?? []) {
    if (!/^[\w-]+\.json$/.test(name)) continue;
    const raw = JSON.parse(
      (await folder.readText(`${CHECKPOINT_DIR}/${name}`))!,
    );
    if (
      raw.version !== 1 ||
      typeof raw.name !== "string" ||
      typeof raw.createdAt !== "string" ||
      `${raw.id}.json` !== name
    )
      throw new Error(`Invalid checkpoint: ${name}`);
    checkedFiles(raw.files);
    points.push(raw);
  }
  return points.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Preserve the experiment before restoring auto assets, never unrelated robot code. */
export async function restoreCheckpoint(
  folder: Folder,
  point: Checkpoint,
  branch: string | null,
): Promise<void> {
  if (point.branch !== branch)
    throw new Error(
      "This checkpoint is from another branch. Switch to that event before restoring it.",
    );
  const files = checkedFiles(point.files);
  const backup = await createCheckpoint(
    folder,
    `Before restoring ${point.name}`,
    branch,
    false,
  );
  const restore: FileSet = { ...files };
  for (const path of Object.keys(backup.files))
    if (!(path in files)) restore[path] = null;
  await writeTransaction(folder, restore, backup.files);
}
