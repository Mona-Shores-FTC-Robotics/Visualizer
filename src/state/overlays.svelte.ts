import { debounce } from "lodash";
import { fromStore, get } from "svelte/store";
import { workspaceDocument } from "../lib/repo/workspaceStore";
import type { BasePoint, Settings } from "../types";
import { parseProject, serializeProject, type ProjectDoc } from "../io";
import { updatePoint, type PointAddress } from "../model/commands";
import { activePaths, currentFilePath } from "../stores";
import * as browserFileStore from "../utils/browserFileStore";
import type { ProjectStore } from "./project.svelte";

/** Up to this many saved files can be shown at once. */
export const MAX_OVERLAYS = 4;
const OVERLAY_COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A"];

export interface Overlay {
  filePath: string;
  doc: ProjectDoc;
  color: string;
}

/**
 * Other saved files shown on the field alongside the open project, each with
 * its own robot. Their points can be dragged; edits save back to their files.
 */
export class Overlays {
  #loaded = $state.raw<Overlay[]>([]);
  #currentPath = fromStore(currentFilePath);
  /** The primary overlay IS the editor document, never a second editable copy. */
  items = $derived(
    this.#loaded.map((item) =>
      item.filePath === this.#currentPath.current
        ? { ...item, doc: this.#project.doc }
        : item,
    ),
  );
  active = $derived(this.items.length > 0);

  #project: ProjectStore;
  #getSettings: () => Settings;
  // Debounced writers, not state; nothing renders from this.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  #pendingSaves = new Map<number, ReturnType<typeof debounce>>();
  /** Fork: lays an overlay's paths out as its Auto drives them (lib/auto/links.ts). */
  #layOut: (doc: ProjectDoc, settings: Settings) => ProjectDoc;
  #loadVersion = 0;

  constructor(
    project: ProjectStore,
    getSettings: () => Settings,
    layOut: (doc: ProjectDoc, settings: Settings) => ProjectDoc = (doc) => doc,
  ) {
    this.#project = project;
    this.#getSettings = getSettings;
    this.#layOut = layOut;
    $effect(() => activePaths.subscribe((paths) => void this.load(paths)));
  }

  /** The current settings with an overlay's own robot applied. */
  settingsFor(overlay: Overlay): Settings {
    return {
      ...this.#getSettings(),
      rForward: undefined,
      features: undefined,
      ...overlay.doc.robot,
    };
  }

  async load(filePaths: string[]) {
    const version = ++this.#loadVersion;
    for (const save of this.#pendingSaves.values()) save.cancel();
    this.#pendingSaves.clear();
    const loaded: Overlay[] = [];
    for (const [index, filePath] of filePaths
      .slice(0, MAX_OVERLAYS)
      .entries()) {
      try {
        const text = await browserFileStore.readFile(filePath);
        const result = parseProject(text, this.#project.doc.robot);
        if (result.ok) {
          loaded.push({
            filePath,
            doc: this.#layOut(result.doc, {
              ...this.#getSettings(),
              ...result.doc.robot,
            }),
            color: OVERLAY_COLORS[index],
          });
        }
      } catch (error) {
        console.error(`Failed to load overlay ${filePath}:`, error);
      }
    }
    if (version === this.#loadVersion) this.#loaded = loaded;
  }

  movePoint(index: number, address: PointAddress, point: BasePoint) {
    const overlay = this.items[index];
    if (!overlay) return;
    if (overlay.filePath === this.#currentPath.current) {
      this.#project.preview((doc) =>
        this.#layOut(
          updatePoint(address, point)(doc),
          this.settingsFor(overlay),
        ),
      );
      return;
    }
    // Local partner comparisons are references. Open a partner explicitly to edit it.
    if (get(workspaceDocument)) return;
    const doc = this.#layOut(
      updatePoint(address, point)(overlay.doc),
      this.settingsFor(overlay),
    );
    this.#loaded = this.#loaded.map((item, i) =>
      i === index ? { ...item, doc } : item,
    );
    this.#saveSoon(index);
  }

  async saveAll() {
    for (const overlay of this.items) await this.#write(overlay);
  }

  #saveSoon(index: number) {
    let save = this.#pendingSaves.get(index);
    if (!save) {
      save = debounce(() => {
        const overlay = this.items[index];
        if (overlay) void this.#write(overlay);
      }, 400);
      this.#pendingSaves.set(index, save);
    }
    save();
  }

  async #write(overlay: Overlay) {
    try {
      await browserFileStore.writeFile(
        overlay.filePath,
        serializeProject(overlay.doc),
      );
    } catch (error) {
      console.error(`Failed to save overlay ${overlay.filePath}:`, error);
    }
  }
}
