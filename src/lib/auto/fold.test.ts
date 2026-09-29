import { assertEqual, test } from "../testing/harness";
import { loadSample } from "./fixtures/load";
import {
  branchesAround,
  branchKey,
  foldSummary,
  toggleFolded,
  unfoldAround,
} from "./fold";
import { cardTitle } from "./tree";

test("the branches around a card, outermost first", () => {
  const { auto } = loadSample();
  assertEqual(branchesAround(auto.cards, "spin-up"), []);
  assertEqual(branchesAround(auto.cards, "tip-2"), ["did-tip#0"]);
  // Did the HIVE tip? → If not tipped → Did it tip this time? → Out of time → Hold's fallback.
  assertEqual(branchesAround(auto.cards, "late-out"), [
    "did-tip#1",
    "near-5#1",
    "late-hold#0",
  ]);
  assertEqual(branchesAround(auto.cards, "near-3b"), ["did-tip#1", "near-3#0"]);
  assertEqual(branchesAround(auto.cards, "no-such-card"), []);
});

test("selecting a card opens the folded branches around it, and only those", () => {
  const { auto } = loadSample();
  const folded = new Set(["did-tip#0", "did-tip#1", "near-5#1", "near-5#0"]);
  const next = unfoldAround(folded, auto.cards, "late-out");
  assertEqual([...next].sort(), ["did-tip#0", "near-5#0"]);
  // Nothing to open: the same set comes back, so the store does not change.
  assertEqual(unfoldAround(next, auto.cards, "spin-up") === next, true);
});

test("toggling folds an open branch and opens a folded one, without changing the old set", () => {
  const open = new Set<string>();
  const folded = toggleFolded(open, "did-tip#1");
  assertEqual([...folded], ["did-tip#1"]);
  assertEqual([...toggleFolded(folded, "did-tip#1")], []);
  assertEqual(open.size, 0);
});

test("a folded branch reads as its card count and first cards", () => {
  const { auto } = loadSample();
  const name = (card: Parameters<typeof cardTitle>[0]) =>
    cardTitle(card, card.kind === "path" ? card.lineId : undefined);
  const tipped = auto.cards[3];
  if (tipped.kind !== "firstOf") throw new Error("sample changed");
  assertEqual(
    foldSummary(tipped.rows[0].cards, name),
    "4 cards · far-to → CollectFar at FarPickup → ShootAll → far-park",
  );
  // Nested cards count; only the branch's own first cards are named.
  assertEqual(
    foldSummary(tipped.rows[1].cards, name),
    "15 cards · near-collect → Wait for IntakeFull → Back and spin up → ShootAll → …",
  );
  assertEqual(branchKey("did-tip", 1), "did-tip#1");
});
