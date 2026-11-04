<script lang="ts">
  import { PanelRight } from "@lucide/svelte";
  import { useEditor } from "../state/editor.svelte";
  import type { Prefs } from "../state/prefs.svelte";
  import IconButton from "../lib/components/ui/IconButton.svelte";
  import { surfaceClass } from "../lib/components/ui/styles";
  import DocumentInspector from "./inspector/DocumentInspector.svelte";
  import GroupInspector from "./inspector/GroupInspector.svelte";
  import ObstacleInspector from "./inspector/ObstacleInspector.svelte";
  import PathInspector from "./inspector/PathInspector.svelte";
  import SelectionInspector from "./inspector/SelectionInspector.svelte";
  import { useAuto } from "../state/auto.svelte";
  import MatchSide from "../lib/match/MatchSide.svelte";
  import StepSide from "../lib/simple/StepSide.svelte";
  import { isSimple, stepForLine } from "../lib/simple/steps";
  import { useProject } from "../state/project.svelte";

  interface Props {
    prefs: Prefs;
    hidden?: boolean;
    onHide: () => void;
  }

  let { prefs, hidden = false, onHide }: Props = $props();

  const editor = useEditor();
  const auto = useAuto();
  const project = useProject();

  let selectedGroup = $derived(
    editor.selectedPath?.kind === "compound" ? editor.selectedPath : null,
  );
  let several = $derived(editor.selectedPathIds.length > 1);
  /**
   * Fork: a simple Auto's Drive or Park step that ends on a spot (or that spot's park path): the
   * step panel, not the path editor.
   */
  let simpleStep = $derived.by(() => {
    if (!editor.selectedLine || !isSimple(project.doc)) return null;
    const found = stepForLine(project.doc, editor.selectedLine.id);
    return found?.step.spot && project.doc.auto?.points[found.step.spot]
      ? found
      : null;
  });
  let title = $derived(
    // Fork: in the Match view with two Autos, the right panel is the second robot's what-ifs.
    auto.matchSides
      ? "Match"
      : editor.selectedShape
        ? "Obstacle"
        : several
          ? "Selection"
          : selectedGroup
            ? "Group"
            : editor.selectedLine
              ? simpleStep
                ? "Step"
                : "Path"
              : "Project",
  );
</script>

<aside
  class={[
    surfaceClass,
    "flex min-h-0 flex-col overflow-hidden p-2",
    hidden && "pointer-events-none invisible",
  ]}
  aria-label="Inspector"
>
  <div class="flex items-center justify-between px-1 pb-2">
    <h2 class="text-sm font-semibold text-heading">{title}</h2>
    <IconButton label="Hide inspector" size="sm" onclick={onHide}>
      <PanelRight />
    </IconButton>
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto px-1 pb-1">
    {#if auto.matchSides}
      <MatchSide index={1} />
    {:else if editor.selectedShape}
      <ObstacleInspector shape={editor.selectedShape} />
    {:else if several}
      <SelectionInspector />
    {:else if selectedGroup}
      <GroupInspector group={selectedGroup} />
    {:else if editor.selectedLine && simpleStep}
      <StepSide line={editor.selectedLine} />
    {:else if editor.selectedLine}
      <PathInspector line={editor.selectedLine} />
    {:else}
      <DocumentInspector {prefs} />
    {/if}
  </div>
</aside>
