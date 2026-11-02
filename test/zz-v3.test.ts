import { it } from "vitest";
import { writeFileSync, readFileSync } from "node:fs";
import { createDefaultProject, parseProject, robotConfigOf, serializeProject } from "../src/io";
import type { ProjectDoc } from "../src/io/project";
import type { AutoCard } from "../src/lib/auto/types";
import type { Heading } from "../src/types";
import { DEFAULT_SETTINGS } from "../src/config/defaults";
import { TEAM_ROBOT } from "../src/lib/auto/teamRobot";
import { buildPathCatalog } from "../src/lib/auto/geometry";
import { layOutDoc } from "../src/lib/auto/links";
import { withSpotParks } from "../src/lib/simple/parkFrom";
import { generateAutoJava } from "../src/lib/codegen/auto/javaAuto";
import { addStep, blankAuto, setStart, stepsOf, isSimple } from "../src/lib/simple/steps";
import { linkSpot, parseTeamSpots } from "../src/lib/team/teamSpots";
import { simulateAuto } from "../src/lib/auto/simulate";
import { aimFrom } from "../src/lib/simple/aim";
import { pickFrom } from "../src/lib/simple/flowers";
import { findCollisions } from "../src/model/collision";
import { makeCardId } from "../src/lib/auto/tree";

const settings = { ...DEFAULT_SETTINGS, ...TEAM_ROBOT };
const SP = "/tmp/claude-0/-home-user/5d073489-0551-597f-ba5b-840e7f84bd33/scratchpad/drafts/v3";
const BB = "/home/user/biobuzz/TeamCode/autos";
const cfg = robotConfigOf(settings);
const EXTRA_SHAPES = JSON.parse(readFileSync(`${SP}/shapes.json`, "utf8"));
function settled(doc: ProjectDoc): ProjectDoc {
  for (let i = 0; i < 6; i++) {
    const laid = layOutDoc(doc, settings);
    const catalog = buildPathCatalog(laid.startPoint, laid.lines, settings);
    const next = withSpotParks(laid, catalog);
    if (next === laid && laid === doc) return doc;
    doc = next;
  }
  return doc;
}
const spots = (() => { const p = parseTeamSpots(readFileSync(`${BB}/spots.json`, "utf8")); if (!p.ok) throw new Error(p.problem); return p.spots; })();

function report(name: string, doc: ProjectDoc) {
  const auto = doc.auto!;
  const catalog = buildPathCatalog(doc.startPoint, doc.lines, settings);
  const out: string[] = [];
  let at = { x: doc.startPoint.x, y: doc.startPoint.y, h: doc.startPoint.headingDeg, spot: auto.startAt ?? "START" };
  const hitsOf = (lineId: string) => { const info = catalog.byId.get(lineId); if (!info) return []; const hs = findCollisions(doc, info.travel).filter((h) => h.start > 1e-3 || h.end > 0.75); return hs.map((h) => { const nm = h.obstacle.kind === "wall" ? "wall" : (doc.shapes.find((x) => x.id === (h.obstacle as { shapeId: string }).shapeId)?.name ?? "shape"); const t = (h.start + h.end) / 2; const ev = info.travel.find((e) => e.startTime <= t && e.endTime >= t) as { positions?: { x: number; y: number }[] } | undefined; return `${nm}@${h.start.toFixed(1)}-${h.end.toFixed(1)}s/${info.seconds.toFixed(1)} at(${h.firstContact.x.toFixed(1)},${h.firstContact.y.toFixed(1)},${(h.firstContact as { heading?: number; headingDeg?: number }).headingDeg ?? (h.firstContact as { heading?: number }).heading})`; }); };
  const walk = (cards: AutoCard[], ind: string) => {
    for (const c of cards) {
      if (c.kind === "path") {
        const s = auto.pathEnds[c.lineId]; const p = s ? auto.points[s] : null;
        if (p) at = { x: p[0], y: p[1], h: p[2] ?? at.h, spot: s! };
        const info = catalog.byId.get(c.lineId); const hits = hitsOf(c.lineId);
        const parkId = auto.parkFrom?.[c.id]; const ph = parkId ? hitsOf(parkId) : [];
        out.push(`${ind}${c.park ? "park" : "drive"} ${s} (${p?.join(", ")}) ${info ? info.seconds.toFixed(1) + "s" : ""} ${hits.length ? "HITS " + hits.join(",") : ""}${ph.length ? " PARK-PATH HITS " + ph.join(",") : ""}`);
      } else if (c.kind === "action") {
        let extra = "";
        if (c.name === "LaunchAll") { const a = aimFrom(at.x, at.y, at.h, auto.drawnFor); extra = `${a.cell} off ${a.offDeg.toFixed(1)} ${a.on ? "on" : "MISS need " + a.needDeg.toFixed(1)}`; }
        if (c.name === "PickFlower") { const pk = pickFrom(at.x, at.y, at.h); extra = pk.ok ? `${pk.flower.name}${pk.squares ? " SQUARES" : ""}` : "REFUSED " + pk.why; }
        out.push(`${ind}${c.name} @${at.spot} ${extra}`);
      } else if (c.kind === "firstOf") {
        let extra = "";
        if (c.alongside === "LaunchAll") { const a = aimFrom(at.x, at.y, at.h, auto.drawnFor); extra = `${a.cell} off ${a.offDeg.toFixed(1)} ${a.on ? "on" : "MISS need " + a.needDeg.toFixed(1)}`; }
        out.push(`${ind}wait "${c.label}" ${c.alongside ?? ""} ${extra}`);
        const save = { ...at };
        c.rows.forEach((r) => { at = { ...save }; out.push(`${ind}  row ${"when" in r ? r.when.join("|") : r.afterMs + "ms"}`); walk(r.cards, ind + "    "); });
      }
    }
  };
  walk(auto.cards, "  ");
  const sim = simulateAuto(auto, catalog, doc.startPoint, {});
  const own = Object.keys(auto.points).filter((n) => !(auto.teamSpots ?? []).includes(n));
  console.log(`== ${name} preview ends ${sim.endTime.toFixed(1)} s; simple=${isSimple(doc)}; own spots: ${own.join(",") || "none"}; guard: ${sim.guard ? sim.guard.label : "-"}\n${out.join("\n")}`);
}
function exportAuto(file: string, given: ProjectDoc) {
  const exportName = file.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join("-");
  const doc: ProjectDoc = { ...given, auto: { ...given.auto!, exportName } };
  writeFileSync(`${SP}/${file}.pp`, serializeProject(doc));
  const java = generateAutoJava({ auto: doc.auto!, startPoint: doc.startPoint, lines: doc.lines, shapes: doc.shapes, settings, sourceFileName: `${file}.pp` });
  if (!java.ok) throw new Error(file + JSON.stringify(java));
  const cls = file.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join("") + "Auto";
  writeFileSync(`${SP}/${cls}.java`, java.source);
}
/** Set a drive's path shape: control points and heading. */
function shape(doc: ProjectDoc, card: AutoCard, cps: { x: number; y: number }[], heading?: Heading): ProjectDoc {
  if (card.kind !== "path") throw new Error("not a drive");
  return { ...doc, lines: doc.lines.map((l) => l.id === card.lineId && l.kind === "atomic" ? { ...l, controlPoints: cps, ...(heading ? { heading } : {}) } : l) };
}
/** Hold the heading until `until` of the path, then turn to `endDeg`. */
const holdThenTurn = (hold: number, until: number, endDeg: number): Heading => ({
  type: "piecewise",
  piecewiseHeading: { segments: [
    { startProgress: 0, endProgress: until, interpolationType: "constant", parameters: { degrees: hold } },
    { startProgress: until, endProgress: 1, interpolationType: "linear", parameters: { startDeg: hold, endDeg } },
  ] },
});
/** Bend the park path from the drive `card`'s spot (after settled()). */
function parkShape(doc: ProjectDoc, card: AutoCard, cps: { x: number; y: number }[]): ProjectDoc {
  const id = doc.auto!.parkFrom?.[card.id];
  if (!id) return doc; // the last drive before Park has no park of its own
  return { ...doc, lines: doc.lines.map((l) => l.id === id && l.kind === "atomic" ? { ...l, controlPoints: cps } : l) };
}
function parks(doc: ProjectDoc, bends: [number, { x: number; y: number }][]): ProjectDoc {
  let out = settled(doc);
  for (const [i, cp] of bends) out = parkShape(out, out.auto!.cards[i], [cp]);
  return settled(out);
}
function linear(start: string, team: string[], steps: [string, string?][]) {
  let doc = blankAuto(createDefaultProject(cfg, settings.fieldMap));
  doc = { ...doc, shapes: [...doc.shapes, ...EXTRA_SHAPES] };
  doc = setStart(doc, start, spots[start]);
  for (const t of [start, ...team]) doc = linkSpot(doc, t, spots[t]);
  for (const [k, s] of steps) doc = addStep(doc, k as never, doc.auto!.cards.length, s).doc;
  return doc;
}
const fire = (label: string): AutoCard => ({ id: makeCardId(), kind: "firstOf", label, alongside: "LaunchAll", rows: [{ when: ["Empty"], cards: [] }, { afterMs: 3000, cards: [] }] });

it("v3", () => {
  // R-Simple
  const rs = settled(linear("RIGHT_START", ["RIGHT_PARK"], [["spinup"], ["launch"], ["park", "RIGHT_PARK"]]));
  report("r-simple", rs); exportAuto("r-simple", rs);

  // R-Quals: Brady's route on the team's spots.
  let rq = linear("RIGHT_START", ["WALL_FLOWER_STAGING", "LEFT_LAUNCH_CATCH", "SCORING_FLOWER_STAGING", "GARDEN_STAGING", "RIGHT_LAUNCH_CATCH", "RIGHT_PARK"], [
    ["spinup"], ["launch"],
    ["drive", "WALL_FLOWER_STAGING"], ["pick"],
    ["drive", "LEFT_LAUNCH_CATCH"], ["launch"],
    ["drive", "SCORING_FLOWER_STAGING"], ["pick"],
    ["drive", "LEFT_LAUNCH_CATCH"], ["launch"],
    ["drive", "GARDEN_STAGING"], ["gather"],
    ["drive", "RIGHT_LAUNCH_CATCH"], ["launch"],
    ["park", "RIGHT_PARK"],
  ]);
  { const c = rq.auto!.cards;
    rq = shape(rq, c[4], [{ x: 21.3, y: 94.4 }]);           // around the leg's west side
    rq = shape(rq, c[10], [{ x: 20, y: 85 }]);              // down the west side, clear of the leg and the wall FLOWER
    rq = shape(rq, c[14], [{ x: 25, y: 45 }]);              // the park, west of the leg's foot
    rq = shape(rq, c[12], [{ x: 33, y: 15 }]);              // Brady's bend to the launch spot
  }
  rq = parks(rq, [[2, { x: 26, y: 75 }], [4, { x: 30, y: 112 }], [6, { x: 28, y: 110 }], [8, { x: 30, y: 112 }], [10, { x: 22, y: 60 }], [12, { x: 28, y: 52 }]]);
  report("r-quals (Brady's route)", rq); exportAuto("r-quals", rq);

  // L-Simple: wait for the partner's TIP at LEFT_LAUNCH_CATCH; none in 7 s: tip it ourselves.
  const flat = linear("LEFT_START", ["LEFT_LAUNCH_CATCH", "SCORING_FLOWER_STAGING", "WALL_FLOWER_STAGING", "RIGHT_LAUNCH_CATCH", "LEFT_PARK"], [
    ["spinup"], ["drive", "LEFT_LAUNCH_CATCH"],
    ["launch"], ["drive", "SCORING_FLOWER_STAGING"], ["pick"], ["drive", "LEFT_LAUNCH_CATCH"], ["launch"],
    ["drive", "RIGHT_LAUNCH_CATCH"], ["launch"], ["drive", "WALL_FLOWER_STAGING"], ["pick"], ["drive", "LEFT_LAUNCH_CATCH"], ["launch"],
    ["park", "LEFT_PARK"],
  ]);
  const c = flat.auto!.cards;
  let ls = shape(flat, c[7], [{ x: 60, y: 70 }], holdThenTurn(270, 0.85, 91.9)); // down the lane (x 59.7 mid-way), turn below the leg
  ls = shape(ls, c[11], [{ x: 21.3, y: 94.4 }]);
  ls = settled({ ...ls, auto: { ...ls.auto!, cards: [
    c[0], c[1],
    { id: makeCardId(), kind: "firstOf", label: "TIP 1 (the partner's preloads)", rows: [
      { when: ["Tip"], cards: [fire("Fire the preloads at the left CELL"), c[3], c[4], c[5], fire("Fire the far FLOWER's 4 at the left CELL")] },
      { afterMs: 7000, cards: [c[7], fire("No TIP: fire the preloads at the right CELL (TIP 1)"), c[9], c[10], c[11], fire("Fire the wall FLOWER's 4 at the left CELL")] },
    ] },
    c[13],
  ] } });
  { // the spot parks inside the TIP rows: bend the ones that would clip something
    ls = settled(ls); const tip = ls.auto!.cards[2]; if (tip.kind !== "firstOf") throw new Error("tip");
    const hit = tip.rows[0].cards, miss = tip.rows[1].cards;
    ls = parkShape(ls, hit[1], [{ x: 28, y: 112 }]);
    ls = parkShape(ls, miss[0], [{ x: 25, y: 45 }]);
    ls = parkShape(ls, miss[2], [{ x: 20, y: 80 }]);
    ls = settled(ls);
  }
  report("l-simple", ls); exportAuto("l-simple", ls);

  // L-Quals: L-Simple's shape with the wall FLOWER added. Wait for the partner's TIP at
  // LEFT_LAUNCH_CATCH; with none in 7 s, tip the HIVE ourselves from the right CELL.
  const lqFlat = linear("LEFT_START", ["LEFT_LAUNCH_CATCH", "SCORING_FLOWER_STAGING", "WALL_FLOWER_STAGING", "RIGHT_LAUNCH_CATCH", "LEFT_PARK"], [
    ["spinup"], ["drive", "LEFT_LAUNCH_CATCH"],
    // 2..10: TIP came
    ["launch"], ["drive", "SCORING_FLOWER_STAGING"], ["pick"], ["drive", "LEFT_LAUNCH_CATCH"], ["launch"],
    ["drive", "WALL_FLOWER_STAGING"], ["pick"], ["drive", "LEFT_LAUNCH_CATCH"], ["launch"],
    // 11..20: no TIP
    ["drive", "RIGHT_LAUNCH_CATCH"], ["launch"], ["drive", "WALL_FLOWER_STAGING"], ["pick"], ["drive", "LEFT_LAUNCH_CATCH"], ["launch"],
    ["drive", "SCORING_FLOWER_STAGING"], ["pick"], ["drive", "LEFT_LAUNCH_CATCH"], ["launch"],
    ["park", "LEFT_PARK"],
  ]);
  const k = lqFlat.auto!.cards;
  let lq = shape(lqFlat, k[7], [{ x: 22, y: 112 }]);  // LEFT_LAUNCH_CATCH to the wall FLOWER: west of the leg
  lq = shape(lq, k[9], [{ x: 21.3, y: 94.4 }]);
  lq = shape(lq, k[11], [{ x: 60, y: 70 }], holdThenTurn(270, 0.85, 91.9));
  lq = shape(lq, k[15], [{ x: 21.3, y: 94.4 }]);
  lq = settled({ ...lq, auto: { ...lq.auto!, cards: [
    k[0], k[1],
    { id: makeCardId(), kind: "firstOf", label: "TIP 1 (the partner's preloads)", rows: [
      { when: ["Tip"], cards: [fire("Fire the preloads at the left CELL"), k[3], k[4], k[5], fire("Fire the far FLOWER's 4 at the left CELL"), k[7], k[8], k[9], fire("Fire the wall FLOWER's 4 at the left CELL")] },
      { afterMs: 7000, cards: [k[11], fire("No TIP: fire the preloads at the right CELL (TIP 1)"), k[13], k[14], k[15], fire("Fire the wall FLOWER's 4 at the left CELL"), k[17], k[18], k[19], fire("Fire the far FLOWER's 4 at the left CELL")] },
    ] },
    k[21],
  ] } });
  { const tip = lq.auto!.cards[2]; if (tip.kind !== "firstOf") throw new Error("tip");
    const hit = tip.rows[0].cards, miss = tip.rows[1].cards;
    lq = parkShape(lq, hit[1], [{ x: 28, y: 112 }]);
    lq = parkShape(lq, hit[5], [{ x: 20, y: 80 }]);
    lq = parkShape(lq, miss[0], [{ x: 25, y: 45 }]);
    lq = parkShape(lq, miss[2], [{ x: 20, y: 80 }]);
    lq = parkShape(lq, miss[6], [{ x: 28, y: 112 }]);
    lq = settled(lq);
  }
  report("l-quals", lq); exportAuto("l-quals", lq);
});
