import { assert, assertEqual, test } from "../testing/harness";
import { normalizeAuto } from "../auto/normalize";
import { normalizePaths, normalizeStartPose } from "../../utils/normalize";
import { DEFAULT_SETTINGS } from "../../utils";
import rightText from "./fixtures/recycle5-right.pp?raw";
import leftText from "./fixtures/recycle5-left.pp?raw";
import o3Text from "./fixtures/qual-right-o3.pp?raw";
import partnerRightText from "./fixtures/partner-preloads-right.pp?raw";
import { buildPathCatalog } from "../auto/geometry";
import { layOutShown } from "../auto/links";
import {
  cleanValue,
  FACTS,
  fallbackValues,
  parseTimingFile,
  previewTiming,
  timingFileText,
  tipsFrom,
} from "./model";
import {
  breakpoints,
  previewTogether,
  tipsInAuto,
  type FieldEntry,
} from "./together";

const values = fallbackValues();
const fact = (id: string) => FACTS.find((f) => f.id === id)!;

function entry(text: string): FieldEntry {
  const d = JSON.parse(text);
  return {
    auto: normalizeAuto(d.auto).auto!,
    startPoint: normalizeStartPose(d.startPoint),
    lines: normalizePaths(d.lines),
    settings: d.settings ?? DEFAULT_SETTINGS,
    scenario: {},
  };
}

test("a TIP needs the raised CELL's weight: the first on one volley, later ones on two", () => {
  const v = {
    ...values,
    tipStartS: 0.5,
    tipSwingS: 1,
    startLoad: 5,
    volleyLoad: 4,
    tipLoad: 8,
  };
  // 0.8: 5 + 4 tips it. 3.0: 4 in the new raised CELL. 6.0: 8, tips. 6.5: mid-swing, ignored.
  assertEqual(tipsFrom([0.8, 3.0, 6.0, 6.5], v), [
    { start: 1.3, settled: 2.3 },
    { start: 6.5, settled: 7.5 },
  ]);
});

test("CELL up, Tip and IntakeFull answer from the TIPs and the robot's state", () => {
  const tips = [
    { start: 1.3, settled: 2.3 },
    { start: 6.5, settled: 7.5 },
  ];
  const t = previewTiming(values, tips);
  assertEqual(t.trueAt("RightCellUp", 0), 0, "the match starts right CELL up");
  assertEqual(t.trueAt("LeftCellUp", 0), 2.3);
  assertEqual(t.trueAt("RightCellUp", 3), 7.5);
  assertEqual(t.trueAt("LeftCellUp", 1.5), 2.3, "mid-swing is neither");
  assertEqual(
    t.trueAt("Tip", 1.5),
    1.5,
    "a TIP under way when the wait starts counts",
  );
  assertEqual(t.trueAt("Tip", 3), 6.5);
  assertEqual(t.trueAt("Tip", 8), Infinity);
  assertEqual(t.trueAt("IntakeFull", 4), 4, "it starts full with its preloads");
  t.commandRan?.("LaunchAll", 4, 5);
  assertEqual(t.trueAt("IntakeFull", 5), 5 + values.intakeFullS);
  t.becameTrue?.("IntakeFull", 6.5);
  assertEqual(t.trueAt("IntakeFull", 7), 7, "full stays full");
  assertEqual(t.actionSeconds("LaunchAll"), values.volleyS);
  assertEqual(t.actionSeconds("Unknown"), undefined);
  assertEqual(
    t.trueAt("Unknown", 3),
    undefined,
    "unknown triggers stay instant",
  );
});

test("timing.json: bad values are dropped, changed values marked estimates, notes kept", () => {
  const file = parseTimingFile(
    JSON.stringify({
      version: 1,
      facts: {
        volleyS: { value: 1.2, source: "measured", note: "filmed 3 Oct" },
        tipSwingS: { value: -1 },
        driveSpeed: { value: 0 },
        nonsense: { value: 3 },
      },
    }),
  );
  assertEqual(Object.keys(file.facts), ["volleyS"]);
  assertEqual(cleanValue(fact("tipStartS"), "-0.4"), -0.4);
  assertEqual(cleanValue(fact("intakeFullS"), "abc"), null);
  const out = JSON.parse(
    timingFileText({ ...values, volleyS: 1.2, intakeFullS: 2.5 }, file),
  ).facts;
  assertEqual(out.volleyS, {
    value: 1.2,
    source: "measured",
    note: "filmed 3 Oct",
  });
  assertEqual(out.intakeFullS.source, "estimate");
});

test("recycle5 together: the left robot's first volley waits on the right robot's TIP 1", () => {
  const pair = [entry(rightText), entry(leftText)];
  const { tips, previews } = previewTogether(pair, values);
  assert(
    Math.abs(tips[0].settled - 2.1) < 0.05,
    `TIP 1 settles at about 2.1 s, not ${tips[0].settled}`,
  );
  assert(
    tipsInAuto(tips) >= 3,
    `at least 3 TIPs by 30 s, not ${tipsInAuto(tips)}`,
  );
  const left = previews[1].log.find((e) =>
    e.text.startsWith("TIP 1: LeftCellUp true"),
  );
  assert(
    left && Math.abs(left.t - tips[0].settled) < 1e-6,
    "the left robot's TIP 1 wait ends when TIP 1 settles",
  );
  // Alone, the left robot never sees its CELL rise: it waits out its 8 s limit.
  const alone = previewTogether([entry(leftText)], values);
  assertEqual(alone.tips.length > 0 ? alone.tips[0].settled > 8 : true, true);
  // Slower driving never gives more TIPs.
  const slow = previewTogether(pair, { ...values, driveSpeed: 0.6 });
  assert(
    tipsInAuto(slow.tips) <= tipsInAuto(tips),
    "slower driving does not add TIPs",
  );
});

test("breakpoints: driving slower eventually costs a TIP", () => {
  const found = breakpoints([entry(rightText), entry(leftText)], values);
  const speed = found.find((b) => b.id === "driveSpeed")!;
  assert(
    speed.down !== null && speed.down.to < speed.down.from,
    "slower driving loses a TIP somewhere above 0.5×",
  );
});

test("Together view: a branch's paths start where the robot is once laid out (qual-right-o3)", () => {
  const shown = (text: string) => {
    const e = entry(text);
    return layOutShown({ ...e, sequence: [] });
  };
  // The farthest a drive starts from where the previous drive ended.
  const worstJump = (pair: FieldEntry[]) => {
    const preview = previewTogether(pair, values).previews[0];
    const catalog = buildPathCatalog(pair[0].startPoint, pair[0].lines, pair[0].settings);
    let at: { x: number; y: number } = pair[0].startPoint;
    let worst = 0;
    for (const drive of preview.drives) {
      const path = catalog.byId.get(drive.pathId)!;
      worst = Math.max(worst, Math.hypot(path.start.x - at.x, path.start.y - at.y));
      at = path.end;
    }
    return { worst, drives: preview.drives.length };
  };
  // As the file lists them, "S_FIRE to GARDEN" (No TIP 3 yet?) follows a path to PARK.
  const raw = worstJump([entry(o3Text), entry(partnerRightText)]);
  assert(raw.worst > 70, `the file as listed jumps (${raw.worst.toFixed(1)} in)`);
  const laidOut = worstJump([shown(o3Text), shown(partnerRightText)]);
  assert(laidOut.drives >= 10, `it drives the route (${laidOut.drives} paths)`);
  assert(laidOut.worst < 1e-6, `no drive starts away from the robot (${laidOut.worst.toFixed(2)} in)`);
});
