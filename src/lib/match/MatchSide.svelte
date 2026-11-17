<script lang="ts">
  /**
   * Fork: the Match view's side panel (two Autos shown together): the match's result, the TIPs, and
   * each robot's questions, timing and the way back to editing it, in the left panel; the field and
   * its timeline take the rest of the window.
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

  const auto = useAuto();
  const project = useProject();

  /**
   * Leaves the Match view for this Auto's builder. The open project just drops the others; another
   * file opens on its own (the open project's unsaved changes asked about first).
   */
  async function edit(index: number) {
    const robot = auto.matchRobots[index];
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

<MatchControls
  robots={auto.matchRobots}
  controls={auto.match}
  base={auto.baseValues}
  entries={auto.overlayTogether.entries}
  values={auto.matchValues}
  show="panel"
  result={auto.matchResultLine}
  untaken={auto.overlayUntaken}
  onUntaken={(on) => (auto.overlayUntaken = on)}
  summaries={auto.matchRobots.map((_, i) =>
    auto.matchLanes?.robots[i]
      ? robotSummary(auto.matchLanes.robots[i])
      : undefined,
  )}
  onEdit={(i) => void edit(i)}
/>
