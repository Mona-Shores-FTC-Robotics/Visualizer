// @vitest-environment happy-dom
import { get } from "svelte/store";
import { assertEqual, test } from "../testing/harness";
import sampleText from "../auto/fixtures/hive-rush.pp?raw";
import { copyName } from "./teamAutos";
import { showTeamView, teamOpenRequest } from "./teamView";

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
