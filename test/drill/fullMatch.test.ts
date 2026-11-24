import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AUTO_S,
  HANDOFF_S,
  fieldAtHandoff,
  partnerAutoFor,
  type AutoTrace,
} from "../../src/drill/fullMatch";
import { FIELD, TIP_LOAD } from "../../sim/src/sim/config";
import { toPedro } from "../../src/drill/launchSpot";
import {
  DrillSession,
  ONE_TIP_CELL,
  type OpeningKind,
} from "../../src/drill/session";
import { CONTROLS, pad, rapier } from "./helpers";

const wrapDeg = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

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
    for (const auto of ["r-no-cross", "l-clockwise", "r-solo"]) {
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
      // And each alliance's NECTAR inside the walls (floor, FLOWERs and CELLs) once each: a HIVE
      // that tipped back onto its starting CELL no longer holds the NECTAR staged there.
      for (const [kind, list] of [
        ["nectar_red", t.handoff.pieces.nectarRed],
        ["nectar_blue", t.handoff.pieces.nectarBlue],
      ] as const) {
        const want = list.filter(
          ([x, , z]) => Math.abs(x) < FIELD.half && Math.abs(z) < FIELD.half,
        ).length;
        const have =
          [...s.sim.balls.values()].filter(
            (b) => b.kind === kind && b.body.isEnabled(),
          ).length +
          s.sim.flowers.reduce(
            (a, f) => a + f.stack.filter((k) => k === kind).length,
            0,
          );
        expect(have, `${auto} ${kind}`).toBe(want);
      }
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
    s.openingKind = "two";
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

describe("R-Solo's two openings: 2 TIPs and the CELL empty, or 1 TIP and 6 POLLEN in it", () => {
  const pollenInPlay = (s: DrillSession) =>
    [...s.sim.balls.values()].filter((b) => b.kind === "pollen").length +
    s.sim.flowers.reduce(
      (a, f) => a + f.stack.filter((k) => k === "pollen").length,
      0,
    ) +
    s.sim.robots.reduce(
      (a, r) => a + r.carried.filter((k) => k === "pollen").length,
      0,
    );
  const open = async (kind: OpeningKind, seed: number) => {
    const s = new DrillSession(await rapier(), CONTROLS, 20245, "two", seed);
    s.openingAuto = trace("r-solo");
    s.openingKind = kind;
    s.start();
    return s;
  };

  test("2 TIPs: the audience CELL raised and empty, all 40 POLLEN in play", async () => {
    const s = await open("two", 1);
    expect(s.openingTips).toBe(2);
    expect(s.openingCell).toBe(0);
    expect(s.sim.hives.red.upCell).toBe("audience");
    expect(s.sim.cellCount("red")).toBe(0);
    expect(pollenInPlay(s)).toBe(40);
  }, 60000);

  test("1 TIP: the rear CELL raised with 6 POLLEN, which stays short of the TIP; all 40 in play", async () => {
    for (const seed of [1, 2, 3]) {
      const s = await open("one", seed);
      expect(s.openingTips).toBe(1);
      expect(s.openingCell).toBe(ONE_TIP_CELL);
      expect(s.sim.hives.red.upCell).toBe("rear");
      expect(s.sim.hives.red.tips).toBe(1);
      expect(s.sim.cellCount("red")).toBe(s.openingCell);
      expect(pollenInPlay(s)).toBe(40);
      expect(s.sim.view(0).robotInLoadingZone()).toBe(true);
      // TeleOp starts: nobody adds to the CELL, so it does not TIP on its own.
      s.advance(12);
      expect(s.sim.hives.red.tips).toBe(1);
      expect(s.tips).toHaveLength(0);
      expect(s.totalTips).toBe(1);
      const r = s.result("2026-11-23T00:00:00Z");
      expect(r.openingTips).toBe(1);
      expect(r.openingCell).toBe(s.openingCell);
    }
  }, 120000);

  test("varied draws the 1-TIP opening about 2 runs in 3", async () => {
    let one = 0;
    const n = 12;
    for (let seed = 1; seed <= n; seed++)
      if ((await open("varied", seed)).openingTips === 1) one++;
    expect(one).toBeGreaterThanOrEqual(5);
    expect(one).toBeLessThanOrEqual(11);
  }, 240000);
});

describe("the AUTO replay shows the pieces: the volleys fly and fill our CELL", () => {
  const autos = (
    JSON.parse(
      readFileSync(
        resolve(import.meta.dirname, "../../public/drill/autos/index.json"),
        "utf8",
      ),
    ) as { autos: { auto: string }[] }
  ).autos.map((a) => a.auto);

  test.each(autos)(
    "%s",
    async (auto) => {
      const t = trace(auto);
      const s = await fullMatch(auto);
      const hive = s.sim.hives.red.body.translation();
      const inHive = (q: { x: number; y: number; z: number }) =>
        q.y > 0.5 && Math.hypot(q.x - hive.x, q.z - hive.z) < 0.6;
      const onFlower = (q: { x: number; z: number }) =>
        s.sim.flowers.some((f) => Math.hypot(f.x - q.x, f.z - q.z) < 0.15);
      let flying = 0,
        mostInHive = 0;
      const inHiveAt = new Map<number, number>();
      const want = (t.tipsAt ?? []).map((x) => Math.round((x - 0.2) * 10) / 10);
      expect(s.replayPieces?.length ?? 0, auto).toBeGreaterThan(30);
      for (let k = 1; k <= HANDOFF_S * 10 - 1; k++) {
        s.advance(0.1);
        const ps = s.replayPieces!;
        const pollen = ps.filter((q) => q.kind === "pollen");
        const n = pollen.filter(inHive).length;
        mostInHive = Math.max(mostInHive, n);
        // The load the TIP weighs, in POLLEN equivalents (TIP_LOAD): our NECTAR counts 1.65 each.
        const load =
          n +
          TIP_LOAD.nectar *
            ps.filter((q) => q.kind === "nectar_red" && inHive(q)).length;
        if (pollen.some((q) => q.y > 0.3 && !inHive(q) && !onFlower(q)))
          flying++;
        for (const w of want)
          if (Math.abs(k / 10 - w) < 0.05) inHiveAt.set(w, load);
      }
      // A volley flies (some POLLEN up in the air, off the HIVE and the FLOWERs) and lands in our HIVE.
      expect(flying, `${auto}: frames with POLLEN in flight`).toBeGreaterThan(
        0,
      );
      expect(mostInHive, `${auto}: POLLEN in our HIVE`).toBeGreaterThanOrEqual(
        t.scored ? 1 : 0,
      );
      // Just before each TIP, our HIVE holds the load that tips it: the TIP weight (7.4), less a
      // POLLEN or so still on its way in.
      for (const w of want)
        expect(
          inHiveAt.get(w),
          `${auto}: load in our HIVE at ${w} s`,
        ).toBeGreaterThanOrEqual(TIP_LOAD.threshold - 1.5);
      // At 2:00 the replay's pieces give way to the simulator's.
      s.advance(0.2);
      expect(s.replayPieces).toBeNull();
    },
    60000,
  );

  test("a trace without the pieces draws none (the view falls back to the simulator's)", async () => {
    const t = { ...trace("r-solo"), pieceFrames: undefined };
    const s = new DrillSession(await rapier(), CONTROLS, 20245, "two", 1);
    s.playAuto(t);
    s.start();
    s.advance(5);
    expect(s.replayPieces).toEqual([]);
  }, 60000);
});

describe("the AUTO replay swings the rockers as the trace does", () => {
  test("R-Solo: our rocker follows the trace's tilt, and flips at each TIP", async () => {
    const t = trace("r-solo");
    const s = await fullMatch("r-solo");
    const deg = (rad: number) => (rad * 180) / Math.PI;
    const signs: number[] = [];
    for (let k = 1; k < AUTO_S * 10; k++) {
      s.advance(0.1);
      const fr = t.frames[k];
      expect(deg(s.sim.hives.red.phi), `red at ${fr[0]} s`).toBeCloseTo(
        fr[5],
        0,
      );
      expect(deg(s.sim.hives.blue.phi), `blue at ${fr[0]} s`).toBeCloseTo(
        fr[7],
        0,
      );
      const sign = Math.sign(s.sim.hives.red.phi);
      if (sign && sign !== signs.at(-1)) signs.push(sign);
    }
    // Audience CELL up at the start, rear after the 1st TIP, audience again after the 2nd.
    expect(t.autoTips).toBe(2);
    expect(signs).toEqual([-1, 1, -1]);
  }, 60000);
});

describe("a match field's dead partner stands at its Auto's start", () => {
  test("beside R-NoCross, L-NoCross's start (LEFT_START, 62.3, 133.8, 270), and it stays there", async () => {
    expect(partnerAutoFor("r-solo")).toBe("l-no-cross");
    expect(partnerAutoFor("r-clockwise")).toBe("l-clockwise");
    expect(partnerAutoFor("l-left-under-hive")).toBe("r-left-under-hive");
    const s = new DrillSession(
      await rapier(),
      CONTROLS,
      20245,
      "driver",
      1,
      "uv-ir",
      "playbook",
      { kind: "match", skill: 1 },
    );
    expect(s.placeDeadPartner(trace("l-no-cross"))).toBe(true);
    s.start();
    s.advance(5);
    const v = s.sim.view(1);
    const q = v.robot.translation(),
      p = toPedro(q.x, q.z, v.heading);
    expect(v.alliance).toBe("red");
    // Within an inch: the simulator's frame is 16.2 in (the robot's 15.4), so at LEFT_START its back
    // would sit 0.4 in into the rear wall, and the wall nudges it out.
    expect(Math.abs(p[0] - 62.3)).toBeLessThan(1);
    expect(Math.abs(p[1] - 133.8)).toBeLessThan(1);
    expect(((p[2] % 360) + 360) % 360).toBeCloseTo(270, 0);
    expect(s.deadPartnerAt).toBe("l-no-cross's start");
  }, 60000);

  test("no dead partner on an empty field, or with both our robots driven", async () => {
    const empty = new DrillSession(
      await rapier(),
      CONTROLS,
      20245,
      "driver",
      1,
    );
    expect(empty.placeDeadPartner(trace("l-no-cross"))).toBe(false);
    const both = new DrillSession(
      await rapier(),
      CONTROLS,
      [
        { team: 20245, driverOnly: true },
        { team: 19429, driverOnly: true },
      ],
      "alliance",
      1,
    );
    expect(both.placeDeadPartner(trace("l-no-cross"))).toBe(false);
  }, 60000);
});

describe("beside R-Solo, the partner keeps out of the way in our alliance wall's left corner", () => {
  test("backed into the red-rear corner, facing the field, inside the walls, and it stays there", async () => {
    const s = new DrillSession(
      await rapier(),
      CONTROLS,
      20245,
      "driver",
      1,
      "uv-ir",
      "playbook",
      { kind: "match", skill: 1 },
    );
    expect(s.placeDeadPartnerInCorner()).toBe(true);
    expect(s.deadPartnerAt).toBe("the left corner of our alliance wall");
    s.start();
    s.advance(5);
    const v = s.sim.view(1),
      c = v.cfg,
      q = v.robot.translation(),
      p = toPedro(q.x, q.z, v.heading);
    // Pedro: x 0 is our (red) wall, y 141.5 the rear wall; its back and side within 1 cm of them.
    expect(p[0] - c.length / 2 / 0.0254).toBeLessThan(0.5);
    expect(p[0] - c.length / 2 / 0.0254).toBeGreaterThan(0);
    expect(141.5 - c.width / 2 / 0.0254 - p[1]).toBeLessThan(0.5);
    expect(141.5 - c.width / 2 / 0.0254 - p[1]).toBeGreaterThan(0);
    expect(Math.abs(wrapDeg(p[2]))).toBeLessThan(2);
    // Clear of our LOADING ZONE.
    expect(v.robotInLoadingZone()).toBe(false);
  }, 60000);
});

describe("the AUTO replay moves the FLOWER stick as the trace does", () => {
  test("R-Solo lowers the stick for its FLOWER picks and raises it again", async () => {
    const t = trace("r-solo");
    expect(t.columns[9]).toBe("stickDeg");
    const s = await fullMatch("r-solo");
    let lowest = 0,
      downAt: number | null = null,
      upAfter = false;
    for (let k = 1; k < AUTO_S * 10; k++) {
      s.advance(0.1);
      const d = s.replayStickDeg ?? 0;
      expect(d, `at ${t.frames[k][0]} s`).toBeCloseTo(t.frames[k][9], 1);
      if (d > lowest) lowest = d;
      if (d > 150 && downAt === null) downAt = t.frames[k][0];
      if (downAt !== null && d < 10) upAfter = true;
    }
    // Down to the tile (162 degrees out) for the first pick, about 4 s in, and stowed again after.
    expect(lowest).toBeGreaterThan(150);
    expect(downAt).toBeLessThan(8);
    expect(upAfter).toBe(true);
    // After the hand-off the simulator's own stick state is drawn again.
    s.advance(HANDOFF_S);
    expect(s.replayStickDeg).toBeNull();
  }, 60000);
});
