import { describe, expect, test } from "vitest";
import { PRESETS } from "../../src/drill/presets";
import { DrillSession } from "../../src/drill/session";
import { CONTROLS, pad, rapier } from "./helpers";

// Same screen, one alliance: Ultraviolet (20245) and Infrared (19429) on one field, a driver each.

async function alliance(seed = 1) {
  const s = new DrillSession(
    await rapier(),
    CONTROLS,
    [
      { team: 20245, driverOnly: true },
      { team: 19429, driverOnly: true },
    ],
    "alliance",
    seed,
  );
  s.start();
  return s;
}
const place = (
  s: DrillSession,
  k: number,
  x: number,
  z: number,
  heading = 0,
) => {
  const b = s.sim.robots[k].body;
  b.setTranslation({ x, y: b.translation().y, z }, true);
  b.setRotation(
    { x: 0, y: Math.sin(heading / 2), z: 0, w: Math.cos(heading / 2) },
    true,
  );
};
const idle = { driver: pad(), operator: pad() };

describe("alliance drill", () => {
  test("two robots, each on its own numbers and its own end", async () => {
    const s = await alliance();
    expect(s.sim.robots).toHaveLength(2);
    expect(s.presets.map((p) => p.team)).toEqual([20245, 19429]);
    expect(s.ends).toEqual(["audience", "rear"]);
    // Each gamepad drives its own robot at its own top speed.
    place(s, 0, -1.5, 1.2);
    place(s, 1, -1.5, -1.2);
    s.advanceAll(2, [{ driver: pad([], { ly: -1 }), operator: pad() }, idle]);
    expect(s.sim.view(0).telemetry.speed / 0.0254).toBeCloseTo(
      PRESETS[20245].topSpeedInPerS,
      0,
    );
    expect(s.sim.view(1).telemetry.speed).toBeLessThan(0.01);
    s.advanceAll(2, [idle, { driver: pad([], { ly: -1 }), operator: pad() }]);
    expect(s.sim.view(1).telemetry.speed / 0.0254).toBeCloseTo(
      PRESETS[19429].topSpeedInPerS,
      0,
    );
  });

  test("the robots collide: one driven into the other does not pass through it", async () => {
    const s = await alliance();
    place(s, 0, -1.4, 1.2);
    place(s, 1, -0.9, 1.2);
    s.advanceAll(1.5, [{ driver: pad([], { ly: -1 }), operator: pad() }, idle]);
    const a = s.sim.robots[0].body.translation(),
      b = s.sim.robots[1].body.translation();
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(0.38);
    expect(a.x).toBeLessThan(b.x);
  });

  test("alliance TIPs count both robots' balls; each robot has its own split", async () => {
    const s = await alliance();
    // Both in front of our raised (audience) CELL, two balls each: four POLLEN on the three NECTAR.
    place(s, 0, -0.6, 1.3, 0);
    place(s, 1, -0.05, 1.3, Math.PI);
    s.advanceAll(0.3, [idle, idle]);
    s.sim.robots[0].carried = ["pollen", "pollen"];
    s.sim.robots[1].carried = ["pollen", "pollen"];
    const fire = { driver: pad(["CIRCLE"]), operator: pad() };
    s.advanceAll(3, [fire, fire]);
    s.advanceAll(8, [idle, idle]);
    expect(s.teleops[0].launched).toBe(2);
    expect(s.teleops[1].launched).toBe(2);
    expect(s.tips).toHaveLength(1);
    expect(s.readouts[0].cycles).toHaveLength(1);
    expect(s.readouts[1].cycles).toHaveLength(1);
    expect(s.readouts[1].cycles[0].spinUpAimS).toBeCloseTo(
      PRESETS[19429].spinUpFromIdleS,
      1,
    );
    const r = s.result("2026-11-23T00:00:00Z");
    expect(r.mode).toBe("alliance");
    expect(r.robots.map((x) => [x.team, x.balls, x.end])).toEqual([
      [20245, 2, "audience"],
      [19429, 2, "rear"],
    ]);
    // 19429 owns the rear end; this volley was at the audience CELL.
    expect(r.robots[1].volleysOffEnd).toBe(1);
    expect(r.robots[0].volleysOffEnd).toBe(0);
    expect(r.balls).toBe(4);
  }, 60000);
});
