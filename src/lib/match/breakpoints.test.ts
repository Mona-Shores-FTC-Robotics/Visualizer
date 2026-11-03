import { assert, assertEqual, test } from "../testing/harness";
import { normalizeAuto } from "../auto/normalize";
import { normalizePaths, normalizeStartPose } from "../../utils/normalize";
import { DEFAULT_SETTINGS } from "../../config";
import { fallbackValues, FACTS, ROBOT_FACTS } from "../timing/model";
import type { FieldEntry } from "../timing/together";
import { knobBreaks, outcomeChange, outcomeOf, type Knob } from "./breakpoints";
import leftText from "./fixtures/l-partner.pp?raw";
import rightText from "./fixtures/r-partner-tip.pp?raw";

const values = fallbackValues();
const names = ["l-partner", "r-partner-tip"];

function entry(text: string): FieldEntry {
  const d = JSON.parse(text);
  return {
    auto: normalizeAuto(d.auto).auto!,
    startPoint: normalizeStartPose(d.startPoint),
    lines: normalizePaths(d.lines),
    settings: { ...DEFAULT_SETTINGS, ...(d.robot ?? {}) },
    scenario: {},
  };
}
const pair = () => [entry(leftText), entry(rightText)];

test("outcomeChange names the first thing that differs", () => {
  const a = {
    tips: 2,
    waits: [["trigger"], ["trigger"]],
    guarded: [false, false],
  } as const;
  const clone = (o: typeof a) => JSON.parse(JSON.stringify(o));
  assertEqual(outcomeChange(clone(a), clone(a), names), null);
  assertEqual(
    outcomeChange(clone(a), { ...clone(a), tips: 1 }, names),
    "TIPs 2 → 1",
  );
  assertEqual(
    outcomeChange(
      clone(a),
      { ...clone(a), waits: [["trigger"], ["time"]] },
      names,
    ),
    "r-partner-tip: wait 1 times out",
  );
  assertEqual(
    outcomeChange(clone(a), { ...clone(a), guarded: [true, false] }, names),
    "l-partner: endgame guard parks it",
  );
});

test("the partner missing more shots is a tipping point, at a whole number of POLLEN", () => {
  // r-partner-tip's preload volley TIPs the HIVE (start weight 5 + 4 ≥ 8). Lower its hits per
  // volley and, below 3, it no longer does: l-partner's wait for that TIP times out.
  const knob: Knob = { robot: 1, id: "volleyLoad" };
  const found = knobBreaks(pair(), values, knob, names);
  assert(found.down !== null, "lowering it changes the match");
  // POLLEN are whole: the first value that changes anything is 3 (its later volleys, 3 + 3,
  // no longer fill a CELL), not 3.9.
  assertEqual(found.down!.value, values.volleyLoad - 1);
  // Just above the tick nothing has changed; at the tick it has.
  const at = (x: number) =>
    outcomeOf([pair()[0], { ...pair()[1], own: { volleyLoad: x } }], values);
  const base = outcomeOf(pair(), values);
  assertEqual(outcomeChange(base, at(found.down!.value + 1), names), null);
  assert(
    outcomeChange(base, at(found.down!.value), names) !== null,
    "past the tick it changes",
  );
});

test(
  "every slider can be searched, and a whole search stays quick",
  { timeout: 20_000 },
  () => {
    const entries = pair();
    const knobs: Knob[] = [
      ...FACTS.filter((f) => !ROBOT_FACTS.includes(f.id)).map(
        (f) => ({ robot: null, id: f.id }) as Knob,
      ),
      ...[0, 1].flatMap((robot) =>
        ROBOT_FACTS.map((id) => ({ robot, id }) as Knob),
      ),
    ];
    const t0 = performance.now();
    const all = knobs.map((k) => knobBreaks(entries, values, k, names));
    const ms = performance.now() - t0;
    assertEqual(all.length, 14);
    console.log(`breakpoint search, 14 sliders: ${ms.toFixed(0)} ms`);
    assert(ms < 10_000, `took ${ms.toFixed(0)} ms`);
  },
);
