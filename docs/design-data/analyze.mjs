import { createServer } from "vite";
// Times and clears red-biobuzz-realistic.pp with the Visualizer's own estimator (simulateAuto, worstCase,
// calculateRobotState): every ✓/✗ outcome, plus clearance to the walls, the center line and the HIVE frame legs.
// Run from the repo root: node docs/design-data/analyze.mjs docs/design-data/red-biobuzz-realistic.pp
import { readFileSync } from "node:fs";
const server = await createServer({ configFile: false, root: process.cwd(), logLevel: "error", appType: "custom",
  server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] } });
const L = (p) => server.ssrLoadModule(p);
const { normalizeAuto } = await L("/src/lib/auto/normalize.ts");
const { normalizePaths, normalizeStartPose } = await L("/src/utils/normalize.ts");
const { settingsForFile } = await L("/src/utils/project.ts");
const { DEFAULT_SETTINGS } = await L("/src/config/index.ts");
const { buildPathCatalog } = await L("/src/lib/auto/geometry.ts");
const { simulateAuto, worstCase, commandSeconds, motionPoseAt } = await L("/src/lib/auto/simulate.ts");
const { validateAuto } = await L("/src/lib/auto/validate.ts");
const { calculateRobotState } = await L("/src/utils/animation.ts");
const { allCards, findCard } = await L("/src/lib/auto/tree.ts");
const data = JSON.parse(readFileSync(process.argv[2], "utf8"));
const { auto } = normalizeAuto(data.auto);
const start = normalizeStartPose(data.startPoint), lines = normalizePaths(data.lines);
const settings = settingsForFile(DEFAULT_SETTINGS, data.settings);
const catalog = buildPathCatalog(start, lines, settings);
const out = { issues: validateAuto(auto, catalog, start).map((i) => `${i.level}: ${i.message}`), settings: {
  rWidth: settings.rWidth, rHeight: settings.rHeight, maxVelocity: settings.maxVelocity, maxAcceleration: settings.maxAcceleration,
  maxDeceleration: settings.maxDeceleration, aVelocity: settings.aVelocity, xVelocity: settings.xVelocity, yVelocity: settings.yVelocity, kFriction: settings.kFriction } };
out.paths = catalog.paths.map((p) => ({ id: p.id, name: p.name, length: +p.length.toFixed(1), seconds: +p.seconds.toFixed(2) }));
// The retry wait gets its own name so "✗ at the first wait, ✓ at the retry" can be previewed.
const retryAuto = JSON.parse(JSON.stringify(auto));
for (const c of allCards(retryAuto.cards)) if (c.kind === "firstOf" && c.label === "Did it tip this time?")
  c.rows.forEach((r) => { if (r.when) r.when = r.when.map((n) => n === "HiveLeftGarden" ? "HiveLeftGarden@retry" : n); });
retryAuto.registry.conditions.push("HiveLeftGarden@retry");
const id = (x) => (x ? (x) : null);
const W = settings.rWidth / 2, H = settings.rHeight / 2;
const legs = [[46.6, 49.4, 51.2, 90.3], [92.6, 95.0, 51.2, 90.3]];
function clearance(res) {
  let wall = 1e9, centre = 1e9, leg = 1e9, where = {};
  const identity = (v) => v; identity.invert = (v) => v;
  for (let t = 0; t <= res.endTime; t += 0.02) {
    const pct = (t / res.endTime) * 100;
    const m = motionPoseAt(res, t);
    const s = m ? { x: m.x, y: m.y, heading: -m.headingDeg } : calculateRobotState(pct, res.timeline, lines, start, settings, identity, identity);
    const h = (-s.heading * Math.PI) / 180, c = Math.cos(h), sn = Math.sin(h);
    for (const [u, v] of [[W, H], [W, -H], [-W, H], [-W, -H], [W, 0], [-W, 0], [0, H], [0, -H]]) {
      const px = s.x + u * c - v * sn, py = s.y + u * sn + v * c;
      const w = Math.min(px, py, 141.5 - px, 141.5 - py); if (w < wall) { wall = w; where.wall = [t.toFixed(2), s.x.toFixed(1), s.y.toFixed(1)]; }
      if (70.75 - px < centre) { centre = 70.75 - px; where.centre = [t.toFixed(2), s.x.toFixed(1), s.y.toFixed(1)]; }
      for (const [x0, x1, y0, y1] of legs) { const dx = Math.max(x0 - px, px - x1, 0), dy = Math.max(y0 - py, py - y1, 0);
        const d = dx || dy ? Math.hypot(dx, dy) : -1; if (d < leg) { leg = d; where.leg = [t.toFixed(2), s.x.toFixed(1), s.y.toFixed(1)]; } }
    }
  }
  return { wall: +wall.toFixed(1), centre: +centre.toFixed(1), leg: +leg.toFixed(1), where };
}
function run(a, scenario) {
  const res = simulateAuto(a, catalog, start, scenario);
  return { res, end: +res.endTime.toFixed(2), guard: res.guard, stalled: res.stalled,
    log: res.log.map((e) => ({ t: +e.t.toFixed(2), kind: e.kind, text: e.text, cardId: e.cardId })) };
}
const B = [true, false];
out.runs = [];
for (const g of B) for (const l of B) for (const f of B) {
  const r = run(auto, { HiveLeftGarden: g, HiveLeftLoading: l, IntakeFull: f });
  out.runs.push({ name: `HLG ${g ? "✓" : "✗"} · HLL ${l ? "✓" : "✗"} · IF ${f ? "✓" : "✗"}`, end: r.end, guard: r.guard, clearance: clearance(r.res), log: r.log });
}
for (const l of B) for (const f of B) {
  const r = run(retryAuto, { HiveLeftGarden: false, "HiveLeftGarden@retry": true, HiveLeftLoading: l, IntakeFull: f });
  out.runs.push({ name: `HLG ✗ then ✓ at retry · HLL ${l ? "✓" : "✗"} · IF ${f ? "✓" : "✗"}`, end: r.end, guard: r.guard, clearance: clearance(r.res), log: r.log });
}
out.worst = worstCase(auto, catalog).total;
out.commands = allCards(auto.cards).filter((c) => c.kind === "action").map((c) => ({ id: c.id, name: c.name, preview: commandSeconds(auto, c), timeout: c.timeoutS ?? 5 }));
console.log(JSON.stringify(out, null, 1));
await server.close();
