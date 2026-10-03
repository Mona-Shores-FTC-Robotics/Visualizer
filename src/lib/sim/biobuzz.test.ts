import { assert, assertEqual, test } from "../testing/harness";
import {
  GENERATED_DIRS,
  generatedPathFor,
  ppPathProblem,
  protectedBranch,
  simRequestText,
  simResultPath,
  simSpec,
  suggestPpPath,
  tally,
  type SimRun,
} from "./biobuzz";

test("Save to GitHub only writes .pp files in the two Auto folders", () => {
  assertEqual(ppPathProblem("TeamCode/autos/hive-rush.pp"), null);
  assertEqual(
    ppPathProblem(
      "TeamCode/src/test/resources/auto-builder/partners/partner-leave-park.pp",
    ),
    null,
  );
  for (const bad of [
    "TeamCode/autos/hive-rush.java",
    "TeamCode/autos/../build.gradle.pp",
    "TeamCode/autos//x.pp",
    "/etc/x.pp",
    "C:/x.pp",
    "TeamCode\\autos\\x.pp",
    "sim-review/2026-10-01-rerun/x.pp",
    "TeamCode/autosx/x.pp",
  ]) {
    assert(ppPathProblem(bad) !== null, `${bad} should be refused`);
  }
});

test("the Java goes where its class already is, else by the .pp's folder", () => {
  const robot = `${GENERATED_DIRS[0]}/HiveRushAuto.java`;
  const sim = `${GENERATED_DIRS[1]}/Recycle5LeftAuto.java`;
  assertEqual(
    generatedPathFor("TeamCode/autos/hive-rush.pp", "HiveRushAuto.java", []),
    robot,
  );
  assertEqual(
    generatedPathFor(
      "TeamCode/src/test/resources/auto-builder/r.pp",
      "Recycle5LeftAuto.java",
      [],
    ),
    sim,
  );
  // An Auto drawn in auto-builder but already promoted to the robot stays there.
  assertEqual(
    generatedPathFor(
      "TeamCode/src/test/resources/auto-builder/hive-rush.pp",
      "HiveRushAuto.java",
      [robot],
    ),
    robot,
  );
});

test("builds the study spec", () => {
  assertEqual(simSpec("Recycle5LeftAuto", null, 50), "Recycle5LeftAuto@50");
  assertEqual(
    simSpec("DuoLzRightAuto", "DuoLzLeftAuto", 45),
    "DuoLzRightAuto,DuoLzLeftAuto@45",
  );
});

test("an open file maps to the .pp it came from, else the one with its name, else nothing", () => {
  const known = [
    "TeamCode/autos/hive-rush.pp",
    "TeamCode/src/test/resources/auto-builder/hive-rush.pp",
    "TeamCode/src/test/resources/auto-builder/lean-left.pp",
  ];
  assertEqual(suggestPpPath("hive-rush.pp", known[1], known), known[1]);
  // Opened from a link: saved back to that path, even where it is new.
  assertEqual(
    suggestPpPath("x.pp", "TeamCode/autos/x.pp", known),
    "TeamCode/autos/x.pp",
  );
  assertEqual(suggestPpPath("lean-left.pp", null, known), known[2]);
  // Two with that name, a name biobuzz does not have, or no file at all (the blank
  // project): nothing, so a new file is only ever made on purpose.
  assertEqual(suggestPpPath("hive-rush", null, known), "");
  assertEqual(suggestPpPath("new-idea.pp", null, known), "");
  assertEqual(suggestPpPath("", null, known), "");
});

function run(
  seed: number,
  points: number,
  tipsAt: number[],
  park = true,
  crossedAt: number | null = null,
): SimRun {
  return {
    seed,
    log: `seed-${seed}.wpilog`,
    points,
    autoTips: tipsAt.filter((t) => t < 38).length,
    tipsAt,
    launched: 4,
    scored: 3,
    cellLoad: 0.5,
    held: 1,
    robotsCollidedAt: null,
    robots: [
      {
        auto: "x",
        launched: 4,
        finishedAt: 29,
        leave: true,
        park,
        illegalStart: null,
        crossedAt,
        hitHiveAt: null,
        hitFlowerAt: null,
        timeline: [],
      },
    ],
    summary: "",
  };
}

test("the tally counts TIPs that count for AUTO and picks the median run", () => {
  const t = tally([
    run(1, 68, [3, 12, 27]),
    run(2, 43, [3, 15], false, 9.5),
    run(3, 48, [4, 16]),
    run(4, 48, [3, 14, 39]),
  ]);
  assertEqual(t.runs, 4);
  assertEqual(t.meanPoints, (68 + 43 + 48 + 48) / 4);
  assertEqual(t.tips.length, 3);
  assertEqual(t.tips[0].count, 4);
  assertEqual(t.tips[1].count, 4);
  assertEqual(t.tips[1].meanAt, (12 + 15 + 16 + 14) / 4);
  // TIP 3 at 39 s is after the transition: it does not count.
  assertEqual(t.tips[2].count, 1);
  assertEqual(t.parked, 3);
  assertEqual(t.withProblems, 1);
  // Sorted 43, 48 (seed 3), 48 (seed 4), 68: the lower middle.
  assertEqual(t.typicalSeed, 3);
  assertEqual(tally([]).typicalSeed, null);
});

test("the request names the .pp, the run and what to stamp on each log", () => {
  const path = "TeamCode/src/test/resources/auto-builder/recycle5-left.pp";
  const text = simRequestText(
    {
      ppPath: path,
      spec: "Recycle5LeftAuto,Recycle5RightAuto@50",
      design: "two spring hoods, full-width intake",
      partnerDesign: null,
      partnerSpeed: null,
      seeds: 3,
      alliance: "RED",
      savedBy: "someone",
    },
    new Date("2026-10-03T12:00:00Z"),
  );
  const request = JSON.parse(text);
  assertEqual(request.seeds, [1, 2, 3]);
  assertEqual(request.pp, path);
  assertEqual(request.metadata, {
    AutoSource: "recycle5-left.pp",
    SavedBy: "someone",
    SavedAt: "2026-10-03T12:00:00.000Z",
  });
  assert(text.endsWith("}\n"), "ends with a newline");
  assertEqual(
    simResultPath(path, "abc123"),
    "recycle5-left/abc123/result.json",
  );
  assert(
    protectedBranch("master") &&
      protectedBranch("main") &&
      !protectedBranch("claude/simulator"),
    "not master",
  );
});
