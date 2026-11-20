// The Auto Match Planning page's core (src/partner/beside.ts, route.ts): one of our Autos
// and a partner's Auto as steps, run together by the preview; the contact check, each robot's park,
// the TIPs, and the partner's times ("parked by 15").
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fallbackValues } from "../src/lib/timing/model";
import {
  robotFromText,
  routeChoices,
  runBeside,
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
  encodeRoute,
  PRESETS,
  routeRobot,
  STILL_PRESET,
  withSteps,
  type PartnerRoute,
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
    const blocker = { name: "", start: { x: 59, y: 30, h: 90 }, steps: [] };
    const r = runBeside(load("r-solo.pp"), partner(blocker), plain, values);
    expect(r.contact).not.toBeNull();
    expect(r.contact!.t).toBeLessThan(5);
  });

  it("runs every stand-in; none of them is broken down", () => {
    const ours = load("r-solo.pp");
    for (const p of PRESETS) {
      expect(p.name).not.toMatch(/broken/i);
      const r = runBeside(ours, partner(p), plain, values);
      const drives = p.steps.filter((s) => s.kind === "drive").length;
      expect(r.previews[1].drives, p.name).toHaveLength(drives);
      if (drives) expect(r.ends[1].parkedAt, p.name).not.toBeNull();
    }
  });

  it("lists no route choices for R-Solo", () => {
    expect(routeChoices(load("r-solo.pp").doc.auto!)).toEqual([]);
  });
});

describe("a partner's times", () => {
  const shootPark = preset("L: shoot, park");
  const parkBy = (by: number | null) =>
    withSteps(shootPark, [
      shootPark.steps[0],
      {
        ...(shootPark.steps[1] as Extract<
          (typeof shootPark.steps)[1],
          { kind: "drive" }
        >),
        by,
      },
    ]);
  const arrival = (route: PartnerRoute) =>
    arrivals(
      runBeside(load("r-solo.pp"), partner(route), plain, values).previews[1],
    )[1];

  it("arrives by the time it says: it leaves just in time", () => {
    expect(arrival(parkBy(15))).toBeCloseTo(15, 1);
    expect(arrival(parkBy(22))).toBeCloseTo(22, 1);
  });

  it("goes at once with no time, and arrives late when it cannot make it", () => {
    const soon = arrival(parkBy(null));
    expect(soon).toBeLessThan(15);
    expect(arrival(parkBy(1))).toBeCloseTo(soon, 1);
  });

  it("waits until the time a wait step says", () => {
    const r = runBeside(
      load("r-solo.pp"),
      partner(preset("L: park at 15 s")),
      plain,
      values,
    );
    expect(r.previews[1].drives[0].t0).toBeGreaterThanOrEqual(15 - 1e-6);
  });
});

describe("editing and keeping a route", () => {
  it("keeps one park, the last drive", () => {
    const r = withSteps(STILL_PRESET, [
      { kind: "drive", to: { x: 30, y: 120, h: 0 }, by: null, park: true },
      { kind: "shoot" },
      { kind: "drive", to: { x: 12, y: 110, h: 0 }, by: 20, park: true },
    ]);
    expect(r.steps.map((s) => (s.kind === "drive" ? s.park : null))).toEqual([
      false,
      null,
      true,
    ]);
  });

  it("goes through a link and a saved file unchanged; junk reads as nothing", () => {
    const route = preset("L: shoot, FLOWER, shoot, park");
    expect(decodeRoute(encodeRoute(route))).toEqual(route);
    expect(cleanRoute(JSON.parse(JSON.stringify(route)))).toEqual(route);
    expect(cleanRoute({ start: { x: 1 }, steps: [] })).toBeNull();
    expect(cleanRoute({ ...route, steps: [{ kind: "fly" }] })).toBeNull();
    expect(decodeRoute("not a route")).toBeNull();
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

describe("a partner runs its own Auto", () => {
  it("is never parked early by our robot's endgame guard", () => {
    // With the team's slower timing the guard would cut this one's FLOWER leg at 11 s.
    const slow = { ...values };
    for (const key of Object.keys(slow))
      if (/launch|volley|pick/i.test(key) && typeof slow[key] === "number")
        slow[key] = slow[key] * 1.5;
    const route = PRESETS.find(
      (p) => p.name === "L: shoot, FLOWER, shoot, park",
    )!;
    const r = runBeside(
      load("r-solo.pp"),
      routeRobot(route, slow),
      plain,
      slow,
    );
    expect(r.previews[1].guard).toBeNull();
    expect(Object.keys(arrivals(r.previews[1])).map(Number)).toEqual([
      0, 2, 4, 6,
    ]);
  });
});
