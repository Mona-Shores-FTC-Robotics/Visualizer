// The builder's collision check (src/lib/simple/collide.ts): each drive, and its spot's park,
// against the field elements the file draws and the walls.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEFAULT_SETTINGS } from "../src/config/defaults";
import { createDefaultProject, parseProject, robotConfigOf } from "../src/io";
import { TEAM_ROBOT } from "../src/lib/auto/teamRobot";
import { buildPathCatalog } from "../src/lib/auto/geometry";
import { layOutDoc } from "../src/lib/auto/links";
import { stepCollisions } from "../src/lib/simple/collide";
import { addSpot, addStep, blankAuto } from "../src/lib/simple/steps";
import type { ProjectDoc } from "../src/io/project";

const settings = { ...DEFAULT_SETTINGS, ...TEAM_ROBOT };
const HIVE = {
  id: "biobuzz-red-hive",
  name: "Red HIVE",
  vertices: [
    { x: 46, y: 50 },
    { x: 48.6, y: 50 },
    { x: 48.6, y: 91.4 },
    { x: 46, y: 91.4 },
  ],
  color: "#dc2626",
  fillColor: "#ff6b6b",
};

function withDrive(spot: [number, number, number]): ProjectDoc {
  let doc = blankAuto(
    createDefaultProject(robotConfigOf(settings), settings.fieldMap),
  );
  doc = { ...doc, shapes: [HIVE as never] };
  doc = addSpot(doc, "X", ...spot);
  doc = addStep(doc, "drive", 0, "X").doc;
  return layOutDoc(doc, settings);
}

const hits = (doc: ProjectDoc) => [
  ...stepCollisions(
    doc,
    buildPathCatalog(doc.startPoint, doc.lines, settings),
  ).values(),
];

describe("the builder's collision check", () => {
  it("flags a drive through the HIVE", () => {
    // From the right start straight up past the HIVE, the robot's side over its face.
    expect(hits(withDrive([54, 100, 90]))).toEqual([
      { drive: ["the Red HIVE"], park: [] },
    ]);
  });

  it("passes a drive clear of it, and a start against the wall", () => {
    expect(hits(withDrive([62, 100, 90]))).toEqual([]);
  });

  it("finds nothing in the students' Autos", () => {
    for (const f of [
      "l-launch-park.pp",
      "r-launch-park.pp",
      "r-quals-pollen-only.pp",
    ]) {
      const text = readFileSync(`${__dirname}/fixtures/autos/${f}`, "utf8");
      const r = parseProject(text, robotConfigOf(DEFAULT_SETTINGS));
      if (!r.ok) throw new Error(f);
      expect(hits(r.doc), f).toEqual([]);
    }
  });
});
