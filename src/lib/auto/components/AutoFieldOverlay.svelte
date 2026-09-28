<script lang="ts">
  import type * as d3 from "d3";
  import type { BasePoint } from "../../../types";
  import { pointAlong, type PathCatalog } from "../geometry";
  import type { PreviewResult } from "../simulate";
  import { allCards } from "../tree";
  import type { AutoCard, AutoSection, PathCard } from "../types";
  import { parseSelection, selectedCardId } from "../store";
  import { cardColors } from "./ui";

  interface Props {
    auto: AutoSection;
    catalog: PathCatalog;
    preview: PreviewResult | null;
    x: d3.ScaleLinear<number, number>;
    y: d3.ScaleLinear<number, number>;
    showUntaken: boolean;
  }

  let { auto, catalog, preview, x, y, showUntaken }: Props = $props();

  let size = $derived(x.range()[1]);
  let colors = $derived(cardColors(auto.cards));
  let selectedId = $derived(parseSelection($selectedCardId).cardId);
  let pathCards = $derived(allCards(auto.cards).filter((card): card is PathCard => card.kind === "path"));
  let usedLineIds = $derived(new Set(pathCards.map((card) => card.lineId)));
  let unit = $derived(size / 141.5);

  const polyline = (points: BasePoint[]) =>
    points.map((p) => `${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ");

  /** Where each decision waits: the end of the last path driven before it. */
  let decisionSpots = $derived.by(() => {
    const spots: { id: string; at: BasePoint; taken: boolean }[] = [];
    const walk = (list: AutoCard[], at: BasePoint | null): BasePoint | null => {
      let here = at;
      for (const card of list) {
        if (card.kind === "path") here = catalog.byId.get(card.lineId)?.end ?? here;
        if (card.kind === "firstOf" && card.rows.some((row) => row.cards.length)) {
          if (here) spots.push({ id: card.id, at: here, taken: !preview || preview.ran.has(card.id) });
          card.rows.forEach((row) => walk(row.cards, here));
        }
      }
      return here;
    };
    walk(auto.cards, catalog.paths[0]?.start ?? null);
    return spots;
  });

  function ran(card: PathCard): boolean {
    return !preview || preview.ran.has(card.id);
  }
</script>

<svg
  class="pointer-events-none absolute top-0 left-0 h-full w-full"
  style="z-index: 18"
  viewBox={`0 0 ${size} ${size}`}
  aria-hidden="true"
>
  <!-- Paths no card drives: faint, so the whole drawing stays visible. -->
  {#each catalog.paths.filter((path) => !usedLineIds.has(path.id)) as path (path.id)}
    <polyline points={polyline(path.samples)} fill="none" stroke="#9a9a9a" stroke-width={unit * 0.35} stroke-dasharray={`${unit} ${unit}`} opacity="0.45" />
  {/each}

  <!-- Untaken first, so the preview's route is drawn on top. -->
  {#each [false, true] as layerTaken (layerTaken)}
    {#each pathCards.filter((card) => ran(card) === layerTaken) as card (card.id)}
      {@const info = catalog.byId.get(card.lineId)}
      {#if info && (layerTaken || showUntaken)}
        {@const color = colors.get(card.id) ?? "#ffc516"}
        {@const selected = selectedId === card.id}
        {#if selected}
          <polyline points={polyline(info.samples)} fill="none" stroke="#ffffff" stroke-width={unit * 1.6} stroke-linecap="round" stroke-linejoin="round" opacity="0.35" />
        {/if}
        <polyline
          points={polyline(info.samples)}
          fill="none"
          stroke={color}
          stroke-width={unit * (selected ? 0.95 : 0.7)}
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-dasharray={layerTaken ? undefined : `${unit * 2.4} ${unit * 1.8}`}
          opacity={layerTaken ? 1 : 0.5}
        />
        {#if card.park}
          <text x={x(info.end.x)} y={y(info.end.y) - unit * 2.2} font-size={unit * 2.6} font-weight="700" text-anchor="middle" fill={color} stroke="#000" stroke-width={unit * 0.35} paint-order="stroke" opacity={layerTaken ? 1 : 0.6}>P</text>
        {/if}
        {#each card.events as event, i (i)}
          {@const at = pointAlong(info, event.at)}
          <g opacity={layerTaken ? 1 : 0.55}>
            <circle cx={x(at.x)} cy={y(at.y)} r={unit * 1.5} fill="#111111" stroke="#ffc516" stroke-width={unit * 0.4} />
            <text x={x(at.x)} y={y(at.y) + unit * 0.65} font-size={unit * 1.9} text-anchor="middle" fill="#ffc516">⚡</text>
          </g>
        {/each}
      {/if}
    {/each}
  {/each}

  {#each decisionSpots as spot (spot.id)}
    <rect
      x={x(spot.at.x) - unit * 1.6}
      y={y(spot.at.y) - unit * 1.6}
      width={unit * 3.2}
      height={unit * 3.2}
      transform={`rotate(45 ${x(spot.at.x)} ${y(spot.at.y)})`}
      fill={spot.taken ? "#ffffff" : "#777777"}
      stroke="#111111"
      stroke-width={unit * 0.4}
    />
  {/each}

  {#each Object.entries(auto.points) as [name, point] (name)}
    <circle cx={x(point[0])} cy={y(point[1])} r={unit * 0.8} fill="#ffc516" stroke="#111" stroke-width={unit * 0.25} />
    <text x={x(point[0])} y={y(point[1]) + unit * 3.4} font-size={unit * 2.2} text-anchor="middle" fill="#ffffff" stroke="#000000" stroke-width={unit * 0.4} paint-order="stroke">{name}</text>
  {/each}
</svg>
