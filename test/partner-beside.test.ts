// The Auto Match Planning page's core (src/partner/beside.ts, route.ts): one of our Autos
// and a partner's Auto as steps, run together by the preview; the contact check, each robot's park,
// the TIPs, and the partner's times ("parked by 15").
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fallbackValues } from "../src/lib/timing/model";
import {
  contactOnly,
  initWait,
  robotFromText,
  routeChoices,
  runBeside,
  smallestFix,
  withInitWait,
  type Look,
} from "../src/partner/beside";
import {
  displayName,
  EMPTY_STATE,
  parseState,
  stateHash,
} from "../src/partner/load";
import {
  arrivals,
  cleanRoute,
  decodeRoute,
  DEFAULT_VOLLEY_S,
  encodeRoute,
  launches,
  PRESETS,
  routeRobot,
  STILL_PRESET,
  withSteps,
  type PartnerRoute,
  type RouteStep,
} from "../src/partner/route";

const load = (file: string) =>
  robotFromText(
    file.replace(/\.pp$/, ""),
    readFileSync(`${__dirname}/fixtures/partner/${file}`, "utf8"),
  );
const values = fallbackValues();
const plain: Look = { choices: {}, tips: {} };
const preset = (name: string) => PRESETS.find((p) => p.name === name)!;
const partner = (route: PartnerRoute) => routeRobot(route, values);

const sitAt = (x: number, y: number, h: number): PartnerRoute => ({
  ...STILL_PRESET,
  name: "",
  start: { x, y, h },
});
type Drive = Extract<RouteStep, { kind: "drive" }>;
type Shoot = Extract<RouteStep, { kind: "shoot" }>;

describe("our Auto beside a partner", () => {
  it("runs R-Solo beside a partner out of the way: parks, no contact", () => {
    const r = runBeside(
      load("r-solo.pp"),
      partner(STILL_PRESET),
      plain,
      values,
    );
    expect(r.ends[0].parkedAt).not.toBeNull();
    expect(r.ends[0].parkedAt!).toBeLessThanOrEqual(30);
    expect(r.ends[1].why).toBe("stays on its start");
    expect(r.contact).toBeNull();
    expect(r.tipsInAuto.length).toBeGreaterThan(0);
  });

  it("offers a TIP switch, and a miss changes the TIPs", () => {
    const ours = load("r-solo.pp");
    const them = partner(preset("L: shoot, FLOWER, shoot, park"));
    const r = runBeside(ours, them, plain, values);
    expect(r.toggles.length).toBeGreaterThan(0);
    const first = r.toggles[0].tip;
    const missed = runBeside(
      ours,
      them,
      { choices: {}, tips: { [first]: false } },
      values,
    );
    expect(missed.tips[0]?.start ?? Infinity).not.toBe(r.tips[0].start);
  });

  it("finds contact with a partner sitting in our way", () => {
    // R-Solo leaves RIGHT_START (55.6, 7.7) for RIGHT_AUTO_HIVE (59.2, 20.9).
    const r = runBeside(
      load("r-solo.pp"),
      partner(sitAt(59, 30, 90)),
      plain,
      values,
    );
    expect(r.contact).not.toBeNull();
    expect(r.contact!.t).toBeLessThan(5);
  });

  it("lists no route choices for R-Solo", () => {
    expect(routeChoices(load("r-solo.pp").doc.auto!)).toEqual([]);
  });
});

describe("the page's stand-ins", () => {
  it("are the ones the team asked for, and none broken down or idle by a wall", () => {
    expect(PRESETS.map((p) => p.name)).toEqual([
      "L: shoot, park",
      "L: shoot, FLOWER, shoot, park",
      "L-NoCross",
      "R: shoot, park",
      "R-NoCross",
      "Corner and park",
      "Still: out of the way",
    ]);
  });

  it("park on their own side: a left start at LEFT_PARK, a right start at RIGHT_PARK", () => {
    for (const p of PRESETS) {
      const park = p.steps.find(
        (s): s is Drive => s.kind === "drive" && s.park,
      );
      if (!park) continue;
      const left = p.start.y > 70.75;
      expect(park.to, p.name).toEqual(
        left ? { x: 14.5, y: 117.4, h: 0 } : { x: 14.5, y: 98.7, h: 0 },
      );
    }
  });

  it("all run beside R-Solo, each drive and shot in turn", () => {
    const ours = load("r-solo.pp");
    for (const p of PRESETS) {
      const r = runBeside(ours, partner(p), plain, values, false);
      const drives = p.steps.filter((s) => s.kind === "drive").length;
      const shots = p.steps.filter((s) => s.kind === "shoot").length;
      expect(r.previews[1].drives, p.name).toHaveLength(drives);
      expect(Object.keys(launches(r.previews[1])), p.name).toHaveLength(shots);
      if (drives) expect(r.ends[1].parkedAt, p.name).not.toBeNull();
      expect(r.previews[1].guard, p.name).toBeNull();
    }
  });
});

describe("a partner's times", () => {
  const shootPark = preset("L: shoot, park");
  const timed = (at: number | null, by: number | null, volleyS = 3.5) => ({
    ...shootPark,
    volleyS,
    steps: [
      { kind: "shoot", at } as Shoot,
      { ...(shootPark.steps[1] as Drive), by },
    ],
  });
  const run = (route: PartnerRoute) =>
    runBeside(load("r-solo.pp"), partner(route), plain, values, false)
      .previews[1];

  it("shoots when they say, its last ball out a volley later", () => {
    const shot = launches(run(timed(5, null)))[0];
    expect(shot.t0).toBeCloseTo(5, 1);
    expect(shot.t1).toBeCloseTo(5 + DEFAULT_VOLLEY_S, 1);
    const quick = launches(run(timed(5, null, 1.5)))[0];
    expect(quick.t1).toBeCloseTo(6.5, 1);
  });

  it("parks by the time it says: it leaves just in time", () => {
    expect(arrivals(run(timed(null, 15)))[1]).toBeCloseTo(15, 1);
    expect(arrivals(run(timed(5, 22)))[1]).toBeCloseTo(22, 1);
  });

  it("goes at once with no time, and arrives late when it cannot make it", () => {
    const soon = arrivals(run(timed(null, null)))[1];
    expect(soon).toBeLessThan(15);
    expect(arrivals(run(timed(null, 1)))[1]).toBeCloseTo(soon, 1);
  });

  it("they wait: every time moves later by the delay", () => {
    const base = timed(5, 20);
    const later = run({ ...base, delayS: 2 });
    expect(launches(later)[0].t0).toBeCloseTo(7, 1);
    expect(arrivals(later)[1]).toBeCloseTo(22, 1);
  });

  it("a bend curves the drive: it goes through the bend point", () => {
    const straight = run(timed(null, null));
    const bent = run({
      ...timed(null, null),
      steps: [
        { kind: "shoot", at: null },
        { ...(shootPark.steps[1] as Drive), bend: { x: 40, y: 100 } },
      ],
    });
    // Longer way round: it takes longer to get there.
    expect(arrivals(bent)[1]).toBeGreaterThan(arrivals(straight)[1] + 0.2);
  });
});

describe("what avoids contact", () => {
  it("finds the smallest delay for them, in half seconds", () => {
    let calls = 0;
    expect(
      smallestFix((extra) => {
        calls++;
        return extra < 2;
      }, 6),
    ).toBe(2);
    expect(calls).toBe(4);
    expect(smallestFix(() => true, 3)).toBeNull();
  });

  it("they waiting moves a partner out of our way", () => {
    // A partner crossing R-Solo's path at RIGHT_AUTO_HIVE (59.2, 20.9) in its first seconds
    // touches it at 1.0 s; 2 s later, R-Solo has gone on to the WALL FLOWER.
    const crossing: PartnerRoute = {
      ...STILL_PRESET,
      name: "",
      start: { x: 100, y: 22, h: 180 },
      steps: [
        {
          kind: "drive",
          to: { x: 30, y: 22, h: 180 },
          bend: null,
          by: null,
          park: true,
        },
      ],
    };
    const ours = load("r-solo.pp");
    expect(contactOnly(ours, partner(crossing), plain, values)).not.toBeNull();
    const fix = smallestFix(
      (extra) =>
        contactOnly(
          ours,
          partner({ ...crossing, delayS: extra }),
          plain,
          values,
        ) !== null,
      6,
    );
    expect(fix).toBe(2);
  });

  it("reads and sets our Auto's INIT wait (none in R-Solo)", () => {
    const solo = load("r-solo.pp");
    expect(initWait(solo.doc.auto!)).toBeNull();
    expect(withInitWait(solo, 12)).toBe(solo);
  });
});

describe("editing and keeping a route", () => {
  it("keeps one park, the last drive", () => {
    const d = (x: number, park: boolean): Drive => ({
      kind: "drive",
      to: { x, y: 110, h: 0 },
      bend: null,
      by: null,
      park,
    });
    const r = withSteps(STILL_PRESET, [
      d(30, true),
      { kind: "shoot", at: null },
      d(12, true),
    ]);
    expect(r.steps.map((s) => (s.kind === "drive" ? s.park : null))).toEqual([
      false,
      null,
      true,
    ]);
  });

  it("goes through a link and a saved file unchanged; junk reads as nothing", () => {
    const route = {
      ...preset("L: shoot, FLOWER, shoot, park"),
      volleyS: 2,
      delayS: 1.5,
    };
    expect(decodeRoute(encodeRoute(route))).toEqual(route);
    expect(cleanRoute(JSON.parse(JSON.stringify(route)))).toEqual(route);
    expect(cleanRoute({ start: { x: 1 }, steps: [] })).toBeNull();
    expect(cleanRoute({ ...route, steps: [{ kind: "fly" }] })).toBeNull();
    expect(decodeRoute("not a route")).toBeNull();
  });

  it("reads the library's form: a shot's own volley sets the route's", () => {
    const r = cleanRoute({
      name: "X",
      start: { x: 62.3, y: 133.8, h: 270 },
      steps: [
        { kind: "shoot", at: 5, volleyS: 2 },
        {
          kind: "drive",
          to: { x: 14.5, y: 117.4, h: 0 },
          bend: { x: 40, y: 125 },
          by: 20,
          park: true,
        },
      ],
    })!;
    expect(r.volleyS).toBe(2);
    expect(r.delayS).toBe(0);
    expect(r.steps[0]).toEqual({ kind: "shoot", at: 5 });
    expect((r.steps[1] as Drive).bend).toEqual({ x: 40, y: 125 });
  });

  it("keeps every spot inside the field", () => {
    const r = cleanRoute({
      name: "X",
      start: { x: -20, y: 400, h: 450 },
      steps: [],
    })!;
    expect(r.start).toEqual({ x: 7.7, y: 133.8, h: 90 });
  });
});

describe("the page's link", () => {
  it("brings a look back", () => {
    const state = {
      ...EMPTY_STATE,
      ours: "r-solo.pp",
      partner: { ...preset("L: shoot, park"), name: "X" },
      alliance: "blue" as const,
      off: ["Pickup"],
      miss: [2],
      event: "USMIFRQ2",
      team: 11228,
      match: "Q12",
    };
    const hash = stateHash(state);
    expect(hash).toMatch(
      /^#event=USMIFRQ2&team=11228&match=Q12&ours=r-solo\.pp&partner=[\w-]+&alliance=blue&off=Pickup&miss=2$/,
    );
    expect(parseState(hash)).toEqual(state);
  });

  it("ignores what it cannot read", () => {
    expect(parseState("#ours=../x.pp&partner=%%%&miss=x,3&match=Z9")).toEqual({
      ...EMPTY_STATE,
      miss: [3],
    });
  });

  it("names our Autos as the drive team says them", () => {
    expect(displayName("r-solo.pp")).toBe("R-Solo");
    expect(displayName("l-left-under-hive.pp")).toBe("L-Left-Under-Hive");
  });
});
