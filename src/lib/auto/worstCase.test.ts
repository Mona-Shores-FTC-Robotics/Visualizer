import { assert, assertEqual, test } from "../testing/harness";
import { loadProject, loadSample } from "./fixtures/load";
import { buildPathCatalog, chainInfo, type PathCatalog } from "./geometry";
import { commandSeconds, worstCase } from "./simulate";
import { rejoinTail } from "./tree";
import type { AutoCard, AutoSection, FirstOfCard } from "./types";
import redGardenBasic from "../../../samples/red-garden-basic.pp?raw";
import redGardenNoTurret from "../../../samples/red-garden-no-turret.pp?raw";
import redSimple from "../../../samples/red-simple.pp?raw";
import redSpotMap from "../../../samples/red-spot-map.pp?raw";
import rightStartTip from "../../../samples/right-start-tip.pp?raw";

/**
 * worstCase as it was: every combination of every decision's rows, one by one.
 * Right, but 2^n for n decisions in a row. Kept here as the reference the fast
 * one must agree with.
 */
function everyCombination(auto: AutoSection, catalog: PathCatalog) {
  const rows = new Map<string, (number | null)[]>();
  const record = (id: string, index: number, count: number, value: number | null) => {
    const list = rows.get(id) ?? new Array<number | null>(count).fill(null);
    const current = list[index];
    if (value !== null && (current === null || value > current)) list[index] = value;
    rows.set(id, list);
  };
  const endOf = (list: AutoCard[], start: number, index: number, rest: (t: number) => number): number => {
    let t = start;
    for (let i = index; i < list.length; i++) {
      const card = list[i];
      if (card.kind === "action") t += commandSeconds(auto, card);
      else if (card.kind === "path") {
        const ids = [card.lineId];
        let j = i;
        while (list[j]?.kind === "path" && (list[j] as { through?: boolean }).through && list[j + 1]?.kind === "path") {
          j++;
          ids.push((list[j] as { lineId: string }).lineId);
        }
        t += ids.length > 1 ? chainInfo(catalog, ids).seconds : catalog.byId.get(card.lineId)?.seconds ?? 0;
        i = j;
      } else if (card.kind === "rejoin") {
        const tail = rejoinTail(auto.cards, card.target);
        t += tail?.through.length
          ? chainInfo(catalog, [card.lineId, ...tail.through.map((c) => c.lineId)]).seconds
          : catalog.byId.get(card.lineId)?.seconds ?? 0;
        if (!tail) return rest(t);
        return endOf(tail.list, t, tail.index, (x) => x);
      } else {
        let limit = Infinity;
        for (const row of card.rows) if ("afterMs" in row) limit = Math.min(limit, t + row.afterMs / 1000);
        if (!Number.isFinite(limit)) return Infinity;
        const after = (end: number) => endOf(list, end, i + 1, rest);
        let worst = -Infinity;
        card.rows.forEach((row, k) => {
          const time = "afterMs" in row ? t + row.afterMs / 1000 : limit;
          if (time > limit + 1e-9) return record(card.id, k, card.rows.length, null);
          const end = endOf(row.cards, time, 0, after);
          record(card.id, k, card.rows.length, end);
          worst = Math.max(worst, end);
        });
        return worst;
      }
    }
    return rest(t);
  };
  return { total: endOf(auto.cards, 0, 0, (t) => t), rows };
}

function near(a: number | null, b: number | null) {
  return a === b || (a !== null && b !== null && Math.abs(a - b) < 1e-6);
}

function assertSame(name: string, auto: AutoSection, catalog: PathCatalog) {
  const fast = worstCase(auto, catalog);
  const slow = everyCombination(auto, catalog);
  assert(near(fast.total, slow.total), `${name}: total ${fast.total} vs ${slow.total}`);
  assertEqual([...fast.rows.keys()].sort(), [...slow.rows.keys()].sort(), `${name}: decisions`);
  for (const [id, list] of slow.rows) {
    const got = fast.rows.get(id)!;
    list.forEach((value, k) => assert(near(got[k], value), `${name}: ${id} row ${k}: ${got[k]} vs ${value}`));
  }
}

const SAMPLES: [string, string][] = [
  ["red-garden-basic", redGardenBasic],
  ["red-garden-no-turret", redGardenNoTurret],
  ["red-simple", redSimple],
  ["red-spot-map", redSpotMap],
  ["right-start-tip", rightStartTip],
];

test("worst case: the same answer as trying every combination, on every sample", () => {
  const hive = loadSample();
  assertSame("hive-rush", hive.auto, buildPathCatalog(hive.startPoint, hive.lines, hive.settings));
  for (const [name, text] of SAMPLES) {
    const sample = loadProject(text);
    assertSame(name, sample.auto, buildPathCatalog(sample.startPoint, sample.lines, sample.settings));
  }
});

/** hive-rush with `n` two-row waits in front: "TIP 1 (k)" in recycle5-left, 2^n combinations. */
function withWaits(n: number) {
  const sample = loadSample();
  const waits: FirstOfCard[] = Array.from({ length: n }, (_, k) => ({
    id: `stack-${k}`,
    kind: "firstOf",
    label: `TIP 1 (${k})`,
    rows: [
      { when: ["LeftCellUp"], cards: [] },
      { afterMs: 1000, cards: [] },
    ],
  }));
  const auto = { ...sample.auto, cards: [...waits, ...sample.auto.cards] };
  return { auto, catalog: buildPathCatalog(sample.startPoint, sample.lines, sample.settings), sample };
}

test("worst case: decisions in a row agree with every combination", () => {
  const { auto, catalog } = withWaits(10);
  assertSame("10 waits", auto, catalog);
});

test("worst case: forty decisions in a row take moments, not forever", () => {
  const { auto, catalog, sample } = withWaits(40);
  const started = Date.now();
  const worst = worstCase(auto, catalog);
  const ms = Date.now() - started;
  assert(ms < 1000, `took ${ms} ms`);
  // Each wait can run to its 1 s limit, before the Auto itself.
  const alone = worstCase(sample.auto, catalog).total;
  assert(near(worst.total, alone + 40), `${worst.total} vs ${alone} + 40`);
});
