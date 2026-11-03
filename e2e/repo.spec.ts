import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Fork: Save to repo folder (lib/repo). The File System Access API's picker cannot be driven
// from a test, so the page gets a fake one: an in-memory biobuzz checkout that records what is
// written to it.

const SAMPLE = "/#sample=red-garden-basic";
const GENERATED =
  "TeamCode/src/main/java/org/firstinspires/ftc/teamcode/opmodes/auto/generated";

declare global {
  interface Window {
    __written: Record<string, string>;
  }
}

/** File → Save to repo folder…, beside Save to GitHub and simulate…. */
async function openRepoDialog(page: Page) {
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("menuitem", { name: "Save to repo folder…" }).click();
}

/** Installs the fake checkout before the app loads. */
async function fakeCheckout(page: Page, files: Record<string, string>) {
  await page.addInitScript((seed: Record<string, string>) => {
    const tree = new Map(Object.entries(seed));
    window.__written = {};
    const fileHandle = (path: string) => ({
      kind: "file",
      name: path.split("/").pop(),
      getFile: async () => ({ text: async () => tree.get(path) ?? "" }),
      createWritable: async () => {
        let text = "";
        return {
          write: async (chunk: string) => void (text += chunk),
          close: async () => {
            tree.set(path, text);
            window.__written[path] = text;
          },
        };
      },
    });
    const notFound = () => {
      const error = new DOMException("not found", "NotFoundError");
      return Promise.reject(error);
    };
    const dirHandle = (prefix: string, name: string) => ({
      kind: "directory",
      name,
      queryPermission: async () => "granted",
      requestPermission: async () => "granted",
      getDirectoryHandle: async (
        child: string,
        options?: { create?: boolean },
      ) => {
        const path = `${prefix}${child}/`;
        const exists = [...tree.keys()].some((k) => k.startsWith(path));
        if (!exists && !options?.create) return notFound();
        return dirHandle(path, child);
      },
      getFileHandle: async (child: string, options?: { create?: boolean }) => {
        const path = `${prefix}${child}`;
        if (!tree.has(path) && !options?.create) return notFound();
        return fileHandle(path);
      },
      values: async function* () {
        const seen = new Set<string>();
        for (const key of tree.keys()) {
          if (!key.startsWith(prefix)) continue;
          const rest = key.slice(prefix.length);
          const [head, ...tail] = rest.split("/");
          if (seen.has(head)) continue;
          seen.add(head);
          yield tail.length
            ? dirHandle(`${prefix}${head}/`, head)
            : fileHandle(key);
        }
      },
    });
    (
      window as unknown as { showDirectoryPicker: unknown }
    ).showDirectoryPicker = async () => dirHandle("", "biobuzz");
  }, files);
}

test("Save to repo folder writes the .pp and its Java into the checkout, and the Files panel opens them", async ({
  page,
}) => {
  const sample = readFileSync("samples/red-garden-basic.pp", "utf8");
  await fakeCheckout(page, {
    "TeamCode/autos/spots.json": '{"spots":{}}',
    "TeamCode/autos/r-solo.pp": sample,
    [`${GENERATED}/RSoloAuto.java`]: "old",
  });
  await page.goto(SAMPLE);
  await expect(
    page.getByRole("navigation", { name: "Chapters" }),
  ).toBeVisible();

  await openRepoDialog(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Save to repo folder")).toBeVisible();
  await dialog
    .getByRole("button", { name: "Choose the biobuzz folder…" })
    .click();
  await expect(dialog.getByText("biobuzz", { exact: true })).toBeVisible();

  page.once("dialog", (confirm) => void confirm.accept()); // a new file in the checkout
  await dialog.getByLabel("File").fill("red-garden-basic.pp");
  await dialog.getByRole("button", { name: "Save to folder" }).click();
  await expect(dialog.getByText("Saved into biobuzz.")).toBeVisible();

  const written = await page.evaluate(() => window.__written);
  expect(Object.keys(written).sort()).toEqual([
    "TeamCode/autos/red-garden-basic.pp",
    `${GENERATED}/RedGardenBasicAuto.java`,
  ]);
  // The Java is what the command line writes for the same Auto, but for the SAVED stamp of this save.
  const golden = readFileSync("samples/RedGardenBasicAuto.java", "utf8");
  const stamp = /SAVED = "[^"]*"/;
  expect(
    written[`${GENERATED}/RedGardenBasicAuto.java`].replace(stamp, ""),
  ).toBe(golden.replace(stamp, ""));
  // The .pp is a project file naming the same export.
  expect(
    JSON.parse(written["TeamCode/autos/red-garden-basic.pp"]).auto.exportName,
  ).toBe("red-garden-basic");
  await page.keyboard.press("Escape");

  // The checkout's Autos are listed in the Files panel and open from there.
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("menuitem", { name: "Open…" }).click();
  const files = page.getByRole("complementary", { name: "Files" });
  await expect(files.getByText("biobuzz checkout")).toBeVisible();
  await expect(
    files.getByRole("button", { name: "red-garden-basic.pp" }),
  ).toBeVisible();
  await files.getByRole("button", { name: "r-solo.pp" }).click();
  await expect(page.getByText("Opened r-solo.pp from biobuzz")).toBeVisible();
});

test("without the File System Access API the dialog says so", async ({
  page,
}) => {
  await page.addInitScript(() => {
    delete (window as unknown as { showDirectoryPicker?: unknown })
      .showDirectoryPicker;
  });
  await page.goto(SAMPLE);
  await expect(
    page.getByRole("navigation", { name: "Chapters" }),
  ).toBeVisible();
  await openRepoDialog(page);
  await expect(
    page
      .getByRole("dialog")
      .getByText("This browser cannot write into a folder"),
  ).toBeVisible();
});
