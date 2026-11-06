<script lang="ts">
  import { untrack } from "svelte";
  import { get } from "svelte/store";
  import Modal from "../components/ui/Modal.svelte";
  import { confirmDialog } from "../dialog";
  import { useProject } from "../../state/project.svelte";
  import type { ProjectFiles } from "../../state/files.svelte";
  import { canPickFolder, pickRepoFolder, repoFolder } from "./repoStore";
  import { listRepoAutos, listRepoDrafts } from "./repoFolder";
  import {
    workspaceDocument,
    workspaceBusy,
    workspaceError,
    workspaceOperation,
    requireWorkspace,
    workspaceChanged,
  } from "./workspaceStore";
  import {
    createCheckpoint,
    listCheckpoints,
    listPartners,
    recoverWrite,
    restoreCheckpoint,
    type Checkpoint,
  } from "./workspaceFiles";
  import {
    refreshTeamSpots,
    spotEdits,
    discardSpotEdits,
  } from "../team/spotsStore";
  import { loadTeamTiming } from "../timing/store";
  import { showToast } from "../toast";

  let {
    isOpen = $bindable(false),
    files,
  }: { isOpen?: boolean; files: ProjectFiles } = $props();
  const project = useProject();
  let autos = $state<string[]>([]);
  let partners = $state<string[]>([]);
  let selected = $state("");
  let partner = $state("");
  let checkpointName = $state("");
  let checkpoints = $state<Checkpoint[]>([]);
  let loading = $state(false);
  let message = $state("");

  $effect(() => {
    if (isOpen) untrack(() => void refresh());
  });

  async function refresh() {
    if (!get(repoFolder)) return;
    loading = true;
    message = "";
    try {
      await workspaceOperation(async () => {
        const checkout = await requireWorkspace();
        await recoverWrite(checkout.folder);
        autos = [
          ...(await listRepoAutos(checkout.folder)),
          ...(await listRepoDrafts(checkout.folder)),
        ];
        partners = await listPartners(checkout.folder);
        checkpoints = (await listCheckpoints(checkout.folder)).filter(
          (p) => p.branch === checkout.branch,
        );
        selected = get(workspaceDocument)?.name ?? autos[0] ?? "";
        if (!partners.includes(partner)) partner = "";
      });
    } catch (error) {
      message = String(error);
    } finally {
      loading = false;
    }
  }

  async function choose() {
    try {
      await pickRepoFolder();
      await refreshTeamSpots();
      await loadTeamTiming();
      await refresh();
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        message = String(error);
    }
  }

  async function open() {
    if (await files.openRepo(selected)) {
      await files.compareRepo(partner ? [partner] : []);
      isOpen = false;
    }
  }

  async function compare() {
    await files.compareRepo(partner ? [partner] : []);
    isOpen = false;
  }

  async function editPartner() {
    if (partner && (await files.openRepo(partner))) isOpen = false;
  }

  async function checkpoint() {
    try {
      await workspaceOperation(async () => {
        const binding = get(workspaceDocument);
        if (!binding) throw new Error("Open an auto from this checkout first.");
        if (project.dirty || Object.keys(get(spotEdits)).length)
          throw new Error(
            "Save the current auto first. Mark it tested after you have run that saved version on the robot.",
          );
        const checkout = await requireWorkspace(binding);
        for (const [path, text] of Object.entries(binding.baseline)) {
          if ((await checkout.folder.readText(path)) !== text)
            throw new Error(
              "Auto files changed on disk. Reopen the auto before marking a tested version.",
            );
        }
        await createCheckpoint(
          checkout.folder,
          checkpointName.trim() || `Tested ${binding.name}`,
          checkout.branch,
          true,
        );
        checkpointName = "";
        showToast("Tested checkpoint preserved on this laptop.", "success");
      });
      await refresh();
    } catch (error) {
      message = String(error);
    }
  }

  async function restore(point: Checkpoint) {
    if (
      !(await confirmDialog({
        title: `Restore ${point.name}?`,
        message:
          "Restores the saved autos, their Java, shared spots, and timing together. The current experiment is backed up first. Unrelated robot code is untouched.",
        confirmLabel: "Restore checkpoint",
      }))
    )
      return;
    try {
      // Preserve unsaved editor work in the experiment backup before restoring disk files.
      if (project.dirty || Object.keys(get(spotEdits)).length) {
        if (!(await files.saveWorkspace())) return;
      }
      const name = get(workspaceDocument)?.name;
      await workspaceOperation(async () => {
        const checkout = await requireWorkspace(get(workspaceDocument));
        await restoreCheckpoint(checkout.folder, point, checkout.branch);
        discardSpotEdits();
        await refreshTeamSpots();
        await loadTeamTiming();
        workspaceChanged.update((n) => n + 1);
      });
      if (name && point.files[`TeamCode/autos/${name}`])
        await files.openRepo(name);
      else workspaceDocument.set(null);
      await refresh();
      showToast(
        `Restored ${point.name}. Ready for your Sloth Load.`,
        "success",
      );
    } catch (error) {
      message = String(error);
    }
  }
</script>

<Modal
  {isOpen}
  titleId="workspace-title"
  onClose={() => (isOpen = false)}
  panelClass="console-panel p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
>
  <h2 id="workspace-title" class="text-xl font-semibold text-heading mb-2">
    Local auto workspace
  </h2>
  <p class="text-sm text-body mb-4">
    Open and save in the same BIOBUZZ checkout you use in Android Studio. No
    push, PR, or CI is needed to tune an auto.
  </p>
  {#if !canPickFolder()}
    <p class="text-heading">
      Use Chrome or Edge to connect your BIOBUZZ folder.
    </p>
  {:else}
    <div class="flex flex-wrap gap-3 items-center mb-4">
      <b class="text-heading"
        >{$repoFolder
          ? `${$repoFolder.name} · ${$repoFolder.branch ?? "branch unavailable"}`
          : "No checkout connected"}</b
      >
      <button
        class="console-action"
        onclick={choose}
        disabled={loading || $workspaceBusy}
        >{$repoFolder ? "Change checkout…" : "Choose BIOBUZZ checkout…"}</button
      >
      {#if $repoFolder}<button
          class="console-action"
          onclick={refresh}
          disabled={loading || $workspaceBusy}>Refresh / allow access</button
        >{/if}
    </div>
    {#if $repoFolder?.branch === "master" || $repoFolder?.branch === "main"}
      <p class="text-warning text-sm mb-3">
        This checkout is on {$repoFolder.branch}. Select your event branch in
        Android Studio before tuning, then reopen the auto here.
      </p>
    {:else if $repoFolder && !$repoFolder.branch}
      <p class="text-body text-sm mb-3">
        The browser cannot read this checkout's Git branch. Confirm the event
        branch in Android Studio. Saves still target this folder.
      </p>
    {/if}
    {#if $repoFolder?.permission === "granted"}
      <div class="grid gap-3 mb-4 text-sm text-heading">
        <label
          >Auto in checkout
          <select
            class="console-input w-full mt-1"
            bind:value={selected}
            disabled={loading}
            >{#each autos as name (name)}<option value={name}>{name}</option
              >{/each}</select
          >
        </label>
        <label
          >Compare with partner
          <select
            class="console-input w-full mt-1"
            bind:value={partner}
            disabled={loading}
            ><option value="">No partner</option
            >{#each partners as name (name)}<option value={name}
                >{name.slice(9, -3)}</option
              >{/each}</select
          >
        </label>
        <p class="text-xs text-body">
          Partners are references from this checkout. Your current auto stays
          live while you edit; Save writes that same auto back here.
        </p>
        <div class="flex gap-2">
          <button
            class="console-action console-action--accent"
            onclick={open}
            disabled={!selected || loading || $workspaceBusy}>Open auto</button
          >
          {#if $workspaceDocument}<button
              class="console-action"
              onclick={compare}
              disabled={loading || $workspaceBusy}>Update partner only</button
            >{/if}
          <button
            class="console-action"
            onclick={editPartner}
            disabled={!partner || loading || $workspaceBusy}
            >Edit selected partner</button
          >
        </div>
      </div>
      <div class="border-t border-border pt-4 text-heading text-sm">
        <h3 class="font-semibold mb-2">Tested versions</h3>
        <p class="text-xs text-body mb-2">
          After testing the saved auto on the robot, preserve it here. Each
          checkpoint also keeps the related autos and shared files consistent.
          Checkpoints live on this laptop; commit and push the working sources
          when you want to share them.
        </p>
        <label
          >Checkpoint name<input
            class="console-input w-full my-2"
            bind:value={checkpointName}
            placeholder="Belding · R-Solo after practice"
          /></label
        >
        <button
          class="console-action"
          onclick={checkpoint}
          disabled={!$workspaceDocument || $workspaceBusy || loading}
          >Mark saved auto tested</button
        >
        <div class="flex flex-col gap-2 mt-3">
          {#each checkpoints as point (point.id)}
            <div class="flex gap-3 items-center">
              <span class="flex-1"
                >{point.name}
                <span class="text-xs text-body"
                  >{point.tested ? "tested" : "experiment backup"} · {new Date(
                    point.createdAt,
                  ).toLocaleString()}</span
                ></span
              ><button
                class="console-action"
                onclick={() => restore(point)}
                disabled={$workspaceBusy || loading}>Restore</button
              >
            </div>
          {/each}
          {#if !checkpoints.length}<p class="text-xs text-body">
              No checkpoints for this event yet.
            </p>{/if}
        </div>
      </div>
    {/if}
  {/if}
  {#if message || $workspaceError}<p
      role="alert"
      class="text-danger text-sm mt-3"
    >
      {message || $workspaceError}
    </p>{/if}
  <div class="flex justify-end mt-4">
    <button class="console-action" onclick={() => (isOpen = false)}
      >Close</button
    >
  </div>
</Modal>
