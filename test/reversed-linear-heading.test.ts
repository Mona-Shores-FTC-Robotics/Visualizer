import { describe, expect, it } from "vitest";
import { javaSpec, kotlinSpec, pathExpression } from "../src/lib/codegen";
import type { PathDecl, PiecewiseNode } from "../src/lib/codegen/types";

// The preview turns a reversed linear segment the long way round to its drawn end
// heading. Pedro's Interpolator.reverse() adds half a turn instead, so exporting it
// sent R-Solo to LEFT_LAUNCH_CLOSE facing away from the HIVE (biobuzz, 6 Nov 2026).
function piecewisePath(nodes: PiecewiseNode[]): PathDecl {
  return {
    methodName: "turn",
    expression: {
      kind: "segment",
      startPoseVar: "a",
      controlPoseVars: [],
      throughPoseVars: [],
      endPoseVar: "b",
      heading: { kind: "piecewise", nodes },
    },
  };
}

const linear = { kind: "linear", startPoseVar: "s", endPoseVar: "e" } as const;

describe("a reversed linear piecewise segment", () => {
  for (const spec of [javaSpec, kotlinSpec]) {
    it(`exports as longLinear (${spec === javaSpec ? "Java" : "Kotlin"})`, () => {
      const source = pathExpression(
        piecewisePath([{ untilT: 1, interpolator: linear, reversed: true }]),
        spec,
      );
      expect(source).toContain("Interpolator.longLinear(s, e)");
      expect(source).not.toContain(".reverse()");
    });
  }

  it("leaves an unreversed linear segment linear", () => {
    const source = pathExpression(
      piecewisePath([{ untilT: 1, interpolator: linear, reversed: false }]),
      javaSpec,
    );
    expect(source).toContain("Interpolator.linear(s, e)");
    expect(source).not.toContain("longLinear");
  });

  it("still faces a reversed facing-point segment backwards", () => {
    const source = pathExpression(
      piecewisePath([
        {
          untilT: 1,
          interpolator: { kind: "facingPoint", poseVar: "p" },
          reversed: true,
        },
      ]),
      javaSpec,
    );
    expect(source).toContain("Interpolator.facingPoint(p).reverse()");
  });
});
