// Fork: a Wait's Otherwise goes on with the steps below the wait, or parks instead
// (steps.ts setWaitRejoin), and every drive the endgame guard could park after has a park from its
// spot, an Otherwise's included (parkFrom.ts). On biobuzz's l-partner.pp.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/config/defaults";
import { parseProject, robotConfigOf } from "../src/io";
import type { ProjectDoc } from "../src/io/project";
import { buildPathCatalog } from "../src/lib/auto/geometry";
import { pinState } from "../src/lib/auto/pins";
import { settleDoc } from "../src/lib/auto/settle";
import { validateAuto } from "../src/lib/auto/validate";
import type { AutoCard } from "../src/lib/auto/types";
import { generateAutoJava } from "../src/lib/codegen/auto/javaAuto";
import { stepCollisions } from "../src/lib/simple/collide";
import { withSpotParks } from "../src/lib/simple/parkFrom";
import { addStep, setWaitRejoin, stepsOf } from "../src/lib/simple/steps";

function load(): ProjectDoc {
  const loaded = parseProject(
    readFileSync("test/fixtures/init-options/l-partner.pp", "utf8"),
    robotConfigOf(DEFAULT_SETTINGS),
  );
  if (!loaded.ok) throw new Error(loaded.error);
  return loaded.doc;
}

const settingsOf = (doc: ProjectDoc) => ({ ...DEFAULT_SETTINGS, ...doc.robot });

/** As the editor leaves a document after an edit: laid out, and each spot's park made. */
function settled(doc: ProjectDoc): ProjectDoc {
  const settings = settingsOf(doc);
  let next = settleDoc(doc, settings, null).doc;
  let pinned = pinState(next.auto!);
  for (let i = 0; i < 4; i++) {
    const s = settleDoc(next, settings, pinned);
    pinned = s.pinned;
    const catalog = buildPathCatalog(s.doc.startPoint, s.doc.lines, settings);
    const after = withSpotParks(s.doc, catalog);
    if (after === next) break;
    next = after;
  }
  return next;
}

const waitId = (doc: ProjectDoc) =>
  stepsOf(doc).find((step) => step.kind === "wait")!.cardId;
const labels = (doc: ProjectDoc) => stepsOf(doc).map((step) => step.label);
const otherwise = (doc: ProjectDoc) =>
  stepsOf(doc)
    .find((step) => step.kind === "wait")!
    .otherwise!.map((s) => s.label);
const errors = (doc: ProjectDoc) => {
  const catalog = buildPathCatalog(doc.startPoint, doc.lines, settingsOf(doc));
  return validateAuto(doc.auto!, catalog, doc.startPoint).filter(
    (issue) => issue.level === "error",
  );
};

describe("an Otherwise that parks", () => {
  it("ends with its own Park, and the steps below run only when the trigger comes", () => {
    const doc = load();
    const parked = setWaitRejoin(doc, waitId(doc), false);
    // The builder shows the same steps below the wait.
    expect(labels(parked)).toEqual(labels(doc));
    expect(otherwise(parked)).toEqual([...otherwise(doc), "Park at LEFT_PARK"]);
    expect(stepsOf(parked).find((s) => s.kind === "wait")!.rejoin).toBe(false);
    // In the file the wait is last, and its trigger row holds the rest of the route.
    const cards = parked.auto!.cards;
    const wait = cards[cards.length - 1];
    expect(wait.kind).toBe("firstOf");
    const when =
      wait.kind === "firstOf" ? wait.rows.find((r) => "when" in r)! : null;
    const tail = when!.cards;
    expect(tail[tail.length - 1]).toMatchObject({ kind: "path", park: true });
    expect(errors(settled(parked))).toEqual([]);
  });

  it("going on again puts the Auto back as it was", () => {
    const doc = load();
    const parked = setWaitRejoin(doc, waitId(doc), false);
    const back = setWaitRejoin(parked, waitId(parked), true);
    expect(back.auto!.cards.map((c) => c.id)).toEqual(
      doc.auto!.cards.map((c) => c.id),
    );
    expect(otherwise(back)).toEqual(otherwise(doc));
    expect(stepsOf(back).find((s) => s.kind === "wait")!.rejoin).toBe(true);
  });

  it("a step added below the wait joins the trigger's route", () => {
    const doc = setWaitRejoin(load(), waitId(load()), false);
    const before = labels(doc);
    const { doc: next } = addStep(doc, "launch", before.length - 1);
    expect(labels(next).slice(-2)).toEqual(["Launch all", "Park at LEFT_PARK"]);
    expect(next.auto!.cards[next.auto!.cards.length - 1].kind).toBe("firstOf");
  });

  it("exports one route per outcome, each parking on its own", () => {
    const doc = settled(setWaitRejoin(load(), waitId(load()), false));
    const result = generateAutoJava({
      auto: doc.auto!,
      startPoint: doc.startPoint,
      lines: doc.lines,
      shapes: doc.shapes,
      settings: settingsOf(doc),
      sourceFileName: "l-partner.pp",
    });
    if (!result.ok) throw new Error(result.errors.join("\n"));
    expect(result.source).toContain('kit.when("CellUp").then(');
    expect(result.source.match(/kit\.guarded\(/g)?.length).toBe(2);
  });
});

describe("parks from each spot", () => {
  const parkedCards = (doc: ProjectDoc): string[] =>
    Object.keys(doc.auto!.parkFrom ?? {});
  const otherwiseDrives = (doc: ProjectDoc): AutoCard[] => {
    const wait = doc.auto!.cards.find((c) => c.kind === "firstOf");
    const row =
      wait?.kind === "firstOf"
        ? wait.rows.find((r) => "afterMs" in r)
        : undefined;
    return (row?.cards ?? []).filter((c) => c.kind === "path" && !c.park);
  };

  it("an Otherwise that goes on: every drive in it has one", () => {
    const doc = settled(load());
    for (const card of otherwiseDrives(doc))
      expect(parkedCards(doc)).toContain(card.id);
  });

  it("an Otherwise that parks: all but its last drive have one", () => {
    const doc = settled(setWaitRejoin(load(), waitId(load()), false));
    const drives = otherwiseDrives(doc);
    for (const card of drives.slice(0, -1))
      expect(parkedCards(doc)).toContain(card.id);
    expect(parkedCards(doc)).not.toContain(drives[drives.length - 1].id);
  });

  it("are checked against the field", () => {
    const doc = settled(load());
    const catalog = buildPathCatalog(
      doc.startPoint,
      doc.lines,
      settingsOf(doc),
    );
    // Something is reported for every drive that has a hit; the call reaches the Otherwise's.
    const hits = stepCollisions(doc, catalog);
    for (const id of hits.keys())
      expect(
        doc.auto!.cards.some((c) => c.id === id) ||
          otherwiseDrives(doc).some((c) => c.id === id),
      ).toBe(true);
  });
});
