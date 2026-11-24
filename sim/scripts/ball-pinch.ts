// Presses our robot nose-in into a POLLEN pinned on the blue wall, in its rear corner and mid-wall, 24 trials (angles 0
// and +-20 degrees, offsets), and says where each ball ends: in the lane, at the frame's front, beside it, or BEHIND /
// INSIDE it (the drill bug, mentor 24 Nov 2026, which this must never print).
// Run: npx tsx scripts/ball-pinch.ts [cad|frame] [vel|motor] [full|room]
import RAPIER from '@dimforge/rapier3d-compat';
import { FIELD } from '../src/sim/config';
import { INTAKE_MOUTH, monaShoresConfig } from '../src/sim/robots/mona-shores';
import { DT, NO_INPUT, Sim } from '../src/sim/world';
await RAPIER.init();
const IN = 0.0254, half = FIELD.half, r = FIELD.pollenRadius;
const mouth = (process.argv[2] ?? 'cad') as 'cad' | 'frame'; INTAKE_MOUTH.model = mouth;
let behind = 0, under = 0, inside = 0, front = 0, side = 0, n = 0; const notes: string[] = [];
const drive = process.argv[3] ?? 'vel', laneFull = process.argv[4] !== 'room';
for (const scene of ['corner', 'wall'] as const) for (let k = 0; k < 12; k++) {
  const ang = [0, 0.35, -0.35][k % 3];
  const s = new Sim(RAPIER, monaShoresConfig('20245'), 'practice', 1 + k, { flowerPullByPush: false });
  // the ball pinned against the blue wall (x = +half), in the rear corner or mid-wall; the robot nose-in toward +x
  const bz = scene === 'corner' ? -half + r + 0.001 : 0.3 + 0.02 * k;
  const lat = (k % 6 - 2.5) * 0.02; // the ball 0..+-5 cm off the robot's centre line
  s.handoff({}, 1, { pieces: [{ kind: 'pollen', x: half - r - 0.001, y: 0, z: bz }] });
  const id = [...s.balls.values()].find(b => b.kind === 'pollen' && Math.abs(b.body.translation().x - (half - r)) < 0.01)!.id;
  const c = s.cfg, rz = scene === 'corner' ? -half + c.width / 2 + 0.002 : bz + lat;
  s.robot.setTranslation({ x: half - 0.7, y: s.robot.translation().y, z: rz }, true); s.robot.setRotation({ x: 0, y: Math.sin(ang / 2), z: 0, w: Math.cos(ang / 2) }, true);
  s.carried.splice(0, s.carried.length, ...(laneFull ? ['pollen', 'pollen', 'pollen', 'pollen'] as const : []));
  const me = s.robots[0], speed = 1.6;
  for (let t = 0; t < 2.5; t += DT) { if (drive === 'vel') me.velDrive = { vx: speed * Math.cos(ang), vz: -speed * Math.sin(ang), w: 0 }; me.stickDown = false; s.step({ ...NO_INPUT, forward: drive === 'vel' ? 0 : 1, intake: 'all' }, true); }
  if (drive === 'vel') me.velDrive = { vx: 0, vz: 0, w: 0 }; for (let t = 0; t < 0.5; t += DT) s.step(NO_INPUT);
  const b = s.balls.get(id); n++;
  if (!b) { notes.push(`${scene} ${k}: taken into the lane (${s.carried.length})`); continue; }
  const p = b.body.translation(), q = s.toRobot(p.x, p.z), L = c.length / 2 / IN, W = c.width / 2 / IN, f = q.f / IN, l = q.l / IN;
  const where = p.y < r - 0.005 ? 'under' : f < -L ? 'BEHIND' : Math.abs(f) <= L && Math.abs(l) <= W ? 'INSIDE' : f > L ? 'front' : 'side';
  if (where === 'BEHIND') behind++; else if (where === 'under') under++; else if (where === 'INSIDE') inside++; else if (where === 'front') front++; else side++;
  if (where !== 'front') notes.push(`${scene} ${k}: ${where} f ${f.toFixed(1)} l ${l.toFixed(1)} y ${(p.y / IN).toFixed(2)} in`);
}
console.log(`${mouth} ${drive} lane ${laneFull ? 'full' : 'room'}: ${n} trials: front ${front}, side ${side}, BEHIND ${behind}, INSIDE ${inside}, under ${under}`);
for (const x of notes) console.log('  ' + x);
