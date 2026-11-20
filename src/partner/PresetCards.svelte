<script lang="ts">
  /**
   * The page's stand-ins as pictures: the field with our route, faint, and each stand-in's route
   * over it, so a partner can point at the one that looks like theirs.
   */
  import type { BasePoint } from "../types";
  import { OUR_COLOR, PARTNER_COLOR } from "./beside";
  import { drawField } from "./field";
  import type { PartnerRoute } from "./route";

  interface Props {
    presets: PartnerRoute[];
    /** The stand-in picked, by name. */
    selected: string | null;
    /** Our robot's route, drawn faint on every card. */
    ours: BasePoint[] | null;
    blue: boolean;
    image: HTMLImageElement | null;
    /** Bumps when the field image loads, so the cards draw it. */
    imageTick: number;
    onPick: (route: PartnerRoute) => void;
  }
  let { presets, selected, ours, blue, image, imageTick, onPick }: Props =
    $props();

  /** A stand-in's route on the field: its start, then each spot it drives to. */
  const path = (route: PartnerRoute): BasePoint[] => [
    route.start,
    ...route.steps.flatMap((s) => (s.kind === "drive" ? [s.to] : [])),
  ];

  function draw(canvas: HTMLCanvasElement, route: PartnerRoute) {
    const paint = () => {
      void imageTick;
      const size = canvas.clientWidth || 160;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(size * ratio);
      canvas.height = Math.round(size * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      drawField(ctx, size, {
        robots: [],
        previews: [],
        colors: [OUR_COLOR + "88", PARTNER_COLOR],
        routes: [ours ?? [], path(route)],
        t: 0,
        contact: null,
        blue,
        image,
        markers: [{ at: route.start, label: "", active: false }],
        markerPx: 5,
        lineScale: 1.6,
      });
    };
    $effect(paint);
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    return { destroy: () => observer.disconnect() };
  }
</script>

<div class="cards" role="group" aria-label="Stand-ins">
  {#each presets as route (route.name)}
    <button
      type="button"
      class="card"
      aria-pressed={selected === route.name}
      onclick={() => onPick(route)}
    >
      <canvas use:draw={route} aria-hidden="true"></canvas>
      <span>{route.name}</span>
    </button>
  {/each}
</div>

<style>
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 8px;
  }
  .card {
    font: inherit;
    display: grid;
    gap: 6px;
    padding: 6px;
    border-radius: 12px;
    border: 2px solid var(--line);
    background: var(--seg);
    color: var(--ink);
    cursor: pointer;
    text-align: left;
    min-width: 0;
  }
  .card[aria-pressed="true"] {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--accent-ink);
  }
  canvas {
    display: block;
    width: 100%;
    aspect-ratio: 1;
    border-radius: 7px;
  }
  span {
    font-size: 13.5px;
    font-weight: 700;
    line-height: 1.25;
    padding: 0 2px 2px;
  }
  .card:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
