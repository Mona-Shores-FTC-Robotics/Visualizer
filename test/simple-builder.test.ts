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
import type { AutoCard } from "../src/lib/auto/types";
import { TEAM_ROBOT } from "../src/lib/auto/teamRobot";
import { buildPathCatalog } from "../src/lib/auto/geometry";
import { layOutDoc, relink } from "../src/lib/auto/links";
import { withSpotParks } from "../src/lib/simple/parkFrom";
import { motionPoseAt, simulateAuto } from "../src/lib/auto/simulate";
import { generateAutoJava } from "../src/lib/codegen/auto/javaAuto";
import {
  pickFrom,
  contactPose,
  flowerFor,
  FLOWERS,
  flowerLinedUp,
  pickMotions,
  pickSpot,
} from "../src/lib/simple/flowers";
import {
  addSpot,
  addStep,
  blankAuto,
  isSimple,
  moveStep,
  removeStep,
  setSpotHeading,
  setStart,
  setWait,
  renameSpot,
  startName,
  DEFAULT_STARTS,
  startLabel,
  startsFrom,
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
    expect(startName(doc)).toBe("START_RIGHT");
    expect(doc.auto!.teamSpots).toEqual(["START_RIGHT"]);
    expect([
      doc.startPoint.x,
      doc.startPoint.y,
      doc.startPoint.headingDeg,
    ]).toEqual([54.06, 7.72, 90]);
    const left = setStart(doc, "START_LEFT", DEFAULT_STARTS.START_LEFT);
    expect(startName(left)).toBe("START_LEFT");
    // The start it left goes with it.
    expect(left.auto!.points.START_RIGHT).toBeUndefined();
    expect(left.auto!.teamSpots).toEqual(["START_LEFT"]);
    expect(left.startPoint).toMatchObject({
      x: 59,
      y: 133.69,
      headingDeg: 270,
    });
  });

  it("offers the team's START_ spots as starts", () => {
    const starts = startsFrom({
      START_RIGHT: [54.06, 7.72, 90],
      START_CORNER: [10, 10, 45],
      PARK: [14, 100, 270],
    });
    expect(Object.keys(starts).sort()).toEqual([
      "START_CORNER",
      "START_LEFT",
      "START_RIGHT",
    ]);
    expect(startLabel("START_RIGHT")).toBe("Right start");
    expect(startLabel("START_FAR_WALL")).toBe("Far wall start");
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
    // The stick and the dwell are FlowerPicker's 0.7 s and 2 s (the dwell's cap); the card's 4.5 s in all.
    expect(stick.t1 - stick.t0).toBeCloseTo(0.7, 6);
    expect(dwell.t1 - dwell.t0).toBeCloseTo(2, 6);
    expect(back.t1 - stick.t0).toBeCloseTo(4.5, 6);
    expect(push.t1 - push.t0).toBeCloseTo(back.t1 - back.t0, 6);
  });

  it("squares up onto the FLOWER's line first when the drive left it beside it", () => {
    let doc = fresh();
    doc = addSpot(doc, "BESIDE", 30, 50, 180); // 2.6 in off the WALL FLOWER's line
    doc = add(doc, "drive", "BESIDE");
    doc = add(doc, "pick");
    expect(stepsOf(doc)[1]).toMatchObject({ problem: null, squares: true });
    const run = preview(doc);
    expect(run.motions).toHaveLength(5); // square-up, stick, push, dwell, back
    const contact = motionPoseAt(
      run,
      (run.motions[3].t0 + run.motions[3].t1) / 2,
    )!;
    expect(contact.y).toBeCloseTo(47.36, 6); // on the FLOWER's line
    expect(contact.x).toBeCloseTo(2.71 + 12, 6);
    const end = motionPoseAt(run, run.motions[4].t1)!;
    expect(end.x).toBeCloseTo(2.71 + 24, 6); // 27.3 in out, kept to 24
    expect(end.y).toBeCloseTo(47.36, 6);
  });

  it("marks a pick the robot would refuse", () => {
    let doc = fresh();
    doc = addSpot(doc, "OFF", 30, 60, 180); // 12.6 in off the WALL FLOWER's line
    doc = add(doc, "drive", "OFF");
    doc = add(doc, "pick");
    expect(stepsOf(doc)[1].problem).toMatch(
      /12\.6 in off the WALL FLOWER's line/,
    );
    expect(preview(doc).motions).toHaveLength(0);
  });

  it("gathers from the nearest GARDEN and comes back, its time from the distance", () => {
    let doc = fresh();
    doc = addSpot(doc, "FIRE_G", 45, 29, 90);
    doc = add(doc, "drive", "FIRE_G");
    doc = add(doc, "gather");
    const steps = stepsOf(doc);
    expect(steps[1].label).toBe("Garden gather");
    expect(steps[1].garden?.name).toBe("red GARDEN");
    expect(steps[1].problem).toBeNull();
    const run = preview(doc);
    const gather = run.motions;
    expect(gather.length).toBeGreaterThan(0);
    // In to red's GARDEN, facing the audience, mid-dwell; back at FIRE_G at the end.
    const dwell = gather[8];
    const there = motionPoseAt(run, (dwell.t0 + dwell.t1) / 2)!;
    expect([there.x, there.y, there.headingDeg]).toEqual([9.5, 10.96, 270]);
    const end = motionPoseAt(run, gather[gather.length - 1].t1)!;
    expect([end.x, end.y]).toEqual([45, 29]);
    // In and back at the robot's speed caps, plus the 1.5 s dwell: longer from farther away.
    const seconds = gather[gather.length - 1].t1 - gather[0].t0;
    expect(seconds).toBeGreaterThan(1.5 + 1);
    let far = fresh();
    far = addSpot(far, "FAR", 70, 60, 90);
    far = add(far, "drive", "FAR");
    far = add(far, "gather");
    const farRun = preview(far);
    expect(
      farRun.motions[farRun.motions.length - 1].t1 - farRun.motions[0].t0,
    ).toBeGreaterThan(seconds);
    // A gather card gets the long timeout too.
    expect(doc.auto!.cards[1]).toMatchObject({
      name: "GardenGather",
      timeoutS: 8,
    });
  });

  it("keeps an Auto's grabs and spots on its own half of the field", () => {
    // From LEFT_FIRE blue's GARDEN is nearer, but an Auto may not cross the centre line.
    let doc = fresh();
    doc = addSpot(doc, "LEFT_FIRE", 59.87, 127, 270);
    doc = add(doc, "drive", "LEFT_FIRE");
    doc = add(doc, "gather");
    expect(stepsOf(doc)[0].problem).toBeNull();
    expect(stepsOf(doc)[1].garden?.name).toBe("red GARDEN");
    // A spot whose robot reaches across x = 70.75 is marked.
    let over = fresh();
    over = addSpot(over, "OVER", 66, 70, 90); // 16 in wide: its right side is at 74
    over = add(over, "drive", "OVER");
    expect(stepsOf(over)[0].problem).toMatch(/centre line/);
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

  it("picks the nearest FLOWER within 60 in, as the robot does", () => {
    expect(flowerFor(70, 70)).toBeNull();
    expect(flowerFor(26.7, 47.4)?.name).toBe("WALL FLOWER");
    expect(pickFrom(26.7, 47.4, 180).ok).toBe(true);
    expect(pickFrom(26.7, 47.4, 0).ok).toBe(false); // facing away
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

describe("an Auto's pick squares up where the drive stopped (FlowerPicker)", () => {
  // The WALL FLOWER: centre (2.71, 47.36), its line runs along y, square is 180°.
  const startOf = (x: number, y: number, h: number) => {
    const pick = pickFrom(x, y, h);
    if (!pick.ok) throw new Error(pick.why);
    return pick;
  };

  it("does nothing extra when the drive ends lined up", () => {
    const pick = startOf(26.71, 47.36, 180);
    expect(pick.squares).toBe(false);
    expect(pick.start.x).toBeCloseTo(26.71, 2);
    const at21 = startOf(21, 47.36, 181);
    expect(at21.squares).toBe(false);
    expect(at21.start.x).toBeCloseTo(21, 2);
  });

  it("squares up onto the line after an overshoot, at the distance it stopped", () => {
    const pick = startOf(22, 50, 168);
    expect(pick.squares).toBe(true);
    expect(pick.start).toMatchObject({ y: 47.36, headingDeg: 180 });
    expect(pick.start.x).toBeCloseTo(22, 2);
  });

  it("keeps between 18 and 24 in from the FLOWER's centre", () => {
    const close = startOf(14, 47.4, 180);
    expect(close.squares).toBe(true);
    expect(close.start.x).toBeCloseTo(2.71 + 18, 2);
    // On the line but under 17.5 in out: not square yet, it backs out to 18.
    const near = startOf(2.71 + 17.2, 47.36, 180);
    expect(near.squares).toBe(true);
    expect(near.start.x).toBeCloseTo(2.71 + 18, 2);
    expect(startOf(2.71 + 17.6, 47.36, 180).squares).toBe(false);
    const far = startOf(32, 47.36, 180);
    expect(far.squares).toBe(true);
    expect(far.start.x).toBeCloseTo(2.71 + 24, 2);
  });

  it("refuses behind the FLOWER, past 12 in off the line or 30° from square", () => {
    expect(pickFrom(2, 47.36, 180).ok).toBe(false);
    expect(pickFrom(26.7, 47.36 + 12.5, 180).ok).toBe(false);
    expect(pickFrom(26.7, 47.36 + 11.5, 180).ok).toBe(true);
    expect(pickFrom(26.7, 47.36, 180 + 31).ok).toBe(false);
    expect(pickFrom(26.7, 47.36, 180 - 29).ok).toBe(true);
  });

  it("previews the square-up, then the push, and ends on the line", () => {
    const pick = startOf(22, 50, 168);
    const motions = pickMotions(
      "p",
      { x: 22, y: 50, headingDeg: 168 },
      pick,
      10,
      4.5,
    );
    expect(motions).toHaveLength(5);
    expect(motions[0].motion.samples[0]).toEqual({ x: 22, y: 50 });
    expect(motions[0].motion.samples[1].y).toBeCloseTo(47.36, 2);
    const last = motions[motions.length - 1];
    expect(last.t1).toBeCloseTo(14.5, 6);
    expect(last.motion.samples[1]).toEqual({
      x: pick.start.x,
      y: pick.start.y,
    });
    const lined = startOf(26.71, 47.36, 180);
    expect(
      pickMotions("p", { x: 26.71, y: 47.36, headingDeg: 180 }, lined, 0, 4.5),
    ).toHaveLength(4);
  });
});

// --- the park from each spot (src/lib/simple/parkFrom.ts) -----------------------------------------

/** What the editor does after every edit: lay the paths out, then give the spots their parks. */
function settled(doc: ProjectDoc): ProjectDoc {
  for (let i = 0; i < 5; i++) {
    const laid = layOutDoc(doc, settings);
    const catalog = buildPathCatalog(laid.startPoint, laid.lines, settings);
    const next = withSpotParks(laid, catalog);
    if (next === laid && laid === doc) return doc;
    doc = next;
  }
  throw new Error("the spot parks never settle");
}

const EXTRA_LAUNCHES = 6;

/** R-Quals v2 with long launches at FAR_PICK, so the guard fires while the robot is there. */
function lateFarPick(): ProjectDoc {
  let doc = rQualsV2();
  const at = doc.auto!.cards.findIndex(
    (c) => c.kind === "path" && doc.auto!.pathEnds[c.lineId] === "FAR_PICK",
  );
  for (let i = 0; i < EXTRA_LAUNCHES; i++)
    doc = addStep(doc, "launch", at + 1).doc;
  return settled(doc);
}

describe("the park from each spot", () => {
  it("gives every drive before Park its park, even with time to spare", () => {
    // The plan's times are only a plan: a slow launch can put the robot on any spot late.
    const doc = settled(rQualsV2());
    const drives = doc.auto!.cards.filter((c) => c.kind === "path" && !c.park);
    expect(Object.keys(doc.auto!.parkFrom ?? {}).sort()).toEqual(
      drives
        .slice(0, -1)
        .map((c) => c.id)
        .sort(),
    );
  });

  it("gives a late spot a straight park to the park spot, starting on the spot", () => {
    const doc = lateFarPick();
    const auto = doc.auto!;
    const farCard = auto.cards.find(
      (c) => c.kind === "path" && auto.pathEnds[c.lineId] === "FAR_PICK",
    )!;
    const parkLine = auto.parkFrom?.[farCard.id];
    expect(parkLine).toBeDefined();
    expect(auto.pathEnds[parkLine!]).toBe("PARK");
    const catalog = buildPathCatalog(doc.startPoint, doc.lines, settings);
    const info = catalog.byId.get(parkLine!)!;
    expect(info.start.x).toBeCloseTo(47.36, 1);
    expect(info.start.y).toBeCloseTo(114.79, 1);
    expect(info.end).toMatchObject({ x: 14, y: 100 });
    // The drive after FAR_PICK still starts on FAR_PICK, not at the park.
    const after: AutoCard[] = auto.cards.filter((c) => c.kind === "path");
    const next = after[after.indexOf(farCard) + 1];
    const nextInfo =
      next.kind === "path" ? catalog.byId.get(next.lineId)! : null;
    expect(nextInfo!.start.x).toBeCloseTo(47.36, 1);
    expect(nextInfo!.start.y).toBeCloseTo(114.79, 1);
    // The drive just before Park needs none.
    const lastDrive = after.filter((c) => c.kind === "path" && !c.park).at(-1)!;
    expect(auto.parkFrom![lastDrive.id]).toBeUndefined();
    // Settled means settled.
    expect(settled(doc)).toBe(doc);
  });

  it("parks from the spot in the preview, and never starts a pick that leaves no time", () => {
    const doc = lateFarPick();
    const result = preview(doc);
    expect(result.guard).not.toBeNull();
    const farCard = doc.auto!.cards.find(
      (c) => c.kind === "path" && doc.auto!.pathEnds[c.lineId] === "FAR_PICK",
    )!;
    const drove = result.drives.find((d) => d.cardId === `${farCard.id}#park`);
    expect(drove, JSON.stringify(result.log.slice(-6))).toBeDefined();
    expect(drove!.t1).toBeLessThanOrEqual(30 + 1e-6);
    // No pick was cut part-way: each pick that started ran its full time.
    expect(result.log.some((e) => /PickFlower.*cut/.test(e.text ?? ""))).toBe(
      false,
    );
  });

  it("exports the spot's park with the drive to it", () => {
    const doc = lateFarPick();
    const java = generateAutoJava({
      auto: doc.auto!,
      startPoint: doc.startPoint,
      lines: doc.lines,
      shapes: [],
      settings,
      sourceFileName: "late.pp",
    });
    expect(java.ok, JSON.stringify(java)).toBe(true);
    if (java.ok)
      expect(java.source).toMatch(
        /kit\.path\("[^"]*", \w+, [\d.]+, \w+, [\d.]+\)/,
      );
  });

  it("drops a spot's park when its drive becomes the last before Park, and keeps a bent one", () => {
    const doc = lateFarPick();
    const farCard = doc.auto!.cards.find(
      (c) => c.kind === "path" && doc.auto!.pathEnds[c.lineId] === "FAR_PICK",
    )!;
    const lineId = doc.auto!.parkFrom![farCard.id];
    // The drive back to LEFT_FIRE after FAR_PICK goes: FAR_PICK is now the last spot before Park.
    const at = doc.auto!.cards.indexOf(farCard);
    const nextDrive = doc
      .auto!.cards.slice(at + 1)
      .find((c) => c.kind === "path")!;
    const quick = settled(removeStep(doc, nextDrive.id));
    expect(quick.auto!.parkFrom?.[farCard.id]).toBeUndefined();
    expect(quick.lines.some((l) => l.id === lineId)).toBe(false);

    const bent = {
      ...doc,
      lines: doc.lines.map((l) =>
        l.id === lineId && l.kind === "atomic"
          ? { ...l, controlPoints: [{ x: 30, y: 120 }] }
          : l,
      ),
    };
    const kept = settled(removeStep(bent, nextDrive.id));
    expect(kept.auto!.parkFrom?.[farCard.id]).toBe(lineId);
  });

  it("gives every drive to the same spot one shared park", () => {
    let doc = rQualsV2();
    // A last drive to WALL_PICK before Park: both drives to LEFT_FIRE now need a park.
    const park = doc.auto!.cards.findIndex((c) => c.kind === "path" && c.park);
    doc = settled(addStep(doc, "drive", park, "WALL_PICK").doc);
    const auto = doc.auto!;
    const toFire = auto.cards.filter(
      (c) => c.kind === "path" && auto.pathEnds[c.lineId] === "LEFT_FIRE",
    );
    expect(toFire).toHaveLength(2);
    expect(auto.parkFrom![toFire[0].id]).toBeDefined();
    expect(auto.parkFrom![toFire[1].id]).toBe(auto.parkFrom![toFire[0].id]);
    // One park each for WALL_PICK (its first visit), LEFT_FIRE and FAR_PICK.
    expect(new Set(Object.values(auto.parkFrom!)).size).toBe(3);
    expect(settled(doc)).toBe(doc);
  });

  it("saves and opens the spot parks", () => {
    const doc = lateFarPick();
    const again = parseProject(serializeProject(doc), robotConfigOf(settings));
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.doc.auto!.parkFrom).toEqual(doc.auto!.parkFrom);
  });
});

describe("the Wait for TIP step", () => {
  it("waits for TIP at most 7 s, and can wait for a CELL instead", () => {
    let doc = fresh();
    doc = add(doc, "launch");
    doc = add(doc, "wait");
    const step = stepsOf(doc)[1];
    expect(step).toMatchObject({
      kind: "wait",
      label: "Wait for TIP",
      waitFor: "Tip",
      waitS: 7,
    });
    doc = setWait(doc, step.cardId, { waitFor: "LeftCellUp", seconds: 4.5 });
    expect(stepsOf(doc)[1]).toMatchObject({
      label: "Wait for Left CELL up",
      waitFor: "LeftCellUp",
      waitS: 4.5,
    });
    const java = generateAutoJava({
      auto: doc.auto!,
      startPoint: doc.startPoint,
      lines: doc.lines,
      shapes: [],
      settings,
      sourceFileName: "wait.pp",
    });
    expect(java.ok, JSON.stringify(java)).toBe(true);
    if (java.ok) {
      expect(java.source).toContain('kit.when("LeftCellUp")');
      expect(java.source).toContain("kit.afterMs(4500)");
    }
  });

  it("reads L-Simple's TIP wait as a Wait step", () => {
    const doc = fresh();
    const auto = structuredClone(doc.auto!);
    auto.cards.push({
      id: "tip-1",
      kind: "firstOf",
      label: "TIP 1 (the partner's preloads)",
      rows: [
        { when: ["LeftCellUp"], cards: [] },
        { afterMs: 7000, cards: [] },
      ],
    });
    expect(stepsOf({ ...doc, auto })[0]).toMatchObject({
      kind: "wait",
      waitFor: "LeftCellUp",
      waitS: 7,
    });
  });
});

describe("spinning the launcher up in Simple", () => {
  /** L-Simple for the locked turret: spin up while waiting for TIP 1, then launch. */
  function waitThenLaunch(spinUp: boolean): ProjectDoc {
    let doc = fresh();
    doc = add(doc, "wait");
    doc = setWait(doc, doc.auto!.cards[0].id, { spinUp });
    return add(doc, "launch");
  }

  it("spins up while waiting, and stays a Wait step", () => {
    const doc = waitThenLaunch(true);
    const card = doc.auto!.cards[0];
    expect(card.kind === "firstOf" && card.alongside).toBe("SpinUp");
    expect(stepsOf(doc)[0]).toMatchObject({
      kind: "wait",
      label: "Wait for TIP",
      spinUp: true,
    });
    expect(isSimple(doc)).toBe(true);
    const off = setWait(doc, card.id, { spinUp: false });
    expect(off.auto!.cards[0]).not.toHaveProperty("alongside");
    expect(stepsOf(off)[0]).toMatchObject({ kind: "wait", spinUp: false });
  });

  it("another command alongside a wait is still an advanced step", () => {
    const doc = waitThenLaunch(false);
    const auto = structuredClone(doc.auto!);
    const card = auto.cards[0];
    if (card.kind === "firstOf") card.alongside = "LaunchAll";
    expect(stepsOf({ ...doc, auto })[0].kind).toBe("other");
  });

  it("previews the wait the same with or without the spin-up", () => {
    const launchAt = (doc: ProjectDoc) =>
      preview(doc).log.find((e) => e.cardId === doc.auto!.cards[1].id)?.t;
    const without = launchAt(waitThenLaunch(false));
    const withSpin = launchAt(waitThenLaunch(true));
    expect(without).toBeDefined();
    expect(withSpin).toBeCloseTo(without!, 3);
    expect(
      preview(waitThenLaunch(true)).launches.map((l) => l.command),
    ).toEqual(["SpinUp"]);
  });

  it("exports the spin-up alongside the wait", () => {
    const doc = waitThenLaunch(true);
    const java = generateAutoJava({
      auto: doc.auto!,
      startPoint: doc.startPoint,
      lines: doc.lines,
      shapes: [],
      settings,
      sourceFileName: "spin.pp",
    });
    expect(java.ok, JSON.stringify(java)).toBe(true);
    if (java.ok) {
      expect(java.source).toContain('kit.command("SpinUp")');
      expect(java.source).toContain('kit.when("Tip")');
      expect(java.source).toContain("kit.afterMs(7000)");
    }
  });

  it("has a plain Spin up step", () => {
    let doc = fresh();
    doc = add(doc, "spinup");
    doc = add(doc, "launch");
    expect(doc.auto!.cards[0]).toMatchObject({
      kind: "action",
      name: "SpinUp",
    });
    expect(stepsOf(doc)[0]).toMatchObject({
      kind: "spinup",
      label: "Spin up the launcher",
    });
    expect(isSimple(doc)).toBe(true);
  });
});

describe("renaming a spot", () => {
  it("renames an Auto's own spot everywhere it is used", () => {
    const doc = rQualsV2();
    const result = renameSpot(doc, "LEFT_FIRE", "launch left");
    expect("doc" in result, JSON.stringify(result)).toBe(true);
    if (!("doc" in result)) return;
    const auto = result.doc.auto!;
    expect(auto.points.LEFT_FIRE).toBeUndefined();
    expect(auto.points.LAUNCH_LEFT).toEqual(doc.auto!.points.LEFT_FIRE);
    expect(
      stepsOf(result.doc).filter((s) => s.spot === "LAUNCH_LEFT"),
    ).toHaveLength(2);
    expect(
      result.doc.lines.filter((l) => l.name === "to LAUNCH_LEFT"),
    ).toHaveLength(2);
  });

  it("refuses a team spot, a start, a name in use and an empty name", () => {
    let doc = rQualsV2();
    doc = {
      ...doc,
      auto: {
        ...doc.auto!,
        teamSpots: ["PARK", ...(doc.auto!.teamSpots ?? [])],
      },
    };
    expect(renameSpot(doc, "PARK", "HOME")).toMatchObject({
      problem: expect.stringContaining("team spot"),
    });
    expect(renameSpot(doc, "START_RIGHT", "HOME")).toMatchObject({
      problem: expect.stringContaining("START_"),
    });
    expect(renameSpot(doc, "WALL_PICK", "FAR_PICK")).toMatchObject({
      problem: expect.stringContaining("already"),
    });
    expect(renameSpot(doc, "WALL_PICK", " !! ")).toMatchObject({
      problem: expect.stringContaining("needs a name"),
    });
  });
});
