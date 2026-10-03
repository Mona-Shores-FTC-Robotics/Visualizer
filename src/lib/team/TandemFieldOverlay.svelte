<script lang="ts">
  /**
   * The field's part of the tandem view: where the robots come too close (a ring, red for a
   * collision; the one happening now is filled), and the trails of partner robots shown as
   * ghosts while one robot of the pair is in the editor.
   */
  import type * as d3 from "d3";
  import type { NearMiss } from "./tandem";

  interface Props {
    x: d3.ScaleLinear<number, number>;
    y: d3.ScaleLinear<number, number>;
    misses: NearMiss[];
    trails: { color: string; points: { x: number; y: number }[] }[];
    now: number;
  }

  let { x, y, misses, trails, now }: Props = $props();

  let size = $derived(x.range()[1]);
  let unit = $derived(size / 141.5);
  const polyline = (points: { x: number; y: number }[]) =>
    points.map((p) => `${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ");
</script>

<svg
  class="pointer-events-none absolute top-0 left-0 h-full w-full"
  style="z-index: 18"
  viewBox={`0 0 ${size} ${size}`}
  aria-hidden="true"
>
  {#each trails as trail, i (i)}
    <polyline
      points={polyline(trail.points)}
      fill="none"
      stroke={trail.color}
      stroke-width={unit * 0.8}
      stroke-dasharray={`${unit * 2} ${unit * 1.5}`}
      opacity="0.55"
    />
  {/each}
  {#each misses as m, i (i)}
    {@const active = now >= m.t0 - 1e-9 && now <= m.t1 + 1e-9}
    <circle
      cx={x(m.at.x)}
      cy={y(m.at.y)}
      r={unit * 7}
      fill={active ? (m.contact ? "#e5484d55" : "#ff9f4355") : "none"}
      stroke={m.contact ? "#e5484d" : "#ff9f43"}
      stroke-width={unit * 0.8}
      stroke-dasharray={m.contact ? "none" : `${unit * 1.5} ${unit}`}
    />
  {/each}
</svg>
