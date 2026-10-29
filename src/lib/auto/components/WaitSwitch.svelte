<script lang="ts">
  import { answerFor, switchKey } from "../simulate";
  import { previewScenario } from "../store";
  import type { FirstOfCard } from "../types";

  interface Props {
    card: FirstOfCard;
  }

  let { card }: Props = $props();

  let trigger = $derived(card.rows.find((row) => "when" in row) as { when: string[] } | undefined);
  let name = $derived(trigger?.when[0] ?? "trigger");
  let fired = $derived(answerFor($previewScenario, card, name));

  function set(yes: boolean) {
    previewScenario.update((scenario) => ({ ...scenario, [switchKey(card.id)]: yes }));
  }
</script>

<div class="wait-switch" role="group" aria-label={`Preview: does ${name} fire at ${card.label || "this wait"}?`}>
  <button type="button" class:on={fired} aria-pressed={fired} onclick={() => set(true)}>✓ {name}</button>
  <button type="button" class:on={!fired} aria-pressed={!fired} onclick={() => set(false)}>timed out</button>
</div>

<style>
  .wait-switch {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
    margin: 2px 0 4px 10px;
    font-size: 0.72rem;
  }
  .wait-switch button {
    padding: 2px 10px;
    background: var(--base);
    color: var(--body);
    font-family: ui-monospace, monospace;
  }
  .wait-switch button.on {
    background: color-mix(in srgb, var(--color-primary) 14%, transparent);
    color: var(--heading);
    font-weight: 700;
  }
</style>
