import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { routeFromPp } from "../src/partner/import";
import { decodeRoute, encodeRoute } from "../src/partner/route";

const read = (path: string) =>
  readFileSync(`${import.meta.dirname}/${path}`, "utf8");

describe("a partner's own .pp file as a route", () => {
  it("drives each path in order, with its waits on the match clock, and parks at the end", () => {
    const route = routeFromPp(
      "features.pp",
      read("fixtures/projects/features-1.5.pp"),
    );
    expect(route.name).toBe("features");
    expect(route.start).toMatchObject({ x: 9, y: 60, h: 0 });
    const kinds = route.steps.map((s) => s.kind);
    expect(kinds.filter((k) => k === "drive")).toHaveLength(
      kinds.length - kinds.filter((k) => k === "wait").length,
    );
    // "Drive out" waits 0.75 s after it; the sequence then waits 1 s to spin up.
    expect(kinds.slice(0, 3)).toEqual(["drive", "wait", "wait"]);
    const waits = route.steps.flatMap((s) =>
      s.kind === "wait" ? [s.until] : [],
    );
    expect(waits[1] - waits[0]).toBeCloseTo(1, 1);
    const drives = route.steps.flatMap((s) => (s.kind === "drive" ? [s] : []));
    expect(drives.at(-1)!.park).toBe(true);
    expect(drives.slice(0, -1).every((d) => !d.park)).toBe(true);
  });

  it("turns a file drawn on blue's side onto red's", () => {
    const doc = JSON.parse(read("fixtures/projects/features-1.5.pp"));
    doc.startPoint = { x: 132.5, y: 81.5, headingDeg: 180 };
    const route = routeFromPp("blue.pp", JSON.stringify(doc));
    expect(route.start).toMatchObject({ x: 9, y: 60, h: 0 });
  });

  it("fits in a QR code's link", () => {
    const route = routeFromPp(
      "features.pp",
      read("fixtures/projects/features-1.5.pp"),
    );
    const code = encodeRoute(route);
    expect(decodeRoute(code)).toEqual(route);
    expect(code.length).toBeLessThan(1500);
  });

  it("says what is wrong with a file that is not one", () => {
    expect(() => routeFromPp("notes.pp", "hello")).toThrow(
      /not a Pedro Visualizer file/,
    );
  });
});
