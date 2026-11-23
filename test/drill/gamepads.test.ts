import { describe, expect, test } from "vitest";
import { readPad } from "../../src/drill/controls";
import { PadBinder, PadDecoder, connectedPads } from "../../src/drill/gamepads";
import { DrillSession } from "../../src/drill/session";
import { CONTROLS, rapier } from "./helpers";

// A PlayStation pad without the browser's standard mapping (Firefox, some Bluetooth links): the
// two triggers are axes resting at -1, and axis 2 is L2, not the right stick.

function pad(
  axes: number[],
  mapping = "",
  buttons: number[] = [],
  id = "054c-09cc-Wireless Controller",
  index = 0,
): Gamepad {
  return {
    id,
    index,
    connected: true,
    mapping,
    timestamp: 0,
    axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({
      pressed: buttons.includes(i),
      touched: false,
      value: buttons.includes(i) ? 1 : 0,
    })),
  } as unknown as Gamepad;
}
// Left X, left Y, L2, right X, right Y, R2: the common non-standard PlayStation order.
const AT_REST = [0, 0, -1, 0, 0, -1];

describe("a non-standard PlayStation mapping", () => {
  test("read as the standard mapping, the resting L2 axis is a full right turn: the bug", () => {
    expect(readPad(pad(AT_REST), 0.3).rx).toBe(-1);
  });

  test("decoded by where its axes rest: sticks centred, triggers at 0", () => {
    const d = new PadDecoder(0.3),
      g = pad(AT_REST);
    const r = d.read(g);
    expect([r.lx, r.ly, r.rx, r.l2, r.r2]).toEqual([0, 0, 0, 0, 0]);
    expect(r.standard).toBe(false);
    expect(r.axisOf).toEqual({ lx: 0, ly: 1, rx: 3, l2: 2, r2: 5 });
    // The right stick is axis 3; R2 pulled is axis 5 to 1.
    const moved = d.read(pad([0, 0, -1, 0.7, 0, 1]));
    expect(moved.rx).toBeCloseTo(0.7);
    expect(moved.r2).toBeCloseTo(1);
    expect(moved.held("R2")).toBe(true);
    expect(moved.held("L2")).toBe(false);
  });

  test("the drill holds still at PLAY with it, and turns with the right stick", async () => {
    const s = new DrillSession(await rapier(), CONTROLS, 20245, "driver", 1);
    const d = new PadDecoder(0.3);
    d.read(pad(AT_REST)); // first seen, at rest
    s.start();
    const h0 = s.sim.heading,
      p0 = s.sim.robot.translation();
    s.advance(3, d.read(pad(AT_REST)));
    const p1 = s.sim.robot.translation();
    expect(Math.abs(s.sim.heading - h0)).toBeLessThan(1e-6);
    expect(Math.hypot(p1.x - p0.x, p1.z - p0.z)).toBeLessThan(1e-6);
    s.advance(0.5, d.read(pad([0, 0, -1, 1, 0, -1])));
    expect(Math.abs(s.sim.heading - h0)).toBeGreaterThan(0.5);
  }, 60000);
});

describe("the standard mapping", () => {
  test("a stick resting a little off centre (drift) reads 0; one held at the capture is not zeroed", () => {
    const d = new PadDecoder(0.3);
    expect(d.read(pad([0.08, -0.06, 0.04, 0], "standard")).lx).toBe(0);
    expect(d.read(pad([0.08, -0.06, 0.04, 0], "standard")).rx).toBe(0);
    const held = new PadDecoder(0.3);
    expect(held.read(pad([0.6, 0, 0, 0], "standard")).lx).toBeCloseTo(0.6);
  });

  test("a pad's motion sensors, listed as a gamepad of their own, are not a controller", () => {
    const list = connectedPads([
      pad(
        [0.1, 0.9, 0.2],
        "",
        [],
        "Sony Interactive Entertainment Wireless Controller Motion Sensors",
      ),
      pad([0, 0, 0, 0], "standard"),
    ]);
    expect(list).toHaveLength(1);
    expect(list[0].mapping).toBe("standard");
  });
});

describe("binding controllers by Cross (A)", () => {
  // The mentor's laptop: slot 0 empty, another device at 1 with its axes off centre, the real
  // controller (an Xbox 360 pad, standard mapping) at 2.
  const junk = (buttons: number[] = []) =>
    pad(
      [0.42, -0.65, 1, 0.3],
      "standard",
      buttons,
      "Virtual Gamepad (vJoy)",
      1,
    );
  const xbox = (buttons: number[] = [], axes = [0, 0, 0, 0]) =>
    pad(
      axes,
      "standard",
      buttons,
      "Xbox 360 Controller (XInput STANDARD GAMEPAD)",
      2,
    );

  test("a pad that never presses is never bound; the one that presses Cross is the driver", () => {
    const b = new PadBinder(["0:driver", "0:operator"]);
    const list = () => connectedPads([null, junk(), xbox()]);
    b.update(list());
    expect(b.padFor("0:driver", list())).toBeNull();
    expect(b.waiting()).toBe("0:driver");
    b.update(connectedPads([null, junk(), xbox([0])]));
    // Held: its press is the binding, not the driver's Cross.
    expect(
      b.padFor("0:driver", connectedPads([null, junk(), xbox([0])])),
    ).toBeNull();
    expect(b.boundPad("0:driver", list())?.index).toBe(2);
    b.update(list());
    expect(b.padFor("0:driver", list())?.id).toContain("Xbox 360");
    expect(b.roleOf(junk())).toBeNull();
    expect(b.waiting()).toBe("0:operator");
  });

  test("the drill driven by the bound pad holds still at PLAY with the other device off centre", async () => {
    const s = new DrillSession(await rapier(), CONTROLS, 20245, "two", 1);
    const d = new PadDecoder(0.3),
      b = new PadBinder(["0:driver", "0:operator"]);
    b.update(connectedPads([null, junk(), xbox([0])]));
    b.update(connectedPads([null, junk(), xbox()]));
    const read = (role: string) =>
      d.read(b.padFor(role, connectedPads([null, junk(), xbox()])));
    s.start();
    const h0 = s.sim.heading,
      p0 = s.sim.robot.translation();
    s.advance(3, read("0:driver"), read("0:operator"));
    const p1 = s.sim.robot.translation();
    expect(Math.abs(s.sim.heading - h0)).toBeLessThan(1e-6);
    expect(Math.hypot(p1.x - p0.x, p1.z - p0.z)).toBeLessThan(1e-6);
  }, 60000);

  test("a single pad at index 0, every axis and button at 0: nothing moves at PLAY", async () => {
    const s = new DrillSession(await rapier(), CONTROLS, 20245, "two", 1);
    const d = new PadDecoder(0.3),
      g = pad([0, 0, 0, 0], "standard", [], "Xbox 360 Controller", 0);
    s.start();
    const h0 = s.sim.heading,
      p0 = s.sim.robot.translation();
    s.advance(3, d.read(g));
    const p1 = s.sim.robot.translation();
    expect(Math.abs(s.sim.heading - h0)).toBeLessThan(1e-6);
    expect(Math.hypot(p1.x - p0.x, p1.z - p0.z)).toBeLessThan(1e-6);
    expect(s.teleop.status().launcher).toBe("IDLE");
  }, 60000);
});
