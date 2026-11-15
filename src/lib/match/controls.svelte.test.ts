import { assert, assertEqual, test } from "../testing/harness";
import { fallbackValues } from "../timing/model";
import {
  MATCH_PRESETS,
  MatchControls,
  clampFact,
  HIVE_FACT_LIST,
  ROBOT_FACT_LIST,
} from "./controls.svelte";

const base = fallbackValues();

test("the robot's facts and the HIVE's split every fact between them", () => {
  const ids = [...ROBOT_FACT_LIST, ...HIVE_FACT_LIST].map((f) => f.id).sort();
  assertEqual(ids, Object.keys(base).sort());
});

test("a preset changes only what it says, over the team's facts, and reset undoes it", () => {
  const controls = new MatchControls();
  const slow = MATCH_PRESETS.find((p) => p.id === "slow")!;
  controls.apply(slow, ["a.pp", "b.pp"], base);
  const mine = controls.own["a.pp"];
  assert(mine.driveSpeed! < base.driveSpeed, "drives slower");
  assert(mine.pickFlowerS! > base.pickFlowerS, "picks slower");
  assert(mine.gardenGatherS! > base.gardenGatherS, "gathers slower");
  assert(!("volleyLoad" in mine), "every volley still lands its 4");
  assertEqual(controls.own["b.pp"], controls.own["a.pp"]);
  assertEqual(controls.shared(base), base);
  assertEqual(controls.preset, "slow");
  assert(controls.changed, "a preset is a change");
  // Changing anything by hand leaves the preset.
  controls.setHive("tipSwingS", 2);
  assertEqual(controls.preset, null);
  assertEqual(controls.shared(base).tipSwingS, 2);
  controls.reset();
  assert(!controls.changed, "reset: nothing changed");
});

test("a value back at the team's, or cleared, is no change; values stay in range", () => {
  const controls = new MatchControls();
  controls.setOwn("a.pp", "driveSpeed", 0.8);
  controls.setOwn("a.pp", "driveSpeed", null);
  controls.setStill("a.pp", true);
  controls.setStill("a.pp", false);
  assert(!controls.changed, "nothing left changed");
  const speed = ROBOT_FACT_LIST.find((f) => f.id === "driveSpeed")!;
  assertEqual(clampFact(speed, 9), speed.range[1]);
  assertEqual(clampFact(speed, Number.NaN), null);
});
