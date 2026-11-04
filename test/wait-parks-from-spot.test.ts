// Fork: a Wait whose outcomes each end with their own Park (the "then: park" form) is entered on
// the spot the drive before it reached. When time runs short at the start of an outcome, the
// robot parks from that spot (biobuzz AutoKit.spotPark, kept into the block), not along the
// outcome's own Park path, which starts where that outcome's last drive ends. On biobuzz's r-solo.pp.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/config/defaults";
import { parseProject, robotConfigOf } from "../src/io";
import type { ProjectDoc } from "../src/io/project";
import { buildPathCatalog } from "../src/lib/auto/geometry";
import { simulateAuto, switchKey } from "../src/lib/auto/simulate";

function load(): ProjectDoc {
  const loaded = parseProject(
    readFileSync("test/fixtures/autos/r-solo-then-park.pp", "utf8"),
    robotConfigOf(DEFAULT_SETTINGS),
  );
  if (!loaded.ok) throw new Error(loaded.error);
  return loaded.doc;
}

describe("a Wait's outcome entered with too little time left", () => {
  for (const tipped of [true, false]) {
    it(`parks from the spot the robot is on (${tipped ? "✓" : "✗"})`, () => {
      const doc = load();
      const auto = doc.auto!;
      const catalog = buildPathCatalog(doc.startPoint, doc.lines, {
        ...DEFAULT_SETTINGS,
        ...doc.robot,
      });
      const wait = auto.cards[auto.cards.length - 1];
      expect(wait.kind).toBe("firstOf");
      const before = auto.cards[auto.cards.length - 2];
      expect(before.kind).toBe("path");
      const spotPark = auto.parkFrom![before.id];
      expect(spotPark).toBeTruthy();
      // The robot gets to the wait late: a long first command leaves no time for the outcome.
      const slow = structuredClone(auto);
      const first = slow.cards[0];
      if (first.kind !== "action")
        throw new Error("first card is not a command");
      first.timeoutS = 12;
      const result = simulateAuto(slow, catalog, doc.startPoint, {
        [switchKey(wait.id)]: tipped,
      });
      expect(result.guard).not.toBeNull();
      const last = result.drives[result.drives.length - 1];
      const arrived = result.drives[result.drives.length - 2];
      expect(arrived.cardId).toBe(before.id);
      expect(last.pathId).toBe(spotPark);
      expect(last.t1).toBeLessThanOrEqual(30 + 1e-6);
    });
  }
});
