import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import jsQR from "jsqr";
import { encodeRoute } from "../src/partner/route";

// Fork: the Auto Match Planning page (partner.html), on a phone, with biobuzz master's files served
// from test/fixtures/partner instead of GitHub, and FTCScout's answers recorded there too. The
// partner is one of the page's stand-ins, edited as steps.

const FIXTURES = `${import.meta.dirname}/../test/fixtures/partner`;
const AUTOS = ["r-solo.pp"];

async function serveBiobuzz(page: Page) {
  // FTCScout's answers were recorded on 20 Nov 2026: the page picks the event by today's date.
  await page.clock.setFixedTime(new Date("2026-11-20T12:00:00"));
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
  await page.route("https://api.github.com/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const names = path.endsWith("/autos") ? AUTOS : [];
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(names.map((name) => ({ name, type: "file" }))),
    });
  });
  await page.route("https://raw.githubusercontent.com/**", (route) => {
    const name = new URL(route.request().url()).pathname.split("/").pop()!;
    if (!AUTOS.includes(name)) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ body: readFileSync(`${FIXTURES}/${name}`, "utf8") });
  });
}

test.use({ viewport: { width: 390, height: 800 }, hasTouch: true });

test("their Auto first, then ours on top: contact, parks, TIPs", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await serveBiobuzz(page);
  await page.goto("/partner.html");
  // A first visit: nothing of ours yet, so no answer tiles; their Autos as pictures.
  const cards = page.getByRole("group", { name: "Their Autos" });
  await expect(cards.getByRole("button")).toHaveCount(7);
  await expect(page.locator(".tile")).toHaveCount(0);
  await expect(cards.getByRole("button", { name: /broken|wall/i })).toHaveCount(
    0,
  );

  await cards.getByRole("button", { name: "L: SUPER FLOWER (turret)" }).click();
  await expect(
    cards.getByRole("button", { name: "L: SUPER FLOWER (turret)" }),
  ).toHaveAttribute("aria-pressed", "true");
  // The SUPER FLOWER says when it fires its eight (once TIP 1 is in), its last ball and the CELL.
  await expect(
    page.getByText(/^Shoots \d+\.\d s · last ball \d+\.\d s · CELL settled/),
  ).toBeVisible();

  await page.getByRole("button", { name: /^R-Solo/ }).click();
  await expect(page.locator(".tile").first()).toContainText(
    /Contact\s*\d+\.\d s/,
  );
  await expect(page).toHaveURL(/[#&]ours=r-solo\.pp&r=1\$/);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBe(0);
  expect(errors).toEqual([]);
});

test("their Auto edited: a shot time, a park time, a spot dragged; the link keeps it", async ({
  page,
}) => {
  await serveBiobuzz(page);
  await page.goto("/partner.html#ours=r-solo.pp");
  const cards = page.getByRole("group", { name: "Their Autos" });
  await cards.getByRole("button", { name: "L: shoot, park" }).click();
  await expect(page.getByText("Parks at 1")).toBeVisible();

  /** Steps the `n`th time stepper to `target` seconds. */
  async function setTime(n: number, target: number) {
    const value = page.locator(".time .value").nth(n);
    // "any time" (a drive) or "CELL up" (a shot): tap for a time first.
    if (!/\d/.test((await value.textContent()) ?? "")) await value.click();
    for (let i = 0; i < 60; i++) {
      const v = Number.parseFloat((await value.textContent()) ?? "0");
      if (Math.abs(v - target) < 0.01) return;
      await page
        .locator(".time")
        .nth(n)
        .getByRole("button", { name: v < target ? "Later" : "Earlier" })
        .click();
    }
  }
  // They shoot at 4 s: last ball out a 3.5 s volley later.
  await setTime(0, 4);
  await expect(
    page.getByText(/^Shoots 4\.0 s · last ball 7\.5 s/),
  ).toBeVisible();
  // Parked by 20 s: it leaves just in time.
  await setTime(1, 20);
  await expect(page.getByText("There 20.0 s")).toBeVisible();
  await expect(page.locator(".tile").nth(2)).toContainText("20.0 s");

  // Move the park spot down the wall: drag marker 1.
  await page.getByRole("button", { name: "Move spots on the field" }).click();
  const canvas = page.getByLabel(/^The field/);
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const at = (x: number, y: number) => ({
    clientX: box.x + (x / 141.5) * box.width,
    clientY: box.y + ((141.5 - y) / 141.5) * box.height,
  });
  const touch = { pointerId: 1, pointerType: "touch", isPrimary: true };
  const before = page.url();
  await canvas.dispatchEvent("pointerdown", { ...touch, ...at(14.5, 117.4) });
  await canvas.dispatchEvent("pointermove", { ...touch, ...at(14, 105) });
  await canvas.dispatchEvent("pointerup", { ...touch, ...at(14, 105) });
  await expect.poll(() => page.url()).not.toBe(before);
  await page.getByRole("button", { name: "Done moving spots" }).click();
  await expect(page.getByText("There 20.0 s")).toBeVisible();

  // Reloading the link brings the edited partner back.
  const url = page.url();
  await page.reload();
  expect(page.url()).toBe(url);
  await expect(page.getByText("There 20.0 s")).toBeVisible();
});

test("options: a second one to compare, marked as the one we go with", async ({
  page,
}) => {
  await serveBiobuzz(page);
  await page.goto("/partner.html#ours=r-solo.pp");
  const cards = page.getByRole("group", { name: "Their Autos" });
  await cards.getByRole("button", { name: "L: SUPER FLOWER (turret)" }).click();
  const tabs = page.getByRole("group", { name: "Options" });
  await tabs.getByRole("button", { name: "Another option" }).click();
  await expect(tabs.getByRole("button", { name: /^B/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // B: they run something else; A keeps its own.
  await cards.getByRole("button", { name: "Still: out of the way" }).click();
  await expect(page.locator(".tile").first()).toContainText("None");
  await tabs.getByRole("button", { name: "☆ Go with this" }).click();
  await expect(tabs.getByRole("button", { name: /^B ★/ })).toBeVisible();
  await tabs.getByRole("button", { name: "A", exact: true }).click();
  await expect(
    cards.getByRole("button", { name: "L: SUPER FLOWER (turret)" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".tile").first()).toContainText(/Contact\s*\d/);
  // Where no delay helps, the page says so.
  await expect(page.getByText("No delay up to 6 s avoids it")).toBeVisible();

  // A partner crossing R-Solo's first drive: waiting 2 s clears it, and the page says so.
  const crossing = {
    name: "",
    start: { x: 100, y: 22, h: 180 },
    steps: [
      {
        kind: "drive" as const,
        to: { x: 30, y: 22, h: 180 },
        bend: null,
        by: null,
        park: true,
      },
    ],
    volleyS: 3.5,
    delayS: 0,
  };
  await page.goto(
    `/partner.html#ours=r-solo.pp&partner=${encodeRoute(crossing)}`,
  );
  // Only the fragment changed: load it.
  await page.reload();
  const fix = page.getByRole("button", { name: /^No contact if they wait/ });
  await expect(fix).toHaveText("No contact if they wait +2.0 s");
  await fix.click();
  await expect(page.locator(".tile").first()).toContainText("None");
});

test("a tablet that cannot reach GitHub's file server reads our Autos from the site's copy", async ({
  page,
}) => {
  await page.route("https://api.ftcscout.org/graphql", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: readFileSync(`${FIXTURES}/ftcscout/events.json`, "utf8"),
    }),
  );
  // The pit tablets: GitHub fails outright, as an untrusted certificate does.
  await page.route("https://api.github.com/**", (route) => route.abort());
  await page.route("https://raw.githubusercontent.com/**", (route) =>
    route.abort(),
  );
  // The copy the Pages workflow writes (scripts/mirror-biobuzz.mjs).
  await page.route("**/mirror/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/master/TeamCode/autos/contents.json"))
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(AUTOS.map((name) => ({ name, type: "file" }))),
      });
    const name = path.split("/").pop()!;
    if (path.includes("/master/TeamCode/autos/") && AUTOS.includes(name))
      return route.fulfill({
        body: readFileSync(`${FIXTURES}/${name}`, "utf8"),
      });
    return route.fulfill({ status: 404, body: "" });
  });
  await page.goto("/partner.html");
  await page
    .getByRole("group", { name: "Their Autos" })
    .getByRole("button", { name: "L: shoot, park" })
    .click();
  await page.getByRole("button", { name: /^R-Solo/ }).click();
  await expect(page.locator(".tile").first()).toContainText(/Contact/);
  await expect(page.getByText(/Could not reach GitHub/)).toHaveCount(0);
});

test("a partner opens share.html, loads their .pp beside ours, and the link brings it to us", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await serveBiobuzz(page);
  await page.goto("/share.html");
  await expect(
    page.getByRole("heading", { name: "Plan our Auto together" }),
  ).toBeVisible();
  // Nothing of our scouting on their page.
  await expect(page.getByLabel("Partner team")).toHaveCount(0);
  await expect(page.getByText("Put in your team number first.")).toBeVisible();

  await page.getByLabel("Team number").fill("12345");
  await page
    .locator('input[type="file"]')
    .setInputFiles(
      `${import.meta.dirname}/../test/fixtures/projects/features-1.5.pp`,
    );
  await expect(page.getByLabel("Name")).toHaveValue("features-1.5");
  await page.getByRole("button", { name: /^R-Solo/ }).click();
  await expect(page.locator(".tile").first()).toContainText(/Contact/);
  await expect(
    page.getByRole("img", { name: "QR code of your Auto for Mona Shores" }),
  ).toBeVisible();

  // The link in the QR code: our planning page, their team and Auto beside R-Solo.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy the link" }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(
    /\/partner\.html#team=12345&ours=r-solo\.pp&r=1\$FEATURES-1\.5\$/,
  );

  // The QR code reads back as that link, as our scanner reads it.
  const pixels = await page.evaluate(async () => {
    const svg = document.querySelector(".qr svg")!.outerHTML;
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 800;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, 800, 800);
    context.drawImage(image, 0, 0, 800, 800);
    return Array.from(context.getImageData(0, 0, 800, 800).data);
  });
  expect(jsQR(Uint8ClampedArray.from(pixels), 800, 800)?.data).toBe(copied);

  await page.goto(copied.replace(/^https?:\/\/[^/]+/, ""));
  await expect(
    page.getByRole("heading", { name: "Auto Match Planning" }),
  ).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveValue("FEATURES-1.5");
  await expect(page.getByRole("button", { name: /^R-Solo/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(errors).toEqual([]);
});
