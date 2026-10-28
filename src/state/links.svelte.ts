import { getContext, setContext, tick } from "svelte";
import { fromStore, get } from "svelte/store";
import { serializeProject, type ProjectDoc } from "../io";
import { currentFilePath } from "../stores";
import { confirmDialog } from "../lib/dialog";
import { showToast } from "../lib/toast";
import { currentText } from "../lib/github/api";
import {
  deleteDraft,
  draftStatus,
  loadDraft,
  projectFingerprint,
  saveDraft,
} from "../lib/session/drafts";
import {
  freeSharedFileName,
  sharedCopyState,
  type SharedCopyView,
} from "../lib/session/sharedCopy";
import { gitHash, gitLinkFor, gitPath, resolveGitHash } from "../utils/gitLink";
import { resolveProjectHash } from "../utils/sampleLink";
import { publicAsset } from "../utils/publicAsset";
import { basename, pathStem } from "../utils/filename";
import * as browserFileStore from "../utils/browserFileStore";
import type { ProjectFiles } from "./files.svelte";
import type { ProjectStore } from "./project.svelte";

export const DRAFT_LABEL = {
  same: "same as GitHub",
  edited: "your draft · edited",
  "newer-on-github": "GitHub has a newer version",
  "edited-and-newer": "your draft · GitHub has a newer version",
} as const;

export type DraftState = keyof typeof DRAFT_LABEL;

/** A file opened from biobuzz, and the draft of it kept in this browser. */
export interface GitDraft {
  ref: string | null;
  path: string;
  /** GitHub's text when the draft began, and that version's fingerprint. */
  baseText: string;
  baseFingerprint: string;
  /** GitHub's text when the link was opened. */
  githubText: string;
  /** When the draft that was loaded had last been edited, if one was. */
  draftFrom: number | null;
}

/**
 * Fork: projects opened from a link. A share link (`#data=`), a sample
 * (`#sample=`) or a file in biobuzz (`#gh=`) is shown as a copy: the viewer's
 * own work is set aside and nothing is autosaved over it until the copy is
 * closed. A file from biobuzz keeps every edit as a draft in this browser
 * (lib/session/drafts.ts) until Save to GitHub.
 */
export class SharedLinks {
  copy = $state<SharedCopyView | null>(null);
  error = $state<string | null>(null);
  draft = $state<GitDraft | null>(null);
  /** Where in biobuzz the project came from, so Save to GitHub saves it back there. */
  source = $state<{ ref: string | null; path: string } | null>(null);

  #project: ProjectStore;
  #files: ProjectFiles;
  #filePath = fromStore(currentFilePath);
  #stash: { doc: ProjectDoc; filePath: string | null; dirty: boolean } | null =
    null;
  #timer: ReturnType<typeof setTimeout> | null = null;

  fingerprint = $derived(this.copy && this.draft ? this.#fingerprint() : null);
  edited = $derived(
    this.draft !== null &&
      this.fingerprint !== null &&
      this.fingerprint !== this.draft.baseFingerprint,
  );
  status = $derived<DraftState | null>(
    this.draft && this.copy
      ? draftStatus(this.edited, this.draft.baseText, this.draft.githubText)
      : null,
  );
  /** The biobuzz file on screen and where its draft stands, for the top bar. */
  githubFile = $derived(
    this.status && this.draft
      ? {
          name: basename(this.draft.path),
          label: DRAFT_LABEL[this.status],
          changed: this.status !== "same",
        }
      : null,
  );
  /** `source`, while that file (or the copy read from it) is what is on screen. */
  sourceOnScreen = $derived(
    this.source &&
      (this.copy ||
        basename(this.source.path) === basename(this.#filePath.current))
      ? this.source
      : null,
  );

  /** The open file's name, or the shared copy's: what an exported Auto names as its source. */
  sourceName = $derived(
    basename(this.#filePath.current) || basename(this.copy?.name) || null,
  );

  constructor(project: ProjectStore, files: ProjectFiles) {
    this.#project = project;
    this.#files = files;

    $effect.pre(() => {
      files.holdAutosave = this.copy !== null;
      files.suggestedName = this.draft
        ? basename(this.draft.path)
        : this.copy
          ? `${pathStem(this.copy.name) || "shared"}-copy`
          : null;
    });

    // Every edit to a file from biobuzz is kept as its draft.
    $effect(() => {
      const fingerprint = this.fingerprint;
      const draft = this.draft;
      if (!draft || fingerprint === null) return;
      if (this.#timer) clearTimeout(this.#timer);
      this.#timer = setTimeout(() => {
        if (fingerprint === draft.baseFingerprint)
          deleteDraft(draft.ref, draft.path);
        else if (
          !saveDraft({
            ref: draft.ref,
            path: draft.path,
            text: fingerprint,
            baseText: draft.baseText,
            baseFingerprint: draft.baseFingerprint,
            editedAt: Date.now(),
          })
        ) {
          showToast(
            "This browser would not keep your draft: Save to GitHub before closing the tab.",
            "warning",
          );
        }
      }, 400);
    });

    // Opening or saving a file some other way makes that file the work on
    // screen; the shared copy and the set-aside work are let go.
    $effect(() => {
      if (this.copy && this.#filePath.current) {
        this.copy = null;
        this.#stash = null;
      }
    });
  }

  /** Open the address bar's link now and whenever it changes. Returns the cleanup. */
  start(): () => void {
    const open = () => void this.openLink();
    void this.openLink();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }

  #fingerprint(): string {
    return projectFingerprint(JSON.parse(serializeProject(this.#project.doc)));
  }

  async openLink() {
    const gitResult = await resolveGitHash(
      window.location.hash,
      async (url, link) => {
        // GitHub's API has the file as it is now; raw.githubusercontent.com is the
        // fallback when the API refuses (about 60 requests an hour without a token).
        try {
          return await currentText(gitPath(link), link.ref);
        } catch {
          // Fall through to the raw file.
        }
        const response = await fetch(url, { cache: "no-cache" });
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
        return response.text();
      },
    );
    const result =
      gitResult.kind !== "none"
        ? gitResult
        : await resolveProjectHash(window.location.hash, async (fileName) => {
            const response = await fetch(publicAsset(`/samples/${fileName}`), {
              cache: "no-cache",
            });
            return response.ok ? response.text() : null;
          });
    if (result.kind === "none") return;
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
    if (result.kind === "error") {
      this.error = result.message;
      return;
    }
    this.error = null;

    const { project, name } = result.shared;
    // Opening a second link while a copy is shown keeps the first stash:
    // that is the viewer's own work.
    this.#stash ??= {
      doc: this.#project.doc,
      filePath: get(currentFilePath),
      dirty: this.#project.dirty,
    };
    if (!this.#apply(project)) return;
    // Let the Auto settle (pins, link paths) before taking GitHub's version
    // as the draft's baseline, or opening it would count as an edit.
    await tick();
    this.source = result.shared.git ?? null;
    this.copy = {
      name,
      madeAt: typeof project.timestamp === "string" ? project.timestamp : null,
      savedAs: null,
      from: result.shared.from ?? null,
    };

    // From biobuzz: your draft of it if you have one, else GitHub's version.
    const git = result.shared.git;
    this.draft = null;
    if (!git) return;
    const draft = loadDraft(git.ref, git.path);
    const githubFingerprint = this.#fingerprint();
    this.draft = {
      ref: git.ref,
      path: git.path,
      baseText: draft?.baseText ?? git.text,
      baseFingerprint: draft?.baseFingerprint ?? githubFingerprint,
      githubText: git.text,
      draftFrom: draft?.editedAt ?? null,
    };
    if (!draft) return;
    try {
      if (this.#apply(JSON.parse(draft.text), { quiet: true })) return;
    } catch {
      // An unreadable draft: GitHub's version stays on screen.
    }
    deleteDraft(git.ref, git.path);
    this.#apply(project, { quiet: true });
    await tick();
    this.draft = {
      ...this.draft,
      baseText: git.text,
      baseFingerprint: githubFingerprint,
      draftFrom: null,
    };
  }

  /** Puts a project read from a link (or a draft of one) on screen as the shared copy. */
  #apply(raw: Record<string, unknown>, { quiet = false } = {}): boolean {
    const result = sharedCopyState(raw, this.#project.doc.robot);
    if (!result.ok) {
      if (!quiet) this.error = result.error;
      return false;
    }
    if (!quiet)
      result.warnings.forEach((warning) => showToast(warning, "warning"));
    // No file is open, so Save cannot write over one; the viewer's other
    // files are not overlaid on someone else's Auto.
    currentFilePath.set(null);
    this.#files.open({ ...result.doc, activePaths: [] });
    return true;
  }

  /** Throws away the draft and opens GitHub's version afresh. */
  async discardDraft() {
    const draft = this.draft;
    if (!draft) return;
    if (
      this.edited &&
      !(await confirmDialog({
        title: "Throw away your edits?",
        message: `Your edits to ${draft.path} go, and GitHub's version opens.`,
        confirmLabel: "Throw away",
        danger: true,
      }))
    ) {
      return;
    }
    if (this.#timer) clearTimeout(this.#timer);
    this.draft = null;
    deleteDraft(draft.ref, draft.path);
    window.location.hash = gitHash(gitLinkFor(draft.ref, draft.path));
  }

  /** After Save to GitHub: GitHub has exactly what is on screen, so there is no draft. */
  savedToGithub(branch: string, path: string, text: string) {
    this.source = { ref: branch, path };
    if (!this.draft) return;
    if (this.#timer) clearTimeout(this.#timer);
    deleteDraft(this.draft.ref, this.draft.path);
    this.draft = {
      ref: branch,
      path,
      baseText: text,
      baseFingerprint: this.#fingerprint(),
      githubText: text,
      draftFrom: null,
    };
  }

  /** Close the shared copy and put the viewer's own work back. */
  close() {
    const stash = this.#stash;
    if (this.#timer) clearTimeout(this.#timer);
    this.draft = null;
    this.copy = null;
    this.#stash = null;
    if (!stash) return;
    this.#files.open(stash.doc, { saved: !stash.dirty });
    currentFilePath.set(stash.filePath);
  }

  /** Save the shared copy as a new file in the browser's file list; it stays on screen. */
  async saveCopy() {
    const copy = this.copy;
    if (!copy) return;
    // A copy of a biobuzz Auto keeps its file name, so Save to GitHub from it
    // later still finds the file it came from.
    this.#files.suggestedName = this.draft
      ? basename(this.draft.path)
      : await freeSharedFileName(copy.name, browserFileStore.fileExists);
    await this.#files.save();
  }
}

const CONTEXT_KEY = Symbol("links");

export function provideLinks(links: SharedLinks) {
  setContext(CONTEXT_KEY, links);
}

export function useLinks(): SharedLinks {
  return getContext<SharedLinks>(CONTEXT_KEY);
}
