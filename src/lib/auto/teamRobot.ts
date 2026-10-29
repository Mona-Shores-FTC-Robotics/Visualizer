import type { RobotConfig } from "../../types";

/**
 * Mona Shores' robot (20245 and 19429 are the same), the box a new project starts with: 17.5 in
 * from its back plate to the tip of the FLOWER poker, 16 in wide, and the box's middle 1.03 in
 * ahead of the drive base's centre (the back plate is 7.72 in behind it). `public/robot.png` is
 * drawn for this box. Upstream's defaults stay as they are; the fork applies this on top.
 */
export const TEAM_ROBOT_BOX: Pick<
  RobotConfig,
  "rLength" | "rWidth" | "rForward"
> = {
  rLength: 17.5,
  rWidth: 16,
  rForward: 1.03,
};
