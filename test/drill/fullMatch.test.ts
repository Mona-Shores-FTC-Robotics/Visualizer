import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { HANDOFF_S, type AutoTrace } from "../../src/drill/fullMatch";
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
