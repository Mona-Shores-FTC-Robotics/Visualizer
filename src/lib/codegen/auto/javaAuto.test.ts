import { assert, assertEqual, assertText, test } from "../../testing/harness";
import golden from "./fixtures/HiveRushAuto.java?raw";
import sampleText from "../../auto/fixtures/hive-rush.pp?raw";
import { loadSample } from "../../auto/fixtures/load";
import { generateAutoJavaFromText } from "./fromFile";
import {
  autoClassName,
  generateAutoJava,
  javaNumber,
  javaString,
  parkSeconds,
} from "./javaAuto";
import { buildPathCatalog } from "../../auto/geometry";
import type { AutoSection } from "../../auto/types";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function exportOf(auto: AutoSection) {
  const sample = loadSample();
  return generateAutoJava({ ...sample, auto, sourceFileName: "hive-rush.pp" });
}

function sourceOf(auto: AutoSection): string {
  const result = exportOf(auto);
  if (!result.ok) throw new Error(result.errors.join("\n"));
  return result.source;
}

test("golden: the hive-rush sample exports exactly HiveRushAuto.java", () => {
  const result = generateAutoJavaFromText(sampleText, "hive-rush.pp");
  assert(result.ok, JSON.stringify(result));
  assertEqual(result.className, "HiveRushAuto");
  assertEqual(result.fileName, "HiveRushAuto.java");
  assertText(result.source, golden);
});

test("golden: the same file saved before pins still exports exactly HiveRushAuto.java", () => {
  const data = JSON.parse(sampleText);
  delete data.auto.pathEnds;
  delete data.auto.startAt;
  const result = generateAutoJavaFromText(JSON.stringify(data), "hive-rush.pp");
  assert(result.ok, JSON.stringify(result));
  assertText(result.source, golden);
});

test("a named point nothing uses is not exported", () => {
  const auto = clone(loadSample().auto);
  auto.points.Nowhere = [70, 70];
  assert(!sourceOf(auto).includes("nowhere"));
});

test("class names are the export name in PascalCase plus Auto", () => {
  assertEqual(autoClassName("hive-rush.pp"), "HiveRushAuto");
  assertEqual(autoClassName("near_side park"), "NearSideParkAuto");
  assertEqual(autoClassName("2cycle"), "Auto2cycleAuto");
  assertEqual(autoClassName("---"), "UntitledAuto");
});

test("numbers are plain decimals with at most 4 places", () => {
  assertEqual(javaNumber(38), "38");
  assertEqual(javaNumber(70.75), "70.75");
  assertEqual(javaNumber(0.6), "0.6");
  assertEqual(javaNumber(1 / 3), "0.3333");
  assertEqual(javaNumber(-0), "0");
  assertEqual(javaNumber(2.50000001), "2.5");
});

test("strings escape quotes and backslashes", () => {
  assertEqual(javaString('Say "hi" \\ bye'), '"Say \\"hi\\" \\\\ bye"');
});

test("park seconds are the drive time rounded up to 0.1 s", () => {
  assertEqual(parkSeconds(1.81), 1.9);
  assertEqual(parkSeconds(2), 2);
  assertEqual(parkSeconds(2.0000001), 2);
  const sample = loadSample();
  const catalog = buildPathCatalog(sample.startPoint, sample.lines, sample.settings);
  const park = catalog.byId.get("far-park")!;
  assert(park.seconds > 1.5 && park.seconds <= 2.1, `park takes ${park.seconds}`);
});

test("an empty Auto still exports a compilable skeleton", () => {
  const auto = clone(loadSample().auto);
  auto.cards = [];
  auto.points = {};
  const source = sourceOf(auto);
  assert(source.includes("public static final String[] ACTIONS = {};"));
  assert(source.includes("return kit.sequence();"));
  assert(!source.includes("Interpolator"), "no Interpolator import without a piecewise path");
  assert(!source.includes("Path "), "no path locals when no card drives one");
});

test("the trunk is guarded when it holds a park card", () => {
  const auto = clone(loadSample().auto);
  auto.cards = [
    { id: "a", kind: "action", name: "SpinUp" },
    { id: "p", kind: "path", lineId: "near-collect", while: [], events: [], park: true },
  ];
  const source = sourceOf(auto);
  assert(
    source.includes(
      [
        "        return kit.sequence(",
        '                kit.guarded("Auto", collectNear, ',
      ].join("\n"),
    ),
    source,
  );
  assert(source.includes('kit.path("CollectNear", collectNear)));'), source);
});

test("near-point and in-area rows use the named point poses", () => {
  const auto = clone(loadSample().auto);
  auto.cards = [
    {
      id: "w",
      kind: "firstOf",
      label: "At the shooting spot?",
      rows: [
        { nearPoint: "ShootSpot", radiusIn: 4.5, cards: [] },
        { inArea: ["NearPickup", "FarPickup"], cards: [{ id: "x", kind: "action", name: "IntakeOn" }] },
        { afterMs: 250, cards: [] },
      ],
    },
  ];
  const source = sourceOf(auto);
  assert(source.includes("kit.nearPoint(shootSpot, 4.5),"), source);
  assert(source.includes("kit.inArea(nearPickup, farPickup).then("), source);
  assert(source.includes("kit.afterMs(250))"), source);
  assert(source.includes('public static final String[] ACTIONS = {"IntakeOn"};'), source);
  assert(source.includes("public static final String[] CONDITIONS = {};"), source);
});

test("errors block the export and say why", () => {
  const auto = clone(loadSample().auto);
  auto.registry.actions = auto.registry.actions.filter((name) => name !== "SpinDown");
  const result = exportOf(auto);
  assert(!result.ok);
  assert(result.errors.some((error) => error.includes('"SpinDown"')), JSON.stringify(result.errors));
});

test("a named point takes over a pose only when its heading fits", () => {
  const auto = clone(loadSample().auto);
  // BackToShoot ends facing 0 with a constant heading; give ShootSpot 90.
  auto.points.ShootSpot = [38, 71, 90];
  const source = sourceOf(auto);
  assert(source.includes("Pose shootSpot = p.of(38, 71, 90);"), source);
  assert(!source.includes(".constant(shootSpot)"), "constant heading must not use the 90° point");
  assert(/Pose \w+ = p\.of\(38, 71, 0\);/.test(source), source);
});
