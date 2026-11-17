// Launching with the turret locked (src/lib/simple/aim.ts): the heading is the aim.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEFAULT_SETTINGS } from "../src/config/defaults";
import { parseProject, robotConfigOf } from "../src/io";
import {
  aimFrom,
  MAX_OFF_SQUARE_DEG,
  TURRET_SWING_S,
  turretAimFrom,
  turretDegAt,
  turretSpans,
} from "../src/lib/simple/aim";
import { contactPose, FLOWERS } from "../src/lib/simple/flowers";
import { stepsOf } from "../src/lib/simple/steps";

describe("the aim with the turret locked", () => {
  it("finds the heading onto our CELL at the robot's end of the field", () => {
    const start = aimFrom(54.06, 7.72, 90, "RED");
    expect(start.cell).toBe("AUDIENCE");
    expect(start.needDeg).toBeCloseTo(88.6, 1);
    expect(start.offDeg).toBeCloseTo(1.4, 1);
    expect(start.on).toBe(true);

    const far = aimFrom(59.4, 129.5, 270, "RED");
    expect(far.cell).toBe("SCORING");
    expect(far.needDeg).toBeCloseTo(271.6, 1);
    expect(far.on).toBe(true);

    // The old R-Quals' launch spots, drawn for a turret that aims.
    expect(Math.abs(aimFrom(55, 24, 270, "RED").offDeg)).toBeGreaterThan(170);
    const fire3 = aimFrom(45, 26, 90, "RED");
    expect(fire3.needDeg).toBeCloseTo(72.5, 1);
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

describe("a turret that tracks", () => {
  it("points back over the robot at our CELL from against the FAR FLOWER", () => {
    const far = FLOWERS.find((f) => f.name === "FAR FLOWER")!;
    const at = contactPose(far);
    const shot = turretAimFrom(at.x, at.y, at.headingDeg, "RED");
    expect(shot.cell).toBe("SCORING");
    expect(Math.abs(shot.turretDeg)).toBeGreaterThan(160);
    expect(shot.rangeIn).toBeGreaterThan(42);
    expect(shot.rangeIn).toBeLessThan(48);
    expect(shot.offSquareDeg).toBeLessThan(MAX_OFF_SQUARE_DEG);
  });

  it("has no shot from the WALL FLOWER: the CELL opens side-on to it", () => {
    const wall = FLOWERS.find((f) => f.name === "WALL FLOWER")!;
    const at = contactPose(wall);
    expect(
      turretAimFrom(at.x, at.y, at.headingDeg, "RED").offSquareDeg,
    ).toBeGreaterThan(60);
  });

  it("is straight ahead at a spot drawn to aim with the turret locked", () => {
    const need = aimFrom(45, 26, 0, "RED").needDeg;
    expect(turretAimFrom(45, 26, need, "RED").turretDeg).toBeCloseTo(0, 3);
  });

  it("turns half a turn with the field for blue", () => {
    const red = turretAimFrom(47.36, 131.79, 90, "RED");
    const blue = turretAimFrom(141.5 - 47.36, 141.5 - 131.79, 270, "BLUE");
    expect(blue.turretDeg).toBeCloseTo(red.turretDeg, 6);
    expect(blue.rangeIn).toBeCloseTo(red.rangeIn, 6);
  });

  it("is on the CELL only while a Pick flower and launch runs, and on the drive before it", () => {
    const spans = turretSpans({
      actions: [
        { command: "LaunchAll", t0: 0, t1: 3 },
        { command: "PickFlowerLaunch", t0: 12, t1: 18 },
      ],
      drives: [
        { t0: 3, t1: 5 },
        { t0: 10, t1: 12 },
      ],
    });
    expect(spans).toEqual([{ t0: 10, t1: 18 }]);
    expect(turretDegAt(2, -170, spans)).toBe(0);
    expect(turretDegAt(10 + TURRET_SWING_S / 2, -170, spans)).toBeCloseTo(-85);
    expect(turretDegAt(15, -170, spans)).toBe(-170);
    expect(turretDegAt(18 + TURRET_SWING_S, -170, spans)).toBeCloseTo(0);
    expect(turretDegAt(2, -170, spans, true)).toBe(-170);
  });
});
