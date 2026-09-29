<script lang="ts">
  import type { AutoSection } from "../types";
  import {
    AUTO_LENGTH_S,
    previewQuestions,
    questionKey,
    type PreviewResult,
    type WorstCase,
  } from "../simulate";
  import { previewScenario, selectedCardId } from "../store";
  import AnswerChip from "./AnswerChip.svelte";
  import { CELL_CLASS, LABEL_CLASS, SECTION_CLASS, seconds } from "./ui";

  interface Props {
    auto: AutoSection;
    preview: PreviewResult;
    worst: WorstCase | null;
    /** Seconds into the preview the playback is at. */
    now: number;
  }

  let { auto, preview, worst, now }: Props = $props();

  let questions = $derived(previewQuestions(auto));
  let current = $derived.by(() => {
    let index = -1;
    preview.log.forEach((entry, i) => {
      if (entry.t <= now + 1e-6) index = i;
    });
    return index;
  });
  let logBox = $state<HTMLDivElement>();

  $effect(() => {
    // Keep the entry the playback has reached in view.
    const row = logBox?.querySelector<HTMLElement>(`[data-log="${current}"]`);
    if (row && logBox) {
      const top = row.offsetTop - logBox.offsetTop;
      if (top < logBox.scrollTop || top > logBox.scrollTop + logBox.clientHeight - row.offsetHeight) {
        logBox.scrollTop = Math.max(0, top - logBox.clientHeight / 2);
      }
    }
  });

  function answerAll(yes: boolean) {
    previewScenario.set(
      yes ? {} : Object.fromEntries(questions.map((q) => [questionKey(q.cardId, q.condition), false])),
    );
  }
</script>

<div class={SECTION_CLASS}>
  <div class="flex items-start justify-between gap-3 border-b border-[#333333] pb-2">
    <div>
      <div class="font-semibold text-gray-100">Preview as</div>
      <div class="text-[11px] text-gray-500">
        Is each condition true when its card asks? T fires at once; F lets the time row fire. Play below to watch it.
      </div>
    </div>
    {#if questions.length}
      <div class="flex shrink-0 gap-1">
        <button type="button" class="path-list-action" onclick={() => answerAll(true)}>All T</button>
        <button type="button" class="path-list-action" onclick={() => answerAll(false)}>All F</button>
      </div>
    {/if}
  </div>
  {#if questions.length === 0}
    <div class="text-[11px] text-gray-500">No card asks a condition: every wait runs to its time row.</div>
  {:else}
    <div class="space-y-1 text-[11px] text-gray-300">
      {#each questions as q (questionKey(q.cardId, q.condition))}
        <div class="flex items-center gap-2 {CELL_CLASS}" class:opacity-50={!preview.ran.has(q.cardId)}>
          <button
            type="button"
            class="min-w-0 flex-1 truncate text-left text-gray-100 hover:underline"
            title="Select this card"
            onclick={() => selectedCardId.set(q.cardId)}>{q.card}</button
          >
          {#if !preview.ran.has(q.cardId)}<span class="text-gray-500">not reached</span>{/if}
          <AnswerChip cardId={q.cardId} condition={q.condition} />
        </div>
      {/each}
    </div>
  {/if}

  <div class="flex items-center gap-2 text-[11px]">
    <span class="text-gray-500">Auto period</span>
    <span class="h-1.5 flex-1 overflow-hidden rounded bg-[#262626]">
      <span
        class="block h-full"
        style={`width:${Math.min(100, (preview.endTime / AUTO_LENGTH_S) * 100)}%; background:${preview.endTime > AUTO_LENGTH_S ? "#e5484d" : "#3fcf8e"}`}
      ></span>
    </span>
    <span class="font-mono text-gray-100">{preview.endTime.toFixed(1)} / {AUTO_LENGTH_S} s</span>
    {#if preview.endTime > AUTO_LENGTH_S}<span class="font-semibold text-red-400">over</span>{/if}
  </div>
  {#if worst}
    <div class="text-[11px]" class:text-red-400={worst.total > AUTO_LENGTH_S} class:text-gray-500={worst.total <= AUTO_LENGTH_S}>
      Worst case (every wait runs to its time row): {seconds(worst.total)}{worst.total > AUTO_LENGTH_S ? " — over 30 s; each branch's worst case is on its header" : ""}.
    </div>
  {/if}

  <div>
    <span class={LABEL_CLASS}>Log</span>
    <div bind:this={logBox} class="auto-log max-h-48 overflow-auto rounded border border-[#262626] bg-[#0d0d0d]" aria-label="Preview log">
      {#each preview.log as entry, index (index)}
        <button
          type="button"
          data-log={index}
          class="auto-log-row"
          class:auto-log-row--now={index === current}
          class:auto-log-row--warn={entry.kind === "warn" || entry.kind === "guard"}
          class:auto-log-row--event={entry.kind === "event"}
          class:auto-log-row--row={entry.kind === "row"}
          class:auto-log-row--late={entry.t > AUTO_LENGTH_S}
          onclick={() => entry.cardId && selectedCardId.set(entry.cardId)}
        >
          <span class="auto-log-t">{entry.t.toFixed(2)}</span>
          <span>{entry.text}</span>
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .auto-log-row {
    display: flex;
    gap: 8px;
    width: 100%;
    padding: 3px 8px;
    font-size: 11px;
    text-align: left;
    border-bottom: 1px solid #1c1c1c;
    color: #d0d0d0;
    background: none;
  }
  .auto-log-row:hover {
    background: #161616;
  }
  .auto-log-t {
    font-family: "Fira Code", "Consolas", monospace;
    color: #888888;
    min-width: 40px;
  }
  .auto-log-row--now {
    background: #2b2410;
  }
  .auto-log-row--event {
    color: #ffc516;
  }
  .auto-log-row--row {
    color: #c9c2ff;
  }
  .auto-log-row--warn {
    color: #ff9a9a;
  }
  .auto-log-row--late .auto-log-t {
    color: #e5484d;
  }
</style>
