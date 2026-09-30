import { assert, assertEqual, test } from "../testing/harness";
import { loadSample } from "./fixtures/load";
import { createEmptyAuto, normalizeAuto, serializeAuto } from "./normalize";
import { buildProject, serializeProject } from "../../utils/project";
import { buildPathCatalog } from "./geometry";
import { validateAuto, type AutoIssue } from "./validate";
import { findCard, usedNames } from "./tree";
import type { AutoSection, FirstOfCard, PathCard } from "./types";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function issuesOf(auto: AutoSection): AutoIssue[] {
  const sample = loadSample();
  const catalog = buildPathCatalog(sample.startPoint, sample.lines, sample.settings);
  return validateAuto(auto, catalog, sample.startPoint);
}

test("the sample's auto section loads without problems", () => {
  const sample = loadSample();
  assertEqual(sample.problems, []);
  assertEqual(sample.auto.cards.length, 4);
});

test("serializing a normalized section gives back the file's section", () => {
  const sample = loadSample();
  assertEqual(serializeAuto(sample.auto), sample.data.auto);
});

test("save then load round-trips the auto section through a project file", () => {
  const sample = loadSample();
  const text = serializeProject(
    {
      startPoint: sample.startPoint,
      lines: sample.lines,
      shapes: sample.shapes,
      sequence: [],
      auto: sample.auto,
    },
    { pretty: true },
  );
  const reread = JSON.parse(text);
  const { auto, problems } = normalizeAuto(reread.auto);
  assertEqual(problems, []);
  assertEqual(auto, sample.auto);
  // And again: saving the reloaded section changes nothing.
  assertEqual(serializeAuto(auto!), reread.auto);
});

test("a project without an Auto writes no auto key", () => {
  const sample = loadSample();
  const project = buildProject({
    startPoint: sample.startPoint,
    lines: sample.lines,
    shapes: [],
    sequence: [],
    auto: null,
  });
  assert(!("auto" in project), "no auto key expected");
  assertEqual(normalizeAuto(undefined), { auto: null, problems: [] });
});

test("the loader repairs what it can and says what it dropped", () => {
  const { auto, problems } = normalizeAuto({
    version: 2,
    drawnFor: "GREEN",
    registry: { actions: ["A", "A", 3, " B "], conditions: "nope" },
    points: { Good: [1, 2], Bad: [1] },
    cards: [
      { id: "x", kind: "action", name: "A" },
      { id: "x", kind: "action", name: "B" },
      { kind: "teleport" },
      {
        id: "p",
        kind: "path",
        lineId: "l1",
        events: [{ at: 1.5, action: "A" }, { at: 0.2, action: "B" }, { at: "no" }],
      },
      {
        id: "f",
        kind: "firstOf",
        rows: [
          { when: ["C"], afterMs: 5, cards: [] },
          { afterMs: -1, cards: [] },
          { otherwise: true },
        ],
      },
    ],
  });
  assert(auto, "section expected");
  assertEqual(auto.drawnFor, "BLUE");
  assertEqual(auto.registry, { actions: ["A", "B"], conditions: [] });
  assertEqual(Object.keys(auto.points), ["Good"]);
  assertEqual(auto.cards.map((card) => card.kind), ["action", "action", "path", "firstOf"]);
  assert(auto.cards[0].id !== auto.cards[1].id, "duplicate ids must be re-issued");
  const path = auto.cards[2] as PathCard;
  assertEqual(path.events, [
    { at: 0.2, action: "B" },
    { at: 1, action: "A" },
  ]);
  assertEqual(path.park, false);
  assertEqual((auto.cards[3] as FirstOfCard).rows, [{ cards: [], otherwise: true }]);
  const text = problems.join("\n");
  for (const expected of ["newer Auto builder", "drawnFor", "registry.conditions", 'Point "Bad"', '"teleport"', "more than one condition", "afterMs must be"]) {
    assert(text.includes(expected), `expected a problem mentioning ${expected}; got:\n${text}`);
  }
});

test("a non-object auto section is reported, not loaded", () => {
  const { auto, problems } = normalizeAuto("hello");
  assertEqual(auto, null);
  assertEqual(problems.length, 1);
});

test("an empty Auto is valid", () => {
  assertEqual(issuesOf(createEmptyAuto()), []);
});

test("the sample validates clean", () => {
  const sample = loadSample();
  assertEqual(issuesOf(sample.auto), []);
});

test("used names are counted across cards, chips, events and rows", () => {
  const sample = loadSample();
  const used = usedNames(sample.auto);
  assertEqual([...used.conditions.keys()].sort(), ["CameraBlind", "HiveTipped", "IntakeFull", "LauncherReady"]);
  assertEqual(used.actions.get("IntakeOn"), 5);
});

test("unregistered names are errors", () => {
  const auto = clone(loadSample().auto);
  auto.registry.actions = auto.registry.actions.filter((name) => name !== "IntakeOn");
  auto.registry.conditions = auto.registry.conditions.filter((name) => name !== "CameraBlind");
  const errors = issuesOf(auto).filter((issue) => issue.level === "error");
  assert(errors.some((e) => e.message.includes('"IntakeOn"') && e.message.includes("list of commands")));
  assert(errors.some((e) => e.cardId === "did-tip" && e.message.includes('"CameraBlind"')));
});

test("a wait with no time row is an error", () => {
  const auto = clone(loadSample().auto);
  const wait = findCard(auto.cards, "wait-ready") as FirstOfCard;
  wait.rows = wait.rows.filter((row) => "when" in row);
  const issues = issuesOf(auto);
  assert(
    issues.some((i) => i.level === "error" && i.cardId === "wait-ready" && i.message.includes("time row")),
    JSON.stringify(issues),
  );
});

test("a path that starts away from the robot is a discontinuity warning", () => {
  const auto = clone(loadSample().auto);
  // Drive CollectFar straight after the preload shot, from ShootSpot.
  auto.cards.splice(3, 0, {
    id: "jump",
    kind: "path",
    lineId: "far-collect",
    while: [],
    events: [],
    park: false,
  });
  const issues = issuesOf(auto);
  const jump = issues.find((i) => i.cardId === "jump");
  assert(jump && jump.level === "warning" && jump.message.includes("starts"), JSON.stringify(issues));
});

test("paths inside a group, missing paths and double parks are errors", () => {
  const auto = clone(loadSample().auto);
  auto.cards.push(
    { id: "nested", kind: "path", lineId: "far-collect-a", while: [], events: [], park: false },
    { id: "gone", kind: "path", lineId: "no-such-line", while: [], events: [], park: false },
    { id: "park1", kind: "path", lineId: "far-park", while: [], events: [], park: true },
    { id: "park2", kind: "path", lineId: "far-park", while: [], events: [], park: true },
  );
  const issues = issuesOf(auto);
  const errorFor = (id: string) => issues.find((i) => i.cardId === id && i.level === "error");
  assert(errorFor("nested")?.message.includes("inside a group"), JSON.stringify(issues));
  assert(errorFor("gone")?.message.includes("no longer exists"));
  assert(errorFor("park2")?.message.includes("more than one park"));
  assert(!errorFor("park1"));
});

test("rows after an otherwise row are flagged as unreachable", () => {
  const auto = clone(loadSample().auto);
  const wait = findCard(auto.cards, "wait-ready") as FirstOfCard;
  wait.rows.unshift({ otherwise: true, cards: [] });
  const issues = issuesOf(auto).filter((i) => i.cardId === "wait-ready");
  assertEqual(issues.length, 2);
  assert(issues.every((i) => i.level === "warning" && i.message.includes("never fire")));
});

test("condition kinds: events round-trip, unknown names are dropped, none writes nothing", () => {
  const raw = clone(loadSample().data.auto);
  raw.registry.events = ["HiveTipped", "NotRegistered"];
  const { auto, problems } = normalizeAuto(raw);
  assertEqual(auto!.registry.events, ["HiveTipped"]);
  assert(problems.some((p) => p.includes("registry.events")));
  assertEqual(serializeAuto(auto!).registry.events, ["HiveTipped"]);
  const plain = normalizeAuto(loadSample().data.auto).auto!;
  assert(!("events" in serializeAuto(plain).registry), "no events key for a file without events");
});
