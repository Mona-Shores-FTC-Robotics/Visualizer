import { assert, assertEqual, test } from "../testing/harness";
import { loadSample } from "./fixtures/load";
import { buildPathCatalog } from "./geometry";
import { enumerateRoutes, routeOutcomes, routeScenario, scenarioPicks } from "./routes";
import { simulateAuto } from "./simulate";

test("every way through the Auto is a route, ✓ before ✗ at each branching wait", () => {
  const routes = enumerateRoutes(loadSample().auto);
  assertEqual(routes.map((r) => r.marks), ["✓", "✗ → ✓", "✗ → ✗"]);
  assertEqual(routes.map((r) => r.label), ["If tipped", "If not tipped → Tipped late", "If not tipped → Out of time"]);
  // Plain waits (LauncherReady, IntakeFull) do not split the Auto.
  assert(routes.every((r) => r.choices.every((c) => c.cardId !== "wait-ready" && c.cardId !== "near-2")));
});

test("a route's scenario makes the preview take exactly that route", () => {
  const sample = loadSample();
  const catalog = buildPathCatalog(sample.startPoint, sample.lines, sample.settings);
  for (const route of enumerateRoutes(sample.auto)) {
    const scenario = routeScenario(sample.auto, route, true);
    assert(scenarioPicks(scenario, route), route.marks);
    const result = simulateAuto(sample.auto, catalog, sample.startPoint, scenario);
    for (const choice of route.choices) assertEqual(result.taken.get(choice.cardId), choice.rowIndex, route.marks);
  }
});

test("each route is timed with plain waits ✓ and ✗; ✗ is never faster", () => {
  const sample = loadSample();
  const catalog = buildPathCatalog(sample.startPoint, sample.lines, sample.settings);
  const outcomes = routeOutcomes(sample.auto, catalog, sample.startPoint);
  assertEqual(outcomes.length, 3);
  for (const o of outcomes) {
    assert(o.no.endTime >= o.yes.endTime - 1e-9, `${o.route.marks}: ${o.yes.endTime} vs ${o.no.endTime}`);
    assertEqual(o.yes.over, o.yes.endTime > 30);
  }
  // The near route waits at IntakeFull (1.8 s limit) and LauncherReady (0.8 s) when they time out.
  const near = outcomes[1];
  assert(Math.abs(near.no.endTime - near.yes.endTime - 2.6) < 1e-6, `${near.yes.endTime} → ${near.no.endTime}`);
});
