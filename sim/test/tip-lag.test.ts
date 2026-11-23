import { describe, expect, it } from 'vitest';
import { TIP_LOAD } from '../src/sim/config';
import { DEFAULT_TIP_TIMING, TIP_LAG, TipLagHold, tipTiming } from '../src/sim/tip-lag';

const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

describe('TIP lag (Mona Shores override, biobuzz TeamCode/autos/timing-terms.md)', () => {
  it('at the tipping weight: hold + upstream swing lands on the films, 3.4 to 6.5 s, median 3.9', () => {
    const h = new TipLagHold(7), lags = Array.from({ length: 4000 }, () => h.drawLag(1) + TIP_LAG.upstreamSwingAtWeightS);
    expect(Math.min(...lags)).toBeGreaterThanOrEqual(3.4 - 1e-9);
    expect(Math.max(...lags)).toBeLessThanOrEqual(6.5 + 1e-9);
    expect(median(lags)).toBeGreaterThan(3.7); expect(median(lags)).toBeLessThan(4.1);
  });
  it('well past it: 2.2 to 2.5 s', () => {
    const h = new TipLagHold(7), lags = Array.from({ length: 1000 }, () => h.drawLag(3) + TIP_LAG.upstreamSwingWellPastS);
    expect(Math.min(...lags)).toBeGreaterThanOrEqual(2.2 - 1e-9);
    expect(Math.max(...lags)).toBeLessThanOrEqual(2.5 + 1e-9);
  });
  it('holds only over the threshold, from the last piece, and lets go once', () => {
    const h = new TipLagHold(1);
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
  it('reads a timing from a request; anything else is the default (UV/IR)', () => {
    expect(DEFAULT_TIP_TIMING).toBe('uv-ir');
    expect(tipTiming('ncssm')).toBe('ncssm'); expect(tipTiming(undefined)).toBe('uv-ir'); expect(tipTiming('x')).toBe('uv-ir');
  });
});
