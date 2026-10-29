<script lang="ts">
  /**
   * Fork: above the field, what the preview shows: an answer per trigger the
   * Auto waits on, the timing model, and whether to draw the other branches.
   */
  import { previewScenario } from "../lib/auto/store";
  import AutoPreviewSwitches from "../lib/auto/components/AutoPreviewSwitches.svelte";
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

<div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1">
  {#if auto.auto && !overlays.active}
    <AutoPreviewSwitches auto={auto.auto} />
  {/if}
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
  {#if !overlays.active}
    <label
      class={[labelClass, "flex items-center gap-1.5"]}
      title="Draw the branches this preview does not take, dashed"
    >
      <input
        type="checkbox"
        class={checkboxClass}
        bind:checked={auto.showUntaken}
      />
      Other branches
    </label>
  {/if}
  <span
    class={[labelClass, "ml-auto whitespace-nowrap"]}
    title="Hold Shift while dragging a path point to keep it level or plumb with the previous point, so the path runs exactly along x or y"
  >
    Shift-drag: straight x/y
  </span>
</div>
