import RAPIER from '@dimforge/rapier3d-compat';
import { beforeAll, describe, expect, it } from 'vitest';
import { DT, NO_INPUT, Sim } from '../src/sim/world';

// Mona Shores: the switches the driver drill uses, each off by default.
beforeAll(async () => { await RAPIER.init(); });
const run = (s: Sim, sec: number, inp = NO_INPUT) => { for (let i = 0; i < sec / DT; i++) s.step(inp); };
const atRot = (s: Sim, x: number, z: number, h: number) => {
  s.robot.setTranslation({ x, y: s.robot.translation().y, z }, true);
  s.robot.setRotation({ x: 0, y: Math.sin(h / 2), z: 0, w: Math.cos(h / 2) }, true);
};

describe('drill switches', () => {
  it('velDrive moves the robot at the set velocity and turn rate, in place of the motor model', () => {
    const s = new Sim(RAPIER, undefined, 'practice');
    atRot(s, -1.2, 1.2, 0);
    s.robots[0].velDrive = { vx: 0.8, vz: 0, w: 1 };
    const x0 = s.robot.translation().x;
    run(s, 0.5);
    expect(s.robot.translation().x - x0).toBeCloseTo(0.4, 1);
    expect(s.heading).toBeCloseTo(0.5, 1);
  });
  it('simNow counts the physics steps', () => {
    const s = new Sim(RAPIER, undefined, 'practice');
    run(s, 0.25);
    expect(s.simNow).toBeCloseTo(0.25, 2);
  });
  it('flowerPullByPush: false takes nothing from a FLOWER the robot pushes into; the default does', () => {
    const pushIntoRedFlower = (opts: { flowerPullByPush?: boolean | ((a: 'red' | 'blue', slot: 0 | 1) => boolean) }) => {
      const s = new Sim(RAPIER, undefined, 'practice', 1, opts);
      atRot(s, -1.35, 0.5942, Math.PI); // facing the red wall's FLOWER (-1.7282, 0.5942)
      s.carried.length = 0; // practice starts with a load
      run(s, 2, { ...NO_INPUT, forward: 0.4, intake: 'all' });
      return s.carried.length;
    };
    expect(pushIntoRedFlower({ flowerPullByPush: false })).toBe(0);
    expect(pushIntoRedFlower({})).toBeGreaterThan(0);
    // Per robot: off for red only (the drill's robots), on for the others (the planner's opponents).
    expect(pushIntoRedFlower({ flowerPullByPush: a => a !== 'red' })).toBe(0);
    expect(pushIntoRedFlower({ flowerPullByPush: a => a === 'red' })).toBeGreaterThan(0);
  });
});
