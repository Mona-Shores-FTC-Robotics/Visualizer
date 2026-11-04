<script lang="ts">
  import { Lock, LockOpen } from "@lucide/svelte";
  import type { StartPose } from "../../types";
  import { FIELD_SIZE } from "../../config";
  import { updateStartPoint } from "../../model/commands";
  import { setStartHeading } from "../simple/steps";
  import { editSpot, unlockedSpots } from "../team/spotsStore";
  import { useProject } from "../../state/project.svelte";
  import IconButton from "./ui/IconButton.svelte";
  import { fieldClass, labelClass } from "./ui/styles";

  const project = useProject();
  let startPoint = $derived(project.doc.startPoint);
  /** The start's named spot, when it is a team spot: locked until unlocked, like its X and Y on the field. */
  let teamStart = $derived.by(() => {
    const auto = project.doc.auto;
    const name = auto?.startAt;
    return name && auto?.teamSpots?.includes(name) ? name : null;
  });
  let facingLocked = $derived(
    startPoint.locked || (teamStart !== null && !$unlockedSpots.has(teamStart)),
  );

  function face(value: number) {
    const turned = setStartHeading(project.doc, value);
    project.apply(() => turned, { coalesce: "start.heading" });
    const name = turned.auto?.startAt;
    const point = name ? turned.auto?.points[name] : undefined;
    // An unlocked team start is a team spot edit, saved with Save team spots.
    if (teamStart && point) editSpot(teamStart, point);
  }

  function update(patch: Partial<StartPose>, field?: string) {
    project.apply(updateStartPoint(patch), {
      coalesce: field && `start.${field}`,
    });
  }

  function numberFrom(input: HTMLInputElement): number | null {
    const value = parseFloat(input.value);
    return Number.isNaN(value) ? null : value;
  }
</script>

<div class="grid grid-cols-[1fr_1fr_auto] items-end gap-2 px-1">
  <label class="col-span-2 flex flex-col gap-1">
    <span class={labelClass}>Name</span>
    <input
      class={fieldClass}
      value={startPoint.name ?? ""}
      placeholder="start"
      disabled={startPoint.locked}
      oninput={(event) => update({ name: event.currentTarget.value }, "name")}
    />
  </label>
  <IconButton
    label={startPoint.locked ? "Unlock the start" : "Lock the start"}
    active={startPoint.locked}
    onclick={() => update({ locked: !startPoint.locked })}
  >
    {#if startPoint.locked}<Lock />{:else}<LockOpen />{/if}
  </IconButton>

  <label class="flex flex-col gap-1">
    <span class={labelClass}>X</span>
    <input
      class={fieldClass}
      type="number"
      min="0"
      max={FIELD_SIZE}
      step="0.1"
      value={startPoint.x}
      disabled={startPoint.locked}
      oninput={(event) => {
        const x = numberFrom(event.currentTarget);
        if (x !== null) update({ x }, "x");
      }}
    />
  </label>
  <label class="flex flex-col gap-1">
    <span class={labelClass}>Y</span>
    <input
      class={fieldClass}
      type="number"
      min="0"
      max={FIELD_SIZE}
      step="0.1"
      value={startPoint.y}
      disabled={startPoint.locked}
      oninput={(event) => {
        const y = numberFrom(event.currentTarget);
        if (y !== null) update({ y }, "y");
      }}
    />
  </label>
  <label class="col-start-1 flex flex-col gap-1">
    <span class={labelClass}>Facing (deg)</span>
    <input
      class={fieldClass}
      type="number"
      step="5"
      value={startPoint.headingDeg}
      disabled={facingLocked}
      title="Which way the robot faces at the start, in degrees: 0 faces +x (toward the blue alliance wall), 90 faces +y. A partner stand-in that never drives is turned here."
      onchange={(event) => {
        const h = numberFrom(event.currentTarget);
        if (h !== null) face(h);
      }}
    />
  </label>
</div>
