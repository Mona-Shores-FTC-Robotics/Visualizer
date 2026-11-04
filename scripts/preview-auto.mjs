import { createServer } from "vite";
import { readFileSync } from "node:fs";
const [inPath, scen] = process.argv.slice(2);
const server = await createServer({ configFile: false, root: process.cwd(), logLevel: "error", appType: "custom",
  server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] } });
const L = (p) => server.ssrLoadModule(p);
try {
  const { projectFromJson, robotConfigOf } = await L("/src/io/index.ts");
  const { DEFAULT_SETTINGS } = await L("/src/config/index.ts");
  const { buildPathCatalog } = await L("/src/lib/auto/geometry.ts");
  const { simulateAuto } = await L("/src/lib/auto/simulate.ts");
  const loaded = projectFromJson(JSON.parse(readFileSync(inPath, "utf8")), robotConfigOf(DEFAULT_SETTINGS));
  const doc = loaded.doc; const settings = { ...DEFAULT_SETTINGS, ...doc.robot };
  const cat = buildPathCatalog(doc.startPoint, doc.lines, settings);
  const r = simulateAuto(doc.auto, cat, doc.startPoint, JSON.parse(scen || "{}"));
  for (const e of r.log) console.log(e.t.toFixed(2).padStart(6), e.kind.padEnd(8), e.text);
  console.log("guard:", JSON.stringify(r.guard));
} finally { await server.close(); }
