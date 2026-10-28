<script lang="ts">
  import Modal from "./ui/Modal.svelte";
  import { DISCORD_MESSAGE_LIMIT } from "../../utils/shareLink";

  interface Props {
    /** The link to show; null when the dialog is closed. */
    url: string | null;
    onClose: () => void;
  }

  let { url, onClose }: Props = $props();

  let isOpen = $derived(url !== null);
  let copied = $state(false);
  let tooLongForChat = $derived((url ?? "").length > DISCORD_MESSAGE_LIMIT);

  function close() {
    copied = false;
    onClose();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url ?? "");
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  }
</script>

<Modal
  {isOpen}
  titleId="share-link-title"
  panelClass="console-panel p-6 w-full max-w-lg mx-4"
  onClose={close}
>
  <h2 id="share-link-title" class="text-xl font-semibold text-heading mb-3">
    Share link
  </h2>

  <div class="flex flex-col gap-3 text-sm text-heading">
    <p>
      Opening this link shows a copy of this project, Auto included, without
      touching the viewer's own files. It is meant for GitHub issues and pull
      requests, so reviewers can see the paths next to the Java.
    </p>
    <p>
      The link is a snapshot. It does not change when you edit, and it is not
      the version in git: the committed <code>.pp</code> and its generated Java are
      what the robot runs.
    </p>

    <textarea
      readonly
      rows="3"
      value={url ?? ""}
      class="console-input px-3 py-2 text-xs break-all resize-none"
      onfocus={(event) => event.currentTarget.select()}></textarea>

    <p class="text-xs text-body">
      {(url ?? "").length.toLocaleString()} characters.
      {#if tooLongForChat}
        Too long for a Discord message ({DISCORD_MESSAGE_LIMIT.toLocaleString()});
        send the <code>.pp</code> file there instead.
      {:else}
        Short enough for a Discord message.
      {/if}
    </p>
  </div>

  <div class="flex justify-end gap-3 mt-5">
    <button onclick={close} class="console-action">Close</button>
    <button onclick={copy} class="console-action console-action--accent">
      {copied ? "Copied ✓" : "Copy link"}
    </button>
  </div>
</Modal>
