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
import {
  applyTeamSpots,
  changedSpots,
  linkSpot,
  parseTeamSpots,
  reexportWithSpots,
  serializeTeamSpots,
  startSpotFollowsStart,
  teamSpotSave,
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
    expect(parseTeamSpots('{"spots": {"PARK": [1, 2]}}').ok).toBe(false);
  });

  it("links a spot into an Auto, saves it, and unlinks it", () => {
    const doc = linked();
    expect(doc.auto!.teamSpots).toEqual(["LAUNCH_LEFT", "PARK", "START_RIGHT"]);
    const again = parseProject(serializeProject(doc), robotConfigOf(settings));
    expect(again.ok && again.doc.auto!.teamSpots).toEqual([
      "LAUNCH_LEFT",
      "PARK",
      "START_RIGHT",
    ]);
    const own = unlinkSpot(doc, "PARK");
    expect(own.auto!.teamSpots).toEqual(["LAUNCH_LEFT", "START_RIGHT"]);
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
      "TeamCode/src/main/java/org/firstinspires/ftc/teamcode/opmodes/auto/generated/UsesParkAuto.java",
    ]);
    const spots = parseTeamSpots(plan.files["TeamCode/autos/spots.json"]);
    expect(spots.ok && spots.spots.PARK).toEqual([20, 90, 270]);
    expect(spots.ok && spots.spots.LAUNCH_LEFT).toEqual(TEAM.LAUNCH_LEFT);
  });

  it("starts the list when biobuzz has none", async () => {
    const plan = await teamSpotSave(async () => null, [], { PARK: [1, 2, 3] });
    expect(plan.ok && Object.keys(plan.files)).toEqual([
      "TeamCode/autos/spots.json",
    ]);
  });
});

describe("starts as team spots", () => {
  it("moves an Auto's start when its START_ spot moves", () => {
    const doc = linked();
    const moved = applyTeamSpots(doc, { START_RIGHT: [56, 8, 90] });
    expect(moved.startPoint).toMatchObject({ x: 56, y: 8, headingDeg: 90 });
    expect(moved.auto!.points.START_RIGHT).toEqual([56, 8, 90]);
  });

  it("moves an unlocked start spot with the start, and never a locked one", () => {
    let doc = linked();
    doc = {
      ...doc,
      auto: {
        ...doc.auto!,
        startAt: "START_LEFT",
        teamSpots: [...doc.auto!.teamSpots!, "START_LEFT"].sort(),
      },
    };
    const typed = {
      ...doc,
      startPoint: { ...doc.startPoint, x: 63.86, y: 133.78, headingDeg: 270 },
    };
    expect(startSpotFollowsStart(typed, new Set())).toBe(typed);
    const moved = startSpotFollowsStart(typed, new Set(["START_LEFT"]));
    expect(moved.auto!.points.START_LEFT).toEqual([63.86, 133.78, 270]);
    expect(startSpotFollowsStart(moved, new Set(["START_LEFT"]))).toBe(moved);
  });
});
