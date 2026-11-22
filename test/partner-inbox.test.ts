import { describe, expect, it } from "vitest";
import {
  formLink,
  inboxHash,
  parseCsv,
  parseTimestamp,
  readInbox,
} from "../src/partner/inbox";
import { parseState, stateHash } from "../src/partner/load";
import { PRESETS } from "../src/partner/route";

const SITE =
  "https://mona-shores-ftc-robotics.github.io/Visualizer/partner.html";
const route = PRESETS[0];
const link = (team: number, base = SITE) =>
  `${base}${stateHash({
    ours: "r-solo.pp",
    partner: route,
    alliance: "red",
    off: [],
    miss: [],
    event: null,
    team,
    match: null,
  })}`;
const csv = (rows: string[][]) =>
  [["Timestamp", "Team Number", "Auto Link"], ...rows]
    .map((r) => r.map((f) => `"${f.replace(/"/g, '""')}"`).join(","))
    .join("\r\n");

describe("the form link", () => {
  it("fills in the team number and the Auto link, encoded", () => {
    const url = new URL(formLink(12345, link(12345)));
    expect(url.origin + url.pathname).toBe(
      "https://docs.google.com/forms/d/e/1FAIpQLSfVC3cvg-UW4qLBcPC3HufUKP9LTTeLcwltSwo6pkPAhGrW0g/viewform",
    );
    expect(url.searchParams.get("usp")).toBe("pp_url");
    expect(url.searchParams.get("entry.1253318350")).toBe("12345");
    expect(url.searchParams.get("entry.1690950498")).toBe(link(12345));
    // The link's own # and & do not leak into the form's query.
    expect(url.hash).toBe("");
  });
});

describe("the CSV", () => {
  it("reads quoted fields, doubled quotes and line breaks inside quotes", () => {
    expect(parseCsv('a,"b,c","d ""e""\nf"\r\n1,2,3\n')).toEqual([
      ["a", "b,c", 'd "e"\nf'],
      ["1", "2", "3"],
    ]);
  });
  it("reads Google's timestamps", () => {
    expect(parseTimestamp("11/22/2026 14:03:05")).toBe(
      new Date(2026, 10, 22, 14, 3, 5).getTime(),
    );
    expect(parseTimestamp("yesterday")).toBeNull();
  });
});

describe("the inbox's rows", () => {
  it("lists partners' Autos newest first", () => {
    const entries = readInbox(
      csv([
        ["11/22/2026 10:00:00", "111", link(111)],
        ["11/22/2026 12:30:00", "222", link(222)],
        ["11/21/2026 9:15:00", "333", link(333)],
      ]),
    );
    expect(entries.map((e) => e.team)).toEqual([222, 111, 333]);
    expect(entries[0].name).toBe("L: SHOOT PARK");
    const state = parseState(entries[0].hash);
    expect(state.team).toBe(222);
    expect(state.ours).toBe("r-solo.pp");
    expect(state.partner?.steps).toHaveLength(route.steps.length);
  });

  it("an empty sheet is an empty inbox", () => {
    expect(readInbox("Timestamp,Team Number,Auto Link")).toEqual([]);
    expect(readInbox("")).toEqual([]);
  });

  it("leaves out anything that is not our own link with an Auto in it", () => {
    const rows = [
      ["11/22/2026 10:00:00", "abc", link(1)],
      ["11/22/2026 10:00:00", "0", link(1)],
      ["11/22/2026 10:00:00", "123456", link(1)],
      [
        "11/22/2026 10:00:00",
        "12",
        "https://evil.example/partner.html#r=1$X$1/1/1$3.5$0$",
      ],
      [
        "11/22/2026 10:00:00",
        "12",
        `${SITE.replace("partner", "index")}#r=1$X$1/1/1$3.5$0$`,
      ],
      ["11/22/2026 10:00:00", "12", "javascript:alert(1)//partner.html#r=1"],
      ["11/22/2026 10:00:00", "12", `${SITE}#ours=r-solo.pp`],
      ["11/22/2026 10:00:00", "12", `${SITE}#r=<img src=x onerror=alert(1)>`],
      ["11/22/2026 10:00:00", "12", "not a link"],
    ];
    expect(readInbox(csv(rows))).toEqual([]);
  });

  it("keeps only what our code writes from a link, never the row's text", () => {
    const sneaky = `${link(5)}&event=<script>&ours=x"><b>.pp`;
    const hash = inboxHash(sneaky, 5)!;
    expect(hash).not.toMatch(/[<>"]/);
    expect(parseState(hash).event).toBeNull();
    // A name with markup in an older JSON link comes back as plain capitals.
    const old = `${SITE}#partner=${btoa(
      JSON.stringify({ ...route, name: "<img src=x onerror=alert(1)>" }),
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")}`;
    const entry = readInbox(csv([["", "7", old]]))[0];
    expect(entry.name).not.toMatch(/[<>=]/);
    expect(entry.hash).not.toMatch(/[<>]/);
  });

  it("takes links from the page it is on, too", () => {
    const local = "http://localhost:4317/partner.html";
    expect(inboxHash(link(9, local), 9)).toBeNull();
    expect(
      inboxHash(link(9, local), 9, "http://localhost:4317/partner.html"),
    ).not.toBeNull();
  });
});
