<script lang="ts">
  /**
   * The partner's possible Autos as pictures: the team's own known ones first, then the page's
   * stand-ins; each the field with its route (and ours, faint, once picked), so a partner can point
   * at the one that looks like theirs.
   */
  import type { BasePoint } from "../types";
  import { OUR_COLOR, PARTNER_COLOR } from "./beside";
  import { drawField } from "./field";
  import { routePath, type PartnerRoute } from "./route";

  export interface Card {
    key: string;
    label: string;
    route: PartnerRoute;
    /** One of the team's own Autos, not a stand-in. */
    theirs: boolean;
  }

  interface Props {
    cards: Card[];
    /** The card picked, by key. */
    selected: string | null;
    /** Our robot's route, drawn faint on every card. */
    ours: BasePoint[] | null;
    blue: boolean;
    image: HTMLImageElement | null;
    /** Bumps when the field image loads, so the cards draw it. */
    imageTick: number;
    onPick: (card: Card) => void;
  }
  let { cards, selected, ours, blue, image, imageTick, onPick }: Props =
    $props();

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
        routes: [ours ?? [], routePath(route)],
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

<div class="cards" role="group" aria-label="Their Autos">
  {#each cards as card (card.key)}
    <button
      type="button"
      class="card"
      class:theirs={card.theirs}
      aria-pressed={selected === card.key}
      onclick={() => onPick(card)}
    >
      <canvas use:draw={card.route} aria-hidden="true"></canvas>
      <span>{card.label}</span>
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
  .card.theirs {
    border-color: #4ecdc4;
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
