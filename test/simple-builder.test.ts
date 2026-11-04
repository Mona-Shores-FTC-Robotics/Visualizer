// The simple builder (src/lib/simple): R-Quals v2 built step by step, the way a student would,
// previews by 30 s, exports, and shows each Pick flower at its FLOWER.
import { readFileSync } from "node:fs";
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
import { TEAM_ROBOT, teamRegistry } from "../src/lib/auto/teamRobot";
import { buildPathCatalog } from "../src/lib/auto/geometry";
import { layOutDoc, relink } from "../src/lib/auto/links";
import { withSpotParks } from "../src/lib/simple/parkFrom";
import {
  motionPoseAt,
  simulateAuto,
  worstCase,
} from "../src/lib/auto/simulate";
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
  pruneUnusedPaths,
  stepsOf,
  stepForLine,
  type StepKind,
  type StepList,
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

/** Adds a step at the end of a wait's Otherwise list. */
const addOtherwise = (
  doc: ProjectDoc,
  waitCardId: string,
  kind: Exclude<StepKind, "other" | "wait">,
  spot?: string,
) => {
  const into: StepList = { waitCardId };
  const length =
    stepsOf(doc).find((s) => s.cardId === waitCardId)?.otherwise?.length ?? 0;
  return addStep(doc, kind, length, spot, into).doc;
};

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
    expect(startName(doc)).toBe("RIGHT_START");
    expect(doc.auto!.teamSpots).toEqual(["RIGHT_START"]);
    expect([
      doc.startPoint.x,
      doc.startPoint.y,
      doc.startPoint.headingDeg,
    ]).toEqual([55.6, 7.7, 90]);
    const left = setStart(doc, "LEFT_START", DEFAULT_STARTS.LEFT_START);
    expect(startName(left)).toBe("LEFT_START");
    // The start it left goes with it.
    expect(left.auto!.points.RIGHT_START).toBeUndefined();
    expect(left.auto!.teamSpots).toEqual(["LEFT_START"]);
    expect(left.startPoint).toMatchObject({
      x: 62.3,
      y: 133.8,
      headingDeg: 270,
    });
  });

  it("offers the team's _START spots as starts", () => {
    const starts = startsFrom({
      RIGHT_START: [55.6, 7.7, 90],
      CORNER_START: [10, 10, 45],
      PARK: [14, 100, 270],
    });
    expect(Object.keys(starts).sort()).toEqual([
      "CORNER_START",
      "LEFT_START",
      "RIGHT_START",
    ]);
    expect(startLabel("RIGHT_START")).toBe("Right start");
    expect(startLabel("FAR_WALL_START")).toBe("Far wall start");
    expect(startLabel("RIGHT_START")).toBe("Right start"); // an older file
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
    // Each pick, after a drive: push, dwell, back (the stick came down on the drive in).
    expect(run.motions).toHaveLength(6);
    const [push, dwell, back] = run.motions;
    const wall = FLOWERS[0];
    const mid = (dwell.t0 + dwell.t1) / 2;
    expect(motionPoseAt(run, mid)!.x).toBeCloseTo(contactPose(wall).x, 6);
    expect(motionPoseAt(run, push.t0)!.x).toBeCloseTo(26.7, 1);
    // It ends exactly where it started: WALL_PICK, facing the FLOWER.
    const end = motionPoseAt(run, back.t1)!;
    expect(end.x).toBeCloseTo(26.7, 6);
    expect(end.headingDeg).toBe(180);
    // The dwell is FlowerPicker's 2 s cap (the slow pick the timing plans for); the card's typical
    // time in all (biobuzz AutoRegistration.PICK_FLOWER_TYPICAL_S), the rest split between the
    // push and the back-out.
    expect(dwell.t1 - dwell.t0).toBeCloseTo(2, 6);
    expect(back.t1 - push.t0).toBeCloseTo(teamRegistry().typicalS!.PickFlower, 6);
    expect(push.t1 - push.t0).toBeCloseTo(back.t1 - back.t0, 6);
  });

  it("squares up onto the FLOWER's line first when the drive left it beside it", () => {
    let doc = fresh();
    doc = addSpot(doc, "BESIDE", 30, 50, 180); // 2.6 in off the WALL FLOWER's line
    doc = add(doc, "drive", "BESIDE");
    doc = add(doc, "pick");
    expect(stepsOf(doc)[1]).toMatchObject({ problem: null, squares: true });
    const run = preview(doc);
    expect(run.motions).toHaveLength(4); // square-up, push, dwell, back (the stick came down on the drive)
    const contact = motionPoseAt(
      run,
      (run.motions[2].t0 + run.motions[2].t1) / 2,
    )!;
    expect(contact.y).toBeCloseTo(47.36, 6); // on the FLOWER's line
    expect(contact.x).toBeCloseTo(2.71 + 12, 6);
    const end = motionPoseAt(run, run.motions[3].t1)!;
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

  it("has no stick pause after a drive: the stick came down on the way in", () => {
    const lined = startOf(26.71, 47.36, 180);
    const from = { x: 26.71, y: 47.36, headingDeg: 180 };
    const after = pickMotions("p", from, lined, 0, 4.5, true);
    expect(after).toHaveLength(3); // push, dwell, back: no pause at the spot first
    expect(after[0].motion.length).toBeGreaterThan(0);
    expect(after[0].t0).toBe(0);
    expect(after[after.length - 1].t1).toBeCloseTo(4.5, 6);
    // The time the pause took goes to the push and the back-out.
    const alone = pickMotions("p", from, lined, 0, 4.5);
    expect(after[0].t1 - after[0].t0).toBeGreaterThan(alone[1].t1 - alone[1].t0);
  });

  it("previews the stick coming down 18 in before the end of the drive to a pick", () => {
    const doc = settled(rQualsV2());
    const result = preview(doc);
    const picks = doc.auto!.cards.filter((c) => c.kind === "action" && c.name === "PickFlower");
    expect(picks.length).toBeGreaterThan(0);
    for (const pick of picks) {
      const down = result.log.find((e) => e.cardId === pick.id && /Stick down on the drive in/.test(e.text));
      const started = result.log.find((e) => e.cardId === pick.id && e.kind === "card");
      expect(down, pick.id).toBeDefined();
      expect(started, pick.id).toBeDefined();
      // On the drive before the card, and within the last two seconds of it.
      expect(down!.t).toBeLessThan(started!.t);
      expect(started!.t - down!.t).toBeLessThan(2);
      // The pick's motions start with a move, not a pause at the spot.
      const first = result.motions.find((m) => m.cardId === pick.id)!;
      expect(first.motion.length).toBeGreaterThan(0);
    }
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
      label: "Wait for TIP or CELL up",
      waitFor: "CellUp",
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

  // Every file in biobuzz TeamCode/autos opens in Simple, so none needs the card editor.
  it("reads R-Solo-Staging's IntakeFull wait as a Wait step, and offers IntakeFull", () => {
    let doc = fresh();
    doc = add(doc, "wait");
    const step = stepsOf(doc)[0];
    doc = setWait(doc, step.cardId, { waitFor: "IntakeFull", seconds: 3 });
    expect(stepsOf(doc)[0]).toMatchObject({
      kind: "wait",
      label: "Wait for intake full",
      waitFor: "IntakeFull",
      waitS: 3,
    });
    expect(isSimple(doc)).toBe(true);
    const java = generateAutoJava({
      auto: doc.auto!,
      startPoint: doc.startPoint,
      lines: doc.lines,
      shapes: [],
      settings,
      sourceFileName: "staging.pp",
    });
    expect(java.ok, JSON.stringify(java)).toBe(true);
    if (java.ok) expect(java.source).toContain('kit.when("IntakeFull")');
  });

  it("reads a partner stand-in's CameraBlind hold as a Wait step", () => {
    const doc = fresh();
    const auto = structuredClone(doc.auto!);
    auto.cards.push({
      id: "still",
      kind: "firstOf",
      label: "Stays on the start",
      rows: [
        { when: ["CameraBlind"], cards: [] },
        { afterMs: 30000, cards: [] },
      ],
    });
    const next = { ...doc, auto };
    expect(stepsOf(next)[0]).toMatchObject({
      kind: "wait",
      waitFor: "CameraBlind",
      waitS: 30,
    });
    expect(isSimple(next)).toBe(true);
  });
});

describe("a Wait step's Otherwise list", () => {
  /** L-Simple's fallback: no TIP by 7 s means nobody made TIP 1, so make it at the right CELL. */
  function noTipFallback(): ProjectDoc {
    let doc = fresh();
    doc = setStart(doc, "LEFT_START", DEFAULT_STARTS.LEFT_START);
    doc = addSpot(doc, "RIGHT_FIRE", 57.5, 18, 91.9);
    doc = addSpot(doc, "LEFT_PARK", 9.8, 117.4, 0);
    doc = add(doc, "wait");
    const waitId = doc.auto!.cards[0].id;
    doc = addOtherwise(doc, waitId, "drive", "RIGHT_FIRE");
    doc = addOtherwise(doc, waitId, "launch");
    doc = add(doc, "launch");
    return add(doc, "park", "LEFT_PARK");
  }

  it("holds the Otherwise steps in the wait's time row, trigger row empty", () => {
    const doc = noTipFallback();
    const card = doc.auto!.cards[0];
    expect(card.kind).toBe("firstOf");
    if (card.kind !== "firstOf") return;
    const when = card.rows.find((r) => "when" in r)!;
    const time = card.rows.find((r) => "afterMs" in r)!;
    expect(when.cards).toEqual([]);
    expect(time.cards.map((c) => c.kind)).toEqual(["path", "action"]);
    expect(doc.auto!.cards.map((c) => c.kind)).toEqual([
      "firstOf",
      "action",
      "path",
    ]);
  });

  it("reads back as a Wait step with its Otherwise steps, and stays Simple", () => {
    const doc = noTipFallback();
    const [wait, launch, park] = stepsOf(doc);
    expect(wait).toMatchObject({ kind: "wait", waitFor: "CellUp", waitS: 7 });
    expect(wait.otherwise?.map((s) => s.label)).toEqual([
      "Drive to RIGHT_FIRE",
      "Launch all",
    ]);
    // The launch in the Otherwise is aimed from RIGHT_FIRE; the one below the wait from the start.
    expect(wait.otherwise?.[1].atSpot).toBe("RIGHT_FIRE");
    expect(launch).toMatchObject({ kind: "launch", atSpot: "LEFT_START" });
    expect(park.kind).toBe("park");
    expect(isSimple(doc)).toBe(true);
  });

  it("an empty Otherwise is still a plain wait", () => {
    let doc = fresh();
    doc = add(doc, "wait");
    expect(stepsOf(doc)[0].otherwise).toEqual([]);
    expect(isSimple(doc)).toBe(true);
  });

  it("refuses a wait inside an Otherwise", () => {
    let doc = fresh();
    doc = add(doc, "wait");
    const waitId = doc.auto!.cards[0].id;
    expect(() =>
      addStep(doc, "wait", 0, undefined, { waitCardId: waitId }),
    ).toThrow();
  });

  it("lays an Otherwise drive's heading from the heading at the wait", () => {
    const doc = noTipFallback();
    const drive = stepsOf(doc)[0].otherwise![0];
    const line = doc.lines.find((l) => l.id === drive.lineId)!;
    expect(line.kind === "atomic" && line.heading).toEqual({
      type: "linear",
      startDeg: 270,
      endDeg: 92,
    });
  });

  it("keeps one park across both lists", () => {
    let doc = noTipFallback();
    const waitId = doc.auto!.cards[0].id;
    doc = addOtherwise(doc, waitId, "park", "LEFT_PARK");
    const parks = (steps: ReturnType<typeof stepsOf>): string[] =>
      steps.flatMap((s) => [
        ...(s.kind === "park" ? [s.cardId] : []),
        ...parks(s.otherwise ?? []),
      ]);
    expect(parks(stepsOf(doc))).toHaveLength(1);
    expect(stepsOf(doc)[0].otherwise?.at(-1)?.kind).toBe("park");
    expect(stepsOf(doc).at(-1)?.kind).toBe("drive");
  });

  it("removes and moves steps inside an Otherwise, a drive taking its path", () => {
    let doc = noTipFallback();
    const waitId = doc.auto!.cards[0].id;
    const [drive, launch] = stepsOf(doc)[0].otherwise!;
    const lines = doc.lines.length;
    doc = moveStep(doc, launch.cardId, 0, { waitCardId: waitId });
    expect(stepsOf(doc)[0].otherwise?.map((s) => s.cardId)).toEqual([
      launch.cardId,
      drive.cardId,
    ]);
    doc = removeStep(doc, drive.cardId);
    expect(stepsOf(doc)[0].otherwise?.map((s) => s.cardId)).toEqual([
      launch.cardId,
    ]);
    expect(doc.lines).toHaveLength(lines - 1);
    // A step can move out to the main list, and a main-list step in.
    doc = moveStep(doc, launch.cardId, 1, null);
    expect(stepsOf(doc)[0].otherwise).toEqual([]);
    expect(stepsOf(doc)[1].cardId).toBe(launch.cardId);
    doc = moveStep(doc, launch.cardId, 0, { waitCardId: waitId });
    expect(stepsOf(doc)[0].otherwise?.[0].cardId).toBe(launch.cardId);
  });

  it("removing the wait takes its Otherwise paths with it", () => {
    let doc = noTipFallback();
    const waitId = doc.auto!.cards[0].id;
    doc = removeStep(doc, waitId);
    expect(stepsOf(doc).map((s) => s.kind)).toEqual(["launch", "park"]);
    expect(doc.lines.map((l) => l.name)).toEqual(["to LEFT_PARK"]);
    expect(Object.keys(doc.auto!.pathEnds)).toHaveLength(1);
  });

  it("previews the trigger coming by default, and the worst case takes the Otherwise", () => {
    const doc = noTipFallback();
    const run = preview(doc);
    const otherwiseDrive = stepsOf(doc)[0].otherwise![0];
    expect(run.log.some((e) => e.cardId === otherwiseDrive.cardId)).toBe(false);
    const catalog = buildPathCatalog(doc.startPoint, doc.lines, settings);
    const worst = worstCase(doc.auto!, catalog);
    expect(worst.total).toBeGreaterThan(run.endTime);
  });

  it("exports the Otherwise in the wait's time row", () => {
    const doc = noTipFallback();
    const java = generateAutoJava({
      auto: doc.auto!,
      startPoint: doc.startPoint,
      lines: doc.lines,
      shapes: [],
      settings,
      sourceFileName: "otherwise.pp",
    });
    expect(java.ok, JSON.stringify(java)).toBe(true);
    if (java.ok) {
      expect(java.source).toContain('kit.when("CellUp")');
      expect(java.source).toMatch(
        /kit\.afterMs\(7000\)\.then\(\s*kit\.path\("to RIGHT_FIRE"/,
      );
      expect(java.source).toContain('kit.command("LaunchAll")');
    }
  });

  it("saves and opens again with its Otherwise", () => {
    const doc = noTipFallback();
    const text = serializeProject(doc, { pretty: true });
    const back = parseProject(text, doc.robot);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(stepsOf(back.doc)[0].otherwise?.map((s) => s.label)).toEqual([
      "Drive to RIGHT_FIRE",
      "Launch all",
    ]);
    expect(isSimple(back.doc)).toBe(true);
  });
});

describe("an Otherwise's paths on a rebuilt file", () => {
  /** L-Simple as the mentor saved it on 2 Nov 2026 (biobuzz auto/l-simple): rebuilt in Simple, with the old file's lines still in it. */
  function draft(): ProjectDoc {
    const text = readFileSync(
      `${__dirname}/fixtures/autos/l-simple-draft.pp`,
      "utf8",
    );
    const result = parseProject(text, robotConfigOf(settings));
    if (!result.ok) throw new Error(result.error);
    return result.doc;
  }
  /** Where each path starts once the paths are laid out the way the editor lays them. */
  function starts(doc: ProjectDoc) {
    const laid = layOutDoc(doc, settings);
    const catalog = buildPathCatalog(laid.startPoint, laid.lines, settings);
    return {
      laid,
      startOf: (lineId: string) => catalog.byId.get(lineId)!.start,
    };
  }
  const waitPose = { x: 62.3, y: 133.8 };
  const near = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;

  it("drops the old file's paths no step drives", () => {
    const doc = draft();
    const used = new Set(
      doc.auto!.cards.flatMap((c) => (c.kind === "path" ? [c.lineId] : [])),
    );
    expect(
      doc.lines.some(
        (line) =>
          !used.has(line.id) &&
          !doc.auto!.linkPaths?.includes(line.id) &&
          !Object.values(doc.auto!.parkFrom ?? {}).includes(line.id),
      ),
    ).toBe(true);
    const pruned = pruneUnusedPaths(doc);
    const keep = new Set([
      ...used,
      ...(pruned.auto!.linkPaths ?? []),
      ...Object.values(pruned.auto!.parkFrom ?? {}),
    ]);
    expect(pruned.lines.every((line) => keep.has(line.id))).toBe(true);
    expect(pruned.lines.map((l) => l.name)).not.toContain(
      "to WALL_FLOWER_STAGING",
    );
    expect(Object.keys(pruned.auto!.pathEnds).every((id) => keep.has(id))).toBe(
      true,
    );
    expect(
      pruned.sequence.every(
        (item) => item.kind !== "path" || keep.has(item.lineId),
      ),
    ).toBe(true);
    expect(pruneUnusedPaths(pruned)).toBe(pruned);
    // Any edit prunes too.
    const edited = addSpot(doc, "X", 10, 10, 0);
    expect(edited.lines.map((l) => l.name)).not.toContain(
      "to WALL_FLOWER_STAGING",
    );
  });

  it("an Otherwise drive starts at the wait, and the list below goes on from the wait", () => {
    const doc = draft();
    const waitId = stepsOf(doc).find((s) => s.kind === "wait")!.cardId;
    const next = addOtherwise(doc, waitId, "drive", "RIGHT_LAUNCH_CATCH");
    const otherwise = stepsOf(next).find(
      (s) => s.cardId === waitId,
    )!.otherwise!;
    expect(otherwise.map((s) => s.label)).toEqual([
      "Drive to RIGHT_LAUNCH_CATCH",
    ]);
    const { laid, startOf } = starts(next);
    expect(near(startOf(otherwise[0].lineId!), waitPose)).toBe(true);
    const below = stepsOf(next).find((s) => s.kind === "drive")!;
    expect(below.label).toBe("Drive to SCORING_FLOWER_STAGING");
    expect(near(startOf(below.lineId!), waitPose)).toBe(true);
    // The chain comes back by a link path that ends on the wait's pose.
    const links = laid.auto!.linkPaths ?? [];
    expect(links.length).toBeGreaterThan(0);
    const back = laid.lines.find(
      (line) =>
        links.includes(line.id) &&
        line.kind === "atomic" &&
        near(line.endPoint, waitPose),
    );
    expect(back).toBeDefined();
    // Nothing stray: every line is a step's, a spot's park, or a link.
    const keep = new Set([
      ...laid.auto!.cards.flatMap((c) => (c.kind === "path" ? [c.lineId] : [])),
      ...otherwise.map((s) => s.lineId!),
      ...links,
      ...Object.values(laid.auto!.parkFrom ?? {}),
    ]);
    expect(laid.lines.every((line) => keep.has(line.id))).toBe(true);
  });

  it("removing the Otherwise drive takes its link with it", () => {
    const doc = draft();
    const waitId = stepsOf(doc).find((s) => s.kind === "wait")!.cardId;
    let next = addOtherwise(doc, waitId, "drive", "RIGHT_LAUNCH_CATCH");
    const driveId = stepsOf(next).find((s) => s.cardId === waitId)!
      .otherwise![0].cardId;
    next = removeStep(next, driveId);
    const { laid, startOf } = starts(next);
    expect(stepsOf(laid).find((s) => s.cardId === waitId)!.otherwise).toEqual(
      [],
    );
    const below = stepsOf(laid).find((s) => s.kind === "drive")!;
    expect(near(startOf(below.lineId!), waitPose)).toBe(true);
    expect(
      laid.lines.some(
        (line) =>
          (laid.auto!.linkPaths ?? []).includes(line.id) &&
          line.kind === "atomic" &&
          near(line.endPoint, waitPose),
      ),
    ).toBe(false);
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
      label: "Wait for TIP or CELL up",
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
      expect(java.source).toContain('kit.when("CellUp")');
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
    expect(renameSpot(doc, "RIGHT_START", "HOME")).toMatchObject({
      problem: expect.stringContaining("_START"),
    });
    expect(renameSpot(doc, "WALL_PICK", "FAR_PICK")).toMatchObject({
      problem: expect.stringContaining("already"),
    });
    expect(renameSpot(doc, "WALL_PICK", " !! ")).toMatchObject({
      problem: expect.stringContaining("needs a name"),
    });
  });
});

// The Step panel (lib/simple/StepSide.svelte) finds the step a selected path belongs to.
describe("stepForLine", () => {
  const loaded = parseProject(
    readFileSync(`${__dirname}/../src/lib/match/fixtures/l-partner.pp`, "utf8"),
    robotConfigOf(settings),
  );
  if (!loaded.ok) throw new Error(loaded.error);
  const doc = loaded.doc;
  const all = stepsOf(doc).flatMap((step) => [step, ...(step.otherwise ?? [])]);
  const drives = all.filter((s) => s.kind === "drive" || s.kind === "park");

  it("finds every Drive and Park step by its own path, in the main list and in an Otherwise", () => {
    const inOtherwise = stepsOf(doc).flatMap((s) => s.otherwise ?? []);
    expect(inOtherwise.some((s) => s.kind === "drive")).toBe(true);
    for (const step of drives) {
      const found = stepForLine(doc, step.lineId!);
      expect(found?.step.cardId).toBe(step.cardId);
      expect(found?.viaPark).toBe(false);
    }
  });

  it("finds the drive a spot's park path parks from", () => {
    const parkFrom = Object.entries(doc.auto?.parkFrom ?? {});
    expect(parkFrom.length).toBeGreaterThan(0);
    for (const [cardId, lineId] of parkFrom) {
      const found = stepForLine(doc, lineId);
      expect(found?.step.cardId).toBe(cardId);
      expect(found?.viaPark).toBe(true);
    }
  });

  it("finds nothing for a path no step drives", () => {
    expect(stepForLine(doc, "no-such-path")).toBeNull();
  });
});
