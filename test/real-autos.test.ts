// The team's real Autos and the simulator's runs of them (test/fixtures/biobuzz/, refreshed by
// scripts/refresh-biobuzz-fixtures.mjs): the plan view must read them sensibly, and the preview
// must stay in the ballpark of what the simulator measured.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/config/defaults";
import { parseProject, robotConfigOf } from "../src/io";
import { buildPathCatalog } from "../src/lib/auto/geometry";
import {
  AUTO_LENGTH_S,
  type PreviewResult,
  type Scenario,
} from "../src/lib/auto/simulate";
import { allCards } from "../src/lib/auto/tree";
import {
  fallbackValues,
  parseTimingFile,
  type TimingValues,
} from "../src/lib/timing/model";
import { previewTogether } from "../src/lib/timing/together";
import { cardTimes, missScenario, planOf } from "../src/lib/plan/plan";

const DIR = "test/fixtures/biobuzz";

function load(path: string, values: TimingValues = fallbackValues()) {
  const loaded = parseProject(
    readFileSync(path, "utf8"),
    robotConfigOf(DEFAULT_SETTINGS),
  );
  if (!loaded.ok) throw new Error(loaded.error);
  const doc = loaded.doc;
  const settings = { ...DEFAULT_SETTINGS, ...doc.robot };
  const catalog = buildPathCatalog(doc.startPoint, doc.lines, settings);
  const plan = planOf(doc.auto!, catalog.names);
  const preview = (scenario: Scenario): PreviewResult =>
    previewTogether(
      [
        {
          auto: doc.auto!,
          startPoint: doc.startPoint,
          lines: doc.lines,
          settings,
          scenario,
        },
      ],
      values,
      true,
      { tipsCome: true },
    ).previews[0];
  return { doc, settings, catalog, plan, preview };
}

/** The team's timing facts, measured on robot 20245 (driveSpeed 1.5): `real/timing.json`. */
const MEASURED: TimingValues = {
  ...fallbackValues(),
  ...Object.fromEntries(
    Object.entries(
      parseTimingFile(readFileSync(`${DIR}/real/timing.json`, "utf8")).facts,
    ).map(([id, fact]) => [id, fact.value]),
  ),
};

/** Autos built before we decided to branch only on what the robot can sense; to be rebuilt. */
const REBUILD = new Set(["sister-right-fixed.pp"]);

describe.each(readdirSync(`${DIR}/autos`).filter((f) => f.endsWith(".pp")))(
  "%s",
  (file) => {
    const { doc, settings, catalog, plan, preview } = load(
      `${DIR}/autos/${file}`,
    );

    it("reads as chapters, the way the plan view shows it", async () => {
      const summary = plan.chapters
        .map((chapter) =>
          [
            chapter.name,
            ...chapter.steps.map(
              (step) =>
                `  ${step.kind.padEnd(7)} ${step.label}${step.limitS !== undefined ? ` (up to ${step.limitS} s, ${step.sense})` : ""}${step.miss ? `  ◆ miss: ${step.miss.length} steps${step.then ? `, then back to ${step.then.label}` : ""}` : ""}`,
            ),
          ].join("\n"),
        )
        .join("\n");
      await expect(summary + "\n").toMatchFileSnapshot(
        `golden/biobuzz/${file}.plan.txt`,
      );
    });

    it("ends its good path parked, by 30 s", () => {
      const good = preview({});
      expect(plan.chapters.at(-1)?.name).toBe("Park");
      expect(good.endTime).toBeLessThanOrEqual(AUTO_LENGTH_S);
      expect(
        good.guard,
        "the endgame guard should not be needed when every tip comes",
      ).toBeNull();
    });

    it.skipIf(REBUILD.has(file))("meets its TIPs in order", () => {
      const tips = plan.chapters
        .filter((c) => c.name !== "Park")
        .map((c) => Number(c.name.split(" ")[1]));
      expect(tips).toEqual([...tips].sort((a, b) => a - b));
    });

    it("parks by 30 s whatever tip is missed, at the robot's measured speed", () => {
      // At the simulator's speed, about 25% slower on drives than the robot on 25 Oct,
      // L-Quals' TIP 1 miss runs to 30.8 s: the guard never cuts a path, so a long miss
      // can overrun.
      const measured = load(`${DIR}/autos/${file}`, MEASURED).preview;
      for (const branch of plan.branches) {
        const miss = measured(missScenario(branch));
        expect(
          miss.endTime,
          `${branch.tip ?? branch.label} missed`,
        ).toBeLessThanOrEqual(AUTO_LENGTH_S + 1e-6);
      }
    });

    it("has believable waits and speeds", () => {
      for (const step of plan.steps) {
        if (step.limitS === undefined) continue;
        expect(step.limitS, step.label).toBeGreaterThanOrEqual(0.25);
        expect(step.limitS, step.label).toBeLessThanOrEqual(15);
      }
      for (const path of catalog.paths) {
        const average = path.length / Math.max(1e-6, path.seconds);
        expect(average, `${path.name}: average speed`).toBeLessThanOrEqual(
          settings.maxVelocity ?? 70,
        );
      }
      expect(doc.auto).toBeTruthy();
    });
  },
);

/**
 * Against the simulator (60 seeded runs per Auto, `sim/<auto>.json`). The simulator drives the
 * real Pedro follower on a physics model, so it is the closest thing to the robot we can test
 * against here. Tolerances are wide on purpose: they catch a preview that is wrong, not one that
 * is a little off. Today the preview is about 25% slower on drives than the simulator (most on
 * short drives, where speeding up and slowing down dominate) and finishes within a second of it.
 */
describe.each(["l-quals", "r-quals"])("%s against the simulator", (auto) => {
  const { catalog, plan, preview } = load(`${DIR}/sim/${auto}.pp`);
  const sim = JSON.parse(readFileSync(`${DIR}/sim/${auto}.json`, "utf8")) as {
    driveSeconds: Record<string, { median: number; runs: number }>;
    finishedAt: { median: number; runs: number };
  };
  /** Drives on the good path: those most runs took. */
  const drives = Object.entries(sim.driveSeconds).filter(
    ([, s]) => s.runs >= 30,
  );

  it("times every drive within half to twice the simulator's", () => {
    expect(drives.length).toBeGreaterThan(5);
    const table = drives.map(([name, s]) => {
      const path = catalog.paths.find((p) => p.name === name);
      return {
        name,
        sim: s.median,
        preview: path ? Number(path.seconds.toFixed(2)) : null,
      };
    });
    for (const row of table) {
      expect(row.preview, `${row.name} is a path in the .pp`).not.toBeNull();
      const ratio = row.preview! / row.sim;
      expect(
        ratio,
        `${row.name}: preview ${row.preview} s vs simulator ${row.sim} s`,
      ).toBeGreaterThan(0.5);
      expect(
        ratio,
        `${row.name}: preview ${row.preview} s vs simulator ${row.sim} s`,
      ).toBeLessThan(2);
    }
  });

  it("times the good path's drives within 40% of the simulator overall", () => {
    let simTotal = 0;
    let previewTotal = 0;
    for (const [name, s] of drives) {
      simTotal += s.median;
      previewTotal += catalog.paths.find((p) => p.name === name)!.seconds;
    }
    const ratio = previewTotal / simTotal;
    expect(ratio).toBeGreaterThan(0.85);
    expect(ratio).toBeLessThan(1.4);
  });

  it("finishes the good path within 2 s of the simulator", () => {
    const good = preview({});
    expect(Math.abs(good.endTime - sim.finishedAt.median)).toBeLessThan(2);
  });

  it("gives every step of the good path a time", () => {
    const times = cardTimes(preview({}));
    for (const step of plan.steps) {
      const t = times.get(step.cardId);
      expect(t, step.label).toBeTruthy();
      expect(t!.t1, step.label).toBeGreaterThanOrEqual(t!.t0);
    }
  });
});

/**
 * Against the robot itself: 20245's first match logs (25 Oct 2026, `real/2026-10-25.json`, from
 * biobuzz's doc/real-vs-sim-25-oct.md), previewed with the team's measured timing facts
 * (`real/timing.json`, driveSpeed 1.5). With no launcher on the robot every wait ran to its time
 * limit, so the preview with every condition answered "never" is the same run. Known gaps, from
 * the team's own notes: one driveSpeed factor fits the straights and over-states curves and turns
 * (R-Simple's curve, FAR_FLOWER to N_FIRE's 180° turn), and the light chassis was all that ran.
 */
describe("the robot's first match logs (25 Oct 2026)", () => {
  const team = parseTimingFile(readFileSync(`${DIR}/real/timing.json`, "utf8"));
  const values = {
    ...fallbackValues(),
    ...Object.fromEntries(
      Object.entries(team.facts).map(([id, fact]) => [id, fact.value]),
    ),
  };
  const real = JSON.parse(
    readFileSync(`${DIR}/real/2026-10-25.json`, "utf8"),
  ) as Record<
    string,
    {
      drives: Record<string, { start: number; seconds: number }>;
      guardAt?: number;
      parkSeconds?: number;
    }
  >;

  /** The preview of `auto` with no condition ever coming, as on the night. */
  function asRan(auto: string) {
    const { doc, catalog, preview } = load(`${DIR}/real/${auto}.pp`, values);
    const never: Scenario = {};
    for (const card of allCards(doc.auto!.cards))
      if (card.kind === "firstOf")
        for (const row of card.rows)
          if ("when" in row) for (const name of row.when) never[name] = false;
    const run = preview(never);
    const drives = new Map(
      run.drives.map(
        (drive) => [catalog.byId.get(drive.pathId)!.name, drive] as const,
      ),
    );
    return { run, drives };
  }

  it.each(["r-quals", "r-simple"])(
    "%s: starts each drive within 0.25 s of the robot",
    (auto) => {
      const { drives } = asRan(auto);
      for (const [name, measured] of Object.entries(real[auto].drives)) {
        const drive = drives.get(name);
        expect(drive, `${name} driven`).toBeTruthy();
        expect(
          Math.abs(drive!.t0 - measured.start),
          `${name} starts at ${drive!.t0.toFixed(2)} s`,
        ).toBeLessThan(0.25);
      }
    },
  );

  it.each(["r-quals", "r-simple"])(
    "%s: times each drive within 0.6 to 1.4 times the robot's",
    (auto) => {
      const { drives } = asRan(auto);
      for (const [name, measured] of Object.entries(real[auto].drives)) {
        const drive = drives.get(name)!;
        const ratio = (drive.t1 - drive.t0) / measured.seconds;
        expect(
          ratio,
          `${name}: ${(drive.t1 - drive.t0).toFixed(2)} s vs ${measured.seconds} s`,
        ).toBeGreaterThan(0.6);
        expect(
          ratio,
          `${name}: ${(drive.t1 - drive.t0).toFixed(2)} s vs ${measured.seconds} s`,
        ).toBeLessThan(1.4);
      }
    },
  );

  it("r-quals: times the drive that turns 180° within 15% of the robot", () => {
    // FAR_FLOWER to N_FIRE turns half a circle in 15.5 in: turning, not driving, sets its time.
    const { drives } = asRan("r-quals");
    const drive = drives.get("FAR_FLOWER to N_FIRE")!;
    const measured = real["r-quals"].drives["FAR_FLOWER to N_FIRE"].seconds;
    expect(Math.abs(drive.t1 - drive.t0 - measured) / measured).toBeLessThan(0.15);
  });

  it("r-quals: the endgame guard parks when the robot's did, and the park ends by 30 s", () => {
    const { run } = asRan("r-quals");
    expect(run.guard, "the guard parks").not.toBeNull();
    expect(Math.abs(run.guard!.t - real["r-quals"].guardAt!)).toBeLessThan(
      0.25,
    );
    expect(run.endTime).toBeLessThanOrEqual(AUTO_LENGTH_S);
    expect(run.endTime - run.guard!.t).toBeGreaterThan(
      real["r-quals"].parkSeconds! * 0.6,
    );
  });
});
