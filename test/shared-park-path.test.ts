// Fork: a spot's park path that a step also drives. In biobuzz's l-under-hive.pp the drive to
// LEFT_AUTO_HIVE parks along l-left-abort-park, and the Park in "LEFT up before 9 s"'s Otherwise
// drives that same path. Opening the Auto in the builder (parkFrom.ts withSpotParks) used to drop
// the drive's spot park and delete the path with it, leaving that Park with no path and no spot.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/config/defaults";
import { parseProject, robotConfigOf } from "../src/io";
import type { ProjectDoc } from "../src/io/project";
import { buildPathCatalog } from "../src/lib/auto/geometry";
import { allCards } from "../src/lib/auto/tree";
import { withSpotParks } from "../src/lib/simple/parkFrom";
import { everyStep, stepsOf } from "../src/lib/simple/steps";

function load(): ProjectDoc {
  const loaded = parseProject(
    readFileSync("test/fixtures/autos/l-under-hive.pp", "utf8"),
    robotConfigOf(DEFAULT_SETTINGS),
  );
  if (!loaded.ok) throw new Error(loaded.error);
  return loaded.doc;
}

function opened(doc: ProjectDoc): ProjectDoc {
  return withSpotParks(
    doc,
    buildPathCatalog(doc.startPoint, doc.lines, DEFAULT_SETTINGS),
  );
}

describe("a park path a step also drives", () => {
  it("keeps every path a step drives", () => {
    const doc = load();
    const after = opened(doc);
    const ids = new Set(after.lines.map((line) => line.id));
    for (const card of allCards(doc.auto!.cards))
      if (card.kind === "path") expect(ids, card.id).toContain(card.lineId);
  });

  it("keeps the abort Park on LEFT_PARK", () => {
    const park = everyStep(stepsOf(opened(load()))).find(
      (step) => step.cardId === "card-l-left-abort-park",
    );
    expect(park?.kind).toBe("park");
    expect(park?.spot).toBe("LEFT_PARK");
  });
});
