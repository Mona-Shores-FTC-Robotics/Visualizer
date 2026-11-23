import RAPIER from '@dimforge/rapier3d-compat';
import { beforeAll, describe, expect, it } from 'vitest';
import { FIELD } from '../src/sim/config';
import { monaShoresConfig } from '../src/sim/robots/mona-shores';
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
  it('GARDEN gather: lines up on the wall, drives in with the stick down, and the stick lifts three of the four POLLEN', () => {
    const g = FIELD.garden.red;
    const pollenIn = (s: Sim) => [...s.balls.values()].filter(b => b.kind === 'pollen' && b.body.translation().x < g[1] + 0.1 && b.body.translation().z > g[2] - 0.15).length;
    const s0 = new Sim(RAPIER, monaShoresConfig('20245'), 'practice', 1); console.log('GARDEN POLLEN staged', pollenIn(s0));
    for (const team of ['20245', '19429'] as const) {
      const r = run(team, s => new GardenGather(s, team), s => at(s, -1.0, 0.6, Math.PI / 2 * 3 - Math.PI)); // ~1 m off, facing the audience
      console.log(team, 'GARDEN gather', r.got, 'in', r.t.toFixed(2), 's', r.phases.join(' '));
      expect(r.phases.at(-1)).toMatch(/^done/);
      expect(r.got).toBe(3);
    }
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
