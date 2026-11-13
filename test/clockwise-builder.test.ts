// Fork: biobuzz's Clockwise pair (r-clockwise.pp, l-clockwise.pp) is made of builder steps only:
// waits, clock checks, timed holds and route choices whose last one's legs each end in a Park. It
// opens in the Simple builder, and exports the Java biobuzz holds.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/config/defaults";
import { parseProject, robotConfigOf } from "../src/io";
import { generateAutoJavaFromText } from "../src/lib/codegen/auto/fromFile";
import { isBuilderAuto, isSimple } from "../src/lib/simple/steps";

const DIR = "test/fixtures/clockwise-builder";
const SAVED = /SAVED = "[^"]*"/;

describe("the Clockwise pair as builder steps", () => {
  for (const [pp, java] of [
    ["r-clockwise.pp", "RClockwiseAuto.java"],
    ["l-clockwise.pp", "LClockwiseAuto.java"],
  ]) {
    const text = readFileSync(`${DIR}/${pp}`, "utf8");
    it(`${pp} opens in the Simple builder`, () => {
      const loaded = parseProject(text, robotConfigOf(DEFAULT_SETTINGS));
      if (!loaded.ok) throw new Error(loaded.error);
      expect(isSimple(loaded.doc)).toBe(true);
      expect(isBuilderAuto(loaded.doc.auto!)).toBe(true);
    });
    it(`${pp} exports the Java biobuzz holds`, () => {
      const result = generateAutoJavaFromText(text, pp);
      if (!result.ok) throw new Error(result.errors.join("; "));
      expect(result.source.replace(SAVED, "")).toBe(
        readFileSync(`${DIR}/${java}`, "utf8").replace(SAVED, ""),
      );
    });
  }

  it("has one time and the choices on each INIT menu", () => {
    const options = (pp: string) => {
      const result = generateAutoJavaFromText(
        readFileSync(`${DIR}/${pp}`, "utf8"),
        pp,
      );
      if (!result.ok) throw new Error(result.errors.join("; "));
      return result.source
        .split("\n")
        .find((line) => line.includes("AutoOption[] OPTIONS"))!;
    };
    expect(options("r-clockwise.pp")).toContain(
      '{AutoOption.matchSeconds("R3 RIGHT up by", 23.2, 2), AutoOption.choice("Pickup", "WALL_FLOWER", "GARDEN"), AutoOption.choice("Priority", "THREE_TIP", "PARK")}',
    );
    expect(options("l-clockwise.pp")).toContain(
      '{AutoOption.matchSeconds("L1 LEFT up by", 9.5, 1), AutoOption.choice("Pickup", "GARDEN", "WALL_FLOWER")}',
    );
  });
});
