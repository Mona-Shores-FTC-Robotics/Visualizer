import { assert, assertEqual, test } from "../testing/harness";
import { generateAutoJava } from "../codegen/auto/javaAuto";
import { loadSample } from "./fixtures/load";
import { buildPathCatalog } from "./geometry";
import { normalizeAuto, serializeAuto } from "./normalize";
import { simulateAuto, switchKey, type Scenario } from "./simulate";
import { findCard } from "./tree";
import type { AutoSection, FirstOfCard } from "./types";

// "Did the HIVE tip?" in the sample: rows [when HiveTipped, afterMs 1500].
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function sampleWith(mutate: (card: FirstOfCard, auto: AutoSection) => void): AutoSection {
  const auto = clone(loadSample().auto);
  auto.registry.typicalS = { ...(auto.registry.typicalS ?? {}), ShootAll: 1.0 };
  mutate(findCard(auto.cards, "did-tip") as FirstOfCard, auto);
  return auto;
}

function run(auto: AutoSection, scenario: Scenario = {}) {
  const sample = loadSample();
  const catalog = buildPathCatalog(sample.startPoint, sample.lines, sample.settings);
  return { result: simulateAuto(auto, catalog, sample.startPoint, scenario), catalog };
}

const firedAt = (auto: AutoSection, scenario: Scenario = {}) =>
  run(auto, scenario).result.log.find((e) => e.cardId === "did-tip" && e.kind === "row")!.t;

// "Did the HIVE tip?" times out (its own switch).
const not = (..._names: string[]): Scenario => ({ [switchKey("did-tip")]: false });

test("while a command runs, ✓ fires when the command would have finished, not at once", () => {
  const plain = firedAt(sampleWith(() => {}));
  const withLaunch = firedAt(sampleWith((card) => (card.alongside = "ShootAll")));
  assert(Math.abs(withLaunch - plain - 1.0) < 1e-9, `${plain} → ${withLaunch}`);
});

test("a time limit shorter than the command stops the command, and the log says so", () => {
  const auto = sampleWith((card, a) => {
    card.alongside = "ShootAll";
    a.registry.typicalS!.ShootAll = 3.0;
  });
  const { result } = run(auto, not("HiveTipped"));
  assertEqual(result.taken.get("did-tip"), 1); // the 1500 ms row
  assert(result.log.some((e) => e.cardId === "did-tip" && e.text.includes("ShootAll stopped after 1.50")),
    JSON.stringify(result.log.filter((e) => e.cardId === "did-tip")));
});

test("a time limit inside a feeding launch's feed waits for the feed to end", () => {
  const auto = sampleWith((card, a) => {
    card.alongside = "LaunchAll";
    a.registry.typicalS!.LaunchAll = 3.0;
  });
  const { result } = run(auto, not("HiveTipped"));
  assertEqual(result.taken.get("did-tip"), 1); // still the 1500 ms row, held to the feed's end
  assert(!result.log.some((e) => e.text.includes("LaunchAll stopped")), "the launch is not cut");
  const launch = result.launches.find((l) => l.cardId === "did-tip")!;
  assert(Math.abs(launch.t1 - launch.t0 - 3.0) < 1e-9, `${launch.t0} → ${launch.t1}`);
  const wait = result.waits.find((w) => w.cardId === "did-tip")!;
  assert(Math.abs(wait.t1 - wait.t0 - 3.0) < 1e-9, "3 s, not 1.5 s");
  assert(Math.abs(wait.limitAt! - launch.t1) < 1e-9, "the timeline's limit is the held one");
});

test("a time limit that passes before the feed starts ends the wait on time, nothing launched", () => {
  const auto = sampleWith((card, a) => {
    card.alongside = "LaunchAll";
    a.registry.typicalS!.LaunchAll = 3.0;
  });
  const sample = loadSample();
  const catalog = buildPathCatalog(sample.startPoint, sample.lines, sample.settings);
  // The launcher needs 2 s to reach speed: the 1500 ms limit comes first.
  const spinning = {
    actionSeconds: (name: string) => (name === "LaunchAll" ? 5 : undefined),
    feedStartsAt: (_name: string, t0: number) => t0 + 2,
    trueAt: () => undefined,
  };
  const result = simulateAuto(auto, catalog, sample.startPoint, not("HiveTipped"), spinning);
  const wait = result.waits.find((w) => w.cardId === "did-tip")!;
  assert(Math.abs(wait.t1 - wait.t0 - 1.5) < 1e-9, `${wait.t0} → ${wait.t1}`);
  // At speed after 1 s, the same limit falls inside the feed and is held to its end.
  const ready = { ...spinning, feedStartsAt: (_name: string, t0: number) => t0 + 1 };
  const held = simulateAuto(auto, catalog, sample.startPoint, not("HiveTipped"), ready);
  const heldWait = held.waits.find((w) => w.cardId === "did-tip")!;
  assert(Math.abs(heldWait.t1 - heldWait.t0 - 5) < 1e-9, `${heldWait.t0} → ${heldWait.t1}`);
});

test("a command alongside survives a save and reload", () => {
  const auto = sampleWith((card) => {
    card.alongside = "ShootAll";
  });
  const { auto: reread, problems } = normalizeAuto(JSON.parse(JSON.stringify(serializeAuto(auto))));
  assertEqual(problems, []);
  const card = findCard(reread!.cards, "did-tip") as FirstOfCard;
  assertEqual(card.alongside, "ShootAll");
});

test("the export runs the command alongside the wait", () => {
  const auto = sampleWith((card) => {
    card.alongside = "ShootAll";
  });
  const result = generateAutoJava({ ...loadSample(), auto, sourceFileName: "hive-rush.pp" });
  assert(result.ok, JSON.stringify(result));
  if (!result.ok) return;
  assert(result.source.includes('kit.firstOf("Did the HIVE tip?", kit.command("ShootAll"),'), result.source);
});
