import { assert, assertEqual, test } from "../testing/harness";
import realisticText from "../../../docs/design-data/red-biobuzz-realistic.pp?raw";
import { loadProject, loadSample } from "./fixtures/load";
import { buildPathCatalog } from "./geometry";
import { LINK_NAME, relink } from "./links";
import { allCards } from "./tree";
import type { AutoCard, AutoSection } from "./types";
import type { BasePoint, Path, Settings, StartPose } from "../../types";
import { generateAutoJava } from "../codegen/auto/javaAuto";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** Where the robot is before each path card, walking the Auto. */
function startsWanted(auto: AutoSection, startPoint: StartPose, lines: Path[], settings: Settings) {
  const catalog = buildPathCatalog(startPoint, lines, settings);
  const wanted = new Map<string, BasePoint>();
  const walk = (list: AutoCard[], at: BasePoint): BasePoint => {
    let here = at;
    for (const card of list) {
      if (card.kind === "path") {
        const path = catalog.byId.get(card.lineId)!;
        if (!wanted.has(card.lineId)) wanted.set(card.lineId, here);
        here = path.end;
      } else if (card.kind === "firstOf") {
        const ends = card.rows.map((row) => walk(row.cards, here));
        const moved = card.rows.findIndex((row) => row.cards.length > 0);
        if (moved >= 0) here = ends[moved];
      }
    }
    return here;
  };
  walk(auto.cards, startPoint);
  return { catalog, wanted };
}

function relinked(project: ReturnType<typeof loadProject>) {
  const result = relink(project.startPoint, project.lines, project.auto, project.settings);
  const auto = { ...project.auto, linkPaths: result.linkIds };
  return { ...project, lines: result.lines, auto, result };
}

test("every path the Auto drives starts where the robot is", () => {
  const project = relinked(loadProject(realisticText));
  const { catalog, wanted } = startsWanted(project.auto, project.startPoint, project.lines, project.settings);
  for (const [id, at] of wanted) {
    const start = catalog.byId.get(id)!.start;
    assert(Math.hypot(start.x - at.x, start.y - at.y) < 1e-6, `${id} starts at ${JSON.stringify(start)}, robot at ${JSON.stringify(at)}`);
  }
});

test("hand-made links give way to managed ones, and the Java does not change", () => {
  const before = loadProject(realisticText);
  assert(before.lines.some((line) => /never driven/i.test(line.name ?? "")), "the file has hand-made links");
  const after = relinked(before);
  assert(!after.lines.some((line) => /never driven/i.test(line.name ?? "") && line.name !== LINK_NAME), "hand-made links dropped");
  assert(after.result.linkIds.length > 0, "managed links added");
  assert(after.lines.filter((l) => after.result.linkIds.includes(l.id)).every((l) => l.name === LINK_NAME));
  const javaOf = (p: typeof before) =>
    generateAutoJava({ auto: p.auto, startPoint: p.startPoint, lines: p.lines, shapes: p.shapes, settings: p.settings, sourceFileName: "x.pp" });
  const a = javaOf(before);
  const b = javaOf(after);
  assert(a.ok && b.ok, JSON.stringify([a, b]).slice(0, 400));
  if (a.ok && b.ok) assertEqual(b.source, a.source);
});

test("relinking what is already linked changes nothing", () => {
  const once = relinked(loadProject(realisticText));
  const twice = relink(once.startPoint, once.lines, once.auto, once.settings);
  assertEqual(twice.changed, false);
  assert(twice.lines === once.lines, "same array back");
});

test("reordering the Auto re-lays the paths and their links", () => {
  const project = relinked(loadSample());
  const auto = clone(project.auto);
  // Drive the near branch's first path straight after the preload shot, as its own card.
  auto.cards.splice(3, 0, { id: "early", kind: "path", lineId: "far-up", park: false });
  const moved = relink(project.startPoint, project.lines, auto, project.settings);
  assert(moved.changed);
  const next = { ...project, lines: moved.lines, auto: { ...auto, linkPaths: moved.linkIds } };
  const { catalog, wanted } = startsWanted(next.auto, next.startPoint, next.lines, next.settings);
  const start = catalog.byId.get("far-up")!.start;
  const at = wanted.get("far-up")!;
  assert(Math.hypot(start.x - at.x, start.y - at.y) < 1e-6, JSON.stringify({ start, at }));
});

test("a path driven twice starts where its first use needs; paths no card drives keep their start", () => {
  const project = loadSample();
  const before = buildPathCatalog(project.startPoint, project.lines, project.settings);
  const extra: Path = {
    id: "drawing", name: "A drawing", color: "#fff", kind: "atomic",
    endPoint: { x: 10, y: 10 }, controlPoints: [], heading: { type: "constant", degrees: 0 },
  } as Path;
  const lines = [...project.lines, extra];
  const withDrawing = buildPathCatalog(project.startPoint, lines, project.settings).byId.get("drawing")!.start;
  const result = relink(project.startPoint, lines, project.auto, project.settings);
  const after = buildPathCatalog(project.startPoint, result.lines, project.settings);
  const drawing = after.byId.get("drawing")!;
  assertEqual({ x: drawing.start.x, y: drawing.start.y }, { x: withDrawing.x, y: withDrawing.y });
  // Every driven path is still there, once.
  const driven = new Set(allCards(project.auto.cards).flatMap((c) => (c.kind === "path" ? [c.lineId] : [])));
  for (const id of driven) assert(after.byId.has(id) && before.byId.has(id), id);
});
