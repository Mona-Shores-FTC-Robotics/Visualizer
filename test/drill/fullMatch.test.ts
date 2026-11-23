import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  HANDOFF_S,
  fieldAtHandoff,
  type AutoTrace,
} from "../../src/drill/fullMatch";
import { FIELD } from "../../sim/src/sim/config";
import { toPedro } from "../../src/drill/launchSpot";
import { DrillSession } from "../../src/drill/session";
import { CONTROLS, pad, rapier } from "./helpers";

// Full Match: one of our Autos replayed from its AutoSim trace, then TeleOp from where it ended.

const trace = (auto: string) =>
  JSON.parse(
    readFileSync(
      resolve(import.meta.dirname, `../../public/drill/autos/${auto}.json`),
      "utf8",
    ),
  ) as AutoTrace;

async function fullMatch(auto: string) {
  const s = new DrillSession(await rapier(), CONTROLS, 20245, "two", 1);
  s.playAuto(trace(auto));
  s.start();
  return s;
}
const pedro = (s: DrillSession) => {
  const p = s.sim.robot.translation();
  return toPedro(p.x, p.z, s.sim.heading);
};

describe("Full Match", () => {
  test("the AUTO plays the trace: the robot follows it, the clock counts the AUTO's 30 s, the pads do nothing", async () => {
    const t = trace("r-no-cross");
    const s = await fullMatch("r-no-cross");
    expect(s.phase).toBe("auto");
    expect(s.remainingS).toBe(30);
    s.advance(10, pad(["SQUARE", "CIRCLE"], { ly: -1 }));
    expect(s.phase).toBe("auto");
    expect(s.remainingS).toBeCloseTo(20, 6);
    const f = t.frames[100];
    const at = pedro(s);
    expect(at[0]).toBeCloseTo(f[1], 1);
    expect(at[1]).toBeCloseTo(f[2], 1);
    expect(s.teleop.launched).toBe(0);
    s.advance(21);
    expect(s.phase).toBe("transition");
    expect(s.remainingS).toBeCloseTo(HANDOFF_S - 31, 6);
  }, 60000);

  test("at 2:00 TeleOp starts where the Auto ended: pose, lane, HIVE and the AUTO's TIPs", async () => {
    const t = trace("r-no-cross");
    const s = await fullMatch("r-no-cross");
    s.advance(HANDOFF_S);
    expect(s.phase).toBe("teleop");
    expect(s.remainingS).toBe(120);
    const at = pedro(s);
    expect(at[0]).toBeCloseTo(t.handoff.pose.x, 1);
    expect(at[1]).toBeCloseTo(t.handoff.pose.y, 1);
    expect(s.sim.carried).toHaveLength(t.handoff.held);
    expect(s.sim.hives.red.tips).toBe(t.autoTips);
    expect(s.sim.hives.red.upCell).toBe(t.handoff.hives.red.up);
    expect(s.totalTips).toBe(t.autoTips);
    // TeleOp runs: the sticks drive.
    const a = s.sim.robot.translation();
    s.advance(1, pad([], { ly: -1 }));
    const b = s.sim.robot.translation();
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(0.2);
  }, 60000);

  test("the field's pieces go where the Auto left them: each FLOWER's stack and the floor", async () => {
    for (const auto of ["r-no-cross", "l-clockwise"]) {
      const t = trace(auto);
      const s = await fullMatch(auto);
      const want = fieldAtHandoff(t, s.sim);
      s.advance(HANDOFF_S);
      for (const f of s.sim.flowers)
        expect(f.stack, `${auto} FLOWER ${f.id}`).toEqual(want.flowers[f.id]);
      // Every floor piece of the trace is a loose ball in the simulator, close by: the 1 s settle
      // moves one spawned against a FLOWER's frame or another piece a little.
      const loose = [...s.sim.balls.values()].map((b) => ({
        kind: b.kind,
        p: b.body.translation(),
      }));
      for (const q of want.pieces) {
        const near = loose.some(
          (b) =>
            b.kind === q.kind && Math.hypot(b.p.x - q.x, b.p.z - q.z) < 0.15,
        );
        expect(near, `${auto} ${q.kind} at ${q.x}, ${q.z}`).toBe(true);
      }
      // All 40 POLLEN are in play: lanes, FLOWERs, CELLs and the floor.
      const pollen =
        [...s.sim.balls.values()].filter((b) => b.kind === "pollen").length +
        s.sim.flowers.reduce(
          (a, f) => a + f.stack.filter((k) => k === "pollen").length,
          0,
        ) +
        s.sim.robots.reduce(
          (a, r) => a + r.carried.filter((k) => k === "pollen").length,
          0,
        );
      expect(pollen, auto).toBe(40);
    }
  }, 60000);

  test("the results carry the AUTO's TIPs, and 7 counts them", async () => {
    const t = trace("r-solo");
    const s = await fullMatch("r-solo");
    s.advance(HANDOFF_S);
    s.advance(121);
    expect(s.finished).toBe(true);
    const r = s.result("2026-11-23T00:00:00Z");
    expect(r.auto).toEqual({
      name: "r-solo",
      tips: t.autoTips,
      design: t.design,
      seed: t.seed,
    });
    expect(r.tips).toBe(0); // TeleOp's
    expect(s.totalTips).toBe(t.autoTips);
    expect(r.goalAtS).toBeNull();
  }, 60000);
});

describe("the 2:00 drill opens after a 1-TIP Auto", () => {
  test("our 4 preloads tip our CELL before the clock runs; that TIP is the AUTO's and its spill is on the floor", async () => {
    const s = new DrillSession(await rapier(), CONTROLS, 20245, "two", 1);
    const floor = () =>
      [...s.sim.balls.values()].filter(
        (b) => b.kind === "pollen" && b.body.translation().y < 0.3,
      ).length;
    const before = floor();
    expect(s.sim.hives.red.upCell).toBe("audience");
    s.opensAfterAuto = true;
    s.start();
    expect(s.openingTips).toBe(1);
    expect(s.sim.hives.red.upCell).toBe("rear");
    expect(s.remainingS).toBe(120);
    expect(s.tips).toHaveLength(0); // TeleOp's: none yet
    expect(s.totalTips).toBe(1);
    expect(floor()).toBeGreaterThan(before);
    s.advance(121);
    const r = s.result("2026-11-23T00:00:00Z");
    expect(r.openingTips).toBe(1);
    expect(r.auto).toBeUndefined();
  }, 60000);
});

describe("the 2:00 drill opens on our R-Solo's hand-off, in our LOADING ZONE", () => {
  test("the field as R-Solo leaves it, its TIPs the AUTO's, and our robot wholly in the zone along the wall", async () => {
    const t = trace("r-solo");
    const s = new DrillSession(await rapier(), CONTROLS, 20245, "two", 1);
    s.openingAuto = t;
    s.opensAfterAuto = true; // the R-Solo opening takes its place
    s.start();
    const red = s.sim.hives.red;
    expect(s.openingTips).toBe(t.autoTips);
    expect(red.tips).toBe(t.handoff.hives.red.tips);
    expect(red.upCell).toBe(t.handoff.hives.red.up);
    expect(s.sim.hives.blue.upCell).toBe(t.handoff.hives.blue.up);
    expect(s.remainingS).toBe(120);
    expect(s.tips).toHaveLength(0);
    expect(s.totalTips).toBe(t.autoTips);
    // In the LOADING ZONE (PARK's test), and the whole chassis inside it along the wall.
    const v = s.sim.view(0);
    expect(v.robotInLoadingZone()).toBe(true);
    const [x0, x1, z0, z1] = FIELD.loadingZone.red;
    const hl = v.cfg.length / 2,
      hw = v.cfg.width / 2;
    for (const [f, l] of [
      [-hl, -hw],
      [-hl, hw],
    ] as const) {
      const c = v.toWorld(f, l);
      expect(c.x).toBeGreaterThanOrEqual(-FIELD.half);
      expect(c.x).toBeLessThanOrEqual(x1);
      expect(c.z).toBeGreaterThanOrEqual(z0);
      expect(c.z).toBeLessThanOrEqual(z1);
    }
    expect(x0).toBe(-FIELD.half);
    // Facing the field, and still there once TeleOp runs (nothing under it pushed it off).
    s.advance(2);
    expect(v.robotInLoadingZone()).toBe(true);
    expect(Math.cos(v.heading)).toBeGreaterThan(0.99);
    s.advance(120);
    const r = s.result("2026-11-23T00:00:00Z");
    expect(r.openingTips).toBe(t.autoTips);
    expect(r.openingAuto).toBe("r-solo");
    expect(r.auto).toBeUndefined();
  }, 60000);
});
