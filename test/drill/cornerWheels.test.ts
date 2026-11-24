import { describe, expect, test } from "vitest";
import { FIELD } from "../../sim/src/sim/config";
import { DrillSession } from "../../src/drill/session";
import { CONTROLS, rapier } from "./helpers";

// Corner wheels (an experiment): a POLLEN at a front corner of the intake, just outside the mouth,
// is raked in with the wheels on and stays put with them off.

const IN = 0.0254;

async function cornerPiece(wheels: boolean, lateralIn: number) {
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
  // On the front face, `lateralIn` off the centre line toward the robot's left.
  const p = sim.toWorld(
    sim.cfg.length / 2 + FIELD.pollenRadius + 0.002,
    lateralIn * IN,
  );
  const b = sim.spawn("pollen", p.x, FIELD.pollenRadius + 0.001, p.z);
  s.advance(1.5);
  return { s, taken: sim.carried.length, ball: b };
}

describe("corner wheels", () => {
  // The frame is 16.2 in and the mouth 14.58 in (sim mona-shores.json): a piece centred 7.6 in off
  // the centre line is outside the mouth (7.29 in) but in the wheel's zone (from 7.1 in).
  test("off: a POLLEN at the front corner, outside the mouth, is not taken", async () => {
    const { taken, s } = await cornerPiece(false, 7.6);
    expect(taken).toBe(0);
    expect(s.teleop.cornerRakes).toBe(0);
    expect(s.result().cornerWheels).toBeUndefined();
  }, 60000);

  test("on: the wheel rakes it into the mouth, and in it goes", async () => {
    const { taken, s } = await cornerPiece(true, 7.6);
    expect(s.teleop.cornerRakes).toBeGreaterThan(0);
    expect(taken).toBe(1);
    expect(s.result().cornerWheels).toBe(true);
  }, 60000);

  test("on: a piece just past the corner (8.5 in off the centre line) is raked in too", async () => {
    const { taken } = await cornerPiece(true, 8.5);
    expect(taken).toBe(1);
  }, 60000);

  test("on: one well past the wheel's reach (11 in: the zone ends at 8.1 + 0.5 + the 1.4 in radius) is left alone", async () => {
    const { taken, s } = await cornerPiece(true, 11);
    expect(taken).toBe(0);
    expect(s.teleop.cornerRakes).toBe(0);
  }, 60000);
});
