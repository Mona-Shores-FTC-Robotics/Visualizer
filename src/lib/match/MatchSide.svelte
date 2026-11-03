<script lang="ts">
  /**
   * Fork: one robot's what-ifs in a side panel of the Match view (two Autos shown together): the
   * first Auto in the left panel, the other in the right, either side of the field and its timeline.
   */
  import { useAuto } from "../../state/auto.svelte";
  import MatchControls from "./MatchControls.svelte";
  import { robotSummary } from "./lanes";

  interface Props {
    /** Which Auto shown: 0 on the left, 1 on the right. */
    index: number;
  }

  let { index }: Props = $props();

  const auto = useAuto();
</script>

<div class="flex flex-col gap-2">
  <MatchControls
    robots={auto.matchRobots}
    controls={auto.match}
    base={auto.baseValues}
    entries={auto.overlayTogether.entries}
    values={auto.matchValues}
    show={index}
    summary={auto.matchLanes?.robots[index]
      ? robotSummary(auto.matchLanes.robots[index])
      : undefined}
  />
  {#if index === 0}
    <p class="px-1 text-[11px] text-body">
      Match view: each robot's what-ifs are beside the field; the HIVE's open
      from its label on the timeline. To edit an Auto again, untick the Autos
      under Overlays.
    </p>
  {/if}
</div>
