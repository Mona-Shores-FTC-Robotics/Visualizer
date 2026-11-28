// A one-ball launch lands one piece in the raised CELL; LaunchOneAimed, the human player's NECTAR
// fired with the turret (biobuzz, 28 Nov 2026), lands a NECTAR's weight, so it counts toward a TIP.
import { describe, expect, it } from "vitest";
import type { PreviewResult } from "../src/lib/auto/simulate";
import {
  fallbackValues,
  hiveHistory,
  NECTAR_WEIGHT,
  oneShotWeight,
} from "../src/lib/timing/model";
import { volleysOf } from "../src/lib/timing/together";

function preview(actions: { command: string; t0: number; t1: number }[]) {
  return { launches: [], actions } as unknown as PreviewResult;
}

describe("one-ball launches", () => {
  it("land one piece, and a NECTAR's weight for LaunchOneAimed", () => {
    expect(oneShotWeight("LaunchOne")).toBe(1);
    expect(oneShotWeight("LaunchOneAimed")).toBe(NECTAR_WEIGHT);
    expect(oneShotWeight("LaunchAll")).toBe(0);
  });

  it("tip a CELL that a volley left one ball short", () => {
    const values = { ...fallbackValues(), tipLoad: 8, startLoad: 0, volleyLoad: 4 };
    // One robot's 4, the other's 3 (one missed), then the NECTAR: 4 + 3 + 1.65 tips the CELL at 8.
    const volleys = volleysOf(
      [
        preview([{ command: "LaunchAll", t0: 1, t1: 3 }]),
        preview([
          { command: "LaunchAll", t0: 2, t1: 4 },
          { command: "LaunchOneAimed", t0: 5, t1: 6 },
        ]),
      ],
      [4, 3],
    );
    const shortOfIt = hiveHistory(volleys.slice(0, 2), values);
    expect(shortOfIt.tips.length).toBe(0);
    const withNectar = hiveHistory(volleys, values);
    expect(withNectar.tips.length).toBe(1);
    expect(withNectar.tips[0].lastBall).toBe(6);
  });
});
