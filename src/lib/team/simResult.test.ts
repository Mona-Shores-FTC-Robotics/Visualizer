import { assert, assertEqual, test } from "../testing/harness";
import {
  loadSimResult,
  pairMismatch,
  parseSimResult,
  pickRun,
  simLane,
  simResultUrl,
} from "./simResult";

const result = JSON.stringify({
  auto: "recycle3-right",
  design: "clump catapult",
  partnerDesign: null,
  commit: "53ee3fd",
  branch: "claude/simulator",
  finishedAt: "2026-10-03T12:55:01+00:00",
  runUrl: "https://github.com/x/y/actions/runs/1",
  typicalSeed: 8,
  bestSeed: 6,
  runs: [
    {
      seed: 6,
      points: 83,
      autoTips: 3,
      tipsAt: [2.1, 9.3],
      robotsCollidedAt: null,
      robots: [
        {
          auto: "recycle3-right",
          launched: 14,
          finishedAt: null,
          park: false,
          timeline: [" 0.00 wait Fire"],
        },
        {
          auto: "recycle3-left",
          launched: 8,
          finishedAt: 28.9,
          park: false,
          timeline: [],
        },
      ],
    },
    {
      seed: 8,
      points: 76,
      robots: [{ auto: "recycle3-right" }, { auto: "recycle3-left" }],
    },
    { nope: true },
  ],
});

test("sim result: read, matched to the pair, typical and best runs", () => {
  const parsed = parseSimResult(result);
  assertEqual(parsed.runs.length, 2);
  assertEqual(pickRun(parsed, "typical")!.seed, 8);
  assertEqual(pickRun(parsed, "best")!.points, 83);
  assertEqual(
    pairMismatch(parsed, ["recycle3-left.pp", "biobuzz-recycle3-right.pp"]),
    null,
  );
  assertEqual(
    pairMismatch(parsed, ["recycle3-right.pp", "partner-preloads-park.pp"]),
    "its latest run was recycle3-left + recycle3-right, not partner-preloads-park + recycle3-right",
  );
  assertEqual(
    simResultUrl(["biobuzz-recycle3-right.pp", "recycle3-left.pp"]),
    "https://raw.githubusercontent.com/Mona-Shores-FTC-Robotics/biobuzz/sim-results/recycle3-right/latest.json",
  );
  let threw = false;
  try {
    parseSimResult("{}");
  } catch {
    threw = true;
  }
  assert(threw, "a file without runs is refused");
});

test("sim result: a missing result says so", async () => {
  const none = await loadSimResult(["solo.pp"], async () => null);
  assertEqual(none, { missing: "solo has not been simulated yet." });
  const down = await loadSimResult(["solo.pp"], async () => {
    throw new Error("offline");
  });
  assert("missing" in down, "unreachable");
});

test("sim result: a simulated timeline becomes lane blocks", () => {
  const lane = simLane(
    [
      " 0.00 command SpinUp",
      " 0.00 wait TIP 1",
      " 2.12 TIP 1: LeftCellUp after 2.12 s",
      " 2.18 path START to FLOWER_L_TURN",
      " 3.46 path FLOWER_L_TURN to FLOWER_L",
      " 3.92 wait The far FLOWER",
      " 5.66 The far FLOWER: 2500 ms passed after 1.74 s",
      " 5.68 path FLOWER_L to HOME",
      "garbage",
    ],
    7,
  );
  assertEqual(
    lane.map((b) => [b.kind, b.t0, b.t1, b.label, b.timedOut]),
    [
      ["command", 0, 0, "SpinUp", false],
      ["wait", 0, 2.12, "TIP 1", false],
      ["drive", 2.18, 3.46, "START to FLOWER_L_TURN", false],
      ["drive", 3.46, 3.92, "FLOWER_L_TURN to FLOWER_L", false],
      ["wait", 3.92, 5.66, "The far FLOWER", true],
      ["drive", 5.68, 7, "FLOWER_L to HOME", false],
    ],
  );
});
