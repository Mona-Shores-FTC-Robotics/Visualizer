// One-off (session): rebuild r-solo.pp and r-partner-preload.pp with the builder's own functions.
import { createServer } from "vite";
import { readFileSync, writeFileSync } from "node:fs";
const [which, inPath, outPp, outDir] = process.argv.slice(2);
const server = await createServer({ configFile: false, root: process.cwd(), logLevel: "error", appType: "custom",
  server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] } });
const L = (p) => server.ssrLoadModule(p);
try {
  const { projectFromJson, robotConfigOf, serializeProject } = await L("/src/io/index.ts").then(async (m) => ({ ...m, ...(await L("/src/io/project.ts")) }));
  const { DEFAULT_SETTINGS } = await L("/src/config/index.ts");
  const S = await L("/src/lib/simple/steps.ts");
  const { withSpotParks } = await L("/src/lib/simple/parkFrom.ts");
  const { buildPathCatalog } = await L("/src/lib/auto/geometry.ts");
  const { settleDoc } = await L("/src/lib/auto/settle.ts");
  const { pinState } = await L("/src/lib/auto/pins.ts");
  const { stepCollisions } = await L("/src/lib/simple/collide.ts");
  const { generateAutoJava } = await L("/src/lib/codegen/auto/javaAuto.ts");

  const data = JSON.parse(readFileSync(inPath, "utf8"));
  const loaded = projectFromJson(data, robotConfigOf(DEFAULT_SETTINGS));
  if (!loaded.ok) throw new Error(loaded.error);
  const settings = { ...DEFAULT_SETTINGS, ...loaded.doc.robot };
  let doc = settleDoc(loaded.doc, settings, null).doc;
  // Link the team spots these routes use (as picking one from the dropdown does).
  const team = JSON.parse(readFileSync(new URL("../../biobuzz/TeamCode/autos/spots.json", import.meta.url), "utf8")).spots;
  for (const name of ["RIGHT_LAUNCH_OFFSET", "LEFT_LAUNCH_OFFSET", "SCORING_FLOWER_STAGING", "RIGHT_PARK"]) {
    doc.auto.points[name] = team[name];
    if (!doc.auto.teamSpots.includes(name)) doc.auto.teamSpots = [...doc.auto.teamSpots, name].sort();
  }
  const steps = () => S.stepsOf(doc);
  const show = (tag) => console.log(tag, JSON.stringify(steps().map((s) => s.label + (s.otherwise ? " {else: " + s.otherwise.map((o) => o.label).join(", ") + "}" : ""))));
  show("before");
  const add = (kind, index, spot, into = null) => { const r = S.addStep(doc, kind, index, spot, into); doc = r.doc; return r.cardId; };
  const removeFrom = (i) => { while (steps().length > i) doc = S.removeStep(doc, steps()[i].cardId); };
  const PICK_S = 4.5;

  let waitId;
  if (which === "solo") {
    // SpinUp, LaunchAll, ->WFS, Pick, ->LLO | check | LaunchAll, ->SFS, Pick, ->LLO, LaunchAll, Park
    removeFrom(5);
    waitId = add("wait", 5);
    add("launch", 6); add("drive", 7, "SCORING_FLOWER_STAGING"); add("pick", 8); add("drive", 9, "LEFT_LAUNCH_OFFSET");
    add("launch", 10); add("park", 11, "RIGHT_PARK");
  } else {
    // SpinUp, LaunchAll, ->WFS, Pick, [clock 12 s], ->LLO | check | LaunchAll, ->SFS, Pick, Park
    removeFrom(5);
    waitId = add("wait", 5);
    add("launch", 6); add("drive", 7, "SCORING_FLOWER_STAGING"); add("pick", 8); add("park", 9, "RIGHT_PARK");
  }
  const into = { waitCardId: waitId };
  const rightId = add("drive", 0, "RIGHT_LAUNCH_OFFSET", into);
  add("launch", 1, undefined, into);
  doc = S.setWaitRejoin(doc, waitId, false);
  doc = S.setWait(doc, waitId, { waitFor: "CellUp" });
  show("after");

  // Settle and give each spot its park, as Save team spots does.
  let pinned = pinState(doc.auto);
  for (let i = 0; i < 6; i++) {
    const settled = settleDoc(doc, settings, pinned);
    pinned = settled.pinned;
    const catalog = buildPathCatalog(settled.doc.startPoint, settled.doc.lines, settings);
    const next = withSpotParks(settled.doc, catalog);
    if (next === settled.doc) { doc = settled.doc; break; }
    doc = next;
  }
  // Raw edits the builder has no step for: the check's 0.75 s, the picks' limit, the bend west of the HIVE.
  const all = [];
  const walk = (cards) => { for (const c of cards) { all.push(c); if (c.kind === "firstOf") for (const r of c.rows) walk(r.cards); } };
  walk(doc.auto.cards);
  const wait = all.find((c) => c.id === waitId);
  for (const r of wait.rows) if ("afterMs" in r) r.afterMs = 750;
  for (const c of all) if (c.kind === "action" && c.name === "PickFlower") c.timeoutS = PICK_S;
  const rightCard = all.find((c) => c.id === rightId);
  const bend = JSON.parse(process.env.BEND || "[[36,100],[32,40]]");
  doc.lines = doc.lines.map((l) => l.id === rightCard.lineId ? { ...l, controlPoints: bend.map(([x, y]) => ({ x, y })) } : l);
  // Parks from the left launch spot bend south first, clear of a partner parked on LEFT_PARK.
  const parkBend = JSON.parse(process.env.PARKBEND || "[[40,96]]");
  const mainPark = doc.auto.cards.length && (() => { const v = S.stepsOf(doc); const i = v.findIndex((s) => s.kind === "park"); const prev = v.slice(0, i).reverse().find((x) => x.spot); return i > 0 && prev && ["LEFT_LAUNCH_OFFSET", "SCORING_FLOWER_STAGING"].includes(prev.spot) ? v[i].lineId : null; })();
  doc.lines = doc.lines.map((l) => (l.name === "LEFT_LAUNCH_OFFSET park" || l.name === "SCORING_FLOWER_STAGING park" || l.id === mainPark) ? { ...l, controlPoints: parkBend.map(([x, y]) => ({ x, y })) } : l);
  if (which === "preload") {
    // A plain wait until 12 s on the match clock, after the wall FLOWER pick (index 4 in the main list).
    const clock = { id: "c-clock12-wait", kind: "firstOf", label: "Wait until 12 s (partner parks)", rows: [{ when: ["Empty"], cards: [] }, { afterMs: 12000, matchClock: true, cards: [] }] };
    doc.auto.cards.splice(4, 0, clock);
  }
  doc = settleDoc(doc, settings, pinState(doc.auto)).doc;

  // Collisions, with a partner parked on LEFT_PARK drawn in.
  const p = [14.5, 117.4], hw = 8.1;
  const withPartner = { ...doc, shapes: [...doc.shapes, { id: "partner", name: "Partner on LEFT_PARK", color: "#000", fillColor: "#000",
    vertices: [{ x: p[0] - hw, y: p[1] - hw }, { x: p[0] + hw, y: p[1] - hw }, { x: p[0] + hw, y: p[1] + hw }, { x: p[0] - hw, y: p[1] + hw }] }] };
  const cat = buildPathCatalog(doc.startPoint, doc.lines, settings);
  const lab = new Map(); const rec = (v) => v.forEach((s) => { lab.set(s.cardId, s.label); rec(s.otherwise ?? []); }); rec(S.stepsOf(doc));
  for (const [id, hits] of stepCollisions(withPartner, cat)) console.log("HITS", lab.get(id) ?? id, JSON.stringify(hits));

  const text = serializeProject(doc, { pretty: true });
  writeFileSync(outPp, text + "\n");
  const java = generateAutoJava({ auto: doc.auto, startPoint: doc.startPoint, lines: doc.lines, shapes: doc.shapes, settings,
    sourceFileName: outPp.split("/").pop(), savedAt: JSON.parse(text).timestamp });
  if (!java.ok) { console.error(java.errors); process.exitCode = 1; }
  else { java.warnings.forEach((w) => console.warn("warning:", w)); writeFileSync(`${outDir}/${java.fileName}`, java.source); console.log("wrote", java.fileName); }
} finally { await server.close(); }
