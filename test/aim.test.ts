// Launching with the turret locked (src/lib/simple/aim.ts): the heading is the aim.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEFAULT_SETTINGS } from "../src/config/defaults";
import { parseProject, robotConfigOf } from "../src/io";
import { aimFrom } from "../src/lib/simple/aim";
import { stepsOf } from "../src/lib/simple/steps";

describe("the aim with the turret locked", () => {
  it("finds the heading onto our CELL at the robot's end of the field", () => {
    const start = aimFrom(54.06, 7.72, 90, "RED");
    expect(start.cell).toBe("AUDIENCE");
    expect(start.needDeg).toBeCloseTo(87.7, 1);
    expect(start.offDeg).toBeCloseTo(2.3, 1);
    expect(start.on).toBe(true);

    const far = aimFrom(59.4, 129.5, 270, "RED");
    expect(far.cell).toBe("SCORING");
    expect(far.needDeg).toBeCloseTo(270.6, 1);
    expect(far.on).toBe(true);

    // The old R-Quals' launch spots, drawn for a turret that aims.
    expect(Math.abs(aimFrom(55, 24, 270, "RED").offDeg)).toBeGreaterThan(170);
    const fire3 = aimFrom(45, 26, 90, "RED");
    expect(fire3.needDeg).toBeCloseTo(71.2, 1);
    expect(fire3.on).toBe(false);
  });

  it("turns half a turn with the field for blue", () => {
    const red = aimFrom(45, 26, 71, "RED");
    const blue = aimFrom(141.5 - 45, 141.5 - 26, 251, "BLUE");
    expect(blue.cell).toBe("SCORING");
    expect(blue.needDeg).toBeCloseTo((red.needDeg + 180) % 360, 6);
    expect(blue.offDeg).toBeCloseTo(red.offDeg, 6);
  });

  it("shows on each Launch all of R-Quals-Pollen-Only", () => {
    const text = readFileSync(
      `${__dirname}/fixtures/autos/r-quals-pollen-only.pp`,
      "utf8",
    );
    const r = parseProject(text, robotConfigOf(DEFAULT_SETTINGS));
    if (!r.ok) throw new Error(r.error);
    const launches = stepsOf(r.doc).filter((s) => s.kind === "launch");
    expect(launches.map((s) => [s.atSpot, s.aim!.cell, s.aim!.on])).toEqual([
      ["START_RIGHT", "AUDIENCE", true],
      ["LAUNCH_LEFT", "SCORING", true],
      ["LAUNCH_LEFT", "SCORING", true],
    ]);
  });
});
