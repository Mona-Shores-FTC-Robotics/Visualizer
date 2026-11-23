// Calibrates the opponent skill dial (src/setup.ts opponentSetup): the drill's two planner opponents (blue) against a
// red alliance that doesn't move (the drill's human and dead partner, at their starts), under the given TIP timing.
// Prints the blue alliance's TIPs per match (AUTO and TELEOP) for each seed.
// Run: npx tsx scripts/opponent-skill.ts SKILL [seeds=1-8] [TIP_TIMING=uv-ir]
import RAPIER from '@dimforge/rapier3d-compat';
import { tipTiming } from '../src/sim/tip-lag';
import { Coach } from '../src/auto/coach';
import { DT, NO_INPUT, Sim } from '../src/sim/world';
import { defaultBot, opponentSetup, robotConfig, sanitize } from '../src/setup';

const [skillArg = '1', seedsArg = '1-8'] = process.argv.slice(2);
const [a, b = a] = seedsArg.split('-').map(Number), skill = Number(skillArg);
await RAPIER.init();
const bots = [0, 1, 2, 3].map(i => sanitize({ ...defaultBot(i), ...(i >= 2 ? opponentSetup(skill) : {}) }, i));
const tips: number[] = [];
for (let seed = a; seed <= b; seed++) {
  const sim = new Sim(RAPIER, undefined, 'full', seed, { opponent: true, partners: true, tipTiming: tipTiming(process.env.TIP_TIMING), configFor: (al, slot) => robotConfig(bots[(al === 'red' ? 0 : 2) + slot]) }); sim.start();
  const coaches = sim.robots.map(() => { const c = new Coach(); c.autoRoutine = 'default'; return c; });
  while (sim.phase !== 'post') sim.step(coaches.map((c, k) => sim.robots[k].alliance === 'blue' ? c.update(sim.view(k), DT) : NO_INPUT), sim.robots.map(r => r.alliance === 'blue'));
  for (let i = 0; i < 3 / DT; i++) sim.step(NO_INPUT);
  tips.push(sim.hives.blue.tips);
  console.log(`skill ${skill} seed ${seed}: blue TIPs ${sim.hives.blue.tips}, score ${sim.score('blue').total}`);
}
console.log(`skill ${skill}: mean TIPs ${(tips.reduce((s, x) => s + x, 0) / tips.length).toFixed(2)} over ${tips.length} seeds [${tips.join(' ')}]`);
