import { assert, assertEqual, test } from "../testing/harness";
import sampleText from "../../../samples/right-start-tip.pp?raw";
import { loadProject } from "./fixtures/load";
import { buildPathCatalog, chainInfo } from "./geometry";
import { relink } from "./links";
import { enumerateRoutes, routeOutcomes, routeScenario } from "./routes";
import { simulateAuto, worstCase } from "./simulate";
import { findCard } from "./tree";
import type { AutoSection, PathCard } from "./types";
import { validateAuto } from "./validate";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** The design's sample Auto, laid out the way the editor lays it out. */
function sample() {
  const project = loadProject(sampleText);
  const linked = relink(project.startPoint, project.lines, project.auto, project.settings);
  const auto: AutoSection = { ...project.auto, linkPaths: linked.linkIds };
  const catalog = buildPathCatalog(project.startPoint, linked.lines, project.settings);
  return { ...project, auto, lines: linked.lines, catalog };
}

const errorsOf = (s: ReturnType<typeof sample>, auto = s.auto) =>
  validateAuto(auto, s.catalog, s.startPoint).filter((i) => i.level === "error");

test("the RightStartTip sample loads and validates clean", () => {
  const s = sample();
  assertEqual(s.problems, []);
  assertEqual(validateAuto(s.auto, s.catalog, s.startPoint), []);
});

test("its routes are the design's five, the retry joining the main plan at LEFT_FLOWER", () => {
  const routes = enumerateRoutes(sample().auto);
  assertEqual(routes.map((r) => r.marks), ["✓ → ✓", "✓ → ✗", "✗ → ✓ → ✓", "✗ → ✓ → ✗", "✗ → ✗"]);
  assertEqual(routes[2].label, "Not tipped → Tipped on the retry → Tipped back");
});

test("a rejoined route drives its own path to the stop, then the main plan's steps after it", () => {
  const s = sample();
  const route = enumerateRoutes(s.auto)[2]; // retry rejoins, then tips back
  const result = simulateAuto(s.auto, s.catalog, s.startPoint, routeScenario(s.auto, route, true));
  for (const id of ["s-garden", "s-rshot", "rejoin-left", "full-left", "s-lshot", "s-lpark"]) {
    assert(result.ran.has(id), `${id} should run: ${[...result.ran].join(", ")}`);
  }
  assert(!result.ran.has("s-lflower"), "the main plan's own path to LEFT_FLOWER is not driven");
  // The rejoin's path starts where the robot is: RIGHT_SHOT.
  const own = s.catalog.byId.get("rshot-lflower")!;
  assertEqual({ x: own.start.x, y: own.start.y }, { x: 36, y: 30 });
});

test("a drive-through chain is one drive: faster than stopping at each spot", () => {
  const s = sample();
  const ids = ["to-rhe", "to-lhe", "to-lflower"];
  const chain = chainInfo(s.catalog, ids);
  const stopping = ids.reduce((sum, id) => sum + s.catalog.byId.get(id)!.seconds, 0);
  assert(chain.seconds < stopping - 0.5, `${chain.seconds} vs ${stopping}`);
  // The preview drives it that way: LEFT_FLOWER is reached chain.seconds after the first wait.
  const result = simulateAuto(s.auto, s.catalog, s.startPoint, {});
  const drives = result.drives.filter((d) => ids.includes(d.pathId));
  assertEqual(drives.length, 3);
  assert(Math.abs(drives[2].t1 - drives[0].t0 - chain.seconds) < 1e-6, JSON.stringify(drives));
  // The timeline has no gaps.
  let previous = 0;
  for (const event of result.timeline) {
    assert(Math.abs(event.startTime - previous) < 1e-6, `gap at ${previous} → ${event.startTime}`);
    previous = event.endTime;
  }
});

test("every route ends within 30 s, and the worst case covers every preview", () => {
  const s = sample();
  const outcomes = routeOutcomes(s.auto, s.catalog, s.startPoint);
  const worst = worstCase(s.auto, s.catalog);
  for (const o of outcomes) {
    assert(o.no.endTime <= worst.total + 1e-6, `${o.route.marks}: ${o.no.endTime} > ${worst.total}`);
  }
});

test("rejoin and drive-through mistakes are errors", () => {
  const s = sample();
  const cases: [string, (auto: AutoSection) => void, string][] = [
    ["missing target", (a) => { (findCard(a.cards, "rejoin-left") as unknown as { target: string }).target = "nope"; }, "target stop no longer exists"],
    ["a loop", (a) => { (findCard(a.cards, "rejoin-left") as unknown as { target: string }).target = "s-rshot"; }, "loop"],
    ["joins a drive-through", (a) => { (findCard(a.cards, "rejoin-left") as unknown as { target: string }).target = "s-lhe"; }, "joins a drive-through"],
    ["through with nothing after", (a) => { (findCard(a.cards, "s-lpark") as PathCard).through = true; }, "must come straight after"],
  ];
  for (const [name, mutate, expected] of cases) {
    const auto = clone(s.auto);
    mutate(auto);
    const errors = errorsOf(s, auto);
    assert(errors.some((e) => e.message.includes(expected)), `${name}: ${JSON.stringify(errors)}`);
  }
});
