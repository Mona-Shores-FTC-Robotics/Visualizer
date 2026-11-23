import RAPIER from '@dimforge/rapier3d-compat';
import { beforeAll, describe, expect, it } from 'vitest';
import { HIVE } from '../src/sim/config';
import { DT, NO_INPUT, Sim } from '../src/sim/world';

describe('Full Match hand-off (Sim.handoff, Hive.setState)', () => {
  beforeAll(async () => { await RAPIER.init(); });
  it('puts each HIVE on the trace end state, counts its TIPs as AUTO TIPs, and stays put', () => {
    const sim = new Sim(RAPIER, undefined, 'teleop', 3, { opponent: true, partners: true });
    const upAtStart = sim.hives.red.upCell, other = upAtStart === 'rear' ? 'audience' : 'rear';
    sim.handoff({ red: { up: other, tips: 2 }, blue: { up: sim.hives.blue.upCell, tips: 1 } });
    sim.start();
    for (let i = 0; i < 2 / DT; i++) sim.step(NO_INPUT);
    expect(sim.hives.red.upCell).toBe(other);
    expect(HIVE.tiltLimit - Math.abs(sim.hives.red.phi)).toBeLessThan(0.03);
    expect(sim.hives.red.tips).toBe(2); expect(sim.hives.blue.tips).toBe(1);
    expect(sim.score('red').autoTips).toBe(40); expect(sim.score('red').teleopTips).toBe(0);
  });
  it('seeds POLLEN in the raised CELL', () => {
    const sim = new Sim(RAPIER, undefined, 'teleop', 3);
    const before = sim.cellCount('red');
    sim.handoff({ red: { up: sim.hives.red.upCell, tips: 0, cellPollen: 3 } });
    expect(sim.cellCount('red')).toBe(before + 3);
  });
});
