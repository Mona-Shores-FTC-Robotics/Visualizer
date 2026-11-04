import { assert, assertEqual, assertText, test } from "../testing/harness";
import sampleText from "../auto/fixtures/hive-rush.pp?raw";
import { generateAutoJavaFromText } from "../codegen/auto/fromFile";
import {
  GENERATED_DIRS,
  baseName,
  generatedPathFor,
  ppPathProblem,
} from "../sim/biobuzz";
import { SPOTS_PATH, serializeTeamSpots } from "../team/teamSpots";
import {
  CHECKOUT_MARKER,
  MemoryFolder,
  isCheckout,
  listRepoAutos,
  listRepoDrafts,
  readRepoAuto,
  readRepoSpots,
  repoFileProblem,
  repoSaveFiles,
  saveToFolder,
} from "./repoFolder";

const SPOTS = serializeTeamSpots({ RIGHT_START: [135, 33, 180] });

/** A checkout as master has it: the spots, an Auto and its Java, and a file the save never touches. */
function checkout() {
  return new MemoryFolder("biobuzz", {
    [SPOTS_PATH]: SPOTS,
    "TeamCode/autos/r-solo.pp": "{}",
    "TeamCode/autos/README.md": "# Auto sources",
    [`${GENERATED_DIRS[0]}/RSoloAuto.java`]: "old",
    "TeamCode/sim-requests/r-solo.json": "{}",
  });
}

test("the folder save writes the two paths Save to GitHub commits, with the same bytes", () => {
  const plan = repoSaveFiles("hive-rush.pp", sampleText);
  assert(plan.ok, JSON.stringify(plan));

  // What Save to GitHub computes for the same file (SaveToGithubDialog.save).
  const ppPath = "TeamCode/autos/hive-rush.pp";
  assertEqual(ppPathProblem(ppPath), null);
  const exported = generateAutoJavaFromText(sampleText, baseName(ppPath));
  assert(exported.ok);
  const javaPath = generatedPathFor(ppPath, exported.fileName, []);

  assertEqual(plan.ppPath, ppPath);
  assertEqual(plan.javaPath, javaPath);
  assertEqual(
    javaPath,
    "TeamCode/src/main/java/org/firstinspires/ftc/teamcode/opmodes/auto/generated/HiveRushAuto.java",
  );
  assertEqual(Object.keys(plan.files), [ppPath, javaPath]);
  assertEqual(plan.files[ppPath], sampleText);
  assertText(plan.files[javaPath], exported.source);
  assertEqual(plan.className, "HiveRushAuto");
});

test("the Java carries the .pp's own SAVED stamp, as the GitHub save's does", () => {
  const data = JSON.parse(sampleText);
  data.timestamp = "2026-11-03T23:22:00.000Z";
  const text = JSON.stringify(data, null, 2);
  const plan = repoSaveFiles("hive-rush.pp", text);
  assert(plan.ok);
  const github = generateAutoJavaFromText(text, "hive-rush.pp");
  assert(github.ok);
  assertText(plan.files[plan.javaPath], github.source);
  assert(plan.files[plan.javaPath].includes('SAVED = "11-03|6:22PM"'));
});

test("a save touches exactly the .pp and its Java, nothing else in the checkout", async () => {
  const folder = checkout();
  const result = await saveToFolder(folder, "hive-rush.pp", sampleText);
  assert(result.ok);
  assertEqual(folder.writes, [
    "TeamCode/autos/hive-rush.pp",
    `${GENERATED_DIRS[0]}/HiveRushAuto.java`,
  ]);
  assertEqual(await folder.readText("TeamCode/autos/hive-rush.pp"), sampleText);
  // Untouched: the other Auto, its Java, the README, the simulation request and the spots.
  assertEqual(await folder.readText("TeamCode/autos/r-solo.pp"), "{}");
  assertEqual(
    await folder.readText(`${GENERATED_DIRS[0]}/RSoloAuto.java`),
    "old",
  );
  assertEqual(await folder.readText("TeamCode/sim-requests/r-solo.json"), "{}");
  assertEqual(await folder.readText(SPOTS_PATH), SPOTS);
});

test("saving over an Auto replaces its .pp and its Java in place", async () => {
  const folder = checkout();
  const data = JSON.parse(sampleText);
  data.auto.exportName = "r-solo";
  const result = await saveToFolder(folder, "r-solo.pp", JSON.stringify(data));
  assert(result.ok);
  assertEqual(result.javaPath, `${GENERATED_DIRS[0]}/RSoloAuto.java`);
  assert(
    (await folder.readText(result.javaPath))!.startsWith(
      "package org.firstinspires",
    ),
  );
  assertEqual(folder.writes.length, 2);
});

test("a project whose export is blocked writes nothing", async () => {
  const folder = checkout();
  const result = await saveToFolder(
    folder,
    "broken.pp",
    '{"startPoint":{"x":0,"y":0},"lines":[]}',
  );
  assert(!result.ok);
  assertEqual(folder.writes, []);
});

test("only a plain .pp name in TeamCode/autos is accepted", () => {
  assertEqual(repoFileProblem("r-solo.pp"), null);
  assertEqual(repoFileProblem("  r-solo.pp "), null);
  for (const bad of [
    "",
    "r-solo",
    "r-solo.java",
    "../x.pp",
    "a/b.pp",
    "sub\\x.pp",
    "r solo?.pp",
  ]) {
    assert(
      repoFileProblem(bad) !== null,
      `${JSON.stringify(bad)} should be refused`,
    );
  }
  // A draft goes in TeamCode/autos/drafts, and no other subfolder.
  assertEqual(repoFileProblem("drafts/r-solo-push.pp"), null);
  assert(repoFileProblem("partners/x.pp") !== null);
  // The same rule the GitHub save applies to the path.
  assertEqual(repoFileProblem("x.pp"), ppPathProblem("TeamCode/autos/x.pp"));
});

test("a folder is a checkout when it has TeamCode/autos/spots.json", async () => {
  assertEqual(CHECKOUT_MARKER, "TeamCode/autos/spots.json");
  assert(await isCheckout(checkout()));
  assert(
    !(await isCheckout(new MemoryFolder("Downloads", { "r-solo.pp": "{}" }))),
  );
  assert(
    !(await isCheckout(
      new MemoryFolder("TeamCode", { "autos/spots.json": SPOTS }),
    )),
    "the folder above TeamCode, not TeamCode itself",
  );
});

test("the checkout's Autos and spots open from the folder", async () => {
  const folder = checkout();
  assertEqual(await listRepoAutos(folder), ["r-solo.pp"]);
  assertEqual(await readRepoAuto(folder, "r-solo.pp"), "{}");
  assertEqual(await readRepoAuto(folder, "missing.pp"), null);
  assertEqual(await readRepoAuto(folder, "../build.gradle"), null);
  assertEqual(await readRepoSpots(folder), SPOTS);
  assertEqual(await listRepoAutos(new MemoryFolder("empty")), []);
});

test("a draft saves into TeamCode/autos/drafts, its Java into the generated folder, and is listed", async () => {
  const folder = checkout();
  const plan = await saveToFolder(folder, "drafts/hive-rush.pp", sampleText);
  assert(plan.ok, JSON.stringify(plan));
  assertEqual(plan.ppPath, "TeamCode/autos/drafts/hive-rush.pp");
  assert(plan.javaPath.startsWith(`${GENERATED_DIRS[0]}/`), plan.javaPath);
  assertEqual(await listRepoDrafts(folder), ["drafts/hive-rush.pp"]);
  assertEqual(await listRepoAutos(folder), ["r-solo.pp"]);
  assertEqual(await listRepoDrafts(new MemoryFolder("empty")), []);
});
