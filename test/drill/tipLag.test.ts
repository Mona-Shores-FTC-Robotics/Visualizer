import { describe, expect, test } from "vitest";
import { DrillSession } from "../../src/drill/session";
import { median } from "../../src/drill/readout";
import { CONTROLS, pad, rapier } from "./helpers";

/**
 * The TIP lag, last ball out to CELL settled, against what our films and logs measured
 * (biobuzz TeamCode/autos/timing-terms.md): at its tipping weight (four POLLEN on the three
 * NECTAR a raised CELL starts with) 3.4 to 6.5 s, median 3.9; well past it (nine or more
 * pieces) 2.2 to 2.5 s.
 */
async function lags(volleys: number, seeds: number[]): Promise<number[]> {
  const R = await rapier();
  const out: number[] = [];
  for (const seed of seeds) {
    const s = new DrillSession(R, CONTROLS, 20245, "driver", seed);
    s.start();
    const b = s.sim.robot;
    b.setTranslation({ x: -0.32, y: b.translation().y, z: 1.3 }, true);
    for (let v = 0; v < volleys; v++) {
      s.sim.carried = ["pollen", "pollen", "pollen", "pollen"];
      s.advance(2.7, pad(["CIRCLE"]));
    }
    for (let i = 0; i < 40 && !s.tips.length; i++) s.advance(0.25, pad());
    expect(s.tips.length, `seed ${seed}: no TIP`).toBe(1);
    out.push(s.tips[0].lagS);
  }
  return out;
}

describe("TIP lag", () => {
  test("at its tipping weight: about 3.9 s, 3.4 to 6.7", async () => {
    const l = await lags(1, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(median(l)).toBeGreaterThan(3.6);
    expect(median(l)).toBeLessThan(4.2);
    expect(Math.min(...l)).toBeGreaterThan(3.0);
    expect(Math.max(...l)).toBeLessThan(7.0);
  }, 120000);

  test("well past it: about 2.5 s", async () => {
    const l = await lags(2, [1, 2, 3, 4, 5]);
    expect(median(l)).toBeGreaterThan(2.1);
    expect(median(l)).toBeLessThan(2.8);
  }, 120000);
});
