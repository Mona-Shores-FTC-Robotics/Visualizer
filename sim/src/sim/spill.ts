// Mona Shores: how a TIP's spill leaves the lowered CELL. 'ncssm' is upstream's rocker and ball physics alone. 'films'
// (the default) fits our films (see SPILL_FILMS). The films are few, so 'ncssm' stays one switch away, like the TIP timing.
export type SpillModel = 'films' | 'ncssm';
export const DEFAULT_SPILL: SpillModel = 'films';
export function spillModel(v: unknown): SpillModel { return v === 'ncssm' || v === 'films' ? v : DEFAULT_SPILL; }

/**
 * The 'films' spill. A piece that leaves the lowering CELL through its opening while the rocker swings down keeps
 * `exitScale` of its velocity, once, as biobuzz FieldSim's FILMED_SPILL_EXIT_SCALE (0.6) does, and its landing kicks it on. The films (3 Oct 2026,
 * IMG_1957-1960, 120 fps, the mentor's estimate, 4 Oct): pieces pour off the lip and first touch the tiles about 42 in
 * (36-43) from the wall the CELL opens toward, about 1.15-1.2 s after the rocker starts to move, and most lie within
 * 16 in of that wall 3 s after the TIP. Upstream's physics alone ('ncssm', scripts/spill-fit.ts, 128 pieces over 12
 * TIPs): first touch 1.20 s, 38 in (33-39), and 77 of 128 within 16 in at 3 s, so only the landing is short.
 */
export const SPILL_FILMS = {
  exitScale: 0.6,
  /**
   * On a spilled piece's first landing harder than `scatterMinMps`, `scatter` times the landing speed (times 0.5-1.5 at
   * random) is added along the tiles, within `scatterSpreadRad` of its throw, as FieldSim's FILMED_BOUNCE_SCATTER (0.1,
   * 60 degrees, 30 in/s): a holey ball off foam. The films: the spill fans out within half a second of landing and
   * rolls on at a steady ~23 in/s, the red TIP's NECTAR reaching the wall from ~42 in out within ~1.5 s (World Record
   * match video, 6 Oct 2026, doc/rolling.md in biobuzz).
   */
  scatter: 0.1, scatterSpreadRad: Math.PI / 3, scatterMinMps: 30 * 0.0254,
};
/** A swing down starts once the rocker turns faster than this, rad/s, away from its raised stop. */
export const SPILL_SWING_RAD_PER_S = 0.2;
/** How long after a swing starts a piece leaving the lowered CELL counts as spill, s: past the stop, as the CELL empties. */
export const SPILL_WATCH_S = 3;
