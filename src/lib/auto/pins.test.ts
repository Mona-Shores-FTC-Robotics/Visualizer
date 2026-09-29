import { assert, assertEqual, test } from "../testing/harness";
import { loadSample } from "./fixtures/load";
import { adoptPins, atomicPaths, isUsed, pinState, pointUses, resolvePins, type PinResolution } from "./pins";
import { buildPathCatalog } from "./geometry";
import { validateAuto } from "./validate";
import type { Path, StartPose } from "../../types";
import type { AutoSection } from "./types";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** Applies a resolution the way App.svelte does. */
function apply(auto: AutoSection, start: StartPose, lines: Path[], result: PinResolution) {
  const segments = atomicPaths(lines);
  for (const move of result.moves) {
    const target = move.segmentId === null ? start : segments.get(move.segmentId)!.endPoint;
    target.x = move.x;
    target.y = move.y;
  }
  if (result.points) auto.points = result.points;
}

function sample() {
  const s = loadSample();
  return { auto: clone(s.auto), start: clone(s.startPoint), lines: clone(s.lines) };
}

test("pins: the sample's pins hold as saved", () => {
  const { auto, start, lines } = sample();
  const result = resolvePins(auto, start, lines, null);
  assertEqual(result.moves, []);
  assertEqual(result.points, null);
});

test("pins: editing a point moves every end on it, and the start", () => {
  const { auto, start, lines } = sample();
  const before = pinState(clone(auto));
  auto.points.ShootSpot = [40, 70];
  const result = resolvePins(auto, start, lines, before);
  apply(auto, start, lines, result);
  assertEqual(atomicPaths(lines).get("near-back")!.endPoint, { x: 40, y: 70 });
  assertEqual({ x: start.x, y: start.y }, { x: 40, y: 70 });
  assertEqual(result.points, null, "the point was the edit, so it is not changed back");
});

test("pins: dragging a pinned end moves its point (to 0.1 in) and the point's other ends", () => {
  const { auto, start, lines } = sample();
  const before = pinState(clone(auto));
  atomicPaths(lines).get("near-back")!.endPoint.x = 41.237;
  atomicPaths(lines).get("near-back")!.endPoint.y = 69.96;
  const result = resolvePins(auto, start, lines, before);
  apply(auto, start, lines, result);
  assertEqual(auto.points.ShootSpot, [41.2, 70]);
  assertEqual(atomicPaths(lines).get("near-back")!.endPoint, { x: 41.2, y: 70 }, "the dragged end snaps to the point");
  assertEqual({ x: start.x, y: start.y }, { x: 41.2, y: 70 }, "the start is on the same point, so it follows");
  const again = resolvePins(auto, start, lines, pinState(auto));
  assertEqual(again.moves, [], "one pass settles it");
  assertEqual(again.points, null);
});

test("pins: a new pin moves the end onto the point, not the point onto the end", () => {
  const { auto, start, lines } = sample();
  const before = pinState(clone(auto));
  auto.pathEnds["far-collect-b"] = "FarPickup";
  const result = resolvePins(auto, start, lines, before);
  apply(auto, start, lines, result);
  assertEqual(result.points, null);
  assertEqual(atomicPaths(lines).get("far-collect-b")!.endPoint, { x: auto.points.FarPickup[0], y: auto.points.FarPickup[1] });
});

test("pins: an unpinned end moves freely and takes no point with it", () => {
  const { auto, start, lines } = sample();
  const before = pinState(clone(auto));
  const free = [...atomicPaths(lines).keys()].find((id) => !auto.pathEnds[id])!;
  atomicPaths(lines).get(free)!.endPoint.x += 5;
  const result = resolvePins(auto, start, lines, before);
  assertEqual(result.moves, []);
  assertEqual(result.points, null);
});

test("pins: a file from before pins adopts the ends already on named points", () => {
  const { auto, start, lines } = sample();
  auto.pathEnds = {};
  delete auto.startAt;
  adoptPins(auto, start, lines);
  assertEqual(auto.pathEnds, loadSample().auto.pathEnds);
  assertEqual(auto.startAt, "ShootSpot");
});

test("pins: point uses count ends, the start and cards; unused points warn", () => {
  const { auto, start, lines } = sample();
  const uses = pointUses(auto);
  assertEqual(uses.get("ShootSpot")!.start, true);
  assertEqual(uses.get("NearPickup")!.ends, ["near-collect"]);
  assert(isUsed(uses.get("ParkFar")));
  auto.points.Nowhere = [70, 70];
  const catalog = buildPathCatalog(start, lines, loadSample().settings);
  const warnings = validateAuto(auto, catalog, start).filter((issue) => issue.message.includes("Nowhere"));
  assertEqual(warnings.map((w) => w.level), ["warning"]);
});
