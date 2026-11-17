// Fork: a route choice inside a wait's Otherwise whose legs each end with a wait that parks
// (biobuzz L-NoCross: "waiting for TIP 1 until 9 s, if no TIP 1: CROSS AND FIX IT or WAIT FOR PARTNER FIX").
// Each leg holds the rest of its own route, so the drive team's pick decides what the robot does
// when TIP 1 does not come: cross under the HIVE and fix it, or stay and give the partner time.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/config/defaults";
import { parseProject, robotConfigOf } from "../src/io";
import { generateAutoJavaFromText } from "../src/lib/codegen/auto/fromFile";
import {
  isBuilderAuto,
  isSimple,
  setStepTimeout,
  setWaitName,
  stepsOf,
} from "../src/lib/simple/steps";

const DIR = "test/fixtures/no-cross-choice";
const SAVED = /SAVED = "[^"]*"/;
const text = readFileSync(`${DIR}/l-no-cross.pp`, "utf8");

function load() {
  const loaded = parseProject(text, robotConfigOf(DEFAULT_SETTINGS));
  if (!loaded.ok) throw new Error(loaded.error);
  return loaded.doc;
}

describe("a choice whose legs end with a wait that parks", () => {
  it("passes validation and exports the Java biobuzz holds, with the choice on the INIT menu", () => {
    const result = generateAutoJavaFromText(text, "l-no-cross.pp");
    if (!result.ok) throw new Error(result.errors.join("; "));
    expect(result.source.replace(SAVED, "")).toBe(
      readFileSync(`${DIR}/LNoCrossAuto.java`, "utf8").replace(SAVED, ""),
    );
    expect(result.source).toContain(
      'AutoOption.choice("if no TIP 1", "CROSS AND FIX IT", "WAIT FOR PARTNER FIX")',
    );
  });

  it("guards the crossing by the park from where it goes, as before the choice", () => {
    const result = generateAutoJavaFromText(text, "l-no-cross.pp");
    if (!result.ok) throw new Error(result.errors.join("; "));
    expect(result.source).toContain('kit.guarded("Auto", toLeftParkPath2, 2,');
    expect(result.source).toContain(
      'kit.guarded("Timed out", rightAutoFixTipParkUnderTheHive, 3.7,',
    );
  });

  it("opens in the Simple builder, each leg with its own route to its park", () => {
    const doc = load();
    expect(isSimple(doc)).toBe(true);
    expect(isBuilderAuto(doc.auto!)).toBe(true);
    const wait = stepsOf(doc).find((s) => s.kind === "wait")!;
    const choice = wait.otherwise!.find((s) => s.kind === "choice")!;
    expect(choice.legs!.map((leg) => leg.name)).toEqual([
      "CROSS AND FIX IT",
      "WAIT FOR PARTNER FIX",
    ]);
    // CROSS AND FIX IT: under the HIVE, RIGHT up?, fix TIP 1, the scoring FLOWER, back, LEFT.
    expect(choice.legs![0].steps.map((s) => s.kind)).toEqual([
      "drive",
      "wait",
      "launch",
      "drive",
      "pick",
      "drive",
      "wait",
      "launch",
      "park",
    ]);
    // WAIT FOR PARTNER FIX: wait at the left end for LEFT up, then the route TIP 1 would have started.
    expect(choice.legs![1].steps.map((s) => s.kind)).toEqual([
      "wait",
      "launch",
      "drive",
      "pick",
      "drive",
      "wait",
      "launch",
      "park",
    ]);
  });

  it("keeps each leg's route through an edit inside it", () => {
    const doc = load();
    const renamed = setWaitName(
      doc,
      "c-mwdn0a03-lnv2c-keep",
      "LEFT CELL up yet?",
    );
    const timed = setStepTimeout(renamed, "c-mw0c4s2t-sfdhk-keep", 6);
    const keep = JSON.stringify(timed.auto);
    expect(keep).toContain('"label":"LEFT CELL up yet?"');
    expect(keep).toContain(
      '"id":"c-mw0c4s2t-sfdhk-keep","kind":"action","name":"PickFlower","timeoutS":6',
    );
    // Nothing else moved: undo the two edits and the file is the same.
    expect(
      keep
        .replace('"label":"LEFT CELL up yet?"', '"label":"LEFT CELL up?"')
        .replace('"timeoutS":6', '"timeoutS":8'),
    ).toBe(JSON.stringify(doc.auto));
  });
});
