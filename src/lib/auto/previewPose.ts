import type { ProjectDoc } from "../../io";
import type { Settings } from "../../types";
import { robotPoseAt, type RobotPose } from "../../sim/pose";
import { motionPoseAt, type PreviewResult } from "./simulate";

/** Where a robot is in a preview: on its project paths, or on a routine's own drive. */
export function previewPose(
  preview: PreviewResult,
  seconds: number,
  doc: Pick<ProjectDoc, "startPoint" | "lines">,
  settings: Settings,
): RobotPose {
  // Routine patterns and straight drives are not project paths; the
  // preview places the robot on them itself.
  const motion = motionPoseAt(preview, seconds);
  if (motion)
    return { x: motion.x, y: motion.y, heading: motion.headingDeg, t: null };
  return robotPoseAt(
    seconds,
    preview.timeline,
    doc.startPoint,
    doc.lines,
    settings,
  );
}
