// Fork: a spot of an Auto's own that a Launch all fires from faces its CELL by itself
// (teamSpots.ts aimOwnLaunchSpots), as biobuzz's AutoVolleySpotsTest requires of every spot an
// Auto launches from. A team spot, a start and a spot no launch fires from keep their headings.
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/config/defaults";
import { createDefaultProject, robotConfigOf } from "../src/io";
import type { ProjectDoc } from "../src/io/project";
import { TEAM_ROBOT } from "../src/lib/auto/teamRobot";
import { launchSpotHeadingDeg } from "../src/lib/simple/aim";
import { addSpot, addStep, blankAuto } from "../src/lib/simple/steps";
import { aimOwnLaunchSpots, linkSpot } from "../src/lib/team/teamSpots";

const settings = { ...DEFAULT_SETTINGS, ...TEAM_ROBOT };

function auto(): ProjectDoc {
  let doc = blankAuto(
    createDefaultProject(robotConfigOf(settings), settings.fieldMap),
  );
  // R-OutsideLane's RIGHT_AUTO_CLOSE, drawn facing straight up the field.
  doc = addSpot(doc, "CLOSE", 42.9, 27.7, 90);
  doc = addSpot(doc, "PASS", 30, 60, 90);
  doc = addStep(doc, "drive", doc.auto!.cards.length, "PASS").doc;
  doc = addStep(doc, "drive", doc.auto!.cards.length, "CLOSE").doc;
  return addStep(doc, "launch", doc.auto!.cards.length).doc;
}

describe("an Auto's own launch spot", () => {
  it("turns to face the CELL at its end", () => {
    const aimed = aimOwnLaunchSpots(auto());
    expect(aimed.auto!.points.CLOSE[2]).toBe(launchSpotHeadingDeg(42.9, 27.7));
    expect(aimed.auto!.points.CLOSE[2]).toBeCloseTo(67.8, 1);
  });

  it("leaves a spot no launch fires from as drawn", () => {
    expect(aimOwnLaunchSpots(auto()).auto!.points.PASS[2]).toBe(90);
  });

  it("is the same document once aimed", () => {
    const aimed = aimOwnLaunchSpots(auto());
    expect(aimOwnLaunchSpots(aimed)).toBe(aimed);
  });

  it("leaves a team spot to the team", () => {
    const doc = auto();
    const linked = linkSpot(doc, "CLOSE", doc.auto!.points.CLOSE);
    expect(aimOwnLaunchSpots(linked).auto!.points.CLOSE[2]).toBe(90);
  });
});
