/**
 * Fork: how biobuzz's Java simulator turns the robot, so the preview's timing matches it (mentor,
 * 20 Nov 2026). The preview only: the export and the endgame guard keep the drawing's timing, so
 * nothing changes on the robot.
 *
 * Copied from biobuzz master (the simulator is test code there, not something the page can read):
 * - TURN_SHARE_RAD_PER_S: AutoSim.TURN_SHARE_RAD_PER_S, 130 deg/s. A mecanum drive's wheels do both
 *   jobs, so driving at v while turning at w needs v / maxSpeed + w / TURN_SHARE <= 1; fit to the
 *   Belding logs (a 90 in curve that turns 270 deg on the way: 3.6 to 4.6 s, drawn 2.9 s).
 * - MAX_TURN_RAD_PER_S: RobotDesign.maxTurnRadPerS, 300 deg/s, the drivetrain's turn in place.
 */
import type { Settings } from "../../types";

export const SIM_TURN_SHARE_RAD_PER_S = (130 * Math.PI) / 180;
export const SIM_MAX_TURN_RAD_PER_S = (300 * Math.PI) / 180;

/**
 * The settings the preview times paths with: the drawing's, turning as the simulator turns, at
 * `speed` (the robot's driveSpeed against the drawing, which scales its turning as it scales its
 * driving: the 25 Oct light chassis at 1.5 turned FAR_FLOWER to N_FIRE's 180 deg in 1.17 s, and
 * 15.5 in / 75 in/s + 180 deg / 195 deg/s is 1.13 s).
 */
export function simTurning(settings: Settings, speed = 1): Settings {
  const k = speed > 0 ? speed : 1;
  return {
    ...settings,
    turnShareRadPerS: SIM_TURN_SHARE_RAD_PER_S * k,
    maxTurnRadPerS: SIM_MAX_TURN_RAD_PER_S * k,
  };
}
