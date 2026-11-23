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

/**
 * Which TIP timing a match uses (mentor, 23 Nov 2026: neither is assumed right, so both stay selectable).
 * 'uv-ir': Mona Shores' films, the hold below. 'ncssm': upstream's rocker alone, no dwell.
 */
export type TipTiming = 'uv-ir' | 'ncssm';
export const TIP_TIMINGS: { value: TipTiming; label: string }[] = [
  { value: 'uv-ir', label: 'UV/IR TIP timing (our films)' },
  { value: 'ncssm', label: 'NCSSM TIP timing (rocker only)' },
];
/**
 * The default: 'ncssm', upstream's. UV/IR is the one measured on real fields (16 films and Fruitport M6), but
 * upstream's planner and AUTO trees assume a TIP with no wait: under UV/IR its shooting keeps firing into a CELL that
 * is already over its weight (9 launches where its test expects a TIP by 6) and its four-robot AUTO falls behind its
 * timeline. Until the planner waits for a TIP, matches it plays use upstream's timing; a drill or a request picks
 * 'uv-ir' (mentor's decision pending, 23 Nov 2026).
 */
export const DEFAULT_TIP_TIMING: TipTiming = 'ncssm';
/** Reads a timing from a request or a setting; anything else is the default. */
export function tipTiming(v: unknown): TipTiming { return v === 'ncssm' || v === 'uv-ir' ? v : DEFAULT_TIP_TIMING; }

export const TIP_LAG = {
  atWeightS: [3.4, 6.5] as [number, number],  // last ball to settled, at the tipping weight (films)
  atWeightSkew: 2.6,                          // low end + width * u^skew: median 3.9 s, a slow tail (biobuzz FieldSim)
  wellPastS: [2.2, 2.5] as [number, number],  // nine or more pieces (films)
  atWeightUpToPollen: 2.0, wellPastFromPollen: 2.5, // biobuzz FieldSim.AT_WEIGHT_UP_TO_POLLEN / WELL_PAST_FROM_POLLEN
  // The upstream rocker's own swing once the hold lets go, release to settled, by how far past its tipping weight
  // the CELL is (POLLEN weights): measured in this sim, 3 to 9 POLLEN dropped on the raised CELL's 3 NECTAR, the same on
  // every seed (scripts and test/tip-lag.test.ts). Released from the hold's spring it swings faster than from its stop.
  // Upstream's docs quote 1.7 / 1.2 s from the load crossing, a different start. The hold is the drawn lag minus this
  // swing and the flight.
  swingByPast: [[0.55, 1.90], [1.55, 1.35], [2.55, 1.13], [3.55, 1.01], [4.55, 0.94], [5.55, 0.895], [6.55, 0.85]] as [number, number][],
  // The films' lag starts when the last ball leaves the robot; the hold starts when the last piece lands in the CELL,
  // a launch's flight later. Measured by the drill's match test the same way (the drill chat, 23 Nov 2026: with the
  // swing above and no flight term, last ball out to settled ran 0.45 s short of the films at both loads).
  flightS: 0.45,
};

/** The rocker's swing, release to settled, for a CELL `past` POLLEN weights over its threshold (TIP_LAG.swingByPast). */
export function swingS(past: number): number {
  const rows = TIP_LAG.swingByPast;
  if (past <= rows[0][0]) return rows[0][1];
  for (let i = 1; i < rows.length; i++) if (past <= rows[i][0]) { const [x0, y0] = rows[i - 1], [x1, y1] = rows[i]; return y0 + ((past - x0) / (x1 - x0)) * (y1 - y0); }
  return rows[rows.length - 1][1];
}

/** Draws, per HIVE, how long its loaded CELL stays on its stop after the last piece lands. Its own random stream. */
export class TipLagHold {
  private rng: Rng; private count = 0; private releaseAt = Infinity; private released = false;
  constructor(seed: number, public timing: TipTiming = DEFAULT_TIP_TIMING) { this.rng = new Rng((seed ^ 0x71b1a6) >>> 0); }

  /** The lag for a CELL `past` POLLEN weights over its threshold, last piece to settled, seconds. */
  drawLag(past: number): number {
    const t = TIP_LAG, at = t.atWeightS[0] + (t.atWeightS[1] - t.atWeightS[0]) * Math.pow(this.rng.next(), t.atWeightSkew);
    const well = t.wellPastS[0] + (t.wellPastS[1] - t.wellPastS[0]) * this.rng.next();
    const f = Math.min(1, Math.max(0, (past - t.atWeightUpToPollen) / (t.wellPastFromPollen - t.atWeightUpToPollen)));
    return Math.max(0, at + f * (well - at) - swingS(past) - t.flightS);
  }

  /** Call once per step with the raised CELL's piece count and load; returns whether the HIVE is held this step. */
  update(now: number, count: number, load: number): boolean {
    if (this.timing === 'ncssm') return false;
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
