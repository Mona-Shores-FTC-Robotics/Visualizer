<script lang="ts">
  import type { Axis } from "../../view/viewport";

  /**
   * Fork: the inches along the field's bottom (x) and left (y) edges, outside the field, so the
   * field itself shows only the field. Drawn beside the field's box; the box leaves room for it.
   */
  interface Props {
    x: Axis;
    y: Axis;
    /** The field's size on screen, in pixels. */
    pixels: number;
  }

  let { x, y, pixels }: Props = $props();

  const TICKS = [0, 24, 48, 72, 96, 120];
</script>

<div
  class="pointer-events-none absolute top-0 left-0 font-mono text-[10px] text-body tabular-nums"
  style={`width: ${pixels}px; height: ${pixels}px;`}
  aria-hidden="true"
>
  {#each TICKS as t (t)}
    <span
      class="absolute -translate-x-1/2"
      style={`left: ${x(t)}px; top: ${pixels + 3}px;`}>{t}</span
    >
    <span
      class="absolute -translate-y-1/2 text-right"
      style={`right: ${pixels + 4}px; top: ${y(t)}px;`}>{t}</span
    >
  {/each}
</div>
