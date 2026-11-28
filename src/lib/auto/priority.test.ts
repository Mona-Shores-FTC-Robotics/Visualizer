import { assert, assertEqual, test } from "../testing/harness";
import { normalizeAuto } from "./normalize";
import { normalizePaths, normalizeStartPose } from "../../utils/normalize";
import { DEFAULT_SETTINGS } from "../../config";
import { fallbackValues, type TimingValues } from "../timing/model";
import { previewTogether, type FieldEntry } from "../timing/together";
import { tipBeforePark, type Scenario } from "./simulate";
// biobuzz TeamCode/autos as of 20 Nov 2026 (#673, both loaded lanes backward): R-Clockwise has the
// INIT row Priority (THREE_TIP drawn, or PARK), L-Clockwise is its partner. (The 15 Nov copies, timed
// with the simulator's turning, have the guard park before the third volley: the drawing has moved on.)
import rText from "../match/fixtures/r-clockwise-673.pp?raw";
import lText from "../match/fixtures/l-clockwise-673.pp?raw";

function entry(text: string, scenario: Scenario = {}): FieldEntry {
  const d = JSON.parse(text);
  return {
    auto: normalizeAuto(d.auto).auto!,
    startPoint: normalizeStartPose(d.startPoint),
    lines: normalizePaths(d.lines),
    settings: { ...DEFAULT_SETTINGS, ...(d.robot ?? {}) },
    scenario,
  };
}

// The team's timing.json as of 20 Nov 2026.
const values: TimingValues = {
  ...fallbackValues(),
  volleyS: 2.5,
  spinUpS: 1.1,
  tipStartS: 2.6,
  tipSwingS: 1.6,
  intakeFullS: 1.9,
  pickFlowerS: 3.6,
  gardenGatherS: 2.5,
};
const rPreview = (scenario: Scenario) =>
  previewTogether([entry(rText, scenario), entry(lText)], values).previews[0];
const volleys = (scenario: Scenario) =>
  rPreview(scenario).actions.filter((a) => a.command === "LaunchAll");

test("Priority is read as the robot reads it: the drawn leg is the TIP", () => {
  const auto = entry(rText).auto;
  assert(tipBeforePark(auto, {}), "THREE_TIP is drawn");
  assert(!tipBeforePark(auto, { Priority: false }), "PARK");
  assert(
    tipBeforePark(entry(lText).auto, {}),
    "an Auto with no Priority row: TIPS FIRST, the Endgame default",
  );
  assert(
    !tipBeforePark(entry(lText).auto, { Endgame: false }),
    "Endgame PARK FIRST",
  );
  assert(!tipBeforePark(auto, { Endgame: false }), "PARK FIRST overrides Priority");
});

test("THREE_TIP: the guard goes for the third volley, and AUTO ends on the way to the park", () => {
  const preview = rPreview({});
  const third = volleys({})[2];
  assert(third, "a third LaunchAll ran");
  assert(third.t1 <= 30 + 1e-9, `its last piece is out by 30 s (${third.t1})`);
  assertEqual(preview.guard, null, "the guard parked nothing");
  assert(preview.unparked === true, "not parked");
  assert(preview.endTime <= 30 + 1e-9, "the preview stops at 30 s");
});

test("PARK: R keeps its load and parks, as before", () => {
  const preview = rPreview({ Priority: false });
  assertEqual(volleys({ Priority: false }).length, 2);
  assert(!preview.unparked, "parked");
  assert(preview.endTime < 30, "parked inside AUTO");
});

test("a GARDEN gather takes gardenGatherS, never past its step's limit", () => {
  const garden = { Pickup: false };
  const gather = (v: TimingValues) =>
    previewTogether(
      [entry(rText, garden), entry(lText)],
      v,
    ).previews[0].actions.find((a) => a.command === "GardenGather")!;
  const g = gather({ ...values, gardenGatherS: 4.4 });
  assert(Math.abs(g.t1 - g.t0 - 4.4) < 1e-9, `4.4 s (${g.t1 - g.t0})`);
  // R-Clockwise's gather has a 5.5 s limit.
  const capped = gather({ ...values, gardenGatherS: 8 });
  assert(
    Math.abs(capped.t1 - capped.t0 - 5.5) < 1e-9,
    `5.5 s (${capped.t1 - capped.t0})`,
  );
});

test("a FLOWER pick takes pickFlowerS, never past its step's limit", () => {
  const pick = (v: TimingValues) =>
    previewTogether([entry(rText), entry(lText)], v).previews[0].actions.find(
      (a) => a.command === "PickFlower",
    )!;
  const p = pick({ ...values, pickFlowerS: 3.6 });
  assert(Math.abs(p.t1 - p.t0 - 3.6) < 1e-9, `3.6 s (${p.t1 - p.t0})`);
  // R-Clockwise's picks have a 4.5 s limit.
  const capped = pick({ ...values, pickFlowerS: 6 });
  assert(
    Math.abs(capped.t1 - capped.t0 - 4.5) < 1e-9,
    `4.5 s (${capped.t1 - capped.t0})`,
  );
});
