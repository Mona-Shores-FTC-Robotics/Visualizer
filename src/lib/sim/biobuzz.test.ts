import { assert, assertEqual, test } from "../testing/harness";
import {
  generatedDirFor,
  GENERATED_DIRS,
  ppPathProblem,
  simSpec,
  sourceOf,
  suggestPpPath,
  tally,
  type SimRun,
} from "./biobuzz";

test("the bridge only touches .pp files in the two Auto folders", () => {
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

test("a new Auto's class goes to the robot only from TeamCode/autos", () => {
  assertEqual(
    generatedDirFor("TeamCode/autos/hive-rush.pp"),
    GENERATED_DIRS[0],
  );
  assertEqual(
    generatedDirFor(
      "TeamCode/src/test/resources/auto-builder/recycle5-left.pp",
    ),
    GENERATED_DIRS[1],
  );
});

test("reads a generated class's SOURCE and builds the study spec", () => {
  assertEqual(
    sourceOf('    public static final String SOURCE = "recycle5-left.pp";\n'),
    "recycle5-left.pp",
  );
  assertEqual(sourceOf("public final class X {}"), null);
  assertEqual(simSpec("Recycle5LeftAuto", null, 50), "Recycle5LeftAuto@50");
  assertEqual(
    simSpec("DuoLzRightAuto", "DuoLzLeftAuto", 45),
    "DuoLzRightAuto,DuoLzLeftAuto@45",
  );
});

test("an open file maps to the .pp it came from, else the one with its name", () => {
  const known = [
    "TeamCode/autos/hive-rush.pp",
    "TeamCode/src/test/resources/auto-builder/hive-rush.pp",
    "TeamCode/src/test/resources/auto-builder/lean-left.pp",
  ];
  assertEqual(suggestPpPath("hive-rush.pp", known[1], known), known[1]);
  assertEqual(suggestPpPath("lean-left.pp", null, known), known[2]);
  // Two with that name: a new one, rather than a guess.
  assertEqual(
    suggestPpPath("hive-rush", null, known),
    "TeamCode/src/test/resources/auto-builder/hive-rush.pp",
  );
  assertEqual(
    suggestPpPath("new-idea.pp", null, known),
    "TeamCode/src/test/resources/auto-builder/new-idea.pp",
  );
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
