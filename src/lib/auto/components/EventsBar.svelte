<script lang="ts">
  import type { PathEvent } from "../types";
  import { FIELD_CLASS, ACTION_CLASS } from "./ui";

  interface Props {
    events: PathEvent[];
    actions: string[];
    /** Called with the new list; `done` is false while a marker is being dragged. */
    onChange: (events: PathEvent[], done: boolean) => void;
  }

  let { events, actions, onChange }: Props = $props();

  let track = $state<HTMLDivElement>();
  let dragging: number | null = $state(null);
  let registered = $derived(new Set(actions));

  const round = (value: number) => Math.round(value * 100) / 100;

  function fractionAt(clientX: number): number {
    if (!track) return 0;
    const bounds = track.getBoundingClientRect();
    return round(Math.min(1, Math.max(0, (clientX - bounds.left) / Math.max(1, bounds.width))));
  }

  function addAt(event: PointerEvent) {
    if (event.target !== track) return;
    const at = fractionAt(event.clientX);
    onChange([...events, { at, action: actions[0] ?? "" }].sort((a, b) => a.at - b.at), true);
  }

  function beginDrag(index: number, event: PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    dragging = index;
    let current = events.map((e) => ({ ...e }));
    const move = (moveEvent: PointerEvent) => {
      current = current.map((e, i) => (i === index ? { ...e, at: fractionAt(moveEvent.clientX) } : e));
      onChange(current, false);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      dragging = null;
      onChange([...current].sort((a, b) => a.at - b.at), true);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function nudge(index: number, delta: number) {
    const next = events.map((e, i) => (i === index ? { ...e, at: round(Math.min(1, Math.max(0, e.at + delta))) } : e));
    onChange(next.sort((a, b) => a.at - b.at), true);
  }
</script>

<div class="space-y-2">
  <div
    bind:this={track}
    class="events-track relative h-4 rounded border border-[#5c4a10] bg-[#1d1808]"
    role="button"
    tabindex="0"
    aria-label="Events along this path: click to add one"
    onpointerdown={addAt}
    title="Click to add an event here"
  >
    {#each events as event, index (index)}
      <button
        type="button"
        class="events-marker absolute top-1/2 z-10 h-5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-[#111111]"
        class:events-marker--bad={!registered.has(event.action)}
        class:events-marker--drag={dragging === index}
        style={`left:${event.at * 100}%`}
        onpointerdown={(e) => beginDrag(index, e)}
        onkeydown={(e) => {
          if (e.key === "ArrowLeft") nudge(index, -0.01);
          if (e.key === "ArrowRight") nudge(index, 0.01);
        }}
        aria-label={`${event.action} at ${Math.round(event.at * 100)}%: drag or use arrow keys`}
        title={`${event.action} at ${Math.round(event.at * 100)}%`}
      ></button>
    {/each}
  </div>
  <div class="flex justify-between text-[10px] text-gray-500"><span>start</span><span>50%</span><span>end</span></div>
  {#if events.length}
    <div class="space-y-1">
      {#each events as event, index (index)}
        <div class="flex items-center gap-2">
          <span class="w-10 shrink-0 font-mono text-[11px] text-[#ffc516]">{Math.round(event.at * 100)}%</span>
          <select
            class={FIELD_CLASS}
            class:!border-red-600={!registered.has(event.action)}
            value={event.action}
            onchange={(e) =>
              onChange(events.map((x, i) => (i === index ? { ...x, action: e.currentTarget.value } : x)), true)}
            aria-label="Event action"
          >
            {#if !registered.has(event.action)}
              <option value={event.action}>{event.action || "(choose)"} — not registered</option>
            {/if}
            {#each actions as name (name)}
              <option value={name}>{name}</option>
            {/each}
          </select>
          <button type="button" class="{ACTION_CLASS} text-[10px]" onclick={() => onChange(events.filter((_, i) => i !== index), true)}>
            Delete
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .events-track {
    cursor: copy;
    touch-action: none;
  }
  .events-marker {
    background: #ffc516;
    cursor: ew-resize;
  }
  .events-marker--bad {
    background: #e5484d;
  }
  .events-marker--drag {
    box-shadow: 0 0 0 2px rgba(255, 197, 22, 0.35);
  }
</style>
