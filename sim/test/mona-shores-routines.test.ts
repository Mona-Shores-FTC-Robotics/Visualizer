import RAPIER from '@dimforge/rapier3d-compat';
import { beforeAll, describe, expect, it } from 'vitest';
import { FIELD } from '../src/sim/config';
import { MONA_SHORES, monaShoresConfig } from '../src/sim/robots/mona-shores';
import { FlowerPick, GardenGather } from '../src/sim/robots/routines';
import { DT, NO_INPUT, Sim } from '../src/sim/world';

// Mona Shores: our robot's GARDEN gather and FLOWER pick, master's routines, pieces taken by the intake physics.
beforeAll(async () => { await RAPIER.init(); });

function run(team: '19429' | '20245', make: (s: Sim) => { step(dt: number): { drive: { vx: number; vz: number; w: number }; stickDown: boolean; intake: boolean; done: boolean; phase: string } }, place: (s: Sim) => void, seed = 1) {
  const s = new Sim(RAPIER, monaShoresConfig(team), 'practice', seed, { flowerPullByPush: false });
  place(s); s.carried.length = 0;
  const r = make(s), me = s.robots[0]; let t = 0, phases: string[] = [];
  for (; t < 15; t += DT) {
    const st = r.step(DT); me.velDrive = st.drive; me.stickDown = st.stickDown;
    if (phases[phases.length - 1]?.split('@')[0] !== st.phase) phases.push(`${st.phase}@${t.toFixed(2)}`);
    s.step({ ...NO_INPUT, intake: st.intake ? 'all' : 'none' });
    if (st.done) break;
  }
  return { t, got: s.carried.length, phases };
}
const at = (s: Sim, x: number, z: number, h: number) => { s.robot.setTranslation({ x, y: s.robot.translation().y, z }, true); s.robot.setRotation({ x: 0, y: Math.sin(h / 2), z: 0, w: Math.cos(h / 2) }, true); };

describe('our robot, master\'s grab routines', () => {
  // biobuzz #756 (mentor, 26 Nov 2026): the gather keeps the stick up and the corner wheels rake. The wheels are the
  // drill's (src/drill/cornerWheels.ts), so here, with the stick up, the robot takes only what its mouth meets.
  it('GARDEN gather, stick up (useStick off, the default): no stick wait or raise, the stick never down, the intake on throughout', () => {
    expect(MONA_SHORES.routines.gardenGather.useStick.value).toBe(false);
    const s = new Sim(RAPIER, monaShoresConfig('20245'), 'practice', 1, { flowerPullByPush: false });
    at(s, -1.0, 0.6, Math.PI / 2 * 3 - Math.PI); s.carried.length = 0;
    const r = new GardenGather(s, '20245'), me = s.robots[0], phases: string[] = [];
    let stickEver = false, intakeOff = false;
    for (let t = 0; t < 15; t += DT) {
      const st = r.step(DT); me.velDrive = st.drive; me.stickDown = st.stickDown;
      stickEver ||= st.stickDown; if (!st.done && !st.intake) intakeOff = true;
      if (phases[phases.length - 1] !== st.phase) phases.push(st.phase);
      s.step({ ...NO_INPUT, intake: st.intake ? 'all' : 'none' });
      if (st.done) break;
    }
    expect(phases).toEqual(['lineup', 'in', 'dwell', 'back', 'done']);
    expect(stickEver).toBe(false);
    expect(intakeOff).toBe(false);
  });
  it('GARDEN gather with the stick (useStick on, as before #756): lines up on the wall, drives in with the stick down, and the stick lifts three of the four POLLEN', () => {
    const G = MONA_SHORES.routines.gardenGather;
    G.useStick.value = true;
    try {
    const g = FIELD.garden.red;
    const pollenIn = (s: Sim) => [...s.balls.values()].filter(b => b.kind === 'pollen' && b.body.translation().x < g[1] + 0.1 && b.body.translation().z > g[2] - 0.15).length;
    const s0 = new Sim(RAPIER, monaShoresConfig('20245'), 'practice', 1); console.log('GARDEN POLLEN staged', pollenIn(s0));
    for (const team of ['20245', '19429'] as const) {
      const r = run(team, s => new GardenGather(s, team), s => at(s, -1.0, 0.6, Math.PI / 2 * 3 - Math.PI)); // ~1 m off, facing the audience
      console.log(team, 'GARDEN gather', r.got, 'in', r.t.toFixed(2), 's', r.phases.join(' '));
      expect(r.phases.at(-1)).toMatch(/^done/);
      expect(r.got).toBe(3);
    }
    } finally { G.useStick.value = false; }
  });
  it('FLOWER pick: stages square to the FLOWER 24 in back, pushes in, pulls POLLEN, backs out', () => {
    const f = FIELD.flowers.find(q => q.id === 'red')!;
    for (const team of ['20245', '19429'] as const) {
      const r = run(team, s => new FlowerPick(s, team), s => at(s, f.x + 1.0, f.z + 0.3, 0));
      console.log(team, 'FLOWER pick', r.got, 'in', r.t.toFixed(2), 's', r.phases.join(' '));
      expect(r.phases.map(p => p.split('@')[0])).toEqual(['lineup', 'stick', 'push', 'dwell', 'back', 'done']);
      expect(r.got).toBeGreaterThan(0);
    }
  });
});

describe('our intake mouth', () => {
  // Drives straight at 0.6 m/s, stick up, past one loose POLLEN `offIn` to the side of the robot's center line.
  const takes = (mouth: 'cad' | 'frame', offIn: number) => {
    const s = new Sim(RAPIER, monaShoresConfig('20245', { mouth }), 'practice', 1, { flowerPullByPush: false });
    at(s, -1.25, 0.35, 0);
    s.handoff({}, 1, { pieces: [{ kind: 'pollen', x: -0.75, y: 0, z: 0.35 - offIn * 0.0254 }] }); s.carried.length = 0;
    const me = s.robots[0];
    for (let t = 0; t < 2; t += DT) { me.velDrive = { vx: 0.6, vz: 0, w: 0 }; me.stickDown = false; s.step({ ...NO_INPUT, intake: 'all' }); }
    return s.carried.length;
  };
  it('takes a loose POLLEN through the real 9.7 in mouth by default, and through the old 14.58 in with mouth "frame"', () => {
    expect(MONA_SHORES.shared.intake.widthIn.value).toBe(9.7);
    expect(takes('cad', 4)).toBe(1); expect(takes('cad', 6)).toBe(0);
    expect(takes('frame', 4)).toBe(1); expect(takes('frame', 6)).toBe(1);
  });
});
