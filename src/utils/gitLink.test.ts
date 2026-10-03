import { assert, assertEqual, test } from "../lib/testing/harness";
import sampleText from "../lib/auto/fixtures/hive-rush.pp?raw";
import { gitHash, gitLinkFor, gitPath, gitRawUrl, parseGitHash, resolveGitHash, type GitLink } from "./gitLink";
import type { ShareLinkResult } from "./shareLink";

const RAW = "https://raw.githubusercontent.com/Mona-Shores-FTC-Robotics/biobuzz";

function expectError(result: ShareLinkResult, fragment: string) {
  assert(result.kind === "error", `expected an error, got ${result.kind}`);
  assert(result.message.includes(fragment), `"${fragment}" not in: ${result.message}`);
}

test("a file alone opens the default branch; a branch or commit comes first", () => {
  assertEqual(parseGitHash("#gh=red-simple.pp"), { ref: null, file: "red-simple.pp" });
  assertEqual(gitRawUrl({ ref: null, file: "red-simple.pp" }), `${RAW}/HEAD/TeamCode/autos/red-simple.pp`);
  assertEqual(parseGitHash("#gh=a1b2c3d/red-simple.pp"), { ref: "a1b2c3d", file: "red-simple.pp" });
  // A PR's branch keeps its slashes; the file is always the last part.
  assertEqual(parseGitHash("#gh=claude/some-branch/red-simple.pp"), {
    ref: "claude/some-branch",
    file: "red-simple.pp",
  });
  assertEqual(
    gitRawUrl({ ref: "claude/some-branch", file: "hive rush.pp" }),
    `${RAW}/claude/some-branch/TeamCode/autos/hive%20rush.pp`,
  );
});

test("links round-trip and stay short", () => {
  for (const link of [
    { ref: null, file: "red-simple.pp" },
    { ref: "a1b2c3d", file: "red-simple.pp" },
    { ref: "claude/some-branch", file: "hive rush.pp" },
  ]) {
    assertEqual(parseGitHash(gitHash(link)), link);
  }
  const url = `https://mona-shores-ftc-robotics.github.io/Visualizer/${gitHash({ ref: "a1b2c3d", file: "red-simple.pp" })}`;
  assert(url.length < 100, `${url.length} characters`);
});

test("other fragments are not git links, and bad names are refused", () => {
  assertEqual(parseGitHash("#data=1.abc"), null);
  assertEqual(parseGitHash("#sample=red-simple"), null);
  assert("error" in (parseGitHash("#gh=notes.txt") as object), "not a .pp file");
  assert("error" in (parseGitHash("#gh=../secrets/x.pp") as object), "no ..");
  assert("error" in (parseGitHash("#gh=main//x.pp") as object), "no empty ref parts");
  assert("error" in (parseGitHash("#gh=%E0%A4%A.pp") as object), "damaged encoding");
});

test("a committed Auto opens as a shared copy that says where it came from", async () => {
  let asked = "";
  const result = await resolveGitHash("#gh=master/hive-rush.pp", async (url) => {
    asked = url;
    return sampleText;
  });
  assertEqual(asked, `${RAW}/master/TeamCode/autos/hive-rush.pp`);
  assert(result.kind === "ok", JSON.stringify(result));
  assertEqual(result.shared.name, "hive-rush.pp");
  assertEqual(result.shared.from, "biobuzz master");
  assertEqual(result.shared.project, JSON.parse(sampleText));
});

test("missing files, no connection and bad contents each say so", async () => {
  expectError(await resolveGitHash("#gh=main/nope.pp", async () => null), "biobuzz has no TeamCode/autos/nope.pp at main");
  expectError(
    await resolveGitHash("#gh=nope.pp", async () => {
      throw new Error("offline");
    }),
    "Could not reach GitHub",
  );
  expectError(await resolveGitHash("#gh=x.pp", async () => "not json"), "not a readable .pp file");
  expectError(await resolveGitHash("#gh=x.pp", async () => '{"lines": []}'), "does not contain a path project");
  assertEqual((await resolveGitHash("#data=1.abc", async () => null)).kind, "none");
});

test("a whole path reaches any .pp in biobuzz, on any branch", () => {
  const dir = "TeamCode/src/test/resources/auto-builder";
  const path = `${dir}/recycle5-left.pp`;
  const link = parseGitHash(`#gh=claude/simulator/${path}`) as GitLink;
  assertEqual(link, { ref: "claude/simulator", file: "recycle5-left.pp", dir });
  assertEqual(gitRawUrl(link), `${RAW}/claude/simulator/${path}`);
  assertEqual(parseGitHash(`#gh=${path}`), { ref: null, file: "recycle5-left.pp", dir });
  // TeamCode/autos stays the short form, so both spellings are one link.
  assertEqual(parseGitHash("#gh=master/TeamCode/autos/hive-rush.pp"), { ref: "master", file: "hive-rush.pp" });
  assertEqual(gitHash(gitLinkFor("claude/simulator", path)), `#gh=claude/simulator/${path}`);
  assertEqual(gitHash(gitLinkFor("master", "TeamCode/autos/hive-rush.pp")), "#gh=master/hive-rush.pp");
  assertEqual(gitPath(gitLinkFor(null, path)), path);
  assert("error" in (parseGitHash("#gh=main/TeamCode/../x.pp") as object), "no .. in the folder");
});
