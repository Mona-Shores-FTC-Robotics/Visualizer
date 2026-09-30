<script lang="ts">
  import PlaybackControls from "../../components/PlaybackControls.svelte";
  import { AUTO_LENGTH_S, type PreviewResult, type WorstCase } from "../simulate";
  import { seconds } from "./ui";

  interface Props {
    preview: PreviewResult;
    worst: WorstCase | null;
    playing: boolean;
    play: () => void;
    pause: () => void;
    percent: number;
    handleSeek: (percent: number) => void;
    loopAnimation: boolean;
  }

  let {
    preview,
    worst,
    playing,
    play,
    pause,
    percent = $bindable(),
    handleSeek,
    loopAnimation = $bindable(),
  }: Props = $props();

  // Each decision, event and guard on the bar; hovering one says what happened.
  let markers = $derived(
    preview.endTime > 0
      ? preview.log
          .filter((entry) => entry.kind === "row" || entry.kind === "event" || entry.kind === "guard")
          .map((entry) => ({
            percent: (entry.t / preview.endTime) * 100,
            color: entry.kind === "event" ? "#ffc516" : entry.kind === "guard" ? "#e5484d" : "#ffffff",
            name: `${entry.t.toFixed(1)} s · ${entry.text}`,
          }))
      : [],
  );
</script>

<div class="auto-timeline">
  <PlaybackControls {playing} {play} {pause} bind:percent {handleSeek} bind:loopAnimation {markers} totalTime={preview.endTime} />
  <div class="auto-budget">
    <span class:over={preview.endTime > AUTO_LENGTH_S}>{preview.endTime.toFixed(1)} / {AUTO_LENGTH_S} s</span>
    {#if worst}
      <span class:over={worst.total > AUTO_LENGTH_S} title="Every wait runs to its time row">worst {seconds(worst.total)}</span>
    {/if}
  </div>
</div>

<style>
  .auto-timeline {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
  }
  .auto-timeline :global(> :first-child) {
    flex: 1;
  }
  .auto-budget {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    font-family: ui-monospace, monospace;
    font-size: 0.72rem;
    color: #9a9a9a;
    white-space: nowrap;
  }
  .over {
    color: #ff6b6b;
    font-weight: 700;
  }
</style>
