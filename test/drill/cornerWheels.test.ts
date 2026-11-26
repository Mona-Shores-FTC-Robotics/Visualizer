import { describe, expect, test } from "vitest";
import { FIELD } from "../../sim/src/sim/config";
import { DrillSession } from "../../src/drill/session";
import {
  CORNER_WHEEL_FACE_X_IN,
  CORNER_WHEEL_GRAB_AHEAD_IN,
  CORNER_WHEEL_RAKE_IN_PER_S,
  wheelIntakeReach,
} from "../../src/drill/cornerWheels";
import { CONTROLS, pad, rapier } from "./helpers";

// The corner wheels both robots have (biobuzz #756, mentor 26 Nov 2026): an upright 3.5 in SWYFT
// wheel at each front corner, faces at X 9.3 in, axles at Y +-6.9 in, outside the 9.7 in mouth
// (|Y| 4.87). Calibrated from the mentor's clip: a ball pressed on a wheel goes inward at about
// 6.3 in/s, and the intake grabs a ball about 1.2 in ahead of the wheel faces.

const IN = 0.0254;
const R = FIELD.pollenRadius;

async function bare(wheels?: boolean) {
  const s = new DrillSession(await rapier(), CONTROLS, 20245, "driver", 1);
  if (wheels !== undefined) s.cornerWheels = wheels;
  s.start();
  const sim = s.sim;
  for (const b of [...sim.balls.values()]) {
    sim.world.removeRigidBody(b.body);
    sim.balls.delete(b.id);
  }
  sim.carried = [];
  const body = sim.robot;
  body.setTranslation({ x: 0.9, y: body.translation().y, z: -1.0 }, true);
  body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  s.advance(0.2);
  return s;
}

async function creepInto(wheels: boolean | undefined, lateralIn: number) {
  const s = await bare(wheels);
  const sim = s.sim;
  // 8 in ahead of the front, `lateralIn` toward the robot's left; then forward slowly (red: +X).
  const p = sim.toWorld(sim.cfg.length / 2 + 8 * IN, lateralIn * IN);
  sim.spawn("pollen", p.x, R + 0.001, p.z);
  s.advance(2.5, pad([], { ly: -0.18 }));
  return { s, taken: sim.carried.length };
}

describe("corner wheels", () => {
  test("on by default: both robots have them", async () => {
    const s = new DrillSession(await rapier(), CONTROLS, 20245, "two", 1);
    expect(s.cornerWheels).toBe(true);
    const t = new DrillSession(await rapier(), CONTROLS, 19429, "two", 1);
    expect(t.cornerWheels).toBe(true);
  }, 60000);

  test("off: a POLLEN in line with the left wheel, outside the mouth, is pushed, not taken", async () => {
    const { taken, s } = await creepInto(false, 6.9);
    expect(taken).toBe(0);
    expect(s.teleop.cornerRakes).toBe(0);
    expect(s.result().cornerWheels).toBeUndefined();
  }, 60000);

  test("on: the wheel sweeps it into the mouth, and in it goes", async () => {
    const { taken, s } = await creepInto(undefined, 6.9);
    expect(s.teleop.cornerRakes).toBeGreaterThan(0);
    expect(taken).toBe(1);
    expect(s.result().cornerWheels).toBe(true);
  }, 60000);

  test("on: the right wheel too", async () => {
    const { taken } = await creepInto(undefined, -6.9);
    expect(taken).toBe(1);
  }, 60000);

  test("on: one 12 in out, past both wheels, is left alone", async () => {
    const { taken, s } = await creepInto(undefined, 12);
    expect(taken).toBe(0);
    expect(s.teleop.cornerRakes).toBe(0);
  }, 60000);

  test("the clip: a ball pressed on a wheel goes inward at about 6.3 in/s", async () => {
    const s = await bare();
    const sim = s.sim;
    // Pressed on the left wheel's face, the robot still.
    const p = sim.toWorld((CORNER_WHEEL_FACE_X_IN + 0.02) * IN + R, 7.4 * IN);
    const id = sim.spawn("pollen", p.x, R + 0.001, p.z).id;
    s.advance(1 / 48);
    const l0 = sim.toRobot(
      sim.balls.get(id)!.body.translation().x,
      sim.balls.get(id)!.body.translation().z,
    ).l;
    s.advance(0.1);
    const q = sim.balls.get(id)!.body.translation();
    const speed = (l0 - sim.toRobot(q.x, q.z).l) / 0.1 / IN;
    expect(speed).toBeGreaterThan(CORNER_WHEEL_RAKE_IN_PER_S * 0.8);
    expect(speed).toBeLessThan(CORNER_WHEEL_RAKE_IN_PER_S * 1.2);
  }, 60000);

  test("the clip: the intake grabs a ball 1.2 in ahead of the wheel faces", async () => {
    const s = await bare();
    expect((s.sim.cfg.length / 2 + s.sim.cfg.intake.reach) / IN).toBeCloseTo(
      CORNER_WHEEL_FACE_X_IN + CORNER_WHEEL_GRAB_AHEAD_IN,
      6,
    );
    expect(wheelIntakeReach(s.sim.cfg.length / 2)).toBeCloseTo(
      s.sim.cfg.intake.reach,
      9,
    );
    // Off: the simulator's own reach comes back.
    s.cornerWheels = false;
    s.advance(1 / 48);
    expect(s.sim.cfg.intake.reach).toBeLessThan(
      wheelIntakeReach(s.sim.cfg.length / 2),
    );
  }, 60000);

  // Seed 2: the intake's grab chance (0.85, a PLACEHOLDER) takes every piece first time; over seeds
  // 1 to 10 both robots get all 4 in 9 runs, and 3 in the other.
  test("GARDEN gather (Triangle): the stick stays up, the wheels rake through it, and the row of 4 comes in", async () => {
    const s = new DrillSession(await rapier(), CONTROLS, 20245, "driver", 2);
    s.openingAuto = null;
    s.start();
    const sim = s.sim;
    sim.carried = [];
    // 24 in out from our GARDEN's row, facing the audience wall (red: +Z).
    const h = -Math.PI / 2;
    sim.robot.setTranslation(
      { x: -1.55, y: sim.robot.translation().y, z: 1.1 },
      true,
    );
    sim.robot.setRotation(
      { x: 0, y: Math.sin(h / 2), z: 0, w: Math.cos(h / 2) },
      true,
    );
    s.advance(0.1);
    const t0 = s.t;
    let stickEver = false,
      wheelsInGather = false,
      firstIn = NaN;
    while (s.t - t0 < 6) {
      s.advance(1 / 48, pad(["TRIANGLE"]));
      stickEver ||= !!sim.robots[sim.me].stickDown;
      const routine = s.teleop.status().routine;
      if (routine?.startsWith("GARDEN gather") && s.teleop.cornerWheelsRunning)
        wheelsInGather = true;
      if (sim.carried.length && Number.isNaN(firstIn)) firstIn = s.t - t0;
      if (!routine && s.t - t0 > 0.5) break;
    }
    expect(stickEver).toBe(false);
    expect(wheelsInGather).toBe(true);
    expect(sim.carried.length).toBe(4);
    // From the press, line-up included (about 0.9 s): the first in within 2 s, the whole gather within 4 s.
    expect(firstIn).toBeLessThan(2);
    expect(s.t - t0).toBeLessThan(4);
  }, 60000);
});
