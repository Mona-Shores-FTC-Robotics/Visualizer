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
    handle = saved;
    return publish(await saved.queryPermission(MODE));
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

function publish(permission: Permission): RepoFolder {
  const current = { name: handle!.name, folder: wrap(handle!), permission };
  repoFolder.set(current);
  return current;
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
    tx.objectStore(STORE).put(dir, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function recall(): Promise<DirHandle | null> {
  const db = await openDb();
  const result = await new Promise<DirHandle | null>((resolve, reject) => {
    const request = db
      .transaction(STORE, "readonly")
      .objectStore(STORE)
      .get(KEY);
    request.onsuccess = () =>
      resolve((request.result as DirHandle | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
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
