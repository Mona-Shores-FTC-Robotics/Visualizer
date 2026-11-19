<script lang="ts">
  /**
   * Fork: the red HIVE's CELLs over the field image, at the playback clock (hiveView.ts). Each CELL
   * is drawn over the image's own (which shows the HIVE as the match starts): up, it is light and
   * outlined, and holds its pieces (the start's 3 NECTAR, then the POLLEN that land); down, it is
   * dark and empty, since what was in it spilled out. A TIP crossfades the two over its swing.
   * Drawn inside the field's own group: inches, Pedro's frame.
   */
  import {
    hiveAt,
    missesAt,
    RED_CELLS,
    type Cell,
    type HiveHistory,
    type MissView,
  } from "./hiveView";
  import type { TimingValues } from "../timing/model";

  interface Props {
    history: HiveHistory;
    values: TimingValues;
    seconds: number;
  }
  let { history, values, seconds }: Props = $props();

  let view = $derived(hiveAt(history, values, seconds));
  let misses = $derived(missesAt(history, values, seconds));
  /**
   * A volley that does not count: its pieces hit the CELL's outer edge (where the shots come from:
   * LEFT's from the scoring end, RIGHT's from the other) and fall away from it, fading; a red ✕
   * marks the miss. The CELL itself does not change.
   */
  function missDrawing(miss: MissView) {
    const box = RED_CELLS[miss.cell];
    const out = miss.cell === "left" ? 1 : -1;
    const edge = miss.cell === "left" ? box.y + box.h : box.y;
    const fall = 1.8 + 8 * miss.age;
    const pieces = Array.from({ length: Math.min(8, miss.pieces) }, (_, i) => {
      const spread = (i - (miss.pieces - 1) / 2) * 3.4;
      return {
        x: box.x + box.w / 2 + spread * (1 + 0.6 * miss.age),
        y: edge + out * (fall + (i % 2) * 1.2),
      };
    });
    const cross = { x: box.x + box.w / 2, y: edge + out * 0.2, r: 2.6 };
    return { pieces, cross, opacity: 1 - miss.age };
  }
  const CELLS: Cell[] = ["left", "right"];
  /** The CELL's pieces, NECTAR first: two rows of four. */
  function pieces(cell: Cell, nectar: boolean, pollen: number) {
    const box = RED_CELLS[cell];
    const kinds = [
      ...(nectar ? Array(3).fill("nectar") : []),
      ...Array(Math.max(0, pollen)).fill("pollen"),
    ].slice(0, 8) as ("nectar" | "pollen")[];
    return kinds.map((kind, i) => ({
      kind,
      x: box.x + box.w * (0.2 + 0.2 * (i % 4)),
      y: box.y + box.h * (i < 4 ? 0.64 : 0.36),
    }));
  }
</script>

<g pointer-events="none" aria-hidden="true">
  {#each CELLS as cell (cell)}
    {@const box = RED_CELLS[cell]}
    {@const state = view[cell]}
    <rect
      x={box.x}
      y={box.y}
      width={box.w}
      height={box.h}
      rx={1.2}
      fill="#8c9199"
      stroke="#dc2626"
      stroke-width={0.9}
    />
    <rect
      x={box.x}
      y={box.y}
      width={box.w}
      height={box.h}
      rx={1.2}
      fill="#16181c"
      opacity={0.9 * state.down}
    />
    <rect
      x={box.x + 0.5}
      y={box.y + 0.5}
      width={box.w - 1}
      height={box.h - 1}
      rx={1}
      fill="none"
      stroke="#ffd23f"
      stroke-width={1}
      opacity={1 - state.down}
    />
    {#each pieces(cell, state.nectar, state.pollen) as piece, i (i)}
      <circle
        cx={piece.x}
        cy={piece.y}
        r={1.6}
        fill={piece.kind === "nectar" ? "#e03131" : "#ffd23f"}
        stroke={piece.kind === "nectar" ? "#5c0a0a" : "#7a5b00"}
        stroke-width={0.35}
        opacity={1 - state.down}
      />
    {/each}
  {/each}
  {#each misses as miss, m (m)}
    {@const drawing = missDrawing(miss)}
    <g opacity={drawing.opacity}>
      {#each drawing.pieces as piece, i (i)}
        <circle
          cx={piece.x}
          cy={piece.y}
          r={1.5}
          fill="#ffd23f"
          fill-opacity={0.55}
          stroke="#e03131"
          stroke-width={0.45}
        />
      {/each}
      <path
        d={`M ${drawing.cross.x - drawing.cross.r} ${drawing.cross.y - drawing.cross.r} L ${drawing.cross.x + drawing.cross.r} ${drawing.cross.y + drawing.cross.r} M ${drawing.cross.x - drawing.cross.r} ${drawing.cross.y + drawing.cross.r} L ${drawing.cross.x + drawing.cross.r} ${drawing.cross.y - drawing.cross.r}`}
        stroke="#ff3b30"
        stroke-width={1.1}
        stroke-linecap="round"
      />
    </g>
  {/each}
</g>
