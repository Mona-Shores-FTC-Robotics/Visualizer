// The Match view's TIP what-ifs (src/lib/match/tipToggles.ts, timing/model.ts tipMisses): each TIP
// the robots try for is a ✓ / ✓ on a later try / ✗, asked of the HIVE, so every wait after it reads
// the HIVE as it would really be. R-Solo beside a still partner is the case that showed why: with
// TIP 1 answered at the wait alone, the HIVE still had TIP 1, so R-Solo found RIGHT down and parked
// with its load, where on the field it would find RIGHT still up and shoot it.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/config/defaults";
import { parseProject, robotConfigOf } from "../src/io";
import { tipChoiceLabel, tipToggles } from "../src/lib/match/tipToggles";
import {
  fallbackValues,
  hiveHistory,
  parseTimingFile,
  tipMissesKey,
  type TimingValues,
} from "../src/lib/timing/model";
import { previewTogether, type FieldEntry } from "../src/lib/timing/together";

const DIR = "test/fixtures/tips";

function entry(file: string): FieldEntry {
  const loaded = parseProject(
    readFileSync(`${DIR}/${file}`, "utf8"),
    robotConfigOf(DEFAULT_SETTINGS),
  );
  if (!loaded.ok) throw new Error(loaded.error);
  const doc = loaded.doc;
  return {
    auto: doc.auto!,
    startPoint: doc.startPoint,
    lines: doc.lines,
    settings: { ...DEFAULT_SETTINGS, ...doc.robot },
    scenario: {},
  };
}

function teamValues(): TimingValues {
  const facts = parseTimingFile(
    readFileSync(`${DIR}/timing.json`, "utf8"),
  ).facts;
  return {
    ...fallbackValues(),
    ...Object.fromEntries(Object.entries(facts).map(([k, f]) => [k, f.value])),
  };
}

const entries = () => [entry("r-solo.pp"), entry("partner-still.pp")];

/** R-Solo's waits, by label, and whether each read its CELL up. */
function waits(values: TimingValues) {
  const { previews } = previewTogether(entries(), values, false);
  return previews[0].waits.map((w) => `${w.label}: ${w.ended}`);
}

describe("the HIVE misses the tries the Match view says", () => {
  const values = {
    volleyLoad: 4,
    tipLoad: 3,
    startLoad: 0,
    tipStartS: 1,
    tipSwingS: 1,
  };
  const at = (t: number) => ({ t, robot: 0 });

  it("TIPs on the first try by default", () => {
    const h = hiveHistory([at(1), at(5)], values);
    expect(h.tips.map((t) => t.start)).toEqual([2, 6]);
  });

  it("comes on the retry when the first try misses", () => {
    const h = hiveHistory([at(1), at(5)], { ...values, [tipMissesKey(1)]: 1 });
    expect(h.volleys[0]).toMatchObject({ counted: false, missed: 0 });
    expect(h.tips.map((t) => t.start)).toEqual([6]);
  });

  it("never comes, and nothing after it does", () => {
    const h = hiveHistory([at(1), at(5)], {
      ...values,
      [tipMissesKey(1)]: Infinity,
    });
    expect(h.tips).toEqual([]);
    expect(h.volleys.map((v) => v.missed)).toEqual([0, 0]);
  });
});

describe("R-Solo beside a still partner", () => {
  it("lists the TIPs it tries for, TIP 1 with a retry", () => {
    const rows = tipToggles(entries(), teamValues());
    expect(rows.map((r) => r.tip)).toEqual([1, 2]);
    expect(rows.every((r) => r.robot === 0)).toBe(true);
    // Never: the preloads miss, LEFT is not up, it goes back and shoots RIGHT, which misses too.
    expect(rows[0].tries).toBe(2);
    expect(rows[0].misses).toBe(0);
  });

  it("TIP 1 ✓: LEFT is up when it gets there", () => {
    expect(waits(teamValues())[0]).toBe("Wait for TIP or CELL up: trigger");
  });

  it("TIP 1 on the retry: LEFT is down, and RIGHT is still up, so it shoots RIGHT", () => {
    const values = { ...teamValues(), [tipMissesKey(1)]: 1 };
    expect(waits(values)).toEqual([
      "Wait for TIP or CELL up: time",
      "RIGHT CELL still up?: trigger",
    ]);
    expect(tipToggles(entries(), values)[0].misses).toBe(1);
  });

  it("TIP 1 ✗: the same, and its RIGHT volley misses too", () => {
    const values = { ...teamValues(), [tipMissesKey(1)]: Infinity };
    expect(waits(values)).toEqual([
      "Wait for TIP or CELL up: time",
      "RIGHT CELL still up?: trigger",
    ]);
    expect(tipToggles(entries(), values).map((r) => r.tip)).toEqual([1]);
  });

  it("names each choice in a word", () => {
    expect([0, 1, 2, Infinity].map(tipChoiceLabel)).toEqual([
      "✓",
      "✓ 2nd try",
      "✓ 3rd try",
      "✗",
    ]);
  });
});

describe("each try is named by its volley", () => {
  it("R-Solo: its preloads, then the FLOWER load it brings back to RIGHT", () => {
    const [tip1] = tipToggles(entries(), teamValues());
    expect(tip1.tryList.map((t) => [t.robot, t.what])).toEqual([
      [0, "preloads"],
      [0, "FLOWER"],
    ]);
    expect(tip1.tryList[0].t).toBeLessThan(tip1.tryList[1].t);
  });
});
