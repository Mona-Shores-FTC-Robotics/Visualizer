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
  phase: 'refused' | 'lineup' | 'stick' | 'push' | 'dwell' | 'back' | 'done' = 'lineup';
  private m: Mover; private t = 0; private stickAt = NaN; private pulled = 0; private lastPullAt = -Infinity; private lastProgress = { d: Infinity, at: 0 };
  readonly flower: { id: string; x: number; z: number; stack: string[] };
  private stage: Pose; private contact: Pose;
  constructor(private sim: Sim, team: Team) {
    this.m = mover(team);
    const p = sim.robot.translation();
    const f = [...sim.flowers].sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    this.flower = f as unknown as FlowerPick['flower'];
    // FlowerPicker.nearest: only a FLOWER whose centre is within maxRangeIn; otherwise the button is refused.
    if (Math.hypot(f.x - p.x, f.z - p.z) > R.flowerPick.maxRangeIn.value * IN) this.phase = 'refused';
    // The FLOWER stands on a wall; the robot faces it from the field side, along the wall's normal.
    const n = Math.abs(f.x) > Math.abs(f.z) ? { x: -Math.sign(f.x), z: 0 } : { x: 0, z: -Math.sign(f.z) };
    const h = Math.atan2(n.z, -n.x); // facing -n, toward the FLOWER: forward (cos h, -sin h) = -n
    const at = (inches: number): Pose => ({ x: f.x + n.x * inches * IN, z: f.z + n.z * inches * IN, h });
    this.stage = at(R.flowerPick.approachStandoffIn.value);
    this.contact = at(R.flowerPick.contactStandoffIn.value);
  }
  step(dt: number): RoutineStep {
    const s = this.sim, F = R.flowerPick; this.t += dt;
    if (this.phase === 'refused') return { drive: { vx: 0, vz: 0, w: 0 }, stickDown: false, intake: false, phase: 'refused', done: true, note: `FLOWER pick refused: no FLOWER within ${F.maxRangeIn.value.toFixed(0)} in` };
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
 * Whether the GARDEN gathers lower the FLOWER stick (GardenGather.Stick.useStick). Off since biobuzz #756 (mentor,
 * 26 Nov 2026): the robot drives in with the intake on and the stick stowed, and the corner wheels rake; there is no
 * stick wait, no stick on the wall to stop the drive in (the robot's own front meets it), and no wait to raise it after.
 * The drive in then aims `noStickExtraDepthIn` deeper. On: the gathers below as they were.
 */
const gatherUsesStick = () => R.gardenGather.useStick?.value !== false;
const noStickDepthIn = () => (gatherUsesStick() ? 0 : (R.gardenGather.noStickExtraDepthIn?.value ?? 0));

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
    gather = { ...gather, x: sideX(gather.x), z: gather.z + ((team === '19429' ? G.extraDepthIn19429.value : G.extraDepthIn.value) + noStickDepthIn()) * IN };
    lineUp = { ...lineUp, x: sideX(lineUp.x) };
    this.gather = red ? gather : turned(gather); this.lineUp = red ? lineUp : turned(lineUp);
    this.stickStop = G.stickStopIn.value * IN; this.wallZ = FIELD.half;
  }
  /** Distance from the robot's centre to the audience wall it faces (red) or the rear wall (blue). */
  private fromWall() { const z = this.sim.robot.translation().z; return this.wallZ - (this.sim.alliance === 'red' ? z : -z); }
  step(dt: number): RoutineStep {
    const s = this.sim, G = R.gardenGather, useStick = gatherUsesStick(); this.t += dt;
    const p = s.robot.translation(), toLine = Math.hypot(this.lineUp.x - p.x, this.lineUp.z - p.z);
    let drive: Drive = { vx: 0, vz: 0, w: 0 };
    const headingOk = Math.abs(wrap(this.lineUp.h - s.heading)) < (G.lowerWithinDeg.value * Math.PI) / 180;
    if (Number.isNaN(this.stickAt) && this.phase === 'lineup' && toLine < G.lowerWithinIn.value * IN && headingOk) this.stickAt = this.t;
    const go = (ph: GardenGather['phase']) => { this.phase = ph; this.phaseAt = this.t; this.best = Infinity; this.bestAt = this.t; };
    switch (this.phase) {
      case 'lineup':
        drive = this.m.step(s, this.lineUp, 1, dt);
        if (near(s, this.lineUp, 0.03, G.atLineUpDeg.value)) go(useStick ? 'stick' : 'in');
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
        const atStick = useStick && this.fromWall() <= this.stickStop;
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
        if (toLine < 0.03) go(useStick ? 'raise' : 'done');
        break;
      case 'raise':
        drive = this.m.stop();
        if (this.t - this.phaseAt >= G.raiseAfterStopMs.value / 1000) go('done');
        break;
    }
    // Stick up: the intake runs the whole gather (the card starts it itself), and the stick never comes down.
    const stick = useStick && !Number.isNaN(this.stickAt) && this.phase !== 'done';
    return { drive, stickDown: stick, intake: useStick ? stick : this.phase !== 'done', phase: this.phase, done: this.phase === 'done', note: `GARDEN gather: ${this.phase}` };
  }
}

// ---------------------------------------------------------------------------------------------------- corner gather

/** A pose in Pedro's frame: inches, heading in degrees. */
type PedroPose = { x: number; y: number; h: number };
const FIELD_IN = 141.5;
const turnedP = (p: PedroPose): PedroPose => ({ x: FIELD_IN - p.x, y: FIELD_IN - p.y, h: p.h + 180 });
/** Reflected across x = y, red's corner's diagonal: 270° becomes 180° (GardenFieldPoints.diagonal). */
const diagonalP = (p: PedroPose): PedroPose => ({ x: p.y, y: p.x, h: 90 - p.h });
/** Mirrored across the centre line x = 70.75 (GardenFieldPoints.mirrored). */
const mirroredP = (p: PedroPose): PedroPose => ({ x: FIELD_IN - p.x, y: p.y, h: 180 - p.h });
const rad = (d: number) => (d * Math.PI) / 180;

/** One way into a corner (GardenFieldPoints.Garden): the gather pose, the line-up, and which side the wall run along is. */
export interface CornerWayIn { name: string; gather: PedroPose; lineUp: PedroPose; wallOnRight: boolean }

/**
 * GardenFieldPoints.CORNERS: red's GARDEN gather pose and line-up moved to each of the four corners, facing each of its two
 * walls, in corner order (a pair is entries 2k, 2k + 1): red's GARDEN corner, blue's, the audience wall's blue-side corner,
 * the far wall's red-side corner.
 */
export function cornerWaysIn(): CornerWayIn[] {
  const G = R.gardenGather, g = G.gatherPose.value, l = G.lineUpPose.value;
  const red = { gather: { x: g[0], y: g[1], h: g[2] }, lineUp: { x: l[0], y: l[1], h: l[2] } };
  const along = { gather: diagonalP(red.gather), lineUp: diagonalP(red.lineUp) };
  const w = (name: string, f: (p: PedroPose) => PedroPose, base: typeof red, wallOnRight: boolean): CornerWayIn =>
    ({ name, gather: f(base.gather), lineUp: f(base.lineUp), wallOnRight });
  const id = (p: PedroPose) => p;
  return [
    w('red GARDEN corner, facing the audience wall', id, red, true),
    w('red GARDEN corner, facing the side wall', id, along, false),
    w('blue GARDEN corner, facing the far wall', turnedP, red, true),
    w('blue GARDEN corner, facing the side wall', turnedP, along, false),
    w('audience blue-side corner, facing the audience wall', mirroredP, red, false),
    w('audience blue-side corner, facing the side wall', mirroredP, along, true),
    w('far red-side corner, facing the far wall', (p) => turnedP(mirroredP(p)), red, false),
    w('far red-side corner, facing the side wall', (p) => turnedP(mirroredP(p)), along, true),
  ];
}

/**
 * GardenFieldPoints.nearestCorner: of the corner whose ways in are nearest (x, y) (Pedro inches) within `maxRangeIn`, the
 * way in whose heading is closest to `hDeg`, so the line-up turns at most 45°. Null with no corner in range.
 */
export function nearestCorner(x: number, y: number, hDeg: number, maxRangeIn: number): CornerWayIn | null {
  const ways = cornerWaysIn();
  let pair = -1, best = maxRangeIn;
  ways.forEach((w, i) => { const r = Math.hypot(w.gather.x - x, w.gather.y - y); if (r <= best) { pair = Math.floor(i / 2); best = r; } });
  if (pair < 0) return null;
  const a = ways[2 * pair], b = ways[2 * pair + 1];
  const turn = (w: CornerWayIn) => Math.abs(wrap(rad(w.gather.h - hDeg)));
  return turn(a) <= turn(b) ? a : b;
}

const toPedroPose = (p: { x: number; z: number }, h: number): PedroPose => ({ x: p.x / IN + C_IN, y: C_IN - p.z / IN, h: (h * 180) / Math.PI });
const simPose = (p: PedroPose): Pose => fromPedro(p.x, p.y, p.h);

/**
 * The TeleOp's corner gather: the driver's GARDEN gather button (GardenGather.java run by BasicDriveTeleOp, with
 * Button.anyCorner, on GrabRoutine). It gathers in the nearest field corner within `maxRangeIn`, facing whichever of the
 * corner's two walls the robot already faces more nearly, so it works in any corner, not only at our GARDEN:
 * - **line-up**: to the way in's line-up pose `lineUpBackIn` back and `lineUpOutIn` out from the wall run along (negative:
 *   into it, so the robot presses onto the real wall); a stall within `stallWithinIn` ends it there. The stick goes down
 *   and the intake starts once within `lowerWithinIn`, facing to `lowerWithinDeg`, and turning slower than
 *   `lowerMaxTurnDegPerSec`.
 * - **prep**: the stick `stickDownMs` on its way down, and the robot slower than `settledInPerSec` (each wait capped at
 *   `settleMaxMs`).
 * - **in**: to the gather pose `extraDepthIn` deeper (negative: short of it), along the line the line-up stopped on
 *   (`followWallLine`, moved at most `maxWallLineShiftIn`), the heading `intoCornerDeg` toward the wall run along, at
 *   `inSpeed`; ends at the pose, on a stall (`stallProgressIn` in `stallMs`) or after `inTimeoutMs`.
 * - **dwell**: `dwellMs`, or until the lane is full, pushing forward at `dwellPushPower`, steered onto the line.
 * - **back**: to where the line-up ended at `backSpeed`, ending there, on a `backStallMs` stall or after `backTimeoutMs`;
 *   the stick up `raiseAfterStopMs` after.
 * With `useStick` off (the default since biobuzz #756), none of the stick: no stick wait in prep, nothing stops the drive
 * in short of the wall but the robot's own front, no raise after, and the intake on throughout (gatherUsesStick).
 * The stick on the wall ahead stops the robot `stickStopIn` out (the logged stop), as the GARDEN gather's does. Not
 * modelled: the drive in's curve to the wall (the line-up already presses onto it, so it runs along the wall) and the
 * two-step drive in.
 */
export class CornerGather {
  phase: 'refused' | 'lineup' | 'prep' | 'in' | 'dwell' | 'back' | 'raise' | 'done' = 'lineup';
  readonly way: CornerWayIn | null;
  private m: Mover; private t = 0; private phaseAt = 0; private stickAt = NaN;
  private best = Infinity; private bestAt = 0;
  private lineUp: Pose = { x: 0, z: 0, h: 0 }; private inPose: Pose = { x: 0, z: 0, h: 0 }; private home: Pose = { x: 0, z: 0, h: 0 };
  private wallDir = { x: 0, z: 0 };
  private turnRate: number; private envFwd: number; private envSide: number;
  private refusal = '';

  constructor(private sim: Sim, private team: Team) {
    this.m = mover(team);
    const G = R.gardenGather;
    const p = sim.robot.translation();
    const here = toPedroPose(p, sim.heading);
    this.way = nearestCorner(here.x, here.y, here.h, G.maxRangeIn.value);
    this.turnRate = rad(model.robots[team].drive.envelope.turnDegPerS.value);
    this.envFwd = driveEnvelope(team, 0).top; this.envSide = driveEnvelope(team, Math.PI / 2).top;
    if (!this.way) {
      this.phase = 'refused';
      this.refusal = `no field corner within ${G.maxRangeIn.value.toFixed(0)} in`;
      return;
    }
    // GardenGather.lineUpPose: back against the heading, out away from the wall run along (negative: into it).
    const l = this.way.lineUp, h = rad(l.h), side = this.way.wallOnRight ? 1 : -1;
    const back = G.lineUpBackIn.value, out = G.lineUpOutIn.value * side;
    this.lineUp = simPose({ x: l.x - back * Math.cos(h) - out * Math.sin(h), y: l.y - back * Math.sin(h) + out * Math.cos(h), h: l.h });
    // The wall ahead: the gather heading is square to one wall (sim forward is (cos h, -sin h)).
    const gh = rad(this.way.gather.h);
    this.wallDir = { x: Math.round(Math.cos(gh)), z: Math.round(-Math.sin(gh)) };
  }

  /** The way in, or why there is none. */
  get note(): string { return this.way ? this.way.name : this.refusal; }

  /** GardenGather.inPose: the gather pose deeper by extraDepthIn, toward the wall along the line-up's line, angled into the corner. */
  private planIn(from: Pose): Pose {
    const G = R.gardenGather, w = this.way!, g = w.gather, h = rad(g.h), side = w.wallOnRight ? 1 : -1;
    const deeper = (this.team === '19429' ? G.extraDepthIn19429.value : G.extraDepthIn.value) + noStickDepthIn();
    let wall = side * G.laneTowardWallIn.value;
    if (G.followWallLine.value && G.lineUpOutIn.value < 0) {
      // GardenGather.wallLineShiftIn: how far the line-up's end is off the pose's line toward the wall, held to the shift.
      const f = toPedroPose(from, from.h);
      const toward = side * ((f.x - g.x) * Math.sin(h) - (f.y - g.y) * Math.cos(h));
      const mx = Math.max(0, G.maxWallLineShiftIn.value);
      wall = side * Math.max(-mx, Math.min(mx, toward));
    }
    const corner = side * Math.max(-15, Math.min(15, G.intoCornerDeg.value));
    return simPose({ x: g.x + deeper * Math.cos(h) + wall * Math.sin(h), y: g.y + deeper * Math.sin(h) - wall * Math.cos(h), h: g.h - corner });
  }

  /** From the robot's centre to the wall it gathers against, metres. */
  private toWallAhead(): number {
    const p = this.sim.robot.translation();
    return FIELD.half - (p.x * this.wallDir.x + p.z * this.wallDir.z);
  }

  /** GrabRoutine.steer: robot-centric powers (forward, strafe onto the line, turn onto its heading) as a world velocity. */
  private steer(forward: number, dt: number): Drive {
    const G = R.gardenGather, s = this.sim, p = s.robot.translation(), h = s.heading, to = this.inPose;
    // Left of the line along the in heading, inches (GrabRoutine.lateralIn), in Pedro terms: sim left is (-sin h, -cos h).
    const lateral = ((p.x - to.x) * -Math.sin(to.h) + (p.z - to.z) * -Math.cos(to.h)) / IN;
    const mc = G.maxCorrection.value, clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));
    let f = clamp(forward, 1);
    if (gatherUsesStick() && this.toWallAhead() <= R.gardenGather.stickStopIn.value * IN) f = Math.min(f, 0); // the stick on the wall
    const strafeLeft = clamp(-G.lateralKp.value * lateral, mc), turn = clamp(G.headingKp.value * wrap(to.h - h), mc);
    const fw = { x: Math.cos(h), z: -Math.sin(h) }, lf = { x: -Math.sin(h), z: -Math.cos(h) };
    const want = { vx: fw.x * f * this.envFwd + lf.x * strafeLeft * this.envSide, vz: fw.z * f * this.envFwd + lf.z * strafeLeft * this.envSide, w: turn * this.turnRate };
    const v = s.robot.linvel();
    return limitDrive(this.team, h, { vx: v.x, vz: v.z }, want, dt);
  }

  private go(ph: CornerGather['phase']) { this.phase = ph; this.phaseAt = this.t; this.best = Infinity; this.bestAt = this.t; }

  step(dt: number): RoutineStep {
    const s = this.sim, G = R.gardenGather, useStick = gatherUsesStick(); this.t += dt;
    let drive: Drive = this.m.stop();
    if (this.phase === 'refused') return { drive, stickDown: false, intake: false, phase: 'refused', done: true, note: `GARDEN gather refused: ${this.refusal}` };
    const p = s.robot.translation(), v = s.robot.linvel();
    const speedIn = Math.hypot(v.x, v.z) / IN, turnDeg = Math.abs((s.robot.angvel().y * 180) / Math.PI);
    const since = (t: number) => (this.t - t) * 1000;
    const progress = (d: number) => { if (d < this.best - G.stallProgressIn.value * IN) { this.best = d; this.bestAt = this.t; } };
    const stalled = () => since(this.phaseAt) > 2 * G.stallMs.value && since(this.bestAt) > G.stallMs.value;
    switch (this.phase) {
      case 'lineup': {
        const d = Math.hypot(this.lineUp.x - p.x, this.lineUp.z - p.z);
        const facing = Math.abs(wrap(this.lineUp.h - s.heading)) <= rad(G.lowerWithinDeg.value);
        if (Number.isNaN(this.stickAt) && d <= G.lowerWithinIn.value * IN && facing && turnDeg <= G.lowerMaxTurnDegPerSec.value) this.stickAt = this.t;
        drive = this.m.step(s, this.lineUp, 1, dt);
        progress(d);
        const atPose = d < 0.5 * IN && Math.abs(wrap(this.lineUp.h - s.heading)) <= rad(G.atLineUpDeg.value);
        // Pressed onto the wall short of the pose: a stall close to it ends the line-up where it stopped.
        const pressed = d <= G.stallWithinIn.value * IN && stalled() && Math.abs(wrap(this.lineUp.h - s.heading)) <= rad(G.atLineUpDeg.value);
        if (atPose || pressed) {
          this.home = { x: p.x, z: p.z, h: s.heading };
          this.inPose = this.planIn(this.home);
          if (Number.isNaN(this.stickAt) && turnDeg <= G.lowerMaxTurnDegPerSec.value) this.stickAt = this.t;
          this.go('prep');
        } else if (since(this.phaseAt) > G.lineUpTimeoutMs.value) {
          this.phase = 'done';
          return { drive: this.m.stop(), stickDown: false, intake: false, phase: 'done', done: true, note: 'GARDEN gather: line-up timed out' };
        }
        break;
      }
      case 'prep':
        if (Number.isNaN(this.stickAt) && (turnDeg <= G.lowerMaxTurnDegPerSec.value || since(this.phaseAt) >= G.settleMaxMs.value)) this.stickAt = this.t;
        // Stick up: no stick to wait for, only the settle.
        if (!Number.isNaN(this.stickAt) && (!useStick || since(this.stickAt) >= G.stickDownMs.value)
            && (speedIn < G.settledInPerSec.value || since(this.phaseAt) >= G.settleMaxMs.value)) this.go('in');
        break;
      case 'in': {
        const d = Math.hypot(this.inPose.x - p.x, this.inPose.z - p.z);
        progress(d);
        drive = this.m.step(s, this.inPose, G.inSpeed.value, dt);
        if (useStick && this.toWallAhead() <= G.stickStopIn.value * IN) drive = this.steer(0, dt); // the stick on the wall: no further
        if (d <= 0.5 * IN || stalled() || since(this.phaseAt) > G.inTimeoutMs.value) this.go('dwell');
        break;
      }
      case 'dwell':
        drive = this.steer(G.dwellPushPower.value, dt);
        if ((G.dwellEndsOnFull.value && s.carried.length >= s.cfg.capacity) || since(this.phaseAt) >= G.dwellMs.value) this.go('back');
        break;
      case 'back': {
        const d = Math.hypot(this.home.x - p.x, this.home.z - p.z);
        progress(d);
        drive = this.m.step(s, this.home, G.backSpeed.value, dt);
        if (d < 0.5 * IN || since(this.phaseAt) > G.backTimeoutMs.value || (since(this.phaseAt) > G.backStallMs.value && since(this.bestAt) > G.backStallMs.value)) {
          if (useStick) this.go('raise');
          else this.phase = 'done';
        }
        break;
      }
      case 'raise':
        if (since(this.phaseAt) >= G.raiseAfterStopMs.value) this.phase = 'done';
        break;
    }
    // Stick up: the stick stays stowed and the intake runs the whole gather; stick down: both from stickAt.
    const started = !Number.isNaN(this.stickAt) && this.phase !== 'done';
    return { drive, stickDown: useStick && started, intake: useStick ? started : this.phase !== 'done', phase: this.phase, done: this.phase === 'done', note: `GARDEN gather (${this.way!.name}): ${this.phase}` };
  }
}
