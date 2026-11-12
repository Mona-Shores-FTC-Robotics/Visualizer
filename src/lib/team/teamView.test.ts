// @vitest-environment happy-dom
import { get } from "svelte/store";
import { assertEqual, test } from "../testing/harness";
import sampleText from "../auto/fixtures/hive-rush.pp?raw";
import { copyName, teamRawUrl } from "./teamAutos";
import { showTeamView, teamOpenRequest } from "./teamView";
import {
  TIMING_FILE,
  teamTiming,
  timingBranch,
  timingValues,
} from "../timing/store";

const fetchAll = async () => sampleText;

test("team view: several Autos are all drawn together, the first too", async () => {
  await showTeamView(
    "master",
    ["l-partner.pp", "r-partner-tip.pp"],
    null,
    fetchAll,
  );
  const request = get(teamOpenRequest)!;
  assertEqual(request.path, copyName("l-partner.pp"));
  // Overlay mode draws the overlays in place of the project, so the first must be one of them.
  assertEqual(request.overlays, [
    copyName("l-partner.pp"),
    copyName("r-partner-tip.pp"),
  ]);
  teamOpenRequest.set(null);
});

test("team view: one Auto opens as the project with no overlays", async () => {
  await showTeamView("master", ["r-solo.pp"], null, fetchAll);
  assertEqual(get(teamOpenRequest)!.overlays, []);
  teamOpenRequest.set(null);
});

test("team view: a stand-in is drawn beside an Auto and never opens as the project", async () => {
  await showTeamView(
    "master",
    ["partners/partner-l-still.pp", "r-solo.pp"],
    null,
    fetchAll,
  );
  const request = get(teamOpenRequest)!;
  assertEqual(request.path, copyName("r-solo.pp"));
  assertEqual(request.overlays, [
    copyName("partners/partner-l-still.pp"),
    copyName("r-solo.pp"),
  ]);
  teamOpenRequest.set(null);
});

test("team view: a link to another branch previews with that branch's timing facts", async () => {
  localStorage.setItem("teamAutosRef", "master");
  const branch = "claude/lane-pair";
  const asked: string[] = [];
  const fetchBranch = async (url: string) => {
    asked.push(url);
    if (url === teamRawUrl(branch, TIMING_FILE))
      return JSON.stringify({
        version: 1,
        facts: { volleyS: { value: 2.5 }, tipStartS: { value: 2.6 } },
      });
    if (url.endsWith(TIMING_FILE))
      return JSON.stringify({ version: 1, facts: { volleyS: { value: 4 } } });
    return sampleText;
  };
  await showTeamView(
    branch,
    ["drafts/r-outside-lane.pp", "drafts/l-under-hive.pp"],
    null,
    fetchBranch,
  );
  teamOpenRequest.set(null);
  assertEqual(asked.includes(teamRawUrl(branch, TIMING_FILE)), true);
  assertEqual(asked.includes(teamRawUrl("master", TIMING_FILE)), false);
  assertEqual(get(teamTiming)!.ref, branch);
  assertEqual(get(timingValues).volleyS, 2.5);
  assertEqual(get(timingValues).tipStartS, 2.6);
  // The Timing control names this branch, and reloads from it.
  assertEqual(timingBranch(), branch);
  // Following a link is for this page load: the remembered Team Autos branch is untouched.
  assertEqual(localStorage.getItem("teamAutosRef"), "master");
});

test("team view: a branch with no timing file falls back to the simulator's values", async () => {
  const fetchNone = async (url: string) =>
    url.endsWith(TIMING_FILE) ? null : sampleText;
  await showTeamView("claude/no-facts", ["r-solo.pp"], null, fetchNone);
  teamOpenRequest.set(null);
  assertEqual(get(teamTiming), null);
  assertEqual(timingBranch(), "claude/no-facts");
});
