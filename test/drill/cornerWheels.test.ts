import { describe, expect, test } from "vitest";
import { FIELD } from "../../sim/src/sim/config";
import { DrillSession } from "../../src/drill/session";
import { CONTROLS, pad, rapier } from "./helpers";

// Corner wheels (an experiment), where biobuzz's study puts them (doc/corner-wheels.md): a 2.5 in
// wheel 1.37 in ahead of the robot's front at |Y| 6.85 to 6.95 in, outside the 9.7 in mouth
// (|Y| 4.87). A POLLEN in line with a wheel, met while the robot creeps forward, is swept into the
// mouth with the wheels on and only pushed along with them off.

const IN = 0.0254;

async function creepInto(wheels: boolean, lateralIn: number) {
  const s = new DrillSession(await rapier(), CONTROLS, 20245, "driver", 1);
  s.cornerWheels = wheels;
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
  // 8 in ahead of the front, `lateralIn` toward the robot's left; then forward slowly (red: +X).
  const p = sim.toWorld(sim.cfg.length / 2 + 8 * IN, lateralIn * IN);
  sim.spawn("pollen", p.x, FIELD.pollenRadius + 0.001, p.z);
  s.advance(2.5, pad([], { ly: -0.18 }));
  return { s, taken: sim.carried.length };
}

describe("corner wheels", () => {
  test("off: a POLLEN in line with the left wheel, outside the mouth, is pushed, not taken", async () => {
    const { taken, s } = await creepInto(false, 6.85);
    expect(taken).toBe(0);
    expect(s.teleop.cornerRakes).toBe(0);
    expect(s.result().cornerWheels).toBeUndefined();
  }, 60000);

  test("on: the wheel sweeps it into the mouth, and in it goes", async () => {
    const { taken, s } = await creepInto(true, 6.85);
    expect(s.teleop.cornerRakes).toBeGreaterThan(0);
    expect(taken).toBe(1);
    expect(s.result().cornerWheels).toBe(true);
  }, 60000);

  test("on: the right wheel too", async () => {
    const { taken } = await creepInto(true, -6.95);
    expect(taken).toBe(1);
  }, 60000);

  test("on: one 12 in out, past both wheels, is left alone", async () => {
    const { taken, s } = await creepInto(true, 12);
    expect(taken).toBe(0);
    expect(s.teleop.cornerRakes).toBe(0);
  }, 60000);
});
