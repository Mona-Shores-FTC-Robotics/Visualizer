import { assert, assertEqual, assertText, test } from "../lib/testing/harness";
import sampleText from "../lib/auto/fixtures/hive-rush.pp?raw";
import golden from "../lib/codegen/auto/fixtures/HiveRushAuto.java?raw";
import frozenV1Link from "./fixtures/hive-rush.v1.link?raw";
import { generateAutoJavaFromText } from "../lib/codegen/auto/fromFile";
import { normalizeAuto } from "../lib/auto/normalize";
import {
  decodeShareHash,
  encodeShareHash,
  projectSettings,
  shareUrl,
  type ShareLinkResult,
} from "./shareLink";

const PAGES = {
  origin: "https://mona-shores-ftc-robotics.github.io",
  pathname: "/Visualizer/",
};

function sample() {
  return JSON.parse(sampleText) as Record<string, unknown>;
}

function expectOk(result: ShareLinkResult) {
  if (result.kind !== "ok")
    throw new Error(`expected ok, got ${JSON.stringify(result)}`);
  return result.shared;
}

function expectError(result: ShareLinkResult, fragment: string) {
  assert(result.kind === "error", `expected an error, got ${result.kind}`);
  assert(
    result.message.includes(fragment),
    `message should mention "${fragment}": ${result.message}`,
  );
}

test("round trip: the hive-rush Auto comes back unchanged, auto section included", async () => {
  const project = sample();
  const shared = expectOk(
    await decodeShareHash(
      await encodeShareHash({ name: "hive-rush.pp", project }),
    ),
  );
  assertEqual(shared.name, "hive-rush.pp");
  assertEqual(shared.project, project);
  assert(shared.project.auto, "the auto section must travel with the link");
});

test("round trip: the shared copy exports exactly HiveRushAuto.java", async () => {
  const shared = expectOk(
    await decodeShareHash(
      await encodeShareHash({ name: "hive-rush.pp", project: sample() }),
    ),
  );
  const result = generateAutoJavaFromText(
    JSON.stringify(shared.project),
    "hive-rush.pp",
  );
  assert(result.ok, JSON.stringify(result));
  assertText(result.source, golden);
});

test("round trip: an untitled project and non-ASCII names survive", async () => {
  const project: Record<string, unknown> = {
    ...sample(),
    startPoint: { x: 38, y: 71, headingDeg: 0 },
  };
  (project.lines as { name: string }[])[0].name = "Récupération ✓";
  const shared = expectOk(
    await decodeShareHash(await encodeShareHash({ name: null, project })),
  );
  assertEqual(shared.name, null);
  assertEqual(shared.project, project);
});

test("a format 1 link made today still opens and still exports", async () => {
  const shared = expectOk(await decodeShareHash(frozenV1Link.trim()));
  assertEqual(shared.name, "hive-rush.pp");
  const { auto, problems } = normalizeAuto(shared.project.auto);
  assert(auto, "the frozen link has an auto section");
  assertEqual(problems, []);
  const result = generateAutoJavaFromText(
    JSON.stringify(shared.project),
    "hive-rush.pp",
  );
  assert(result.ok, JSON.stringify(result));
});

test("fragments that are not share links are ignored", async () => {
  assertEqual((await decodeShareHash("")).kind, "none");
  assertEqual((await decodeShareHash("#export-gif-test")).kind, "none");
});

test("a link from a newer Visualizer says so", async () => {
  const body = frozenV1Link.trim().slice("#data=1.".length);
  expectError(await decodeShareHash(`#data=2.${body}`), "newer Visualizer");
});

test("unknown and missing format versions are refused", async () => {
  expectError(await decodeShareHash("#data=0.abc"), "unknown format");
  expectError(
    await decodeShareHash("#data=hello"),
    "not a Visualizer share link",
  );
});

test("a link cut off when pasted is reported as incomplete", async () => {
  const link = frozenV1Link.trim();
  expectError(
    await decodeShareHash(link.slice(0, link.length / 2)),
    "incomplete or damaged",
  );
  expectError(
    await decodeShareHash(link.slice(0, -3)),
    "incomplete or damaged",
  );
  expectError(
    await decodeShareHash("#data=1.not*base64"),
    "incomplete or damaged",
  );
});

test("a link without a path project is refused", async () => {
  const hash = await encodeShareHash({ name: "x.pp", project: { lines: [] } });
  expectError(await decodeShareHash(hash), "does not contain a path project");
});

test("only the settings that change the project travel with it", () => {
  const picked = projectSettings({
    rWidth: 16,
    maxVelocity: 60,
    fieldMap: "biobuzz.webp",
    leftPanelWidth: 400,
    customFieldImage: "data:image/png;base64,AAAA",
    onionColor: "#fff",
  });
  assertEqual(picked, {
    rWidth: 16,
    maxVelocity: 60,
    fieldMap: "biobuzz.webp",
  });
});

test("link length budget: the hive-rush sample stays under 2,200 characters", async () => {
  // Real Autos are longer than the sample; if this grows, the dialog's
  // advice about where a link fits needs checking again.
  const project = sample();
  project.settings = projectSettings(
    project.settings as Record<string, unknown>,
  );
  const url = shareUrl(
    await encodeShareHash({ name: "hive-rush.pp", project }),
    PAGES,
  );
  assert(
    url.startsWith(
      "https://mona-shores-ftc-robotics.github.io/Visualizer/#data=1.",
    ),
  );
  assert(url.length < 2200, `link is ${url.length} characters`);
});
