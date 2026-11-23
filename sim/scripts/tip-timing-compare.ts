// Mona Shores: plays four-robot full matches under each TIP timing (NCSSM's rocker alone, and UV/IR, our films) and
// prints, per alliance, the score, AUTO TIPs, all TIPs, pieces that landed in the raised CELL, and how many landed in a
// CELL already over its tipping weight (wasted while the HIVE waits). Run: npx tsx scripts/tip-timing-compare.ts [seeds]
import RAPIER from '@dimforge/rapier3d-compat';
import { Coach } from '../src/auto/coach';
import { TIP_LOAD } from '../src/sim/config';
import { DT, Sim } from '../src/sim/world';
await RAPIER.init();
const seeds = (process.argv[2] ?? '4,5,6').split(',').map(Number);
for (const seed of seeds) for (const timing of ['ncssm', 'uv-ir'] as const) {
  const sim = new Sim(RAPIER, undefined, 'full', seed, { opponent: true, partners: true, tipTiming: timing }); sim.start();
  const coaches = sim.robots.map(() => new Coach());
  const prev = { red: { n: sim.cellCount('red'), load: sim.cellLoad('red'), up: sim.hives.red.upCell }, blue: { n: sim.cellCount('blue'), load: sim.cellLoad('blue'), up: sim.hives.blue.upCell } };
  const over = { red: 0, blue: 0 }, landed = { red: 0, blue: 0 };
  while (sim.phase !== 'post') {
    sim.step(coaches.map((c, i) => c.update(sim.view(i), DT)), coaches.map(() => true));
    for (const a of ['red', 'blue'] as const) {
      const n = sim.cellCount(a), up = sim.hives[a].upCell;
      if (up === prev[a].up && n > prev[a].n) { landed[a] += n - prev[a].n; if (prev[a].load >= TIP_LOAD.threshold) over[a] += n - prev[a].n; }
      prev[a] = { n, load: sim.cellLoad(a), up };
    }
  }
  const r = sim.score('red'), b = sim.score('blue');
  console.log(JSON.stringify({ seed, timing, red: { total: r.total, autoTips: r.autoTips / 20, tips: (r.autoTips + r.teleopTips) / 20, landed: landed.red, overWeight: over.red }, blue: { total: b.total, autoTips: b.autoTips / 20, tips: (b.autoTips + b.teleopTips) / 20, landed: landed.blue, overWeight: over.blue } }));
}
