<script lang="ts">
  import { Pause, Play, Repeat } from "@lucide/svelte";
  import type { Obstacle } from "../model/collision";
  import { formatTime } from "../utils";
  import { useProject } from "../state/project.svelte";
  import { usePlayback } from "../state/playback.svelte";
  import IconButton from "../lib/components/ui/IconButton.svelte";
  import { useAuto } from "../state/auto.svelte";
  import { AUTO_LENGTH_S } from "../lib/auto/simulate";
  import { seconds as formatSeconds } from "../lib/auto/components/ui";

  const project = useProject();
  const playback = usePlayback();
  // Fork: with an Auto the bar plays its preview: each decision, event and
  // guard is marked, and the readout is the 30 s budget.
  const auto = useAuto();

  let percentOf = (seconds: number) =>
    playback.duration > 0 ? (seconds / playback.duration) * 100 : 0;

  /** Where each path ends on the timeline, in its own color. */
  let pathMarkers = $derived(
    playback.prediction.timeline
      .filter((event) => event.type === "travel")
      .map((event) => {
        const index = project.doc.lines.findIndex(
          (line) => line.id === event.lineId,
        );
        const line = project.doc.lines[index];
        return {
          percent: percentOf(event.endTime),
          color: line?.color || "#ffffff",
          name: line?.name || `Path ${index + 1}`,
        };
      }),
  );

  let autoMarkers = $derived(
    (auto.playing?.log ?? [])
      .filter(
        (entry) =>
          entry.kind === "row" ||
          entry.kind === "event" ||
          entry.kind === "guard",
      )
      .map((entry) => ({
        percent: percentOf(entry.t),
        color:
          entry.kind === "event"
            ? "#ffc516"
            : entry.kind === "guard"
              ? "#e5484d"
              : "#ffffff",
        name: `${entry.t.toFixed(1)} s · ${entry.text}`,
      })),
  );
  let markers = $derived(auto.playing ? autoMarkers : pathMarkers);

  function collisionLabel(obstacle: Obstacle) {
    if (obstacle.kind === "wall") return "Hits the field wall";
    const shape = project.doc.shapes.find(
      (candidate) => candidate.id === obstacle.shapeId,
    );
    return `Hits ${shape?.name || "an obstacle"}`;
  }
  let bands = $derived(
    playback.collisions.map((collision) => ({
      start: percentOf(collision.start),
      end: percentOf(collision.end),
      label: collisionLabel(collision.obstacle),
    })),
  );
</script>

<div class="flex items-center gap-3 px-1">
  <div class="flex items-center gap-0.5">
    <IconButton
      label={playback.playing ? "Pause (Space)" : "Play (Space)"}
      onclick={() => playback.toggle()}
      class="text-primary!"
    >
      {#if playback.playing}<Pause />{:else}<Play />{/if}
    </IconButton>
    <IconButton
      label={playback.loop ? "Looping" : "Loop"}
      active={playback.loop}
      onclick={() => (playback.loop = !playback.loop)}
    >
      <Repeat />
    </IconButton>
  </div>

  <div class="relative h-2 min-w-0 flex-1 rounded-full bg-body/20">
    <div
      class="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-primary/70"
      style={`width: ${playback.percent}%`}
    ></div>
    {#each bands as band, index (index)}
      <button
        type="button"
        class="absolute inset-y-0 z-20 rounded-full bg-danger/80"
        title={band.label}
        aria-label={band.label}
        style={`left: ${band.start}%; width: ${Math.max(0.6, band.end - band.start)}%;`}
        onclick={() => playback.seek(band.start)}
      ></button>
    {/each}
    {#each markers as marker, index (index)}
      <button
        type="button"
        class="absolute top-1/2 z-20 size-2.5 -translate-1/2 rounded-full ring-2 ring-base"
        title={marker.name}
        aria-label={marker.name}
        style={`left: ${marker.percent}%; background: ${marker.color};`}
        onclick={() => playback.seek(marker.percent)}
      ></button>
    {/each}
    <input
      type="range"
      min="0"
      max="100"
      step="0.000001"
      value={playback.percent}
      aria-label="Playback position"
      class="slider absolute inset-0 z-10 h-2 w-full cursor-pointer appearance-none"
      oninput={(event) => playback.seek(parseFloat(event.currentTarget.value))}
    />
  </div>

  <div class="font-mono text-xs whitespace-nowrap text-body tabular-nums">
    <span class="text-heading">{formatTime(playback.seconds)}</span>
    {#if auto.playing}
      <span class={[auto.playing.endTime > AUTO_LENGTH_S && "text-danger"]}>
        / {formatSeconds(auto.playing.endTime)} of {AUTO_LENGTH_S} s
      </span>
      {#if auto.worst}
        <span
          class={[auto.worst.total > AUTO_LENGTH_S && "text-danger"]}
          title="Every wait runs to its time row"
        >
          · worst {formatSeconds(auto.worst.total)}
        </span>
      {/if}
    {:else if playback.prediction.totalDistance > 0}
      / {formatTime(playback.duration)}
      · {playback.prediction.totalDistance.toFixed(0)} in
    {:else}
      / {formatTime(playback.duration)}
    {/if}
  </div>
</div>
