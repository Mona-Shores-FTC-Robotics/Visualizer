import type { AutoSection } from "./types";

/**
 * The robot's list of commands and triggers: `TeamCode/auto-registry.json`, written by the robot
 * code's `AutoRegistrationTest` from what `AutoRegistration` registers.
 *
 *   { "commands": [{ "name": "LaunchAll", "typicalS": 3.0 }], "triggers": ["IntakeFull"] }
 */
export interface RobotList {
  commands: { name: string; typicalS: number }[];
  triggers: string[];
}

/** Reads the file's text; a message saying plainly what is wrong if it is not such a list. */
export function parseRobotList(text: string): RobotList | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: "That file is not JSON. Load TeamCode/auto-registry.json from the robot code." };
  }
  const raw = data as { commands?: unknown; triggers?: unknown };
  if (typeof raw !== "object" || raw === null || !Array.isArray(raw.commands) || !Array.isArray(raw.triggers)) {
    return { error: "That file has no commands and triggers. Load TeamCode/auto-registry.json from the robot code." };
  }
  const commands: RobotList["commands"] = [];
  for (const entry of raw.commands) {
    const { name, typicalS } = (entry ?? {}) as { name?: unknown; typicalS?: unknown };
    if (typeof name !== "string" || !name.trim()) continue;
    commands.push({ name: name.trim(), typicalS: typeof typicalS === "number" && typicalS >= 0 ? typicalS : 0 });
  }
  const triggers = raw.triggers.filter((name): name is string => typeof name === "string" && !!name.trim());
  return { commands, triggers: triggers.map((name) => name.trim()) };
}

/**
 * Makes the Auto's registry exactly the robot's list. A name a card uses that the robot does not
 * register then shows as unregistered, in the editor, before it ever reaches the robot.
 */
export function applyRobotList(auto: AutoSection, list: RobotList): void {
  auto.registry.actions = list.commands.map((command) => command.name);
  auto.registry.conditions = [...list.triggers];
  const typicalS = Object.fromEntries(list.commands.map((command) => [command.name, command.typicalS]));
  if (Object.keys(typicalS).length) auto.registry.typicalS = typicalS;
  else delete auto.registry.typicalS;
  const events = auto.registry.events?.filter((name) => list.triggers.includes(name)) ?? [];
  if (events.length) auto.registry.events = events;
  else delete auto.registry.events;
}
