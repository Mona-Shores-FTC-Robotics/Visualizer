<script lang="ts">
  /**
   * Fork: one robot in a side panel of the Match view (two Autos shown together): the first Auto in
   * the left panel, the other in the right, either side of the field and its timeline. Its result,
   * its timing for this look, and the way back to editing it; what can happen to it in the match is
   * asked above the field.
   */
  import { useAuto } from "../../state/auto.svelte";
  import { useProject } from "../../state/project.svelte";
  import { activePaths, currentFilePath } from "../../stores";
  import * as browserFileStore from "../../utils/browserFileStore";
  import { confirmDialog } from "../dialog";
  import { showToast } from "../toast";
  import { teamOpenRequest } from "../team/teamView";
  import MatchControls from "./MatchControls.svelte";
  import { robotSummary } from "./lanes";

  interface Props {
    /** Which Auto shown: 0 on the left, 1 on the right. */
    index: number;
  }

  let { index }: Props = $props();

  const auto = useAuto();
  const project = useProject();

  let robot = $derived(auto.matchRobots[index]);

  /**
   * Leaves the Match view for this Auto's builder. The open project just drops the others; another
   * file opens on its own (the open project's unsaved changes asked about first).
   */
  async function edit() {
    if (!robot) return;
    if (robot.file === $currentFilePath) {
      activePaths.set([]);
      return;
    }
    if (
      project.dirty &&
      !(await confirmDialog({
        title: `Edit ${robot.name}?`,
        message: "The open project's unsaved changes will be lost.",
        confirmLabel: "Discard changes",
      }))
    )
      return;
    try {
      const text = await browserFileStore.readFile(robot.file);
      teamOpenRequest.set({ path: robot.file, text, overlays: [] });
    } catch (error) {
      showToast(
        `Could not open ${robot.name}: ${(error as Error).message}`,
        "error",
      );
    }
  }
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
  {#if robot}
    <button
      type="button"
      class="self-start rounded-md border border-border px-2 py-1 text-[11px] text-body hover:text-heading"
      title="Leave the Match view and open this Auto in the builder"
      onclick={edit}>Edit {robot.name}</button
    >
  {/if}
</div>
