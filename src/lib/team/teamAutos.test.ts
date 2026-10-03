import { assert, assertEqual, test } from "../testing/harness";
import sampleText from "../auto/fixtures/hive-rush.pp?raw";
import {
  copyName,
  fetchTeamFiles,
  listTeamFiles,
  parsePairs,
  parseTeamHash,
  resolveTeamFiles,
  teamHash,
  teamListUrl,
  teamRawUrl,
} from "./teamAutos";

const RAW =
  "https://raw.githubusercontent.com/Mona-Shores-FTC-Robotics/biobuzz";

async function rejects(promise: Promise<unknown>, fragment: string) {
  try {
    await promise;
  } catch (error) {
    const message = (error as Error).message;
    assert(message.includes(fragment), `"${fragment}" not in: ${message}`);
    return;
  }
  assert(false, `expected an error with "${fragment}"`);
}

test("a team link names a branch, then up to 4 files or one pair", () => {
  assertEqual(
    parseTeamHash("#team=claude/simulator/recycle3-right.pp,recycle3-left.pp"),
    {
      ref: "claude/simulator",
      files: ["recycle3-right.pp", "recycle3-left.pp"],
      pair: null,
    },
  );
  assertEqual(parseTeamHash("#team=master/recycle3"), {
    ref: "master",
    files: [],
    pair: "recycle3",
  });
  assertEqual(parseTeamHash("#team=a1b2c3d/solo-tunnel.pp"), {
    ref: "a1b2c3d",
    files: ["solo-tunnel.pp"],
    pair: null,
  });
  assertEqual(parseTeamHash("#gh=master/solo-tunnel.pp"), null);
});

test("a team link refuses what it cannot open, with a reason", () => {
  const error = (hash: string) => {
    const r = parseTeamHash(hash);
    assert(r !== null && "error" in r, `expected an error for ${hash}`);
    return r.error;
  };
  assert(error("#team=recycle3-right.pp").includes("names a branch"));
  assert(error("#team=master/a.pp,b.pp,c.pp,d.pp,e.pp").includes("at most 4"));
  assert(error("#team=master/../x.pp").includes("not a branch"));
  assert(error("#team=master/a.pp,notes.txt").includes("not a .pp"));
});

test("links round-trip, and URLs point at TeamCode/autos", () => {
  const files = ["recycle3-right.pp", "recycle3-left.pp"];
  assertEqual(parseTeamHash(teamHash("claude/simulator", files)), {
    ref: "claude/simulator",
    files,
    pair: null,
  });
  assertEqual(parseTeamHash(teamHash("master", "recycle3")), {
    ref: "master",
    files: [],
    pair: "recycle3",
  });
  assertEqual(
    teamRawUrl("claude/simulator", "recycle3-right.pp"),
    `${RAW}/claude/simulator/TeamCode/autos/recycle3-right.pp`,
  );
  assertEqual(
    teamListUrl("claude/simulator"),
    "https://api.github.com/repos/Mona-Shores-FTC-Robotics/biobuzz/contents/TeamCode/autos?ref=claude%2Fsimulator",
  );
  assertEqual(copyName("recycle3-right.pp"), "biobuzz-recycle3-right.pp");
});

test("pairs.json: pairs with .pp files, the rest skipped", () => {
  const pairs = parsePairs(
    JSON.stringify({
      pairs: [
        {
          name: "recycle3",
          files: ["recycle3-right.pp", "recycle3-left.pp"],
          note: "sisters",
        },
        { name: "broken", files: ["x.txt"] },
        { files: ["a.pp"] },
      ],
    }),
  );
  assertEqual(pairs, [
    {
      name: "recycle3",
      files: ["recycle3-right.pp", "recycle3-left.pp"],
      note: "sisters",
    },
  ]);
});

test("a pair's name opens its files; the folder lists only .pp files", async () => {
  const fake = async (url: string) => {
    if (url.endsWith("/pairs.json")) {
      return JSON.stringify({
        pairs: [
          {
            name: "recycle3",
            files: ["recycle3-right.pp", "recycle3-left.pp"],
          },
        ],
      });
    }
    if (url.includes("api.github.com")) {
      return JSON.stringify([
        { type: "file", name: "solo-tunnel.pp" },
        { type: "file", name: "README.md" },
        { type: "file", name: "left-tunnel.pp" },
        { type: "dir", name: "old" },
      ]);
    }
    return null;
  };
  assertEqual(
    await resolveTeamFiles(
      { ref: "master", files: [], pair: "recycle3" },
      fake,
    ),
    ["recycle3-right.pp", "recycle3-left.pp"],
  );
  await rejects(
    resolveTeamFiles({ ref: "master", files: [], pair: "nope" }, fake),
    'no pair called "nope"',
  );
  assertEqual(await listTeamFiles("master", fake), [
    "left-tunnel.pp",
    "solo-tunnel.pp",
  ]);
});

test("fetching names the file that is missing, unreadable or not a path", async () => {
  const fake = async (url: string) =>
    url.endsWith("good.pp")
      ? sampleText
      : url.endsWith("text.pp")
        ? "not json"
        : url.endsWith("empty.pp")
          ? "{}"
          : null;
  const ok = await fetchTeamFiles("master", ["good.pp"], fake);
  assertEqual(ok.length, 1);
  assertEqual(ok[0].file, "good.pp");
  await rejects(
    fetchTeamFiles("master", ["good.pp", "gone.pp"], fake),
    "no TeamCode/autos/gone.pp on master",
  );
  await rejects(
    fetchTeamFiles("master", ["text.pp"], fake),
    "not a readable .pp",
  );
  await rejects(
    fetchTeamFiles("master", ["empty.pp"], fake),
    "does not contain a path project",
  );
  const offline = async () => {
    throw new Error("offline");
  };
  await rejects(
    fetchTeamFiles("master", ["good.pp"], offline),
    "Could not reach GitHub",
  );
});
