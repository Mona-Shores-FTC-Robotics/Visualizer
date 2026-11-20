import { assert, assertEqual, test } from "../testing/harness";
import { normalizeAuto } from "./normalize";
import { normalizePaths, normalizeStartPose } from "../../utils/normalize";
import { DEFAULT_SETTINGS } from "../../config";
import { fallbackValues, tipMissesKey } from "../timing/model";
import { previewTogether, type FieldEntry } from "../timing/together";
// biobuzz master's lane pair, 19 Nov 2026: L-UnderHive's "RIGHT up before 22 s, otherwise park,
// then fire at LEFT from the park if it is up" drives its park, then fires LaunchAllAimed from it.
import rightText from "../match/fixtures/r-outside-lane.pp?raw";
import leftText from "../match/fixtures/l-under-hive.pp?raw";

function entry(text: string): FieldEntry {
  const d = JSON.parse(text);
  return {
    auto: normalizeAuto(d.auto).auto!,
    startPoint: normalizeStartPose(d.startPoint),
    lines: normalizePaths(d.lines),
    settings: { ...DEFAULT_SETTINGS, ...(d.robot ?? {}) },
    scenario: {},
  };
}

// The team's timing.json as of 19 Nov 2026, and TIP 2's first try (R's 2nd volley) missing.
const values = {
  ...fallbackValues(),
  spinUpS: 1.1,
  volleyS: 2.5,
  tipStartS: 2.6,
  tipSwingS: 1.6,
  intakeFullS: 1.9,
  pickFlowerS: 3.6,
  gardenGatherS: 2.5,
  [tipMissesKey(2)]: 1,
};

test("a guard whose park is the path the robot just drove counts as parked: it does not drive it again", () => {
  const { previews } = previewTogether(
    [entry(rightText), entry(leftText)],
    values,
  );
  const left = previews[1];
  const parks = left.drives.filter((d) =>
    left.log.some((e) => e.cardId === d.cardId && e.text.endsWith("· park")),
  );
  assertEqual(parks.length, 1, "L drives its park once");
  assert(
    !left.log.some((e) => e.kind === "guard" && e.t >= parks[0].t1 - 1e-6),
    "no guard parks L again on the park it stands on",
  );
  const shot = left.actions.find((a) => a.command === "LaunchAllAimed");
  assert(shot, "L fires from the park");
  assert(shot.t0 >= parks[0].t1 - 1e-6, `fires once parked (${shot.t0})`);
});

test("LaunchAllAimed is a volley: L's shot from the park completes TIP 2 after R's try misses", () => {
  const { previews, tips } = previewTogether(
    [entry(rightText), entry(leftText)],
    values,
  );
  const shot = previews[1].actions.find((a) => a.command === "LaunchAllAimed")!;
  assertEqual(tips.length, 2, "TIP 1, then TIP 2 from the park shot");
  assert(
    Math.abs((tips[1].lastBall ?? -1) - shot.t1) < 1e-6,
    `TIP 2 from the shot that ends at ${shot.t1}`,
  );
  assert(shot.t1 <= 30, "its last ball is out by 30 s");
});

// biobuzz master's Clockwise pair, 20 Nov 2026 (c9d1455): L-Clockwise's "RIGHT up by 22 s, otherwise
// park, then fire at LEFT from the park if it is up" parks on LEFT_AIMED_PARK along its outside lane,
// while the Auto-wide guard's own park is the catch park from LEFT_AUTO_HIVE. That outer guard used to
// drive its catch park after L had parked: L jumped back to LEFT_AUTO_HIVE at 27.3 s and its park shot
// was cut, so TIP 2 never came on THREE_TIP.
import rClockwise from "../match/fixtures/r-clockwise-park-shot.pp?raw";
import lClockwise from "../match/fixtures/l-clockwise-park-shot.pp?raw";

for (const priority of ["THREE_TIP", "PARK"] as const)
  test(`Clockwise, TIP 2 missing, Priority ${priority}: no guard parks L again once it stands on a park`, () => {
    const r = entry(rClockwise);
    if (priority === "PARK") r.scenario = { Priority: false };
    const { previews, tips } = previewTogether([r, entry(lClockwise)], values);
    const left = previews[1];
    assert(
      !left.log.some((e) => e.kind === "guard"),
      `no guard parks L: ${left.log
        .filter((e) => e.kind === "guard")
        .map((e) => e.text)
        .join("; ")}`,
    );
    assertEqual(
      left.drives.filter((d) => d.pathId.includes("park")).map((d) => d.pathId),
      ["l-park"],
      "L drives one park, the outside lane",
    );
    const shot = left.actions.find((a) => a.command === "LaunchAllAimed");
    assert(shot, "L fires from the park");
    assert(shot.t1 <= 30, `its last ball is out by 30 s (${shot.t1})`);
    assertEqual(tips.length, 2, "TIP 1, then TIP 2");
  });
