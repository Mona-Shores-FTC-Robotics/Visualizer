import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Fork: the partner page's match menu and saved plans, on a phone. FTCScout's answers are real ones
// recorded on 20 Nov 2026 (Belding, with its schedule; Fruitport, before its schedule was posted);
// biobuzz's files and the scouting branch are faked.

const FIXTURES = `${import.meta.dirname}/../test/fixtures/partner`;
const AUTOS = ["r-solo.pp"];
const PARTNERS = [
  "partner-still.pp",
  "partner-l-tip-park.pp",
  "partner-park-1.pp",
];

/** Belding's saved plans: Q1's partner, 18975, drawn from the left wall. */
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
      partner: {
        kind: "drawn",
        points: [
          [62, 133],
          [40, 115],
          [12, 104],
        ],
        startS: 3,
        shoots: true,
      },
      notes: "Shoots preloads, then parks in the corner",
      savedBy: "pit-scout",
      savedAt: "2026-11-07T15:00:00.000Z",
    },
  },
};

interface Fake {
  /** Every file content a commit wrote, in order. */
  commits: string[];
}

async function serve(page: Page): Promise<Fake> {
  const fake: Fake = { commits: [] };
  const scoutingFiles: Record<string, string> = {
    "scouting/2026/USMIBEQ.json": JSON.stringify(BELDING_PLANS),
  };
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
    if (![...AUTOS, ...PARTNERS].includes(name))
      return route.fulfill({ status: 404, body: "" });
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
    if (path.endsWith("/contents/TeamCode/autos/partners"))
      return json(PARTNERS.map((name) => ({ name, type: "file" })));
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
      const tree = route.request().postDataJSON().tree[0];
      fake.commits.push(tree.content);
      scoutingFiles[tree.path] = tree.content;
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
  await expect(page.locator(".tile").nth(2)).toContainText(/\d+\.\d s/);
  await expect(page).toHaveURL(/event=USMIBEQ&team=18975&match=Q1/);
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

test("before the schedule: pick a team, draw them, add notes, save for the team", async ({
  page,
}) => {
  const fake = await serve(page);
  await page.addInitScript(() =>
    localStorage.setItem("githubToken", "test-token"),
  );
  await page.goto("/partner.html#event=USMIFRQ2");
  await expect(
    page.getByText("No match schedule on FTCScout yet"),
  ).toBeVisible();
  await page.getByLabel("Partner team").selectOption("11228");
  await expect(page.getByText("No plan yet")).toBeVisible();

  await page.getByRole("button", { name: "Draw 11228 on the field" }).click();
  const canvas = page.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const at = (x: number, y: number) => ({
    clientX: box.x + (x / 141.5) * box.width,
    clientY: box.y + ((141.5 - y) / 141.5) * box.height,
  });
  const touch = { pointerId: 1, pointerType: "touch", isPrimary: true };
  await canvas.dispatchEvent("pointerdown", { ...touch, ...at(62, 133) });
  await canvas.dispatchEvent("pointermove", { ...touch, ...at(30, 110) });
  await canvas.dispatchEvent("pointerup", { ...touch, ...at(30, 110) });

  await page.getByLabel("Notes").fill("Starts left, parks by the wall");
  await expect(page.getByText("Not saved")).toBeVisible();
  await page.getByRole("button", { name: "Save for 11228" }).click();
  await expect(
    page.getByText(/Saved for the team at Fruitport Qualifier/),
  ).toBeVisible();
  await expect(page.getByText("Not saved")).toHaveCount(0);

  const saved = JSON.parse(fake.commits.at(-1)!);
  expect(saved.plans["11228"]).toMatchObject({
    team: 11228,
    match: null,
    ours: "r-solo.pp",
    notes: "Starts left, parks by the wall",
    savedBy: "pit-scout",
    partner: { kind: "drawn" },
  });
  expect(saved.plans["11228"].partner.points).toHaveLength(2);
});
