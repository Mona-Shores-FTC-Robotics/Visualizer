import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Fork: the Auto Builder on top of the Visualizer.

const SAMPLE = "/#sample=red-garden-basic";

async function openSample(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(SAMPLE);
  await expect(page.getByText("16 cards")).toBeVisible();
  return errors;
}

const card = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: false }).filter({ hasText: name });
const inspectorName = (page: Page) =>
  page.getByLabel("Inspector").getByLabel("Name");
const cardCount = async (page: Page) =>
  Number((await page.getByText(/\d+ cards?/).textContent())?.match(/\d+/)?.[0]);

test("a sample link opens its Auto, previewed against the 30 s budget", async ({
  page,
}) => {
  const errors = await openSample(page);
  await expect(page.getByText(/of 30 s/)).toBeVisible();
  await expect(page.getByText("Shared copy")).toBeVisible();
  expect(errors).toEqual([]);
});

test("selecting a path card puts its path in the inspector", async ({
  page,
}) => {
  await openSample(page);
  await card(page, "ToRearShot").first().click();
  await expect(inspectorName(page)).toHaveValue("ToRearShot");
});

test("+ Path adds a path and the card that drives it, in one undo step", async ({
  page,
}) => {
  await openSample(page);
  const before = await cardCount(page);
  await page.getByRole("button", { name: "+ Path" }).click();
  await expect.poll(() => cardCount(page)).toBe(before + 1);
  await page.getByTitle("Undo").click();
  await expect.poll(() => cardCount(page)).toBe(before);
});

test("Export Auto (Java) downloads the class the command line writes", async ({
  page,
}) => {
  await openSample(page);
  await page.getByRole("button", { name: "Export" }).first().click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Export Auto (Java)" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("RedGardenBasicAuto.java");
  // samples/ holds what scripts/export-auto.mjs writes for the same file.
  expect(readFileSync(await file.path(), "utf8")).toBe(
    readFileSync("samples/RedGardenBasicAuto.java", "utf8"),
  );
});

test("a share link opens the same Auto", async ({ page, context }) => {
  await openSample(page);
  await page.getByRole("button", { name: "Export" }).first().click();
  await page.getByRole("menuitem", { name: "Share link" }).click();
  const url = await page
    .locator("textarea, input[readonly]")
    .first()
    .inputValue();
  expect(url).toContain("#data=");

  const other = await context.newPage();
  await other.goto(url);
  await expect(other.getByText("16 cards")).toBeVisible();
});

test("the Auto survives a reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/\d+ cards?/)).toBeVisible();
  await page.getByRole("button", { name: "+ Command" }).click();
  const count = await cardCount(page);
  await page.waitForTimeout(1200); // the session is saved after 750 ms
  await page.reload();
  await expect.poll(() => cardCount(page)).toBe(count);
});
