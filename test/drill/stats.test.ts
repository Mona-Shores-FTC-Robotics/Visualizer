import { describe, expect, test } from "vitest";
import { DrillSession } from "../../src/drill/session";
import { summarize } from "../../src/drill/history";
import {
  ROW_COLUMNS,
  outbox,
  rowFromRun,
  rowFromStored,
  sendRows,
  sheetUrl,
  type StatsRow,
  TEAM_SHEET_URL,
} from "../../src/drill/stats";
import { CONTROLS, rapier } from "./helpers";

// The team sheet: a finished run becomes one row with who drove it, and goes to the sheet's Apps
// Script web app; what can't go waits in this browser's outbox.

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
  key() {
    return null;
  }
  get length() {
    return this.m.size;
  }
}
const mem = () => new MemStorage() as unknown as Storage;
const URL = "https://script.google.com/macros/s/TEST/exec";

async function finishedRun() {
  const s = new DrillSession(await rapier(), CONTROLS, 20245, "two", 1);
  s.openingAuto = null;
  s.start();
  s.advance(121);
  return s.result("2026-11-24T05:00:00.000Z");
}

describe("the team sheet", () => {
  test("a finished run is one row with who drove it, in the sheet's column order", async () => {
    const r = await finishedRun();
    const row = rowFromRun(
      r,
      { driver: " Sam ", operator: "Alex" },
      "laptop-x",
    );
    expect(row.driver).toBe("Sam");
    expect(row.operator).toBe("Alex");
    expect(row.robot).toBe("20245");
    expect(row.players).toBe("driver + operator");
    expect(row.match).toBe("2:00");
    expect(row.totalTips).toBe(r.tips);
    expect(row.reached7).toBe("no");
    expect(row.id).toBe("laptop-x-2026-11-24T05:00:00.000Z");
    expect(Object.keys(row).sort()).toEqual([...ROW_COLUMNS].sort());
    // The saved history keeps the names too.
    expect(summarize(r, { driver: "Sam" }).driver).toBe("Sam");
  }, 60000);

  test("rows go in one text/plain POST; the same run is never sent twice", async () => {
    const storage = mem();
    const posts: {
      url: string;
      body: { columns: string[]; rows: StatsRow[] };
    }[] = [];
    const fetcher = (async (url: string, init: RequestInit) => {
      expect(init.method).toBe("POST");
      expect(init.mode).toBe("no-cors");
      posts.push({ url, body: JSON.parse(String(init.body)) });
      return new Response(null);
    }) as unknown as typeof fetch;
    const r = await finishedRun();
    const row = rowFromRun(r, { driver: "Sam", operator: "" }, "laptop-x");
    const a = await sendRows([row], { url: URL, fetcher, storage });
    expect(a).toEqual({ sent: 1, waiting: 0, url: URL });
    expect(posts[0].url).toBe(URL);
    expect(posts[0].body.columns).toEqual(ROW_COLUMNS);
    expect(posts[0].body.rows[0].driver).toBe("Sam");
    const b = await sendRows([row], { url: URL, fetcher, storage });
    expect(b.sent).toBe(0);
    expect(posts).toHaveLength(1);
  }, 60000);

  test("offline or with no sheet, rows wait in the outbox and go with the next send", async () => {
    const storage = mem();
    const r = await finishedRun();
    const row = rowFromRun(r, { driver: "Sam", operator: "" }, "laptop-x");
    // No sheet set up: kept.
    expect(await sendRows([row], { url: "", storage })).toEqual({
      sent: 0,
      waiting: 1,
      url: "",
    });
    // Offline: still kept.
    const down = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    expect(
      (await sendRows([], { url: URL, fetcher: down, storage })).waiting,
    ).toBe(1);
    expect(outbox(storage)).toHaveLength(1);
    // Back online: it goes, and the outbox empties.
    let got = 0;
    const up = (async (_u: string, init: RequestInit) => {
      got = JSON.parse(String(init.body)).rows.length;
      return new Response(null);
    }) as unknown as typeof fetch;
    expect(await sendRows([], { url: URL, fetcher: up, storage })).toEqual({
      sent: 1,
      waiting: 0,
      url: URL,
    });
    expect(got).toBe(1);
    expect(outbox(storage)).toHaveLength(0);
  }, 60000);

  test("a run saved before names were asked sends what it kept, under the same id", async () => {
    const r = await finishedRun();
    const saved = summarize(r);
    const row = rowFromStored(saved, "laptop-x");
    expect(row.id).toBe(
      rowFromRun(r, { driver: "", operator: "" }, "laptop-x").id,
    );
    expect(row.driver).toBe("");
    expect(row.totalTips).toBe(saved.tips);
    expect(row.source).toBe("saved on this laptop");
  }, 60000);

  test("the team's sheet by default; ?stats=<url> points this browser at another; only Apps Script URLs are taken", () => {
    const storage = mem();
    // The team's sheet, with nothing set in this browser.
    expect(sheetUrl("", storage)).toBe(TEAM_SHEET_URL);
    expect(TEAM_SHEET_URL).toMatch(
      /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/,
    );
    expect(sheetUrl(`?stats=${encodeURIComponent(URL)}`, storage)).toBe(URL);
    expect(sheetUrl("", storage)).toBe(URL); // remembered
    expect(sheetUrl("?stats=https://example.com/x", storage)).toBe("");
  });
});
