import { assert, assertEqual, test } from "../lib/testing/harness";
import sampleText from "../lib/auto/fixtures/hive-rush.pp?raw";
import { DEFAULT_SETTINGS } from "../config/defaults";
import { parseProject, robotConfigOf, serializeProject } from "../io";
import { serializeAuto } from "../lib/auto/normalize";
import { generateAutoJava } from "../lib/codegen/auto/javaAuto";
import { generateAutoJavaFromText } from "../lib/codegen/auto/fromFile";
import type { RobotConfig } from "../types";

const defaultRobot = robotConfigOf(DEFAULT_SETTINGS);

function load(text: string, robot: RobotConfig = defaultRobot) {
  const result = parseProject(text, robot);
  if (!result.ok) throw new Error(result.error);
  return result.doc;
}

test("a file's Auto survives load and save, as an overlay's does", () => {
  const doc = load(sampleText);
  const saved = JSON.parse(serializeProject(doc));
  assertEqual(saved.auto, serializeAuto(doc.auto!));
  // Saving what was read back changes nothing.
  assertEqual(serializeProject(load(JSON.stringify(saved))), serializeProject(doc));
});

test("a file without an Auto is saved without one", () => {
  const plain = JSON.stringify({ startPoint: { x: 1, y: 2 }, lines: [] });
  const saved = JSON.parse(serializeProject(load(plain)));
  assert(!("auto" in saved), "no auto section");
});

test("a 1.5 file's settings become its robot, maxVelocity included", () => {
  const stored = JSON.parse(sampleText);
  const doc = load(sampleText);
  assertEqual(doc.robot.forwardVelocity, stored.settings.xVelocity);
  assertEqual(doc.robot.strafeVelocity, stored.settings.yVelocity);
  assertEqual(doc.robot.maxVelocity, stored.settings.maxVelocity);
  assertEqual(doc.robot.maxAcceleration, stored.settings.maxAcceleration);
});

test("the app and the command line export the same Java whoever opens the file", () => {
  // Someone else's robot fills in only what the file does not record.
  const someonesRobot = {
    ...defaultRobot,
    maxVelocity: 99,
    maxAcceleration: 99,
    forwardVelocity: 20,
  };
  const withSettings = JSON.parse(sampleText);
  const { settings: _dropped, ...withoutSettings } = withSettings;
  for (const data of [withSettings, withoutSettings]) {
    const text = JSON.stringify(data);
    const cli = generateAutoJavaFromText(text, "hive-rush.pp");
    const doc = load(text, data.settings ? someonesRobot : defaultRobot);
    const app = generateAutoJava({
      auto: doc.auto!,
      startPoint: doc.startPoint,
      lines: doc.lines,
      shapes: doc.shapes,
      settings: { ...DEFAULT_SETTINGS, ...doc.robot },
      sourceFileName: "hive-rush.pp",
    });
    assert(cli.ok && app.ok, "both export");
    assertEqual(app.ok && app.source, cli.ok && cli.source);
  }
});
