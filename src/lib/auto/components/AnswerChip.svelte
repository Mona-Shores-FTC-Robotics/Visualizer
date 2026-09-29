<script lang="ts">
  import { answerOf, questionKey } from "../simulate";
  import { previewScenario } from "../store";

  interface Props {
    condition: string;
  }

  let { condition }: Props = $props();

  let yes = $derived(answerOf($previewScenario, "", condition));

  function flip() {
    previewScenario.update((scenario) => ({ ...scenario, [questionKey("", condition)]: !yes }));
  }
</script>

<button
  type="button"
  class="answer"
  class:answer--no={!yes}
  aria-pressed={yes}
  title={yes
    ? `${condition} happens: its rows fire at once. Click: it never happens, so its waits time out.`
    : `${condition} never happens: its waits time out. Click: it happens.`}
  onclick={flip}
>
  <span class="answer-value">{yes ? "✓" : "✗"}</span>
  <span class="answer-name">{condition}</span>
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
    border-radius: 999px;
    padding: 2px 10px;
    font-size: 0.75rem;
    line-height: 1.4;
    cursor: pointer;
  }
  .answer--no {
    border-color: #444444;
    background: #1a1a1a;
    color: #8a8a8a;
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
