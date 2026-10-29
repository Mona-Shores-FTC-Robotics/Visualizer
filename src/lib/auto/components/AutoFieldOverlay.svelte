<script lang="ts">
  import type { Axis } from "../../../view/viewport";
  import { FIELD_SIZE } from "../../../config";
  import type { BasePoint } from "../../../types";
  import type { PathCatalog } from "../geometry";
  import type { PreviewResult } from "../simulate";
  import { allCards } from "../tree";
  import type { AutoCard, AutoSection, NamedPoint, PathCard } from "../types";
  import { fieldHover, parseSelection, selectedCardId } from "../store";
  import { cardColors } from "./ui";
  import { isUsed, pointUses } from "../pins";

  interface Props {
    auto: AutoSection;
    catalog: PathCatalog;
    preview: PreviewResult | null;
    x: Axis;
    y: Axis;
    showUntaken: boolean;
    /**
     * Plan view (lib/plan): each branching wait is a ◆ button on the field; pressing it shows
     * that wait's miss, or the good path again. `missId` is the miss open, if any.
     */
    onDecision?: (cardId: string) => void;
    missId?: string | null;
    /** A wait on the plan: its tip's name and how many tries back it up; null for any other. */
    decision?: (cardId: string) => { label: string; backups: number } | null;
  }

  let {
    auto,
    catalog,
    preview,
    x,
    y,
    showUntaken,
    onDecision,
    missId = null,
    decision,
  }: Props = $props();

  let size = $derived(x(FIELD_SIZE));
  let colors = $derived(cardColors(auto.cards));
  let selectedId = $derived(parseSelection($selectedCardId).cardId);
  // A rejoin drives a path too; it is drawn like any other.
  let pathCards = $derived(
    allCards(auto.cards).flatMap((card): PathCard[] =>
      card.kind === "path"
        ? [card]
        : card.kind === "rejoin"
          ? [{ id: card.id, kind: "path", lineId: card.lineId, park: false }]
          : [],
    ),
  );
  let usedLineIds = $derived(new Set(pathCards.map((card) => card.lineId)));
  let unit = $derived(size / FIELD_SIZE);
  let uses = $derived(pointUses(auto));
  /** Fork: the spot the selected drive ends on; its name stays shown. */
  let selectedSpot = $derived.by(() => {
    const card = pathCards.find((c) => c.id === selectedId);
    return card ? (auto.pathEnds[card.lineId] ?? null) : null;
  });
  /** Fork: a spot's name shows only near the mouse, or for the selected drive's spot. */
  const HOVER_IN = 4;
  const nameShown = (name: string, point: NamedPoint) =>
    name === selectedSpot ||
    (!!$fieldHover &&
      Math.hypot($fieldHover.x - point[0], $fieldHover.y - point[1]) <= HOVER_IN);

  const polyline = (points: BasePoint[]) =>
    points.map((p) => `${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ");

  /** Where each decision waits: the end of the last path driven before it. */
  let decisionSpots = $derived.by(() => {
    const spots: { id: string; at: BasePoint; taken: boolean }[] = [];
    const walk = (list: AutoCard[], at: BasePoint | null): BasePoint | null => {
      let here = at;
      for (const card of list) {
        if (card.kind === "path")
          here = catalog.byId.get(card.lineId)?.end ?? here;
        if (
          card.kind === "firstOf" &&
          card.rows.some((row) => row.cards.length)
        ) {
          if (here)
            spots.push({
              id: card.id,
              at: here,
              taken: !preview || preview.ran.has(card.id),
            });
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
  {#each catalog.paths.filter((path) => !usedLineIds.has(path.id) && !auto.linkPaths?.includes(path.id)) as path (path.id)}
    <polyline
      points={polyline(path.samples)}
      fill="none"
      stroke="#9a9a9a"
      stroke-width={unit * 0.35}
      stroke-dasharray={`${unit} ${unit}`}
      opacity="0.45"
    />
  {/each}

  <!-- Untaken first, so the preview's route is drawn on top. -->
  {#each [false, true] as layerTaken (layerTaken)}
    {#each pathCards.filter((card) => ran(card) === layerTaken) as card (card.id)}
      {@const info = catalog.byId.get(card.lineId)}
      {#if info && (layerTaken || showUntaken)}
        {@const color = colors.get(card.id) ?? "#ffc516"}
        {@const selected = selectedId === card.id}
        {#if selected}
          <polyline
            points={polyline(info.samples)}
            fill="none"
            stroke="#ffffff"
            stroke-width={unit * 1.6}
            stroke-linecap="round"
            stroke-linejoin="round"
            opacity="0.35"
          />
        {/if}
        <polyline
          points={polyline(info.samples)}
          fill="none"
          stroke={color}
          stroke-width={unit * (selected ? 0.95 : 0.7)}
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-dasharray={layerTaken
            ? undefined
            : `${unit * 2.4} ${unit * 1.8}`}
          opacity={layerTaken ? 1 : 0.5}
        />
        {#if card.park}
          <text
            x={x(info.end.x)}
            y={y(info.end.y) - unit * 2.2}
            font-size={unit * 2.6}
            font-weight="700"
            text-anchor="middle"
            fill={color}
            stroke="var(--base)"
            stroke-width={unit * 0.35}
            paint-order="stroke"
            opacity={layerTaken ? 1 : 0.6}>P</text
          >
        {/if}
      {/if}
    {/each}
  {/each}

  {#each onDecision ? [] : decisionSpots as spot (spot.id)}
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

  <!-- Named points. A point that nothing uses is drawn hollow and grey. -->
  {#each Object.entries(auto.points) as [name, point] (name)}
    {@const used = isUsed(uses.get(name))}
    <circle
      cx={x(point[0])}
      cy={y(point[1])}
      r={unit * (used ? 0.8 : 0.7)}
      fill={used ? "#ffc516" : "none"}
      stroke={used ? "#111" : "#9a9a9a"}
      stroke-width={unit * 0.25}
    />
    {#if nameShown(name, point)}<text
      x={x(point[0])}
      y={y(point[1]) + unit * 3.4}
      font-size={unit * 2.2}
      text-anchor="middle"
      fill={used ? "var(--heading)" : "var(--body)"}
      stroke="var(--base)"
      stroke-width={unit * 0.4}
      paint-order="stroke">{used ? name : `${name} (unused)`}</text
    >{/if}
  {/each}
</svg>

{#if onDecision}
  {#each decisionSpots.filter((spot) => (spot.taken || spot.id === missId) && decision?.(spot.id)) as spot (spot.id)}
    {@const open = spot.id === missId}
    {@const { label, backups } = decision!(spot.id)!}
    <button
      type="button"
      class={[
        "absolute z-40 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-sm border-2 text-[11px] font-bold shadow",
        open
          ? "rotate-45 border-warning bg-warning text-base"
          : "rotate-45 border-base bg-heading text-base hover:bg-warning",
      ]}
      style={`left: ${x(spot.at.x)}px; top: ${y(spot.at.y)}px;`}
      title={open
        ? `Showing: ${label} doesn't come. Press for the good path.`
        : `What if ${label} doesn't come?`}
      aria-label={open
        ? `Back to the good path (${label} comes)`
        : `Show what happens if ${label} doesn't come`}
      aria-pressed={open}
      onpointerdown={(event) => event.stopPropagation()}
      onclick={() => onDecision(spot.id)}
      ><span class="-rotate-45">{open ? "✕" : "?"}</span></button
    >
    {#if backups > 0}
      <span
        class="pointer-events-none absolute z-40 translate-x-3 -translate-y-1/2 rounded-full border border-warning bg-base px-1.5 text-[10px] font-semibold whitespace-nowrap text-warning"
        style={`left: ${x(spot.at.x)}px; top: ${y(spot.at.y)}px;`}
        >{backups} {backups === 1 ? "backup" : "backups"}</span
      >
    {/if}
  {/each}
{/if}
