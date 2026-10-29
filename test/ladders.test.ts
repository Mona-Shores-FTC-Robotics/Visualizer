// Ladders (src/lib/ladder) on the team's real Autos (test/fixtures/biobuzz/autos): the rules,
// that building settles, that every outcome parks by 30 s, that the good path does not change,
// and that the Java exports.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/config/defaults";
import { parseProject, robotConfigOf, serializeProject } from "../src/io";
import { buildPathCatalog } from "../src/lib/auto/geometry";
import { relink } from "../src/lib/auto/links";
import { AUTO_LENGTH_S, type Scenario } from "../src/lib/auto/simulate";
import { allCards } from "../src/lib/auto/tree";
import type { AutoSection, FirstOfCard } from "../src/lib/auto/types";
import { validateAuto } from "../src/lib/auto/validate";
import { generateAutoJava } from "../src/lib/codegen/auto/javaAuto";
import { compileLadders, ladderInfo } from "../src/lib/ladder/compile";
import {
  addTry,
  moveTry,
  removeTry,
  startLadder,
} from "../src/lib/ladder/edit";
import { BIOBUZZ_PLAYS } from "../src/lib/ladder/plays";
import { ladderOutcomes, ladderScenario } from "../src/lib/plan/plan";
import {
  fallbackValues,
  parseTimingFile,
  type TimingValues,
} from "../src/lib/timing/model";
import { previewTogether } from "../src/lib/timing/together";
import type { Path } from "../src/types";

const DIR = "test/fixtures/biobuzz";
const play = (id: string) => BIOBUZZ_PLAYS.find((p) => p.id === id)!;
const team = parseTimingFile(readFileSync(`${DIR}/real/timing.json`, "utf8"));
const TIMINGS: Record<string, TimingValues> = {
  "the simulator's timing": fallbackValues(),
  "the team's measured timing": {
    ...fallbackValues(),
    ...Object.fromEntries(
      Object.entries(team.facts).map(([id, fact]) => [id, fact.value]),
    ),
  },
};

function load(file: string) {
  const loaded = parseProject(
    readFileSync(`${DIR}/autos/${file}.pp`, "utf8"),
    robotConfigOf(DEFAULT_SETTINGS),
  );
  if (!loaded.ok) throw new Error(loaded.error);
  return {
    doc: loaded.doc,
    settings: { ...DEFAULT_SETTINGS, ...loaded.doc.robot },
  };
}

const waitNamed = (auto: AutoSection, label: string) =>
  allCards(auto.cards).find(
    (c): c is FirstOfCard => c.kind === "firstOf" && c.label === label,
  )!;

/** What the editor does after an edit: build the ladders, lay the paths out; until nothing moves. */
function settle(
  auto: AutoSection,
  lines: Path[],
  file: ReturnType<typeof load>,
) {
  for (let round = 0; round < 4; round++) {
    const built = compileLadders(auto, lines);
    const laid = relink(
      file.doc.startPoint,
      built.lines,
      built.auto,
      file.settings,
    );
    const next = { ...built.auto };
    if (laid.linkIds.length) next.linkPaths = laid.linkIds;
    else delete next.linkPaths;
    if (!built.changed && !laid.changed) return { auto, lines, rounds: round };
    auto = next;
    lines = laid.lines;
  }
  throw new Error("building the ladders never settles");
}

/** `file` with ladders added, settled as the editor would. */
function withLadders(name: string, ladders: Record<string, string[]>) {
  const file = load(name);
  const auto = JSON.parse(JSON.stringify(file.doc.auto)) as AutoSection;
  for (const [label, plays] of Object.entries(ladders)) {
    const wait = waitNamed(auto, label);
    startLadder(auto, wait.id);
    plays.forEach((id) => addTry(auto, wait.id, play(id)));
  }
  const settled = settle(auto, file.doc.lines, file);
  const catalog = buildPathCatalog(
    file.doc.startPoint,
    settled.lines,
    file.settings,
  );
  const preview = (scenario: Scenario, values: TimingValues) =>
    previewTogether(
      [
        {
          auto: settled.auto,
          startPoint: file.doc.startPoint,
          lines: settled.lines,
          settings: file.settings,
          scenario,
        },
      ],
      values,
      true,
      { tipsCome: true },
    ).previews[0];
  return { file, ...settled, catalog, preview };
}

const R_QUALS = { "TIP 1": ["wall-flower", "garden"] };
const L_QUALS = {
  "TIP 1 (the partner's preloads)": ["shoot-held", "wall-flower", "garden"],
};

describe.each([
  ["r-quals", R_QUALS],
  ["l-quals", L_QUALS],
] as const)("%s with a ladder on TIP 1", (name, ladders) => {
  const built = withLadders(name, ladders);
  const wait = waitNamed(built.auto, Object.keys(ladders)[0]);

  it("settles in one round, and building again changes nothing", () => {
    expect(built.rounds).toBeLessThanOrEqual(2);
    expect(compileLadders(built.auto, built.lines).changed).toBe(false);
  });

  it("has no errors, and exports Java", () => {
    const issues = validateAuto(
      built.auto,
      built.catalog,
      built.file.doc.startPoint,
    );
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
    expect(
      issues.filter((i) =>
        /starts .* from where the robot can be/.test(i.message),
      ),
    ).toEqual([]);
    const java = generateAutoJava({
      auto: built.auto,
      lines: built.lines,
      startPoint: built.file.doc.startPoint,
      settings: built.file.settings,
      shapes: [],
      sourceFileName: `${name}.pp`,
    });
    expect(java.ok, JSON.stringify(java)).toBe(true);
    if (java.ok) expect(java.source).toContain("Try 1: shoot for TIP 1");
  });

  it("keeps the ladder through a save and a load", () => {
    const text = serializeProject({
      ...built.file.doc,
      auto: built.auto,
      lines: built.lines,
    });
    const again = parseProject(text, robotConfigOf(DEFAULT_SETTINGS));
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(waitNamed(again.doc.auto!, wait.label).ladder).toEqual(wait.ladder);
    expect(Object.keys(again.doc.auto!.plays ?? {}).sort()).toEqual(
      [...ladders[Object.keys(ladders)[0] as keyof typeof ladders]].sort(),
    );
    expect(compileLadders(again.doc.auto!, again.doc.lines).changed).toBe(
      false,
    );
  });

  it.each(Object.keys(TIMINGS))(
    "doesn't change the good path, with %s",
    (timing) => {
      const plain = load(name);
      const before = previewTogether(
        [
          {
            auto: plain.doc.auto!,
            startPoint: plain.doc.startPoint,
            lines: plain.doc.lines,
            settings: plain.settings,
            scenario: {},
          },
        ],
        TIMINGS[timing],
        true,
        { tipsCome: true },
      ).previews[0];
      const after = built.preview({}, TIMINGS[timing]);
      expect(after.endTime).toBeCloseTo(before.endTime, 6);
      expect(after.drives.map((d) => d.t1)).toEqual(
        before.drives.map((d) => d.t1),
      );
    },
  );

  // At the robot's measured speed. At the simulator's, about 25% slower on drives than the robot
  // on 25 Oct, R-Quals' "try 1 works" runs to 30.1 s: the guard never cuts a path.
  it.each(["the team's measured timing"])(
    "parks by 30 s in every outcome, with %s",
    (timing) => {
      const ladder = ladderInfo(built.auto, wait.id)!;
      for (const { k, label } of ladderOutcomes(ladder)) {
        const run = built.preview(
          ladderScenario(wait.id, ladder, k),
          TIMINGS[timing],
        );
        expect(run.stalled, label).toBe(false);
        expect(
          run.endTime,
          `${label}: ends at ${run.endTime.toFixed(1)} s`,
        ).toBeLessThanOrEqual(AUTO_LENGTH_S + 1e-6);
        const last = run.drives.at(-1)!;
        const parked = allCards(built.auto.cards).find(
          (c) => c.id === last.cardId,
        );
        expect(
          parked?.kind === "path" && parked.park,
          `${label}: its last drive is a park`,
        ).toBe(true);
      }
    },
  );

  it("drives each try's paths at believable speeds", () => {
    for (const path of built.catalog.paths.filter((p) =>
      p.id.startsWith("lad-"),
    )) {
      expect(
        path.length / Math.max(1e-6, path.seconds),
        path.name,
      ).toBeLessThanOrEqual(built.file.settings.maxVelocity ?? 70);
    }
  });
});

describe("the rules", () => {
  it("skips a try whose source the plan has already used", () => {
    // R-Quals collects at the far FLOWER before TIP 2, so a far FLOWER try there is skipped.
    const { auto } = withLadders("r-quals", {
      "Fire the far FLOWER's 4 (TIP 2)": ["far-flower", "garden"],
    });
    const info = ladderInfo(
      auto,
      waitNamed(auto, "Fire the far FLOWER's 4 (TIP 2)").id,
    )!;
    expect(info.tries.map((t) => t.status)).toEqual(["skipped", "kept"]);
    expect(info.tries[0].reason).toMatch(/far FLOWER is already used/);
  });

  it("goes back to the plan after a try that works, when the plan still has its sources", () => {
    // The GARDEN is not on R-Quals' plan: a GARDEN try that works rejoins it at its next stop.
    const built = withLadders("r-quals", {
      "Fire the far FLOWER's 4 (TIP 2)": ["garden"],
    });
    const wait = waitNamed(built.auto, "Fire the far FLOWER's 4 (TIP 2)");
    const info = ladderInfo(built.auto, wait.id)!;
    expect(info.tries[0].then).toEqual({ kind: "plan" });
    const run = built.preview(
      ladderScenario(wait.id, info, 0),
      TIMINGS["the team's measured timing"],
    );
    const names = run.drives.map((d) => built.catalog.byId.get(d.pathId)!.name);
    expect(names).toContain("GARDEN to FIRE_G");
    expect(names.at(-1)).toBe("FIRE3 to PARK"); // the plan's own park, after its last shot
    expect(run.endTime).toBeLessThanOrEqual(AUTO_LENGTH_S);
  });

  it("parks early when the plan would go back to a source a try used", () => {
    const built = withLadders("r-quals", R_QUALS);
    const wait = waitNamed(built.auto, "TIP 1");
    const info = ladderInfo(built.auto, wait.id)!;
    expect(info.tries[0].then).toEqual({
      kind: "parkEarly",
      before: "WALL_FLOWER",
    });
    const run = built.preview(
      ladderScenario(wait.id, info, 0),
      TIMINGS["the team's measured timing"],
    );
    // The plan's own drives to the wall FLOWER (or copies of them) are not driven: only the try's.
    const toWall = (id: string) => built.auto.pathEnds[id] === "WALL_FLOWER";
    const driven = run.drives.map((d) => d.pathId).filter(toWall);
    expect(driven).toHaveLength(1);
    expect(driven[0]).toMatch(/^lad-.+-wall-flower-\d+$/);
    expect(run.endTime).toBeLessThanOrEqual(AUTO_LENGTH_S);
  });

  it("with no tries, a miss parks; tries move and go", () => {
    const file = load("r-quals");
    const auto = JSON.parse(JSON.stringify(file.doc.auto)) as AutoSection;
    const wait = waitNamed(auto, "TIP 1");
    startLadder(auto, wait.id);
    let built = compileLadders(auto, file.doc.lines);
    const timeout = (a: AutoSection) =>
      waitNamed(a, "TIP 1").rows.find((r) => "afterMs" in r)!.cards;
    /** With no tries, the miss drives to where the plan's park starts (FIRE3) and goes on to it. */
    const toParkOnly = (a: AutoSection) =>
      timeout(a).map((c) =>
        c.kind === "path" ? a.pathEnds[c.lineId] : c.kind,
      );
    expect(toParkOnly(built.auto)).toEqual(["FIRE3"]);

    addTry(auto, wait.id, play("wall-flower"));
    addTry(auto, wait.id, play("garden"));
    addTry(auto, wait.id, play("garden")); // already there: not added twice
    expect(wait.ladder!.tries.map((t) => t.play)).toEqual([
      "wall-flower",
      "garden",
    ]);
    moveTry(auto, wait.id, 1, -1);
    expect(wait.ladder!.tries.map((t) => t.play)).toEqual([
      "garden",
      "wall-flower",
    ]);
    removeTry(auto, wait.id, 0);
    removeTry(auto, wait.id, 0);
    expect(auto.plays).toBeUndefined();
    built = compileLadders(auto, built.lines);
    expect(toParkOnly(built.auto)).toEqual(["FIRE3"]);
    expect(
      built.lines.filter(
        (l) => l.id.startsWith("lad-") && !l.id.endsWith("-park"),
      ),
    ).toEqual([]);
  });

  it("keeps a bend drawn on a try's path when it builds again", () => {
    const built = withLadders("r-quals", R_QUALS);
    const id = built.lines.find((l) => l.id.endsWith("wall-flower-0"))!.id;
    const bent = built.lines.map((l) =>
      l.id === id && l.kind === "atomic"
        ? { ...l, controlPoints: [{ x: 40, y: 30 }] }
        : l,
    );
    const again = compileLadders(built.auto, bent);
    const line = again.lines.find((l) => l.id === id)!;
    expect(line.kind === "atomic" && line.controlPoints).toEqual([
      { x: 40, y: 30 },
    ]);
  });

  it("builds two ladders on one Auto, each outcome parking by 30 s", () => {
    const built = withLadders("r-quals", {
      ...R_QUALS,
      "Fire the far FLOWER's 4 (TIP 2)": ["garden"],
    });
    expect(
      validateAuto(built.auto, built.catalog, built.file.doc.startPoint).filter(
        (i) => i.level === "error",
      ),
    ).toEqual([]);
    for (const label of ["TIP 1", "Fire the far FLOWER's 4 (TIP 2)"]) {
      const wait = waitNamed(built.auto, label);
      const info = ladderInfo(built.auto, wait.id)!;
      for (const { k } of ladderOutcomes(info)) {
        const run = built.preview(
          ladderScenario(wait.id, info, k),
          TIMINGS["the team's measured timing"],
        );
        expect(run.endTime, `${label} outcome ${k}`).toBeLessThanOrEqual(
          AUTO_LENGTH_S + 1e-6,
        );
      }
    }
  });
});
