<script lang="ts">
  import { sharedCopyTitle, type SharedCopyView } from "../session/sharedCopy";

  interface Props {
    /** The shared copy on screen, or null. */
    view: SharedCopyView | null;
    /** Why a share link could not be opened, or null. */
    error: string | null;
    onSave: () => void;
    onClose: () => void;
    onDismissError: () => void;
  }

  let { view, error, onSave, onClose, onDismissError }: Props = $props();
</script>

<div class="shared-stack">
  {#if error}
    <div class="shared-banner shared-banner--error" role="alert">
      <span class="shared-banner__text">
        <strong>Share link not opened.</strong>
        {error}
      </span>
      <button class="console-action" onclick={onDismissError}>Dismiss</button>
    </div>
  {/if}

  {#if view}
    <div class="shared-banner" role="status"
      title={view.from
        ? `${view.name ?? "This Auto"}, read from ${view.from} (TeamCode/autos). Not saved here. Your own work is set aside until you close it.`
        : `${sharedCopyTitle(view)}. A copy, not the version in git, and not saved. Your own work is set aside until you close it.`}>
      <span class="shared-banner__text">
        <strong>{view.from ? `From ${view.from}` : "Shared copy"}</strong>{#if view.savedAs} · saved as {view.savedAs}{/if}
      </span>
      <button class="console-action" onclick={onSave}>Save as new file</button>
      <button class="console-action" onclick={onClose}>Close</button>
    </div>
  {/if}
</div>

<style>
  /* A small bar in the bottom-left corner, clear of the field and its play bar. */
  .shared-stack {
    position: fixed;
    bottom: 1.25rem;
    left: 1.5rem;
    z-index: 40;
    width: max-content;
    max-width: calc(100vw - 2rem);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    pointer-events: none;
  }
  .shared-banner {
    pointer-events: auto;
    border-radius: 0.5rem;
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.4);
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.35rem 0.5rem 0.35rem 0.9rem;
    font-size: 0.75rem;
    color: #e8e8e8;
    background: #2a2414;
    border: 1px solid #6b5a1e;
  }
  .shared-banner--error {
    background: #2a1616;
    border-color: #7a2e2e;
  }
  .shared-banner__text {
    flex: 1;
    min-width: 0;
  }
</style>
