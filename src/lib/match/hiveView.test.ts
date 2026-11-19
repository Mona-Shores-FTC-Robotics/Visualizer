import { assertEqual, test } from "../testing/harness";
import { fallbackValues, hiveHistory } from "../timing/model";
import { hiveAt, missesAt, MISS_S } from "./hiveView";

// RIGHT starts up with 3 NECTAR (weight 5); a 4-POLLEN volley at 3 s TIPs it (5 + 4 >= 8), the swing
// runs 3.5-4.5 s; LEFT then takes 4 at 8 s and 4 more at 12 s, which TIPs it (12.5-13.5 s).
const values = {
  ...fallbackValues(),
  tipStartS: 0.5,
  tipSwingS: 1,
  startLoad: 5,
  volleyLoad: 4,
  tipLoad: 8,
};
const history = hiveHistory(
  [
    { t: 3, robot: 0 },
    { t: 8, robot: 1 },
    { t: 12, robot: 1 },
  ],
  values,
);
const at = (t: number) => hiveAt(history, values, t);

test("the HIVE starts RIGHT up with its NECTAR, and a volley lands in the raised CELL", () => {
  assertEqual(at(0), {
    right: { down: 0, pollen: 0, nectar: true },
    left: { down: 1, pollen: 0, nectar: false },
  });
  assertEqual(at(3.2).right, { down: 0, pollen: 4, nectar: true });
});

test("a TIP swings the CELLs over its swing, and what was in the CELL going down spills", () => {
  assertEqual(at(4), {
    right: { down: 0.5, pollen: 4, nectar: true },
    left: { down: 0.5, pollen: 0, nectar: false },
  });
  assertEqual(at(5), {
    right: { down: 1, pollen: 0, nectar: false },
    left: { down: 0, pollen: 0, nectar: false },
  });
  assertEqual(at(9).left, { down: 0, pollen: 4, nectar: false });
  assertEqual(at(12.2).left, { down: 0, pollen: 8, nectar: false });
  assertEqual(at(14), {
    right: { down: 0, pollen: 0, nectar: false },
    left: { down: 1, pollen: 0, nectar: false },
  });
});

test("a volley that misses its TIP is drawn falling away from the CELL, which neither gains it nor TIPs", () => {
  const missed = hiveHistory(
    [
      { t: 3, robot: 0 },
      { t: 8, robot: 1 },
    ],
    { ...values, tip1Misses: 1 },
  );
  assertEqual(
    missed.tips.map((tip) => tip.start),
    [8.5],
    "the fix TIPs it",
  );
  assertEqual(hiveAt(missed, values, 4).right, {
    down: 0,
    pollen: 0,
    nectar: true,
  });
  assertEqual(missesAt(missed, values, 4), [
    { cell: "right", age: 1 / MISS_S, pieces: 4 },
  ]);
  assertEqual(missesAt(missed, values, 3 + MISS_S + 0.1), []);
});
