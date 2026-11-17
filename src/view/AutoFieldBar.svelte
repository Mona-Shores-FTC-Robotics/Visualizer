<script lang="ts">
  /**
   * Fork: above the field, what the preview shows: an answer per trigger the
   * Auto waits on, the timing model, and whether to draw the other branches.
   */
  import { previewScenario } from "../lib/auto/store";
  import MatchControls from "../lib/match/MatchControls.svelte";
  import TimingControl from "../lib/timing/TimingControl.svelte";
  import { checkboxClass, labelClass } from "../lib/components/ui/styles";
  import { useProject } from "../state/project.svelte";
  import { useAuto } from "../state/auto.svelte";
  import type { Overlays } from "../state/overlays.svelte";

  interface Props {
    overlays: Overlays;
  }

  let { overlays }: Props = $props();

  const project = useProject();
  const auto = useAuto();
</script>

{#if auto.matchSides}
  <!-- Fork: the Match view with two Autos: only the match's result and the questions that change
       it (MatchControls' bar). The team's timing, the timeline and the side panels are always on
       here; drawing the branches not taken is in its More menu. -->
  <div class="px-1">
    <MatchControls
      robots={auto.matchRobots}
      controls={auto.match}
      base={auto.baseValues}
      entries={auto.overlayTogether.entries}
      values={auto.matchValues}
      show="bar"
      result={auto.matchResultLine}
      untaken={auto.overlayUntaken}
      onUntaken={(on) => (auto.overlayUntaken = on)}
    />
  </div>
{:else}
  <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1">
    <TimingControl
      tips={overlays.active
        ? auto.overlayTogether.tips
        : (auto.together?.tips ?? [])}
      entries={overlays.active
        ? auto.overlayTogether.entries
        : auto.auto
          ? [
              {
                auto: auto.auto,
                startPoint: project.doc.startPoint,
                lines: project.doc.lines,
                settings: { ...auto.settings },
                scenario: $previewScenario,
              },
            ]
          : []}
    />
    {#if overlays.active}
      <label
        class={[labelClass, "flex items-center gap-1.5"]}
        title="Draw the branches these Autos do not take in this preview, faint"
      >
        <input
          type="checkbox"
          class={checkboxClass}
          bind:checked={auto.overlayUntaken}
        />
        Other branches
      </label>
      {#if auto.overlayTogether.shown.length >= 2}
        <label
          class={[labelClass, "flex items-center gap-1.5"]}
          title="Under the field: what each Auto does when, the HIVE between them, and which volley's TIP ends which wait"
        >
          <input
            type="checkbox"
            class={checkboxClass}
            bind:checked={auto.matchTimeline}
          />
          Match timeline
        </label>
        {#if auto.matchTimeline}
          <label
            class={[labelClass, "flex items-center gap-1.5"]}
            title="Under the timeline: change each robot's facts, the HIVE's, which triggers come and who is a no-show, for this look only"
          >
            <input
              type="checkbox"
              class={checkboxClass}
              bind:checked={auto.matchControls}
            />
            What-ifs{auto.match.changed ? " •" : ""}
          </label>
        {/if}
      {/if}
    {/if}
    {#if !overlays.active}<span
        class={[labelClass, "ml-auto whitespace-nowrap"]}
        title="Hold Shift while dragging a path point to keep it level or plumb with the previous point, so the path runs exactly along x or y"
      >
        Shift-drag: straight x/y
      </span>{/if}
  </div>
{/if}
