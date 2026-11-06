<script lang="ts">
  /**
   * Fork: "Save to repo folder" (lib/repo/repoFolder.ts). Writes the Auto's .pp and its Java
   * into the biobuzz checkout on this laptop, the same bytes "Save to GitHub" commits, so the
   * competition-day loop is save, then Sloth Load; no internet, no files to move by hand. The
   * folder is picked once (Chrome and Edge) and remembered; afterwards the browser only asks to
   * allow access again.
   */
  import Modal from "../components/ui/Modal.svelte";
  import { showToast } from "../toast";
  import { baseName } from "../sim/biobuzz";
  import { teamFileOf } from "../team/teamAutos";
  import { refreshTeamSpots, spotsStatus } from "../team/spotsStore";
  import {
    listRepoAutos,
    listRepoDrafts,
    repoFileProblem,
    repoSaveFiles,
  } from "./repoFolder";
  import {
    allowRepoFolder,
    canPickFolder,
    forgetRepoFolder,
    isPickerCancel,
    pickRepoFolder,
    readyRepoFolder,
    repoFolder,
  } from "./repoStore";

  interface Props {
    isOpen?: boolean;
    /** The file open in the editor, e.g. "r-solo.pp" (empty if none). */
    fileName: string;
    /** Where in biobuzz the open project was read from, if it was. */
    source: { ref: string | null; path: string } | null;
    /** The open project as it would be saved: the bytes the .pp gets. */
    projectText: () => string;
    saveProject: (name: string) => Promise<boolean>;
  }

  let {
    isOpen = $bindable(false),
    fileName,
    source,
    projectText,
    saveProject,
  }: Props = $props();

  const supported = canPickFolder();
  let name = $state("");
  let known = $state<string[]>([]);
  let busy = $state(false);
  let blocked = $state<string[]>([]);
  let saved = $state<{ folder: string; paths: string[] } | null>(null);

  let problem = $derived(repoFileProblem(name));
  /** Saving would make a file the checkout does not have yet. */
  let isNew = $derived(known.length > 0 && !known.includes(name.trim()));

  $effect(() => {
    if (isOpen) opened();
  });

  function opened() {
    blocked = [];
    saved = null;
    // The file it came from, else the file on screen (a team copy by the team's name).
    name = source ? baseName(source.path) : (teamFileOf(fileName) ?? fileName);
    void listKnown();
  }

  async function listKnown() {
    const folder = $repoFolder;
    known = [];
    if (!folder || folder.permission !== "granted") return;
    try {
      known = [
        ...(await listRepoAutos(folder.folder)),
        ...(await listRepoDrafts(folder.folder)),
      ];
    } catch {
      // The list is a convenience; the save checks the folder itself.
    }
  }

  async function choose() {
    busy = true;
    blocked = [];
    try {
      const picked = await pickRepoFolder();
      showToast(`Using ${picked.name} as the biobuzz checkout`, "success");
      await listKnown();
      if ($spotsStatus !== "ok") void refreshTeamSpots();
    } catch (error) {
      if (!isPickerCancel(error)) blocked = [(error as Error).message];
    } finally {
      busy = false;
    }
  }

  async function allow() {
    busy = true;
    try {
      const folder = await allowRepoFolder();
      if (folder?.permission === "granted") {
        await listKnown();
        if ($spotsStatus !== "ok") void refreshTeamSpots();
      }
    } finally {
      busy = false;
    }
  }

  async function forget() {
    await forgetRepoFolder();
    known = [];
    saved = null;
  }

  async function save() {
    blocked = [];
    saved = null;
    if (problem) return void (blocked = [problem]);
    if (
      isNew &&
      !confirm(
        `${name.trim()} is not in ${$repoFolder?.name ?? "the checkout"}'s TeamCode/autos yet. Save the project on screen as a new Auto there?`,
      )
    )
      return;
    busy = true;
    try {
      // Allowing access needs this click, so it happens here, right before the write.
      const folder = await readyRepoFolder();
      if (!folder) {
        blocked = [
          "The browser did not allow writing to the folder. Allow it, or pick the folder again.",
        ];
        return;
      }
      const result = repoSaveFiles(name, projectText());
      if (!result.ok) {
        blocked = result.errors;
        return;
      }
      if (!(await saveProject(name.trim()))) return;
      const actual = repoSaveFiles(name, projectText());
      saved = {
        folder: folder.name,
        paths: Object.keys(actual.ok ? actual.files : result.files),
      };
      showToast(
        `Saved into ${folder.name}. Sloth Load from Android Studio to put it on the robot.`,
        "success",
      );
      await listKnown();
    } catch (error) {
      blocked = [`Could not write to the folder: ${(error as Error).message}`];
    } finally {
      busy = false;
    }
  }

  function close() {
    isOpen = false;
  }
</script>

<Modal
  {isOpen}
  titleId="repo-save-title"
  panelClass="console-panel p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
  onClose={close}
>
  <h2 id="repo-save-title" class="text-xl font-semibold text-heading mb-1">
    Save to repo folder
  </h2>
  <p class="text-xs text-body mb-4">
    Writes the Auto's <code>.pp</code> and its Java into the biobuzz checkout on this
    laptop, exactly what Save to GitHub would commit. No internet needed.
  </p>

  {#if !supported}
    <p class="text-sm text-heading">
      This browser cannot write into a folder on this computer. Open the
      Visualizer in Chrome or Edge on the laptop with the biobuzz checkout, or
      use Save to GitHub.
    </p>
  {:else if !$repoFolder}
    <div class="text-sm text-heading flex flex-col gap-3">
      <p>
        Pick the biobuzz checkout once: the folder that holds <code
          >TeamCode</code
        >
        (it must have <code>TeamCode/autos/spots.json</code>). This browser
        remembers it; later saves only ask to allow access again.
      </p>
      <div>
        <button
          class="console-action console-action--accent"
          onclick={choose}
          disabled={busy}>Choose the biobuzz folder…</button
        >
      </div>
    </div>
  {:else}
    <p class="text-xs text-body mb-3">
      Checkout: <b class="text-heading">{$repoFolder.name}</b>
      · {$repoFolder.branch ?? "branch unavailable"}
      {#if $repoFolder.permission !== "granted"}
        · <button class="underline" onclick={allow} disabled={busy}
          >allow access</button
        >
      {/if}
      ·
      <button class="underline" onclick={choose} disabled={busy}
        >change folder</button
      >
      ·
      <button class="underline" onclick={forget} disabled={busy}
        >forget it</button
      >
    </p>

    <div
      class="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 items-center text-sm text-heading"
    >
      <label for="repo-name">File</label>
      <input
        id="repo-name"
        bind:value={name}
        list="repo-files"
        class="console-input px-2 py-1"
        placeholder="r-solo.pp"
      />
    </div>
    <datalist id="repo-files">
      {#each known as f (f)}
        <option value={f}></option>
      {/each}
    </datalist>

    <div class="flex items-center justify-between gap-3 mt-4">
      <p class="text-xs {problem ? 'text-warning' : 'text-body'}">
        {#if problem}
          {problem}.
        {:else}
          Writes <code>TeamCode/autos/{name.trim()}</code>
          {#if isNew}<strong class="text-warning">(a new file)</strong
            >{:else}(replaced){/if} and its Java in
          <code>opmodes/auto/generated/</code>. Shared spot changes also update
          affected autos.
        {/if}
      </p>
      <button
        class="console-action console-action--accent shrink-0"
        onclick={save}
        disabled={busy || !!problem}
      >
        {busy ? "Saving…" : "Save to folder"}
      </button>
    </div>
  {/if}

  {#if blocked.length}
    <div class="mt-4 text-sm text-danger">
      <p class="font-semibold">Not saved:</p>
      <ul class="list-disc ml-5">
        {#each blocked as message, i (i)}<li>{message}</li>{/each}
      </ul>
    </div>
  {/if}

  {#if saved}
    <div class="mt-4 text-sm text-heading border-t border-border pt-3">
      <p>
        <b>Saved into {saved.folder}.</b> Sloth Load from Android Studio to put it
        on the robot.
      </p>
      <ul class="list-disc ml-5 mt-1 text-xs text-body">
        {#each saved.paths as path (path)}<li><code>{path}</code></li>{/each}
      </ul>
    </div>
  {/if}

  {#if supported}
    <p class="mt-4 text-xs text-body">
      Later saves use this checkout directly. Preserve tested versions in
      Workspace. Commit and push useful event checkpoints when ready; merge
      successful changes into master afterwards.
    </p>
  {/if}
</Modal>
