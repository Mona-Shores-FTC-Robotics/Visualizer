import { describe, expect, test } from "vitest";
import { ArcLight, Indicator, choose, colour } from "../../src/drill/indicator";
import { DrillSession } from "../../src/drill/session";
import { CONTROLS, pad, rapier } from "./helpers";

// The robot's indicator light, as biobuzz master's IndicatorSubsystem.choose, ArcLight and
// IndicatorSubsystem.position have it (IndicatorSubsystemTest's cases, where they apply).

describe("IndicatorSubsystem.choose: the first that holds", () => {
  test("INIT: the alliance's colour; an Auto's warnings flash white", () => {
    expect(choose(true, false, true, "red", true, true, true)).toBe(
      "ALLIANCE_RED",
    );
    expect(choose(true, false, false, "blue", false, false, false)).toBe(
      "ALLIANCE_BLUE",
    );
    expect(choose(true, false, false, null, false, false, false)).toBe("OFF");
    expect(choose(true, true, false, "red", false, false, false)).toBe(
      "CHECK_DRIVER_STATION",
    );
  });
  test("after PLAY: a fire held outside the arc, then the arc turn's pulse, then full, then outside, then off", () => {
    expect(choose(false, false, true, "red", true, true, true)).toBe(
      "FIRING_OUTSIDE_ARC",
    );
    expect(choose(false, false, true, "red", true, false, true)).toBe(
      "ARC_TURN",
    );
    expect(choose(false, false, true, "red", true, false, false)).toBe("FULL");
    expect(choose(false, false, false, "red", true, false, false)).toBe(
      "OUTSIDE_ARC",
    );
    expect(choose(false, false, false, "red", false, false, false)).toBe("OFF");
  });
  test("the colours: green full, orange outside and the pulse, orange flashing at FLASH_MS", () => {
    expect(colour("FULL", 0)).toBe("green");
    expect(colour("OUTSIDE_ARC", 0)).toBe("orange");
    expect(colour("ARC_TURN", 300)).toBe("orange");
    expect(colour("FIRING_OUTSIDE_ARC", 100)).toBe("orange");
    expect(colour("FIRING_OUTSIDE_ARC", 300)).toBeNull();
    expect(colour("FIRING_OUTSIDE_ARC", 520)).toBe("orange");
    expect(colour("OFF", 0)).toBeNull();
  });
});

describe("ArcLight", () => {
  test("outside lights it at once; back inside it waits 300 ms to clear; a fire held makes it flash", () => {
    const a = new ArcLight();
    expect(a.update(false, false, 0)).toBe("NONE");
    expect(a.update(true, false, 100)).toBe("ORANGE");
    expect(a.update(true, true, 150)).toBe("FLASH");
    expect(a.update(false, false, 449)).toBe("ORANGE");
    expect(a.update(false, false, 450)).toBe("NONE");
  });
  test("the pulse outranks orange but not the flash, and clears the flash's hold", () => {
    const a = new ArcLight();
    a.update(true, true, 0);
    a.pulse(100, 400);
    expect(a.update(false, true, 120)).toBe("PULSE");
    expect(a.update(true, true, 200)).toBe("FLASH");
    a.pulse(300, 400);
    expect(a.update(false, false, 650)).toBe("PULSE");
    expect(a.update(false, false, 700)).toBe("NONE");
  });
});

describe("the light as BasicDriveTeleOp feeds it", () => {
  test("circleTurnsIntoArc on: dark outside the arc in normal driving; one pulse as the turn starts; full is green", () => {
    const i = new Indicator();
    expect(i.update(0, true, false, false, true, false)).toBe("OFF");
    expect(i.update(20, true, true, true, true, false)).toBe("ARC_TURN");
    expect(i.update(399, true, true, true, true, true)).toBe("ARC_TURN");
    expect(i.update(420, true, true, true, true, true)).toBe("FULL");
    // A fire held outside the arc that nothing turns in (the turn cancelled): flashing.
    expect(i.update(500, true, true, false, true, true)).toBe(
      "FIRING_OUTSIDE_ARC",
    );
  });
  test("circleTurnsIntoArc off: steady orange outside the arc, over a full lane's green only when firing", () => {
    const i = new Indicator();
    expect(i.update(0, true, false, false, false, true)).toBe("FULL");
    expect(i.update(20, true, false, false, false, false)).toBe("OUTSIDE_ARC");
    expect(i.update(40, true, true, false, false, true)).toBe(
      "FIRING_OUTSIDE_ARC",
    );
  });
});

describe("in the drill", () => {
  test("red before PLAY; after PLAY off with an empty lane, green once it is full", async () => {
    const s = new DrillSession(await rapier(), CONTROLS, 20245, "driver", 1);
    expect(s.teleop.light.signal).toBe("ALLIANCE_RED");
    s.start();
    s.advance(0.2);
    expect(s.teleop.light.signal).toBe("OFF");
    s.sim.carried = Array(s.preset.laneCapacity).fill("pollen");
    s.advance(0.1);
    expect(s.teleop.light.signal).toBe("FULL");
    expect(s.teleop.light.colour(s.t * 1000)).toBe("green");
  }, 60000);

  test("Circle in AIM with the CELL behind the arc: the arc turn's orange pulse", async () => {
    const s = new DrillSession(await rapier(), CONTROLS, 20245, "driver", 1);
    s.start();
    // Facing away from our raised CELL: the aim is behind the arc.
    const b = s.sim.robot;
    b.setTranslation({ x: -0.5, y: b.translation().y, z: 1.0 }, true);
    b.setRotation(
      { x: 0, y: Math.sin(Math.PI / 2), z: 0, w: Math.cos(Math.PI / 2) },
      true,
    );
    s.advance(0.3);
    expect(s.teleop.status().insideArc).toBe(false);
    s.advance(0.1, pad(["CIRCLE"]));
    expect(s.teleop.status().arcTurning).toBe(true);
    expect(s.teleop.light.signal).toBe("ARC_TURN");
  }, 60000);
});
