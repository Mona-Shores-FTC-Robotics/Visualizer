import { assert, assertEqual, test } from "../testing/harness";
import { generateAutoJava } from "../codegen/auto/javaAuto";
import { loadSample } from "./fixtures/load";
import { buildPathCatalog } from "./geometry";
import { normalizeAuto, serializeAuto } from "./normalize";
import { questionKey, simulateAuto, worstCase, type Scenario } from "./simulate";
import { findCard } from "./tree";
import type { AutoSection, FirstOfCard } from "./types";
import { validateAuto } from "./validate";

// "Did the HIVE tip?" in the sample: rows [when HiveTipped/CameraBlind, afterMs 1500, ...].
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

const not = (...names: string[]): Scenario =>
  Object.fromEntries(names.map((name) => [questionKey("did-tip", name), false]));

test("while a command runs, ✓ fires when the command would have finished, not at once", () => {
  const plain = firedAt(sampleWith(() => {}));
  const withLaunch = firedAt(sampleWith((card) => (card.alongside = "ShootAll")));
  assert(Math.abs(withLaunch - plain - 1.0) < 1e-9, `${plain} → ${withLaunch}`);
});

test("a 'when it finishes' row fires at the command's typical time", () => {
  const auto = sampleWith((card) => {
    card.alongside = "ShootAll";
    card.rows.splice(1, 0, { finished: true, cards: [] });
  });
  const { result } = run(auto, not("HiveTipped", "CameraBlind"));
  assertEqual(result.taken.get("did-tip"), 1);
  const plain = firedAt(sampleWith(() => {}));
  const at = firedAt(auto, not("HiveTipped", "CameraBlind"));
  assert(Math.abs(at - plain - 1.0) < 1e-9, `${plain} → ${at}`);
});

test("a time limit shorter than the command stops the command, and the log says so", () => {
  const auto = sampleWith((card, a) => {
    card.alongside = "ShootAll";
    a.registry.typicalS!.ShootAll = 3.0;
  });
  const { result } = run(auto, not("HiveTipped", "CameraBlind"));
  assertEqual(result.taken.get("did-tip"), 1); // the 1500 ms row
  assert(result.log.some((e) => e.cardId === "did-tip" && e.text.includes("ShootAll stopped after 1.50")),
    JSON.stringify(result.log.filter((e) => e.cardId === "did-tip")));
});

test("worst case: a 'when it finishes' row caps the wait", () => {
  const plainAuto = sampleWith(() => {});
  const auto = sampleWith((card) => {
    card.alongside = "ShootAll";
    card.rows.splice(1, 0, { finished: true, cards: [] });
  });
  const { catalog } = run(auto);
  const plain = worstCase(plainAuto, catalog).rows.get("did-tip")!;
  const capped = worstCase(auto, catalog).rows.get("did-tip")!;
  // The 1500 ms row can no longer win: the command finishes at 1.0 s.
  assertEqual(capped[2], null);
  assert(capped[1]! < plain[1]!, `${capped[1]} vs ${plain[1]}`);
});

test("alongside and 'finished' rows survive a save and reload", () => {
  const auto = sampleWith((card) => {
    card.alongside = "ShootAll";
    card.rows.splice(1, 0, { finished: true, cards: [] });
  });
  const { auto: reread, problems } = normalizeAuto(JSON.parse(JSON.stringify(serializeAuto(auto))));
  assertEqual(problems, []);
  const card = findCard(reread!.cards, "did-tip") as FirstOfCard;
  assertEqual(card.alongside, "ShootAll");
  assert("finished" in card.rows[1], JSON.stringify(card.rows[1]));
});

test("a 'when it finishes' row with nothing alongside is an error", () => {
  const auto = sampleWith((card) => card.rows.splice(1, 0, { finished: true, cards: [] }));
  const sample = loadSample();
  const catalog = buildPathCatalog(sample.startPoint, sample.lines, sample.settings);
  const issues = validateAuto(auto, catalog, sample.startPoint);
  assert(issues.some((i) => i.level === "error" && i.message.includes("runs no command while waiting")),
    JSON.stringify(issues));
});

test("the export runs the command alongside the wait", () => {
  const auto = sampleWith((card) => {
    card.alongside = "ShootAll";
    card.rows.splice(1, 0, { finished: true, cards: [] });
  });
  const result = generateAutoJava({ ...loadSample(), auto, sourceFileName: "hive-rush.pp" });
  assert(result.ok, JSON.stringify(result));
  if (!result.ok) return;
  assert(result.source.includes('kit.firstOf("Did the HIVE tip?", kit.command("ShootAll"),'), result.source);
  assert(result.source.includes("kit.finished()"), result.source);
});
