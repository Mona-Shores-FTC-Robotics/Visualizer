import { describe, expect, it } from 'vitest';
import { IN } from '../src/sim/config';
import { MONA_SHORES, monaShoresConfig } from '../src/sim/robots/mona-shores';

describe('Mona Shores robot file', () => {
  it('every stated number has a source', () => {
    const walk = (o: unknown, path: string): void => {
      if (!o || typeof o !== 'object' || Array.isArray(o)) return;
      const rec = o as Record<string, unknown>;
      if ('value' in rec || 'rangeIn' in rec) expect(typeof rec.source, `${path}.source`).toBe('string');
      else for (const [k, v] of Object.entries(rec)) walk(v, `${path}.${k}`);
    };
    walk(MONA_SHORES.shared, 'shared'); walk(MONA_SHORES.robots, 'robots');
  });
  it('maps onto upstream RobotConfig for both robots', () => {
    for (const team of ['19429', '20245'] as const) {
      const c = monaShoresConfig(team);
      expect(c.length).toBeCloseTo(16.2 * IN, 6);
      expect(c.capacity).toBe(4);
      expect(c.shooter.type).toBe('fifo');
      expect(c.shooter.cycleSec).toBe(0.45);
      expect(c.shooter.turret).toBe(true);
      expect(c.shooter.turretRangeDeg).toBe(180);
    }
  });
});

import { driveEnvelope, limitDrive } from '../src/sim/robots/mona-shores';
describe('drive envelope (TeleOp logs, robot axes)', () => {
  it('strafes slower than it drives forward, and diagonal is no faster than strafe', () => {
    for (const team of ['19429', '20245'] as const) {
      const f = driveEnvelope(team, 0), s = driveEnvelope(team, Math.PI / 2), d = driveEnvelope(team, Math.PI / 4), b = driveEnvelope(team, Math.PI);
      expect(s.top / f.top).toBeGreaterThan(0.6); expect(s.top / f.top).toBeLessThan(0.7);
      expect(d.top).toBeLessThan(f.top); expect(b.top).toBeCloseTo(f.top, 6);
      expect(s.accel).toBeLessThan(f.accel);
    }
  });
  it('limitDrive caps a full-speed strafe at the strafe top speed, in robot axes', () => {
    // heading 0: forward is +X, left is -Z. A wanted 3 m/s to the left from already moving left at 1 m/s.
    let v = { vx: 0, vz: -1 };
    for (let i = 0; i < 400; i++) { const o = limitDrive('20245', 0, v, { vx: 0, vz: -3, w: 0 }, 1 / 240); v = { vx: o.vx, vz: o.vz }; }
    expect(Math.hypot(v.vx, v.vz)).toBeCloseTo(driveEnvelope('20245', Math.PI / 2).top, 3);
  });
});
