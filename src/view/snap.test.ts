import { assertEqual, test } from "../lib/testing/harness";
import { lockToAxis, snapPoint } from "./snap";

test("shift-drag keeps the axis the point is closer to", () => {
  const anchor = { x: 38, y: 71 };
  // Mostly sideways: level with the anchor, so the path runs along x.
  assertEqual(lockToAxis({ x: 90, y: 75.3 }, anchor), { x: 90, y: 71 });
  // Mostly up or down: plumb with it, so the path runs along y.
  assertEqual(lockToAxis({ x: 36.2, y: 120 }, anchor), { x: 38, y: 120 });
  // Exactly diagonal: x wins, so the result never jitters between the two.
  assertEqual(lockToAxis({ x: 48, y: 81 }, anchor), { x: 48, y: 71 });
});

test("the lock keeps the anchor's exact coordinate, even off the grid", () => {
  // The grid runs along the tile seams, 1.25 in past the floor's edge.
  const grid = { snapToGrid: true, showGrid: true, gridSize: 6 };
  const snapped = snapPoint({ x: 90.4, y: 74.2 }, grid);
  assertEqual(lockToAxis(snapped, { x: 38, y: 70.75 }), { x: 88.75, y: 70.75 });
});
