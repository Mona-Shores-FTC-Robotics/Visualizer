import { describe, expect, test } from "vitest";
import {
  cornerWaysIn,
  nearestCorner,
  type CornerWayIn,
} from "../../sim/src/sim/robots/routines";
import { DrillSession } from "../../src/drill/session";
import { CONTROLS, pad, rapier } from "./helpers";

// Triangle: the TeleOp's corner gather (biobuzz GardenGather.java with Button.anyCorner, on
// GrabRoutine; GardenFieldPoints.CORNERS and nearestCorner), not the Auto's GARDEN card.

const IN = 0.0254;
const C = 70.75;

async function session() {
  const s = new DrillSession(await rapier(), CONTROLS, 20245, "two", 1);
  s.start();
  return s;
}
/** Puts the robot at a Pedro pose (inches, degrees). */
function placePedro(s: DrillSession, x: number, y: number, hDeg: number) {
  const h = (hDeg * Math.PI) / 180;
  s.sim.robot.setTranslation(
    { x: (x - C) * IN, y: s.sim.robot.translation().y, z: -(y - C) * IN },
    true,
  );
  s.sim.robot.setRotation(
    { x: 0, y: Math.sin(h / 2), z: 0, w: Math.cos(h / 2) },
    true,
  );
}
/** 30 in back out from a way in's gather pose, 6 in off its line, turned 20° off its heading. */
function startFor(w: CornerWayIn): [number, number, number] {
  const h = (w.gather.h * Math.PI) / 180;
  return [
    w.gather.x - 30 * Math.cos(h) + 6 * Math.sin(h),
    w.gather.y - 30 * Math.sin(h) - 6 * Math.cos(h),
    w.gather.h + 20,
  ];
}
/**
 * Takes the loose pieces within 30 in of a way in's gather pose off the field, so the drive-in is measured alone: a
 * piece pinned between the nose and a wall now holds the robot off (sim #198), as on the real field.
 */
function clearCorner(s: DrillSession, w: CornerWayIn) {
  const keep = [...s.sim.balls.values()]
    .filter((b) => b.body.isEnabled())
    .map((b) => ({ kind: b.kind, ...b.body.translation() }))
    .filter((p) => Math.abs(p.x) < 1.79 && Math.abs(p.z) < 1.79 && p.y < 0.2)
    .filter((p) => Math.hypot(p.x / IN + C - w.gather.x, C - p.z / IN - w.gather.y) > 30);
  s.sim.handoff({}, 1, { pieces: keep });
}
/** Holds Triangle until the gather ends; the closest the robot came to the gather pose, inches. */
function holdGather(s: DrillSession, w: CornerWayIn, max = 12) {
  const t0 = s.t;
  const phases: string[] = [];
  let closest = Infinity;
  s.advance(0.05, pad(["TRIANGLE"]));
  while (s.teleop.status().routine && s.t - t0 < max) {
    const ph = s.teleop.status().routine!.split(": ").pop()!;
    if (phases.at(-1) !== ph) phases.push(ph);
    const p = s.sim.robot.translation();
    closest = Math.min(
      closest,
      Math.hypot(p.x / IN + C - w.gather.x, C - p.z / IN - w.gather.y),
    );
    s.advance(0.05, pad(["TRIANGLE"]));
  }
  return { t: s.t - t0, phases, closest };
}

describe("which corner (GardenFieldPoints.nearestCorner)", () => {
  test("eight ways in, two per corner, each pair facing the corner's two walls", () => {
    const ways = cornerWaysIn();
    expect(ways).toHaveLength(8);
    // Red's own: the GARDEN facing the audience wall, and that reflected across the corner's diagonal.
    expect(ways[0].gather).toEqual({ x: 8.5, y: 9.5, h: 270 });
    expect(ways[1].gather).toEqual({ x: 9.5, y: 8.5, h: -180 });
    for (let k = 0; k < 4; k++) {
      const a = ways[2 * k].gather,
        b = ways[2 * k + 1].gather;
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(2);
      const d = (((a.h - b.h) % 360) + 360) % 360;
      expect(Math.min(d, 360 - d)).toBeCloseTo(90, 5);
    }
  });

  test("the heading picks the wall: the line-up turns at most 45°", () => {
    expect(nearestCorner(25, 25, 280, 45)?.name).toBe(
      "red GARDEN corner, facing the audience wall",
    );
    expect(nearestCorner(25, 25, 190, 45)?.name).toBe(
      "red GARDEN corner, facing the side wall",
    );
    expect(nearestCorner(120, 20, 280, 45)?.name).toMatch(
      /^audience blue-side/,
    );
    expect(nearestCorner(70, 70, 0, 45)).toBeNull();
  });
});

describe("Triangle held: the corner gather", () => {
  for (const w of cornerWaysIn()) {
    test(`${w.name}: lines up, drives in to the corner, dwells and backs out`, async () => {
      const s = await session();
      placePedro(s, ...startFor(w));
      clearCorner(s, w); // the drive-in alone; a pinned piece's hold is tested in sim/test/ball-pinch.test.ts
      s.advance(0.3);
      s.sim.carried = [];
      const r = holdGather(s, w);
      expect(s.teleop.status().note).toMatch(/GARDEN gather done/);
      expect(r.phases[0]).toBe("lineup");
      expect(r.phases).toEqual(
        expect.arrayContaining(["in", "dwell", "back", "raise"]),
      );
      expect(r.closest).toBeLessThan(4);
      expect(r.t).toBeLessThan(6);
      expect(s.sim.robots[s.sim.me].stickDown).toBe(false);
    }, 60000);
  }

  test("at our GARDEN, facing either wall, three of its four POLLEN come in", async () => {
    for (const w of cornerWaysIn().slice(0, 2)) {
      const s = await session();
      placePedro(s, ...startFor(w));
      s.advance(0.3);
      s.sim.carried = [];
      holdGather(s, w);
      expect(s.sim.carried.length, w.name).toBe(3);
    }
  }, 60000);

  test("no corner within 45 in: refused with the robot's line, and nothing moves", async () => {
    const s = await session();
    placePedro(s, 60, 60, 0);
    s.advance(0.5);
    const a = s.sim.robot.translation();
    s.advance(1, pad(["TRIANGLE"]));
    const b = s.sim.robot.translation();
    expect(s.teleop.status().note).toMatch(/no field corner within 45 in/);
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(1e-3);
  }, 60000);

  test("let go in the dwell, it backs out on its own (GrabRoutine.releaseFinishes)", async () => {
    const w = cornerWaysIn()[0];
    const s = await session();
    placePedro(s, ...startFor(w));
    s.advance(0.3);
    const t0 = s.t;
    while (!s.teleop.status().routine?.endsWith("dwell") && s.t - t0 < 6)
      s.advance(0.05, pad(["TRIANGLE"]));
    expect(s.teleop.status().routine).toMatch(/dwell$/);
    s.advance(0.05); // let go
    expect(s.teleop.status().routine).not.toBeNull();
    let t = 0;
    while (s.teleop.status().routine && t < 4) {
      s.advance(0.05);
      t += 0.05;
    }
    expect(s.teleop.status().note).toMatch(/GARDEN gather done/);
  }, 60000);

  test("let go in the line-up, it stops at once; a stick in the dwell stops it too", async () => {
    const w = cornerWaysIn()[0];
    const s = await session();
    placePedro(s, ...startFor(w));
    s.advance(0.3);
    s.advance(0.2, pad(["TRIANGLE"]));
    expect(s.teleop.status().routine).toMatch(/lineup$/);
    s.advance(0.05);
    expect(s.teleop.status().routine).toBeNull();
    // Again, to the dwell, then a stick.
    s.advance(0.5);
    placePedro(s, ...startFor(w));
    s.advance(0.3);
    const t0 = s.t;
    while (!s.teleop.status().routine?.endsWith("dwell") && s.t - t0 < 6)
      s.advance(0.05, pad(["TRIANGLE"]));
    s.advance(0.05, pad(["TRIANGLE"], { lx: 0.8 }));
    expect(s.teleop.status().routine).toBeNull();
    expect(s.teleop.status().note).toMatch(/sticks moved/);
  }, 60000);
});
