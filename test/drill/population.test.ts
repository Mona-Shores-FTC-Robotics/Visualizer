import { describe, expect, test } from "vitest";
import { DrillSession, type Population } from "../../src/drill/session";
import { CONTROLS, rapier } from "./helpers";

// Who else is on the field: empty, or a match (our dead partner, two planner opponents at a skill).

async function session(population: Population, seed = 1) {
  const s = new DrillSession(
    await rapier(),
    CONTROLS,
    20245,
    "two",
    seed,
    "uv-ir",
    "playbook",
    population,
  );
  s.start();
  return s;
}

describe("the field's population", () => {
  test("empty: our robot alone", async () => {
    const s = await session({ kind: "empty" });
    expect(s.sim.robots.map((r) => r.alliance)).toEqual(["red"]);
    expect(s.opponentSkill).toBeNull();
    expect(s.result().opponents).toBeUndefined();
  });

  test("a match: our partner dead at its start, two opponents on the planner, the skill drawn from 1, 3, 5, 7", async () => {
    const seen = new Set<number>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const s = await session({ kind: "match", skill: "random" }, seed);
      expect(s.sim.robots.map((r) => r.alliance)).toEqual([
        "red",
        "red",
        "blue",
        "blue",
      ]);
      seen.add(s.opponentSkill!);
    }
    for (const k of seen) expect([1, 3, 5, 7]).toContain(k);
    expect(seen.size).toBeGreaterThan(1);
  });

  test("the opponents play their end and TIP; the dead partner does not drive", async () => {
    const s = await session({ kind: "match", skill: 7 });
    const partner = s.sim.robots[1].body;
    const p0 = partner.translation();
    const blue0 = s.sim.robots[2].body.translation();
    s.advance(121);
    expect(s.finished).toBe(true);
    const r = s.result();
    expect(r.opponents?.skill).toBe(7);
    expect(r.opponents!.tips).toBeGreaterThan(0);
    // An opponent drove; our partner moved no more than a bump.
    const blue1 = s.sim.robots[2].body.translation();
    expect(Math.hypot(blue1.x - blue0.x, blue1.z - blue0.z)).toBeGreaterThan(
      0.3,
    );
    const p1 = partner.translation();
    expect(Math.hypot(p1.x - p0.x, p1.z - p0.z)).toBeLessThan(0.15);
  }, 120000);
});
