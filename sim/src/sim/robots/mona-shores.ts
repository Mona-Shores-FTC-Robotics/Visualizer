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
  void team; // the two robots differ in their FLOWER stick and TeleOp arc rule, which the intake model takes next
  return c;
}
