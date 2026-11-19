<script lang="ts">
  /**
   * Fork: the red HIVE's CELLs over the field image, at the playback clock (hiveView.ts). Each CELL
   * is drawn over the image's own (which shows the HIVE as the match starts): up, it is light and
   * outlined, and holds its pieces (the start's 3 NECTAR, then the POLLEN that land); down, it is
   * dark and empty, since what was in it spilled out. A TIP crossfades the two over its swing.
   * Drawn inside the field's own group: inches, Pedro's frame.
   */
  import { hiveAt, RED_CELLS, type Cell, type HiveHistory } from "./hiveView";
  import type { TimingValues } from "../timing/model";

  interface Props {
    history: HiveHistory;
    values: TimingValues;
    seconds: number;
  }
  let { history, values, seconds }: Props = $props();

  let view = $derived(hiveAt(history, values, seconds));
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
</g>
