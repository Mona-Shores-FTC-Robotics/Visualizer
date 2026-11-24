import RAPIER from '@dimforge/rapier3d-compat';
import { beforeAll, describe, expect, it } from 'vitest';
import { FIELD } from '../src/sim/config';
import { monaShoresConfig } from '../src/sim/robots/mona-shores';
import { DT, NO_INPUT, PINCH_TOL_M, Sim } from '../src/sim/world';

// The drill bug (mentor, 24 Nov 2026): pressing into a POLLEN pinned in a corner or on a wall sometimes popped it out
// at the robot's back. A pinned piece must end in the lane or outside the frame, never through it.
beforeAll(async () => { await RAPIER.init(); });

/** Drives nose-in at `speed` m/s for 2.5 s into a POLLEN pinned on the blue wall; the deepest it got into the frame, and where it ended. */
function pressInto(scene: 'corner' | 'wall', laneFull: boolean, drive: 'vel' | 'motor', speed = 1.6) {
  const s = new Sim(RAPIER, monaShoresConfig('20245'), 'practice', 1, { flowerPullByPush: false }), half = FIELD.half, r = FIELD.pollenRadius;
  const bz = scene === 'corner' ? -half + r + 0.001 : 0.3;
  s.handoff({}, 1, { pieces: [{ kind: 'pollen', x: half - r - 0.001, y: 0, z: bz }] });
  const ball = [...s.balls.values()].find(b => Math.abs(b.body.translation().x - (half - r)) < 0.01 && Math.abs(b.body.translation().z - bz) < 0.01)!;
  const c = s.cfg, me = s.robots[0];
  s.robot.setTranslation({ x: half - 0.7, y: s.robot.translation().y, z: scene === 'corner' ? -half + c.width / 2 + 0.002 : bz + 0.02 }, true);
  s.robot.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  s.carried.splice(0, s.carried.length, ...(laneFull ? ['pollen', 'pollen', 'pollen', 'pollen'] as const : []));
  let deepest = 0;
  for (let t = 0; t < 2.5; t += DT) {
    if (drive === 'vel') me.velDrive = { vx: speed, vz: 0, w: 0 };
    s.step({ ...NO_INPUT, forward: drive === 'vel' ? 0 : 1, intake: 'all' }, true);
    if (!s.balls.has(ball.id)) continue;
    const p = ball.body.translation(), q = s.toRobot(p.x, p.z);
    deepest = Math.max(deepest, Math.min(c.length / 2 + r - q.f, c.length / 2 + r + q.f, c.width / 2 + r - q.l, c.width / 2 + r + q.l));
  }
  const p = s.balls.has(ball.id) ? ball.body.translation() : null, q = p ? s.toRobot(p.x, p.z) : null;
  return { taken: !p, front: !!q && q.f > c.length / 2, deepest };
}

describe('a POLLEN pinned between our robot and a wall', () => {
  for (const scene of ['corner', 'wall'] as const) for (const drive of ['vel', 'motor'] as const) {
    it(`${scene}, ${drive} drive, lane full: stays at the frame's front, never through it`, () => {
      const r = pressInto(scene, true, drive);
      expect(r.taken).toBe(false); expect(r.front).toBe(true);
      expect(r.deepest).toBeLessThan(PINCH_TOL_M + 0.003); // a contact's depth, never inside the frame
    });
  }
  it('with room in the lane, the intake takes it on a wall; in a corner it sits beside the 9.7 in mouth and stays at the front', () => {
    expect(pressInto('wall', false, 'vel').taken).toBe(true);
    const corner = pressInto('corner', false, 'vel'); // 6.7 in off centre with the robot on the side wall
    expect(corner.taken).toBe(false); expect(corner.front).toBe(true);
  });
});
