import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Fork: the "Beside a partner" page (partner.html), on a phone, with biobuzz master's files served
// from test/fixtures/partner instead of GitHub, and FTCScout's answers recorded there too. The
// partner is one of the page's stand-ins, edited as steps.

const FIXTURES = `${import.meta.dirname}/../test/fixtures/partner`;
const AUTOS = ["r-solo.pp"];

async function serveBiobuzz(page: Page) {
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

test("runs our Auto beside a stand-in and says whether they touch", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await serveBiobuzz(page);
  await page.goto("/partner.html");
  // A first visit: R-Solo beside the stand-in that stays out of the way, and no broken-down one.
  await expect(page.locator(".tile").first()).toContainText("None");
  // The link names them (after the event the match menu opened on, whichever it is today).
  await expect(page).toHaveURL(/[#&]ours=r-solo\.pp&partner=[\w-]+/);

  await expect(page.getByRole("button", { name: /broken/i })).toHaveCount(0);
  await page
    .getByRole("button", { name: "L: shoot, FLOWER, shoot, park" })
    .click();
  await expect(page.locator(".tile").first()).toContainText(
    /Contact\s*\d+\.\d s/,
  );
  await expect(page.getByText("What happens")).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBe(0);
  expect(errors).toEqual([]);
});

test("a stand-in edited: a spot dragged, a park time set, and the link keeps it", async ({
  page,
}) => {
  await serveBiobuzz(page);
  await page.goto("/partner.html#ours=r-solo.pp");
  await expect(page.locator(".tile").first()).toBeVisible();
  await page.getByRole("button", { name: "L: shoot, park" }).click();
  await expect(page.getByText("Parks at 1")).toBeVisible();

  // Park by 20 s: it leaves just in time and gets there then.
  await page.getByRole("button", { name: "any time" }).click();
  for (let i = 0; i < 40; i++) {
    const value = await page.locator(".time .value").first().textContent();
    if (value?.trim() === "20.0 s") break;
    const n = Number.parseFloat(value ?? "0");
    await page
      .getByRole("button", { name: n < 20 ? "Later" : "Earlier" })
      .first()
      .click();
  }
  await expect(page.getByText("Gets there at 20.0 s")).toBeVisible();
  await expect(page.locator(".tile").nth(2)).toContainText("20.0 s");

  // Move the park spot: drag marker 1 down the wall.
  await page.getByRole("button", { name: "Move spots on the field" }).click();
  const canvas = page.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const at = (x: number, y: number) => ({
    clientX: box.x + (x / 141.5) * box.width,
    clientY: box.y + ((141.5 - y) / 141.5) * box.height,
  });
  const touch = { pointerId: 1, pointerType: "touch", isPrimary: true };
  const before = page.url();
  await canvas.dispatchEvent("pointerdown", { ...touch, ...at(9.8, 117.4) });
  await canvas.dispatchEvent("pointermove", { ...touch, ...at(12, 100) });
  await canvas.dispatchEvent("pointerup", { ...touch, ...at(12, 100) });
  await expect.poll(() => page.url()).not.toBe(before);
  await page.getByRole("button", { name: "Done moving spots" }).click();
  await expect(page.getByText("Gets there at 20.0 s")).toBeVisible();

  // Reloading the link brings the edited partner back.
  const url = page.url();
  await page.reload();
  expect(page.url()).toBe(url);
  await expect(page.getByText("Gets there at 20.0 s")).toBeVisible();
});
