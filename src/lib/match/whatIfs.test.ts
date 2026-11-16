import { assert, assertEqual, test } from "../testing/harness";
import { normalizeAuto } from "../auto/normalize";
import { MatchControls } from "./controls.svelte";
import {
  choiceLabel,
  routeChoices,
  senseTriggers,
  stops,
  triggerHint,
  triggerLabel,
} from "./whatIfs";
// biobuzz TeamCode/autos as of 15 Nov 2026: R-Clockwise has two route choices (Pickup, Priority)
// and clock checks on "Always"; L-NoCross waits on CellUp, LeftCellUp and RightCellUp.
import rClockwiseText from "./fixtures/r-clockwise.pp?raw";
import lNoCrossText from "./fixtures/l-no-cross.pp?raw";
import lClockwiseText from "./fixtures/l-clockwise.pp?raw";
import { switchKey } from "../auto/simulate";

const autoOf = (text: string) => normalizeAuto(JSON.parse(text).auto).auto!;
const stopsOf = (text: string) => stops(autoOf(text), JSON.parse(text).lines);
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

test("each stop says what it waits for, until when, and both outcomes, the planned one first", () => {
  assertEqual(
    stopsOf(rClockwiseText).map((s) => [s.name, s.asks, s.planned, s.late]),
    [
      [
        "R2: LEFT up by 15.5 s, otherwise park",
        "LEFT CELL read up · until 15.5 s",
        "shoot LEFT, if before 17.6 s",
        "park",
      ],
      [
        "R3 RIGHT up by",
        "RIGHT CELL read up · until 23.2 s (set in INIT)",
        "INIT Priority",
        "shoot LEFT, hold until 26.4 s, park",
      ],
    ],
  );
  // L1's late way crosses under the HIVE and shoots at RIGHT, from RIGHT_START.
  const [l1] = stopsOf(lClockwiseText);
  assertEqual(
    l1.late,
    "drive to RIGHT_START, shoot RIGHT, hold until 22.5 s, …",
  );
});

test("a CellUp stop names the CELL the robot faces, and a short window says within", () => {
  const [first] = stopsOf(lNoCrossText);
  assertEqual(first.asks, "LEFT CELL read up · until 9 s (set in INIT)");
  assertEqual(first.planned, "go on");
  const tipSeen = stopsOf(lNoCrossText)[1];
  assertEqual(tipSeen.asks, "LEFT CELL read up · within 0.75 s");
});

test("a stop is answered alone: Too late on R3 leaves R2 in time", () => {
  const controls = new MatchControls();
  const [r2, r3] = stopsOf(rClockwiseText);
  controls.setWait("r.pp", r3.cardId, false);
  assertEqual(controls.scenario["r.pp"], { [switchKey(r3.cardId)]: false });
  assert(
    controls.scenario["r.pp"][switchKey(r2.cardId)] === undefined,
    "R2 untouched",
  );
  controls.setWait("r.pp", r3.cardId, true);
  assert(!controls.changed, "In time again is no change");
});
