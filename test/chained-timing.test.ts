import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/config/defaults";
import { motionProfile } from "../src/sim/motionProfile";
import { robotPoseAt } from "../src/sim/pose";
import { calculatePathTime } from "../src/utils/timeCalculator";
import type { Path, StartPose } from "../src/types";

const settings = { ...DEFAULT_SETTINGS };
const start: StartPose = { x: 20, y: 20, headingDeg: 0 };
const straight = (id: string, x: number): Path => ({
  id,
  kind: "atomic",
  color: "#fff",
  endPoint: { x, y: 20 },
  controlPoints: [],
  heading: { type: "constant", degrees: 0 },
});

describe("a group is one motion", () => {
  // Exported as one Pedro path, a group is followed without stopping at the
  // joins inside it; separate paths each start and end at rest.
  const group: Path = {
    id: "group",
    kind: "compound",
    color: "#fff",
    segments: [straight("a", 50), straight("b", 80)],
  };

  it("takes one profile over its whole length", () => {
    const grouped = calculatePathTime(start, [group], settings);
    expect(grouped.totalTime).toBeCloseTo(motionProfile(60, settings).duration);
  });

  it("is quicker than the same segments driven as separate paths", () => {
    const grouped = calculatePathTime(start, [group], settings);
    const separate = calculatePathTime(
      start,
      [straight("a", 50), straight("b", 80)],
      settings,
    );
    expect(separate.totalTime).toBeCloseTo(
      2 * motionProfile(30, settings).duration,
    );
    expect(grouped.totalTime).toBeLessThan(separate.totalTime);
  });

  it("keeps the robot moving through the join", () => {
    const { timeline } = calculatePathTime(start, [group], settings);
    const join = timeline[0].endTime;
    const before = robotPoseAt(join - 0.05, timeline, start, [group], settings);
    const after = robotPoseAt(join + 0.05, timeline, start, [group], settings);
    // At rest it would cover almost nothing in 0.1 s.
    expect(after.x - before.x).toBeGreaterThan(2);
    expect(before.x).toBeLessThan(50);
    expect(after.x).toBeGreaterThan(50);
  });
});
