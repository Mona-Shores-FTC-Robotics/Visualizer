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
    <div class="shared-banner" role="status">
      <span class="shared-banner__text">
        <strong>{sharedCopyTitle(view)}.</strong>
        A copy, not the version in git, and not saved.
        {#if view.savedAs}
          Saved as {view.savedAs}; open it from the file manager to keep working
          on it.
        {/if}
        Your own work is set aside until you close this.
      </span>
      <div class="flex gap-2 shrink-0">
        <button class="console-action" onclick={onSave}>Save as new file</button
        >
        <button class="console-action console-action--accent" onclick={onClose}>
          Close and return to my work
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Floats just under the top bar, over the field's top edge. */
  .shared-stack {
    position: fixed;
    top: 5.4rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 40;
    width: min(60rem, calc(100vw - 2rem));
    display: flex;
    flex-direction: column;
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
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
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
