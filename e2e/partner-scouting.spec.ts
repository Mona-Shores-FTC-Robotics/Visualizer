import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Fork: the partner page's match menu and saved plans, on a phone. FTCScout's answers are real ones
// recorded on 20 Nov 2026 (Belding, with its schedule; Fruitport, before its schedule was posted);
// biobuzz's files and the scouting branch are faked.

const FIXTURES = `${import.meta.dirname}/../test/fixtures/partner`;
const AUTOS = ["r-solo.pp"];

/** RoboSquires' (18975) two Autos, as they told us at Belding. */
const ROUTE_X = {
  name: "X",
  start: { x: 62.3, y: 133.8, h: 270 },
  steps: [
    { kind: "shoot" },
    { kind: "drive", to: { x: 12, y: 104, h: 0 }, by: 14, park: true },
  ],
};
const ROUTE_Y = {
  name: "Y",
  start: { x: 38.3, y: 133.8, h: 270 },
  steps: [{ kind: "drive", to: { x: 9.8, y: 99.4, h: 0 }, by: 20, park: true }],
};
const LIBRARY = {
  version: 1,
  season: 2026,
  teams: {
    "18975": {
      X: {
        route: ROUTE_X,
        savedBy: "pit-scout",
        savedAt: "2026-11-07T15:00:00.000Z",
      },
      Y: {
        route: ROUTE_Y,
        savedBy: "pit-scout",
        savedAt: "2026-11-07T15:05:00.000Z",
      },
    },
  },
};

/** Belding's saved plans: Q1's partner, 18975, runs its X. */
const BELDING_PLANS = {
  version: 1,
  season: 2026,
  event: "USMIBEQ",
  plans: {
    "18975": {
      team: 18975,
      match: null,
      ours: "r-solo.pp",
      off: [],
      partner: ROUTE_X,
      notes: "Shoots preloads, then parks in the corner",
      savedBy: "pit-scout",
      savedAt: "2026-11-07T15:00:00.000Z",
    },
  },
};

interface Fake {
  /** Every commit's files (path → content), in order. */
  commits: Record<string, string>[];
}

async function serve(page: Page): Promise<Fake> {
  const fake: Fake = { commits: [] };
  // FTCScout's answers were recorded on 20 Nov 2026: the page picks the event by today's date.
  await page.clock.setFixedTime(new Date("2026-11-20T12:00:00"));
  const scoutingFiles: Record<string, string> = {
    "scouting/2026/USMIBEQ.json": JSON.stringify(BELDING_PLANS),
    "scouting/2026/partners.json": JSON.stringify(LIBRARY),
  };
  // The inbox's sheet: empty, so no test reads the real one.
  await page.route("https://docs.google.com/spreadsheets/**", (route) =>
    route.fulfill({
      contentType: "text/csv",
      body: "Timestamp,Team Number,Auto Link",
    }),
  );
  await page.route("https://api.ftcscout.org/graphql", (route) => {
    const body = route.request().postDataJSON();
    const file = body.query.includes("teamByNumber")
      ? "events"
      : body.variables.code;
    return route.fulfill({
      contentType: "application/json",
      body: readFileSync(`${FIXTURES}/ftcscout/${file}.json`, "utf8"),
    });
  });
  await page.route("https://raw.githubusercontent.com/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const scouting = path.match(/\/scouting\/(scouting\/.+)$/);
    if (scouting) {
      const text = scoutingFiles[scouting[1]];
      return text
        ? route.fulfill({ body: text })
        : route.fulfill({ status: 404, body: "" });
    }
    const name = path.split("/").pop()!;
    if (!AUTOS.includes(name)) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ body: readFileSync(`${FIXTURES}/${name}`, "utf8") });
  });
  await page.route("https://api.github.com/**", (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const json = (body: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (path === "/user") return json({ login: "pit-scout" });
    if (path.endsWith("/contents/TeamCode/autos"))
      return json(AUTOS.map((name) => ({ name, type: "file" })));
    if (path.endsWith("/contents/TeamCode/autos/partners")) return json([]);
    const contents = path.match(/\/contents\/(scouting\/.+)$/);
    if (contents) {
      const text = scoutingFiles[decodeURIComponent(contents[1])];
      return text
        ? route.fulfill({ body: text })
        : route.fulfill({ status: 404, body: "" });
    }
    if (path.endsWith("/git/ref/heads/scouting"))
      return json({ object: { sha: "c1" } });
    if (path.includes("/git/commits/") && method === "GET")
      return json({ tree: { sha: "t1" } });
    if (path.endsWith("/git/trees")) {
      const files: Record<string, string> = {};
      for (const entry of route.request().postDataJSON().tree) {
        files[entry.path] = entry.content;
        scoutingFiles[entry.path] = entry.content;
      }
      fake.commits.push(files);
      return json({ sha: "t2" });
    }
    if (path.endsWith("/git/commits")) return json({ sha: "c2" });
    if (path.endsWith("/git/refs/heads/scouting")) return json({});
    return route.fulfill({ status: 404, body: "" });
  });
  return fake;
}

test.use({ viewport: { width: 390, height: 800 }, hasTouch: true });

test("a match from FTCScout opens its partner's saved plan", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await serve(page);
  await page.goto("/partner.html#event=USMIBEQ");
  const q1 = page.getByRole("button", { name: /^Q1\b/ });
  await expect(q1).toBeVisible();
  // Q1: 20245 with 18975, on Blue; a plan is saved for 18975.
  await expect(q1).toContainText("20245 + 18975");
  await expect(q1).toContainText("✓");
  await q1.click();
  await expect(page.getByText(/Plan saved by pit-scout/)).toBeVisible();
  await expect(page.getByLabel("Notes")).toHaveValue(
    "Shoots preloads, then parks in the corner",
  );
  await expect(page.locator('button[data-alliance="blue"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // Its X parks by 14 s, as saved.
  await expect(page.locator(".tile").nth(2)).toContainText("14.0 s");
  await expect(page).toHaveURL(/event=USMIBEQ&team=18975&match=Q1/);
  // Both of their known Autos lead their picture cards: Y parks by 20 s.
  const theirs = page.getByRole("group", { name: "Their Autos" });
  await expect(
    theirs.getByRole("button", { name: "18975 · X" }),
  ).toHaveAttribute("aria-pressed", "true");
  await theirs.getByRole("button", { name: "18975 · Y" }).click();
  await expect(page.locator(".tile").nth(2)).toContainText("20.0 s");
  await expect(page.getByText("Not saved")).toBeVisible();
  // Without a token, saving asks for one.
  await expect(
    page.getByRole("button", { name: "Connect GitHub to save" }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBe(0);
  expect(errors).toEqual([]);
});

test("before the schedule: pick a team, set their Auto from a stand-in, name it, save", async ({
  page,
}) => {
  const fake = await serve(page);
  await page.addInitScript(() =>
    localStorage.setItem("githubToken", "test-token"),
  );
  await page.goto("/partner.html#event=USMIFRQ2");
  await expect(
    page.getByRole("option", { name: "Pick a team (no schedule yet)" }),
  ).toBeAttached();
  await page.getByLabel("Partner team").selectOption("11228");
  await expect(page.getByText("No plan yet")).toBeVisible();

  // Their Auto first: the picture that looks like theirs, named what they call it; then ours.
  await page.getByRole("button", { name: "L: shoot, park" }).click();
  await page.getByLabel("Name").fill("X");
  await page.getByRole("button", { name: /^R-Solo/ }).click();
  await page.getByLabel("Notes").fill("Starts left, parks by the wall");
  await expect(page.getByText("Not saved")).toBeVisible();
  await page.getByRole("button", { name: "Save for 11228" }).click();
  await expect(
    page.getByText(/Saved for the team at Fruitport Qualifier/),
  ).toBeVisible();
  await expect(page.getByText("Not saved")).toHaveCount(0);

  const commit = fake.commits.at(-1)!;
  const saved = JSON.parse(commit["scouting/2026/USMIFRQ2.json"]);
  expect(saved.plans["11228"]).toMatchObject({
    team: 11228,
    match: null,
    chosen: 0,
    notes: "Starts left, parks by the wall",
    savedBy: "pit-scout",
    options: [
      {
        ours: "r-solo.pp",
        partner: { name: "X", start: { x: 62.3, y: 133.8, h: 270 } },
      },
    ],
  });
  // In the same commit, X joins 11228's known Autos, beside 18975's, and leads its cards.
  const library = JSON.parse(commit["scouting/2026/partners.json"]);
  expect(Object.keys(library.teams)).toEqual(["11228", "18975"]);
  expect(library.teams["11228"].X.route.steps).toEqual(
    saved.plans["11228"].options[0].partner.steps,
  );
  await expect(
    page
      .getByRole("group", { name: "Their Autos" })
      .getByRole("button", { name: "11228 · X" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("an old Android tablet, without AbortSignal.timeout or structuredClone, still gets the match menu", async ({
  page,
}) => {
  await page.addInitScript(() => {
    // Chrome before 103 (and Safari before 16) has neither.
    delete (AbortSignal as { timeout?: unknown }).timeout;
    delete (globalThis as { structuredClone?: unknown }).structuredClone;
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await serve(page);
  await page.goto("/partner.html#event=USMIBEQ");
  const q1 = page.getByRole("button", { name: /^Q1\b/ });
  await expect(q1).toBeVisible();
  await q1.click();
  await expect(page.getByText(/Plan saved by pit-scout/)).toBeVisible();
  await page.getByRole("button", { name: "Another option" }).click();
  await expect(page.getByText(/Could not reach FTCScout/)).toHaveCount(0);
  expect(errors).toEqual([]);
});
