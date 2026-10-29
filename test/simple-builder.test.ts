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
import {
  pickFrom,
  contactPose,
  flowerFor,
  FLOWERS,
  flowerLinedUp,
  pickSpot,
} from "../src/lib/simple/flowers";
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
    expect(steps[2].problem).toBeNull();
    expect(steps[6].flower?.name).toBe("FAR FLOWER");
    expect(steps[6].problem).toBeNull();
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

  it("parks by 30 s, and shows each pick as the robot's FlowerPicker does it", () => {
    const run = preview(rQualsV2());
    expect(run.endTime).toBeLessThan(30);
    // Each pick: stick, push, dwell, back.
    expect(run.motions).toHaveLength(8);
    const [stick, push, dwell, back] = run.motions;
    const wall = FLOWERS[0];
    const mid = (dwell.t0 + dwell.t1) / 2;
    expect(motionPoseAt(run, mid)!.x).toBeCloseTo(contactPose(wall).x, 6);
    expect(motionPoseAt(run, (stick.t0 + stick.t1) / 2)!.x).toBeCloseTo(
      26.7,
      1,
    );
    // It ends exactly where it started: WALL_PICK, facing the FLOWER.
    const end = motionPoseAt(run, back.t1)!;
    expect(end.x).toBeCloseTo(26.7, 6);
    expect(end.headingDeg).toBe(180);
    // The stick and the dwell are FlowerPicker's 0.7 s and 1.5 s; the card's 4 s in all.
    expect(stick.t1 - stick.t0).toBeCloseTo(0.7, 6);
    expect(dwell.t1 - dwell.t0).toBeCloseTo(1.5, 6);
    expect(back.t1 - stick.t0).toBeCloseTo(4, 6);
    expect(push.t1 - push.t0).toBeCloseTo(back.t1 - back.t0, 6);
  });

  it("pushes straight ahead from wherever the drive left the robot, and back there", () => {
    let doc = fresh();
    doc = addSpot(doc, "BESIDE", 30, 50, 180); // 2.6 in off the WALL FLOWER's line
    doc = add(doc, "drive", "BESIDE");
    doc = add(doc, "pick");
    expect(stepsOf(doc)[1].problem).toBeNull();
    const run = preview(doc);
    expect(run.motions).toHaveLength(4); // stick, push, dwell, back: no line-up
    const contact = motionPoseAt(
      run,
      (run.motions[2].t0 + run.motions[2].t1) / 2,
    )!;
    expect(contact.y).toBeCloseTo(50, 6); // straight ahead, not onto the FLOWER's line
    expect(contact.x).toBeCloseTo(2.71 + 12, 6);
    const end = motionPoseAt(run, run.motions[3].t1)!;
    expect([end.x, end.y]).toEqual([30, 50]);
  });

  it("marks a pick the robot would refuse", () => {
    let doc = fresh();
    doc = addSpot(doc, "OFF", 30, 60, 180); // 12.6 in off the WALL FLOWER's line
    doc = add(doc, "drive", "OFF");
    doc = add(doc, "pick");
    expect(stepsOf(doc)[1].problem).toMatch(/off the robot's line ahead/);
    expect(preview(doc).motions).toHaveLength(0);
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

  it("picks the nearest FLOWER within 48 in, as the robot does", () => {
    expect(flowerFor(70, 70)).toBeNull();
    expect(flowerFor(26.7, 47.4)?.name).toBe("WALL FLOWER");
    expect(pickFrom(26.7, 47.4, 180).ok).toBe(true);
    expect(pickFrom(26.7, 47.4, 0).ok).toBe(false); // facing away
    expect(pickFrom(14, 47.4, 180).ok).toBe(false); // already past the contact
    expect(pickSpot(FLOWERS[1])).toEqual({
      x: 47.36,
      y: 141.5 - 2.71 - 24,
      headingDeg: 90,
    });
    // A click on a FLOWER's line is put on its pick spot; one off it is not.
    expect(flowerLinedUp(30, 50)?.name).toBe("WALL FLOWER");
    expect(flowerLinedUp(30, 60)).toBeNull();
  });
});
