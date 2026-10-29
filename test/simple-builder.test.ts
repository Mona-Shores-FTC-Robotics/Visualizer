// The simple builder (src/lib/simple): R-Quals v2 built step by step, the way a student would,
// previews by 30 s, exports, and shows each Pick flower at its FLOWER.
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/config/defaults";
import {
  createDefaultProject,
  parseProject,
  robotConfigOf,
  serializeProject,
} from "../src/io";
import type { ProjectDoc } from "../src/io/project";
import { TEAM_ROBOT } from "../src/lib/auto/teamRobot";
import { buildPathCatalog } from "../src/lib/auto/geometry";
import { relink } from "../src/lib/auto/links";
import { motionPoseAt, simulateAuto } from "../src/lib/auto/simulate";
import { generateAutoJava } from "../src/lib/codegen/auto/javaAuto";
import { flowerAhead, FLOWERS, pickPose } from "../src/lib/simple/flowers";
import {
  addSpot,
  addStep,
  blankAuto,
  moveStep,
  removeStep,
  setSpotHeading,
  setStart,
  startSide,
  stepsOf,
  type StepKind,
} from "../src/lib/simple/steps";

const settings = { ...DEFAULT_SETTINGS, ...TEAM_ROBOT };

function fresh(): ProjectDoc {
  return blankAuto(
    createDefaultProject(robotConfigOf(settings), settings.fieldMap),
  );
}

const add = (
  doc: ProjectDoc,
  kind: Exclude<StepKind, "other">,
  spot?: string,
) => addStep(doc, kind, doc.auto!.cards.length, spot).doc;

/** R-Quals v2: shoot the preloads, pick both FLOWERs, shoot each at the left CELL, park. */
function rQualsV2(): ProjectDoc {
  let doc = fresh();
  doc = addSpot(doc, "WALL_PICK", 26.71, 47.36, 180);
  doc = addSpot(doc, "LEFT_FIRE", 59.87, 127, 270);
  doc = addSpot(doc, "FAR_PICK", 47.36, 114.79, 90);
  doc = addSpot(doc, "PARK", 14, 100, 270);
  doc = add(doc, "launch");
  doc = add(doc, "drive", "WALL_PICK");
  doc = add(doc, "pick");
  doc = add(doc, "drive", "LEFT_FIRE");
  doc = add(doc, "launch");
  doc = add(doc, "drive", "FAR_PICK");
  doc = add(doc, "pick");
  doc = add(doc, "drive", "LEFT_FIRE");
  doc = add(doc, "launch");
  return add(doc, "park", "PARK");
}

function preview(doc: ProjectDoc) {
  const lines = relink(doc.startPoint, doc.lines, doc.auto!, settings).lines;
  const catalog = buildPathCatalog(doc.startPoint, lines, settings);
  return simulateAuto(doc.auto!, catalog, doc.startPoint, {});
}

describe("the simple builder", () => {
  it("starts a new Auto empty, at the right start", () => {
    const doc = fresh();
    expect(doc.auto!.cards).toEqual([]);
    expect(doc.lines).toEqual([]);
    expect(startSide(doc)).toBe("right");
    expect([
      doc.startPoint.x,
      doc.startPoint.y,
      doc.startPoint.headingDeg,
    ]).toEqual([55.17, 7.72, 90]);
    expect(startSide(setStart(doc, "left"))).toBe("left");
  });

  it("reads back as the steps it was built from", () => {
    const steps = stepsOf(rQualsV2());
    expect(steps.map((s) => s.label)).toEqual([
      "Launch all",
      "Drive to WALL_PICK",
      "Pick flower",
      "Drive to LEFT_FIRE",
      "Launch all",
      "Drive to FAR_PICK",
      "Pick flower",
      "Drive to LEFT_FIRE",
      "Launch all",
      "Park at PARK",
    ]);
    expect(steps[2].flower?.name).toBe("WALL FLOWER");
    expect(steps[6].flower?.name).toBe("FAR FLOWER");
  });

  it("turns each drive from the heading the step before left the robot at", () => {
    const doc = rQualsV2();
    const headings = doc
      .auto!.cards.filter((c) => c.kind === "path")
      .map((c) =>
        doc.lines.find((l) => c.kind === "path" && l.id === c.lineId)!,
      )
      .map((l) => (l.kind === "atomic" ? l.heading : null));
    expect(headings[0]).toEqual({ type: "linear", startDeg: 90, endDeg: 180 });
    expect(headings[1]).toEqual({ type: "linear", startDeg: 180, endDeg: 270 });
    // Turning a spot re-lays every drive that ends on it, and the one after.
    const turned = setSpotHeading(doc, "WALL_PICK", 170);
    const [first, second] = turned
      .auto!.cards.filter((c) => c.kind === "path")
      .map((c) =>
        turned.lines.find((l) => c.kind === "path" && l.id === c.lineId)!,
      );
    expect(first.kind === "atomic" && first.heading).toEqual({
      type: "linear",
      startDeg: 90,
      endDeg: 170,
    });
    expect(second.kind === "atomic" && second.heading).toEqual({
      type: "linear",
      startDeg: 170,
      endDeg: 270,
    });
  });

  it("ends each drive facing its spot", () => {
    const doc = rQualsV2();
    const lines = relink(doc.startPoint, doc.lines, doc.auto!, settings).lines;
    const catalog = buildPathCatalog(doc.startPoint, lines, settings);
    const ends = doc
      .auto!.cards.filter((c) => c.kind === "path")
      .map((c) =>
        c.kind === "path"
          ? ((catalog.byId.get(c.lineId)!.endHeadingDeg % 360) + 360) % 360
          : NaN,
      );
    expect(ends).toEqual([180, 270, 90, 270, 270]);
  });

  it("parks by 30 s, and shows each Pick flower driving in to its FLOWER and back", () => {
    const run = preview(rQualsV2());
    expect(run.endTime).toBeLessThan(30);
    const picks = run.motions;
    expect(picks).toHaveLength(6);
    const wall = pickPose(FLOWERS[0]);
    const mid = (picks[1].t0 + picks[1].t1) / 2;
    const at = motionPoseAt(run, mid)!;
    expect(at.x).toBeCloseTo(wall.x, 6);
    expect(at.y).toBeCloseTo(wall.y, 6);
    const back = motionPoseAt(run, picks[2].t1)!;
    expect(back.x).toBeCloseTo(26.7, 6); // spots are kept to 0.1 in
  });

  it("removes and moves steps, a drive taking its path with it", () => {
    const doc = rQualsV2();
    const drive = doc.auto!.cards[1];
    const removed = removeStep(doc, drive.id);
    expect(removed.auto!.cards).toHaveLength(9);
    expect(removed.lines).toHaveLength(doc.lines.length - 1);
    const moved = moveStep(doc, doc.auto!.cards[0].id, 3);
    expect(
      stepsOf(moved)
        .slice(0, 3)
        .map((s) => s.label),
    ).toEqual(["Drive to WALL_PICK", "Pick flower", "Launch all"]);
  });

  it("saves, opens again and exports the same Auto", () => {
    const doc = rQualsV2();
    const again = parseProject(serializeProject(doc), robotConfigOf(settings));
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(stepsOf(again.doc).map((s) => s.label)).toEqual(
      stepsOf(doc).map((s) => s.label),
    );
    const java = generateAutoJava({
      auto: again.doc.auto!,
      startPoint: again.doc.startPoint,
      lines: again.doc.lines,
      shapes: [],
      settings,
      sourceFileName: "r-quals-v2.pp",
    });
    expect(java.ok, JSON.stringify(java)).toBe(true);
    if (java.ok) expect(java.source).toContain("PickFlower");
  });

  it("finds no FLOWER for a robot not lined up with one", () => {
    expect(flowerAhead(55.17, 7.72, 90)).toBeNull();
    expect(flowerAhead(26.71, 47.36, 90)).toBeNull();
    expect(flowerAhead(26.71, 47.36, 180)?.name).toBe("WALL FLOWER");
  });
});
