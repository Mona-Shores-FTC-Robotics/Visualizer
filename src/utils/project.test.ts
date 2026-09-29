import { assert, assertEqual, test } from "../lib/testing/harness";
import sampleText from "../lib/auto/fixtures/hive-rush.pp?raw";
import { buildOtherFileProject, PROJECT_VERSION } from "./project";
import type { Path, StartPose } from "../types";

const onScreen = {
  startPoint: { x: 10, y: 20, headingDeg: 90 } as unknown as StartPose,
  lines: [{ id: "edited-line" }] as unknown as Path[],
  shapes: [],
  sequence: [],
};

test("saving a second file keeps its own Auto, field points and settings", () => {
  const stored = JSON.parse(sampleText);
  const saved = buildOtherFileProject(sampleText, onScreen);
  assertEqual(saved.auto, stored.auto);
  assertEqual(saved.fieldPoints, stored.fieldPoints);
  assertEqual(saved.settings, stored.settings);
  assertEqual(saved.startPoint, onScreen.startPoint);
  assertEqual(saved.lines, onScreen.lines);
  assertEqual(saved.version, PROJECT_VERSION);
});

test("saving a second file never writes the main project's Auto into it", () => {
  // A file without an Auto stays without one, whatever the main file holds.
  const plain = JSON.stringify({ startPoint: { x: 1, y: 2 }, lines: [] });
  const saved = buildOtherFileProject(plain, onScreen);
  assert(!("auto" in saved), "no auto section");
  assert(!("fieldPoints" in saved), "no field points");
  assert(!("activePaths" in saved), "no active-path list");
});

test("settings are replaced only when the caller has the file's own", () => {
  const settings = { rWidth: 18 } as never;
  assertEqual(
    buildOtherFileProject(sampleText, { ...onScreen, settings }).settings,
    settings,
  );
});

test("a missing start point keeps the file's", () => {
  const saved = buildOtherFileProject(sampleText, {
    ...onScreen,
    startPoint: null,
  });
  assertEqual(saved.startPoint, JSON.parse(sampleText).startPoint);
});

test("an unreadable file is rewritten from what is on screen", () => {
  for (const text of [null, "", "not json", "[1,2]"]) {
    const saved = buildOtherFileProject(text, onScreen);
    assertEqual(saved.lines, onScreen.lines);
    assert(!("auto" in saved), `no auto for ${JSON.stringify(text)}`);
  }
});
