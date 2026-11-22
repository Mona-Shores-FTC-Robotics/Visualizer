import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  fixItLook,
  robotFromText,
  routeChoices,
  runBeside,
  waitLegs,
} from "../src/partner/beside";
import { PRESETS, routeRobot } from "../src/partner/route";
import { fallbackValues } from "../src/lib/timing/model";

const ours = (file: string) =>
  robotFromText(
    file,
    readFileSync(`${import.meta.dirname}/fixtures/partner/${file}`, "utf8"),
  );
const values = fallbackValues();
const base = { choices: {}, tips: {} };

describe("FIX IT: their TIP misses, and we cross to their end", () => {
  it("takes the crossing leg, whichever leg of the choice it is", () => {
    const l = routeChoices(ours("l-no-cross.pp").doc.auto!);
    const r = routeChoices(ours("r-no-cross.pp").doc.auto!);
    // L-NoCross crosses as drawn; R-NoCross crosses on its other leg.
    expect(fixItLook(base, l, [])!.choices).toEqual({});
    expect(fixItLook(base, r, [])!.choices).toEqual({ "if no TIP 2": false });
    // The legs that wait instead.
    expect(waitLegs(l)).toEqual({ "if no TIP 1": false });
    expect(waitLegs(r)).toEqual({ "if no TIP 2": true });
  });

  it("misses the first try of each TIP the partner goes for, and none of ours", () => {
    const look = fixItLook(
      base,
      routeChoices(ours("l-no-cross.pp").doc.auto!),
      [
        { tip: 1, robot: 1, tries: 1, misses: 0, tryList: [] },
        { tip: 2, robot: 0, tries: 1, misses: 0, tryList: [] },
      ],
    );
    expect(look!.tips).toEqual({ 1: false });
  });

  it("is nothing for an Auto that never crosses", () => {
    expect(
      fixItLook(base, routeChoices(ours("r-solo.pp").doc.auto!), []),
    ).toBeNull();
  });

  it("runs L-NoCross across beside each stand-in", () => {
    const l = ours("l-no-cross.pp");
    for (const preset of PRESETS) {
      const partner = routeRobot(preset, values);
      const first = runBeside(l, partner, base, values, true, false);
      const look = fixItLook(base, routeChoices(l.doc.auto!), first.toggles)!;
      const fix = runBeside(l, partner, look, values, true, false);
      expect(fix.span).toBeGreaterThan(0);
    }
  });
});
