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

async function open(page: Page) {
  await page.route("https://raw.githubusercontent.com/**", (route) =>
    route.fulfill({ contentType: "application/json", body: CONTROLS }),
  );
  await page.addInitScript(() => {
    const make = (index: number) => ({
      id: `DualSense Wireless Controller (test ${index + 1})`,
      index,
      connected: true,
      mapping: "standard",
      timestamp: 0,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({
        pressed: false,
        touched: false,
        value: 0,
      })),
    });
    const pads = [make(0), make(1)];
    (window as unknown as { __pads: unknown }).__pads = pads;
    Object.defineProperty(navigator, "getGamepads", {
      value: () => pads,
      configurable: true,
    });
  });
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
    advance(s: number): void;
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
  await expect(page.locator("#pads")).toContainText(
    "DualSense Wireless Controller",
  );
});

test("a simulated PS controller drives, toggles the turret and fires a volley", async ({
  page,
}) => {
  await open(page);
  await expect(page.locator("#clock")).toContainText("2:00");
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
  await setPad(page, 0, [BTN.OPTIONS]);
  await page.waitForFunction(
    () => (window as unknown as { __drill: Drill }).__drill.session.t > 0.1,
  );
  await setPad(page, 0);
  // Two volleys at weight from in front of the CELL: one TIP. Then run the clock out.
  await page.evaluate(() => {
    const s = (window as unknown as { __drill: Drill }).__drill.session;
    s.sim.robot.setTranslation({ x: -0.32, y: 0.17, z: 1.3 }, true);
    s.sim.carried = ["pollen", "pollen", "pollen", "pollen"];
  });
  await setPad(page, 0, [BTN.CIRCLE]);
  await page.waitForFunction(
    () =>
      (window as unknown as { __drill: Drill }).__drill.session.tips.length >=
      1,
    null,
    { timeout: 90000 },
  );
  await setPad(page, 0);
  await page.evaluate(() =>
    (window as unknown as { __drill: Drill }).__drill.session.advance(125),
  );
  await expect(page.locator("#results")).toBeVisible();
  await expect(page.locator("#results-card")).toContainText("of 7 TIPs");
  await expect(page.locator("#results-card")).toContainText("spin-up and aim");
  await expect(page.locator("#results-card")).toContainText("new best");
  await expect(page.locator("#history")).toContainText("Best: 1 TIPs");

  // Options on the results screen starts the next run.
  await setPad(page, 0, [BTN.OPTIONS]);
  await expect(page.locator("#results")).toBeHidden();
  await expect(page.locator("#clock")).toContainText("TeleOp");

  // Kept in this browser: a reload still shows it.
  await page.reload();
  await expect(page.locator("#history")).toContainText("Best: 1 TIPs");
});
