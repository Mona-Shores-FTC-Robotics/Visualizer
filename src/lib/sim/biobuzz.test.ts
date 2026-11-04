import { assert, assertEqual, test } from "../testing/harness";
import {
  DEFAULT_SIM_DESIGN,
  GENERATED_DIRS,
  entryLogs,
  generatedPathFor,
  laneBranch,
  parseSimRequest,
  partnerWords,
  ppPathProblem,
  protectedBranch,
  simEntryFolder,
  simLatestPath,
  simLogPath,
  simPlan,
  simPlanSentence,
  simRequestPath,
  simRequestText,
  simResultPath,
  simSpec,
  suggestPpPath,
  tally,
  tallyEntry,
  type SimEntry,
  type SimEntryRow,
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
  // A Team Autos copy goes back to the file it came from, a draft into drafts/.
  assertEqual(
    suggestPpPath("biobuzz-drafts-r-solo-push.pp", null, known),
    "TeamCode/autos/drafts/r-solo-push.pp",
  );
  assertEqual(suggestPpPath("biobuzz-hive-rush.pp", null, known), known[0]);
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

test("a request with none yet names the .pp, the run, the real robot, ten seeds, RED and what to stamp on each log", () => {
  const path = "TeamCode/autos/r-solo.pp";
  const text = simRequestText(
    { ppPath: path, spec: "RSoloAuto", savedBy: "someone", existing: null },
    new Date("2026-10-03T12:00:00Z"),
  );
  const request = JSON.parse(text);
  assertEqual(request, {
    pp: path,
    spec: "RSoloAuto",
    design: "real robot",
    seeds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    alliance: "RED",
    metadata: {
      AutoSource: "r-solo.pp",
      SavedBy: "someone",
      SavedAt: "2026-10-03T12:00:00.000Z",
    },
  });
  assertEqual(request.design, DEFAULT_SIM_DESIGN);
  assert(text.endsWith("}\n"), "ends with a newline");
  assertEqual(simResultPath(path, "abc123"), "r-solo/abc123/result.json");
  assert(
    protectedBranch("master") &&
      protectedBranch("main") &&
      !protectedBranch("claude/simulator"),
    "not master",
  );
});

const CURATED = {
  pp: "TeamCode/autos/l-partner.pp",
  spec: "LPartnerAuto",
  design: "real robot, turret locked forward, POLLEN only",
  seeds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  partnerSeeds: [1, 2, 3, 4, 5],
  alliance: "BLUE",
  partners: [
    { name: "lands at 2 s", partner: "PartnerRLaunchParkAuto", timing: { launchS: 0.3 } },
    {
      name: "lands at 5 s",
      partner: "PartnerRLaunchParkAuto",
      timing: { startDelayS: 1.5, launchS: 0.8 },
    },
  ],
  title: "L partner",
  partnerDesign: null,
  metadata: { AutoSource: "l-partner.pp", SavedBy: "before" },
};

test("a save carries the curation (partners, partnerSeeds) and every other key through unchanged", () => {
  const existing = parseSimRequest(JSON.stringify(CURATED));
  const request = JSON.parse(
    simRequestText(
      {
        ppPath: "TeamCode/autos/l-partner.pp",
        spec: "LPartnerAuto",
        savedBy: "someone",
        existing,
      },
      new Date("2026-11-03T12:00:00Z"),
    ),
  );
  // What the save owns: which Auto, and the stamp on each log.
  assertEqual(request.pp, "TeamCode/autos/l-partner.pp");
  assertEqual(request.spec, "LPartnerAuto");
  assertEqual(request.metadata, {
    AutoSource: "l-partner.pp",
    SavedBy: "someone",
    SavedAt: "2026-11-03T12:00:00.000Z",
  });
  // The curation, and the robot the request names, are the request's.
  assertEqual(request.partners, CURATED.partners);
  assertEqual(request.partnerSeeds, [1, 2, 3, 4, 5]);
  assertEqual(request.design, "real robot, turret locked forward, POLLEN only");
  assertEqual(request.alliance, "BLUE");
  assertEqual(request.title, "L partner");
  assertEqual(request.partnerDesign, null);
  // And in the file's own order, so a save is a small diff.
  assertEqual(Object.keys(request), Object.keys(CURATED));
  assertEqual(parseSimRequest(null), null);
  assertEqual(parseSimRequest("not json"), null);
  assertEqual(parseSimRequest("[1]"), null);
});

test("saving twice in a row leaves the curation as it was", () => {
  const options = {
    ppPath: "TeamCode/autos/l-partner.pp",
    spec: "LPartnerAuto",
    savedBy: "someone",
  };
  const now = new Date("2026-11-03T12:00:00Z");
  const first = simRequestText(
    { ...options, existing: parseSimRequest(JSON.stringify(CURATED)) },
    now,
  );
  const second = simRequestText(
    { ...options, existing: parseSimRequest(first) },
    now,
  );
  assertEqual(second, first);
});

test("a request with no design, seeds or alliance gets the defaults, after what it has", () => {
  const request = JSON.parse(
    simRequestText({
      ppPath: "TeamCode/autos/x.pp",
      spec: "XAuto",
      savedBy: "s",
      existing: { title: "X", partners: [] },
    }),
  );
  assertEqual(Object.keys(request), [
    "title",
    "partners",
    "pp",
    "spec",
    "design",
    "seeds",
    "alliance",
    "metadata",
  ]);
  assertEqual(request.design, "real robot");
});

test("the plan: the Auto alone, then each curated partner entry, in words", () => {
  assertEqual(simPlan(null), [{ partner: null, name: "alone" }]);
  assertEqual(simPlan({ partners: "nonsense" }), [
    { partner: null, name: "alone" },
  ]);
  const plan = simPlan(parseSimRequest(JSON.stringify(CURATED)));
  assertEqual(plan, [
    { partner: null, name: "alone" },
    { partner: "PartnerRLaunchParkAuto", name: "lands at 2 s" },
    { partner: "PartnerRLaunchParkAuto", name: "lands at 5 s" },
  ]);
  const odd = simPlan({
    partners: [
      { partner: "PartnerLStillAuto" },
      { partner: "not a class" },
      { partner: 7 },
      null,
    ],
  });
  assertEqual(odd, [
    { partner: null, name: "alone" },
    { partner: "PartnerLStillAuto", name: "L Still" },
  ]);
  assertEqual(
    simPlanSentence(plan),
    "Will simulate: alone; R Launch Park, lands at 2 s; R Launch Park, lands at 5 s",
  );
  assertEqual(partnerWords("PartnerLDoesNothingAuto"), "L Does Nothing");
  assertEqual(partnerWords("PartnerRPreloadTipAuto"), "R Preload Tip");
  assertEqual(partnerWords("PartnerAuto"), "PartnerAuto");
});

function entryRow(
  seed: number,
  points: number,
  over: Partial<SimEntryRow> = {},
): SimEntryRow {
  return {
    seed,
    points,
    launched: 4,
    partnerLaunched: 4,
    tipsAt: [8],
    autoTips: 1,
    wait: { label: "w", fired: true, outcome: "CellUp", after: 5, at: 9 },
    robotsCollidedAt: null,
    parked: true,
    partnerParked: true,
    ...over,
  };
}

const ENTRY: SimEntry = {
  name: "lands at 12 s",
  folder: "partner-r-launch-park/lands-at-12-s",
  partner: "PartnerRLaunchParkAuto",
  partnerSource: "partner-r-launch-park.pp",
  timing: { startDelayS: 8 },
  meanPoints: 20,
  bestSeed: 2,
  typicalSeed: 1,
  logs: { "1": "a.wpilog", "2": "b.wpilog" },
  rows: [],
};

test("an entry's seeds taken together: points, TIPs, the wait, collisions, parking", () => {
  const t = tallyEntry([
    entryRow(1, 30),
    entryRow(2, 10, {
      tipsAt: [],
      autoTips: 0,
      wait: { label: "w", fired: false, outcome: "timed out", after: 7, at: 7 },
      robotsCollidedAt: 11.5,
      parked: false,
      partnerParked: false,
    }),
    entryRow(3, 20, { wait: null, robotsCollidedAt: 9, tipsAt: [8, 40], autoTips: 1 }),
  ]);
  assertEqual(t.runs, 3);
  assertEqual(t.meanPoints, 20);
  assertEqual([t.minPoints, t.maxPoints], [10, 30]);
  // TIP 2 at 40 s is after AUTO: it does not count.
  assertEqual(t.tips, [{ count: 2, meanAt: 8 }]);
  assertEqual([t.parked, t.partnerParked], [2, 2]);
  assertEqual([t.waitFired, t.waitTimedOut], [1, 1]);
  assertEqual(t.meanWaitAfter, 6);
  assertEqual([t.collisions, t.firstCollisionAt], [2, 9]);
  assertEqual(tallyEntry([]).runs, 0);
  assertEqual(tallyEntry([]).meanWaitAfter, null);
});

test("an entry's results and logs sit in its folder; the Auto alone's in the commit's", () => {
  const pp = "TeamCode/autos/l-partner.pp";
  assertEqual(simResultPath(pp, "abc"), "l-partner/abc/result.json");
  assertEqual(simLatestPath(pp), "l-partner/latest.json");
  const result = {
    auto: "l-partner",
    commit: "abc",
    bestSeed: 4,
    typicalSeed: 5,
    logs: { "4": "alone.wpilog" },
  } as unknown as SimResult;
  assertEqual(simLogPath(result, "x.wpilog"), "l-partner/abc/x.wpilog");
  assertEqual(
    simEntryFolder(result, ENTRY),
    "l-partner/abc/partner-r-launch-park/lands-at-12-s",
  );
  assertEqual(
    simLogPath(result, "b.wpilog", ENTRY),
    "l-partner/abc/partner-r-launch-park/lands-at-12-s/b.wpilog",
  );
  // The Auto alone: its entry has no folder and no seeds of its own, so the result's are used.
  const alone = { name: "alone", folder: "", partner: null, meanPoints: 1, rows: [] };
  assertEqual(simEntryFolder(result, alone), "l-partner/abc");
  assertEqual(entryLogs(result, alone), {
    best: 4,
    typical: 5,
    logs: { "4": "alone.wpilog" },
  });
  assertEqual(entryLogs(result, ENTRY), {
    best: 2,
    typical: 1,
    logs: ENTRY.logs ?? {},
  });
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
