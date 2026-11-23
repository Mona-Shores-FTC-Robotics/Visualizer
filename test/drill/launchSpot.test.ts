import { describe, expect, test } from "vitest";
import {
  SpotStall,
  chooseSpot,
  fromPedro,
  stallRefusal,
  toPedro,
  type PedroPose,
} from "../../src/drill/launchSpot";
import { GROUP, groups } from "../../sim/src/sim/hive";
import { DrillSession } from "../../src/drill/session";
import { CONTROLS, pad, rapier } from "./helpers";

// The driver's Square: biobuzz's LaunchSpots and LaunchSpotDrive, on the spots its controls export
// lists (launchSpots in controls.json, from LaunchSpotsExport).

const SPOTS = CONTROLS.launchSpots!;

async function session(team: 19429 | 20245 = 20245, seed = 1) {
  const s = new DrillSession(await rapier(), CONTROLS, team, "two", seed);
  s.start();
  return s;
}
/** Puts the robot at a Pedro pose (inches, degrees). */
const placePedro = (s: DrillSession, p: PedroPose) => {
  const q = fromPedro(p, SPOTS.fieldCentreIn);
  s.sim.robot.setTranslation(
    { x: q.x, y: s.sim.robot.translation().y, z: q.z },
    true,
  );
  s.sim.robot.setRotation(
    { x: 0, y: Math.sin(q.h / 2), z: 0, w: Math.cos(q.h / 2) },
    true,
  );
};
const pedroNow = (s: DrillSession) => {
  const p = s.sim.robot.translation();
  return toPedro(p.x, p.z, s.sim.heading, SPOTS.fieldCentreIn);
};
const wrapDeg = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

/** Holds Square until the robot holds its spot, or `max` s. */
function holdToSpot(s: DrillSession, max = 7) {
  const t0 = s.t;
  while (s.t - t0 < max) {
    s.advance(0.05, pad(["SQUARE"]));
    if (s.teleop.status().routine?.includes("AT ")) break;
  }
  return s.t - t0;
}

describe("which spot (LaunchSpots.choose)", () => {
  test("the port picks what biobuzz's own choose picks, for all 60 exported poses", () => {
    expect(SPOTS.examples).toHaveLength(60);
    for (const e of SPOTS.examples) {
      const c = chooseSpot(
        SPOTS,
        e.alliance === "RED" ? "red" : "blue",
        e.x,
        e.y,
      );
      expect(c.spot?.name ?? null, `${e.alliance} (${e.x}, ${e.y})`).toBe(
        e.spot,
      );
    }
  });

  test("the tile row picks the row: against the end wall a WALL spot, the next one in a CLOSE spot, beside the centre line none", () => {
    expect(chooseSpot(SPOTS, "red", 40, 10).spot?.row).toBe("WALL");
    expect(chooseSpot(SPOTS, "red", 40, 30).spot?.row).toBe("CLOSE");
    expect(chooseSpot(SPOTS, "red", 40, 60).refusal).toMatch(/centre line/);
    // The far end of our side: the LEFT half's spots.
    expect(chooseSpot(SPOTS, "red", 40, 132).spot?.left).toBe(true);
  });
});

describe("Square held: the drive to the spot (LaunchSpotDrive)", () => {
  for (const [from, name] of [
    [[40, 34, 0], "RIGHT_CLOSE_NEAR"],
    [[60, 30, 0], "RIGHT_CLOSE_HIVE"],
    [[60, 18, 45], "RIGHT_START"],
  ] as [PedroPose, string][]) {
    test(`from (${from[0]}, ${from[1]}) it drives to ${name} and holds it, aimed as the spot is`, async () => {
      const s = await session();
      placePedro(s, from);
      s.advance(0.1);
      const t = holdToSpot(s);
      expect(s.teleop.status().routine).toContain(`AT ${name}`);
      const spot = SPOTS.spots.find((q) => q.name === name)!;
      const at = pedroNow(s);
      expect(Math.hypot(at[0] - spot.red[0], at[1] - spot.red[1])).toBeLessThan(
        1.5,
      );
      expect(Math.abs(wrapDeg(at[2] - spot.red[2]))).toBeLessThan(3);
      expect(t).toBeLessThan(SPOTS.timeoutMs / 1000);
      // Holding: still there a second later.
      s.advance(1, pad(["SQUARE"]));
      const later = pedroNow(s);
      expect(Math.hypot(later[0] - at[0], later[1] - at[1])).toBeLessThan(0.5);
    }, 60000);
  }

  test("a stick moved after the press hands the robot back that loop", async () => {
    const s = await session();
    placePedro(s, [60, 30, 0]);
    s.advance(0.1);
    s.advance(0.3, pad(["SQUARE"]));
    expect(s.teleop.status().routine).toContain("driving to RIGHT_CLOSE_HIVE");
    s.advance(0.05, pad(["SQUARE"], { lx: 0.8 }));
    expect(s.teleop.status().routine).toBeNull();
    // The driver drives again: the stick moves the robot sideways, Square still held.
    const a = s.sim.robot.translation();
    s.advance(0.6, pad(["SQUARE"], { lx: 0.8 }));
    const b = s.sim.robot.translation();
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(0.1);
    expect(s.teleop.status().routine).toBeNull();
  }, 60000);

  test("letting go stops it short", async () => {
    const s = await session();
    placePedro(s, [60, 30, 0]);
    s.advance(0.1);
    s.advance(0.3, pad(["SQUARE"]));
    s.advance(0.05);
    expect(s.teleop.status().routine).toBeNull();
    expect(s.teleop.status().note).toMatch(/let go early/);
  }, 60000);

  test("refused from the two tile rows beside the centre line, and nothing moves", async () => {
    const s = await session();
    placePedro(s, [40, 60, 0]);
    s.advance(0.5); // settled where it was put
    const a = s.sim.robot.translation();
    s.advance(1, pad(["SQUARE"]));
    const b = s.sim.robot.translation();
    expect(s.teleop.status().note).toMatch(
      /REFUSED: robot on the two tile rows/,
    );
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(1e-3);
  }, 60000);
});

test("with a controls file older than the launch spots, Square says so and drives nothing", async () => {
  const old = structuredClone(CONTROLS);
  delete old.launchSpots;
  const s = new DrillSession(await rapier(), old, 20245, "two", 1);
  s.start();
  placePedro(s, [60, 30, 0]);
  s.advance(0.5);
  const a = s.sim.robot.translation();
  s.advance(1, pad(["SQUARE"]));
  const b = s.sim.robot.translation();
  expect(s.teleop.status().note).toMatch(/no launch spots/);
  expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(1e-3);
}, 60000);

describe("Square fires on arrival (goToSpotAlsoFires)", () => {
  test("the export has it on", () => {
    expect(CONTROLS.teleOp.goToSpotAlsoFires).toBe(true);
  });

  test("a loaded robot drives to the spot and the volley feeds all four, with no Circle", async () => {
    const s = await session();
    placePedro(s, [60, 30, 0]);
    s.advance(0.1);
    s.sim.carried = ["pollen", "pollen", "pollen", "pollen"];
    const t0 = s.t;
    let arrivedAt = NaN;
    while (s.t - t0 < 8 && s.teleop.launched < 4) {
      s.advance(0.05, pad(["SQUARE"]));
      if (Number.isNaN(arrivedAt) && s.teleop.status().routine?.includes("AT "))
        arrivedAt = s.t;
    }
    expect(s.teleop.launched).toBe(4);
    expect(s.teleop.volleys).toHaveLength(1);
    // The feed opened at the spot, or on the approach within 6 in of it.
    expect(s.teleop.volleys[0].atS).toBeGreaterThan(t0 + 0.5);
    expect(s.teleop.firePress).toBe(false);
  }, 60000);

  test("let go before the spot, nothing is fired", async () => {
    const s = await session();
    placePedro(s, [40, 34, 0]);
    s.advance(0.1);
    s.sim.carried = ["pollen", "pollen", "pollen", "pollen"];
    s.advance(0.4, pad(["SQUARE"]));
    s.advance(2);
    expect(s.teleop.launched).toBe(0);
  }, 60000);
});

describe("Square fires from where it stalls (biobuzz #734: SpotStall, LaunchSpotDrive.fireOnStall)", () => {
  test("the export carries the stall numbers", () => {
    expect(SPOTS).toMatchObject({
      fireOnStall: true,
      stallS: 0.6,
      stallToleranceIn: 2,
      stallSpeedInPerSec: 3,
      stallTurnDegPerSec: 20,
      stallProgressIn: 1,
      stallRangeLowIn: 35,
      stallRangeHighIn: 74,
    });
  });

  test("SpotStall: slow, short of the spot and not closing in for 0.6 s; a slow creep still closing never stalls", () => {
    const st = new SpotStall();
    const step = (t: number, rem: number, v = 1, w = 0) =>
      st.update(t, rem, v, w, 0.6, 2, 3, 20, 1);
    expect(step(0, 10)).toBe(false);
    expect(step(0.5, 10)).toBe(false);
    expect(step(0.6, 10)).toBe(true);
    const creep = new SpotStall();
    let stalled = false;
    for (let t = 0, rem = 20; t < 5; t += 0.1, rem -= 0.25)
      stalled ||= creep.update(t, rem, 2.5, 0, 0.6, 2, 3, 20, 1);
    expect(stalled).toBe(false);
    const near = new SpotStall();
    expect(near.update(0, 1.5, 0, 0, 0.6, 2, 3, 20, 1)).toBe(false);
    expect(near.update(1, 1.5, 0, 0, 0.6, 2, 3, 20, 1)).toBe(false); // within the tolerance: finishing
  });

  test("SpotStall.refusal, in its order", () => {
    expect(stallRefusal(false, -10, 50, true, true, true)).toBe(
      "turret not aiming (AIM needed)",
    );
    expect(stallRefusal(true, 0, 50, true, true, true)).toBe(
      "past the centre line",
    );
    expect(stallRefusal(true, -10, 13, false, true, true)).toBe(
      "out of range (13 in)",
    );
    expect(stallRefusal(true, -10, 50, true, false, false)).toBe(
      "aim outside the firing arc",
    );
    expect(stallRefusal(true, -10, 50, true, false, true)).toBeNull();
  });

  /** A wall across the way to the spot at Pedro y `wallY`: the press stalls on it. */
  async function blocked(x: number, y: number, wallY: number) {
    const R = await rapier();
    const s = new DrillSession(R, CONTROLS, 20245, "two", 1);
    s.start();
    placePedro(s, [x, y, 270]);
    const w = fromPedro([x, wallY, 0], SPOTS.fieldCentreIn);
    s.sim.world.createCollider(
      R.ColliderDesc.cuboid(0.6, 0.3, 0.02)
        .setTranslation(w.x, 0.3, w.z)
        .setCollisionGroups(groups(GROUP.struct, GROUP.robot | GROUP.ball)),
    );
    s.advance(0.2);
    s.sim.carried = ["pollen", "pollen", "pollen", "pollen"];
    return s;
  }

  test("blocked short of its spot, the press fires Circle's AIM shot from there: all four, no Circle", async () => {
    const s = await blocked(40, 21, 7);
    const t0 = s.t;
    let stalledLine = "";
    while (s.t - t0 < 9 && s.teleop.launched < 4) {
      s.advance(0.05, pad(["SQUARE"]));
      const r = s.teleop.status().routine ?? "";
      if (!stalledLine && r.includes("STALLED")) stalledLine = r;
    }
    expect(stalledLine).toMatch(
      /^Launch spot: STALLED \d+ in short of RIGHT_START · firing from \d+ in \(Circle's shot\)/,
    );
    expect(s.teleop.launched).toBe(4);
    s.advance(0.05);
    expect(s.teleop.status().note).toMatch(
      /fired by Circle's AIM shot \(stalled\)/,
    );
  }, 60000);

  test("too close to the CELL to have a measured row: the press ends, saying so", async () => {
    const s = await blocked(60, 40, 27);
    s.advance(3, pad(["SQUARE"]));
    expect(s.teleop.status().note).toMatch(/stalled, out of range \(\d+ in\)/);
    expect(s.teleop.launched).toBe(0);
  }, 60000);

  test("the turret LOCKED: a stall ends the press (AIM needed)", async () => {
    const s = await blocked(40, 21, 7);
    s.advance(0.05, pad(["R1"]));
    s.advance(0.05);
    expect(s.teleop.turretMode).toBe("LOCKED");
    s.advance(3, pad(["SQUARE"]));
    expect(s.teleop.status().note).toMatch(/turret not aiming \(AIM needed\)/);
  }, 60000);

  test("a stick ends the stall's shot at once", async () => {
    const s = await blocked(40, 21, 7);
    const t0 = s.t;
    while (!s.teleop.status().routine?.includes("STALLED") && s.t - t0 < 6)
      s.advance(0.05, pad(["SQUARE"]));
    expect(s.teleop.status().routine).toMatch(/STALLED/);
    s.advance(0.05, pad(["SQUARE"], { lx: 0.8 }));
    expect(s.teleop.status().routine).toBeNull();
    expect(s.teleop.status().note).toMatch(/sticks moved/);
  }, 60000);
});
