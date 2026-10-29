<script lang="ts">
  import type { RobotConfig, Settings } from "../../../types";
  import NumberField from "../ui/NumberField.svelte";
  import RobotImagePicker from "./RobotImagePicker.svelte";
  import { clampNumberInput } from "../../settings/numericSetting";
  import { updateRobot } from "../../../model/commands";
  import { useProject } from "../../../state/project.svelte";
  import { TEAM_ROBOT_BOX } from "../../auto/teamRobot";
  import Button from "../ui/Button.svelte";

  interface Props {
    /** Display preferences: the robot image. */
    settings: Settings;
  }

  let { settings = $bindable() }: Props = $props();

  const project = useProject();
  let robot = $derived(project.doc.robot);
  let isTeamBox = $derived(
    robot.rLength === TEAM_ROBOT_BOX.rLength &&
      robot.rWidth === TEAM_ROBOT_BOX.rWidth &&
      (robot.rForward ?? 0) === TEAM_ROBOT_BOX.rForward,
  );

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
</script>

<div class="flex flex-col gap-3 px-1">
  <div class="flex items-center gap-2">
    <Button
      size="sm"
      disabled={isTeamBox}
      title={`Length ${TEAM_ROBOT_BOX.rLength}, Width ${TEAM_ROBOT_BOX.rWidth}, Box ahead of centre ${TEAM_ROBOT_BOX.rForward}`}
      onclick={() => project.apply(updateRobot({ ...TEAM_ROBOT_BOX }))}
    >
      Use our robot
    </Button>
    <span class="text-xs text-body">
      {isTeamBox
        ? "This file has our robot's size."
        : "Sets this file to our robot's size."}
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

  <NumberField
    id="robot-forward"
    label="Box ahead of centre (in)"
    description="How far the box's middle sits ahead of the robot's centre, for a robot that reaches further forward than back."
    value={robot.rForward ?? 0}
    min={-12}
    max={12}
    step={0.25}
    onInput={(v) => setNumber(v, "rForward", -12, 12)}
  />

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
