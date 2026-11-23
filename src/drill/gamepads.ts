/**
 * Reading PlayStation controllers in the browser, whatever mapping it gives them.
 *
 * Chrome and Edge give a DualShock 4 or DualSense the browser's "standard" mapping: left stick
 * axes 0 and 1, right stick axes 2 and 3, triggers as buttons 6 and 7 (0 at rest). Other
 * browsers and some Bluetooth links give a non-standard one, and then axes 2 to 5 are often the
 * right stick and the two triggers in another order, a trigger resting at -1. Read as the
 * standard mapping, a trigger at rest on axis 2 is the right stick held full over: the robot
 * turns as soon as PLAY starts, with nobody touching the pad.
 *
 * So each pad's rest is captured when it first appears (a browser only shows a pad after a
 * button press, with the sticks let go) and again on "Re-zero":
 * - standard mapping: a stick resting a little off centre (drift, up to `MAX_DRIFT`) is zeroed;
 * - non-standard mapping: an axis resting at an end (about -1, a trigger) or beyond one (a
 *   D-pad hat) is never a stick. The sticks are the remaining axes in order (left X, left Y,
 *   right X), and the triggers the axes resting at -1 (L2 first). Its buttons are taken in the
 *   common PlayStation order, which not every browser keeps: the panel warns about it.
 *
 * Devices that are not controllers (a DualShock's motion sensors and touchpad, which some systems
 * list as gamepads of their own) are left out.
 */
import { NO_PAD, type PadRead } from "./controls";

/** A resting stick further off centre than this is not drift. */
export const MAX_DRIFT = 0.25;
/** An axis resting further out than this is a trigger or a hat, not a stick. */
const AT_END = 0.9;

/** The standard mapping's buttons by our `Input` names. */
const STANDARD: Record<string, number> = {
  CROSS: 0,
  CIRCLE: 1,
  SQUARE: 2,
  TRIANGLE: 3,
  L1: 4,
  R1: 5,
  L2: 6,
  R2: 7,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
};
/** A PlayStation pad's buttons without the standard mapping (Linux and Firefox order). */
const PS_RAW: Record<string, number> = {
  CROSS: 0,
  CIRCLE: 1,
  TRIANGLE: 2,
  SQUARE: 3,
  L1: 4,
  R1: 5,
  L2: 6,
  R2: 7,
};
const OPTIONS = 9;
const SHARE = 8;

/** Not a controller: a pad's motion sensors or touchpad, listed as a gamepad of its own. */
export function isPseudoPad(id: string): boolean {
  return /motion sensors?|touchpad|accelerometer|gyro/i.test(id);
}

/** The controllers connected, in the browser's order, without pseudo-devices. */
export function connectedPads(list: readonly (Gamepad | null)[]): Gamepad[] {
  return list.filter(
    (g): g is Gamepad => !!g && g.connected && !isPseudoPad(g.id),
  );
}

export interface DecodedPad extends PadRead {
  /** L2 and R2, 0 at rest to 1 pulled. */
  l2: number;
  r2: number;
  options: boolean;
  share: boolean;
  standard: boolean;
  /** Which axis each of left X, left Y, right X, L2, R2 came from (-1: none). */
  axisOf: { lx: number; ly: number; rx: number; l2: number; r2: number };
}

const keyOf = (g: Gamepad) => `${g.index}|${g.id}`;

/** Reads pads, each against its own rest. */
export class PadDecoder {
  private rest = new Map<string, number[]>();

  constructor(private triggerPressed = 0.3) {}

  /** Takes each pad's rest now: call with the sticks let go. */
  rezero(list: readonly Gamepad[]): void {
    for (const g of list) this.rest.set(keyOf(g), [...g.axes]);
  }

  restOf(g: Gamepad): number[] {
    const k = keyOf(g);
    let r = this.rest.get(k);
    if (!r) {
      r = [...g.axes];
      this.rest.set(k, r);
    }
    return r;
  }

  read(g: Gamepad | null): DecodedPad {
    if (!g)
      return {
        ...NO_PAD,
        l2: 0,
        r2: 0,
        options: false,
        share: false,
        standard: true,
        axisOf: { lx: -1, ly: -1, rx: -1, l2: -1, r2: -1 },
      };
    const rest = this.restOf(g);
    const standard = g.mapping === "standard";
    const btn = (i: number | undefined) => {
      const b = i === undefined ? undefined : g.buttons[i];
      return b ? Math.max(b.value, b.pressed ? 1 : 0) : 0;
    };
    let axisOf: DecodedPad["axisOf"];
    let l2: number, r2: number;
    if (standard) {
      axisOf = { lx: 0, ly: 1, rx: 2, l2: -1, r2: -1 };
      l2 = btn(6);
      r2 = btn(7);
    } else {
      const sticks: number[] = [],
        triggers: number[] = [];
      rest.forEach((v, i) => {
        if (v <= -AT_END && v >= -1.01) triggers.push(i);
        else if (Math.abs(v) < AT_END) sticks.push(i);
      });
      axisOf = {
        lx: sticks[0] ?? -1,
        ly: sticks[1] ?? -1,
        rx: sticks[2] ?? -1,
        l2: triggers[0] ?? -1,
        r2: triggers[1] ?? -1,
      };
      // A trigger axis runs -1 (rest) to 1 (pulled); a pad without trigger axes has them as buttons.
      const trig = (i: number, button: number) =>
        i >= 0 ? ((g.axes[i] ?? -1) + 1) / 2 : btn(button);
      l2 = trig(axisOf.l2, 6);
      r2 = trig(axisOf.r2, 7);
    }
    const stick = (i: number) => {
      if (i < 0) return 0;
      const v = g.axes[i] ?? 0,
        r = rest[i] ?? 0;
      // Only drift is zeroed: a stick held at the capture is not taken as its rest.
      return Math.abs(r) <= MAX_DRIFT ? clamp(v - r) : clamp(v);
    };
    const buttons = standard ? STANDARD : PS_RAW;
    const lx = stick(axisOf.lx),
      ly = stick(axisOf.ly),
      rx = stick(axisOf.rx);
    const dpad = (input: string) => {
      if (standard) return btn(STANDARD[input]) > 0.5;
      // Without the standard mapping the D-pad is often a hat axis or buttons 12-15; buttons only.
      const i = { DPAD_UP: 12, DPAD_DOWN: 13, DPAD_LEFT: 14, DPAD_RIGHT: 15 }[
        input
      ];
      return btn(i) > 0.5;
    };
    return {
      lx,
      ly,
      rx,
      l2,
      r2,
      options: btn(OPTIONS) > 0.5,
      share: btn(SHARE) > 0.5,
      standard,
      axisOf,
      held: (input) => {
        if (input === "L2") return l2 > this.triggerPressed;
        if (input === "R2") return r2 > this.triggerPressed;
        if (input.startsWith("DPAD_")) return dpad(input);
        return btn(buttons[input]) > 0.5;
      },
    };
  }
}

const clamp = (v: number) => Math.max(-1, Math.min(1, v));
