/**
 * The biobuzz checkout this browser was given (lib/repo/repoFolder.ts): its directory handle,
 * kept in IndexedDB so the folder is picked once and later saves only ask to allow access again,
 * wrapped as a {@link Folder}. Chrome and Edge have the File System Access API; elsewhere
 * {@link canPickFolder} is false and the dialog says so.
 */
import { get, writable } from "svelte/store";
import { type Folder, isCheckout, readRepoSpots } from "./repoFolder";

type Permission = "granted" | "prompt" | "denied";

/** The parts of the File System Access API the save uses (not in TypeScript's DOM types). */
interface DirHandle {
  readonly kind: "directory";
  readonly name: string;
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<DirHandle>;
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<FileHandle>;
  values(): AsyncIterable<DirHandle | FileHandle>;
  removeEntry(name: string): Promise<void>;
  queryPermission(options: { mode: "read" | "readwrite" }): Promise<Permission>;
  requestPermission(options: {
    mode: "read" | "readwrite";
  }): Promise<Permission>;
}

interface FileHandle {
  readonly kind: "file";
  readonly name: string;
  getFile(): Promise<{ text(): Promise<string> }>;
  createWritable(): Promise<{
    write(text: string): Promise<void>;
    close(): Promise<void>;
  }>;
}

interface PickerWindow {
  showDirectoryPicker?(options: {
    id?: string;
    mode?: "read" | "readwrite";
  }): Promise<DirHandle>;
}

/** The folder in this browser: the handle, as a Folder, and whether it may be used right now. */
export interface RepoFolder {
  id: string;
  branch: string | null;
  name: string;
  folder: Folder;
  /** "granted" writes and reads at once; "prompt" needs {@link allowRepoFolder} from a click. */
  permission: Permission;
}

/** The checkout this browser knows, or null until one is picked. */
export const repoFolder = writable<RepoFolder | null>(null);

const DB = "biobuzz-visualizer";
const STORE = "handles";
const KEY = "checkout";
const MODE = { mode: "readwrite" } as const;

let handle: DirHandle | null = null;
let checkoutId = "";

export function canPickFolder(): boolean {
  return (
    typeof (window as unknown as PickerWindow).showDirectoryPicker ===
    "function"
  );
}

/** True when the user dismissed the folder picker. */
export function isPickerCancel(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * Asks for the checkout (from a click). Refuses a folder that is not one, saying so; the chosen
 * folder is remembered for next time.
 */
export async function pickRepoFolder(): Promise<RepoFolder> {
  const picker = (window as unknown as PickerWindow).showDirectoryPicker;
  if (!picker)
    throw new Error("This browser cannot open a folder. Use Chrome or Edge.");
  const picked = await picker.call(window, { id: "biobuzz", ...MODE });
  const folder = wrap(picked);
  if (!(await isCheckout(folder))) {
    throw new Error(
      `${picked.name} is not a biobuzz checkout: it has no TeamCode/autos/spots.json. Pick the folder that holds TeamCode.`,
    );
  }
  handle = picked;
  checkoutId = crypto.randomUUID();
  await remember(picked).catch(() => {
    // Storage refused (a private window): the folder lasts this page only.
  });
  return publish("granted");
}

/** Reads the remembered folder on startup, if any; it may need allowing before use. */
export async function loadRepoFolder(): Promise<RepoFolder | null> {
  if (!canPickFolder()) return null;
  try {
    const saved = await recall();
    if (!saved) return null;
    handle = saved.handle;
    checkoutId = saved.id;
    return publish(await saved.handle.queryPermission(MODE));
  } catch {
    return null;
  }
}

/** Asks the browser to allow the remembered folder again (from a click). */
export async function allowRepoFolder(): Promise<RepoFolder | null> {
  if (!handle) return null;
  return publish(await handle.requestPermission(MODE));
}

/** The folder, allowed: asks if it must. Null when there is none or the browser said no. */
export async function readyRepoFolder(): Promise<RepoFolder | null> {
  const current = get(repoFolder);
  if (!current) return null;
  if (current.permission === "granted") return current;
  const allowed = await allowRepoFolder();
  return allowed?.permission === "granted" ? allowed : null;
}

/** Drops the remembered folder. */
export async function forgetRepoFolder(): Promise<void> {
  handle = null;
  repoFolder.set(null);
  await forget().catch(() => {});
}

/**
 * The checkout's spots.json, when the folder is allowed without asking (a page load after the
 * browser remembered the permission); null otherwise. For the team spots when GitHub is out of
 * reach.
 */
export async function repoSpotsText(): Promise<string | null> {
  const current = get(repoFolder);
  if (!current || current.permission !== "granted") return null;
  try {
    return await readRepoSpots(current.folder);
  } catch {
    return null;
  }
}

async function publish(permission: Permission): Promise<RepoFolder> {
  const folder = wrap(handle!);
  const current = {
    id: checkoutId,
    branch: permission === "granted" ? await checkoutBranch(folder) : null,
    name: handle!.name,
    folder,
    permission,
  };
  repoFolder.set(current);
  return current;
}

/** Read-only: worktree Git pointers may be outside the browser's folder grant. */
export async function checkoutBranch(folder: Folder): Promise<string | null> {
  try {
    const head = (await folder.readText(".git/HEAD"))?.trim();
    if (head?.startsWith("ref: refs/heads/")) return head.slice(16);
    return head && /^[a-f0-9]{40,64}$/.test(head)
      ? `detached ${head.slice(0, 10)}`
      : null;
  } catch {
    return null;
  }
}

export async function refreshRepoBranch(): Promise<void> {
  const current = get(repoFolder);
  if (!current || current.permission !== "granted") return;
  const branch = await checkoutBranch(current.folder);
  if (get(repoFolder)?.id === current.id && branch !== current.branch)
    repoFolder.set({ ...current, branch });
}

function wrap(root: DirHandle): Folder {
  const dirOf = async (parts: string[], create: boolean) => {
    let dir = root;
    for (const part of parts)
      dir = await dir.getDirectoryHandle(part, { create });
    return dir;
  };
  const notFound = (error: unknown) =>
    error instanceof DOMException &&
    (error.name === "NotFoundError" || error.name === "TypeMismatchError");
  return {
    name: root.name,
    async readText(path) {
      const parts = path.split("/");
      const file = parts.pop()!;
      try {
        const dir = await dirOf(parts, false);
        return await (await (await dir.getFileHandle(file)).getFile()).text();
      } catch (error) {
        if (notFound(error)) return null;
        throw error;
      }
    },
    async writeText(path, text) {
      const parts = path.split("/");
      const file = parts.pop()!;
      const dir = await dirOf(parts, true);
      const writable = await (
        await dir.getFileHandle(file, { create: true })
      ).createWritable();
      await writable.write(text);
      await writable.close();
    },
    async listFiles(dirPath) {
      try {
        const dir = await dirOf(dirPath.split("/"), false);
        const names: string[] = [];
        for await (const entry of dir.values())
          if (entry.kind === "file") names.push(entry.name);
        return names;
      } catch (error) {
        if (notFound(error)) return null;
        throw error;
      }
    },
    async removeText(path) {
      const parts = path.split("/");
      const file = parts.pop()!;
      try {
        await (await dirOf(parts, false)).removeEntry(file);
      } catch (error) {
        if (!notFound(error)) throw error;
      }
    },
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function remember(dir: DirHandle): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ handle: dir, id: checkoutId }, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function recall(): Promise<{ handle: DirHandle; id: string } | null> {
  const db = await openDb();
  const result = await new Promise<{ handle: DirHandle; id: string } | null>(
    (resolve, reject) => {
      const request = db
        .transaction(STORE, "readonly")
        .objectStore(STORE)
        .get(KEY);
      request.onsuccess = () => {
        const saved = request.result;
        resolve(
          !saved
            ? null
            : saved.handle
              ? saved
              : { handle: saved, id: "legacy-checkout" },
        );
      };
      request.onerror = () => reject(request.error);
    },
  );
  db.close();
  return result;
}

async function forget(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
