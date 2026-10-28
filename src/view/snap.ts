import { FIELD_IMAGE_OVERHANG } from "../config/defaults";
import type { BasePoint } from "../types";
import { clampFieldCoordinate } from "../utils/math";

export interface GridSnapOptions {
  snapToGrid: boolean;
  showGrid: boolean;
  gridSize: number;
}

/** Clamp into the field, snapping to the nearest grid intersection when snapping is on. */
export function snapPoint(
  point: BasePoint,
  { snapToGrid, showGrid, gridSize }: GridSnapOptions,
): BasePoint {
  // The grid is spaced from the tile corner, so intersections are offset from
  // the floor origin by the image overhang.
  const snap = (value: number) =>
    snapToGrid && showGrid && gridSize > 0
      ? Math.round((value + FIELD_IMAGE_OVERHANG) / gridSize) * gridSize -
        FIELD_IMAGE_OVERHANG
      : value;
  return {
    x: clampFieldCoordinate(snap(point.x)),
    y: clampFieldCoordinate(snap(point.y)),
  };
}

/**
 * Fork: Shift-drag keeps the point level with `anchor` (same y) or plumb with
 * it (same x), whichever the point is already closer to, so a path runs
 * exactly along the field's x or y axis.
 */
export function lockToAxis(point: BasePoint, anchor: BasePoint): BasePoint {
  return Math.abs(point.x - anchor.x) >= Math.abs(point.y - anchor.y)
    ? { x: point.x, y: anchor.y }
    : { x: anchor.x, y: point.y };
}
