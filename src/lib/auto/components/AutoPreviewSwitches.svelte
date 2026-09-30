<script lang="ts">
  import type { AutoSection } from "../types";
  import { previewQuestions } from "../simulate";
  import AnswerChip from "./AnswerChip.svelte";

  interface Props {
    auto: AutoSection;
  }

  let { auto }: Props = $props();

  /** Each condition the Auto asks, once, in the order the Auto first asks it. */
  let conditions = $derived([...new Set(previewQuestions(auto).map((q) => q.condition))]);
</script>

{#if conditions.length}
  <div class="flex flex-wrap items-center gap-1.5"
    title="Set every wait on a trigger at once. Each branching wait also has its own switch in the list.">
    {#each conditions as condition (condition)}
      <AnswerChip {auto} {condition} />
    {/each}
  </div>
{/if}
