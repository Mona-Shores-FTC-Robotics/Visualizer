// The "Our Auto beside a partner" page's core (src/partner/beside.ts): one of our Autos and one
// partner run together by the preview, the contact check, each robot's park and the TIPs.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fallbackValues } from "../src/lib/timing/model";
import {
  drawnPartner,
  robotFromText,
  routeChoices,
  runBeside,
  startHeading,
  strokeWaypoints,
  MAX_THROUGH,
  type Look,
} from "../src/partner/beside";
import {
  displayName,
  EMPTY_STATE,
  parseState,
  stateHash,
} from "../src/partner/load";

const load = (file: string) =>
  robotFromText(
    file.replace(/\.pp$/, ""),
    readFileSync(`${__dirname}/fixtures/partner/${file}`, "utf8"),
  );
const values = fallbackValues();
const plain: Look = { choices: {}, tips: {} };

describe("our Auto beside a partner", () => {
  it("runs R-Solo beside a partner that never moves: parks, no contact", () => {
    const r = runBeside(
      load("r-solo.pp"),
      load("partner-still.pp"),
      plain,
      values,
    );
    expect(r.ends[0].parkedAt).not.toBeNull();
    expect(r.ends[0].parkedAt!).toBeLessThanOrEqual(30);
    expect(r.contact).toBeNull();
    expect(r.tipsInAuto.length).toBeGreaterThan(0);
  });

  it("offers a TIP switch, and a miss changes the TIPs", () => {
    const ours = load("r-solo.pp");
    const partner = load("partner-l-tip-park.pp");
    const r = runBeside(ours, partner, plain, values);
    expect(r.toggles.length).toBeGreaterThan(0);
    const first = r.toggles[0].tip;
    const missed = runBeside(
      ours,
      partner,
      { choices: {}, tips: { [first]: false } },
      values,
    );
    expect(missed.tips[0]?.start ?? Infinity).not.toBe(r.tips[0].start);
  });

  it("finds contact with a partner drawn across our path", () => {
    const ours = load("r-solo.pp");
    // R-Solo leaves RIGHT_START (55.6, 7.7) for RIGHT_AUTO_HIVE (59.2, 20.9): a partner parked on
    // that spot from the start is in the way.
    const blocker = drawnPartner({
      start: { x: 59, y: 30 },
      stroke: [],
      startS: 0,
      shoots: false,
    });
    const r = runBeside(ours, blocker, plain, values);
    expect(r.contact).not.toBeNull();
    expect(r.contact!.t).toBeLessThan(5);
  });

  it("drives a drawn partner along its stroke, after its start time", () => {
    const drawn = drawnPartner({
      start: { x: 62, y: 134 },
      stroke: [
        { x: 50, y: 125 },
        { x: 30, y: 120 },
        { x: 12, y: 118 },
      ],
      startS: 6,
      shoots: false,
    });
    expect(drawn.doc.startPoint.headingDeg).toBe(270);
    const r = runBeside(load("r-solo.pp"), drawn, plain, values);
    const p = r.previews[1];
    expect(p.drives.length).toBe(1);
    expect(p.drives[0].t0).toBeGreaterThanOrEqual(6 - 1e-6);
    expect(r.ends[1].parkedAt).not.toBeNull();
  });

  it("a drawn partner that shoots fires one volley", () => {
    const drawn = drawnPartner({
      start: { x: 62, y: 134 },
      stroke: [{ x: 12, y: 118 }],
      startS: 0,
      shoots: true,
    });
    const r = runBeside(load("r-solo.pp"), drawn, plain, values);
    expect(r.lanes!.robots[1].volleys.length).toBe(1);
  });

  it("lists no route choices for R-Solo", () => {
    expect(routeChoices(load("r-solo.pp").doc.auto!)).toEqual([]);
  });
});

describe("a finger's stroke", () => {
  it("keeps at most a few points, inside the field", () => {
    const stroke = Array.from({ length: 200 }, (_, i) => ({
      x: 20 + i * 0.5,
      y: 70 + 30 * Math.sin(i / 10),
    }));
    const points = strokeWaypoints({ x: 10, y: 70 }, stroke);
    expect(points.length).toBeLessThanOrEqual(MAX_THROUGH + 1);
    expect(points.length).toBeGreaterThan(1);
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(8);
      expect(p.x).toBeLessThanOrEqual(141.5 - 8);
    }
  });

  it("faces a start away from its nearest wall", () => {
    expect(startHeading({ x: 60, y: 9 })).toBe(90);
    expect(startHeading({ x: 60, y: 133 })).toBe(270);
    expect(startHeading({ x: 9, y: 60 })).toBe(0);
    expect(startHeading({ x: 133, y: 60 })).toBe(180);
  });
});

describe("the page's link", () => {
  it("brings a look back", () => {
    const state = {
      ...EMPTY_STATE,
      ours: "r-solo.pp",
      drawn: [
        { x: 12, y: 90 },
        { x: 30.04, y: 95.06 },
      ],
      at: 4.5,
      shoots: true,
      alliance: "blue" as const,
      off: ["Pickup"],
      miss: [2],
    };
    const hash = stateHash(state);
    expect(hash).toBe(
      "#ours=r-solo.pp&draw=12,90;30,95.1&at=4.5&shoots=1&alliance=blue&off=Pickup&miss=2",
    );
    expect(parseState(hash)).toEqual({
      ...state,
      drawn: [
        { x: 12, y: 90 },
        { x: 30, y: 95.1 },
      ],
    });
  });

  it("names a stand-in, and ignores what it cannot read", () => {
    expect(
      parseState("#ours=../x.pp&partner=partners/partner-still.pp&miss=x,3"),
    ).toEqual({
      ...EMPTY_STATE,
      partner: "partners/partner-still.pp",
      miss: [3],
    });
  });

  it("names files as the drive team says them", () => {
    expect(displayName("partners/partner-l-tip-park.pp")).toBe("L tip park");
    expect(displayName("partners/partner-still.pp")).toBe("Still");
    expect(displayName("r-solo.pp")).toBe("R-Solo");
  });
});
