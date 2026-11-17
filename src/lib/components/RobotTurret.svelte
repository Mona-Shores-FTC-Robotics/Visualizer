<script lang="ts">
  // Fork: our robot's turret, drawn on top of its image in field inches so it can turn: straight
  // ahead as an Auto holds it, or on our CELL while a card aims it (lib/simple/aim.ts). The ring is
  // part of the robot's image (teamRobotImage); this is the barrel, and the line of the shot.
  import { FIELD_SIZE } from "../../config/defaults";
  import { TURRET_AXIS, type TurretAim } from "../simple/aim";

  interface Props {
    pose: { x: number; y: number; heading: number };
    /** The turret's angle from the robot's forward, degrees, counter-clockwise positive. */
    turretDeg: number;
    /** While the turret is on the CELL: where it aims, for the line of the shot. */
    aim?: TurretAim | null;
    pixels: number;
    zIndex?: number;
    opacity?: number;
  }

  let {
    pose,
    turretDeg,
    aim = null,
    pixels,
    zIndex = 20,
    opacity = 1,
  }: Props = $props();

  const BARREL_IN = 3.4;
  const BARREL_WIDTH_IN = 0.9;

  let axis = $derived.by(() => {
    const h = (pose.heading * Math.PI) / 180;
    return {
      x:
        pose.x +
        TURRET_AXIS.forwardIn * Math.cos(h) -
        TURRET_AXIS.leftIn * Math.sin(h),
      y:
        pose.y +
        TURRET_AXIS.forwardIn * Math.sin(h) +
        TURRET_AXIS.leftIn * Math.cos(h),
    };
  });
  let barrelDeg = $derived(pose.heading + turretDeg);
</script>

<svg
  class="pointer-events-none absolute inset-0"
  style={`z-index: ${zIndex}; opacity: ${opacity};`}
  viewBox={`0 0 ${FIELD_SIZE} ${FIELD_SIZE}`}
  width={pixels}
  height={pixels}
  aria-hidden="true"
>
  <g transform={`matrix(1 0 0 -1 0 ${FIELD_SIZE})`}>
    {#if aim}
      <line
        x1={axis.x}
        y1={axis.y}
        x2={aim.target.x}
        y2={aim.target.y}
        stroke="#e8743b"
        stroke-width="0.35"
        stroke-dasharray="1.2 1.2"
        stroke-linecap="round"
        opacity="0.8"
      >
        <title
          >Turret on our {aim.cell} CELL, {aim.rangeIn.toFixed(0)} in, {aim.offSquareDeg.toFixed(
            0,
          )}° off square</title
        >
      </line>
    {/if}
    <g transform={`translate(${axis.x} ${axis.y}) rotate(${barrelDeg})`}>
      <rect
        x="0"
        y={-BARREL_WIDTH_IN / 2}
        width={BARREL_IN}
        height={BARREL_WIDTH_IN}
        rx="0.2"
        fill="#1d1f23"
      />
      <circle r="0.45" fill="#1d1f23" />
    </g>
  </g>
</svg>
