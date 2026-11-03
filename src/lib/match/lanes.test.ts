import { assert, assertEqual, test } from "../testing/harness";
import { normalizeAuto } from "../auto/normalize";
import { normalizePaths, normalizeStartPose } from "../../utils/normalize";
import { DEFAULT_SETTINGS } from "../../config";
import { fallbackValues, hiveHistory, tipsFrom } from "../timing/model";
import { previewTogether, type FieldEntry } from "../timing/together";
import { matchLanes } from "./lanes";
// The team's pair as of 3 Nov 2026 (biobuzz TeamCode/autos): simple-builder Autos, whose volleys
// are Launch all steps and whose one wait is CellUp.
import leftText from "./fixtures/l-partner.pp?raw";
import rightText from "./fixtures/r-partner-tip.pp?raw";

const values = fallbackValues();

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

function lanesOf(pair: FieldEntry[], v = values) {
  const { previews } = previewTogether(pair, v);
  return matchLanes(pair, previews, v, ["LEFT", "RIGHT"], ["#f00", "#0f0"]);
}

test("hiveHistory gives tipsFrom's TIPs, and says which volley started each", () => {
  const v = {
    ...values,
    tipStartS: 0.5,
    tipSwingS: 1,
    startLoad: 5,
    volleyLoad: 4,
    tipLoad: 8,
  };
  const volleys = [
    { t: 0.8, robot: 1 },
    { t: 3.0, robot: 0 },
    { t: 6.0, robot: 1 },
    { t: 6.5, robot: 0 },
  ];
  const history = hiveHistory(volleys, v);
  assertEqual(
    history.tips.map(({ start, settled }) => ({ start, settled })),
    tipsFrom(
      volleys.map((x) => x.t),
      v,
    ),
  );
  assertEqual(
    history.tips.map((tip) => tip.cause),
    [0, 2],
  );
  assertEqual(
    history.volleys.map((x) => [x.robot, x.counted, x.load, x.tip]),
    [
      [1, true, 9, 0],
      [0, true, 4, null],
      [1, true, 8, 1],
      [0, false, 0, null], // mid-swing
    ],
  );
});

test("Launch all steps are volleys and CellUp waits on the TIP: the team's pair is coupled", () => {
  const lanes = lanesOf([entry(leftText), entry(rightText)]);
  const [left, right] = lanes.robots;
  // RIGHT fires its preloads at PLAY; that volley TIPs the HIVE (3 NECTAR already in the CELL).
  assert(right.volleys[0].tip === 0, "RIGHT's preload volley starts TIP 1");
  // LEFT waits at its launch spot for its CELL (the LEFT one, at its end) and TIP 1 ends the wait.
  const leftWait = left.waits[0];
  assertEqual(leftWait.ended, "trigger");
  assertEqual(leftWait.tip, 0);
  assert(
    Math.abs(leftWait.t1 - lanes.hive.tips[0].settled) < 1e-6,
    "LEFT's wait ends when TIP 1 settles",
  );
  // RIGHT's later wait is for the RIGHT CELL, which only TIP 2 (from LEFT's volleys) brings up.
  const rightWait = right.waits[0];
  assertEqual(rightWait.tip, 1);
  assertEqual(lanes.hive.volleys[lanes.hive.tips[1].cause].robot, 0);
  // Every TIP has a volley → TIP link, every TIP-ended wait a TIP → wait link.
  assertEqual(
    lanes.links.filter((l) => l.kind === "volley-tip").length,
    lanes.hive.tips.length,
  );
  assertEqual(lanes.links.filter((l) => l.kind === "tip-wait").length, 2);
  // The HIVE starts RIGHT up, swings, and is LEFT up after TIP 1.
  assertEqual(
    lanes.hive.cells.slice(0, 3).map((c) => c.state),
    ["right", "swing", "left"],
  );
});

test("when the partner's volleys miss, the wait runs out instead", () => {
  // One volley never fills the raised CELL: no TIP comes, and LEFT's wait times out into its
  // Otherwise list.
  const lanes = lanesOf([entry(leftText), entry(rightText)], {
    ...values,
    startLoad: 0,
    volleyLoad: 1,
  });
  const wait = lanes.robots[0].waits[0];
  assertEqual(wait.ended, "time");
  assertEqual(wait.branched, true);
  assertEqual(wait.tip, null);
  assert(
    wait.limitAt !== null && Math.abs(wait.t1 - wait.limitAt) < 1e-6,
    "it waits out its limit",
  );
});

test("each robot's row holds its drives and steps in order", () => {
  const lanes = lanesOf([entry(leftText), entry(rightText)]);
  for (const robot of lanes.robots) {
    for (let i = 1; i < robot.segments.length; i++) {
      assert(
        robot.segments[i].t0 >= robot.segments[i - 1].t0 - 1e-9,
        `${robot.name}'s segments are in order`,
      );
    }
    assert(
      robot.segments.some((s) => s.kind === "drive"),
      "drives",
    );
    assert(
      robot.segments.some((s) => s.kind === "volley"),
      "volleys",
    );
    assert(
      robot.segments.some((s) => s.kind === "pick"),
      "picks",
    );
  }
  assertEqual(lanes.span, 30);
});

test("a robot's own facts change only that robot", () => {
  const pair = [entry(leftText), entry(rightText)];
  const base = lanesOf(pair);
  const slowRight = lanesOf([
    pair[0],
    { ...pair[1], own: { driveSpeed: 0.6 } },
  ]);
  // RIGHT drives slower: it finishes later. LEFT's own drives are the same length.
  assert(
    slowRight.robots[1].endTime > base.robots[1].endTime,
    "the slow robot finishes later",
  );
  const driveTime = (lanes: typeof base) =>
    lanes.robots[0].segments
      .filter((s) => s.kind === "drive")
      .reduce((sum, s) => sum + s.t1 - s.t0, 0);
  assert(
    Math.abs(driveTime(slowRight) - driveTime(base)) < 1e-6,
    "the other robot drives as before",
  );
});

test("a robot's hits per volley are its own: a robot that misses TIPs the HIVE later", () => {
  const pair = [entry(leftText), entry(rightText)];
  const base = lanesOf(pair);
  // RIGHT lands only 1 POLLEN per volley: its preload volley (5 + 1) no longer TIPs the HIVE.
  const misses = lanesOf([pair[0], { ...pair[1], own: { volleyLoad: 1 } }]);
  assertEqual(base.robots[1].volleys[0].tip, 0);
  assertEqual(misses.robots[1].volleys[0].tip, null);
  assertEqual(misses.robots[1].volleys[0].load, values.startLoad + 1);
});

test("a no-show partner never volleys, so the wait for its TIP runs out", () => {
  const pair = [entry(leftText), entry(rightText)];
  const lanes = lanesOf([pair[0], { ...pair[1], still: true }]);
  const right = lanes.robots[1];
  assertEqual(right.still, true);
  assertEqual(right.segments.length, 0);
  assertEqual(right.volleys.length, 0);
  const wait = lanes.robots[0].waits[0];
  assertEqual(wait.ended, "time");
});

test("a trigger answered no: the wait runs to its limit", () => {
  const pair = [entry(leftText), entry(rightText)];
  const lanes = lanesOf([{ ...pair[0], scenario: { CellUp: false } }, pair[1]]);
  const wait = lanes.robots[0].waits[0];
  assertEqual(wait.ended, "time");
  assertEqual(wait.branched, true);
});

test("a wait until a match-clock time is outlined to that time, not from when it began", () => {
  const left = entry(leftText);
  const wait = left.auto.cards.find((c) => c.kind === "firstOf")!;
  assert(wait.kind === "firstOf", "l-partner has a wait");
  const timed = {
    ...wait,
    rows: wait.rows.map((row) =>
      "afterMs" in row ? { ...row, afterMs: 9000, matchClock: true } : row,
    ),
  };
  const auto = {
    ...left.auto,
    cards: left.auto.cards.map((c) => (c.id === wait.id ? timed : c)),
  };
  // No TIP comes (one volley never fills the CELL): the wait gives up at 9 s on the match clock.
  const lanes = lanesOf([{ ...left, auto }, entry(rightText)], {
    ...values,
    startLoad: 0,
    volleyLoad: 1,
  });
  const bar = lanes.robots[0].waits[0];
  assertEqual(bar.ended, "time");
  assert(
    bar.limitAt !== null && Math.abs(bar.limitAt - 9) < 1e-6,
    `limit at 9 s, not ${bar.limitAt}`,
  );
  assert(Math.abs(bar.t1 - 9) < 1e-6, "it ends at 9 s");
});
