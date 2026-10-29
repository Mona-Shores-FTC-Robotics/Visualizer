<script lang="ts">
  import { Plus, X } from "@lucide/svelte";
  import type { RobotConfig, RobotFeature, Settings } from "../../../types";
  import NumberField from "../ui/NumberField.svelte";
  import RobotImagePicker from "./RobotImagePicker.svelte";
  import { clampNumberInput } from "../../settings/numericSetting";
  import { updateRobot } from "../../../model/commands";
  import { useProject } from "../../../state/project.svelte";
  import { TEAM_ROBOT, isTeamRobot } from "../../auto/teamRobot";
  import Button from "../ui/Button.svelte";
  import { checkboxClass, fieldClass, labelClass } from "../ui/styles";

  interface Props {
    /** Display preferences: the robot image. */
    settings: Settings;
  }

  let { settings = $bindable() }: Props = $props();

  const project = useProject();
  let robot = $derived(project.doc.robot);
  let features = $derived(robot.features ?? []);
  let isTeam = $derived(isTeamRobot(robot));

  function setNumber(
    value: string,
    property: keyof RobotConfig,
    min?: number,
    max?: number,
  ) {
    project.apply(
      updateRobot({ [property]: clampNumberInput(value, min, max) }),
      { coalesce: `robot.${property}` },
    );
  }

  /** Fork: changes feature `index`; typing into one field is one undo step. */
  function setFeature(
    index: number,
    patch: Partial<RobotFeature>,
    coalesce?: string,
  ) {
    project.apply(
      updateRobot({
        features: features.map((f, i) =>
          i === index ? { ...f, ...patch } : f,
        ),
      }),
      coalesce ? { coalesce: `robot.features.${index}.${coalesce}` } : {},
    );
  }

  function addFeature() {
    project.apply(
      updateRobot({
        features: [
          ...features,
          {
            name: `Feature ${features.length + 1}`,
            length: 2,
            width: 2,
            forward: robot.rLength / 2 + 1,
            left: 0,
            collides: true,
          },
        ],
      }),
    );
  }

  function removeFeature(index: number) {
    project.apply(
      updateRobot({ features: features.filter((_, i) => i !== index) }),
    );
  }
</script>

<div class="flex flex-col gap-3 px-1">
  <div class="flex items-center gap-2">
    <Button
      size="sm"
      disabled={isTeam}
      title={`Drive base ${TEAM_ROBOT.rLength} x ${TEAM_ROBOT.rWidth}, plus the front frame and the FLOWER poker`}
      onclick={() => project.apply(updateRobot({ ...TEAM_ROBOT }))}
    >
      Use our robot
    </Button>
    <span class="text-xs text-body">
      {isTeam
        ? "This file has our robot."
        : "Sets this file's drive base and features to our robot's."}
    </span>
  </div>

  <div class="grid grid-cols-2 gap-2">
    <NumberField
      id="robot-length"
      label="Length (in)"
      value={robot.rLength}
      min={1}
      max={36}
      step={0.5}
      onInput={(v) => setNumber(v, "rLength", 1, 36)}
    />
    <NumberField
      id="robot-width"
      label="Width (in)"
      value={robot.rWidth}
      min={1}
      max={36}
      step={0.5}
      onInput={(v) => setNumber(v, "rWidth", 1, 36)}
    />
  </div>
  <p class="-mt-1 text-xs text-body">
    The drive base, centred on the wheelbase. Parts that stick out go in
    Features.
  </p>

  {#if robot.rForward}
    <!-- Fork: older files moved the box instead of adding a feature. -->
    <NumberField
      id="robot-forward"
      label="Box ahead of centre (in)"
      description="From an older file. Set it to 0 and add the part that sticks out as a feature instead."
      value={robot.rForward}
      min={-12}
      max={12}
      step={0.25}
      onInput={(v) => setNumber(v, "rForward", -12, 12)}
    />
  {/if}

  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <span class={labelClass}>Features</span>
      <Button size="sm" onclick={addFeature}>
        <Plus class="size-3.5" /> Add
      </Button>
    </div>
    {#if !features.length}
      <p class="text-xs text-body">
        None. Add a box for a part that sticks out of the drive base.
      </p>
    {/if}
    {#each features as feature, index (index)}
      <div
        class="flex flex-col gap-2 rounded-lg border border-border p-2"
        data-testid="robot-feature"
      >
        <div class="flex items-center gap-2">
          <input
            class={fieldClass}
            aria-label="Feature name"
            value={feature.name}
            oninput={(e) =>
              setFeature(index, { name: e.currentTarget.value }, "name")}
          />
          <button
            type="button"
            class="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-body transition hover:text-danger"
            title="Remove {feature.name}"
            aria-label="Remove {feature.name}"
            onclick={() => removeFeature(index)}
          >
            <X class="size-3.5" />
          </button>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <NumberField
            id="feature-{index}-length"
            label="Length (in)"
            value={feature.length}
            min={0.25}
            max={36}
            step={0.25}
            onInput={(v) =>
              setFeature(
                index,
                { length: clampNumberInput(v, 0.25, 36) },
                "length",
              )}
          />
          <NumberField
            id="feature-{index}-width"
            label="Width (in)"
            value={feature.width}
            min={0.25}
            max={36}
            step={0.25}
            onInput={(v) =>
              setFeature(
                index,
                { width: clampNumberInput(v, 0.25, 36) },
                "width",
              )}
          />
          <NumberField
            id="feature-{index}-forward"
            label="Ahead of centre (in)"
            value={feature.forward}
            min={-36}
            max={36}
            step={0.25}
            onInput={(v) =>
              setFeature(
                index,
                { forward: clampNumberInput(v, -36, 36) },
                "forward",
              )}
          />
          <NumberField
            id="feature-{index}-left"
            label="Left of centre (in)"
            value={feature.left}
            min={-36}
            max={36}
            step={0.25}
            onInput={(v) =>
              setFeature(index, { left: clampNumberInput(v, -36, 36) }, "left")}
          />
        </div>
        <label class="flex items-center gap-2 text-xs text-body">
          <input
            type="checkbox"
            class={checkboxClass}
            checked={feature.collides}
            onchange={(e) =>
              setFeature(index, { collides: e.currentTarget.checked })}
          />
          Counts for collisions
        </label>
      </div>
    {/each}
  </div>

  <NumberField
    id="safety-margin"
    label="Safety margin (in)"
    description="Buffer kept around obstacles."
    value={robot.safetyMargin}
    min={0}
    max={24}
    step={0.5}
    onInput={(v) => setNumber(v, "safetyMargin", 0, 24)}
  />

  <RobotImagePicker bind:settings {robot} />
</div>
