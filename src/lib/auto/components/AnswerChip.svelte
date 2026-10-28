<script lang="ts">
  import { answerFor, previewQuestions, setTrigger } from "../simulate";
  import { previewScenario } from "../store";
  import { findCard } from "../tree";
  import type { AutoSection, FirstOfCard } from "../types";

  interface Props {
    auto: AutoSection;
    condition: string;
  }

  let { auto, condition }: Props = $props();

  /** ✓ when every wait on it fires, ✗ when none does, null when the waits differ. */
  let yes = $derived.by(() => {
    const answers = previewQuestions(auto)
      .filter((q) => q.condition === condition)
      .map((q) => answerFor($previewScenario, findCard(auto.cards, q.cardId) as FirstOfCard, condition));
    if (answers.every(Boolean)) return true;
    if (answers.every((a) => !a)) return false;
    return null;
  });

  function flip() {
    previewScenario.update((scenario) => setTrigger(scenario, auto, condition, yes === false));
  }
</script>

<button
  type="button"
  class="answer"
  class:answer--no={yes === false}
  class:answer--mixed={yes === null}
  aria-pressed={yes === true}
  title={yes === null
    ? `Some waits on ${condition} fire and some time out. Click: set every wait on it to ✓.`
    : yes
      ? `Every wait on ${condition} fires. Click: set every wait on it to time out.`
      : `Every wait on ${condition} times out. Click: set every wait on it to ✓.`}
  onclick={flip}
>
  <span class="answer-value">{yes === null ? "±" : yes ? "✓" : "✗"}</span>
  <span class="answer-name">{condition}</span>
</button>

<style>
  .answer {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex: none;
    border: 1px solid color-mix(in srgb, #3fcf8e 45%, transparent);
    background: color-mix(in srgb, #3fcf8e 15%, transparent);
    color: color-mix(in srgb, #3fcf8e 65%, var(--heading));
    border-radius: 999px;
    padding: 2px 10px;
    font-size: 0.75rem;
    line-height: 1.4;
    cursor: pointer;
  }
  .answer--no {
    border-color: var(--border);
    background: var(--base);
    color: var(--body);
  }
  .answer--mixed {
    border-color: color-mix(in srgb, var(--color-warning) 45%, transparent);
    background: color-mix(in srgb, var(--color-warning) 10%, transparent);
    color: color-mix(in srgb, var(--color-warning) 70%, var(--heading));
  }
  .answer--no .answer-name {
    text-decoration: line-through;
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
