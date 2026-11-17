// Team spots (src/lib/team/teamSpots.ts): the team's named poses, linked into every Auto that uses
// them, and an Auto re-exported when one changes.
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
import { layOutDoc } from "../src/lib/auto/links";
import { addSpot, addStep, blankAuto } from "../src/lib/simple/steps";
import { spotsUsedBy } from "../src/lib/team/spotUnlock";
import { launchSpotHeadingDeg } from "../src/lib/simple/aim";
import {
  aimMovedLaunchSpots,
  applyTeamSpots,
  changedSpots,
  forkName,
  forkSpot,
  linkSpot,
  parseTeamSpots,
  reexportWithSpots,
  serializeTeamSpots,
  sortSpotEdits,
  startSpotFollowsStart,
  TEAM_SPOTS_JAVA_PATH,
  teamSpotSave,
  teamSpotsJava,
  unlinkSpot,
  type TeamSpots,
} from "../src/lib/team/teamSpots";

const settings = { ...DEFAULT_SETTINGS, ...TEAM_ROBOT };

const TEAM: TeamSpots = {
  LAUNCH_LEFT: [59.9, 127, 270],
  PARK: [14, 100, 270],
};

/** Launch, drive to the team's LAUNCH_LEFT, launch, park at the team's PARK. */
function linked(): ProjectDoc {
  let doc = blankAuto(
    createDefaultProject(robotConfigOf(settings), settings.fieldMap),
  );
  doc = linkSpot(doc, "LAUNCH_LEFT", TEAM.LAUNCH_LEFT);
  doc = linkSpot(doc, "PARK", TEAM.PARK);
  doc = addSpot(doc, "WALL_PICK", 26.71, 47.36, 180);
  const add = (kind: "launch" | "drive" | "park", spot?: string) =>
    (doc = addStep(doc, kind, doc.auto!.cards.length, spot).doc);
  add("launch");
  add("drive", "WALL_PICK");
  add("drive", "LAUNCH_LEFT");
  add("launch");
  add("park", "PARK");
  return layOutDoc(doc, settings);
}

describe("team spots", () => {
  it("reads and writes spots.json, one spot a line", () => {
    const text = serializeTeamSpots(TEAM);
    expect(text).toContain('    "PARK": [14, 100, 270]');
    const back = parseTeamSpots(text);
    expect(back).toEqual({ ok: true, spots: TEAM });
    expect(parseTeamSpots('{"spots": {"park": [1, 2, 3]}}').ok).toBe(false);
    // A park has no heading: it is reached at whatever heading the robot arrives with.
    expect(parseTeamSpots('{"spots": {"PARK": [1, 2]}}')).toEqual({
      ok: true,
      spots: { PARK: [1, 2] },
    });
    expect(parseTeamSpots('{"spots": {"PARK": [1]}}').ok).toBe(false);
  });

  it("links a spot into an Auto, saves it, and unlinks it", () => {
    const doc = linked();
    expect(doc.auto!.teamSpots).toEqual(["LAUNCH_LEFT", "PARK", "RIGHT_START"]);
    const again = parseProject(serializeProject(doc), robotConfigOf(settings));
    expect(again.ok && again.doc.auto!.teamSpots).toEqual([
      "LAUNCH_LEFT",
      "PARK",
      "RIGHT_START",
    ]);
    const own = unlinkSpot(doc, "PARK");
    expect(own.auto!.teamSpots).toEqual(["LAUNCH_LEFT", "RIGHT_START"]);
    expect(own.auto!.points.PARK).toEqual(TEAM.PARK);
  });

  it("keeps a linked copy equal to the team's, turning the drives with it", () => {
    const doc = linked();
    expect(applyTeamSpots(doc, TEAM)).toBe(doc);
    const moved = applyTeamSpots(doc, {
      ...TEAM,
      LAUNCH_LEFT: [60, 120, 250],
    });
    expect(moved.auto!.points.LAUNCH_LEFT).toEqual([60, 120, 250]);
    // WALL_PICK is not a team spot: it stays.
    expect(moved.auto!.points.WALL_PICK).toEqual(doc.auto!.points.WALL_PICK);
    const card = moved.auto!.cards.find(
      (c) =>
        c.kind === "path" && moved.auto!.pathEnds[c.lineId] === "LAUNCH_LEFT",
    )!;
    const line = moved.lines.find(
      (l) => card.kind === "path" && l.id === card.lineId,
    )!;
    expect(line.kind === "atomic" && line.heading).toEqual({
      type: "linear",
      startDeg: 180,
      endDeg: 250,
    });
  });

  it("lists what changed", () => {
    expect(
      changedSpots(TEAM, { ...TEAM, PARK: [14, 101, 270], NEW: [1, 2, 3] }),
    ).toEqual(["NEW", "PARK"]);
  });

  it("re-exports an Auto linked to a changed spot: paths, parks and Java follow", () => {
    const doc = linked();
    const text = serializeProject(doc, { pretty: true });
    const spots = { ...TEAM, PARK: [20, 90, 270] as [number, number, number] };
    expect(
      reexportWithSpots(text, "TeamCode/autos/x.pp", spots, ["NOT_USED"]),
    ).toBeNull();
    const out = reexportWithSpots(text, "TeamCode/autos/x.pp", spots, ["PARK"]);
    expect(out && "ppText" in out, JSON.stringify(out)).toBe(true);
    if (!out || !("ppText" in out)) return;
    const again = parseProject(out.ppText, robotConfigOf(settings));
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    const auto = again.doc.auto!;
    expect(auto.points.PARK).toEqual([20, 90, 270]);
    const catalog = buildPathCatalog(
      again.doc.startPoint,
      again.doc.lines,
      settings,
    );
    // Every path that ends on PARK (the Park step's, and the spots' parks) ends at the new PARK.
    const onPark = Object.entries(auto.pathEnds).filter(
      ([, n]) => n === "PARK",
    );
    expect(onPark.length).toBeGreaterThan(1);
    for (const [id] of onPark)
      expect(catalog.byId.get(id)?.end).toMatchObject({ x: 20, y: 90 });
    expect(out.java).toContain("p.of(20, 90, 270)");
    expect(out.java).not.toContain("p.of(14, 100, 270)");
    expect(out.javaFileName).toBe("XAuto.java");
  });
});

describe("saving team spots", () => {
  it("writes spots.json and re-exports only the Autos that use a changed spot", async () => {
    const uses = serializeProject(linked(), { pretty: true });
    const other = serializeProject(
      blankAuto(
        createDefaultProject(robotConfigOf(settings), settings.fieldMap),
      ),
      { pretty: true },
    );
    const repo: Record<string, string> = {
      "TeamCode/autos/spots.json": serializeTeamSpots(TEAM),
      "TeamCode/autos/uses-park.pp": uses,
      "TeamCode/autos/other.pp": other,
      "TeamCode/autos/README.md": "#",
    };
    const plan = await teamSpotSave(
      async (path) => repo[path] ?? null,
      Object.keys(repo),
      { PARK: [20, 90, 270] },
    );
    expect(plan.ok, JSON.stringify(plan)).toBe(true);
    if (!plan.ok) return;
    expect(plan.autos).toEqual(["uses-park.pp"]);
    expect(Object.keys(plan.files).sort()).toEqual([
      "TeamCode/autos/spots.json",
      "TeamCode/autos/uses-park.pp",
      TEAM_SPOTS_JAVA_PATH,
      "TeamCode/src/main/java/org/firstinspires/ftc/teamcode/opmodes/auto/generated/UsesParkAuto.java",
    ]);
    // The robot code's copy moves with the list, in the same commit.
    expect(plan.files[TEAM_SPOTS_JAVA_PATH]).toContain(
      'public static final TeamSpot PARK = new TeamSpot("PARK", 20.0, 90.0, 270.0);',
    );
    const spots = parseTeamSpots(plan.files["TeamCode/autos/spots.json"]);
    expect(spots.ok && spots.spots.PARK).toEqual([20, 90, 270]);
    expect(spots.ok && spots.spots.LAUNCH_LEFT).toEqual(TEAM.LAUNCH_LEFT);
  });

  it("starts the list when biobuzz has none", async () => {
    const plan = await teamSpotSave(async () => null, [], { PARK: [1, 2, 3] });
    expect(plan.ok && Object.keys(plan.files)).toEqual([
      "TeamCode/autos/spots.json",
      TEAM_SPOTS_JAVA_PATH,
    ]);
  });
});

describe("TeamSpots.java, spots.json's twin in the robot code", () => {
  it("writes one constant a spot, in the list's order, and all()", () => {
    const java = teamSpotsJava({
      RIGHT_START: [55.6, 7.7, 90],
      LEFT_PARK: [14.5, -0.25],
    });
    expect(java).toContain(
      "package org.firstinspires.ftc.teamcode.localization.generated;",
    );
    expect(java).toContain(
      'public static final TeamSpot RIGHT_START = new TeamSpot("RIGHT_START", 55.6, 7.7, 90.0);',
    );
    // No heading: reached at any heading, which biobuzz's TeamSpot reads as NaN.
    expect(java).toContain(
      'public static final TeamSpot LEFT_PARK = new TeamSpot("LEFT_PARK", 14.5, -0.25, Double.NaN);',
    );
    expect(java).toContain("return new TeamSpot[] {LEFT_PARK, RIGHT_START};");
    expect(java.indexOf("LEFT_PARK =")).toBeLessThan(
      java.indexOf("RIGHT_START ="),
    );
    expect(java.endsWith("}\n")).toBe(true);
  });
});

describe("starts as team spots", () => {
  it("moves an Auto's start when its START_ spot moves", () => {
    const doc = linked();
    const moved = applyTeamSpots(doc, { RIGHT_START: [56, 8, 90] });
    expect(moved.startPoint).toMatchObject({ x: 56, y: 8, headingDeg: 90 });
    expect(moved.auto!.points.RIGHT_START).toEqual([56, 8, 90]);
  });

  it("moves an unlocked start spot with the start, and never a locked one", () => {
    let doc = linked();
    doc = {
      ...doc,
      auto: {
        ...doc.auto!,
        startAt: "LEFT_START",
        teamSpots: [...doc.auto!.teamSpots!, "LEFT_START"].sort(),
      },
    };
    const typed = {
      ...doc,
      startPoint: { ...doc.startPoint, x: 63.86, y: 133.78, headingDeg: 270 },
    };
    expect(startSpotFollowsStart(typed, new Set())).toBe(typed);
    const moved = startSpotFollowsStart(typed, new Set(["LEFT_START"]));
    expect(moved.auto!.points.LEFT_START).toEqual([63.86, 133.78, 270]);
    expect(startSpotFollowsStart(moved, new Set(["LEFT_START"]))).toBe(moved);
  });
});

describe("sortSpotEdits", () => {
  // A browser that kept edits from before the 3 Nov rename: three old names, and a moved RIGHT_PARK.
  const edits: TeamSpots = {
    RIGHT_PARK: [9.6, 95.7, 0],
    PARK: [9.6, 95.7, 0],
    LEFT_LAUNCH: [59.4, 129.5, 270],
    SCORING_FLOWER: [47.2, 119.3, 90],
  };
  const saved: TeamSpots = {
    RIGHT_PARK: [14.5, 95.7, 0],
    SCORING_FLOWER_STAGING: [47.2, 119.3, 90],
  };
  const used = new Set(["RIGHT_PARK", "SCORING_FLOWER_STAGING"]);

  it("lists this Auto's changes apart from the rest, and names the ones the team's list lacks", () => {
    expect(sortSpotEdits(edits, used, saved)).toEqual({
      here: ["RIGHT_PARK"],
      elsewhere: ["LEFT_LAUNCH", "PARK", "SCORING_FLOWER"],
      gone: ["LEFT_LAUNCH", "PARK", "SCORING_FLOWER"],
    });
  });

  it("names none as gone while the team's list is not read", () => {
    expect(sortSpotEdits(edits, used, null).gone).toEqual([]);
  });

  it("a change to a spot the list has, but this Auto does not use, is elsewhere and not gone", () => {
    const result = sortSpotEdits({ RIGHT_PARK: [1, 2, 0] }, new Set(), saved);
    expect(result).toEqual({ here: [], elsewhere: ["RIGHT_PARK"], gone: [] });
  });
});

describe("a new spot for this Auto only", () => {
  it("names it after the spot, a start keeping _START", () => {
    expect(forkName("PARK", new Set(["PARK"]))).toBe("PARK_2");
    expect(forkName("PARK", new Set(["PARK", "PARK_2"]))).toBe("PARK_3");
    expect(forkName("RIGHT_START", new Set())).toBe("RIGHT_2_START");
  });

  it("moves every use of the team spot to the new one, where it was", () => {
    const doc = linked();
    const parkLine = doc.auto!.cards.find(
      (c) => c.kind === "path" && doc.auto!.pathEnds[c.lineId] === "PARK",
    );
    expect(parkLine).toBeDefined();
    const out = forkSpot(doc, "PARK", "PARK_2");
    if ("problem" in out) throw new Error(out.problem);
    const auto = out.doc.auto!;
    expect(auto.points.PARK).toBeUndefined();
    expect(auto.points.PARK_2).toEqual(TEAM.PARK);
    expect(auto.teamSpots).toContain("PARK_2");
    expect(auto.teamSpots).not.toContain("PARK");
    expect(Object.values(auto.pathEnds)).not.toContain("PARK");
    expect(Object.values(auto.pathEnds)).toContain("PARK_2");
    // The other team spot is untouched, so moving PARK_2 moves this Auto alone.
    expect(auto.points.LAUNCH_LEFT).toEqual(TEAM.LAUNCH_LEFT);
  });

  it("refuses a name in use, a bad name, or a start without _START", () => {
    const doc = linked();
    expect(forkSpot(doc, "PARK", "LAUNCH_LEFT")).toHaveProperty("problem");
    expect(forkSpot(doc, "PARK", "park 2")).toHaveProperty("problem");
    expect(forkSpot(doc, "PARK", "PARK_START")).toHaveProperty("problem");
    expect(forkSpot(doc, "WALL_PICK", "WALL_PICK_2")).toHaveProperty("problem");
  });

  it("finds the Autos that link a spot", () => {
    const uses = serializeProject(linked(), { pretty: true });
    const found = spotsUsedBy([
      { file: "a.pp", text: uses },
      { file: "b.pp", text: "not json" },
    ]);
    expect(found).toHaveLength(1);
    expect(found[0].spots).toEqual(linked().auto!.teamSpots);
    expect(found[0].spots).toContain("PARK");
  });
});

describe("an Auto launch spot aims itself as it moves", () => {
  it("faces the CELL at its end as biobuzz places the five launch spots", () => {
    // biobuzz TeamCode/autos/spots.json, 16 Nov 2026: AutoLaunchSpotsTest holds them to 0.3°.
    const placed: Record<string, [number, number, number]> = {
      LEFT_AUTO_HIVE: [61.9, 120.4, 268.1],
      LEFT_AUTO_OFFSET: [40.7, 121.1, 298.7],
      RIGHT_AUTO_HIVE: [59.2, 20.9, 96.1],
      RIGHT_AUTO_OFFSET: [32.1, 16.4, 61],
      RIGHT_AUTO_FIX_TIP: [55.3, 25.7, 90],
    };
    for (const [x, y, h] of Object.values(placed))
      expect(launchSpotHeadingDeg(x, y)).toBe(h);
  });

  it("turns an unlocked _AUTO_ spot, and nothing else", () => {
    let doc = linked();
    doc = linkSpot(doc, "LEFT_AUTO_HIVE_2", [50, 120, 0]);
    const unlocked = new Set(["LEFT_AUTO_HIVE_2", "PARK"]);
    const aimed = aimMovedLaunchSpots(doc, unlocked);
    expect(aimed.auto!.points.LEFT_AUTO_HIVE_2[2]).toBe(
      launchSpotHeadingDeg(50, 120),
    );
    expect(aimed.auto!.points.PARK).toEqual(doc.auto!.points.PARK);
    // Already aimed: nothing to do.
    expect(aimMovedLaunchSpots(aimed, unlocked)).toBe(aimed);
    // Locked: the team's list decides, not the drag.
    expect(aimMovedLaunchSpots(doc, new Set())).toBe(doc);
  });
});
