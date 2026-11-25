import { describe, expect, test } from "vitest";
import type { ControlsFile } from "../../src/drill/controls";
import { validate } from "../../src/drill/controls";
import {
  HeadingLock,
  headingLockNumbers,
  nearestCardinalRad,
} from "../../src/drill/headingLock";
import { lockComparison, type CycleResult } from "../../src/drill/readout";
import { DrillSession } from "../../src/drill/session";
import lockJson from "../fixtures/biobuzz/controls-heading-lock.json";
import { CONTROLS, pad, rapier } from "./helpers";

// The driver's R1 heading lock (biobuzz HeadingLock.java, PR #748), on that PR's controls export:
// its numbers are the file's, and the turret toggle moves to the operator's Triangle, held.

const LOCK = lockJson as unknown as ControlsFile;
const NUMS = headingLockNumbers(LOCK.teleOp);
const deg = (r: number) => (r * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;

async function session(file = LOCK) {
  const s = new DrillSession(await rapier(), file, 20245, "two", 1);
  s.openingAuto = null;
  s.start();
  return s;
}
const place = (s: DrillSession, x: number, z: number, heading = 0) => {
  s.sim.robot.setTranslation({ x, y: s.sim.robot.translation().y, z }, true);
  s.sim.robot.setRotation(
    { x: 0, y: Math.sin(heading / 2), z: 0, w: Math.cos(heading / 2) },
    true,
  );
};

describe("HeadingLock, as the robot's", () => {
  test("the export carries the action and its numbers", () => {
    expect(() => validate(LOCK)).not.toThrow();
    expect(
      LOCK.layouts.turretAiming.find((b) => b.action === "HEADING_LOCK"),
    ).toMatchObject({ pad: "DRIVER", input: "R1" });
    expect(
      LOCK.layouts.turretAiming.find((b) => b.action === "TURRET_LOCK"),
    ).toMatchObject({ pad: "OPERATOR", input: "TRIANGLE" });
    expect(NUMS).toEqual({
      coneDeg: 20,
      stepDeg: 90,
      kp: 1.2,
      kd: 0,
      minTurn: 0.2,
      maxTurn: 0.6,
      stopDeg: 1.5,
    });
  });

  test("the press picks the nearest cardinal and holds it for the whole hold", () => {
    const k = new HeadingLock(NUMS);
    k.update(true, true, rad(50), 0, 0, 0, 0);
    expect(k.pressed).toBe(true);
    expect(deg(k.targetRad)).toBeCloseTo(90);
    expect(k.turn).toBeCloseTo(0.6 * Math.sign(1)); // 40° off: kp·0.70 = 0.84, capped at max
    k.update(true, true, rad(40), 0, 0, 0, 0.9); // past 45°: still 90, and the right stick is ignored
    expect(deg(k.targetRad)).toBeCloseTo(90);
    expect(k.turn).toBeGreaterThan(0);
    k.update(true, true, rad(89), 0, 0, 0, 0);
    expect(k.turn).toBeCloseTo(0); // inside the 1.5° stop band
    k.update(true, true, rad(85), 0, 0, 0, 0);
    expect(k.turn).toBeCloseTo(0.2); // 5° off: kp·0.087 = 0.10, raised to min
    // Let go: everything passes through, the target clears.
    k.update(false, true, rad(85), 0, 0.3, 0.1, -0.4);
    expect(k.released).toBe(true);
    expect([k.forward, k.strafe, k.turn]).toEqual([0.3, 0.1, -0.4]);
    expect(k.targetRad).toBeNaN();
    expect(deg(nearestCardinalRad(rad(-135.1), 90))).toBeCloseTo(-180 + 360);
  });

  test("the left stick snaps to an axis within the cone and passes outside it", () => {
    const k = new HeadingLock(NUMS);
    const at = (a: number, m = 0.8) => {
      k.update(true, true, 0, 0, m * Math.cos(rad(a)), m * Math.sin(rad(a)), 0);
      return [k.forward, k.strafe];
    };
    expect(at(15)).toEqual([0.8, 0]);
    expect(at(-105)).toEqual([0, -0.8]);
    expect(at(175)).toEqual([-0.8, 0]);
    const [f, s] = at(30);
    expect(f).toBeCloseTo(0.8 * Math.cos(rad(30)));
    expect(s).toBeCloseTo(0.8 * Math.sin(rad(30)));
    // No heading: the stick snap only, and the turn passes through.
    k.update(false, true, 0, 0, 0, 0, 0);
    k.update(true, false, NaN, 0, 0.5, 0.05, 0.3);
    expect([k.holding, k.forward, k.strafe, k.turn]).toEqual([
      false,
      Math.hypot(0.5, 0.05),
      0,
      0.3,
    ]);
  });

  test("the guards: cone 0 to 45, step a whole fraction of a turn, NaN to the defaults", () => {
    const g = (v: Partial<typeof NUMS>) => new HeadingLock({ ...NUMS, ...v });
    expect(g({ coneDeg: 80 }).coneDeg()).toBe(45);
    expect(g({ coneDeg: NaN }).coneDeg()).toBe(0);
    expect(g({ stepDeg: NaN }).stepDeg()).toBe(90);
    expect(g({ stepDeg: 0 }).stepDeg()).toBe(90);
    expect(g({ stepDeg: 50 }).stepDeg()).toBeCloseTo(360 / 7);
    expect(g({ stepDeg: 1 }).stepDeg()).toBe(15);
  });
});

describe("the drill's R1", () => {
  test("held, the robot turns to the nearest cardinal and holds it; the right stick is ignored", async () => {
    const s = await session();
    place(s, -0.6, 0.6, rad(30));
    s.advance(0.05);
    s.advance(2, pad(["R1"], { rx: 0.8 }));
    expect(Math.abs(deg(s.sim.heading))).toBeLessThan(3);
    expect(s.teleop.status().headingLock).toBe("holding 0°");
    // Let go: the right stick turns the robot again.
    s.advance(0.6, pad([], { rx: 0.8 }));
    expect(Math.abs(deg(s.sim.heading))).toBeGreaterThan(10);
    expect(s.teleop.status().headingLock).toBe("");
  }, 60000);

  test("held, a stick 15° off the field's forward drives dead along it", async () => {
    const drift = async (held: string[]) => {
      const s = await session();
      place(s, -1.3, 0.9, 0);
      s.advance(0.05);
      const z0 = s.sim.robot.translation().z;
      const a = rad(15);
      // Field-centric for red: up is +X; right (lx +) is +Z.
      s.advance(
        0.8,
        pad(held, { ly: -0.7 * Math.cos(a), lx: 0.7 * Math.sin(a) }),
      );
      const p = s.sim.robot.translation();
      return Math.abs(p.z - z0);
    };
    expect(await drift(["R1"])).toBeLessThan(0.01);
    expect(await drift([])).toBeGreaterThan(0.05);
  }, 60000);

  test("the turret toggle is the operator's Triangle held 0.5 s, not the driver's R1", async () => {
    const s = await session();
    expect(s.teleop.turretMode).toBe("AIM");
    s.advance(0.1, pad(["R1"]));
    s.advance(0.05);
    expect(s.teleop.turretMode).toBe("AIM");
    s.advance(0.3, pad(), pad(["TRIANGLE"])); // brushed: nothing
    s.advance(0.05);
    expect(s.teleop.turretMode).toBe("AIM");
    s.advance(1.2, pad(), pad(["TRIANGLE"])); // held past 0.5 s: once
    expect(s.teleop.turretMode).toBe("LOCKED");
    s.advance(0.05);
    s.advance(0.6, pad(), pad(["TRIANGLE"]));
    expect(s.teleop.turretMode).toBe("AIM");
  }, 60000);

  test("with master's export (no HEADING_LOCK yet), R1 still toggles the turret on the press", async () => {
    const s = await session(CONTROLS);
    s.advance(0.05, pad(["R1"]));
    s.advance(0.05);
    expect(s.teleop.turretMode).toBe("LOCKED");
    expect(s.teleop.status().headingLock).toBe("");
  }, 60000);
});

describe("the readout's comparison", () => {
  const cyc = (cycleS: number, headingLock: boolean) =>
    ({ cycleS, headingLock }) as CycleResult;
  test("medians with and without R1, once a run has both", () => {
    expect(lockComparison([cyc(9, true), cyc(8, true)])).toBeNull();
    expect(
      lockComparison([
        cyc(9, true),
        cyc(8, true),
        cyc(7.5, true),
        cyc(11, false),
      ]),
    ).toEqual({ withN: 3, withMedianS: 8, withoutN: 1, withoutMedianS: 11 });
  });
});
