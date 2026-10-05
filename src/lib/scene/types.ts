import type * as d3 from "d3";
import type { BasePoint, Path } from "../../types";

export interface SceneScales {
  x: d3.ScaleLinear<number, number>;
  y: d3.ScaleLinear<number, number>;
}

export interface PathRenderSpec {
  startPoint: BasePoint;
  lines: Path[];
  idPrefix: string;
  color?: string;
  opacityScale?: number;
  honorLocked?: boolean;
  /** Segment ids not to draw (an Auto's link paths, never driven). */
  hidden?: Set<string>;
}
