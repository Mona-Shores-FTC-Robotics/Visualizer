// Fork: a paired Auto's INIT menu (types.ts FirstOfCard.choice and .shot, AfterMsRow.option,
// AutoSection.partner): a route choice between two legs, stops that shoot by the camera or the
// timer, times the drive team may set, and what the Auto assumes of its partner.
// The fixtures are biobuzz's r-clockwise.pp and l-clockwise.pp with the Java they export.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/config/defaults";
import { parseProject, robotConfigOf, serializeProject } from "../src/io";
import type { ProjectDoc } from "../src/io/project";
import { buildPathCatalog } from "../src/lib/auto/geometry";
import { relink } from "../src/lib/auto/links";
import { normalizeAuto, serializeAuto } from "../src/lib/auto/normalize";
import { allCards, usedNames } from "../src/lib/auto/tree";
import type { AutoSection, FirstOfCard } from "../src/lib/auto/types";
import { validateAuto } from "../src/lib/auto/validate";
import { generateAutoJavaFromText } from "../src/lib/codegen/auto/fromFile";

const DIR = "test/fixtures/clockwise";

function load(name: string): ProjectDoc {
  const loaded = parseProject(
    readFileSync(`${DIR}/${name}`, "utf8"),
    robotConfigOf(DEFAULT_SETTINGS),
  );
  if (!loaded.ok) throw new Error(loaded.error);
  return loaded.doc;
}

function errorsOf(doc: ProjectDoc, auto: AutoSection): string[] {
  const settings = { ...DEFAULT_SETTINGS, ...doc.robot };
  const catalog = buildPathCatalog(doc.startPoint, doc.lines, settings);
  return validateAuto(auto, catalog, doc.startPoint)
    .filter((issue) => issue.level === "error")
    .map((issue) => issue.message);
}

const waits = (auto: AutoSection) =>
  allCards(auto.cards).filter((c): c is FirstOfCard => c.kind === "firstOf");

describe("a paired Auto", () => {
  for (const [pp, java] of [
    ["r-clockwise.pp", "RClockwiseAuto.java"],
    ["l-clockwise.pp", "LClockwiseAuto.java"],
  ]) {
    it(`${pp} exports the Java biobuzz holds`, () => {
      const result = generateAutoJavaFromText(
        readFileSync(`${DIR}/${pp}`, "utf8"),
        pp,
      );
      expect(result.ok ? [] : result.errors).toEqual([]);
      if (!result.ok) return;
      expect(result.source.split("\n")).toEqual(
        readFileSync(`${DIR}/${java}`, "utf8").split("\n"),
      );
    });

    it(`${pp} is written back as it was read`, () => {
      const doc = load(pp);
      const again = normalizeAuto(
        JSON.parse(JSON.stringify(serializeAuto(doc.auto!))),
      );
      expect(again.problems).toEqual([]);
      expect(serializeAuto(again.auto!)).toEqual(serializeAuto(doc.auto!));
      // Laid out again, every path keeps its place: the editor has nothing left to move.
      const settings = { ...DEFAULT_SETTINGS, ...doc.robot };
      expect(
        relink(doc.startPoint, doc.lines, doc.auto!, settings).lines.map(
          (line) => line.id,
        ),
      ).toEqual(doc.lines.map((line) => line.id));
      expect(JSON.parse(serializeProject(doc)).auto).toEqual(
        JSON.parse(readFileSync(`${DIR}/${pp}`, "utf8")).auto,
      );
    });

    it(`${pp} has no errors`, () => {
      const doc = load(pp);
      expect(errorsOf(doc, doc.auto!)).toEqual([]);
    });
  }

  it("lists the menu in OPTIONS: the choice, the shot trigger, the times, the partner", () => {
    const java = readFileSync(`${DIR}/RClockwiseAuto.java`, "utf8");
    const options = java.split("\n").find((l) => l.includes("OPTIONS ="))!;
    expect(options).toContain(
      'AutoOption.choice("Pickup", "WALL_FLOWER", "GARDEN"), AutoOption.shotTrigger(), AutoOption.time("T2 LEFT up by", 15.5)',
    );
    expect(options).toContain(
      'AutoOption.partner("L-Clockwise", "Pickup", "GARDEN", "WALL_FLOWER")',
    );
    // One name is one time, however many waits use it.
    expect(options.match(/AutoOption\.time\("TR park at"/g)).toHaveLength(1);
  });

  it("writes each leg's cards on their own choice, flat in the list", () => {
    const java = readFileSync(`${DIR}/RClockwiseAuto.java`, "utf8");
    expect(java).toContain(
      'kit.route("Pickup", 0, () -> kit.command("PickFlower", 4.5)),',
    );
    expect(java).toContain(
      'kit.route("Pickup", 1, () -> kit.command("GardenGather", 5.5)),',
    );
    // A plain wait inside a leg closes both the wait and the route.
    const left = readFileSync(`${DIR}/LClockwiseAuto.java`, "utf8");
    expect(left).toContain(
      'kit.atMatchSeconds(kit.seconds("TF FLOWER at", 15.5)))),',
    );
  });

  it("writes a stop that shoots by camera or timer with both rows on its time", () => {
    const java = readFileSync(`${DIR}/RClockwiseAuto.java`, "utf8");
    expect(java).toContain(
      'kit.shotLimit(kit.seconds("T2 LEFT up by", 15.5)).then(',
    );
    expect(java).toContain(
      'kit.shotWhen("LeftCellUp", kit.seconds("T2 LEFT up by", 15.5)).then(',
    );
    // A clock gate is an ordinary wait on Always: its time is on the menu too.
    expect(java).toContain(
      'kit.atMatchSeconds(kit.seconds("TS scoring FLOWER by", 16.9)).then(',
    );
  });

  it("does not list a route choice's option as a trigger of the robot's", () => {
    const doc = load("r-clockwise.pp");
    expect([...usedNames(doc.auto!).conditions.keys()].sort()).toEqual([
      "Always",
      "LeftCellUp",
      "RightCellUp",
    ]);
  });

  it("refuses a choice with an unnamed leg, a decision in a leg, or two sets of names", () => {
    const doc = load("r-clockwise.pp");
    const auto = structuredClone(doc.auto!);
    const choice = waits(auto).find((c) => c.choice)!;
    delete choice.rows[0].label;
    expect(errorsOf(doc, auto).join("\n")).toContain(
      'each leg of the "Pickup" choice needs a name',
    );

    const nested = structuredClone(doc.auto!);
    const leg = waits(nested).find((c) => c.choice)!.rows[0];
    const stop = waits(nested).find((c) => c.shot)!;
    leg.cards.push(structuredClone(stop));
    expect(errorsOf(doc, nested).join("\n")).toContain(
      "holds drives, commands and plain waits only",
    );
  });

  it("refuses a camera-or-timer stop without a match-clock time, and one name with two times", () => {
    const doc = load("r-clockwise.pp");
    const auto = structuredClone(doc.auto!);
    const stop = waits(auto).find((c) => c.shot)!;
    for (const row of stop.rows) if ("afterMs" in row) delete row.matchClock;
    expect(errorsOf(doc, auto).join("\n")).toContain(
      "shoots by the camera or the timer, so it needs a trigger and a time on the match clock",
    );

    const twice = structuredClone(doc.auto!);
    const holds = waits(twice).filter((c) =>
      c.rows.some((r) => "afterMs" in r && r.option === "TR park at"),
    );
    expect(holds.length).toBeGreaterThan(1);
    for (const row of holds[0].rows) if ("afterMs" in row) row.afterMs += 500;
    expect(errorsOf(doc, twice).join("\n")).toContain("one name is one time");
  });

  it("refuses a partner note that follows no route choice", () => {
    const doc = load("r-clockwise.pp");
    const auto = structuredClone(doc.auto!);
    auto.partner = { auto: "L-Clockwise", follows: "Nothing" };
    expect(errorsOf(doc, auto).join("\n")).toContain(
      'follows "Nothing", which is not a route choice',
    );
  });
});
