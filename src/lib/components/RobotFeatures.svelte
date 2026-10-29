<script lang="ts">
  // Fork: the robot's features (src/types.ts, RobotFeature), drawn on top of its image in field
  // inches, so a part sticking out of the drive base shows where it is.
  import { FIELD_SIZE } from "../../config/defaults";
  import { featureBoxes, type Pose } from "../../model/collision";
  import type { RobotConfig } from "../../types";
  import { polylinePath } from "../../view/scene/svgPath";

  interface Props {
    pose: Pose;
    robot: Pick<RobotConfig, "features">;
    pixels: number;
    zIndex?: number;
    opacity?: number;
  }

  let { pose, robot, pixels, zIndex = 20, opacity = 1 }: Props = $props();

  let boxes = $derived(featureBoxes(pose, robot));
  const FEATURE_COLOR = "#f2c94c";
</script>

{#if boxes.length}
  <svg
    class="pointer-events-none absolute inset-0"
    style={`z-index: ${zIndex}; opacity: ${opacity};`}
    viewBox={`0 0 ${FIELD_SIZE} ${FIELD_SIZE}`}
    width={pixels}
    height={pixels}
    aria-hidden="true"
  >
    <g transform={`matrix(1 0 0 -1 0 ${FIELD_SIZE})`}>
      {#each boxes as box, index (index)}
        <path
          d={polylinePath(box.corners, true)}
          fill={box.color ?? FEATURE_COLOR}
          stroke="#1d1f23"
          stroke-width="0.12"
          stroke-linejoin="round"
        >
          <title>{box.name}</title>
        </path>
      {/each}
    </g>
  </svg>
{/if}
