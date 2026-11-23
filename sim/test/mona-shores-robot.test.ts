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
