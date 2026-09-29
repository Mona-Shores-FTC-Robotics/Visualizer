import { assert, assertEqual, test } from "../testing/harness";
import { loadSample } from "./fixtures/load";
import { buildPathCatalog } from "./geometry";
import { simulateAuto, motionPoseAt, questionKey, worstCase, type Scenario } from "./simulate";
import { validateAuto } from "./validate";
import { placePoint, placeRoutine } from "./motion";
import { findCard } from "./tree";
import { generateAutoJava } from "../codegen/auto/javaAuto";
import type { AutoSection, FirstOfCard, RoutineCard, TogetherCard } from "./types";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** Answers false for the given conditions when `cardId` asks them. */
function no(cardId: string, ...conditions: string[]): Scenario {
  return Object.fromEntries(conditions.map((name) => [questionKey(cardId, name), false]));
}

function setup(auto: AutoSection) {
  const sample = loadSample();
  const catalog = buildPathCatalog(sample.startPoint, sample.lines, sample.settings);
  return { sample, catalog, issues: validateAuto(auto, catalog, sample.startPoint) };
}

test("routine points are placed by facing and mirror", () => {
  const at = { x: 100, y: 50, facingDeg: 90, mirror: false };
  const forward = placePoint(10, 0, at);
  assert(Math.abs(forward.x - 100) < 1e-9 && Math.abs(forward.y - 60) < 1e-9, JSON.stringify(forward));
  const left = placePoint(0, 5, at);
  assert(Math.abs(left.x - 95) < 1e-9 && Math.abs(left.y - 50) < 1e-9, JSON.stringify(left));
  const mirrored = placePoint(0, 5, { ...at, mirror: true });
  assert(Math.abs(mirrored.x - 105) < 1e-9, JSON.stringify(mirrored));
  const segments = placeRoutine(loadSample().auto.routines.CollectFar, { x: 116, y: 120, facingDeg: 0, mirror: false });
  assertEqual(segments.map((s) => [s.end.x, s.end.y]), [[128, 120], [128, 104]]);
});

test("the routine runs its pattern, then exits to its point", () => {
  const auto = loadSample().auto;
  const { sample, catalog } = setup(auto);
  const result = simulateAuto(auto, catalog, sample.startPoint, {});
  assert(result.ran.has("tip-2"));
  const ended = result.log.find((e) => e.cardId === "tip-2" && e.text.includes("IntakeFull true"));
  assert(ended, JSON.stringify(result.log.filter((e) => e.cardId === "tip-2")));
  const motions = result.motions.filter((m) => m.cardId === "tip-2");
  assertEqual(motions.length, 2);
  // Answered true, the condition is met by the pattern's end (or the timeout, if sooner).
  const pattern = Math.min(motions[0].motion.seconds, auto.routines.CollectFar.timeoutMs / 1000);
  assert(Math.abs(motions[0].t1 - motions[0].t0 - pattern) < 1e-9, "the whole pattern runs");
  const end = motionPoseAt(result, motions[1].t1)!;
  assert(Math.hypot(end.x - 108, end.y - 84) < 1e-6, `exit reached: ${JSON.stringify(end)}`);
});

test("a routine without its condition runs the pattern to the end", () => {
  const auto = loadSample().auto;
  const { sample, catalog } = setup(auto);
  const result = simulateAuto(auto, catalog, sample.startPoint, no("tip-2", "IntakeFull"));
  assert(result.log.some((e) => e.cardId === "tip-2" && e.text.includes("not true")));
});

test("goTo drives when close enough and falls back when refused", () => {
  const auto = clone(loadSample().auto);
  const late = findCard(auto.cards, "near-5") as FirstOfCard;
  // Make the "out of time" row win at once, then check both outcomes.
  late.rows[1].cards[0] = { ...(late.rows[1].cards[0] as object), maxDistanceIn: 6 } as never;
  (late.rows[1] as { timeLeftBelowS: number }).timeLeftBelowS = 29;
  const { sample, catalog } = setup(auto);
  const answers = { ...no("did-tip", "HiveTipped", "CameraBlind"), ...no("near-5", "HiveTipped") };
  const near = simulateAuto(auto, catalog, sample.startPoint, answers);
  assert(near.log.some((e) => e.cardId === "late-hold" && e.text.startsWith("Hold at ShootSpot (")), "drives");
  assert(!near.ran.has("late-out"));
  auto.points.ShootSpot = [70, 71];
  const far = simulateAuto(auto, catalog, sample.startPoint, answers);
  assert(far.log.some((e) => e.cardId === "late-hold" && e.text.includes("refused")), "refuses");
  assert(far.ran.has("late-out"));
});

test("together waits for all, or stops at the first", () => {
  const auto = clone(loadSample().auto);
  const { sample, catalog } = setup(auto);
  const back = catalog.byId.get("near-back")!.seconds;
  const run = () => simulateAuto(auto, catalog, sample.startPoint, no("did-tip", "HiveTipped", "CameraBlind"));
  const span = (result: ReturnType<typeof run>) => {
    const start = result.log.find((e) => e.cardId === "near-3" && e.kind === "card")!.t;
    const done = result.log.find((e) => e.cardId === "near-3" && e.kind === "row")!.t;
    return done - start;
  };
  const together = findCard(auto.cards, "near-3") as TogetherCard;
  (together.cards[1] as { previewMs: number }).previewMs = (back + 1) * 1000;
  assert(Math.abs(span(run()) - (back + 1)) < 1e-6, "ALL waits for the slow action");
  together.ends = "FIRST";
  assert(Math.abs(span(run()) - back) < 1e-6, "FIRST ends with the path");
  (together.cards[1] as { previewMs: number }).previewMs = 500;
  const cut = run();
  assert(Math.abs(span(cut) - 0.5) < 1e-6, "FIRST cuts the path when the action is done first");
  let previous = 0;
  for (const event of cut.timeline) {
    assert(Math.abs(event.startTime - previous) < 1e-6, `gap at ${previous}`);
    previous = event.endTime;
  }
  assert(worstCase(auto, catalog).total >= cut.endTime - 1e-9);
});

test("routine problems are reported", () => {
  const auto = clone(loadSample().auto);
  auto.routines.CollectFar.endsWhen = "";
  (findCard(auto.cards, "tip-2") as RoutineCard).exit = "Nowhere";
  const { issues } = setup(auto);
  const messages = issues.filter((i) => i.cardId === "tip-2").map((i) => i.message).join("\n");
  assert(messages.includes("needs a condition"), messages);
  assert(messages.includes('"Nowhere"'), messages);
});

test("a turned, mirrored routine exports a start pose with its facing", () => {
  const sample = loadSample();
  const auto = clone(sample.auto);
  const card = findCard(auto.cards, "tip-2") as RoutineCard;
  card.facingDeg = 90;
  card.mirror = true;
  const result = generateAutoJava({ ...sample, auto, sourceFileName: "hive-rush.pp" });
  assert(result.ok, JSON.stringify(result));
  assert(result.source.includes("Pose collectFarPatternStart = p.of(116, 120, 90);"), result.source);
  // Facing 90° (up the field), forward 12 is +12 in y; left −16 mirrored is
  // 16 to the robot's left, which is −x when facing up.
  assert(result.source.includes("Pose collectFarPatternP2 = p.of(100, 132, 90);"), result.source);
  assert(result.source.includes(".constant(collectFarPatternStart)"), result.source);
});
