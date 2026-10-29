<script lang="ts">
  /**
   * Fork: the Auto Builder's dialogs, and the bar a shared copy or an
   * unopened link shows. Kept out of AppDialogs so upstream's stays as it is.
   */
  import { serializeProject } from "../io";
  import { currentFilePath } from "../stores";
  import { basename } from "../utils/filename";
  import type { Dialogs } from "../state/dialogs.svelte";
  import type { ProjectFiles } from "../state/files.svelte";
  import { DRAFT_LABEL, useLinks } from "../state/links.svelte";
  import TeamAutosDialog from "../lib/team/TeamAutosDialog.svelte";
  import ShareLinkDialog from "../lib/components/ShareLinkDialog.svelte";
  import SaveToGithubDialog from "../lib/sim/SaveToGithubDialog.svelte";
  import SharedCopyBanner from "../lib/components/SharedCopyBanner.svelte";
  import SaveSpotsDialog from "../lib/team/SaveSpotsDialog.svelte";
  import { saveSpotsOpen } from "../lib/team/spotsStore";

  interface Props {
    dialogs: Dialogs;
    files: ProjectFiles;
  }

  let { dialogs, files }: Props = $props();

  const links = useLinks();
</script>

<TeamAutosDialog bind:isOpen={dialogs.teamAutos} />

<SaveSpotsDialog
  isOpen={$saveSpotsOpen}
  onClose={() => saveSpotsOpen.set(false)}
/>

<ShareLinkDialog
  url={dialogs.shareLink}
  onClose={() => (dialogs.shareLink = null)}
/>

<SaveToGithubDialog
  bind:isOpen={dialogs.github}
  fileName={basename($currentFilePath)}
  source={links.sourceOnScreen}
  projectText={() => serializeProject(files.current(), { pretty: true })}
  baseText={links.draft?.baseText ?? null}
  draft={links.status && links.draft
    ? {
        label: DRAFT_LABEL[links.status],
        status: links.status,
        from: links.draft.draftFrom,
      }
    : null}
  onDiscard={() => void links.discardDraft()}
  onSaved={(branch, path, text) => links.savedToGithub(branch, path, text)}
/>

<!-- A shared copy says so in the top bar; this shows a link that failed to open. -->
<SharedCopyBanner
  view={null}
  error={links.error}
  onSave={() => void links.saveCopy()}
  onClose={() => links.close()}
  onDismissError={() => (links.error = null)}
/>
