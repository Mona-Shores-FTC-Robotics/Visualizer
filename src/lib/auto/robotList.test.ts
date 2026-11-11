import { assert, assertEqual, test } from "../testing/harness";
import { loadSample } from "./fixtures/load";
import { applyRobotList, parseRobotList } from "./robotList";
import { createEmptyAuto, normalizeAuto } from "./normalize";
import { teamRegistry } from "./teamRobot";
import { commandSeconds, launchFeeds } from "./simulate";
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

test("command time: a feeding launch runs its whole feed, whatever its time limit", () => {
  const auto = clone(loadSample().auto);
  auto.registry.typicalS = { LaunchAll: 4, LaunchOne: 0.5, PickFlower: 4.4 };
  const launch: ActionCard = { id: "x", kind: "action", name: "LaunchAll", timeoutS: 1 };
  assertEqual(commandSeconds(auto, launch), 4, "the limit guards the spin-up wait, not the feed");
  assertEqual(commandSeconds(auto, { ...launch, timeoutS: 0.5 }), 4);
  assertEqual(commandSeconds(auto, { ...launch, name: "LaunchOne", timeoutS: 0.2 }), 0.5);
  // The what-if volley time reaches a time-limited launch, past the default timeout too.
  const timing = { actionSeconds: (name: string) => (name === "LaunchAll" ? 6 : undefined), trueAt: () => undefined };
  assertEqual(commandSeconds(auto, launch, timing, 0), 6);
  assertEqual(commandSeconds(auto, { ...launch, timeoutS: undefined }, timing, 0), 6);
  // A limit that passes before the launcher is at speed ends the step, nothing launched.
  const spinning = { ...timing, feedStartsAt: (_name: string, t0: number) => t0 + 2 };
  assertEqual(commandSeconds(auto, launch, spinning, 3), 1, "1 s limit, 2 s to speed");
  assertEqual(launchFeeds(launch, spinning, 3), false);
  assertEqual(commandSeconds(auto, { ...launch, timeoutS: 2 }, spinning, 3), 6, "at speed just in time");
  assertEqual(commandSeconds(auto, { ...launch, timeoutS: undefined }, spinning, 3), 6);
  // A FLOWER pick's limit still ends it.
  assertEqual(commandSeconds(auto, { ...launch, name: "PickFlower", timeoutS: 2 }), 2);
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
