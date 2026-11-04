import { assert, assertEqual, test } from "../testing/harness";
import sampleText from "../auto/fixtures/hive-rush.pp?raw";
import {
  copyName,
  fetchTeamFiles,
  isStandIn,
  isTeamFile,
  listDraftFiles,
  listPartnerFiles,
  listTeamFiles,
  openOrder,
  parsePairs,
  parseTeamHash,
  resolveTeamFiles,
  teamDraftsListUrl,
  teamFileOf,
  teamHash,
  teamListUrl,
  teamPartnersListUrl,
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

test("a partner stand-in in TeamCode/autos/partners opens by its path, on any branch", () => {
  assertEqual(parseTeamHash("#team=master/partners/partner-l-still.pp"), {
    ref: "master",
    files: ["partners/partner-l-still.pp"],
    pair: null,
  });
  assertEqual(
    parseTeamHash(
      "#team=claude/simulator/r-solo.pp,partners/partner-l-still.pp",
    ),
    {
      ref: "claude/simulator",
      files: ["r-solo.pp", "partners/partner-l-still.pp"],
      pair: null,
    },
  );
  // Only the known subfolder: anything else before the file is part of the branch.
  assertEqual(parseTeamHash("#team=claude/simulator/x.pp"), {
    ref: "claude/simulator",
    files: ["x.pp"],
    pair: null,
  });
  assert(isTeamFile("partners/partner-l-still.pp"), "a stand-in");
  assert(!isTeamFile("old/x.pp") && !isTeamFile("partners/x.txt"), "others");
  assertEqual(
    teamRawUrl("master", "partners/partner-l-still.pp"),
    `${RAW}/master/TeamCode/autos/partners/partner-l-still.pp`,
  );
  assertEqual(
    copyName("partners/partner-l-still.pp"),
    "biobuzz-partners-partner-l-still.pp",
  );
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

test("a pair's name opens its files; the folder lists only its own .pp files, not partners/", async () => {
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
        { type: "dir", name: "partners" },
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

test("the stand-ins are listed apart, as partners/<file>.pp, and never in the Autos list", async () => {
  const fake = async (url: string) => {
    if (url === teamListUrl("master")) {
      return JSON.stringify([
        { type: "file", name: "r-solo.pp" },
        { type: "dir", name: "partners" },
      ]);
    }
    if (url === teamPartnersListUrl("master")) {
      return JSON.stringify([
        { type: "file", name: "partner-l-still.pp" },
        { type: "file", name: "README.md" },
        { type: "file", name: "partner-park-1.pp" },
      ]);
    }
    return null;
  };
  assertEqual(
    teamPartnersListUrl("master"),
    "https://api.github.com/repos/Mona-Shores-FTC-Robotics/biobuzz/contents/TeamCode/autos/partners?ref=master",
  );
  assertEqual(await listTeamFiles("master", fake), ["r-solo.pp"]);
  assertEqual(await listPartnerFiles("master", fake), [
    "partners/partner-l-still.pp",
    "partners/partner-park-1.pp",
  ]);
  // A branch without the folder has no stand-ins, which is not an error.
  assertEqual(await listPartnerFiles("old", fake), []);
  // And what the list returns is what a link may name.
  assert(isTeamFile("partners/partner-park-1.pp") && isStandIn("partners/x.pp"));
  assert(!isStandIn("r-solo.pp"));
});

test("a stand-in is never the first file opened: an Auto of ours goes first, or nothing opens", () => {
  assertEqual(openOrder(["r-solo.pp"]), ["r-solo.pp"]);
  assertEqual(openOrder(["partners/partner-l-still.pp", "r-solo.pp"]), [
    "r-solo.pp",
    "partners/partner-l-still.pp",
  ]);
  assertEqual(
    openOrder(["l-partner.pp", "partners/a.pp", "r-solo.pp"]),
    ["l-partner.pp", "partners/a.pp", "r-solo.pp"],
  );
  assertEqual(openOrder(["partners/partner-l-still.pp"]), null);
  assertEqual(openOrder([]), null);
});

test("a draft in TeamCode/autos/drafts opens by its path beside a stand-in, and is ours, not a stand-in", async () => {
  const link = parseTeamHash(
    "#team=master/drafts/r-solo-push.pp,partners/partner-push-start.pp",
  );
  assertEqual(link, {
    ref: "master",
    files: ["drafts/r-solo-push.pp", "partners/partner-push-start.pp"],
    pair: null,
  });
  assert(isTeamFile("drafts/r-solo-push.pp") && !isStandIn("drafts/r-solo-push.pp"));
  assert(!isTeamFile("other/x.pp"));
  // The draft opens as the project, the stand-in beside it.
  assertEqual(openOrder(["partners/partner-push-start.pp", "drafts/r-solo-push.pp"]), [
    "drafts/r-solo-push.pp",
    "partners/partner-push-start.pp",
  ]);
  assertEqual(
    teamRawUrl("master", "drafts/r-solo-push.pp"),
    `${RAW}/master/TeamCode/autos/drafts/r-solo-push.pp`,
  );
  const fake = async (url: string) =>
    url === teamDraftsListUrl("master")
      ? JSON.stringify([
          { type: "file", name: "r-solo-push.pp" },
          { type: "file", name: "README.md" },
          { type: "file", name: "l-3tip-a.pp" },
        ])
      : null;
  assertEqual(await listDraftFiles("master", fake), [
    "drafts/l-3tip-a.pp",
    "drafts/r-solo-push.pp",
  ]);
  assertEqual(await listDraftFiles("old", fake), []);
});

test("a browser copy maps back to its team file, subfolder included", () => {
  assertEqual(teamFileOf(copyName("r-solo.pp")), "r-solo.pp");
  assertEqual(teamFileOf(copyName("drafts/r-solo-push.pp")), "drafts/r-solo-push.pp");
  assertEqual(teamFileOf(copyName("partners/partner-still.pp")), "partners/partner-still.pp");
  assertEqual(teamFileOf("r-solo.pp"), null);
  assertEqual(teamFileOf("biobuzz-"), null);
});
