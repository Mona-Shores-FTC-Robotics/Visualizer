import { assert, assertEqual, test } from "../testing/harness";
import { loadSample } from "./fixtures/load";
import { buildPathCatalog } from "./geometry";
import { AUTO_LENGTH_S, simulateAuto, worstCase, type Scenario } from "./simulate";
import { findCard } from "./tree";
import type { AutoSection, FirstOfCard } from "./types";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function run(auto: AutoSection, scenario: Scenario = {}) {
  const sample = loadSample();
  const catalog = buildPathCatalog(sample.startPoint, sample.lines, sample.settings);
  return { result: simulateAuto(auto, catalog, sample.startPoint, scenario), catalog };
}

const never = { enabled: false, seconds: 0, from: "card" as const };

test("a condition that turns true in time picks its row", () => {
  const { result } = run(loadSample().auto, {
    HiveTipped: { enabled: true, seconds: 0.9, from: "card" },
  });
  assertEqual(result.taken.get("did-tip"), 0);
  assert(result.ran.has("tip-1") && !result.ran.has("near-1"));
  const row = result.log.find((entry) => entry.cardId === "did-tip")!;
  assert(row.text.includes("If tipped") && row.text.includes("0.90 s"), row.text);
});

test("with the conditions off, the time row fires", () => {
  const { result } = run(loadSample().auto, { HiveTipped: never, CameraBlind: never });
  assertEqual(result.taken.get("did-tip"), 1);
  assert(result.ran.has("near-1") && !result.ran.has("tip-1"));
  // The nested decision falls through to "otherwise".
  assertEqual(result.taken.get("near-5"), 2);
});

test("path timing comes from the app's motion model and events land inside the drive", () => {
  const { result, catalog } = run(loadSample().auto);
  const drive = result.drives.find((d) => d.cardId === "tip-1")!;
  const path = catalog.byId.get("far-to")!;
  assert(Math.abs(drive.t1 - drive.t0 - path.seconds) < 1e-9);
  const event = result.log.find((entry) => entry.kind === "event" && entry.cardId === "tip-1")!;
  assert(event.t > drive.t0 && event.t < drive.t1, `${event.t} outside ${drive.t0}..${drive.t1}`);
  // 60% of the distance is reached after more than 60% of a rest-to-rest profile's
  // first half, and before its end.
  assert(event.t - drive.t0 > 0.5 * path.seconds);
});

test("the preview timeline is contiguous and ends with the Auto", () => {
  const { result } = run(loadSample().auto);
  let previous = 0;
  for (const event of result.timeline) {
    assert(Math.abs(event.startTime - previous) < 1e-6, `gap at ${previous} → ${event.startTime}`);
    assert(event.duration > 0);
    previous = event.endTime;
  }
  assert(Math.abs(previous - result.endTime) < 1e-6);
});

test("the endgame guard parks when the time left is down to the park path", () => {
  const auto = clone(loadSample().auto);
  const branch = (findCard(auto.cards, "did-tip") as FirstOfCard).rows[0].cards;
  // A slow shot before the far pickups leaves too little time for them.
  branch.unshift({ id: "slow", kind: "action", name: "ShootAll", previewMs: 22000 });
  const { result, catalog } = run(auto, { HiveTipped: { enabled: true, seconds: 0.5, from: "card" } });
  assert(result.guard, "guard expected");
  const park = catalog.byId.get("far-park")!;
  assert(Math.abs(result.guard.t - (AUTO_LENGTH_S - park.seconds)) < 1e-6, `guard at ${result.guard.t}`);
  // The path under way at the deadline is cut short there, and the cards
  // after it are skipped.
  const cut = result.log.find((entry) => entry.text.includes("stopped by the endgame guard"));
  assert(cut && Math.abs(cut.t - result.guard.t) < 1e-6, JSON.stringify(result.log));
  assert(!result.ran.has("tip-5"), "the rest of the branch is skipped");
  assert(result.ran.has("tip-6"), "the park path is driven");
  assert(Math.abs(result.endTime - AUTO_LENGTH_S) < 1e-6, `ends at ${result.endTime}`);
  assert(result.log.some((entry) => entry.kind === "guard"));
});

test("a wait no row can end stalls the preview and says so", () => {
  const auto = clone(loadSample().auto);
  const wait = findCard(auto.cards, "wait-ready") as FirstOfCard;
  wait.rows = [{ when: ["LauncherReady"], cards: [] }];
  const { result } = run(auto, { LauncherReady: never });
  assert(result.stalled);
  assert(!result.ran.has("shoot-preload"));
});

test("worst case: every wait runs to its time row", () => {
  const auto = loadSample().auto;
  const { catalog } = run(auto);
  const worst = worstCase(auto, catalog);
  const rows = worst.rows.get("did-tip")!;
  assert(rows[0]! < rows[1]!, "the near branch is the long one");
  assertEqual(worst.total, rows[1]);
  // "time left < 6 s" cannot win against "otherwise" this early.
  assertEqual(worst.rows.get("near-5")![1], null);
  // The worst case is at least as long as any preview.
  const { result } = run(auto, { HiveTipped: never, CameraBlind: never, IntakeFull: never, LauncherReady: never });
  assert(result.endTime <= worst.total + 1e-9, `${result.endTime} > ${worst.total}`);
});
