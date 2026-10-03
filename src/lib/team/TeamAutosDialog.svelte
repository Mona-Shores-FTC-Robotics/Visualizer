<script lang="ts">
  /**
   * Team Autos: pick Autos from biobuzz's TeamCode/autos on a branch and see them together,
   * Reload them after a push, and copy a link that opens the same view on any laptop.
   * Also opens `#team=` links on load and whenever the address changes.
   */
  import { onMount } from "svelte";
  import Modal from "../components/ui/Modal.svelte";
  import {
    DEFAULT_REF,
    listTeamFiles,
    loadPairs,
    MAX_FILES,
    TEAM_DIR,
    type TeamPair,
  } from "./teamAutos";
  import {
    openTeamHash,
    reloadTeamView,
    showTeamView,
    teamView,
    teamViewLink,
  } from "./teamView";
  import { showToast } from "../toast";

  interface Props {
    isOpen?: boolean;
  }
  let { isOpen = $bindable(false) }: Props = $props();

  // Renamed from "teamAutosBranch", which remembered "master" (it has no Autos) for some laptops.
  const BRANCH_KEY = "teamAutosRef";
  function savedBranch(): string {
    try {
      return localStorage.getItem(BRANCH_KEY) || DEFAULT_REF;
    } catch {
      return DEFAULT_REF;
    }
  }

  let branch = $state(savedBranch());
  let files: string[] = $state([]);
  let pairs: TeamPair[] = $state([]);
  let selected: string[] = $state([]);
  let loading = $state(false);
  let busy = $state(false);
  let errorMessage = $state("");
  let loadedFor = "";

  async function load() {
    const ref = branch.trim();
    if (!ref) return;
    loading = true;
    errorMessage = "";
    try {
      [files, pairs] = await Promise.all([listTeamFiles(ref), loadPairs(ref)]);
      loadedFor = ref;
      // Remember only a branch that has Autos, so an empty one is not the next default.
      if (files.length > 0)
        try {
          localStorage.setItem(BRANCH_KEY, ref);
        } catch {
          /* private window: the branch is just not remembered */
        }
    } catch (error) {
      files = [];
      pairs = [];
      errorMessage = (error as Error).message;
    } finally {
      loading = false;
    }
  }

  $effect.pre(() => {
    if (isOpen && loadedFor !== branch.trim()) {
      selected =
        $teamView && $teamView.ref === branch.trim()
          ? [...$teamView.files]
          : [];
      load();
    }
  });

  function toggle(file: string) {
    if (selected.includes(file)) {
      selected = selected.filter((f) => f !== file);
    } else if (selected.length >= MAX_FILES) {
      showToast(`At most ${MAX_FILES} Autos at once.`, "warning");
    } else {
      selected = [...selected, file];
    }
  }

  async function show(chosen: string[], pair: TeamPair | null = null) {
    if (chosen.length === 0) return;
    busy = true;
    const ok = await showTeamView(branch.trim(), chosen, pair?.name ?? null, pair?.links ?? []);
    busy = false;
    if (ok) isOpen = false;
  }

  async function reload() {
    busy = true;
    await reloadTeamView();
    busy = false;
  }

  async function copyLink() {
    if (!$teamView) return;
    const link = teamViewLink($teamView);
    try {
      await navigator.clipboard.writeText(link);
      showToast(
        "Link copied: it opens these Autos, latest version, on any laptop.",
        "success",
      );
    } catch {
      window.prompt("Copy this link:", link);
    }
  }

  function age(ms: number): string {
    const s = Math.round((Date.now() - ms) / 1000);
    return s < 60 ? "just now" : `${Math.round(s / 60)} min ago`;
  }

  onMount(() => {
    // After the app has restored the last session, so that does not replace the view.
    setTimeout(openTeamHash, 0);
    window.addEventListener("hashchange", openTeamHash);
    return () => window.removeEventListener("hashchange", openTeamHash);
  });
</script>

<Modal
  {isOpen}
  titleId="team-autos-title"
  onClose={() => (isOpen = false)}
  panelClass="console-panel console-flat p-6 w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col"
>
  <h2
    id="team-autos-title"
    class="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-1"
  >
    Team Autos
  </h2>
  <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
    The latest pushed Autos in biobuzz <code>{TEAM_DIR}</code>. Pick up to {MAX_FILES}
    to watch together. They open as copies named <code>biobuzz-…</code>; your
    own files are not touched.
  </p>

  <div class="flex items-center gap-2 mb-4">
    <label
      for="team-branch"
      class="text-sm font-medium text-neutral-700 dark:text-neutral-300"
      >Branch</label
    >
    <input
      id="team-branch"
      class="console-input flex-1 px-2 py-1 text-sm"
      bind:value={branch}
      placeholder={DEFAULT_REF}
      onkeydown={(e) => e.key === "Enter" && load()}
    />
    <button class="console-action text-sm" onclick={load} disabled={loading}>
      {loading ? "Loading…" : "List"}
    </button>
  </div>

  {#if $teamView}
    <div
      class="console-section mb-4 p-3 flex flex-wrap items-center gap-2 text-sm"
    >
      <span class="flex-1 text-neutral-700 dark:text-neutral-300">
        Showing <strong>{$teamView.files.join(" + ")}</strong> from {$teamView.ref},
        fetched
        {age($teamView.fetchedAt)}.
      </span>
      <button class="console-action" onclick={reload} disabled={busy}
        >Reload latest</button
      >
      <button class="console-action" onclick={copyLink}>Copy link</button>
    </div>
  {/if}

  <div class="console-section flex-1 overflow-y-auto mb-4">
    {#if loading}
      <div class="p-6 text-center text-neutral-500">Loading…</div>
    {:else if errorMessage}
      <div class="p-6 text-center text-red-500">{errorMessage}</div>
    {:else}
      {#if pairs.length > 0}
        <div
          class="px-4 pt-3 pb-1 text-xs font-semibold uppercase text-neutral-500"
        >
          Pairs
        </div>
        {#each pairs as pair (pair.name)}
          <button
            class="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700/50"
            onclick={() => show(pair.files, pair)}
            disabled={busy}
          >
            <span class="font-medium text-neutral-900 dark:text-neutral-100"
              >{pair.name}</span
            >
            <span class="text-xs text-neutral-500"
              >{pair.files.join(" + ")}</span
            >
            {#if pair.note}<span
                class="text-xs text-neutral-500 flex-1 text-right"
                >{pair.note}</span
              >{/if}
          </button>
        {/each}
      {/if}
      <div
        class="px-4 pt-3 pb-1 text-xs font-semibold uppercase text-neutral-500"
      >
        Autos
      </div>
      {#if files.length === 0}
        <div class="p-4 text-sm text-neutral-500">
          No .pp files in {TEAM_DIR} on this branch. The team's Autos are on
          <code>{DEFAULT_REF}</code>.
        </div>
      {/if}
      {#each files as file (file)}
        {@const n = selected.indexOf(file)}
        <button
          class="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700/50"
          onclick={() => toggle(file)}
        >
          {#if n >= 0}
            <span
              class="size-6 console-badge bg-purple-600 text-white text-sm font-bold flex items-center justify-center"
              >{n + 1}</span
            >
          {:else}
            <span
              class="size-6 border-2 border-neutral-300 dark:border-neutral-600"
            ></span>
          {/if}
          <span class="text-neutral-900 dark:text-neutral-100">{file}</span>
        </button>
      {/each}
    {/if}
  </div>

  <div class="flex justify-end gap-2">
    <button class="console-action" onclick={() => (isOpen = false)}
      >Close</button
    >
    <button
      class="console-action console-action--accent"
      onclick={() => show(selected)}
      disabled={busy || selected.length === 0}
    >
      Show {selected.length || ""} together
    </button>
  </div>
</Modal>
