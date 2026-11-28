<script lang="ts">
  /**
   * Fork: the human player's NECTAR over the field, at the playback clock (nectar.ts): in our
   * LOADING ZONE once its TIP has settled, rolling to the intake of the robot that catches it,
   * riding in that robot, then flying to the CELL. Drawn as the HIVE draws a NECTAR (HiveCells),
   * inside the field's own group: inches, Pedro's frame.
   */
  import { nectarsAt, type NectarTrack } from "./nectar";
  import { pollenAt, type PieceFlight } from "./pollen";

  interface Props {
    tracks: NectarTrack[];
    /** Fork: the volleys' POLLEN, flying from the turret to the CELL (pollen.ts). */
    pollen?: PieceFlight[];
    seconds: number;
  }
  let { tracks, pollen = [], seconds }: Props = $props();

  let pieces = $derived(nectarsAt(tracks, seconds));
  let flying = $derived(pollenAt(pollen, seconds));
</script>

<g pointer-events="none" aria-hidden="true">
  {#each flying as piece (piece.key)}
    <circle
      cx={piece.x}
      cy={piece.y}
      r={1.9}
      fill="#ffd23f"
      stroke="#7a5b00"
      stroke-width={0.4}
      data-testid="pollen-piece"
    />
  {/each}
  {#each pieces as piece (piece.tip)}
    <circle
      cx={piece.x}
      cy={piece.y}
      r={piece.state === "flying" ? 2.3 : 1.9}
      fill="#e03131"
      stroke={piece.state === "held" ? "#ffffff" : "#5c0a0a"}
      stroke-width={piece.state === "held" ? 0.5 : 0.4}
      data-testid="nectar-piece"
      data-state={piece.state}
    />
  {/each}
</g>
