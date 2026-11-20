import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Fork: the "Beside a partner" page (partner.html), on a phone, with biobuzz master's files served
// from test/fixtures/partner instead of GitHub.

const FIXTURES = `${import.meta.dirname}/../test/fixtures/partner`;
const AUTOS = ["r-solo.pp"];
const PARTNERS = [
  "partner-still.pp",
  "partner-l-tip-park.pp",
  "partner-park-1.pp",
];

async function serveBiobuzz(page: Page) {
  await page.route("https://api.github.com/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const names = path.endsWith("/partners") ? PARTNERS : AUTOS;
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(names.map((name) => ({ name, type: "file" }))),
    });
  });
  await page.route("https://raw.githubusercontent.com/**", (route) => {
    const name = new URL(route.request().url()).pathname.split("/").pop()!;
    if (![...AUTOS, ...PARTNERS].includes(name))
      return route.fulfill({ status: 404, body: "" });
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
  // A first visit: R-Solo beside the stand-in that stays out of the way.
  await expect(page.locator(".tile").first()).toContainText("None");
  await expect(page).toHaveURL(
    /#ours=r-solo\.pp&partner=partners\/partner-still\.pp/,
  );

  await page.getByRole("button", { name: "L tip park" }).click();
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

test("a partner drawn with a finger runs, and the link keeps it", async ({
  page,
}) => {
  await serveBiobuzz(page);
  await page.goto("/partner.html#ours=r-solo.pp");
  await expect(page.locator(".tile").first()).toBeVisible();
  await page.getByRole("button", { name: "Draw it" }).click();
  await expect(page.getByText("Lift to finish")).toBeVisible();

  const canvas = page.locator("canvas");
  const box = (await canvas.boundingBox())!;
  const at = (x: number, y: number) => ({
    clientX: box.x + (x / 141.5) * box.width,
    clientY: box.y + ((141.5 - y) / 141.5) * box.height,
  });
  const touch = { pointerId: 1, pointerType: "touch", isPrimary: true };
  await canvas.dispatchEvent("pointerdown", { ...touch, ...at(62, 133) });
  for (const [x, y] of [
    [50, 120],
    [30, 110],
    [12, 104],
  ])
    await canvas.dispatchEvent("pointermove", { ...touch, ...at(x, y) });
  await canvas.dispatchEvent("pointerup", { ...touch, ...at(12, 104) });

  await expect(page).toHaveURL(/draw=/);
  await expect(page.locator(".tile").nth(2)).toContainText(/\d+\.\d s/);
  // Reloading the link brings the drawing back.
  await page.reload();
  await expect(page.locator(".tile").nth(2)).toContainText(/\d+\.\d s/);
});
