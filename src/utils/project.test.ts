import { assert, assertEqual, test } from "../lib/testing/harness";
import sampleText from "../lib/auto/fixtures/hive-rush.pp?raw";
import {
  buildOtherFileProject,
  fileSettings,
  PROJECT_VERSION,
  settingsForFile,
} from "./project";
import { normalizePaths, normalizeStartPose } from "./normalize";
import { DEFAULT_SETTINGS } from "../config/defaults";
import { normalizeAuto } from "../lib/auto/normalize";
import { generateAutoJava } from "../lib/codegen/auto/javaAuto";
import { generateAutoJavaFromText } from "../lib/codegen/auto/fromFile";
import type { Path, Settings, StartPose } from "../types";

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

test("saving a second file keeps its laid-out links in its Auto", () => {
  const stored = JSON.parse(sampleText);
  const saved = buildOtherFileProject(sampleText, { ...onScreen, linkPaths: ["link-1"] });
  assertEqual((saved.auto as { linkPaths: string[] }).linkPaths, ["link-1"]);
  assertEqual({ ...(saved.auto as object), linkPaths: undefined }, { ...stored.auto, linkPaths: undefined });
  const none = buildOtherFileProject(JSON.stringify(saved), { ...onScreen, linkPaths: [] });
  assert(!("linkPaths" in (none.auto as object)), "no links, no list");
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

test("a file's own robot size and motion model are what the app uses", () => {
  const mine = {
    ...DEFAULT_SETTINGS,
    maxVelocity: 99,
    rWidth: 12,
    leftPanelWidth: 400,
    onionColor: "#fff",
    fieldMap: "custom",
  } as Settings;
  const inFile = {
    maxVelocity: 60,
    rWidth: 16,
    leftPanelWidth: 999,
    fieldMap: "x.webp",
  };
  const used = settingsForFile(mine, inFile);
  assertEqual(used.maxVelocity, 60);
  assertEqual(used.rWidth, 16);
  // Settings the file lacks come from the defaults, not the viewer.
  assertEqual(used.maxAcceleration, DEFAULT_SETTINGS.maxAcceleration);
  // Preferences and the field image stay the viewer's.
  assertEqual(used.leftPanelWidth, 400);
  assertEqual(used.onionColor, "#fff");
  assertEqual(used.fieldMap, "custom");
});

test("only numbers are taken from a file's settings", () => {
  assertEqual(fileSettings({ maxVelocity: "fast", rWidth: NaN, rHeight: 18 }), {
    rHeight: 18,
  });
  assertEqual(fileSettings(null), {});
});

test("the app and the command line export the same Java whoever opens the file", () => {
  const someonesSettings = {
    ...DEFAULT_SETTINGS,
    maxVelocity: 99,
    maxAcceleration: 99,
    xVelocity: 20,
  } as Settings;
  const withSettings = JSON.parse(sampleText);
  const { settings: _dropped, ...withoutSettings } = withSettings;
  for (const data of [withSettings, withoutSettings]) {
    const text = JSON.stringify(data);
    const cli = generateAutoJavaFromText(text, "hive-rush.pp");
    const { auto } = normalizeAuto(data.auto);
    const app = generateAutoJava({
      auto: auto!,
      startPoint: normalizeStartPose(data.startPoint),
      lines: normalizePaths(data.lines),
      shapes: data.shapes,
      settings: settingsForFile(someonesSettings, data.settings),
      sourceFileName: "hive-rush.pp",
    });
    assert(cli.ok && app.ok, "both export");
    assertEqual(app.ok && app.source, cli.ok && cli.source);
  }
});
