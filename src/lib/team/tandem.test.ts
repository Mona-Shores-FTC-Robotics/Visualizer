import { assert, assertEqual, test } from "../testing/harness";
import { loadSample } from "../auto/fixtures/load";
import { buildPathCatalog } from "../auto/geometry";
import { normalizeAuto } from "../auto/normalize";
import { simulateAuto } from "../auto/simulate";
import type { AutoSection } from "../auto/types";
import { calculateVisualizationPathTime } from "../../utils/timeCalculator";
import {
  happensAt,
  laneOf,
  laneOfPaths,
  matchCards,
  nearMisses,
  parseLinks,
  poseAt,
  robotName,
  simulatePair,
  type Pose,
  type TandemRobot,
} from "./tandem";
import { parsePairs } from "./teamAutos";

const sample = loadSample();
const catalog = buildPathCatalog(
  sample.startPoint,
  sample.lines,
  sample.settings,
);

function auto(
  cards: unknown[],
  typicalS: Record<string, number> = {},
): AutoSection {
  const { auto } = normalizeAuto({
    version: 1,
    registry: {
      actions: ["LaunchAll", "Collect"],
      conditions: ["Tip", "CellUp", "Done"],
      typicalS,
    },
    points: {},
    pathEnds: {},
    cards,
  });
  return auto!;
}

const wait = (
  id: string,
  label: string,
  condition: string,
  ms: number,
  alongside?: string,
) => ({
  id,
  kind: "firstOf",
  label,
  ...(alongside ? { alongside } : {}),
  rows: [
    { when: [condition], cards: [] },
    { afterMs: ms, cards: [] },
  ],
});

const robot = (file: string, a: AutoSection): TandemRobot => ({
  file,
  auto: a,
  catalog,
  start: sample.startPoint,
  scenario: {},
});

// right: fires its preloads (2 s), then waits for the tip. left: waits for right's tip.
const right = auto(
  [
    wait("r-fire", "Fire the preloads", "Done", 4000, "LaunchAll"),
    wait("r-tip", "TIP 1?", "Tip", 2500),
  ],
  {
    LaunchAll: 2,
  },
);
const left = auto(
  [
    wait("l-tip", "TIP 1", "CellUp", 10000),
    { id: "l-go", kind: "action", name: "Collect" },
  ],
  {
    Collect: 1,
  },
);
const link = {
  file: "recycle3-left.pp",
  wait: "TIP 1",
  partner: "recycle3-right.pp",
  card: "TIP 1?",
};

test("tandem: a linked wait fires when the partner's card does", () => {
  const pair = simulatePair(
    [
      robot("biobuzz-recycle3-right.pp", right),
      robot("biobuzz-recycle3-left.pp", left),
    ],
    [link],
  );
  assert(pair.settled, "settles");
  assertEqual(pair.problems, []);
  const leftPreview = pair.previews[1]!;
  const tip = leftPreview.spans.find((s) => s.cardId === "l-tip")!;
  // right: preloads fire when LaunchAll finishes (2 s), TIP 1? fires at once: 2 s.
  assertEqual(tip.t1, 2);
  assert(tip.fired, "fired, not timed out");
  assertEqual(leftPreview.endTime, 3);
  assert(
    leftPreview.log.some((e) =>
      e.text.includes("recycle3-right: TIP 1? at 2.0 s"),
    ),
    "the log names the partner",
  );
  // Unlinked, the same wait answers its switch: at once.
  const alone = simulateAuto(left, catalog, sample.startPoint, {});
  assertEqual(alone.spans.find((s) => s.cardId === "l-tip")!.t1, 0);
});

test("tandem: a partner that never gets there leaves the wait to its time limit", () => {
  const pair = simulatePair(
    [
      { ...robot("recycle3-right.pp", right), scenario: { Tip: false } },
      robot("recycle3-left.pp", left),
    ],
    [link],
  );
  const tip = pair.previews[1]!.spans.find((s) => s.cardId === "l-tip")!;
  assertEqual(tip.t1, 10);
  assert(!tip.fired, "timed out");
  assertEqual(pair.partnerTimes[1].get("l-tip")!.at, Infinity);
});

test("tandem: robots that wait on each other settle", () => {
  // a fires X at 1 s; b waits for X, then fires Y 1 s later; a waits for Y.
  const a = auto(
    [
      { id: "a-x", kind: "action", name: "LaunchAll" },
      wait("a-wait", "Wait for b", "Tip", 9000),
    ],
    { LaunchAll: 1 },
  );
  const b = auto(
    [
      wait("b-wait", "Wait for a", "Tip", 9000),
      { id: "b-y", kind: "action", name: "Collect" },
    ],
    { Collect: 1 },
  );
  const pair = simulatePair(
    [robot("a.pp", a), robot("b.pp", b)],
    [
      { file: "b.pp", wait: "Wait for a", partner: "a.pp", card: "LaunchAll" },
      { file: "a.pp", wait: "Wait for b", partner: "b.pp", card: "b-y" },
    ],
  );
  assert(pair.settled, "settles");
  assertEqual(
    pair.previews[1]!.spans.find((s) => s.cardId === "b-wait")!.t1,
    1,
  );
  assertEqual(
    pair.previews[0]!.spans.find((s) => s.cardId === "a-wait")!.t1,
    2,
  );
});

test("tandem: links that name nothing are reported, links to robots not shown are ignored", () => {
  const pair = simulatePair(
    [robot("recycle3-right.pp", right), robot("recycle3-left.pp", left)],
    [
      { ...link, wait: "No such wait" },
      { ...link, card: "No such card" },
      { ...link, partner: "someone-else.pp" },
    ],
  );
  assertEqual(
    pair.problems.map((p) => p.problem),
    [
      'recycle3-left has no wait called "No such wait"',
      'recycle3-right has no card called "No such card"',
    ],
  );
  assertEqual(pair.previews[1]!.spans.find((s) => s.cardId === "l-tip")!.t1, 0);
});

test("tandem: cards are found by id or by name; happensAt ignores waits that time out", () => {
  assertEqual(matchCards(right, catalog, "r-tip"), ["r-tip"]);
  assertEqual(matchCards(right, catalog, "TIP 1?"), ["r-tip"]);
  assertEqual(matchCards(right, catalog, "LaunchAll"), []);
  const timedOut = simulateAuto(right, catalog, sample.startPoint, {
    Tip: false,
  });
  assertEqual(happensAt(timedOut, ["r-tip"]), Infinity);
  assertEqual(happensAt(timedOut, ["r-fire"]), 2);
});

test("tandem: pairs.json links are read; bad ones dropped", () => {
  const [pair] = parsePairs(
    JSON.stringify({
      pairs: [
        {
          name: "recycle3",
          files: ["recycle3-right.pp", "recycle3-left.pp"],
          links: [link, { file: "x.pp" }, "nope"],
        },
      ],
    }),
  );
  assertEqual(pair.links, [link]);
  assertEqual(parseLinks(null), []);
  assertEqual(robotName("biobuzz-recycle3-left.pp"), "recycle3-left");
  assertEqual(robotName("partner-preloads-park.pp"), "partner-preloads-park");
});

test("tandem: lanes show drives, waits and commands in order", () => {
  const preview = simulateAuto(sample.auto, catalog, sample.startPoint, {});
  const lane = laneOf(preview, catalog);
  assert(lane.length > 0, "has blocks");
  for (let i = 1; i < lane.length; i++)
    assert(lane[i - 1].t0 <= lane[i].t0, "sorted");
  assert(
    lane.some((b) => b.kind === "drive") && lane.some((b) => b.kind === "wait"),
    "drives and waits",
  );
  for (const b of lane) assert(b.t1 >= b.t0, "ends after it starts");
  // A plain file: its paths back to back.
  const plain = calculateVisualizationPathTime(
    sample.startPoint,
    sample.lines,
    sample.settings,
    [],
  );
  const paths = laneOfPaths(plain.timeline, sample.lines);
  assert(
    paths.length > 0 && paths.every((b) => b.kind !== "command"),
    "paths only",
  );
});

test("tandem: near-collisions from footprints, with contact when they touch", () => {
  const size = { length: 18, width: 18 };
  // a sits at (40, 72); b drives along y = 72 from x = 100 to x = 40 over 6 s.
  const a = (): Pose => ({ x: 40, y: 72, headingDeg: 0 });
  const b = (t: number): Pose => ({
    x: 100 - 10 * Math.min(t, 6),
    y: 72,
    headingDeg: 0,
  });
  const misses = nearMisses([a, b], [size, size], 6, 3, 0.1);
  assertEqual(misses.length, 1);
  const [m] = misses;
  // Within 3 in once the centres are 21 in apart: x = 61, t = 3.9 s; touching at 18 in.
  assert(Math.abs(m.t0 - 3.9) < 0.11, `starts near 3.9 s, got ${m.t0}`);
  assert(m.contact, "they touch");
  // 24 in away across the field's y, lying along x, 4 in wide: 13 in apart, never close.
  const c = (): Pose => ({ x: 40, y: 96, headingDeg: 0 });
  assertEqual(
    nearMisses([a, c], [size, { length: 30, width: 4 }], 6, 3, 0.5).length,
    0,
  );
  // The same robot turned to point at it reaches it (heading 90°: its length lies along y).
  const d = (): Pose => ({ x: 40, y: 96, headingDeg: 90 });
  assert(
    nearMisses([a, d], [size, { length: 30, width: 4 }], 1, 3, 0.5).length ===
      1,
    "long robot reaches",
  );
});

test("tandem: poseAt follows the app's playback and holds at the end", () => {
  const preview = simulateAuto(sample.auto, catalog, sample.startPoint, {});
  const track = {
    timeline: preview.timeline,
    lines: sample.lines,
    start: sample.startPoint,
    settings: sample.settings,
    preview,
    total: preview.endTime,
  };
  const start = poseAt(track, 0);
  assert(
    Math.abs(start.x - sample.startPoint.x) < 0.5 &&
      Math.abs(start.y - sample.startPoint.y) < 0.5,
    "starts at the start",
  );
  const end = poseAt(track, preview.endTime);
  assertEqual(poseAt(track, preview.endTime + 5), end);
});
