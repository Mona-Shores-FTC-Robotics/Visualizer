import { assert, assertEqual, test } from "../testing/harness";
import { createEmptyAuto } from "./normalize";
import { findCard } from "./tree";
import type { FirstOfCard } from "./types";
import { exitText, insertPreset, isSimpleWait, PRESETS, waitSentence } from "./presets";
import { loadSample } from "./fixtures/load";
import { validateAuto } from "./validate";
import { buildPathCatalog } from "./geometry";

const noSelection = { cardId: null, rowIndex: null };

test("Fire is LaunchAll until Empty, at most 3 s, and registers its names", () => {
  const auto = createEmptyAuto();
  const id = insertPreset(auto, "fire", noSelection);
  const card = findCard(auto.cards, id) as FirstOfCard;
  assertEqual(card.kind, "firstOf");
  assertEqual(card.label, "Fire");
  assertEqual(card.alongside, "LaunchAll");
  assertEqual(card.rows, [
    { when: ["Empty"], cards: [] },
    { afterMs: 3000, cards: [] },
  ]);
  assertEqual(auto.registry.actions, ["LaunchAll"]);
  assertEqual(auto.registry.conditions, ["Empty"]);
  assertEqual(auto.registry.typicalS, { LaunchAll: 2 });
  assertEqual(waitSentence(card), "LaunchAll until Empty · at most 3.0 s");
});

test("Load and Wait for TIP are plain waits; Tip is registered as an event", () => {
  const auto = createEmptyAuto();
  insertPreset(auto, "load", noSelection);
  insertPreset(auto, "tip", noSelection);
  const [load, tip] = auto.cards as FirstOfCard[];
  assertEqual(waitSentence(load), "until IntakeFull · at most 3.0 s");
  assertEqual(waitSentence(tip), "until Tip · at most 5.0 s");
  assertEqual(load.alongside, undefined);
  assertEqual(auto.registry.conditions, ["IntakeFull", "Tip"]);
  assertEqual(auto.registry.events, ["Tip"]);
  assertEqual(auto.registry.actions, []);
  assertEqual(auto.registry.typicalS, undefined);
});

test("adding a preset twice registers each name once, and keeps a typical time already set", () => {
  const auto = createEmptyAuto();
  auto.registry.typicalS = { LaunchAll: 3 };
  insertPreset(auto, "fire", noSelection);
  insertPreset(auto, "fire", noSelection);
  assertEqual(auto.registry.actions, ["LaunchAll"]);
  assertEqual(auto.registry.conditions, ["Empty"]);
  assertEqual(auto.registry.typicalS, { LaunchAll: 3 });
  assertEqual(auto.cards.length, 2);
});

test("a preset goes after the selected card, or at the end of a selected branch", () => {
  const auto = createEmptyAuto();
  const first = insertPreset(auto, "load", noSelection);
  const second = insertPreset(auto, "tip", { cardId: first, rowIndex: null });
  insertPreset(auto, "fire", { cardId: first, rowIndex: null });
  assertEqual(auto.cards.map((card) => (card as FirstOfCard).label), ["Load", "Fire", "Wait for TIP"]);
  // Into the ✗ exit of the TIP wait: that is how a branch starts.
  const inside = insertPreset(auto, "fire", { cardId: second, rowIndex: 1 });
  const tip = findCard(auto.cards, second) as FirstOfCard;
  assertEqual(tip.rows[1].cards.map((card) => card.id), [inside]);
  assertEqual(tip.rows[0].cards, []);
});

test("every preset validates in a fresh file and is the simple one-trigger-one-limit shape", () => {
  const sample = loadSample();
  const catalog = buildPathCatalog(sample.startPoint, sample.lines, sample.settings);
  for (const preset of PRESETS) {
    const auto = createEmptyAuto();
    const id = insertPreset(auto, preset.kind, noSelection);
    const card = findCard(auto.cards, id) as FirstOfCard;
    assert(isSimpleWait(card), `${preset.kind} is not a simple wait`);
    const errors = validateAuto(auto, catalog, sample.startPoint).filter((issue) => issue.level === "error");
    assertEqual(errors, [], `${preset.kind} has errors`);
  }
});

test("exits read as ✓ trigger and ✗ not after the limit", () => {
  assertEqual(exitText({ when: ["Tip"], cards: [] }), "✓ Tip");
  assertEqual(exitText({ afterMs: 1500, cards: [] }), "✗ not after 1.5 s");
  assertEqual(exitText({ when: [], cards: [] }), "✓ (no trigger)");
});

test("the sample's waits read in plain words", () => {
  const sample = loadSample();
  const waits = sample.auto.cards.filter((card) => card.kind === "firstOf") as FirstOfCard[];
  assert(waits.length > 0, "the sample has waits");
  for (const wait of waits) {
    assert(isSimpleWait(wait), `${wait.label} is not simple`);
    assert(!waitSentence(wait).includes("ms"), waitSentence(wait));
  }
});
