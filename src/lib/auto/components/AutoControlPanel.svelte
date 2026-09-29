<script lang="ts">
  import type * as d3 from "d3";
  import type { BasePoint, Shape, StartPose } from "../../../types";
  import type { PathCatalog } from "../geometry";
  import type { AutoIssue } from "../validate";
  import type { PreviewResult, WorstCase } from "../simulate";
  import type { AutoSection } from "../types";
  import PlaybackControls from "../../components/PlaybackControls.svelte";
  import CardEditor from "./CardEditor.svelte";
  import RegistryPanel from "./RegistryPanel.svelte";
  import AutoPreviewPanel from "./AutoPreviewPanel.svelte";
  import { ACTION_CLASS, SECTION_CLASS } from "./ui";
  import { selectedCardId } from "../store";

  interface Props {
    auto: AutoSection;
    catalog: PathCatalog;
    issues: AutoIssue[];
    preview: PreviewResult;
    worst: WorstCase | null;
    startPoint: StartPose;
    robotXY: BasePoint;
    robotHeading: number;
    x: d3.ScaleLinear<number, number>;
    y: d3.ScaleLinear<number, number>;
    playing: boolean;
    play: () => void;
    pause: () => void;
    percent: number;
    handleSeek: (percent: number) => void;
    loopAnimation: boolean;
    defaultExportName: string;
    onExport: () => void;
    shapes: Shape[];
  }

  let {
    auto,
    catalog,
    issues,
    preview,
    worst,
    startPoint = $bindable(),
    robotXY,
    robotHeading,
    x,
    y,
    playing,
    play,
    pause,
    percent = $bindable(),
    handleSeek,
    loopAnimation = $bindable(),
    defaultExportName,
    onExport,
    shapes,
  }: Props = $props();

  let errors = $derived(issues.filter((issue) => issue.level === "error"));
  let warnings = $derived(issues.filter((issue) => issue.level === "warning"));
  let now = $derived((percent / 100) * preview.endTime);
  let robotInches = $derived({ x: x.invert(robotXY.x), y: y.invert(robotXY.y) });
  let markers = $derived(
    preview.endTime > 0
      ? preview.log
          .filter((entry) => entry.kind === "row" || entry.kind === "event" || entry.kind === "guard")
          .map((entry) => ({
            percent: (entry.t / preview.endTime) * 100,
            color: entry.kind === "event" ? "#ffc516" : entry.kind === "guard" ? "#e5484d" : "#ffffff",
            name: `${entry.t.toFixed(1)} s · ${entry.text}`,
          }))
      : [],
  );
</script>

<div class="min-h-0 flex-1 flex flex-col justify-start items-center gap-2 h-full">
  <div
    class="min-h-0 flex-1 flex flex-col justify-start items-start w-full bg-[#1a1a1a] border border-[#333333] p-3 overflow-y-auto overflow-x-hidden gap-3"
  >
    <CardEditor {auto} {catalog} {issues} {preview} {worst} {shapes} />

    <AutoPreviewPanel {auto} {preview} {worst} {now} />

    <RegistryPanel {auto} {defaultExportName} robotAt={robotInches} pathNames={catalog.names} bind:startPoint />

    <div class={SECTION_CLASS}>
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="font-semibold text-gray-100">Export Auto (Java)</div>
          <div class="text-[11px] text-gray-500">
            {errors.length
              ? `${errors.length} problem${errors.length === 1 ? "" : "s"} to fix first`
              : warnings.length
                ? `Ready, with ${warnings.length} warning${warnings.length === 1 ? "" : "s"}`
                : "Ready: builds the whole Auto for the robot's autokit"}
          </div>
        </div>
        <button type="button" class="{ACTION_CLASS} text-[11px]" class:!border-[#1a3f82]={!errors.length} class:!bg-[#0b1b3a]={!errors.length}
          onclick={onExport} title={errors.length ? "Fix the problems listed below first" : "Download the generated class"}>
          Export .java
        </button>
      </div>
      {#if issues.length}
        <div class="max-h-40 space-y-1 overflow-auto">
          {#each issues as issue, i (i)}
            <button
              type="button"
              class="block w-full border px-2 py-1 text-left text-[11px]"
              class:border-red-800={issue.level === "error"}
              class:text-red-300={issue.level === "error"}
              class:border-amber-800={issue.level === "warning"}
              class:text-amber-300={issue.level === "warning"}
              onclick={() => issue.cardId && selectedCardId.set(issue.cardId)}
            >
              {issue.level === "error" ? "✕" : "⚠"} {issue.message}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <PlaybackControls
    {playing}
    {play}
    {pause}
    bind:percent
    {handleSeek}
    bind:loopAnimation
    {markers}
    totalTime={preview.endTime}
  />
</div>
