// Measures a TIP's spill against our films: when the spilled pieces first touch the tiles (seconds after the rocker
// starts to move, and inches from the wall the lowered CELL opens toward), and how far from that wall they are 3 s
// after the rocker starts. Fills red's raised CELL with POLLEN one at a time until it tips (at its tipping weight), or
// with `past` extra POLLEN at once. No robot moves.
// Run: npx tsx scripts/spill-fit.ts [trials=12] [ncssm|films]
// The films (biobuzz FieldSim, 3 Oct 2026, IMG_1957-1960, 120 fps): first touch about 42 in from the wall, 1.15-1.2 s
// after the rocker starts; most of the spill within 16 in of the wall 3 s after the TIP.
import RAPIER from '@dimforge/rapier3d-compat';
import { FIELD, HIVE } from '../src/sim/config';
import { DT, NO_INPUT, Sim } from '../src/sim/world';
import { SPILL_FILMS, spillModel } from '../src/sim/spill';

const [trialsArg = '12', modelArg] = process.argv.slice(2);
await RAPIER.init();
if (process.env.SPILL_EXIT) SPILL_FILMS.exitScale = Number(process.env.SPILL_EXIT);
if (process.env.SPILL_SCATTER) SPILL_FILMS.scatter = Number(process.env.SPILL_SCATTER);
const touch: number[] = [], touchIn: number[] = [], at3: number[] = [];
for (let trial = 0; trial < Number(trialsArg); trial++) {
  const sim = new Sim(RAPIER, undefined, 'full', 100 + trial, { spill: spillModel(modelArg) }); sim.start();
  const H = sim.hives.red, r = FIELD.pollenRadius; let u = 0.37 * (trial + 1);
  const rnd = () => (u = (u * 9301 + 49297) % 233280) / 233280;
  const add = (n: number) => { for (let i = 0; i < n; i++) { const w = H.raisedCellPoint((rnd() * 2 - 1) * (HIVE.cellHalfWidth - r - 0.01), HIVE.cellFloorY + r + 0.02 + 0.05 * rnd(), HIVE.cellBack + r + 0.01 + rnd() * (HIVE.cellMouth - HIVE.cellBack - 2 * r - 0.03)); sim.spawn('pollen', w.x, w.y, w.z); } };
  for (let i = 0; i < 1 / DT; i++) sim.step(NO_INPUT);
  let start = -1, next = sim.simTime; const up = new Set<unknown>(), first = new Map<unknown, number>();
  if (trial % 2) add(8);
  while (start < 0 && sim.simTime < 40) {
    if (trial % 2 === 0 && sim.simTime >= next && !H.held && HIVE.tiltLimit - Math.abs(H.phi) < 0.02) { add(1); next = sim.simTime + 0.6; }
    sim.step(NO_INPUT);
    if (!H.held && HIVE.tiltLimit - Math.abs(H.phi) > 0.02) { start = sim.simTime; for (const [id, b] of sim.balls) if (b.kind === 'pollen' && b.body.translation().y > 0.5) up.add(id); }
  }
  if (start < 0) continue;
  while (sim.simTime - start < 3) {
    sim.step(NO_INPUT);
    for (const id of up) { const b = sim.balls.get(id); if (!b || first.has(id)) continue; const p = b.body.translation();
      if (sim.simTime - start > 0.2 && p.y < b.radius + 0.012) { first.set(id, 1); touch.push(sim.simTime - start); touchIn.push((FIELD.half - Math.abs(p.z)) / 0.0254); } }
  }
  for (const id of up) { const b = sim.balls.get(id); if (b && b.body.translation().y < 0.2) at3.push((FIELD.half - Math.abs(b.body.translation().z)) / 0.0254); }
}
const q = (a: number[], f: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
console.log(`spill ${spillModel(modelArg)}: ${touch.length} pieces. first touch ${q(touch, 0.5).toFixed(2)} s after the rocker starts (p10 ${q(touch, 0.1).toFixed(2)}, p90 ${q(touch, 0.9).toFixed(2)}), ` +
  `${q(touchIn, 0.5).toFixed(0)} in from the wall (p10 ${q(touchIn, 0.1).toFixed(0)}, p90 ${q(touchIn, 0.9).toFixed(0)}); 3 s after: median ${q(at3, 0.5).toFixed(0)} in from the wall, ` +
  `${at3.filter(d => d <= 16).length} of ${at3.length} within 16 in`);
