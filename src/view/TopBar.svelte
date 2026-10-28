<script lang="ts">
  import {
    CloudUpload,
    Download,
    Redo2,
    Settings,
    Undo2,
    Users,
  } from "@lucide/svelte";
  import { useLinks } from "../state/links.svelte";
  import { currentFilePath } from "../stores";
  import { publicAsset } from "../utils/publicAsset";
  import { basename } from "../utils/filename";
  import { useProject } from "../state/project.svelte";
  import IconButton from "../lib/components/ui/IconButton.svelte";
  import Menu from "../lib/components/ui/Menu.svelte";
  import type { MenuEntry } from "../lib/components/ui/menu";
  import { actionById, menuItem, type Action } from "./actions";

  interface Props {
    actions: Action[];
  }

  let { actions }: Props = $props();

  const project = useProject();
  const links = useLinks();
  const action = (id: string) => actionById(actions, id);
  const items = (...ids: (string | "separator")[]): MenuEntry[] =>
    ids.map((id) => (id === "separator" ? id : menuItem(action(id))));

  let fileEntries = $derived(
    items(
      "file.new",
      "file.open",
      "file.import",
      "separator",
      "file.save",
      "file.saveAs",
      "file.rename",
      "file.mirror",
      "separator",
      "github.save",
      "team.autos",
      "separator",
      "app.palette",
    ),
  );
  let exportEntries = $derived(
    items(
      "export.auto",
      "export.shareLink",
      "separator",
      "export.java",
      "export.kotlin",
      "export.points",
      "export.json",
      "separator",
      "export.image",
      "export.gif",
    ),
  );
  let undo = $derived(menuItem(action("edit.undo")));
  let redo = $derived(menuItem(action("edit.redo")));
</script>

<header
  class="fixed inset-x-0 top-0 z-100 flex h-14 items-center justify-between gap-4 border-b border-border bg-surface/80 px-4 backdrop-blur"
>
  <div class="flex min-w-0 items-center gap-3">
    <div class="flex items-center gap-2 pr-2">
      <img
        src={publicAsset("/logo-duck.svg")}
        alt=""
        class="size-6"
        draggable="false"
      />
      <span class="text-sm font-semibold whitespace-nowrap text-heading">
        Visualizer
      </span>
      <span class="text-xs whitespace-nowrap text-body">
        BIOBUZZ Auto Builder fork
      </span>
    </div>
    <Menu label="File" entries={fileEntries} />
    <button
      type="button"
      class="truncate rounded-md px-2 py-1 text-sm text-body transition hover:bg-base hover:text-heading"
      title={$currentFilePath
        ? `${$currentFilePath} (click to rename)`
        : "Not saved yet (click to save with a name)"}
      onclick={$currentFilePath
        ? action("file.rename").run
        : action("file.save").run}
    >
      {basename($currentFilePath) || "Untitled"}
      {#if project.dirty}
        <span class="text-primary" title="Unsaved changes">•</span>
      {/if}
    </button>
  </div>

  <div class="flex items-center gap-1">
    {#if links.copy && !links.draft}
      <!-- A shared copy: the viewer's own work waits until it is closed. -->
      <span
        class="rounded-md bg-warning/15 px-2 py-1 text-xs whitespace-nowrap text-heading"
        title={links.copy.from
          ? `${links.copy.name ?? "This Auto"}, read from ${links.copy.from}. Not saved here; your own work is set aside until you close it.`
          : "A copy from a link, not the version in git, and not saved. Your own work is set aside until you close it."}
      >
        {links.copy.from ? `From ${links.copy.from}` : "Shared copy"}
      </span>
      <button
        type="button"
        class="rounded-md px-2 py-1 text-xs whitespace-nowrap text-body transition hover:bg-base hover:text-heading"
        onclick={() => void links.saveCopy()}>Save as new file</button
      >
      <button
        type="button"
        class="rounded-md px-2 py-1 text-xs whitespace-nowrap text-body transition hover:bg-base hover:text-heading"
        onclick={() => links.close()}>Close</button
      >
    {/if}
    {#if links.githubFile}
      <!-- A file from biobuzz: edits are kept as a draft until Save to GitHub. -->
      <button
        type="button"
        class="rounded-md px-2 py-1 text-xs whitespace-nowrap text-body transition hover:bg-base hover:text-heading"
        title="From biobuzz. Your edits are kept in this browser as a draft; Save to GitHub when it is ready."
        onclick={action("github.save").run}
      >
        {links.githubFile.name} ·
        <span class={[links.githubFile.changed && "text-warning"]}>
          {links.githubFile.label}
        </span>
      </button>
    {/if}
    <IconButton
      label="Team Autos: the latest from biobuzz, together"
      onclick={action("team.autos").run}
    >
      <Users />
    </IconButton>
    <IconButton
      label="Save to GitHub and simulate"
      onclick={action("github.save").run}
    >
      <CloudUpload />
    </IconButton>
    <div class="mx-1.5 h-5 w-px bg-border"></div>
    <IconButton
      label={`Undo${undo.hint ? ` (${undo.hint})` : ""}`}
      disabled={undo.disabled}
      onclick={undo.run}
    >
      <Undo2 />
    </IconButton>
    <IconButton
      label={`Redo${redo.hint ? ` (${redo.hint})` : ""}`}
      disabled={redo.disabled}
      onclick={redo.run}
    >
      <Redo2 />
    </IconButton>
    <div class="mx-1.5 h-5 w-px bg-border"></div>
    <Menu label="Export" entries={exportEntries} align="end">
      {#snippet icon()}<Download />{/snippet}
    </Menu>
    <IconButton label="Settings" onclick={action("app.settings").run}>
      <Settings />
    </IconButton>
  </div>
</header>
