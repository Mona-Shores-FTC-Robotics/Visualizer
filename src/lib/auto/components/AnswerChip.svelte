<script lang="ts">
  import { answerOf, questionKey } from "../simulate";
  import { previewScenario } from "../store";

  interface Props {
    /** The card asking. */
    cardId: string;
    condition: string;
    /** Show the condition's name next to the answer. */
    named?: boolean;
  }

  let { cardId, condition, named = true }: Props = $props();

  let yes = $derived(answerOf($previewScenario, cardId, condition));

  function flip() {
    previewScenario.update((scenario) => ({ ...scenario, [questionKey(cardId, condition)]: !yes }));
  }
</script>

<button
  type="button"
  class="answer"
  class:answer--no={!yes}
  aria-pressed={yes}
  title={`Preview: is ${condition} true when this card asks? Click to answer ${yes ? "false" : "true"}.`}
  onclick={flip}
>
  {#if named}<span class="answer-name">{condition}</span>{/if}
  <span class="answer-value">{yes ? "T" : "F"}</span>
</button>

<style>
  .answer {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex: none;
    border: 1px solid #2f6b4a;
    background: #10261a;
    color: #7ee2a8;
    border-radius: 5px;
    padding: 0 4px;
    font-size: 0.62rem;
    line-height: 1.4;
  }
  .answer--no {
    border-color: #6b3a3a;
    background: #261010;
    color: #ff9a9a;
  }
  .answer-name {
    font-family: ui-monospace, monospace;
    max-width: 9rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .answer-value {
    font-weight: 800;
    min-width: 0.7rem;
    text-align: center;
  }
</style>
