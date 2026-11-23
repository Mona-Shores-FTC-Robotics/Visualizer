// Maps mona-shores.json onto upstream's RobotConfig. Only what the JSON states replaces upstream's value; a null keeps
// it. Units: the JSON is in our frame's inches, RobotConfig in meters.
import model from './mona-shores.json';
import { DEFAULT_ROBOT, IN, setSquareSize, type RobotConfig } from '../config';

export type Team = '19429' | '20245';
export const MONA_SHORES = model;

/** The robot config for one of our robots. */
export function monaShoresConfig(team: Team): RobotConfig {
  const c: RobotConfig = structuredClone(DEFAULT_ROBOT), s = model.shared;
  setSquareSize(c, s.frameIn.value * IN);
  c.capacity = s.laneCapacity.value;
  c.shooter.type = 'fifo';
  c.shooter.cycleSec = s.launch.betweenBallsS.value;
  c.shooter.turret = true;
  c.shooter.turretRangeDeg = s.turret.arcLeftDeg.value + s.turret.arcRightDeg.value;
  if (s.turret.slewDegPerSec.value !== null) c.shooter.turretSlewDegPerSec = s.turret.slewDegPerSec.value;
  // Our intake (shared.intake): contact-only between the front wheels, and the FLOWER stick as the ramp in front.
  const i = s.intake;
  c.intake.width = i.widthIn.value * IN; c.intake.reach = i.contactSlackIn.value * IN;
  c.intake.successP = i.grabChance.value; c.intake.intervalSec = i.intervalS.value; c.intake.maxRelSpeed = i.maxRelSpeedInPerS.value * IN;
  c.intake.stick = { reach: i.stickReachIn.value * IN, width: i.stickWidthIn.value * IN };
  c.intake.flowerPeriodSec = model.routines.flowerPick.flowerPullS.value;
  void team; // the two robots' sticks (19429 roller, 20245 passive) pull at the same placeholder rate until timed
  return c;
}
