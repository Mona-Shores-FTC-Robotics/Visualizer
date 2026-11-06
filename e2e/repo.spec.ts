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
    __disk: Record<string, string>;
    __editCheckout: (path: string, text: string) => void;
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
    const diskSeed: Record<string, string> =
      JSON.parse(sessionStorage.getItem("test-checkout-disk") ?? "null") ??
      seed;
    const tree = new Map(Object.entries(diskSeed));
    window.__disk = Object.fromEntries(tree) as Record<string, string>;
    const persist = () => {
      window.__disk = Object.fromEntries(tree) as Record<string, string>;
      sessionStorage.setItem(
        "test-checkout-disk",
        JSON.stringify(window.__disk),
      );
    };
    window.__editCheckout = (path, text) => {
      tree.set(path, text);
      persist();
    };
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
            persist();
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
      removeEntry: async (child: string) => {
        tree.delete(`${prefix}${child}`);
        persist();
      },
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
  expect(
    Object.keys(written)
      .filter((path) => !path.includes(".auto-workspace/"))
      .sort(),
  ).toEqual([
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

function eventAuto(partner = false): string {
  const doc = JSON.parse(readFileSync("samples/red-garden-basic.pp", "utf8"));
  doc.startPoint = { x: partner ? 100 : 30, y: 30, headingDeg: 0 };
  doc.lines = partner
    ? []
    : [
        {
          id: "drive",
          name: "Drive",
          kind: "atomic",
          color: "#ff0000",
          endPoint: { x: 60, y: 60 },
          controlPoints: [],
          heading: { type: "constant", degrees: 0 },
        },
      ];
  doc.sequence = partner ? [] : ["drive"];
  doc.activePaths = [];
  doc.auto = {
    version: 1,
    drawnFor: "RED",
    exportName: partner ? "partner-still" : "r-solo",
    registry: { actions: [], conditions: [] },
    points: { START: [partner ? 100 : 30, 30, 0], END: [60, 60, 0] },
    pathEnds: partner ? {} : { drive: "END" },
    startAt: "START",
    cards: partner
      ? []
      : [
          {
            id: "drive-card",
            kind: "path",
            lineId: "drive",
            while: [],
            events: [],
            park: false,
          },
        ],
  };
  return JSON.stringify(doc);
}

async function connectEvent(page: Page) {
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Local auto workspace" });
  await dialog
    .getByRole("button", { name: /Choose BIOBUZZ checkout|Change checkout/ })
    .click();
  await expect(
    dialog.getByText("biobuzz · Belding", { exact: true }),
  ).toBeVisible();
  await dialog.getByLabel("Auto in checkout").selectOption("r-solo.pp");
  return dialog;
}

async function openEvent(page: Page, withPartner = true) {
  const dialog = await connectEvent(page);
  if (withPartner)
    await dialog
      .getByLabel("Compare with partner")
      .selectOption("partners/still.pp");
  await dialog.getByRole("button", { name: "Open auto", exact: true }).click();
  await expect(page.getByTestId("workspace-status")).toContainText("Belding");
}

test("Belding: edit the live auto beside a local partner, save, checkpoint, and restore offline", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(
    /https:\/\/(api\.github\.com|raw\.githubusercontent\.com)\//,
    (route) => route.abort(),
  );
  await fakeCheckout(page, {
    ".git/HEAD": "ref: refs/heads/Belding\n",
    "TeamCode/autos/spots.json": '{"spots":{}}',
    "TeamCode/autos/r-solo.pp": eventAuto(),
    "TeamCode/autos/partners/still.pp": eventAuto(true),
    [`${GENERATED}/RSoloAuto.java`]: "old java",
  });
  await page.goto("/");
  await openEvent(page);
  const inspector = page.getByRole("complementary", { name: "Inspector" });
  const x = inspector.getByLabel("Spot X", { exact: true });
  await expect(x).toHaveValue("60");
  await x.fill("63");
  await x.press("Tab");
  await expect(page.getByTestId("workspace-status")).toContainText(
    "Unsaved to checkout",
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByTestId("workspace-status")).toContainText(
    "Saved to checkout",
  );
  const saved = await page.evaluate(() =>
    JSON.parse(window.__disk["TeamCode/autos/r-solo.pp"]),
  );
  expect(saved.auto.points.END[0]).toBe(63);
  await expect(
    page.locator("#additional-path-0-point-1-0 circle").first(),
  ).toHaveAttribute("cx", "63");
  expect(
    await page.evaluate(
      () => window.__disk["TeamCode/autos/partners/still.pp"],
    ),
  ).toBe(eventAuto(true));
  expect(
    await page.evaluate(
      () => window.__disk["TeamCode/.auto-workspace/pending.json"],
    ),
  ).toBeUndefined();
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Local auto workspace" });
  await dialog
    .getByLabel("Checkpoint name")
    .fill("Belding tested at 63 inches");
  await dialog.getByRole("button", { name: "Mark saved auto tested" }).click();
  await expect(
    dialog.getByText("Belding tested at 63 inches", { exact: false }).first(),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await x.fill("66");
  await x.press("Tab");
  await page.keyboard.press("Control+s");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(window.__disk["TeamCode/autos/r-solo.pp"]).auto.points
            .END[0],
      ),
    )
    .toBe(66);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await openEvent(page, false);
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Local auto workspace" });
  await dialog.getByRole("button", { name: "Restore", exact: true }).click();
  await page
    .getByRole("button", { name: "Restore checkpoint", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(window.__disk["TeamCode/autos/r-solo.pp"]).auto.points
            .END[0],
      ),
    )
    .toBe(63);
  await expect(
    dialog.getByText(/Before restoring Belding tested/),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(x).toHaveValue("63");
  expect(errors).toEqual([]);
});

test("checkout edits and branch changes are never overwritten by an old browser session", async ({
  page,
}) => {
  await fakeCheckout(page, {
    ".git/HEAD": "ref: refs/heads/Belding\n",
    "TeamCode/autos/spots.json": '{"spots":{}}',
    "TeamCode/autos/r-solo.pp": eventAuto(),
  });
  await page.goto("/");
  await openEvent(page, false);
  await page
    .getByRole("complementary", { name: "Inspector" })
    .getByLabel("Spot X", { exact: true })
    .fill("63");
  await page.evaluate(() =>
    window.__editCheckout(
      "TeamCode/autos/r-solo.pp",
      '{"newer":"external edit"}',
    ),
  );
  await page.keyboard.press("Control+s");
  await expect(page.getByText(/changed on disk/).first()).toBeVisible();
  expect(
    await page.evaluate(() => window.__disk["TeamCode/autos/r-solo.pp"]),
  ).toBe('{"newer":"external edit"}');
  await page.evaluate(() =>
    window.__editCheckout(".git/HEAD", "ref: refs/heads/master\n"),
  );
  await page.keyboard.press("Control+s");
  await expect(
    page.getByText(/checkout or branch changed/i).first(),
  ).toBeVisible();
});

test("local shared spots override reachable master and save every linked auto together", async ({
  page,
}) => {
  const auto = JSON.parse(eventAuto());
  auto.auto.teamSpots = ["END"];
  const other = structuredClone(auto);
  other.auto.exportName = "other";
  await page.route(/raw\.githubusercontent\.com.*spots\.json/, (route) =>
    route.fulfill({
      body: '{"spots":{"END":[99,99,0]}}',
      contentType: "application/json",
    }),
  );
  await fakeCheckout(page, {
    ".git/HEAD": "ref: refs/heads/Belding\n",
    "TeamCode/autos/spots.json": '{"spots":{"END":[60,60,0]}}',
    "TeamCode/autos/r-solo.pp": JSON.stringify(auto),
    "TeamCode/autos/other.pp": JSON.stringify(other),
  });
  await page.goto("/");
  await openEvent(page, false);
  const x = page
    .getByRole("complementary", { name: "Inspector" })
    .getByLabel("Spot X", { exact: true });
  await expect(x).toHaveValue("60");
  await page
    .getByRole("button", { name: "Unlock team spot", exact: true })
    .click();
  await x.fill("63");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByTestId("workspace-status")).toContainText(
    "Saved to checkout",
  );
  const disk = await page.evaluate(() => window.__disk);
  expect(JSON.parse(disk["TeamCode/autos/spots.json"]).spots.END[0]).toBe(63);
  expect(JSON.parse(disk["TeamCode/autos/other.pp"]).auto.points.END[0]).toBe(
    63,
  );
  expect(disk[`${GENERATED}/OtherAuto.java`]).toContain("p.of(63");
});

test("dragging our comparison overlay edits the candidate that Save exports", async ({
  page,
}) => {
  await fakeCheckout(page, {
    ".git/HEAD": "ref: refs/heads/Belding\n",
    "TeamCode/autos/spots.json": '{"spots":{}}',
    "TeamCode/autos/r-solo.pp": eventAuto(),
    "TeamCode/autos/partners/still.pp": eventAuto(true),
  });
  await page.goto("/");
  await openEvent(page);
  await page.keyboard.press("Escape");
  await expect(
    page
      .getByRole("complementary", { name: "Inspector" })
      .getByRole("heading", { name: "Project", exact: true }),
  ).toBeVisible();
  const marker = page.locator("#additional-path-0-point-1-0");
  await marker.hover();
  const box = (await marker.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 24, box.y + box.height / 2, {
    steps: 4,
  });
  await page.mouse.up();
  const x = page
    .getByRole("complementary", { name: "Inspector" })
    .getByLabel("Spot X", { exact: true });
  const edited = Number(await x.inputValue());
  expect(edited).not.toBe(60);
  await page.keyboard.press("Control+s");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(window.__disk["TeamCode/autos/r-solo.pp"]).auto.points
            .END[0],
      ),
    )
    .toBe(edited);
  await expect(marker.locator("circle").first()).toHaveAttribute(
    "cx",
    String(edited),
  );
});
