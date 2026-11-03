import { assert, assertEqual, test } from "../testing/harness";
import {
  GENERATED_DIRS,
  SAVE_DESIGN,
  generatedPathFor,
  laneBranch,
  parseSimRequest,
  partnerWords,
  ppPathProblem,
  protectedBranch,
  runLabel,
  simLatestPath,
  simLogPath,
  simPlanSentence,
  simRequestPath,
  simRequestText,
  simResultPath,
  simRunFolder,
  simRuns,
  simSpec,
  suggestPpPath,
  tally,
  type SimResult,
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

test("the spec is our Auto alone, at the simulator's default speed", () => {
  assertEqual(simSpec("Recycle5LeftAuto"), "Recycle5LeftAuto");
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
  // The best: the most points.
  assertEqual(t.best?.seed, 1);
  assertEqual(tally([]).best, null);
});

test("on equal points the best run is the one whose last TIP came first", () => {
  // Seeds 3 and 4 both score 48; 4's TIP at 39 s is after AUTO and does not count.
  const t = tally([
    run(3, 48, [4, 16]),
    run(4, 48, [3, 14, 39]),
    run(5, 48, [3, 14]),
  ]);
  assertEqual(t.best?.seed, 4);
  assertEqual(tally([run(7, 20, []), run(6, 20, [])]).best?.seed, 6);
});

test("the request names the .pp, the run, the one robot, ten seeds, RED and what to stamp on each log", () => {
  const path = "TeamCode/autos/r-solo.pp";
  const text = simRequestText(
    { ppPath: path, spec: "RSoloAuto", savedBy: "someone", existing: null },
    new Date("2026-10-03T12:00:00Z"),
  );
  const request = JSON.parse(text);
  assertEqual(request, {
    pp: path,
    spec: "RSoloAuto",
    design: "real robot, turret locked forward, POLLEN only",
    seeds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    alliance: "RED",
    metadata: {
      AutoSource: "r-solo.pp",
      SavedBy: "someone",
      SavedAt: "2026-10-03T12:00:00.000Z",
    },
  });
  assertEqual(request.design, SAVE_DESIGN);
  assert(text.endsWith("}\n"), "ends with a newline");
  assertEqual(simResultPath(path, "abc123"), "r-solo/abc123/result.json");
  assert(
    protectedBranch("master") &&
      protectedBranch("main") &&
      !protectedBranch("claude/simulator"),
    "not master",
  );
});

test("a save keeps biobuzz's runs and other fields, and writes only the Auto's own", () => {
  const existing = parseSimRequest(
    JSON.stringify({
      pp: "TeamCode/autos/r-solo.pp",
      spec: "RSoloAuto@50",
      design: "real robot",
      partnerDesign: null,
      partnerSpeed: null,
      seeds: [1, 2, 3],
      alliance: "BLUE",
      title: "R solo",
      runs: [
        { partner: null },
        { partner: "PartnerLParksAuto", label: "L just parks" },
        { partner: "PartnerLStillAuto" },
      ],
      metadata: { AutoSource: "r-solo.pp", SavedBy: "before" },
    }),
  );
  const request = JSON.parse(
    simRequestText(
      {
        ppPath: "TeamCode/autos/r-solo.pp",
        spec: "RSoloAuto",
        savedBy: "someone",
        existing,
      },
      new Date("2026-11-03T12:00:00Z"),
    ),
  );
  // The Auto's own fields are the save's, whatever the file had.
  assertEqual(request.spec, "RSoloAuto");
  assertEqual(request.design, SAVE_DESIGN);
  assertEqual(request.seeds.length, 10);
  assertEqual(request.alliance, "RED");
  assertEqual(request.metadata.SavedBy, "someone");
  // biobuzz's fields stay; the old per-save partner choice goes.
  assertEqual(request.runs, existing!.runs);
  assertEqual(request.title, "R solo");
  assert(!("partnerDesign" in request), "partnerDesign is gone");
  assert(!("partnerSpeed" in request), "partnerSpeed is gone");
  assertEqual(Object.keys(request), [
    "pp",
    "spec",
    "design",
    "seeds",
    "alliance",
    "metadata",
    "title",
    "runs",
  ]);
  assertEqual(parseSimRequest(null), null);
  assertEqual(parseSimRequest("not json"), null);
  assertEqual(parseSimRequest("[1]"), null);
});

test("the runs: alone when biobuzz lists none, else each partner once, in words", () => {
  assertEqual(simRuns(null), [{ partner: null }]);
  assertEqual(simRuns({ pp: "x" }), [{ partner: null }]);
  assertEqual(simRuns({ runs: "nonsense" }), [{ partner: null }]);
  const runs = simRuns({
    runs: [
      { partner: null },
      { partner: "PartnerLParksAuto", label: "L just parks" },
      { partner: "PartnerLStillAuto" },
      { partner: "PartnerLStillAuto" },
      { partner: "not a class" },
      { partner: 7 },
      null,
    ],
  });
  assertEqual(runs, [
    { partner: null },
    { partner: "PartnerLParksAuto", label: "L just parks" },
    { partner: "PartnerLStillAuto" },
  ]);
  assertEqual(runs.map(runLabel), [
    "alone",
    "with L just parks",
    "with L Still",
  ]);
  assertEqual(
    simPlanSentence(runs),
    "Will simulate: alone, with L just parks, with L Still",
  );
  assertEqual(partnerWords("PartnerLDoesNothingAuto"), "L Does Nothing");
  assertEqual(partnerWords("PartnerRPreloadTipAuto"), "R Preload Tip");
  assertEqual(partnerWords("PartnerAuto"), "PartnerAuto");
});

test("a run's results: the Auto's folder alone, a partners subfolder with one", () => {
  const pp = "TeamCode/autos/r-solo.pp";
  assertEqual(simRunFolder(pp), "r-solo");
  assertEqual(
    simRunFolder(pp, "PartnerLStillAuto"),
    "r-solo/partners/PartnerLStillAuto",
  );
  assertEqual(simLatestPath(pp), "r-solo/latest.json");
  assertEqual(
    simLatestPath(pp, "PartnerLStillAuto"),
    "r-solo/partners/PartnerLStillAuto/latest.json",
  );
  assertEqual(
    simResultPath(pp, "abc", "PartnerLStillAuto"),
    "r-solo/partners/PartnerLStillAuto/abc/result.json",
  );
  const result = { auto: "r-solo", commit: "abc" } as SimResult;
  assertEqual(simLogPath(result, "x.wpilog"), "r-solo/abc/x.wpilog");
  assertEqual(
    simLogPath(
      { ...result, folder: "r-solo/partners/PartnerLStillAuto" },
      "x.wpilog",
    ),
    "r-solo/partners/PartnerLStillAuto/abc/x.wpilog",
  );
});

test("the fast lane: one branch and one simulation request per Auto", () => {
  assertEqual(
    laneBranch("TeamCode/autos/r-quals-locked.pp"),
    "auto/r-quals-locked",
  );
  assertEqual(laneBranch("TeamCode/autos/my auto (2).pp"), "auto/my-auto-2-");
  assertEqual(
    simRequestPath("TeamCode/autos/r-quals-locked.pp", true),
    "TeamCode/sim-requests/r-quals-locked.json",
  );
  assertEqual(
    simRequestPath("TeamCode/autos/r-quals-locked.pp", false),
    "TeamCode/sim-request.json",
  );
});
