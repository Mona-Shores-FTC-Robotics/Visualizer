<script lang="ts">
  /**
   * Every way the Auto can run, side by side: the good path, then each tip missed. A row opens
   * that outcome in the plan view (the field and playback follow it).
   */
  import Modal from "../components/ui/Modal.svelte";
  import { useAuto } from "../../state/auto.svelte";
  import { AUTO_LENGTH_S } from "../auto/simulate";

  let { isOpen = $bindable(false) }: { isOpen?: boolean } = $props();

  const auto = useAuto();
  let rows = $derived(isOpen ? auto.outcomes() : []);
</script>

<Modal {isOpen} titleId="plan-outcomes-title" onClose={() => (isOpen = false)}>
  <h2 id="plan-outcomes-title" class="mb-1 text-lg font-semibold text-heading">
    All outcomes
  </h2>
  <p class="mb-3 text-sm text-body">
    Each way this Auto can go, decided when it is built. Every one has to park
    by {AUTO_LENGTH_S} s.
  </p>
  <ul class="flex flex-col gap-1">
    {#each rows as row (row.label)}
      {@const end = row.preview.endTime}
      <li>
        <button
          type="button"
          class="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border px-3 py-2 text-left hover:bg-body/10"
          onclick={() => {
            if (row.step) auto.openMiss(row.step);
            else auto.closeMiss();
            isOpen = false;
          }}
        >
          <span class="min-w-0">
            <span
              class={[
                "block text-sm",
                row.step ? "text-warning" : "text-success",
              ]}>{row.step ? "◆ " : "✓ "}{row.label}</span
            >
            {#if row.preview.guard}
              <span class="block text-xs text-body"
                >the endgame guard parks it early</span
              >
            {/if}
          </span>
          <span
            class={[
              "font-mono text-sm tabular-nums",
              end > AUTO_LENGTH_S + 1e-6 ? "text-danger" : "text-heading",
            ]}>{end.toFixed(1)} s</span
          >
        </button>
      </li>
    {/each}
  </ul>
</Modal>
