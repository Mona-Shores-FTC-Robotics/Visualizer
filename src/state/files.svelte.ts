import { fromStore, get } from "svelte/store";
import { TEAM_ROBOT } from "../lib/auto/teamRobot";
import { blankAuto } from "../lib/simple/steps";
import { debounce } from "lodash";
import {
  createDefaultProject,
  parseProject,
  serializeProject,
  type ProjectDoc,
} from "../io";
import {
  canPickExistingFile,
  canPickSaveFile,
  isPickerCancel,
  overwritePickedFile,
  saveToPickedFile,
} from "../lib/files/localFiles";
import {
  loadSessionSnapshot,
  saveSessionSnapshot,
} from "../lib/session/sessionSnapshot";
import { confirmDialog } from "../lib/dialog";
import { askFileName } from "../lib/files/fileNames";
import { mirrorProject } from "../model/mirror";
import { showToast } from "../lib/toast";
import { activePaths, currentFilePath } from "../stores";
import * as browserFileStore from "../utils/browserFileStore";
import {
  OPENABLE_EXTENSIONS,
  PROJECT_EXTENSION,
  basename,
  pathStem,
} from "../utils/filename";
import type { Overlays } from "./overlays.svelte";
import type { Prefs } from "./prefs.svelte";
import type { ProjectStore } from "./project.svelte";
import { readRepoAuto } from "../lib/repo/repoFolder";
import { repoFolder } from "../lib/repo/repoStore";
import {
  workspaceDocument,
  workspaceChanged,
  workspaceFileKey,
  workspaceOperation,
  requireWorkspace,
} from "../lib/repo/workspaceStore";
import {
  autoAssetPaths,
  readFiles,
  recoverWrite,
  workspaceSavePlan,
  writeTransaction,
} from "../lib/repo/workspaceFiles";
import {
  dropSpotEdits,
  refreshTeamSpots,
  spotEdits,
  savedSpots,
} from "../lib/team/spotsStore";
import { parseTeamSpots, SPOTS_PATH } from "../lib/team/teamSpots";
import { loadTeamTiming } from "../lib/timing/store";

/** Opening, saving and renaming the project, and recovering the last session. */
export class ProjectFiles {
  #filePath = fromStore(currentFilePath);
  #activePaths = fromStore(activePaths);
  /** False until startup has had the chance to restore the last session. */
  #started = $state(false);
  #project: ProjectStore;
  #prefs: Prefs;
  #overlays: Overlays;
  #workspace = fromStore(workspaceDocument);
  /** Fork: while a shared copy is on screen the session is not autosaved over. */
  holdAutosave = $state(false);
  /** Fork: the name Save offers when the project has none (a shared copy's). */
  suggestedName = $state<string | null>(null);
  requestRepoSave: (() => void) | null = null;

  constructor(project: ProjectStore, prefs: Prefs, overlays: Overlays) {
    this.#project = project;
    this.#prefs = prefs;
    this.#overlays = overlays;
  }

  /** The open project as it would be saved, including which overlays are shown. */
  current(): ProjectDoc {
    return { ...this.#project.doc, activePaths: this.#activePaths.current };
  }

  /** Open a document, starting a fresh undo history. */
  open(doc: ProjectDoc, options: { saved?: boolean } = {}) {
    workspaceDocument.set(null);
    this.#project.load(doc, options);
    activePaths.set(doc.activePaths);
  }

  /** Start a default project with the current robot, once confirmed. */
  async newProject() {
    if (
      this.#project.dirty &&
      !(await confirmDialog({
        title: "Start a new project?",
        message: "Your unsaved changes will be lost.",
        confirmLabel: "Discard changes",
        danger: true,
      }))
    ) {
      return;
    }
    this.open(
      // Fork: a new Auto starts empty at the right start, for the simple builder.
      blankAuto(
        createDefaultProject(
          // The current robot's driving, with the team robot's box.
          { ...this.#project.doc.robot, ...TEAM_ROBOT },
          this.#prefs.settings.fieldMap,
        ),
      ),
    );
    currentFilePath.set(null);
  }

  /** Parse a project file, reporting a failure or any warnings. */
  read(text: string): ProjectDoc | null {
    const result = parseProject(text, this.#project.doc.robot);
    if (!result.ok) {
      showToast(result.error, "error");
      return null;
    }
    result.warnings.forEach((warning) => showToast(warning, "warning"));
    return result.doc;
  }

  /** Save into app storage under the open file's name, asking for one if it has none. */
  async save() {
    if (get(workspaceDocument)) return this.saveWorkspace();
    if (get(repoFolder) && this.requestRepoSave) return this.requestRepoSave();
    const name =
      get(currentFilePath) ??
      (await askFileName({
        title: "Save project",
        value: this.suggestedName ?? "my_path",
        confirmLabel: "Save",
      }));
    if (!name) return;
    try {
      await this.#overlays.saveAll();
      await browserFileStore.writeFile(name, serializeProject(this.current()));
      currentFilePath.set(name);
      this.#project.markSaved();
      showToast(`Saved ${name} in this browser`, "success");
    } catch (error) {
      console.error("Failed to save project to storage:", error);
      showToast("Couldn't save the project in the app.", "error");
    }
  }

  /** Open the actual local auto, keeping its disk revision for overwrite protection. */
  async openRepo(name: string): Promise<boolean> {
    try {
      return await workspaceOperation(async () => {
        if (
          this.#project.dirty &&
          !(await confirmDialog({
            title: "Open another auto?",
            message:
              "Keep editing to save your current changes first, or discard them and open the selected auto.",
            confirmLabel: "Discard changes",
            danger: true,
          }))
        )
          return false;
        const folder = await requireWorkspace();
        await recoverWrite(folder.folder);
        workspaceDocument.set(null);
        await refreshTeamSpots();
        await loadTeamTiming();
        const text = await readRepoAuto(folder.folder, name);
        if (text === null) throw new Error(`The checkout has no ${name}.`);
        const doc = this.read(text);
        if (!doc) return false;
        doc.activePaths = [];
        this.open(doc, { saved: true });
        const key = workspaceFileKey(folder.id, name);
        currentFilePath.set(key);
        workspaceDocument.set({
          checkoutId: folder.id,
          branch: folder.branch,
          name,
          baseline: await readFiles(
            folder.folder,
            await autoAssetPaths(folder.folder),
          ),
        });
        await browserFileStore.writeFile(key, serializeProject(doc));
        showToast(`Opened ${name} from ${folder.name}`, "success");
        return true;
      });
    } catch (error) {
      showToast(String(error), "error");
      return false;
    }
  }

  /** Save a bound auto, or explicitly import the current document into the checkout. */
  async saveWorkspace(name = get(workspaceDocument)?.name): Promise<boolean> {
    if (!name) return false;
    try {
      return await workspaceOperation(async () => {
        const binding = get(workspaceDocument);
        const folder = await requireWorkspace(binding);
        if (
          (!binding || name !== binding.name) &&
          (await readRepoAuto(folder.folder, name)) === null &&
          this.#project.doc.auto
        ) {
          this.#project.apply((doc) => ({
            ...doc,
            auto: {
              ...doc.auto!,
              exportName: name!.split("/").pop()!.replace(/\.pp$/, ""),
            },
          }));
        }
        const savedDoc = this.#project.doc;
        const text = serializeProject(
          { ...this.current(), activePaths: [] },
          { pretty: true },
        );
        const edits = get(spotEdits);
        const plan = await workspaceSavePlan(folder.folder, name, text, edits);
        const baseline =
          binding?.baseline ??
          (await readFiles(folder.folder, await autoAssetPaths(folder.folder)));
        // A new destination must not overwrite an auto without an explicit import confirmation.
        if (
          (!binding || name !== binding.name) &&
          (await folder.folder.readText(plan.ppPath)) !== null &&
          !(await confirmDialog({
            title: `Replace ${name} in the checkout?`,
            message:
              "This imports the document on screen into the selected checkout.",
            confirmLabel: "Replace auto",
            danger: true,
          }))
        )
          return false;
        const expected = { ...baseline };
        for (const path of Object.keys(plan.files))
          if (!(path in expected)) expected[path] = null;
        await writeTransaction(folder.folder, plan.files, expected);
        const savedSpotText = plan.files[SPOTS_PATH];
        if (typeof savedSpotText === "string") {
          const parsed = parseTeamSpots(savedSpotText);
          if (parsed.ok) savedSpots.set(parsed.spots);
        }
        dropSpotEdits(Object.keys(edits));
        await refreshTeamSpots();
        const key = workspaceFileKey(folder.id, name);
        currentFilePath.set(key);
        workspaceDocument.set({
          checkoutId: folder.id,
          branch: folder.branch,
          name,
          baseline: { ...expected, ...plan.files },
        });
        if (this.#project.doc === savedDoc) this.#project.markSaved();
        // Disk save succeeded even if browser recovery storage is full.
        try {
          await browserFileStore.writeFile(key, text);
        } catch {
          /* session recovery remains available */
        }
        workspaceChanged.update((n) => n + 1);
        for (const warning of plan.warnings)
          showToast(`Export: ${warning}`, "warning");
        showToast(
          `Saved ${name} to ${folder.name}${folder.branch ? ` · ${folder.branch}` : ""}. Ready for your Sloth Load.`,
          "success",
        );
        return true;
      });
    } catch (error) {
      showToast(String(error), "error");
      return false;
    }
  }

  /** Add read-only local partners around the live editor document. */
  async compareRepo(names: string[]): Promise<void> {
    try {
      const binding = get(workspaceDocument);
      if (!binding) throw new Error("Open an auto from the checkout first.");
      const folder = await requireWorkspace(binding);
      const primary = workspaceFileKey(folder.id, binding.name);
      const paths = [primary];
      for (const name of names) {
        if (!/^partners\/[A-Za-z0-9._ -]+\.pp$/.test(name))
          throw new Error("Choose a partner from the checkout.");
        const text = await folder.folder.readText(`TeamCode/autos/${name}`);
        if (!text || !this.read(text))
          throw new Error(`Cannot open partner ${name}.`);
        const key = workspaceFileKey(folder.id, name);
        await browserFileStore.writeFile(key, text);
        paths.push(key);
      }
      await browserFileStore.writeFile(
        primary,
        serializeProject(this.current()),
      );
      activePaths.set(names.length ? paths : []);
    } catch (error) {
      showToast(String(error), "error");
    }
  }

  /** Save to a file on disk through the browser's file picker. */
  async saveAs() {
    await this.#overlays.saveAll();
    const binding = get(workspaceDocument);
    const content = serializeProject(
      binding ? { ...this.current(), activePaths: [] } : this.current(),
      { pretty: true },
    );

    if (!canPickSaveFile() && !canPickExistingFile()) {
      // Browsers without file pickers (e.g. Firefox) save into app storage.
      await this.save();
      showToast(
        "This browser can't save to your computer directly, so the project was saved in the app. Download it from the file manager.",
        "info",
      );
      return;
    }

    try {
      const name = canPickSaveFile()
        ? await saveToPickedFile(
            content,
            basename(get(currentFilePath)) || `path${PROJECT_EXTENSION}`,
          )
        : await overwritePickedFile(content);
      if (!binding) {
        currentFilePath.set(name);
        this.#project.markSaved();
      }
      showToast(
        binding
          ? `Exported a copy to ${name}. Save updates your checkout.`
          : `Saved to ${name}`,
        "success",
      );
    } catch (error) {
      if (isPickerCancel(error)) return;
      console.error("Save As failed:", error);
      showToast("Couldn't save to that file.", "error");
    }
  }

  async rename() {
    if (get(workspaceDocument)) {
      showToast(
        "Use Save to repo folder to create a separately named candidate.",
        "info",
      );
      return;
    }
    const currentPath = get(currentFilePath);
    if (!currentPath) return;

    const newName = await askFileName({
      title: "Rename project",
      value: pathStem(currentPath),
      confirmLabel: "Rename",
    });
    if (!newName || newName === currentPath) return;

    try {
      if (await browserFileStore.fileExists(newName)) {
        showToast(`A file named "${newName}" already exists.`, "error");
        return;
      }
      await browserFileStore.writeFile(
        newName,
        serializeProject(this.current()),
      );
      await browserFileStore.deleteFile(currentPath);
      currentFilePath.set(newName);
      this.#project.markSaved();
      showToast(`Renamed to: ${newName}`, "success");
    } catch (error) {
      console.error("Failed to rename path file:", error);
      showToast("Failed to rename the path file.", "error");
    }
  }

  /** Save a copy mirrored across the field's center line as a new file, and open it. */
  async duplicateMirrored() {
    const name = await askFileName({
      title: "Duplicate mirrored",
      value: `${pathStem(get(currentFilePath)) || "path"}_mirrored`,
      confirmLabel: "Create",
    });
    if (!name) return;
    try {
      if (
        (await browserFileStore.fileExists(name)) &&
        !(await confirmDialog({
          title: `Overwrite ${name}?`,
          message: "A file with this name already exists.",
          confirmLabel: "Overwrite",
          danger: true,
        }))
      ) {
        return;
      }
      const mirrored = mirrorProject(this.current());
      await browserFileStore.writeFile(name, serializeProject(mirrored));
      this.open(mirrored);
      currentFilePath.set(name);
      showToast(`Created ${name}`, "success");
    } catch (error) {
      console.error("Failed to save the mirrored project:", error);
      showToast("Couldn't save the mirrored project.", "error");
    }
  }

  /** Ask for a project file on disk and open it. */
  openFromDisk() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = OPENABLE_EXTENSIONS.join(",");
    input.onchange = () => void this.upload(input);
    input.click();
  }

  /** Open a file chosen from disk and keep a copy in app storage. */
  async upload(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    if (!OPENABLE_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
      showToast(`Please select a ${PROJECT_EXTENSION} file`, "error");
      return;
    }

    const doc = this.read(await file.text());
    if (!doc) return;
    this.open(doc);
    try {
      await browserFileStore.writeFile(file.name, serializeProject(doc));
      currentFilePath.set(file.name);
    } catch (error) {
      console.warn("Failed to cache uploaded file to store:", error);
    }
  }

  /**
   * Reopen the last session if one was left unsaved; otherwise start the fresh
   * document from the robot the user last configured. Autosave starts after.
   */
  start() {
    const snapshot = loadSessionSnapshot();
    if (snapshot) {
      this.#prefs.value = snapshot.settings;
      this.open(snapshot.project, { saved: false });
      currentFilePath.set(snapshot.currentFilePath);
      workspaceDocument.set(snapshot.workspaceDocument ?? null);
    } else {
      this.#project.load({
        ...this.#project.doc,
        // Fork: a fresh project is drawn for the team's robot.
        robot: { ...this.#prefs.fallbackRobot, ...TEAM_ROBOT },
      });
    }
    this.#started = true;
  }

  /** Keep the session snapshot current. Call during component setup. */
  autosaveSession() {
    const save = debounce(saveSessionSnapshot, 750);
    $effect(() => {
      if (!this.#started || this.holdAutosave) return;
      save({
        project: this.current(),
        settings: this.#prefs.settings,
        currentFilePath: this.#filePath.current,
        workspaceDocument: this.#workspace.current,
      });
    });
    $effect(() => () => save.flush());
  }
}
