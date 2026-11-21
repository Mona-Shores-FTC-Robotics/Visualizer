import { describe, expect, it } from "vitest";
import { mirrorUrl } from "../src/lib/team/mirror";
import { teamListUrl, teamRawUrl } from "../src/lib/team/teamAutos";

const BASE =
  "https://mona-shores-ftc-robotics.github.io/Visualizer/partner.html";

describe("the site's copy of biobuzz", () => {
  it("has a raw file at mirror/<branch>/<path>", () => {
    expect(mirrorUrl(teamRawUrl("master", "partners/x.pp"), BASE)).toBe(
      "https://mona-shores-ftc-robotics.github.io/Visualizer/mirror/master/TeamCode/autos/partners/x.pp",
    );
  });
  it("has a folder's listing as its contents.json", () => {
    expect(mirrorUrl(teamListUrl("master"), BASE)).toBe(
      "https://mona-shores-ftc-robotics.github.io/Visualizer/mirror/master/TeamCode/autos/contents.json",
    );
  });
  it("has nothing from anywhere else", () => {
    expect(mirrorUrl("https://example.com/x.pp", BASE)).toBeNull();
  });
});
