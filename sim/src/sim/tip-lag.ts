// Mona Shores override: the TIP lag. The upstream HIVE swings as soon as the contact torque beats the holding moment,
// so a TIP settles 1.2 s (well past its tipping weight) to 1.7 s (at it) after the load crosses (docs/top-ten.md,
// lesson 6). Real fields sit still first. Measured, last ball leaves to CELL settled (biobuzz
// TeamCode/autos/timing-terms.md, 13 + 3 films, Belding and Fruitport, checked against Fruitport M6 at 3.98 s):
//   at the tipping weight (up to 2 POLLEN past it): 3.4 to 6.5 s, median 3.9;
//   well past it (2.5 POLLEN or more past):          2.2 to 2.5 s.
// So a HIVE whose raised CELL is over its threshold is held on its stop until the last piece in plus the drawn lag
// minus the upstream swing, then released to swing on its own physics. A new piece landing restarts the wait (a CELL
// at its weight that sat 7 s went 2.4 s after a partner added three more: Belding M-3).
import { TIP_LOAD } from './config';
import { Rng } from './rng';

export const TIP_LAG = {
  atWeightS: [3.4, 6.5] as [number, number],  // last ball to settled, at the tipping weight (films)
  atWeightSkew: 2.6,                          // low end + width * u^skew: median 3.9 s, a slow tail (biobuzz FieldSim)
  wellPastS: [2.2, 2.5] as [number, number],  // nine or more pieces (films)
  atWeightUpToPollen: 2.0, wellPastFromPollen: 2.5, // biobuzz FieldSim.AT_WEIGHT_UP_TO_POLLEN / WELL_PAST_FROM_POLLEN
  // The upstream rocker's own swing, threshold to settled (docs/top-ten.md lesson 6). REFIT with test/tip-lag.test.ts
  // once it runs here: the hold is the drawn lag minus this, so an error here shifts every TIP by the same amount.
  upstreamSwingAtWeightS: 1.7, upstreamSwingWellPastS: 1.2,
  enabled: true,
};

/** Draws, per HIVE, how long its loaded CELL stays on its stop after the last piece lands. Its own random stream. */
export class TipLagHold {
  private rng: Rng; private count = 0; private releaseAt = Infinity; private released = false;
  constructor(seed: number) { this.rng = new Rng((seed ^ 0x71b1a6) >>> 0); }

  /** The lag for a CELL `past` POLLEN weights over its threshold, last piece to settled, seconds. */
  drawLag(past: number): number {
    const t = TIP_LAG, at = t.atWeightS[0] + (t.atWeightS[1] - t.atWeightS[0]) * Math.pow(this.rng.next(), t.atWeightSkew);
    const well = t.wellPastS[0] + (t.wellPastS[1] - t.wellPastS[0]) * this.rng.next();
    const f = Math.min(1, Math.max(0, (past - t.atWeightUpToPollen) / (t.wellPastFromPollen - t.atWeightUpToPollen)));
    const swing = t.upstreamSwingAtWeightS + f * (t.upstreamSwingWellPastS - t.upstreamSwingAtWeightS);
    return Math.max(0, at + f * (well - at) - swing);
  }

  /** Call once per step with the raised CELL's piece count and load; returns whether the HIVE is held this step. */
  update(now: number, count: number, load: number): boolean {
    if (!TIP_LAG.enabled) return false;
    if (count > this.count) { // a piece landed: the wait starts again from it
      const past = load - TIP_LOAD.threshold;
      this.releaseAt = past > 0 ? now + this.drawLag(past) : Infinity; this.released = false;
    }
    if (count < this.count && count === 0) { this.releaseAt = Infinity; this.released = false; } // tipped and emptied
    this.count = count;
    if (now >= this.releaseAt) this.released = true;
    return !this.released && this.releaseAt !== Infinity;
  }
}
