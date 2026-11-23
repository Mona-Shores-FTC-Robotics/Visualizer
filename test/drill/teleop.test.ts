import { describe, expect, test } from "vitest";
import { REQUIRED, validate } from "../../src/drill/controls";
import { PRESETS } from "../../src/drill/presets";
import { DrillSession } from "../../src/drill/session";
import { CONTROLS, pad, rapier } from "./helpers";

// The drill's TeleOp against what the robot's TeleOp does, on the controls biobuzz exports.

async function session(
  team: 19429 | 20245 = 20245,
  mode: "two" | "driver" = "two",
  seed = 1,
) {
  const s = new DrillSession(await rapier(), CONTROLS, team, mode, seed);
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

describe("controls come from biobuzz's export", () => {
  test("the export binds every action the drill runs, and Circle is the driver's fire", () => {
    expect(() => validate(CONTROLS)).not.toThrow();
    const fire = CONTROLS.layouts.turretAiming.find(
      (b) => b.action === "CHASSIS_AIM",
    )!;
    expect(fire).toMatchObject({ pad: "DRIVER", input: "CIRCLE" });
    expect(
      CONTROLS.layouts.turretAiming.find((b) => b.action === "TURRET_LOCK"),
    ).toMatchObject({ pad: "DRIVER", input: "R1" });
    // In a match the operator's Circle is the fine-trim modifier, never a fire.
    expect(
      CONTROLS.layouts.turretAiming
        .filter((b) => b.pad === "OPERATOR" && b.input === "CIRCLE")
        .map((b) => b.action),
    ).toEqual(["FINE_TRIM"]);
    expect(REQUIRED.length).toBeGreaterThan(5);
  });

  test("a file missing an action is refused", () => {
    const bad = structuredClone(CONTROLS);
    bad.layouts.turretAiming = bad.layouts.turretAiming.filter(
      (b) => b.action !== "CHASSIS_AIM",
    );
    expect(() => validate(bad)).toThrow(/CHASSIS_AIM/);
  });
});

describe("drive", () => {
  test("field-centric: up on the left stick drives away from our wall whatever the heading", async () => {
    const s = await session();
    place(s, -1.5, 1.2, Math.PI / 2); // turned to face the rear wall
    s.advance(0.1);
    const a = s.sim.robot.translation();
    s.advance(1.0, pad([], { ly: -1 }));
    const b = s.sim.robot.translation();
    expect(b.x - a.x).toBeGreaterThan(0.6);
    expect(Math.abs(b.z - a.z)).toBeLessThan(0.05);
  });

  test("top speed and acceleration are the robot's", async () => {
    const s = await session(19429);
    place(s, -1.5, -1.2);
    s.advance(0.1);
    s.advance(0.3, pad([], { ly: -1 }));
    const early = s.sim.telemetry.speed / 0.0254;
    s.advance(1.2, pad([], { ly: -1 }));
    const top = s.sim.telemetry.speed / 0.0254;
    expect(top).toBeCloseTo(PRESETS[19429].topSpeedInPerS, 0);
    // About accel × 0.3 s after the first loop.
    expect(early).toBeLessThan(PRESETS[19429].accelInPerS2 * 0.32);
    expect(early).toBeGreaterThan(PRESETS[19429].accelInPerS2 * 0.2);
  });

  test("L1 is slow: the TeleOp's slowSpeed", async () => {
    const s = await session();
    place(s, -1.5, -1.2);
    s.advance(2.0, pad(["L1"], { ly: -1 }));
    expect(s.sim.telemetry.speed / 0.0254).toBeCloseTo(
      PRESETS[20245].topSpeedInPerS * Number(CONTROLS.teleOp.slowSpeed),
      0,
    );
  });
});

describe("turret and fire", () => {
  test("R1 toggles AIM and LOCKED; LOCKED, Circle turns the robot onto the CELL and fires", async () => {
    const s = await session();
    place(s, -0.32, 1.3, Math.PI); // facing the red wall, the CELL off to its right
    expect(s.teleop.turretMode).toBe("AIM");
    s.advance(0.05, pad(["R1"]));
    s.advance(0.05);
    expect(s.teleop.turretMode).toBe("LOCKED");
    s.sim.carried = ["pollen", "pollen", "pollen", "pollen"];
    const h0 = s.sim.heading;
    s.advance(4, pad(["CIRCLE"]));
    expect(Math.abs(s.sim.heading - h0)).toBeGreaterThan(1);
    expect(s.teleop.launched).toBe(4);
    expect(Math.abs(s.teleop.turretDeg)).toBeLessThan(1);
  });

  test("AIM, the turret tracks the CELL; an aim behind the arc turns the robot just far enough (circleTurnsIntoArc)", async () => {
    const s = await session();
    // Back to the CELL (facing the audience wall): the aim is behind the arc.
    place(s, -0.32, 1.3, -Math.PI / 2);
    s.advance(0.5);
    expect(s.teleop.status().insideArc).toBe(false);
    s.sim.carried = ["pollen", "pollen", "pollen", "pollen"];
    s.advance(0.4, pad(["CIRCLE"]));
    expect(s.teleop.status().arcTurning).toBe(true);
    s.advance(4, pad(["CIRCLE"]));
    expect(s.teleop.status().insideArc).toBe(true);
    expect(s.teleop.launched).toBe(4);
  });

  test("letting go of Circle shuts the gate mid-volley", async () => {
    const s = await session();
    place(s, -0.32, 1.3, 0);
    s.advance(0.5);
    s.sim.carried = ["pollen", "pollen", "pollen", "pollen"];
    s.advance(1.5, pad(["CIRCLE"]));
    const n = s.teleop.launched;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(4);
    s.advance(2);
    expect(s.teleop.launched).toBe(n);
  });

  test("the operator's spin-up makes the press-to-gate the spun-up time", async () => {
    const s = await session(19429);
    place(s, -0.32, 1.3, 0);
    s.advance(0.1, pad(), pad(["CROSS"]));
    s.advance(1.0);
    s.sim.carried = ["pollen", "pollen", "pollen", "pollen"];
    s.advance(3.5, pad(["CIRCLE"]));
    s.advance(1.5);
    expect(s.readout.cycles[0].spinUpAimS).toBeCloseTo(
      PRESETS[19429].spinUpWhenSpunS,
      1,
    );
  });

  test("driver only: gamepad 2 does nothing", async () => {
    const s = await session(20245, "driver");
    s.advance(0.1, pad(), pad(["CROSS"]));
    expect(s.teleop.status().launcher).toBe("IDLE");
  });
});

describe("FLOWER pick and GARDEN gather", () => {
  test("Cross held squares up to the FLOWER and picks for the logged time", async () => {
    const s = await session(20245, "two", 7);
    const f = s.sim.flowers.find((q) => q.id === "red")!;
    place(s, f.x + 0.5, f.z, Math.PI);
    const before = f.stack.length;
    let t = 0;
    while (s.teleop.status().routine?.includes("squaring") !== false && t < 4) {
      s.advance(0.1, pad(["CROSS"]));
      t += 0.1;
      if (s.teleop.status().routine?.includes("picking")) break;
    }
    expect(s.teleop.status().routine).toContain("picking");
    const start = s.t;
    while (s.teleop.status().routine && s.t - start < 8)
      s.advance(0.1, pad(["CROSS"]));
    expect(s.t - start).toBeCloseTo(PRESETS[20245].flowerPick.seconds, 0);
    expect(before - f.stack.length).toBe(s.sim.carried.length);
  });

  test("a stick moved after the press hands the robot back", async () => {
    const s = await session();
    const f = s.sim.flowers.find((q) => q.id === "red")!;
    place(s, f.x + 0.5, f.z, Math.PI);
    s.advance(0.3, pad(["CROSS"]));
    expect(s.teleop.status().routine).not.toBeNull();
    s.advance(0.1, pad(["CROSS"], { lx: 0.8 }));
    expect(s.teleop.status().routine).toBeNull();
  });
});

describe("the drill", () => {
  test("ends at 2:00 and counts TIPs settled by then", async () => {
    const s = await session();
    place(s, -0.32, 1.3, 0);
    s.advance(0.3);
    s.sim.carried = ["pollen", "pollen", "pollen", "pollen"];
    s.advance(3, pad(["CIRCLE"]));
    s.advance(118);
    expect(s.finished).toBe(true);
    const r = s.result("2026-11-23T00:00:00Z");
    expect(r.tips).toBe(1);
    expect(r.cycles).toHaveLength(1);
    expect(r.goalAtS).toBeNull();
  }, 60000);
});

describe("the aim is our CELL at the robot's end, up or down (TurretAimer)", () => {
  test("past the band the near-end CELL is chosen; inside it the last one is kept", async () => {
    const s = await session();
    place(s, -1.2, 1.0, 0);
    s.advance(0.1);
    expect(s.teleop.status().nearCell).toBe("audience");
    expect(s.teleop.status().nearCellUp).toBe(true); // red starts with its audience CELL up
    place(s, -1.2, 0.2, 0); // inside the 19.75 in band: unchanged
    s.advance(0.1);
    expect(s.teleop.status().nearCell).toBe("audience");
    place(s, -1.2, -1.0, 0);
    s.advance(0.1);
    expect(s.teleop.status().nearCell).toBe("rear");
    expect(s.teleop.status().nearCellUp).toBe(false);
  });

  test("a volley at the down CELL does nothing toward a TIP", async () => {
    const s = await session();
    place(s, -0.32, -1.3, 0); // the rear end: our down CELL
    s.advance(0.3);
    s.sim.carried = ["pollen", "pollen", "pollen", "pollen"];
    s.advance(3, pad(["CIRCLE"]));
    s.advance(6);
    expect(s.teleop.launched).toBe(4);
    expect(s.sim.cellCount("red")).toBe(3);
    expect(s.tips).toHaveLength(0);
  });
});
