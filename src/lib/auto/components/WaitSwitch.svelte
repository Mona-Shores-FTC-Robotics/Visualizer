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
    border: 1px solid #3a3a3a;
    border-radius: 6px;
    overflow: hidden;
    margin: 2px 0 4px 10px;
    font-size: 0.72rem;
  }
  .wait-switch button {
    padding: 2px 10px;
    background: #1a1a1a;
    color: #8a8a8a;
    font-family: ui-monospace, monospace;
  }
  .wait-switch button.on {
    background: #2a2140;
    color: #d8c8ff;
    font-weight: 700;
  }
</style>
