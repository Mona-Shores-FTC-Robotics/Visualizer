import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Fork: the Auto Builder on top of the Visualizer.

const SAMPLE = "/#sample=red-garden-basic";

async function openSample(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(SAMPLE);
  await expect(
    page.getByRole("navigation", { name: "Chapters" }),
  ).toBeVisible();
  return errors;
}

/** The sample is not simple-builder steps, so it opens in the plan view; the cards are a click away. */
async function showCards(page: Page) {
  await page.getByRole("button", { name: "Edit as cards" }).click();
  await expect(page.getByText(/\d+ cards?/)).toBeVisible();
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
  await expect(page.getByText(/of 30 s/).first()).toBeVisible();
  await expect(page.getByText("Shared copy")).toBeVisible();
  expect(errors).toEqual([]);
});

test("selecting a path card puts its path in the inspector", async ({
  page,
}) => {
  await openSample(page);
  await showCards(page);
  await card(page, "ToRearShot").first().click();
  await expect(inspectorName(page)).toHaveValue("ToRearShot");
});

test("+ Path adds a path and the card that drives it, in one undo step", async ({
  page,
}) => {
  await openSample(page);
  await showCards(page);
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
  await page
    .getByRole("button", { name: "Export", exact: true })
    .first()
    .click();
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
  await page
    .getByRole("button", { name: "Export", exact: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Share link" }).click();
  const url = await page
    .locator("textarea, input[readonly]")
    .first()
    .inputValue();
  expect(url).toContain("#data=");

  const other = await context.newPage();
  await other.goto(url);
  await showCards(other);
  await expect(other.getByText("16 cards")).toBeVisible();
});

test("the Auto survives a reload", async ({ page }) => {
  await page.goto("/");
  const steps = page.getByLabel("Steps").getByRole("listitem");
  const palette = page.locator("[aria-label='Add a step']");
  await palette.getByRole("button", { name: "Launch all" }).click();
  const count = await steps.count();
  expect(count).toBeGreaterThan(0);
  await page.waitForTimeout(1200); // the session is saved after 750 ms
  await page.reload();
  await expect.poll(() => steps.count()).toBe(count);
});

// The plan view: the good path in TIP chapters, a miss per tip, times changed with − / +.

test("the plan shows the good path in chapters, and − / + changes a wait", async ({
  page,
}) => {
  const errors = await openSample(page);
  const chapters = page.getByRole("navigation", { name: "Chapters" });
  await expect(chapters.getByRole("button")).toHaveText([/TIP 1/, /Park/]);
  // The wait that ends TIP 1 is in the open chapter; selecting it shows its stepper.
  const wait = page.getByRole("button", { name: /up to [\d.]+ s/ }).first();
  await wait.click();
  const more = page.getByRole("button", { name: /time limit: more/ });
  const shown = page.getByRole("group", { name: /time limit/ });
  const before = await shown.textContent();
  await more.click();
  await expect(shown).not.toHaveText(before!);
  await page.getByTitle("Undo").click();
  await expect(shown).toHaveText(before!);
  expect(errors).toEqual([]);
});

test("the field's ◆ shows what happens when TIP 1 doesn't come, and back", async ({
  page,
}) => {
  await openSample(page);
  await page
    .getByRole("button", { name: "Show what happens if TIP 1 doesn't come" })
    .click();
  await expect(page.getByText("◆ If TIP 1 doesn't come")).toBeVisible();
  await page.getByRole("button", { name: /Back to the good path/ }).click();
  await expect(
    page.getByRole("navigation", { name: "Chapters" }),
  ).toBeVisible();
});

test("All outcomes lists the good path and each miss, each parked by 30 s", async ({
  page,
}) => {
  await openSample(page);
  await page.getByRole("button", { name: /All outcomes \(2\)/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button")).toHaveText([
    /Every tip comes\s*[\d.]+ s/,
    /TIP 1 doesn't come.*[\d.]+ s/,
  ]);
  await dialog.getByRole("button", { name: /TIP 1 doesn't come/ }).click();
  await expect(page.getByText("◆ If TIP 1 doesn't come")).toBeVisible();
});

test("a miss becomes a ladder of tries: add one, see its outcomes, undo", async ({
  page,
}) => {
  const errors = await openSample(page);
  await page
    .getByRole("button", { name: "Show what happens if TIP 1 doesn't come" })
    .click();
  await page.getByRole("button", { name: /Replace with tries/ }).click();
  await page.getByRole("button", { name: "Replace", exact: true }).click();
  const tries = page.getByRole("list", { name: "Tries" });
  await expect(tries.getByRole("listitem")).toHaveText([/^P\s*Park/]);

  await page.getByRole("button", { name: "+ Add a try" }).click();
  await page.getByRole("button", { name: /Refill in the GARDEN/ }).click();
  await expect(tries.getByRole("listitem")).toHaveText([
    /Refill in the GARDEN/,
    /Then park/,
  ]);
  await expect(page.getByText("1 backup")).toBeVisible();

  await page
    .getByRole("button", { name: "Close: back to the good path" })
    .click();
  await page.getByRole("button", { name: /All outcomes \(3\)/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button")).toHaveText([
    /Every tip comes/,
    /TIP 1 doesn't come · Try 1 works/,
    /TIP 1 doesn't come · Every try misses: park/,
  ]);
  await page.keyboard.press("Escape");

  await page.getByTitle("Undo").click();
  await expect(page.getByText("1 backup")).toBeHidden();
  expect(errors).toEqual([]);
});

// The simple builder (lib/simple): a new Auto built from the palette, a spot clicked on the field.

test("a new Auto is built from the palette: Launch all, then Drive to a clicked spot", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^File/ }).first().click();
  await page.getByRole("menuitem", { name: /^New project/ }).click();
  const discard = page.getByRole("button", { name: /Discard/ });
  if (await discard.isVisible().catch(() => false)) await discard.click();
  const steps = page.getByLabel("Steps");
  const palette = page.locator("[aria-label='Add a step']");
  await expect(page.getByRole("button", { name: "Right start" })).toHaveAttribute("aria-pressed", "true");
  await palette.getByRole("button", { name: "Launch all" }).click();
  await palette.getByRole("button", { name: "Drive to" }).click();
  const field = (await page.locator("[role=application]").boundingBox())!;
  // (26.7, 47.4): lined up with the WALL FLOWER, so the spot faces it.
  await page.mouse.click(field.x + (26.7 / 141.5) * field.width, field.y + (1 - 47.4 / 141.5) * field.height);
  await page.fill("#simple-spot-name", "wall pick");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await palette.getByRole("button", { name: "Pick flower" }).click();
  await expect
    .poll(() =>
      steps
        .getByLabel("Spot")
        .evaluateAll((els) => els.map((el) => (el as HTMLSelectElement).value)),
    )
    .toContain("WALL_PICK");
  await expect(steps.getByText("at the WALL FLOWER")).toBeVisible();
  await page.getByTitle("Undo").click();
  await expect(steps.getByText("Pick flower")).toHaveCount(0);
});

test("a Drive step opens the Step panel; Edit path shape opens the path editor", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^File/ }).first().click();
  await page.getByRole("menuitem", { name: /^New project/ }).click();
  const discard = page.getByRole("button", { name: /Discard/ });
  if (await discard.isVisible().catch(() => false)) await discard.click();
  const palette = page.locator("[aria-label='Add a step']");
  await palette.getByRole("button", { name: "Drive to" }).click();
  const field = (await page.locator("[role=application]").boundingBox())!;
  await page.mouse.click(field.x + (40 / 141.5) * field.width, field.y + (1 - 60 / 141.5) * field.height);
  await page.fill("#simple-spot-name", "middle");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const inspector = page.getByRole("complementary", { name: "Inspector" });
  await expect(inspector.getByRole("heading", { name: "Step" })).toBeVisible();
  await expect(inspector.getByText("MIDDLE")).toBeVisible();
  const x = inspector.getByLabel("Spot X");
  await expect(x).toHaveValue("40");
  await x.fill("45");
  await x.press("Enter");
  await expect(x).toHaveValue("45");
  await expect(inspector.getByText("Wait after the path (ms)")).toHaveCount(0);
  await inspector.getByRole("button", { name: /Edit path shape/ }).click();
  await expect(inspector.getByText("Wait after the path (ms)")).toBeVisible();
  // Typing in the path editor keeps it open: each edit is a new path object, not another path.
  const endX = inspector.getByLabel("End X");
  await endX.fill("42");
  await expect(inspector.getByText("Wait after the path (ms)")).toBeVisible();
  await endX.fill("43");
  await expect(endX).toBeFocused();
  await expect(inspector.getByText("Wait after the path (ms)")).toBeVisible();
  await inspector.getByRole("button", { name: "Step", exact: true }).click();
  await expect(inspector.getByLabel("Spot X")).toBeVisible();
});
