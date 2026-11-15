import { assert, assertEqual, test } from "../testing/harness";
import { normalizeAuto } from "../auto/normalize";
import { MatchControls } from "./controls.svelte";
import {
  choiceLabel,
  routeChoices,
  senseTriggers,
  triggerHint,
  triggerLabel,
} from "./whatIfs";
// biobuzz TeamCode/autos as of 15 Nov 2026: R-Clockwise has two route choices (Pickup, Priority)
// and clock checks on "Always"; L-NoCross waits on CellUp, LeftCellUp and RightCellUp.
import rClockwiseText from "./fixtures/r-clockwise.pp?raw";
import lNoCrossText from "./fixtures/l-no-cross.pp?raw";

const autoOf = (text: string) => normalizeAuto(JSON.parse(text).auto).auto!;
const rClockwise = autoOf(rClockwiseText);
const lNoCross = autoOf(lNoCrossText);

test("a route choice is a dropdown worded as the Driver Station's INIT row, not a trigger", () => {
  const choices = routeChoices(rClockwise);
  assertEqual(
    choices.map((c) => [choiceLabel(c, 0), choiceLabel(c, 1)]),
    [
      ["Pickup: WALL_FLOWER", "Pickup: GARDEN"],
      ["Priority: THREE_TIP", "Priority: PARK"],
    ],
  );
  const triggers = senseTriggers(rClockwise);
  assert(!triggers.includes("Pickup"), "Pickup is not a checkbox");
  assert(!triggers.includes("Priority"), "Priority is not a checkbox");
});

test("the clock check's always-true trigger is no what-if", () => {
  assert(!senseTriggers(rClockwise).includes("Always"), "no Always checkbox");
  assertEqual(senseTriggers(rClockwise), ["LeftCellUp", "RightCellUp"]);
});

test("a CELL trigger says the camera read it up (timing-terms.md, moment 8)", () => {
  assertEqual(senseTriggers(rClockwise).map(triggerLabel), [
    "LEFT CELL read up",
    "RIGHT CELL read up",
  ]);
  assertEqual(senseTriggers(lNoCross).map(triggerLabel), [
    "Aimed CELL read up",
    "LEFT CELL read up",
    "RIGHT CELL read up",
  ]);
  assertEqual(triggerLabel("Tip"), "TIP read");
  for (const condition of [
    "CellUp",
    "Tip",
    "LeftCellUp",
    "RightCellUp",
    "IntakeFull",
  ]) {
    assert(
      !triggerLabel(condition).endsWith(" comes"),
      `${condition}: no "comes"`,
    );
  }
  assert(
    triggerHint("RightCellUp", false).includes("takes its Otherwise"),
    "unticked: the hint says what happens",
  );
});

test("picking a route choice's second leg answers its trigger no, and back again clears it", () => {
  const controls = new MatchControls();
  const [pickup] = routeChoices(rClockwise);
  controls.setTrigger("r.pp", rClockwise, pickup.condition, false);
  assertEqual(controls.scenario["r.pp"]?.[pickup.condition], false);
  controls.setTrigger("r.pp", rClockwise, pickup.condition, true);
  assert(!controls.changed, "the drawn leg is no change");
});
