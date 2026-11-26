import { describe, expect, test } from "vitest";
import { FreshSticks } from "../../src/drill/freshSticks";
import { DrillSession } from "../../src/drill/session";
import { CONTROLS, pad, rapier } from "./helpers";

// Buttons that act as on the robot (the button-parity audit): BasicDriveTeleOp and the classes it
// calls, on the numbers biobuzz's controls export carries (teleOp).

const T = CONTROLS.teleOp as Record<string, number>;

async function session() {
  const s = new DrillSession(await rapier(), CONTROLS, 20245, "two", 1);
  s.start();
  return s;
}
const placePedro = (s: DrillSession, x: number, y: number, hDeg: number) => {
  const h = (hDeg * Math.PI) / 180;
  s.sim.robot.setTranslation(
    {
      x: (x - 70.75) * 0.0254,
      y: s.sim.robot.translation().y,
      z: -(y - 70.75) * 0.0254,
    },
    true,
  );
  s.sim.robot.setRotation(
    { x: 0, y: Math.sin(h / 2), z: 0, w: Math.cos(h / 2) },
    true,
  );
};

describe("FreshSticks (biobuzz opmodes/FreshSticks)", () => {
  test("the export carries staleStickCancelsAfterS", () => {
    expect(T.staleStickCancelsAfterS).toBe(0.6);
  });

  test("centred at the press: a stick cancels at once", () => {
    const f = new FreshSticks();
    expect(f.moved(true, false, 0, 0.6)).toBe(false);
    expect(f.moved(true, true, 0.1, 0.6)).toBe(true);
  });

  test("off centre at the press: stale until it centres, or until 0.6 s after the press", () => {
    const f = new FreshSticks();
    expect(f.moved(true, true, 0, 0.6)).toBe(false);
    expect(f.moved(true, true, 0.5, 0.6)).toBe(false);
    expect(f.moved(true, true, 0.6, 0.6)).toBe(true);
    const g = new FreshSticks();
    g.moved(true, true, 0, 0.6);
    expect(g.moved(true, false, 0.2, 0.6)).toBe(false);
    expect(g.moved(true, true, 0.3, 0.6)).toBe(true);
  });

  test("Square pressed while still driving: the stick held past 0.6 s takes the robot back", async () => {
    const s = await session();
    placePedro(s, 60, 30, 0);
    s.advance(0.1);
    s.advance(0.3, pad(["SQUARE"], { lx: 0.4 }));
    expect(s.teleop.status().routine).toContain("Launch spot: driving");
    s.advance(0.5, pad(["SQUARE"], { lx: 0.4 }));
    expect(s.teleop.status().routine).toBeNull();
    expect(s.teleop.status().note).toMatch(/sticks moved/);
  }, 60000);
});

describe("the launcher after Square (LauncherOwner)", () => {
  test(`it keeps spinning ${T.launcherKeepSpinningAfterSquareS} s after Square is let go, then idles`, async () => {
    const s = await session();
    placePedro(s, 60, 30, 0);
    s.advance(0.1);
    s.advance(0.5, pad(["SQUARE"]));
    expect(s.teleop.status().launcher).not.toBe("IDLE");
    s.advance(0.05);
    s.advance(T.launcherKeepSpinningAfterSquareS - 0.3);
    // Still spinning: at speed by now (LauncherSubsystem.atSpeed, the Match page's READY).
    expect(s.teleop.status().launcher).toBe("AT SPEED");
    s.advance(0.5);
    expect(s.teleop.status().launcher).toBe("IDLE");
  }, 60000);

  test("letting go of Square idles a launcher the operator spun up, too, after the wait", async () => {
    const s = await session();
    placePedro(s, 60, 30, 0);
    s.advance(0.1, pad(), pad(["CROSS"])); // operator spins up
    s.advance(0.1);
    s.advance(0.5, pad(["SQUARE"]));
    s.advance(T.launcherKeepSpinningAfterSquareS + 0.5);
    expect(s.teleop.status().launcher).toBe("IDLE");
  }, 60000);
});

describe("the trims, on the exported steps and caps", () => {
  test("aim trim steps trimStepDeg, fine trimFineStepDeg, and stops at maxAimTrimDeg", async () => {
    const s = await session();
    s.advance(0.05, pad(), pad(["DPAD_LEFT"]));
    s.advance(0.05);
    expect(s.teleop.status().aimTrimDeg).toBeCloseTo(T.trimStepDeg, 6);
    s.advance(0.05, pad(), pad(["CIRCLE", "DPAD_LEFT"]));
    s.advance(0.05, pad(), pad(["CIRCLE"]));
    expect(s.teleop.status().aimTrimDeg).toBeCloseTo(
      T.trimStepDeg + T.trimFineStepDeg,
      6,
    );
    for (let i = 0; i < 150; i++) {
      s.advance(0.02, pad(), pad(["DPAD_LEFT"]));
      s.advance(0.02);
    }
    expect(s.teleop.status().aimTrimDeg).toBe(T.maxAimTrimDeg);
  }, 60000);

  test("launcher trim steps launcherTrimStepTps and stops at maxLauncherTrimTps", async () => {
    const s = await session();
    for (let i = 0; i < 10; i++) {
      s.advance(0.02, pad(), pad(["R1"]));
      s.advance(0.02);
    }
    expect(s.teleop.status().launcherTrim * T.launcherTargetTps).toBeCloseTo(
      T.maxLauncherTrimTps,
      6,
    );
    s.advance(0.02, pad(), pad(["L1"]));
    s.advance(0.02);
    expect(s.teleop.status().launcherTrim * T.launcherTargetTps).toBeCloseTo(
      T.maxLauncherTrimTps - T.launcherTrimStepTps,
      6,
    );
  }, 60000);

  test("Zero Turret (held 0.5 s) puts the aim trim back to 0", async () => {
    const s = await session();
    s.advance(0.05, pad(), pad(["DPAD_LEFT"]));
    s.advance(0.05);
    expect(s.teleop.status().aimTrimDeg).not.toBe(0);
    s.advance(0.6, pad(), pad(["DPAD_UP"]));
    expect(s.teleop.status().aimTrimDeg).toBe(0);
    expect(s.teleop.status().note).toMatch(/aim trim back to 0/);
  }, 60000);
});

describe("the operator's FLOWER stick (Square toggle)", () => {
  test("deploys and retracts the stick", async () => {
    const s = await session();
    const me = () => s.sim.robots[s.sim.me];
    expect(me().stickDown).toBeFalsy();
    s.advance(0.05, pad(), pad(["SQUARE"]));
    s.advance(0.05);
    expect(me().stickDown).toBe(true);
    s.advance(0.05, pad(), pad(["SQUARE"]));
    s.advance(0.05);
    expect(me().stickDown).toBe(false);
  }, 60000);
});
