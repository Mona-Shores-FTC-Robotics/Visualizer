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
  import { launchLine } from "../../simple/aim";

  interface Props {
    auto: AutoSection;
    catalog: PathCatalog;
    preview: PreviewResult | null;
    x: Axis;
    y: Axis;
    /**
     * Fork: a spot's park path to show (AutoSection.parkFrom), with every other path dimmed.
     * The spots' park paths are not drawn otherwise.
     */
    focusLine?: string | null;
    /**
     * Fork: the robot's frame, inches, for the ghost drawn on the selected step's spot at its
     * facing; and the spots a Launch all fires from, which also get the turret's line to the CELL.
     */
    robotLength?: number;
    robotWidth?: number;
    launchSpots?: ReadonlySet<string>;
  }

  let {
    auto,
    catalog,
    preview,
    x,
    y,
    focusLine = null,
    robotLength = 0,
    robotWidth = 0,
    launchSpots = new Set<string>(),
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
  let spotParkIds = $derived(new Set(Object.values(auto.parkFrom ?? {})));
  let focusInfo = $derived(focusLine ? catalog.byId.get(focusLine) : undefined);
  let unit = $derived(size / FIELD_SIZE);
  let uses = $derived(pointUses(auto));
  /** Fork: the spot the selected drive ends on; its name stays shown. */
  let selectedSpot = $derived.by(() => {
    const card = pathCards.find((c) => c.id === selectedId);
    return card ? (auto.pathEnds[card.lineId] ?? null) : null;
  });
  /**
   * Fork: the selected step's spot as the robot stands there: a ghost of its frame at the spot's
   * facing, which the robot sprite only shows when the timeline is at that moment; and, when a
   * Launch all fires from it, the locked turret's line out to the CELL's row.
   */
  let ghost = $derived.by(() => {
    if (!selectedSpot || !(robotLength > 0) || !(robotWidth > 0)) return null;
    const point = auto.points[selectedSpot];
    if (!point || point[2] === undefined) return null;
    const [px, py, h] = point;
    return {
      cx: x(px),
      cy: y(py),
      // The screen's y runs down, so a counter-clockwise heading turns the other way on it.
      rotate: -h,
      shot: launchSpots.has(selectedSpot)
        ? launchLine(px, py, h, auto.drawnFor === "BLUE" ? "BLUE" : "RED")
        : null,
    };
  });
  /** Fork: a spot's name shows only near the mouse, or for the selected drive's spot. */
  const HOVER_IN = 4;
  const nameShown = (name: string, point: NamedPoint) =>
    name === selectedSpot ||
    (!!$fieldHover &&
      Math.hypot($fieldHover.x - point[0], $fieldHover.y - point[1]) <=
        HOVER_IN);

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
  <g opacity={focusInfo ? 0.2 : 1}>
    <!-- Paths no card drives: faint, so the whole drawing stays visible. -->
    {#each catalog.paths.filter((path) => !usedLineIds.has(path.id) && !spotParkIds.has(path.id) && !auto.linkPaths?.includes(path.id)) as path (path.id)}
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
        {#if info && layerTaken}
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
  </g>

  <!-- Fork: the park from a spot, shown by its P in the simple builder. -->
  {#if focusInfo}
    <polyline
      points={polyline(focusInfo.samples)}
      fill="none"
      stroke="#ffffff"
      stroke-width={unit * 1.6}
      stroke-linecap="round"
      stroke-linejoin="round"
      opacity="0.4"
    />
    <polyline
      points={polyline(focusInfo.samples)}
      fill="none"
      stroke="#ff8a3d"
      stroke-width={unit * 0.7}
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  {/if}

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

  {#if ghost}
    <!-- Fork: the selected step's spot as the robot stands on it (see `ghost`). -->
    <g opacity="0.85">
      <g transform={`rotate(${ghost.rotate} ${ghost.cx} ${ghost.cy})`}>
        <rect
          x={ghost.cx - (robotLength * unit) / 2}
          y={ghost.cy - (robotWidth * unit) / 2}
          width={robotLength * unit}
          height={robotWidth * unit}
          rx={unit * 1.2}
          fill="#ffffff"
          fill-opacity="0.08"
          stroke="#ffffff"
          stroke-width={unit * 0.3}
          stroke-dasharray={`${unit * 1.2} ${unit * 0.8}`}
        />
        <!-- Its front. -->
        <line
          x1={ghost.cx + (robotLength * unit) / 2}
          y1={ghost.cy - (robotWidth * unit) / 2}
          x2={ghost.cx + (robotLength * unit) / 2}
          y2={ghost.cy + (robotWidth * unit) / 2}
          stroke="#ffffff"
          stroke-width={unit * 0.8}
          stroke-linecap="round"
        />
      </g>
      {#if ghost.shot}
        <line
          x1={x(ghost.shot.axis.x)}
          y1={y(ghost.shot.axis.y)}
          x2={x(ghost.shot.end.x)}
          y2={y(ghost.shot.end.y)}
          stroke="#ffc516"
          stroke-width={unit * 0.4}
          stroke-dasharray={`${unit * 1.4} ${unit * 0.9}`}
        />
        <circle
          cx={x(ghost.shot.row.x)}
          cy={y(ghost.shot.row.y)}
          r={unit * 1.4}
          fill="none"
          stroke="#ffc516"
          stroke-width={unit * 0.35}
        />
      {/if}
    </g>
  {/if}

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
