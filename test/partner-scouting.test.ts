// @vitest-environment happy-dom
// The partner page's match menu (src/partner/ftcscout.ts) and the team's saved plans
// (src/partner/scouting.ts), with FTCScout's and GitHub's answers faked.
import { afterEach, describe, expect, it, vi } from "vitest";
import { currentEvent, ourMatches, seasonOf } from "../src/partner/ftcscout";
import {
  emptyPlans,
  knownAutos,
  parseLibrary,
  parsePlans,
  planFor,
  planKey,
  savePlan,
  serializePlans,
  type PlanRecord,
} from "../src/partner/scouting";

const team = (alliance: string, station: string, teamNumber: number) => ({
  alliance,
  station,
  teamNumber,
});

describe("our matches from FTCScout", () => {
  it("finds each match one of our teams plays, its alliance and partner", () => {
    const matches = ourMatches([
      {
        matchNum: 4,
        series: 0,
        tournamentLevel: "Quals",
        scheduledStartTime: "2026-11-07T16:21:00.000Z",
        teams: [
          team("Red", "One", 19429),
          team("Red", "Two", 7911),
          team("Blue", "One", 23410),
          team("Blue", "Two", 26153),
        ],
      },
      {
        matchNum: 1,
        series: 0,
        tournamentLevel: "Quals",
        scheduledStartTime: null,
        teams: [
          team("Red", "One", 16464),
          team("Red", "Two", 32190),
          team("Blue", "One", 20245),
          team("Blue", "Two", 18975),
        ],
      },
      {
        matchNum: 2,
        series: 0,
        tournamentLevel: "Quals",
        scheduledStartTime: null,
        teams: [team("Red", "One", 1), team("Blue", "One", 2)],
      },
      {
        matchNum: 2,
        series: 3,
        tournamentLevel: "DoubleElim",
        scheduledStartTime: null,
        teams: [team("Blue", "One", 20245), team("Blue", "Two", 11228)],
      },
    ]);
    expect(matches.map((m) => [m.key, m.us, m.alliance, m.partner])).toEqual([
      ["Q1", 20245, "blue", 18975],
      ["Q4", 19429, "red", 7911],
      ["P3-2", 20245, "blue", 11228],
    ]);
  });

  it("opens the event on now, else the next, else the last", () => {
    const events = [
      { code: "A", name: "A", start: "2026-11-06", end: "2026-11-07" },
      { code: "B", name: "B", start: "2026-11-20", end: "2026-11-21" },
      { code: "C", name: "C", start: "2026-12-10", end: "2026-12-12" },
    ];
    expect(currentEvent(events, "2026-11-21")?.code).toBe("B");
    expect(currentEvent(events, "2026-11-25")?.code).toBe("C");
    expect(currentEvent(events, "2027-01-01")?.code).toBe("C");
  });

  it("knows the season from the date", () => {
    expect(seasonOf(new Date("2026-11-20T12:00:00"))).toBe(2026);
    expect(seasonOf(new Date("2027-03-01T12:00:00"))).toBe(2026);
    expect(seasonOf(new Date("2027-09-12T12:00:00"))).toBe(2027);
  });
});

const plan = (t: number, match: string | null, notes = ""): PlanRecord => ({
  team: t,
  match,
  ours: "r-solo.pp",
  off: [],
  partner: {
    name: "X",
    start: { x: 62.3, y: 133.8, h: 270 },
    steps: [
      { kind: "shoot" },
      { kind: "drive", to: { x: 9.8, y: 117.4, h: 0 }, by: 15, park: true },
    ],
  },
  notes,
  savedBy: "someone",
  savedAt: "2026-11-20T15:00:00.000Z",
});

describe("the team's plans", () => {
  it("round-trip through the file, dropping what they cannot read", () => {
    const plans = emptyPlans(2026, "USMIFRQ2");
    plans.plans[planKey(11228, null)] = plan(11228, null, "starts left");
    plans.plans[planKey(11228, "Q12")] = plan(11228, "Q12");
    const text = serializePlans(plans).replace(
      '"plans": {',
      '"plans": { "junk": { "team": "x" },',
    );
    const back = parsePlans(text, 2026, "USMIFRQ2");
    expect(back).toEqual(plans);
    expect(back.plans["11228"].partner).toEqual(plan(11228, null).partner);
  });

  it("a match's own plan wins in that match; the team's holds elsewhere", () => {
    const plans = emptyPlans(2026, "E");
    plans.plans["11228"] = plan(11228, null, "team");
    plans.plans["11228@Q12"] = plan(11228, "Q12", "match");
    expect(planFor(plans, 11228, "Q12")?.notes).toBe("match");
    expect(planFor(plans, 11228, "Q20")?.notes).toBe("team");
    expect(planFor(plans, 11228, null)?.notes).toBe("team");
    expect(planFor(plans, 5290, "Q12")).toBeNull();
  });
});

describe("saving a plan to GitHub", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  /** A fake biobuzz: the scouting branch, its files, and someone else saving once mid-save. */
  function fakeGitHub(options: { otherSaveFirst: boolean }) {
    let head = "c1";
    let file: string | null = serializePlans({
      ...emptyPlans(2026, "E"),
      plans: { "5290": plan(5290, null, "theirs") },
    });
    let library: string | null = null;
    let interfere = options.otherSaveFirst;
    const commits: Record<string, string>[] = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url).pathname;
      const method = init?.method ?? "GET";
      const ok = (body: unknown) =>
        new Response(typeof body === "string" ? body : JSON.stringify(body));
      if (path === "/user") return ok({ login: "scout" });
      if (path.endsWith("/git/ref/heads/scouting"))
        return ok({ object: { sha: head } });
      if (path.includes("/contents/scouting/2026/E.json"))
        return file === null ? new Response("", { status: 404 }) : ok(file);
      if (path.includes("/contents/scouting/2026/partners.json"))
        return library === null
          ? new Response("", { status: 404 })
          : ok(library);
      if (path.includes("/git/commits/") && method === "GET")
        return ok({ tree: { sha: "t" } });
      if (path.endsWith("/git/trees")) {
        const body = JSON.parse(String(init!.body));
        commits.push(
          Object.fromEntries(
            body.tree.map((e: { path: string; content: string }) => [
              e.path,
              e.content,
            ]),
          ),
        );
        return ok({ sha: "t2" });
      }
      if (path.endsWith("/git/commits")) return ok({ sha: "c2" });
      if (path.endsWith("/git/refs/heads/scouting") && method === "PATCH") {
        if (interfere) {
          // Someone else saved 11855 a moment before us.
          interfere = false;
          head = "c1b";
          const now = parsePlans(file!, 2026, "E");
          now.plans["11855"] = plan(11855, null, "other scout");
          file = serializePlans(now);
          return new Response(JSON.stringify({ message: "not fast forward" }), {
            status: 422,
          });
        }
        const last = commits[commits.length - 1];
        file = last["scouting/2026/E.json"] ?? file;
        library = last["scouting/2026/partners.json"] ?? library;
        head = "c2";
        return ok({});
      }
      return new Response("", { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);
    return { file: () => file, library: () => library, fetchMock };
  }

  const mine = {
    team: 11228,
    match: null,
    ours: "r-solo.pp",
    off: [],
    partner: plan(11228, null).partner,
    notes: "ours",
  };

  it("adds our plan beside the plans already there", async () => {
    localStorage.setItem("githubToken", "t");
    const gh = fakeGitHub({ otherSaveFirst: false });
    const saved = await savePlan(2026, "E", "11228", mine, "Event");
    expect(Object.keys(saved.plans.plans).sort()).toEqual(["11228", "5290"]);
    expect(saved.plans.plans["11228"].savedBy).toBe("scout");
    expect(parsePlans(gh.file()!, 2026, "E")).toEqual(saved.plans);
    // Its Auto, named X, is now one of 11228's known Autos, for the next event too.
    const known = parseLibrary(gh.library()!, 2026);
    expect(known).toEqual(saved.library);
    expect(knownAutos(known, 11228).map((k) => k.route)).toEqual([
      mine.partner,
    ]);
  });

  it("someone saving at the same moment loses nothing: it reads again and retries", async () => {
    localStorage.setItem("githubToken", "t");
    const gh = fakeGitHub({ otherSaveFirst: true });
    const saved = await savePlan(2026, "E", "11228", mine, "Event");
    expect(Object.keys(saved.plans.plans).sort()).toEqual([
      "11228",
      "11855",
      "5290",
    ]);
    expect(Object.keys(parsePlans(gh.file()!, 2026, "E").plans).sort()).toEqual(
      ["11228", "11855", "5290"],
    );
  });

  it("asks for the token before anything", async () => {
    await expect(savePlan(2026, "E", "1", mine, "Event")).rejects.toThrow(
      /Connect GitHub/,
    );
  });
});
