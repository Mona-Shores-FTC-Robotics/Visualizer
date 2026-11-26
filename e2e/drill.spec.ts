import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Fork: the driver drill (drill/), driven by simulated PlayStation controllers: the page reads
// navigator.getGamepads(), which here returns pads the test presses. biobuzz's controls export is
// served from test/fixtures/biobuzz/controls.json instead of GitHub.

// A CI runner draws the field in software, slower than real time: the waits are on the simulated clock.
test.describe.configure({ timeout: 180000 });

const CONTROLS = readFileSync(
  `${import.meta.dirname}/../test/fixtures/biobuzz/controls.json`,
  "utf8",
);

/** Buttons in the standard mapping: Cross 0, Circle 1, Square 2, Triangle 3, L1 4, R1 5, L2 6, R2 7, Share 8, Options 9. */
const BTN = {
  CROSS: 0,
  CIRCLE: 1,
  SQUARE: 2,
  TRIANGLE: 3,
  L1: 4,
  R1: 5,
  L2: 6,
  R2: 7,
  OPTIONS: 9,
};

/** A pad as the browser gives it: standard mapping by default, or another, with its axes at rest. */
interface PadShape {
  mapping: string;
  axes: number[];
  /**
   * What the browser lists, slot by slot: our controllers, an empty slot, or another device that
   * never presses anything (a virtual pad, say) with its axes off centre. Default: four controllers.
   */
  slots?: ("pad" | "junk" | null)[];
}

async function open(
  page: Page,
  shape: PadShape = { mapping: "standard", axes: [0, 0, 0, 0] },
) {
  await page.route("https://raw.githubusercontent.com/**", (route) =>
    route.fulfill({ contentType: "application/json", body: CONTROLS }),
  );
  // The team sheet (src/drill/stats.ts TEAM_SHEET_URL): a finished run is posted there, so a test
  // run never reaches the real sheet; the stand-in takes it as the web app would.
  for (const host of [
    "https://script.google.com/**",
    "https://script.googleusercontent.com/**",
  ])
    await page.route(host, (route) =>
      route.fulfill({ status: 200, contentType: "text/plain", body: "" }),
    );
  // The 2:00 drill's opening, fixed so a run's TIPs can be counted: R-Solo's 2-TIP outcome, the
  // audience CELL raised and empty (the page draws it otherwise).
  await page.addInitScript(() => {
    try {
      const k = "biobuzz-drill-prefs";
      const p = JSON.parse(localStorage.getItem(k) ?? "{}");
      if (!p.opening)
        localStorage.setItem(k, JSON.stringify({ ...p, opening: "two" }));
    } catch {
      /* no storage */
    }
  });
  await page.addInitScript((shape) => {
    const make = (index: number) => ({
      id: `DualSense Wireless Controller (test ${index + 1})`,
      index,
      connected: true,
      mapping: shape.mapping,
      timestamp: 0,
      axes: [...shape.axes],
      buttons: Array.from({ length: 17 }, () => ({
        pressed: false,
        touched: false,
        value: 0,
      })),
    });
    const slots = shape.slots ?? ["pad", "pad", "pad", "pad"];
    const pads = slots.map((kind, index) => {
      if (kind === null) return null;
      const p = make(index);
      if (kind === "junk") {
        p.id = "Virtual Gamepad (vJoy)";
        p.mapping = "standard";
        p.axes = [0.42, -0.65, 1, 0.3];
      }
      return p;
    });
    (window as unknown as { __pads: unknown }).__pads = pads;
    Object.defineProperty(navigator, "getGamepads", {
      value: () => pads,
      configurable: true,
    });
  }, shape);
  await page.goto("drill/");
  await page.waitForFunction(
    () => !!(window as unknown as { __drill?: unknown }).__drill,
  );
}

/** Sets gamepad `pad` (0 driver, 1 operator): buttons held and sticks. */
async function setPad(
  page: Page,
  pad: number,
  held: number[] = [],
  axes: number[] = [0, 0, 0, 0],
) {
  await page.evaluate(
    ({ pad, held, axes }) => {
      const p = (
        window as unknown as {
          __pads: {
            axes: number[];
            buttons: { pressed: boolean; value: number }[];
          }[];
        }
      ).__pads[pad];
      p.axes = axes;
      p.buttons.forEach((b, i) => {
        b.pressed = held.includes(i);
        b.value = b.pressed ? 1 : 0;
      });
    },
    { pad, held, axes },
  );
}

/** Binds the roles in order: each of these pads presses Cross (A) and lets go, as at the start screen. */
async function bind(page: Page, ...pads: number[]) {
  for (const [n, pad] of pads.entries()) {
    await setPad(page, pad, [BTN.CROSS]);
    await page.waitForFunction(
      (n) =>
        (window as unknown as { __drill: { binder: { boundCount: number } } })
          .__drill.binder.boundCount > n,
      n,
    );
    await setPad(page, pad);
  }
}

/** Waits until the drill's clock reaches `t` seconds from PLAY. */
const waitSim = (page: Page, t: number, timeout = 60000) =>
  page.waitForFunction(
    (t) => (window as unknown as { __drill: Drill }).__drill.session.t >= t,
    t,
    { timeout },
  );

type Drill = {
  session: {
    t: number;
    finished: boolean;
    tips: unknown[];
    sim: {
      robot: {
        translation(): { x: number; z: number };
        setTranslation(v: object, w: boolean): void;
      };
      heading: number;
      carried: string[];
    };
    teleop: { turretMode: string; launched: number };
    readout: { cycles: { cycleS: number; feedS: number; balls: number }[] };
    advance(
      s: number,
      driver?: { lx: number; ly: number; rx: number; held(i: string): boolean },
    ): void;
  };
};
const drill = (page: Page) =>
  page.evaluate(() => {
    const d = (window as unknown as { __drill: Drill }).__drill.session;
    const p = d.sim.robot.translation();
    return {
      t: d.t,
      x: p.x,
      z: p.z,
      heading: d.sim.heading,
      mode: d.teleop.turretMode,
      launched: d.teleop.launched,
      tips: d.tips.length,
      finished: d.finished,
      cycles: d.readout.cycles,
      lane: d.sim.carried.length,
    };
  });

test("the drill lists the robot's own controls, from biobuzz's export", async ({
  page,
}) => {
  await open(page);
  const driver = page.locator("#driver-controls");
  await expect(driver).toContainText("Circle (B)");
  await expect(driver).toContainText(
    "Fire (hold): turret AIM, fires; LOCKED, turns onto the CELL, then fires",
  );
  await expect(driver).toContainText("R1 (bumper)");
  await expect(page.locator("#operator-controls")).toContainText(
    "Launcher Spin Up / Idle",
  );
  // The bound controller is named beside its role.
  await bind(page, 0);
  await expect(page.locator("#pads")).toContainText(
    "DualSense Wireless Controller",
  );
});

test("a simulated PS controller drives, toggles the turret and fires a volley", async ({
  page,
}) => {
  await open(page);
  await expect(page.locator("#clock")).toContainText("2:00");
  await expect(page.locator("#pads")).toContainText("press Cross (A)");
  await bind(page, 0);
  // Options starts the 2:00 TeleOp.
  await setPad(page, 0, [BTN.OPTIONS]);
  await page.waitForFunction(
    () => (window as unknown as { __drill: Drill }).__drill.session.t > 0.2,
  );
  await setPad(page, 0);
  const before = await drill(page);

  // Field-centric: the left stick pushed up drives away from our (red) wall, +X, whatever the heading.
  await setPad(page, 0, [], [0, -1, 0, 0]);
  // Waits on the simulated clock: a CI runner draws the field in software, slower than real time.
  await waitSim(page, before.t + 0.8);
  await setPad(page, 0);
  const after = await drill(page);
  expect(after.x - before.x).toBeGreaterThan(0.3);
  expect(Math.abs(after.z - before.z)).toBeLessThan(0.1);

  // R1 toggles the turret, AIM → LOCKED → AIM, and the HUD says so.
  expect(after.mode).toBe("AIM");
  await setPad(page, 0, [BTN.R1]);
  await expect(page.locator("#robot")).toContainText("LOCKED");
  await setPad(page, 0);
  await setPad(page, 0, [BTN.R1]);
  await expect(page.locator("#robot")).toContainText("AIM");
  await setPad(page, 0);

  // In front of our raised CELL with a full lane, Circle held fires four.
  await page.evaluate(() => {
    const s = (window as unknown as { __drill: Drill }).__drill.session;
    s.sim.robot.setTranslation({ x: -0.32, y: 0.17, z: 1.3 }, true);
    s.sim.carried = ["pollen", "pollen", "pollen", "pollen"];
  });
  await setPad(page, 0, [BTN.CIRCLE]);
  await page.waitForFunction(
    () =>
      (window as unknown as { __drill: Drill }).__drill.session.teleop
        .launched >= 4,
    null,
    { timeout: 60000 },
  );
  await setPad(page, 0);
  // The practice readout times the cycle the way the robot does, once the feed has closed.
  await expect(page.locator("#readout")).toContainText("CYCLE", {
    timeout: 30000,
  });
  await expect(page.locator("#readout")).toContainText("spin+aim");
  const done = await drill(page);
  expect(done.cycles[0].balls).toBe(4);
  // 20245: fire to gate 0.4 s and gate to the 4th ball 2.08 s, from its logs.
  expect(done.cycles[0].feedS).toBeGreaterThan(2.0);
  expect(done.cycles[0].feedS).toBeLessThan(3.2);
});

test("a run ends at 2:00 with a results screen, and the best run is kept", async ({
  page,
}) => {
  await open(page);
  await bind(page, 0);
  await setPad(page, 0, [BTN.OPTIONS]);
  await page.waitForFunction(
    () => (window as unknown as { __drill: Drill }).__drill.session.t > 0.1,
  );
  await setPad(page, 0);
  // The drill opened on our R-Solo's hand-off (2 AUTO TIPs), so our audience CELL is up and empty: three
  // volleys of four in front of it (12 POLLEN; the TIP weight is 7.4, so a miss or two still TIPs it) are one more
  // TIP. Fired on the session's own clock with Circle held (the readout still times each cycle),
  // so a slow CI machine does not run out the test's time.
  await page.evaluate(() => {
    const s = (window as unknown as { __drill: Drill }).__drill.session;
    const circle = { lx: 0, ly: 0, rx: 0, held: (i: string) => i === "CIRCLE" };
    for (const n of [4, 8, 12]) {
      s.sim.robot.setTranslation({ x: -0.32, y: 0.17, z: 1.3 }, true);
      s.sim.carried = ["pollen", "pollen", "pollen", "pollen"];
      for (let t = 0; t < 10 && s.teleop.launched < n; t += 0.1)
        s.advance(0.1, circle);
      s.advance(0.1);
    }
  });
  // The TIP settles seconds of simulated time after the volley (at weight, a median of 3.9 s
  // and up to 6.5): stepped on the session's own clock, not waited for in real time, so a slow
  // CI machine cannot run out the wait.
  const tips = await page.evaluate(() => {
    const s = (window as unknown as { __drill: Drill }).__drill.session;
    s.advance(12);
    return s.tips.length;
  });
  expect(tips).toBeGreaterThanOrEqual(1);
  await page.evaluate(() =>
    (window as unknown as { __drill: Drill }).__drill.session.advance(125),
  );
  await expect(page.locator("#tips")).toContainText("AUTO: 2 TIPs");
  await expect(page.locator("#results")).toBeVisible();
  await expect(page.locator("#results-card")).toContainText("of 7 TIPs");
  await expect(page.locator("#results-card")).toContainText("AUTO: 2 TIPs");
  await expect(page.locator("#results-card")).toContainText("spin-up and aim");
  await expect(page.locator("#results-card")).toContainText("new best");
  await expect(page.locator("#history")).toContainText("Best: 3 TIPs");

  // Options on the results screen starts the next run.
  await setPad(page, 0, [BTN.OPTIONS]);
  await expect(page.locator("#results")).toBeHidden();
  await expect(page.locator("#clock")).toContainText("TeleOp");

  // Kept in this browser: a reload still shows it.
  await page.reload();
  await expect(page.locator("#history")).toContainText("Best: 3 TIPs");
});

test("Full match: the AUTO replay shows R-Solo's volleys flying into our CELL", async ({
  page,
}) => {
  await open(page);
  await page
    .locator("#match option[value='r-solo']")
    .waitFor({ state: "attached" });
  await page.locator("#match").selectOption("r-solo");
  await bind(page, 0);
  await expect(page.locator("#start")).toContainText("Start the match");
  await setPad(page, 0, [BTN.OPTIONS]);
  await expect(page.locator("#clock")).toContainText("AUTO");
  await setPad(page, 0);
  // Stepped to just before R-Solo's first TIP (7.3 s): its first volley is in our HIVE, and the
  // page draws the trace's pieces rather than the simulator's (which wait for the hand-off).
  const at = await page.evaluate(() => {
    const s = (
      window as unknown as {
        __drill: {
          session: {
            playback: { t: number } | null;
            advance(s: number): void;
            replayPieces:
              { kind: string; x: number; y: number; z: number }[] | null;
          };
        };
      }
    ).__drill.session;
    s.advance(7.1 - (s.playback?.t ?? 0));
    const ps = s.replayPieces ?? [];
    return {
      t: s.playback?.t ?? -1,
      pieces: ps.length,
      high: ps.filter((q) => q.kind === "pollen" && q.y > 0.5).length,
    };
  });
  expect(at.pieces).toBeGreaterThan(30);
  expect(at.high).toBeGreaterThanOrEqual(3);
  await page.screenshot({
    path: test.info().outputPath("full-match-r-solo-7s.png"),
  });
});

test("alliance: two controllers drive Ultraviolet and Infrared on one field", async ({
  page,
}) => {
  await open(page);
  await page.locator("#mode").selectOption("alliance");
  await expect(page.locator("#pads")).toContainText(
    "Ultraviolet (20245) driver",
  );
  await expect(page.locator("#pads")).toContainText("Infrared (19429) driver");
  await expect(page.locator("#robot")).toContainText("Infrared (19429)");
  await bind(page, 0, 1);
  await setPad(page, 0, [BTN.OPTIONS]);
  await waitSim(page, 0.2);
  await setPad(page, 0);
  const at = () =>
    page.evaluate(() => {
      const s = (
        window as unknown as {
          __drill: {
            session: {
              t: number;
              sim: {
                robots: { body: { translation(): { x: number; z: number } } }[];
              };
            };
          };
        }
      ).__drill.session;
      return { t: s.t, robots: s.sim.robots.map((r) => r.body.translation()) };
    });
  const before = await at();
  expect(before.robots).toHaveLength(2);
  // Gamepad 2 drives the partner, and only the partner.
  await setPad(page, 1, [], [0, -1, 0, 0]);
  await waitSim(page, before.t + 0.8);
  await setPad(page, 1);
  const after = await at();
  // The partner starts side-on at the rear wall: up on the stick is a strafe (about 40 in/s),
  // and the rear FLOWER stops it at about 0.17 m. Which robot moves is the check, not how far.
  expect(after.robots[1].x - before.robots[1].x).toBeGreaterThan(0.1);
  expect(Math.abs(after.robots[0].x - before.robots[0].x)).toBeLessThan(0.02);

  await page.evaluate(() =>
    (window as unknown as { __drill: Drill }).__drill.session.advance(125),
  );
  await expect(page.locator("#results")).toBeVisible();
  await expect(page.locator("#results-card")).toContainText(
    "Alliance: Ultraviolet (20245) and Infrared (19429)",
  );
  await expect(page.locator("#results-card")).toContainText("the rear end");
  await expect(page.locator("#results-card")).not.toContainText("Mona Shores");
});

test("alliance with operators: four controllers, a driver and an operator per robot", async ({
  page,
}) => {
  await open(page);
  await page.locator("#mode").selectOption("alliance-ops");
  // The start screen: four roles, each bound by its controller's Cross, in order.
  await expect(page.locator("#pads tr")).toHaveCount(4);
  await expect(page.locator("#pads")).toContainText(
    "Infrared (19429) operator",
  );
  await expect(page.locator("#operator-section")).toBeVisible();
  await bind(page, 0, 1, 2, 3);
  await setPad(page, 0, [BTN.OPTIONS]);
  await waitSim(page, 0.2);
  await setPad(page, 0);
  // Gamepad 4, Infrared's operator: Cross spins up Infrared's launcher only.
  await setPad(page, 3, [BTN.CROSS]);
  await expect(page.locator("#robot")).toContainText("SPINNING UP");
  await setPad(page, 3);
  const launchers = await page.evaluate(() =>
    (
      window as unknown as {
        __drill: { session: { teleops: { status(): { launcher: string } }[] } };
      }
    ).__drill.session.teleops.map((t) => t.status().launcher),
  );
  expect(launchers).toEqual(["IDLE", "SPINNING UP"]);
  // Gamepad 3 drives Infrared.
  const x0 = await page.evaluate(
    () =>
      (
        window as unknown as {
          __drill: {
            session: {
              sim: { robots: { body: { translation(): { x: number } } }[] };
            };
          };
        }
      ).__drill.session.sim.robots[1].body.translation().x,
  );
  const t0 = await page.evaluate(
    () => (window as unknown as { __drill: Drill }).__drill.session.t,
  );
  await setPad(page, 2, [], [0, -1, 0, 0]);
  await waitSim(page, t0 + 0.8);
  await setPad(page, 2);
  const x1 = await page.evaluate(
    () =>
      (
        window as unknown as {
          __drill: {
            session: {
              sim: { robots: { body: { translation(): { x: number } } }[] };
            };
          };
        }
      ).__drill.session.sim.robots[1].body.translation().x,
  );
  expect(x1 - x0).toBeGreaterThan(0.1); // a strafe into the rear FLOWER, as in the test above
});

test("a PlayStation pad without the standard mapping: the robot holds still at PLAY, and the check says why", async ({
  page,
}) => {
  // Left X, left Y, L2, right X, right Y, R2: both triggers rest at -1, axis 2 is L2. Read as the
  // standard mapping, axis 2 is the right stick held full over and the robot spins at PLAY.
  await open(page, { mapping: "", axes: [0, 0, -1, 0, 0, -1] });
  await page.locator("#pad-check summary").click();
  await expect(page.locator("#pad-debug")).toContainText(
    "Not the browser's standard mapping",
  );
  await expect(page.locator("#pad-debug")).toContainText(/turn\s+0\.00/);
  await bind(page, 0);
  await page.locator("#start").click();
  const pose = () =>
    page.evaluate(() => {
      const s = (
        window as unknown as {
          __drill: {
            session: {
              t: number;
              sim: {
                heading: number;
                robot: { translation(): { x: number; z: number } };
              };
            };
          };
        }
      ).__drill.session;
      const p = s.sim.robot.translation();
      return { t: s.t, h: s.sim.heading, x: p.x, z: p.z };
    });
  const a = await pose();
  await waitSim(page, a.t + 1.5);
  const b = await pose();
  expect(Math.abs(b.h - a.h)).toBeLessThan(1e-3);
  expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(1e-3);
  // The right stick (axis 3) still turns it.
  await setPad(page, 0, [], [0, 0, -1, 1, 0, -1]);
  await waitSim(page, b.t + 0.8);
  await setPad(page, 0, [], [0, 0, -1, 0, 0, -1]);
  const c = await pose();
  expect(Math.abs(c.h - b.h)).toBeGreaterThan(0.3);
});

test("another device in the browser's list never drives: the role binds to the controller that presses Cross", async ({
  page,
}) => {
  // The mentor's laptop: slot 0 empty, a virtual pad at 1 with its axes off centre, the real
  // controller at 2. Taken by position, the virtual pad would be the driver and drive at PLAY.
  await open(page, {
    mapping: "standard",
    axes: [0, 0, 0, 0],
    slots: [null, "junk", "pad"],
  });
  await expect(page.locator("#pads")).toContainText("press Cross (A)");
  await expect(page.locator("#pads")).toContainText(
    "other controllers connected",
  );
  await bind(page, 2);
  await expect(page.locator("#pads")).toContainText("(index 2)");
  await page.locator("#pad-check summary").click();
  await expect(page.locator("#pad-debug")).toContainText("not bound: ignored");
  await expect(page.locator("#pad-debug")).toContainText("pose x");
  await page.locator("#start").click();
  const pose = () =>
    page.evaluate(() => {
      const s = (
        window as unknown as {
          __drill: {
            session: {
              t: number;
              sim: {
                heading: number;
                robot: { translation(): { x: number; z: number } };
              };
            };
          };
        }
      ).__drill.session;
      const p = s.sim.robot.translation();
      return { t: s.t, h: s.sim.heading, x: p.x, z: p.z };
    });
  const a = await pose();
  await waitSim(page, a.t + 1.5);
  const b = await pose();
  expect(Math.abs(b.h - a.h)).toBeLessThan(1e-3);
  expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(1e-3);
  // The bound controller drives.
  await setPad(page, 2, [], [0, -1, 0, 0]);
  await waitSim(page, b.t + 0.8);
  await setPad(page, 2);
  const c = await pose();
  expect(c.x - b.x).toBeGreaterThan(0.3);
});
