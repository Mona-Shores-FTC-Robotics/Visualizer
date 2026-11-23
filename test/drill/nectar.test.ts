import { describe, expect, test } from "vitest";
import { FIELD } from "../../sim/src/sim/config";
import { PLAYBOOK } from "../../src/drill/nectar";
import { DrillSession } from "../../src/drill/session";
import { CONTROLS, pad, rapier } from "./helpers";

// NECTAR: our human player by doc/human-player-playbook.md, and the robot's NECTAR gate
// (NectarReject: a wrong NECTAR is burst out and the feed held shut until the lane reads clean).

async function solo(humanPlayer: "playbook" | "ncssm" = "playbook") {
  const s = new DrillSession(
    await rapier(),
    CONTROLS,
    20245,
    "driver",
    1,
    "uv-ir",
    humanPlayer,
  );
  s.start();
  return s;
}
const place = (s: DrillSession, x: number, z: number, heading = 0) => {
  const b = s.sim.robot;
  b.setTranslation({ x, y: b.translation().y, z }, true);
  b.setRotation(
    { x: 0, y: Math.sin(heading / 2), z: 0, w: Math.cos(heading / 2) },
    true,
  );
};
const ours = (s: DrillSession) =>
  [...s.sim.balls.values()].filter((b) => b.kind === "nectar_red");
const inZone = (x: number, z: number) => {
  const r = FIELD.loadingZone.red;
  return x > r[0] && x < r[1] && z > r[2] && z < r[3];
};
/** A TIP: one volley at weight from in front of our raised CELL. */
function tip(s: DrillSession) {
  place(s, -0.32, 1.3);
  s.advance(0.2);
  s.sim.carried = ["pollen", "pollen", "pollen", "pollen"];
  s.advance(2.7, pad(["CIRCLE"]));
  for (let i = 0; i < 40 && !s.tips.length; i++) s.advance(0.25);
}

describe("our human player (the playbook)", () => {
  test("holds them until a TIP, then enters one, in the box and still", async () => {
    const s = await solo();
    s.advance(5);
    expect(s.hp!.entered).toBe(0);
    expect(s.hp!.left).toBe(5);
    tip(s);
    expect(s.tips).toHaveLength(1);
    s.advance(PLAYBOOK.afterTipS + 0.5);
    const n = ours(s).filter((b) =>
      inZone(b.body.translation().x, b.body.translation().z),
    );
    expect(n).toHaveLength(1);
    expect(s.hp!.left).toBe(4);
    s.advance(3);
    // One per TIP: no second.
    expect(s.hp!.entered).toBe(1);
    expect(n[0].body.linvel().x ** 2 + n[0].body.linvel().z ** 2).toBeLessThan(
      0.01,
    );
  }, 60000);

  test("never drops into a robot: waits for a clear box", async () => {
    const s = await solo();
    tip(s);
    const z = FIELD.loadingZone.red;
    place(s, (z[0] + z[1]) / 2 + 0.05, (z[2] + z[3]) / 2);
    s.advance(4);
    expect(s.hp!.entered).toBe(0);
    expect(s.hp!.waiting).toBe("zone busy");
    place(s, -1.0, 1.2);
    s.advance(1);
    expect(s.hp!.entered).toBe(1);
  }, 60000);

  test("from 1:00 the rest, one per reload, and none after 0:15", async () => {
    const s = await solo();
    s.advance(120 - 60 + 0.5); // the field timer reads 0:59
    expect(s.hp!.entered).toBe(1);
    s.advance(3);
    // The first still lies in the box: no pile.
    expect(s.hp!.entered).toBe(1);
    expect(s.hp!.waiting).toContain("one per reload");
    // Picked up (taken off the tile): the next goes in.
    for (const b of ours(s)) {
      s.sim.world.removeRigidBody(b.body);
      s.sim.balls.delete(b.id);
    }
    s.advance(0.5);
    expect(s.hp!.entered).toBe(2);
    s.advance(60 - 15); // 0:14
    for (const b of ours(s)) {
      s.sim.world.removeRigidBody(b.body);
      s.sim.balls.delete(b.id);
    }
    s.advance(2);
    expect(s.hp!.entered).toBe(2);
  }, 60000);

  test("NCSSM's human player stays selectable: from 1:00 it enters the rest itself", async () => {
    const s = await solo("ncssm");
    expect(s.hp).toBeNull();
    s.advance(65);
    expect(s.nectarEntered).toBe(5);
    expect(s.result().humanPlayer).toBe("ncssm");
  }, 60000);
});

describe("the NECTAR gate", () => {
  test("the other alliance's NECTAR is burst back out and the feed held shut; ours is kept and fired", async () => {
    const s = await solo();
    place(s, -1.0, 1.2, 0);
    s.advance(0.2);
    const front = s.sim.toWorld(s.sim.cfg.length / 2 + 0.05, 0);
    const blue = s.sim.spawn(
      "nectar_blue",
      front.x,
      FIELD.nectarRadius + 0.005,
      front.z,
    );
    s.sim.carried = ["pollen", "pollen", "pollen"];
    s.advance(0.1);
    expect(s.teleop.rejects).toBe(1);
    expect(s.teleop.status().nectarGate).not.toBe("");
    expect(s.sim.carried).not.toContain("nectar_blue");
    // Fire held at once: the gate stays shut while the lane may hold it.
    const before = s.teleop.launched;
    s.advance(1.2, pad(["CIRCLE"]));
    expect(s.teleop.launched).toBe(before);
    expect(blue.body.translation().x).toBeGreaterThan(front.x + 0.05);
    // Ours goes in and out with the next volley.
    s.sim.carried.push("nectar_red");
    place(s, -0.32, 1.3, 0);
    s.advance(4, pad(["CIRCLE"]));
    expect(s.teleop.nectarLaunched).toBe(1);
  }, 60000);
});
