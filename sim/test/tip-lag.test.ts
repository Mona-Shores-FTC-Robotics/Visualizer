import { describe, expect, it } from 'vitest';
import { TIP_LOAD } from '../src/sim/config';
import { DEFAULT_TIP_TIMING, TIP_LAG, TipLagHold, tipTiming } from '../src/sim/tip-lag';

const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

describe('TIP lag (Mona Shores override, biobuzz TeamCode/autos/timing-terms.md)', () => {
  it('at the tipping weight: hold + upstream swing + flight lands on the films, 3.4 to 6.5 s, median 3.9', () => {
    const h = new TipLagHold(7), lags = Array.from({ length: 4000 }, () => h.drawLag(1) + TIP_LAG.upstreamSwingAtWeightS + TIP_LAG.flightS);
    expect(Math.min(...lags)).toBeGreaterThanOrEqual(3.4 - 1e-9);
    expect(Math.max(...lags)).toBeLessThanOrEqual(6.5 + 1e-9);
    expect(median(lags)).toBeGreaterThan(3.7); expect(median(lags)).toBeLessThan(4.1);
  });
  it('well past it: 2.2 to 2.5 s', () => {
    const h = new TipLagHold(7), lags = Array.from({ length: 1000 }, () => h.drawLag(3) + TIP_LAG.upstreamSwingWellPastS + TIP_LAG.flightS);
    expect(Math.min(...lags)).toBeGreaterThanOrEqual(2.2 - 1e-9);
    expect(Math.max(...lags)).toBeLessThanOrEqual(2.5 + 1e-9);
  });
  it('holds only over the threshold, from the last piece, and lets go once', () => {
    const h = new TipLagHold(1, 'uv-ir');
    expect(h.update(0, 3, TIP_LOAD.threshold - 1)).toBe(false);            // under the threshold: nothing to hold
    expect(h.update(1, 4, TIP_LOAD.threshold + 1)).toBe(true);             // over it: held
    expect(h.update(1.5, 5, TIP_LOAD.threshold + 2)).toBe(true);           // another piece: the wait restarts
    expect(h.update(1.5 + 10, 5, TIP_LOAD.threshold + 2)).toBe(false);     // released
    expect(h.update(1.5 + 10.1, 5, TIP_LOAD.threshold + 2)).toBe(false);   // and stays released
  });
  it("NCSSM timing never holds: upstream's rocker alone", () => {
    const h = new TipLagHold(1, 'ncssm');
    expect(h.update(1, 4, TIP_LOAD.threshold + 1)).toBe(false);
  });
  it('reads a timing from a request; anything else is the default (NCSSM, until upstream\'s planner waits for a TIP)', () => {
    expect(DEFAULT_TIP_TIMING).toBe('ncssm');
    expect(tipTiming('uv-ir')).toBe('uv-ir'); expect(tipTiming(undefined)).toBe('ncssm'); expect(tipTiming('x')).toBe('ncssm');
  });
});

// A whole match step by step, not the class alone: the hold must reach the HIVE in Sim.step() (it once ran only in
// the pre-match settle, so UV/IR played exactly like NCSSM).
import RAPIER from '@dimforge/rapier3d-compat';
import { beforeAll } from 'vitest';
import { DT, NO_INPUT, Sim } from '../src/sim/world';

describe('TIP timing in a match', () => {
  beforeAll(async () => { await RAPIER.init(); });
  /** Seconds from dropping 3 POLLEN on the raised red CELL's 3 NECTAR (its tipping weight) to the TIP settling. */
  const tipAfter = (timing: 'uv-ir' | 'ncssm', seed: number) => {
    const s = new Sim(RAPIER, undefined, 'practice', seed, { tipTiming: timing });
    const hive = s.hives.red, t0 = s.time;
    for (const along of [0.3, 0.38, 0.46]) { const w = hive.raisedCellPoint(0, 0.02, along); s.spawn('pollen', w.x, w.y, w.z); }
    for (let i = 0; i < 12 / DT && hive.tips === 0; i++) s.step(NO_INPUT);
    return hive.tips ? s.time - t0 : Infinity;
  };
  it('UV/IR holds the TIP back; NCSSM does not', () => {
    for (const seed of [1, 2, 3]) {
      const uvir = tipAfter('uv-ir', seed), ncssm = tipAfter('ncssm', seed);
      expect(ncssm, `seed ${seed}: NCSSM tips`).toBeLessThan(3);
      expect(uvir - ncssm, `seed ${seed}: UV/IR ${uvir.toFixed(2)} s vs NCSSM ${ncssm.toFixed(2)} s`).toBeGreaterThan(1);
      expect(uvir, `seed ${seed}`).toBeLessThan(7.5);
    }
  });
});
