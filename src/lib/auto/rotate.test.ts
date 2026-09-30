import { assert, assertEqual, test } from "../testing/harness";
import { rotateAutoData } from "./store";
import type { AutoSection } from "./types";

test("the other alliance's copy turns every named point half a turn about the field centre", () => {
  const auto = {
    version: 1,
    drawnFor: "RED",
    registry: { actions: [], conditions: [] },
    points: { RIGHT_START: [59, 9.5, 90], LEFT_DUMP: [59, 117.8, 308], Mark: [10, 20] },
    cards: [],
  };
  const turned = rotateAutoData(auto) as AutoSection;
  assertEqual(turned.drawnFor, "BLUE");
  const near = (a: number[], b: number[]) =>
    a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  assert(near(turned.points.RIGHT_START as number[], [82.5, 132, 270]), JSON.stringify(turned.points));
  assert(near(turned.points.LEFT_DUMP as number[], [82.5, 23.7, 128]), JSON.stringify(turned.points));
  assert(near(turned.points.Mark as number[], [131.5, 121.5]), JSON.stringify(turned.points));
});
