<script lang="ts">
  import { PanelLeft, Plus, RotateCcw } from "@lucide/svelte";
  import type { Settings } from "../types";
  import { getDefaultShapes } from "../config/defaults";
  import { createTriangle } from "../utils";
  import { atomicSegments } from "../utils/pathTraversal";
  import { setShapes } from "../model/commands";
  import { useEditor } from "../state/editor.svelte";
  import { useProject } from "../state/project.svelte";
  import type { Overlays } from "../state/overlays.svelte";
  import IconButton from "../lib/components/ui/IconButton.svelte";
  import PanelSection from "../lib/components/ui/PanelSection.svelte";
  import { surfaceClass } from "../lib/components/ui/styles";
  import PathTree from "./layers/PathTree.svelte";
  import ObstacleList from "./layers/ObstacleList.svelte";
  import OverlayList from "./layers/OverlayList.svelte";
  import { useAuto } from "../state/auto.svelte";
  import SimpleBuilder from "../lib/simple/SimpleBuilder.svelte";
  import MatchSide from "../lib/match/MatchSide.svelte";

  interface Props {
    settings: Settings;
    overlays: Overlays;
    hidden?: boolean;
    onHide: () => void;
  }

  let { settings, overlays, hidden = false, onHide }: Props = $props();

  const project = useProject();
  const editor = useEditor();
  const auto = useAuto();

  let overlaysOpen = $state(false);

  function addObstacle() {
    const shape = createTriangle();
    project.apply(setShapes([...project.doc.shapes, shape]));
    editor.selectShape(shape.id);
  }

  function resetObstacles() {
    project.apply(setShapes(getDefaultShapes(settings.fieldMap)));
  }
</script>

<aside
  class={[
    surfaceClass,
    "flex min-h-0 flex-col gap-1 overflow-hidden p-2",
    hidden && "pointer-events-none invisible",
  ]}
  aria-label="Layers"
>
  <div class="flex items-center justify-between px-1 pb-1">
    <h2 class="text-sm font-semibold text-heading">
      {auto.matchSides ? "Match" : "Layers"}
    </h2>
    <IconButton label="Hide layers" size="sm" onclick={onHide}>
      <PanelLeft />
    </IconButton>
  </div>

  <div class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
    {#if auto.matchSides}
      <!-- Fork: the Match view with two Autos: the first robot's what-ifs, in place of the builder. -->
      <MatchSide index={0} />
    {:else if auto.auto && auto.catalog}
      <!-- Fork: the Auto, in place of the path list; its cards drive the paths. -->
      <div class="flex flex-col">
        <SimpleBuilder />
      </div>
    {:else}
      <PanelSection
        title="Paths"
        count={atomicSegments(project.doc.lines).length}
      >
        {#snippet actions()}
          <IconButton
            label="Add path"
            size="sm"
            onclick={() => editor.addPath()}
          >
            <Plus />
          </IconButton>
        {/snippet}
        <PathTree />
      </PanelSection>
    {/if}

    {#if settings.experimentalFeatures?.obstacles}
      <PanelSection title="Obstacles" count={project.doc.shapes.length}>
        {#snippet actions()}
          <IconButton
            label="Reset obstacles to field default"
            size="sm"
            onclick={resetObstacles}
          >
            <RotateCcw />
          </IconButton>
          <IconButton label="Add obstacle" size="sm" onclick={addObstacle}>
            <Plus />
          </IconButton>
        {/snippet}
        <ObstacleList />
      </PanelSection>
    {/if}

    <!-- Fork: never squeezed to a sliver under a tall builder; the panel scrolls to it instead. -->
    <div class="shrink-0">
      <PanelSection
        title="Overlays"
        count={overlays.items.length || undefined}
        bind:open={overlaysOpen}
      >
        <OverlayList {overlays} />
      </PanelSection>
    </div>

  </div>
</aside>
