// Mona Shores: our robot's two grab routines, as master's code runs them (biobuzz opmodes/FlowerPicker.java and
// opmodes/GardenGather.java, on GrabRoutine), for the sim and the driver drill. Each is a state machine stepped once per
// physics step: it returns the velocity the robot drives at (RobotState.velDrive), whether the FLOWER stick is down, and
// whether the intake runs. Pieces are then taken by the sim's own intake physics (cfg.intake, with the stick), never by a
// drawn yield. The numbers are master's, in src/sim/robots/mona-shores.json ("routines"), each with its source; where
// master's routine does more than this one (steering gains, curved paths, stall retries), this one says so.
//
// Poses are master's, in Pedro's frame (inches, origin at the red/audience corner, CCW), converted here to the sim's
// (meters about the centre, X toward blue, Z toward the audience): X = (x - 70.75) * 0.0254, Z = -(y - 70.75) * 0.0254,
// heading unchanged (the sim's forward is (cos h, -sin h) in X, Z).
import model from './mona-shores.json';
import { FIELD, IN } from '../config';
import type { Sim } from '../world';
import { driveEnvelope, limitDrive, type Team } from './mona-shores';

const C_IN = 70.75;
type Pose = { x: number; z: number; h: number };
const fromPedro = (x: number, y: number, hDeg: number): Pose => ({ x: (x - C_IN) * IN, z: -(y - C_IN) * IN, h: (hDeg * Math.PI) / 180 });
/** Half a turn about the centre: blue's side is red's turned (FieldFrame). */
const turned = (p: Pose): Pose => ({ x: -p.x, z: -p.z, h: p.h + Math.PI });
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const R = model.routines;

export type Drive = { vx: number; vz: number; w: number };
export interface RoutineStep { drive: Drive; stickDown: boolean; intake: boolean; phase: string; done: boolean; note: string }

/** Drives toward a pose within our robot's measured envelope (robot-axis top speed and acceleration, turn rate). */
class Mover {
  constructor(private team: Team) {}
  /** One step toward `to` at `frac` of the top speed in that direction, braking to arrive. */
  step(sim: Sim, to: Pose, frac: number, dt: number): Drive {
    const p = sim.robot.translation(), dx = to.x - p.x, dz = to.z - p.z, d = Math.hypot(dx, dz), h = sim.heading;
    // The direction of travel in robot axes sets the envelope (forward (cos h, -sin h), left (-sin h, -cos h)).
    const f = dx * Math.cos(h) - dz * Math.sin(h), l = -dx * Math.sin(h) - dz * Math.cos(h);
    const env = driveEnvelope(this.team, Math.atan2(l, f));
    const vmax = Math.min(frac * env.top, Math.sqrt(2 * env.accel * d));
    const want = { vx: d > 1e-4 ? (dx / d) * vmax : 0, vz: d > 1e-4 ? (dz / d) * vmax : 0, w: 5 * wrap(to.h - h) };
    const v = sim.robot.linvel();
    return limitDrive(this.team, h, { vx: v.x, vz: v.z }, want, dt);
  }
  stop(): Drive { return { vx: 0, vz: 0, w: 0 }; }
}

function mover(team: Team): Mover { return new Mover(team); }

const near = (sim: Sim, to: Pose, posM: number, deg: number) => {
  const p = sim.robot.translation();
  return Math.hypot(to.x - p.x, to.z - p.z) < posM && Math.abs(wrap(to.h - sim.heading)) < (deg * Math.PI) / 180;
};

/**
 * The FLOWER pick (FlowerPicker): line up square to the nearest FLOWER, `approachStandoffIn` back from its centre (the
 * staging spot); the stick goes down within `lowerWithinIn` of it, and the push waits `stickDownMs` for the stick; push
 * straight in at `pushSpeed` to `contactStandoffIn` from the FLOWER's centre, ending early on a stall; dwell up to
 * `dwellMs` pulling the bottom POLLEN, ending on a full lane, or after `dwellEmptyMs` with nothing; back out at
 * `backSpeed` to where the push started, the stick up once `retractAfterBackIn` out. Not modelled: the push's heading and
 * lateral correction (it drives the line exactly) and the short-push retry.
 */
export class FlowerPick {
  phase: 'lineup' | 'stick' | 'push' | 'dwell' | 'back' | 'done' = 'lineup';
  private m: Mover; private t = 0; private stickAt = NaN; private pulled = 0; private lastPullAt = -Infinity; private lastProgress = { d: Infinity, at: 0 };
  readonly flower: { id: string; x: number; z: number; stack: string[] };
  private stage: Pose; private contact: Pose;
  constructor(private sim: Sim, team: Team) {
    this.m = mover(team);
    const p = sim.robot.translation();
    const f = [...sim.flowers].sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    this.flower = f as unknown as FlowerPick['flower'];
    // The FLOWER stands on a wall; the robot faces it from the field side, along the wall's normal.
    const n = Math.abs(f.x) > Math.abs(f.z) ? { x: -Math.sign(f.x), z: 0 } : { x: 0, z: -Math.sign(f.z) };
    const h = Math.atan2(n.z, -n.x); // facing -n, toward the FLOWER: forward (cos h, -sin h) = -n
    const at = (inches: number): Pose => ({ x: f.x + n.x * inches * IN, z: f.z + n.z * inches * IN, h });
    this.stage = at(R.flowerPick.approachStandoffIn.value);
    this.contact = at(R.flowerPick.contactStandoffIn.value);
  }
  step(dt: number): RoutineStep {
    const s = this.sim, F = R.flowerPick; this.t += dt;
    const p = s.robot.translation(), toStage = Math.hypot(this.stage.x - p.x, this.stage.z - p.z);
    let drive: Drive = { vx: 0, vz: 0, w: 0 }, stick = !Number.isNaN(this.stickAt);
    if (Number.isNaN(this.stickAt) && this.phase === 'lineup' && toStage < F.lowerWithinIn.value * IN) { this.stickAt = this.t; stick = true; }
    switch (this.phase) {
      case 'lineup':
        drive = this.m.step(s, this.stage, 1, dt);
        if (near(s, this.stage, F.atApproachIn.value * IN, F.atApproachDeg.value)) this.phase = 'stick';
        break;
      case 'stick':
        drive = this.m.stop();
        if (this.t - this.stickAt >= F.stickDownMs.value / 1000) { this.phase = 'push'; this.lastProgress = { d: Infinity, at: this.t }; }
        break;
      case 'push': {
        drive = this.m.step(s, this.contact, F.pushSpeed.value, dt);
        const d = Math.hypot(this.contact.x - p.x, this.contact.z - p.z);
        if (d < this.lastProgress.d - F.stallProgressIn.value * IN) this.lastProgress = { d, at: this.t };
        if (d < 0.01 || this.t - this.lastProgress.at > F.stallMs.value / 1000) { this.phase = 'dwell'; this.lastProgress.at = this.t; }
        break;
      }
      case 'dwell': {
        drive = this.m.stop();
        // Seated: the bottom POLLEN comes out every flowerPullS (the stick's pull; FLOWER PULL below).
        const f = this.flower, full = s.carried.length >= s.cfg.capacity;
        if (!full && f.stack[0] === 'pollen' && this.t - this.lastPullAt >= R.flowerPick.flowerPullS.value) {
          f.stack.shift(); s.carried.push('pollen'); this.pulled++; this.lastPullAt = this.t;
        }
        const since = this.t - this.lastProgress.at;
        if ((F.dwellEndsOnFull.value && s.carried.length >= s.cfg.capacity) || since >= F.dwellMs.value / 1000
            || (this.pulled === 0 && since >= F.dwellEmptyMs.value / 1000) || f.stack[0] !== 'pollen') this.phase = 'back';
        break;
      }
      case 'back':
        drive = this.m.step(s, this.stage, F.backSpeed.value, dt);
        if (toStage < 0.03) this.phase = 'done';
        break;
    }
    if (this.phase === 'back' && Math.hypot(this.contact.x - p.x, this.contact.z - p.z) > F.retractAfterBackIn.value * IN) stick = false;
    if (this.phase === 'done') { drive = this.m.stop(); stick = false; }
    return { drive, stickDown: stick, intake: stick, phase: this.phase, done: this.phase === 'done', note: `FLOWER ${this.flower.id}: ${this.phase}, ${this.pulled} pulled` };
  }
}

/**
 * The GARDEN gather (GardenGather, the driver's button): line up at the GARDEN's line-up pose moved `lineUpBackIn` back
 * and `lineUpOutIn` toward the side wall (negative: into it, so the robot presses onto the wall), facing the audience
 * wall; the stick comes down within `lowerWithinIn`, and the drive in waits `stickDownMs` for it; drive in along the
 * wall at `inSpeed` toward the gather pose plus `extraDepthIn`, stopping on a stall (with the stick down, the stick on
 * the audience wall, the robot's centre about `stickStopIn` out); dwell `dwellMs`, ending early on a full lane; back
 * out at `backSpeed` to the line-up, the stick up `raiseAfterStopMs` after stopping. The intake takes what the stick
 * lifts (cfg.intake.stick). Not modelled: the curve to the wall, the two-step drive in, and the corner choice
 * (`anyCorner`: this gathers at our own GARDEN).
 */
export class GardenGather {
  phase: 'lineup' | 'stick' | 'in' | 'dwell' | 'back' | 'raise' | 'done' = 'lineup';
  private m: Mover; private t = 0; private stickAt = NaN; private phaseAt = 0; private best = Infinity; private bestAt = 0;
  private lineUp: Pose; private gather: Pose; private stickStop: number; private wallZ: number;
  constructor(private sim: Sim, team: Team) {
    this.m = mover(team);
    const G = R.gardenGather, red = sim.alliance === 'red';
    const g = G.gatherPose.value, l = G.lineUpPose.value, frameHalf = model.shared.frameIn.value / 2;
    // Red's GARDEN, with the line-up moved back from the audience wall and out toward (into) the side wall.
    let gather = fromPedro(g[0], g[1], g[2]);
    let lineUp = fromPedro(l[0] + G.lineUpOutIn.value, l[1] + G.lineUpBackIn.value, l[2]);
    // The robot can go no nearer the side wall than its half frame: pressed on it.
    const sideX = (x: number) => Math.max(x, -FIELD.half + frameHalf * IN);
    // extraDepthIn: negative ends the drive in short of the gather pose (further from the audience wall, +Z for red).
    gather = { ...gather, x: sideX(gather.x), z: gather.z + (team === '19429' ? G.extraDepthIn19429.value : G.extraDepthIn.value) * IN };
    lineUp = { ...lineUp, x: sideX(lineUp.x) };
    this.gather = red ? gather : turned(gather); this.lineUp = red ? lineUp : turned(lineUp);
    this.stickStop = G.stickStopIn.value * IN; this.wallZ = FIELD.half;
  }
  /** Distance from the robot's centre to the audience wall it faces (red) or the rear wall (blue). */
  private fromWall() { const z = this.sim.robot.translation().z; return this.wallZ - (this.sim.alliance === 'red' ? z : -z); }
  step(dt: number): RoutineStep {
    const s = this.sim, G = R.gardenGather; this.t += dt;
    const p = s.robot.translation(), toLine = Math.hypot(this.lineUp.x - p.x, this.lineUp.z - p.z);
    let drive: Drive = { vx: 0, vz: 0, w: 0 };
    const headingOk = Math.abs(wrap(this.lineUp.h - s.heading)) < (G.lowerWithinDeg.value * Math.PI) / 180;
    if (Number.isNaN(this.stickAt) && this.phase === 'lineup' && toLine < G.lowerWithinIn.value * IN && headingOk) this.stickAt = this.t;
    const go = (ph: GardenGather['phase']) => { this.phase = ph; this.phaseAt = this.t; this.best = Infinity; this.bestAt = this.t; };
    switch (this.phase) {
      case 'lineup':
        drive = this.m.step(s, this.lineUp, 1, dt);
        if (near(s, this.lineUp, 0.03, G.atLineUpDeg.value)) go('stick');
        break;
      case 'stick':
        drive = this.m.stop();
        if (!Number.isNaN(this.stickAt) && this.t - this.stickAt >= G.stickDownMs.value / 1000) go('in');
        else if (Number.isNaN(this.stickAt)) this.stickAt = this.t;
        break;
      case 'in': {
        // The stick on the wall stops the drive in (stickStopIn): the robot gets no nearer.
        const target = { ...this.gather, z: this.gather.z };
        drive = this.m.step(s, target, G.inSpeed.value, dt);
        const atStick = this.fromWall() <= this.stickStop;
        if (atStick) { drive = { vx: 0, vz: 0, w: drive.w }; this.m.stop(); }
        const d = this.fromWall();
        if (d < this.best - G.stallProgressIn.value * IN) { this.best = d; this.bestAt = this.t; }
        if (atStick || this.t - this.bestAt > G.stallMs.value / 1000 || this.t - this.phaseAt > G.inTimeoutMs.value / 1000) go('dwell');
        break;
      }
      case 'dwell':
        drive = this.m.stop();
        if ((G.dwellEndsOnFull.value && s.carried.length >= s.cfg.capacity) || this.t - this.phaseAt >= G.dwellMs.value / 1000) go('back');
        break;
      case 'back':
        drive = this.m.step(s, this.lineUp, G.backSpeed.value, dt);
        if (toLine < 0.03) go('raise');
        break;
      case 'raise':
        drive = this.m.stop();
        if (this.t - this.phaseAt >= G.raiseAfterStopMs.value / 1000) go('done');
        break;
    }
    const stick = !Number.isNaN(this.stickAt) && this.phase !== 'done';
    return { drive, stickDown: stick, intake: stick, phase: this.phase, done: this.phase === 'done', note: `GARDEN gather: ${this.phase}` };
  }
}
