/**
 * Corner wheels, measured (Hub, 24 Nov 2026): how long our robot takes to collect 4 POLLEN with the
 * corner wheels off and on, in three setups, 10 seeds each. Scripted, not by hand:
 *
 *   npx vitest run -c scripts/vitest.trial.config.ts
 *   (SEEDS=n, SETUPS=line,corner,scattered, WHEELS=off,on narrow it; TRACE=1 prints the driver)
 *
 * The robot is 20245 driven through the drill's own TeleOp (src/drill/teleop.ts): its real drive
 * limits, field-centric sticks, the intake running as it always does, no FLOWER stick and no
 * routine. The scripted driver goes for the nearest POLLEN left, nose in, choosing once per attempt:
 * square to the wall for a piece against one, else straight at it. It lines up 4 in short of the
 * piece (as close as the walls let it), with a line-up error drawn per attempt (sigma
 * LINE_UP_SIGMA_IN), drives in at a walking pace easing to a creep for the last 2 in, and backs off
 * and tries again if the piece has not come in. A run ends with 4 in the lane, or at the time cap.
 * "Flung" counts pieces thrown faster than 1.5 m/s (the contact solver squeezing one out between
 * the robot and a wall), so the two can be compared for it.
 *
 * Setups, on the far (blue) wall, clear of the FLOWERs and the HIVE:
 *   (a) line: 4 against the wall in a line, about 6 in apart;
 *   (b) corner: 4 packed 2 x 2 into the field's corner;
 *   (c) scattered: 4 within 10 in of the wall, spread over 24 in of it (clear of the blue FLOWER,
 *       which a robot lined up square on the wall would hit beyond that).
 */
import { describe, test } from "vitest";
import { FIELD } from "../sim/src/sim/config";
import { DrillSession, mulberry32 } from "../src/drill/session";
import type { PadRead } from "../src/drill/controls";
import {
  CORNER_WHEEL_DIAMETER_IN,
  CORNER_WHEEL_RPM,
} from "../src/drill/cornerWheels";
import { CONTROLS, rapier } from "../test/drill/helpers";

const IN = 0.0254;
const SEEDS = Number(process.env.SEEDS ?? 10);
const CAP_S = 40;
const LINE_UP_SIGMA_IN = 2;
const R = FIELD.pollenRadius;
const H = FIELD.half;

type Setup = "line" | "corner" | "scattered";

function gauss(rand: () => number): number {
  const u = Math.max(1e-12, rand()),
    v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** The 4 POLLEN for a setup (world X, Z), and the robot's start (X, Z, heading). */
function layout(setup: Setup, rand: () => number) {
  const j = (s: number) => (rand() * 2 - 1) * s;
  const balls: { x: number; z: number }[] = [];
  if (setup === "line") {
    const z0 = -0.24 + j(0.05);
    for (let k = 0; k < 4; k++)
      balls.push({ x: H - R - 0.002, z: z0 + k * 6 * IN + j(0.5 * IN) });
  } else if (setup === "corner") {
    for (const [a, b] of [
      [1, 1],
      [1, 3],
      [3, 1],
      [3, 3],
    ])
      balls.push({
        x: H - a * R - 0.002 - Math.abs(j(0.3 * IN)),
        z: H - b * R - 0.002 - Math.abs(j(0.3 * IN)),
      });
  } else {
    while (balls.length < 4) {
      const q = { x: H - R - 0.002 - rand() * 10 * IN, z: j(12 * IN) };
      if (balls.every((b) => Math.hypot(b.x - q.x, b.z - q.z) > 4 * IN))
        balls.push(q);
    }
  }
  const start =
    setup === "corner"
      ? { x: 0.95 + j(0.08), z: 0.75 + j(0.08), h: j(0.25) }
      : { x: 0.95 + j(0.08), z: j(0.15), h: j(0.25) };
  return { balls, start };
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
const pad = (lx: number, ly: number, rx: number): PadRead => ({
  lx,
  ly,
  rx,
  held: () => false,
});

/** One run: seconds to 4 in the lane (or null at the cap), and attempts made. */
async function run(setup: Setup, seed: number, wheels: boolean) {
  const rand = mulberry32(seed * 7919 + setup.length);
  const s = new DrillSession(
    await rapier(),
    CONTROLS,
    20245,
    "driver",
    seed,
    "uv-ir",
    "ncssm",
  );
  s.cornerWheels = wheels;
  s.start();
  const sim = s.sim;
  // An empty field but for our 4.
  for (const b of [...sim.balls.values()]) {
    sim.world.removeRigidBody(b.body);
    sim.balls.delete(b.id);
  }
  for (const f of sim.flowers) f.stack = [];
  sim.carried = [];
  const { balls, start } = layout(setup, rand);
  const body = sim.robot;
  body.setTranslation(
    { x: start.x, y: body.translation().y, z: start.z },
    true,
  );
  body.setRotation(
    { x: 0, y: Math.sin(start.h / 2), z: 0, w: Math.cos(start.h / 2) },
    true,
  );
  const ids = balls.map((b) => sim.spawn("pollen", b.x, R + 0.001, b.z).id);
  s.advance(0.3); // the pieces settle
  const t0 = s.t;
  const hl = sim.cfg.length / 2;
  let target: number | null = null,
    phase: "line" | "push" | "back" = "line",
    phaseAt = t0,
    noise = 0,
    attempts = 0,
    heading = 0;
  const flung = new Set<number>();
  while (s.t - t0 < CAP_S) {
    if (sim.carried.length >= 4) break;
    const left = ids.filter((id) => sim.balls.has(id));
    if (!left.length) break;
    const P = body.translation(),
      h = sim.heading;
    if (target === null || !sim.balls.has(target)) {
      // The nearest left, and a fresh line-up.
      target = left.reduce((a, b) => {
        const pa = sim.balls.get(a)!.body.translation(),
          pb = sim.balls.get(b)!.body.translation();
        return Math.hypot(pa.x - P.x, pa.z - P.z) <=
          Math.hypot(pb.x - P.x, pb.z - P.z)
          ? a
          : b;
      });
      phase = "line";
      phaseAt = s.t;
      noise = gauss(rand) * LINE_UP_SIGMA_IN * IN;
      attempts++;
    }
    const B = sim.balls.get(target)!.body.translation();
    if (phase === "line" && s.t === phaseAt) {
      // Nose in, chosen once per attempt as a driver does: square to the wall for a piece against
      // one, else straight at it.
      const dx = H - Math.abs(B.x),
        dz = H - Math.abs(B.z);
      heading =
        Math.min(dx, dz) < 0.12
          ? dx <= dz
            ? B.x > 0
              ? 0
              : Math.PI
            : B.z > 0
              ? -Math.PI / 2
              : Math.PI / 2
          : Math.atan2(-(B.z - P.z), B.x - P.x);
    }
    const u = { x: Math.cos(heading), z: -Math.sin(heading) },
      side = { x: -Math.sin(heading), z: -Math.cos(heading) };
    let vx: number, vz: number;
    const e = wrap(heading - h);
    if (phase === "line") {
      const A = {
        x: B.x - u.x * (hl + R + 4 * IN) + side.x * noise,
        z: B.z - u.z * (hl + R + 4 * IN) + side.z * noise,
      };
      // As close as the walls let the robot get: its centre at least half its width plus 1 cm in.
      const room = H - sim.cfg.width / 2 - 0.01;
      A.x = clamp(A.x, -room, room);
      A.z = clamp(A.z, -room, room);
      const d = Math.hypot(A.x - P.x, A.z - P.z);
      const k = clamp(d / 0.35, 0.15, 1);
      vx = ((A.x - P.x) / Math.max(d, 1e-6)) * k;
      vz = ((A.z - P.z) / Math.max(d, 1e-6)) * k;
      if (d < 0.03) vx = vz = 0;
      if ((d < 0.04 && Math.abs(e) < 0.1) || s.t - phaseAt > 6) {
        phase = "push";
        phaseAt = s.t;
      }
    } else if (phase === "push") {
      // In at a walking pace, easing to a creep for the last 2 in before the nose meets the piece,
      // so a piece against a wall is not rammed while the intake gets it.
      const gap = (B.x - P.x) * u.x + (B.z - P.z) * u.z - hl - R;
      const v = gap > 2 * IN ? 0.45 : 0.12;
      vx = u.x * v;
      vz = u.z * v;
      if (s.t - phaseAt > 1.4) {
        phase = "back";
        phaseAt = s.t;
      }
    } else {
      vx = -u.x * 0.5;
      vz = -u.z * 0.5;
      if (s.t - phaseAt > 0.5) {
        // Try again: a fresh line-up on the nearest left.
        target = null;
      }
    }
    if (process.env.TRACE && Math.round((s.t - t0) * 48) % 12 === 0)
      console.log(
        `t ${(s.t - t0).toFixed(2)} ${phase} tgt ${target} P ${P.x.toFixed(2)},${P.z.toFixed(2)} h ${((h * 180) / Math.PI).toFixed(0)} want ${((heading * 180) / Math.PI).toFixed(0)} B ${B.x.toFixed(2)},${B.z.toFixed(2)} lane ${sim.carried.length} noise ${(noise / IN).toFixed(1)}in`,
      );
    // A piece flung (faster than 1.5 m/s): the contact solver squeezing one out between the robot
    // and a wall. Counted, so off and on can be compared for it.
    for (const id of left) {
      const v = sim.balls.get(id)!.body.linvel();
      if (Math.hypot(v.x, v.z) > 1.5 && !flung.has(id)) flung.add(id);
    }
    // Field-centric for red: forward is +X, right is +Z.
    s.advance(
      1 / 48,
      pad(clamp(vz, -1, 1), clamp(-vx, -1, 1), clamp(-2.2 * e, -1, 1)),
    );
  }
  return {
    s: sim.carried.length >= 4 ? s.t - t0 : null,
    got: sim.carried.length,
    attempts,
    rakes: s.teleop.cornerRakes,
    flung: flung.size,
  };
}

describe("corner wheels: time to collect 4 POLLEN", () => {
  test("off vs on, three setups, 10 seeds each", async () => {
    const rows: string[] = [];
    rows.push(
      `Corner wheels at ${CORNER_WHEEL_RPM} rpm on a ${CORNER_WHEEL_DIAMETER_IN} in wheel (edge ${(
        (CORNER_WHEEL_RPM / 60) *
        Math.PI *
        CORNER_WHEEL_DIAMETER_IN
      ).toFixed(
        2,
      )} in/s); ${SEEDS} seeds; cap ${CAP_S} s; line-up sigma ${LINE_UP_SIGMA_IN} in`,
    );
    rows.push(
      "| setup | wheels | mean s | worst s | 4 of 4 | attempts (mean) | flung | per-run s |",
    );
    rows.push("|---|---|---|---|---|---|---|---|");
    for (const setup of (process.env.SETUPS ?? "line,corner,scattered").split(
      ",",
    ) as Setup[])
      for (const wheels of (process.env.WHEELS ?? "off,on")
        .split(",")
        .map((w) => w === "on")) {
        const rs = [];
        for (let seed = 1; seed <= SEEDS; seed++)
          rs.push(await run(setup, seed, wheels));
        // A run that never filled counts at the cap for the mean and the worst.
        const ts = rs.map((r) => r.s ?? CAP_S);
        const full = rs.filter((r) => r.s !== null).length;
        rows.push(
          `| ${setup} | ${wheels ? "on" : "off"} | ${(ts.reduce((a, b) => a + b, 0) / ts.length).toFixed(1)} | ${Math.max(...ts).toFixed(1)}${full < SEEDS ? "+" : ""} | ${full}/${SEEDS} | ${(rs.reduce((a, r) => a + r.attempts, 0) / rs.length).toFixed(1)} | ${rs.reduce((a, r) => a + r.flung, 0)} | ${rs.map((r) => (r.s === null ? `(${r.got})` : r.s.toFixed(1))).join(" ")} |`,
        );
      }
    console.log(rows.join("\n"));
  }, 1_800_000);
});
