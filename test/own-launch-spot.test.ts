// Fork: a spot of an Auto's own that a Launch all fires from faces its CELL once it is made, moved
// or first launched from (teamSpots.ts aimOwnLaunchSpots), as biobuzz's AutoVolleySpotsTest
// requires of every spot an Auto launches from. A file opened as it is stays as it is; a team
// spot, a start and a spot no launch fires from keep their headings.
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/config/defaults";
import { createDefaultProject, robotConfigOf } from "../src/io";
import type { ProjectDoc } from "../src/io/project";
import { TEAM_ROBOT } from "../src/lib/auto/teamRobot";
import { launchSpotHeadingDeg } from "../src/lib/simple/aim";
import { addSpot, addStep, blankAuto } from "../src/lib/simple/steps";
import {
  aimOwnLaunchSpots,
  linkSpot,
  ownSpotsSeen,
} from "../src/lib/team/teamSpots";

const settings = { ...DEFAULT_SETTINGS, ...TEAM_ROBOT };

/** Drives through PASS to CLOSE (R-OutsideLane's RIGHT_AUTO_CLOSE, drawn facing up the field). */
function drives(): ProjectDoc {
  let doc = blankAuto(
    createDefaultProject(robotConfigOf(settings), settings.fieldMap),
  );
  doc = addSpot(doc, "CLOSE", 42.9, 27.7, 90);
  doc = addSpot(doc, "PASS", 30, 60, 90);
  doc = addStep(doc, "drive", doc.auto!.cards.length, "PASS").doc;
  return addStep(doc, "drive", doc.auto!.cards.length, "CLOSE").doc;
}
const launch = (doc: ProjectDoc) =>
  addStep(doc, "launch", doc.auto!.cards.length).doc;

describe("an Auto's own launch spot", () => {
  it("turns to face the CELL once a Launch all fires from it", () => {
    const before = drives();
    const aimed = aimOwnLaunchSpots(launch(before), ownSpotsSeen(before));
    expect(aimed.auto!.points.CLOSE[2]).toBe(launchSpotHeadingDeg(42.9, 27.7));
    expect(aimed.auto!.points.CLOSE[2]).toBeCloseTo(67.8, 1);
    // A spot no launch fires from stays as drawn.
    expect(aimed.auto!.points.PASS[2]).toBe(90);
    // Once aimed, it stays the same document.
    expect(aimOwnLaunchSpots(aimed, ownSpotsSeen(aimed))).toBe(aimed);
  });

  it("turns again when it is moved", () => {
    const before = launch(drives());
    const moved = addSpot(before, "CLOSE", 40.7, 20.4, 90);
    const aimed = aimOwnLaunchSpots(moved, ownSpotsSeen(before));
    expect(aimed.auto!.points.CLOSE[2]).toBe(launchSpotHeadingDeg(40.7, 20.4));
  });

  it("stays as it is in a file just opened", () => {
    const opened = launch(drives());
    expect(aimOwnLaunchSpots(opened, null)).toBe(opened);
    expect(aimOwnLaunchSpots(opened, ownSpotsSeen(opened))).toBe(opened);
  });

  it("leaves a team spot to the team", () => {
    const before = drives();
    const linked = linkSpot(before, "CLOSE", before.auto!.points.CLOSE);
    const aimed = aimOwnLaunchSpots(launch(linked), ownSpotsSeen(linked));
    expect(aimed.auto!.points.CLOSE[2]).toBe(90);
  });
});
