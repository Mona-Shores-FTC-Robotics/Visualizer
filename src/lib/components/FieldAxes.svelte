<script lang="ts">
  import type * as d3 from "d3";

  /**
   * The field's frame, drawn on the field: the (0, 0) corner, +X and +Y arrows, and the inches at
   * every tile (24 in) along the two edges that meet there. So a position can be talked about in
   * the numbers the editor and the robot use.
   */
  interface Props {
    x: d3.ScaleLinear<number, number>;
    y: d3.ScaleLinear<number, number>;
  }

  let { x, y }: Props = $props();

  const FIELD_IN = 141.5;
  const ARROW_IN = 14;
  const TICKS = [24, 48, 72, 96, 120];

  let size = $derived(x.range()[1]);
  let unit = $derived(size / FIELD_IN);
  let font = $derived(Math.max(9, unit * 2.6));
  // Inset from the edge, in inches, so the marks sit on the tiles and not under the wall.
  const IN = 2.5;
</script>

<svg
  class="pointer-events-none absolute top-0 left-0 h-full w-full"
  style="z-index: 16"
  viewBox={`0 0 ${size} ${size}`}
  aria-hidden="true"
>
  <defs>
    <marker id="field-axis-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#f8fafc" />
    </marker>
  </defs>
  <g opacity="0.9" font-family="ui-monospace, monospace" font-size={font} fill="#f8fafc" stroke="#0f172a" stroke-width={font * 0.25} paint-order="stroke">
    <!-- +X along the y = 0 edge, +Y along the x = 0 edge. -->
    <line x1={x(IN)} y1={y(IN)} x2={x(IN + ARROW_IN)} y2={y(IN)} stroke="#f8fafc" stroke-width={unit * 0.6} marker-end="url(#field-axis-arrow)" />
    <line x1={x(IN)} y1={y(IN)} x2={x(IN)} y2={y(IN + ARROW_IN)} stroke="#f8fafc" stroke-width={unit * 0.6} marker-end="url(#field-axis-arrow)" />
    <circle cx={x(IN)} cy={y(IN)} r={unit * 0.9} fill="#f8fafc" stroke="none" />
    <text x={x(IN + ARROW_IN + 1.5)} y={y(IN + 3.5)} dominant-baseline="middle" font-weight="700">+X</text>
    <text x={x(IN + 1.5)} y={y(IN + ARROW_IN + 1)} dominant-baseline="middle" font-weight="700">+Y</text>
    <text x={x(IN + 1.5)} y={y(IN + 3.5)} dominant-baseline="middle" font-size={font * 0.85}>(0, 0)</text>

    {#each TICKS as t (t)}
      <text x={x(t)} y={y(IN)} text-anchor="middle" dominant-baseline="middle" font-size={font * 0.8} opacity="0.85">{t}</text>
      <text x={x(IN)} y={y(t)} text-anchor="start" dominant-baseline="middle" font-size={font * 0.8} opacity="0.85">{t}</text>
    {/each}
  </g>
</svg>
