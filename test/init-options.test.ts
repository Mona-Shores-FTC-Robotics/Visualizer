// Fork: what the drive team may change during INIT (types.ts parkChoices, AfterMsRow.matchClock
// and .adjustable): the editor's steps, the checks, the preview's timing and the Java export.
// The fixture is biobuzz's l-partner.pp as it was before it had any options.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/config/defaults";
import { parseProject, robotConfigOf } from "../src/io";
import type { ProjectDoc } from "../src/io/project";
import { buildPathCatalog } from "../src/lib/auto/geometry";
import { normalizeAuto, serializeAuto } from "../src/lib/auto/normalize";
import { validateAuto } from "../src/lib/auto/validate";
import { timeRowFiresAt, type AutoSection } from "../src/lib/auto/types";
import { generateAutoJava } from "../src/lib/codegen/auto/javaAuto";
import { linkSpot } from "../src/lib/team/teamSpots";
import { stepCollisions } from "../src/lib/simple/collide";
import {
  removeStep,
  setParkChoice,
  setStepSpot,
  setWait,
  stepsOf,
} from "../src/lib/simple/steps";

const RIGHT_PARK: [number, number, number] = [14.5, 95.7, 0];

function load(): ProjectDoc {
  const loaded = parseProject(
    readFileSync("test/fixtures/init-options/l-partner.pp", "utf8"),
    robotConfigOf(DEFAULT_SETTINGS),
  );
  if (!loaded.ok) throw new Error(loaded.error);
  return loaded.doc;
}

/** L-Partner with RIGHT_PARK offered and its TIP wait on the match clock, changeable in INIT. */
function withOptions(doc = load()): ProjectDoc {
  let next = setParkChoice(
    linkSpot(doc, "RIGHT_PARK", RIGHT_PARK),
    "RIGHT_PARK",
    true,
  );
  const wait = stepsOf(next).find((step) => step.kind === "wait")!;
  next = setWait(next, wait.cardId, { matchClock: true, seconds: 8 });
  return setWait(next, wait.cardId, { adjustable: true });
}

function exportOf(doc: ProjectDoc) {
  const settings = { ...DEFAULT_SETTINGS, ...doc.robot };
  return generateAutoJava({
    auto: doc.auto!,
    startPoint: doc.startPoint,
    lines: doc.lines,
    shapes: doc.shapes,
    settings,
    sourceFileName: "l-partner.pp",
  });
}

function issuesOf(doc: ProjectDoc) {
  const settings = { ...DEFAULT_SETTINGS, ...doc.robot };
  const catalog = buildPathCatalog(doc.startPoint, doc.lines, settings);
  return validateAuto(doc.auto!, catalog, doc.startPoint);
}

describe("the steps", () => {
  it("offer a park and put a wait on the match clock", () => {
    const doc = withOptions();
    expect(doc.auto!.parkChoices).toEqual(["RIGHT_PARK"]);
    const wait = stepsOf(doc).find((step) => step.kind === "wait")!;
    expect(wait.waitClock).toBe(true);
    expect(wait.waitAdjustable).toBe(true);
    expect(wait.waitS).toBe(8);
    expect(issuesOf(doc).filter((i) => i.level === "error")).toEqual([]);
  });

  it("a limit off the match clock cannot be changed in INIT", () => {
    const doc = withOptions();
    const wait = stepsOf(doc).find((step) => step.kind === "wait")!;
    const plain = stepsOf(
      setWait(doc, wait.cardId, { matchClock: false }),
    ).find((step) => step.kind === "wait")!;
    expect(plain.waitClock).toBe(false);
    expect(plain.waitAdjustable).toBe(false);
  });

  it("parking on the offered spot swaps the two", () => {
    const doc = withOptions();
    const park = stepsOf(doc).find((step) => step.kind === "park")!;
    const swapped = setStepSpot(doc, park.cardId, "RIGHT_PARK");
    expect(swapped.auto!.parkChoices).toEqual(["LEFT_PARK"]);
  });

  it("no longer offering a park takes the spot out of the Auto", () => {
    const doc = setParkChoice(withOptions(), "RIGHT_PARK", false);
    expect(doc.auto!.parkChoices).toBeUndefined();
    expect(doc.auto!.points.RIGHT_PARK).toBeUndefined();
    expect(doc.auto!.teamSpots).not.toContain("RIGHT_PARK");
  });

  it("removing the park step stops offering others", () => {
    const doc = withOptions();
    const park = stepsOf(doc).find((step) => step.kind === "park")!;
    expect(removeStep(doc, park.cardId).auto!.parkChoices).toBeUndefined();
  });

  it("the file keeps them", () => {
    const auto = withOptions().auto!;
    const again = normalizeAuto(
      JSON.parse(JSON.stringify(serializeAuto(auto))),
    );
    expect(again.problems).toEqual([]);
    const back = again.auto as AutoSection;
    expect(back.parkChoices).toEqual(["RIGHT_PARK"]);
    const wait = back.cards.find((card) => card.kind === "firstOf");
    expect(wait?.kind === "firstOf" && wait.rows[1]).toMatchObject({
      afterMs: 8000,
      matchClock: true,
      adjustable: true,
    });
  });
});

describe("the checks", () => {
  it("refuse the park step's own spot as another choice", () => {
    const doc = withOptions();
    doc.auto!.parkChoices = ["LEFT_PARK"];
    expect(
      issuesOf(doc).some(
        (i) => i.level === "error" && /park step's own spot/.test(i.message),
      ),
    ).toBe(true);
  });

  it("refuse a choice that is not one of the Auto's spots", () => {
    const doc = load();
    doc.auto!.parkChoices = ["NOWHERE_PARK"];
    expect(
      issuesOf(doc).some(
        (i) => i.level === "error" && /NOWHERE_PARK/.test(i.message),
      ),
    ).toBe(true);
  });
});

describe("the preview", () => {
  it("a match-clock limit fires at that time, or at once when the wait begins later", () => {
    const row = { afterMs: 8000, matchClock: true, cards: [] };
    expect(timeRowFiresAt(row, 1.2)).toBe(8);
    expect(timeRowFiresAt(row, 9)).toBe(9);
    expect(timeRowFiresAt({ afterMs: 7000, cards: [] }, 1.2)).toBeCloseTo(8.2);
  });
});

describe("the Java", () => {
  it("lists the options, and every park path ends on the picked park", () => {
    const result = exportOf(withOptions());
    if (!result.ok) throw new Error(result.errors.join("\n"));
    const java = result.source;
    expect(java).toContain(
      'public static final AutoOption[] OPTIONS = {AutoOption.park("LEFT_PARK", "RIGHT_PARK"), AutoOption.matchSeconds("Wait for TIP or CELL up", 8)};',
    );
    expect(java).toContain(
      "Pose park = kit.pick(AutoOption.PARK, leftPark, rightPark);",
    );
    expect(java).toContain(
      'kit.atMatchSeconds(kit.seconds("Wait for TIP or CELL up", 8))',
    );
    expect(java).toContain(
      'kit.pick(AutoOption.PARK, "to LEFT_PARK", "to RIGHT_PARK")',
    );
    // No park path still ends on the drawn park.
    expect(java).not.toMatch(/Paths\.\w+\([^;]*leftPark\)/);
    // Each guard reserve is a pick: the drawn park's time first, then the other's.
    const reserves = [
      ...java.matchAll(/kit\.pick\(AutoOption\.PARK, ([\d.]+), ([\d.]+)\)/g),
    ];
    expect(reserves.length).toBeGreaterThan(0);
    for (const [, drawn, other] of reserves) {
      expect(drawn).toMatch(/\./);
      expect(other).toMatch(/\./);
    }
  });

  it("an Auto with no options still says so", () => {
    const result = exportOf(load());
    if (!result.ok) throw new Error(result.errors.join("\n"));
    expect(result.source).toContain(
      "public static final AutoOption[] OPTIONS = {};",
    );
    expect(result.source).toContain("kit.afterMs(7000)");
  });

  it("a match-clock limit nobody may change is a plain time", () => {
    const doc = withOptions();
    const wait = stepsOf(doc).find((step) => step.kind === "wait")!;
    const result = exportOf(setWait(doc, wait.cardId, { adjustable: false }));
    if (!result.ok) throw new Error(result.errors.join("\n"));
    expect(result.source).toContain("kit.atMatchSeconds(8)");
    expect(result.source).not.toContain("AutoOption.matchSeconds");
  });
});

describe("the collision check", () => {
  const hitsOf = (doc: ProjectDoc) => {
    const settings = { ...DEFAULT_SETTINGS, ...doc.robot };
    const catalog = buildPathCatalog(doc.startPoint, doc.lines, settings);
    return [...stepCollisions(doc, catalog).values()].flatMap((hit) => [
      ...hit.drive,
      ...hit.park,
    ]);
  };

  it("drives each park path to the other park too", () => {
    expect(hitsOf(withOptions())).toEqual([]);
    // A "park" on the Red HIVE: every park path to it runs into the HIVE.
    const doc = setParkChoice(
      linkSpot(load(), "HIVE_PARK", [47.3, 70, 0]),
      "HIVE_PARK",
      true,
    );
    const hits = hitsOf(doc);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((hit) => hit === "the Red HIVE (to HIVE_PARK)")).toBe(
      true,
    );
  });
});
