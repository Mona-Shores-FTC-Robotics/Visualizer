import { assert, assertEqual, test } from "../testing/harness";
import { loadSample } from "./fixtures/load";
import { applyRobotList, parseRobotList } from "./robotList";
import { createEmptyAuto, normalizeAuto } from "./normalize";
import { teamRegistry } from "./teamRobot";
import { commandSeconds } from "./simulate";
import type { ActionCard } from "./types";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const FILE = `{
  "commands": [
    {"name": "ShootAll", "typicalS": 3.0},
    {"name": "IntakeOn", "typicalS": 0.2}
  ],
  "triggers": [
    "HiveTipped",
    "IntakeFull"
  ]
}`;

test("robot list: the file the robot code writes is read as is", () => {
  const list = parseRobotList(FILE);
  assert(!("error" in list));
  if ("error" in list) return;
  assertEqual(list.commands, [{ name: "ShootAll", typicalS: 3 }, { name: "IntakeOn", typicalS: 0.2 }]);
  assertEqual(list.triggers, ["HiveTipped", "IntakeFull"]);
});

test("robot list: anything else says what to load instead", () => {
  assert("error" in parseRobotList("not json"));
  assert("error" in parseRobotList('{"actions": []}'));
});

test("robot list: applying it makes the registry the robot's, typical times included", () => {
  const auto = clone(loadSample().auto);
  const list = parseRobotList(FILE);
  if ("error" in list) throw new Error(list.error);
  applyRobotList(auto, list);
  assertEqual(auto.registry.actions, ["ShootAll", "IntakeOn"]);
  assertEqual(auto.registry.conditions, ["HiveTipped", "IntakeFull"]);
  assertEqual(auto.registry.typicalS, { ShootAll: 3, IntakeOn: 0.2 });
});

test("command time: the robot's typical time, capped by the step's timeout", () => {
  const auto = clone(loadSample().auto);
  const card: ActionCard = { id: "x", kind: "action", name: "ShootAll", previewMs: 2500 };
  assertEqual(commandSeconds(auto, card), 2.5, "an older file's preview time without a robot list");
  auto.registry.typicalS = { ShootAll: 3 };
  assertEqual(commandSeconds(auto, card), 3);
  assertEqual(commandSeconds(auto, { ...card, timeoutS: 2 }), 2);
  assertEqual(commandSeconds(auto, { ...card, name: "Unknown", previewMs: undefined }), 0);
});

test("robot list: an Auto that lists nothing starts with our robot's, LaunchAll and PickFlower first", () => {
  const fresh = createEmptyAuto();
  assertEqual(fresh.registry.actions.slice(0, 2), ["LaunchAll", "PickFlower"]);
  assert(fresh.registry.conditions.includes("Empty"), "Empty is a trigger");
  const loaded = normalizeAuto({ version: 1, drawnFor: "RED", registry: { actions: [], conditions: [] }, cards: [] });
  assertEqual(loaded.auto?.registry, teamRegistry());
  const own = normalizeAuto({ version: 1, drawnFor: "RED", registry: { actions: ["ShootAll"], conditions: [] }, cards: [] });
  assertEqual(own.auto?.registry.actions, ["ShootAll"]);
});
