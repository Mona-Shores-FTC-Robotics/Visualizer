import { describe, expect, it } from "vitest";
import { structuredCopy } from "../src/lib/oldBrowsers";

describe("structuredCopy, for tablets without structuredClone", () => {
  it("copies plain data deeply, as structuredClone does", () => {
    const shared = { x: 1 };
    const value = {
      a: [1, "two", null, { b: true }],
      when: new Date(5),
      map: new Map([["k", shared]]),
      set: new Set([shared]),
      again: shared,
    };
    const out = structuredCopy(value);
    expect(out).toEqual(structuredClone(value));
    expect(out.a[3]).not.toBe(value.a[3]);
    expect(out.again).toBe(out.map.get("k"));
  });
});
