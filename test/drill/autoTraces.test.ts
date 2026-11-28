import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The Full Match Autos: scripts/drill-auto-traces.py's files, from biobuzz's AutoSim runs.

const dir = resolve(import.meta.dirname, "../../public/drill/autos");
const index = JSON.parse(readFileSync(resolve(dir, "index.json"), "utf8")) as {
  autos: { auto: string; autoTips: number }[];
};

describe("the Full Match Auto traces", () => {
  test("every generated Auto on biobuzz master has one", () => {
    expect(index.autos.map((a) => a.auto)).toEqual([
      "l-clockwise",
      "l-left-under-hive",
      "l-no-cross",
      "l-right-under-hive",
      "r-clockwise",
      "r-left-under-hive",
      "r-no-cross",
      "r-right-under-hive",
      "r-solo",
    ]);
  });

  for (const a of index.autos) {
    test(`${a.auto}: 38 s at 10 Hz, and a hand-off at TeleOp's start on the field`, () => {
      const t = JSON.parse(
        readFileSync(resolve(dir, `${a.auto}.json`), "utf8"),
      );
      expect(t.frames).toHaveLength(381);
      expect(t.frames.at(-1)[0]).toBe(38);
      expect(t.columns[0]).toBe("t");
      const h = t.handoff;
      for (const v of [h.pose.x, h.pose.y]) {
        expect(v).toBeGreaterThan(0);
        expect(v).toBeLessThan(141.5);
      }
      expect(h.held).toBeGreaterThanOrEqual(0);
      expect(h.held).toBeLessThanOrEqual(4);
      // The AUTO's TIPs are our HIVE's at the hand-off (red's: every AutoSim run is drawn for red).
      expect(t.alliance).toBe("RED");
      expect(h.hives.red.tips).toBe(t.autoTips);
      // Every piece is on the field or just outside a wall (the human players' stock).
      const all = [
        ...h.pieces.pollen,
        ...h.pieces.nectarRed,
        ...h.pieces.nectarBlue,
      ];
      for (const [x, , z] of all) {
        expect(Math.abs(x)).toBeLessThan(2.0);
        expect(Math.abs(z)).toBeLessThan(2.0);
      }
    });
  }
});
