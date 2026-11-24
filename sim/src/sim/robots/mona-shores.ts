// Maps mona-shores.json onto upstream's RobotConfig. Only what the JSON states replaces upstream's value; a null keeps
// it. Units: the JSON is in our frame's inches, RobotConfig in meters.
import model from './mona-shores.json';
import { DEFAULT_ROBOT, IN, setSquareSize, type RobotConfig } from '../config';

export type Team = '19429' | '20245';
export const MONA_SHORES = model;
/**
 * The intake mouth the sim takes pieces through. 'cad' (the default): the real mouth, 9.7 in (shared.intake.widthIn,
 * biobuzz doc/corner-wheels.md). 'frame': the old 14.58 in, 0.9 x the frame (shared.intake.widthFrameIn), kept
 * switchable. A script or the drill sets it before it builds a robot; monaShoresConfig's `mouth` overrides it.
 */
export const INTAKE_MOUTH: { model: 'cad' | 'frame' } = { model: 'cad' };

/** The robot config for one of our robots. */
export function monaShoresConfig(team: Team, opts: { mouth?: 'cad' | 'frame' } = {}): RobotConfig {
  const c: RobotConfig = structuredClone(DEFAULT_ROBOT), s = model.shared;
  setSquareSize(c, s.frameIn.value * IN);
  c.capacity = s.laneCapacity.value;
  c.shooter.type = 'fifo';
  c.shooter.cycleSec = s.launch.betweenBallsS.value;
  c.shooter.turret = true;
  c.shooter.turretRangeDeg = s.turret.arcLeftDeg.value + s.turret.arcRightDeg.value;
  if (s.turret.slewDegPerSec.value !== null) c.shooter.turretSlewDegPerSec = s.turret.slewDegPerSec.value;
  // Our intake (shared.intake): contact-only through the mouth between the side rails, and the FLOWER stick as the ramp in front.
  const i = s.intake;
  c.intake.width = ((opts.mouth ?? INTAKE_MOUTH.model) === 'frame' ? i.widthFrameIn.value : i.widthIn.value) * IN; c.intake.reach = i.contactSlackIn.value * IN;
  c.intake.successP = i.grabChance.value; c.intake.intervalSec = i.intervalS.value; c.intake.maxRelSpeed = i.maxRelSpeedInPerS.value * IN;
  c.intake.stick = { reach: i.stickReachIn.value * IN, width: i.stickWidthIn.value * IN };
  c.intake.flowerPeriodSec = model.routines.flowerPick.flowerPullS.value;
  void team; // the two robots' sticks (19429 roller, 20245 passive) pull at the same placeholder rate until timed
  return c;
}

/**
 * Our robot's drive envelope in robot axes (robots.<team>.drive.envelope, from TeleOp logs): top speed and acceleration by
 * direction of travel, forward 0°, diagonal 45°, strafe 90°, straight lines between. A mecanum strafes slower than it
 * drives forward (about 40 against 62 in/s); diagonal is no faster than strafe, so this is not an ellipse.
 */
export function driveEnvelope(team: Team, angleRad: number): { top: number; accel: number } {
  const e = model.robots[team].drive.envelope, a = Math.abs(Math.atan2(Math.sin(angleRad), Math.cos(angleRad)));
  const deg = ((a > Math.PI / 2 ? Math.PI - a : a) * 180) / Math.PI, xs = e.angleDeg.value;
  const lerp = (ys: number[]) => { for (let i = 1; i < xs.length; i++) if (deg <= xs[i]) return ys[i - 1] + ((deg - xs[i - 1]) / (xs[i] - xs[i - 1])) * (ys[i] - ys[i - 1]); return ys[ys.length - 1]; };
  return { top: lerp(e.topInPerS.value) * IN, accel: lerp(e.accelInPerS2.value) * IN };
}

/**
 * Limits a wanted world velocity (m/s, and turn rad/s CCW) to our robot's envelope, from the velocity it has now, over
 * one step `dt`: the speed to the envelope's top in that direction of travel (robot axes, from `heading`), the change to
 * its acceleration, the turn to its turn rate. The drill and the routines both drive through this.
 */
export function limitDrive(team: Team, heading: number, now: { vx: number; vz: number }, want: { vx: number; vz: number; w: number }, dt: number) {
  // Robot axes: forward (cos h, -sin h) in X, Z; left (-sin h, -cos h).
  const toRobot = (vx: number, vz: number) => ({ f: vx * Math.cos(heading) - vz * Math.sin(heading), l: -vx * Math.sin(heading) - vz * Math.cos(heading) });
  const w0 = toRobot(want.vx, want.vz), sp = Math.hypot(w0.f, w0.l);
  const env = driveEnvelope(team, Math.atan2(w0.l, w0.f)), k = sp > env.top ? env.top / sp : 1;
  let vx = want.vx * k, vz = want.vz * k;
  const dvx = vx - now.vx, dvz = vz - now.vz, dv = Math.hypot(dvx, dvz);
  if (dv > 1e-9) { const d = toRobot(dvx, dvz), a = driveEnvelope(team, Math.atan2(d.l, d.f)).accel * dt; if (dv > a) { vx = now.vx + (dvx / dv) * a; vz = now.vz + (dvz / dv) * a; } }
  const turn = (model.robots[team].drive.envelope.turnDegPerS.value * Math.PI) / 180;
  return { vx, vz, w: Math.max(-turn, Math.min(turn, want.w)) };
}
