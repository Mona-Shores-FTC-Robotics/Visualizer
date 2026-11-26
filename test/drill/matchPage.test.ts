import { describe, expect, test } from "vitest";
import {
  dsHtml,
  matchPageLines,
  type MatchPageFile,
} from "../../src/drill/matchPage";
import { DrillSession } from "../../src/drill/session";
import pageJson from "../fixtures/biobuzz/match-page.json";
import { CONTROLS, pad, rapier } from "./helpers";

// The drill's Driver Station panel: the robot's Match page from biobuzz's export (MatchPageExport,
// biobuzz #765), row by row, in the state the simulated robot is in.

const PAGE = pageJson as unknown as MatchPageFile;
const text = (html: string) => html.replace(/<[^>]*>/g, "");

async function lines(drive: (s: DrillSession) => void = () => {}) {
  const s = new DrillSession(await rapier(), CONTROLS, 20245, "two", 1);
  s.openingAuto = null;
  s.start();
  s.advance(0.1);
  drive(s);
  const st = s.teleop.status();
  return matchPageLines(PAGE, {
    status: st,
    lane: st.lane,
    laneFull: st.lane >= s.presets[0].laneCapacity,
    intakeRunning: true,
  }).map(text);
}

describe("the Match page, from biobuzz's export", () => {
  test("at PLAY: the header, then the robot's own lines in its order", async () => {
    expect(await lines()).toEqual([
      "MATCH  (1/3 · Share (Back) for next page)",
      "AIM: Circle fires",
      "LAUNCH TRIM 0",
      "IDLE",
      "0 PIECES",
      expect.stringMatching(/^OUR CELL (UP|DOWN)$/),
      "LOOP -- ms",
      "PINPOINT OK",
      "AIM TRIM 0",
    ]);
  }, 60000);

  test("the operator's trims, the launcher and the stick show as the robot writes them", async () => {
    const l = await lines((s) => {
      // Operator: launcher up, trim up twice, aim trim left once, the FLOWER stick out.
      const tap = (input: string) => {
        s.advance(0.05, pad(), pad([input]));
        s.advance(0.05);
      };
      tap("CROSS");
      tap("R1");
      tap("R1");
      tap("DPAD_LEFT");
      tap("SQUARE");
      s.advance(1.5);
    });
    expect(l).toContain("LAUNCH TRIM +50");
    expect(l).toContain("READY");
    expect(l).toContain("AIM TRIM L 1.5°");
    expect(l).toContain("FLOWER STICK OUT");
  }, 60000);

  test("only the tags the Driver Station renders get through", () => {
    expect(
      dsHtml('<big><b><font color="#4CAF50">OK</font></b></big> a & b'),
    ).toBe('<big><b><font color="#4CAF50">OK</font></b></big> a &amp; b');
    expect(dsHtml('<script>x</script><img src=x onerror="y">1 < 2')).toBe(
      "x1 &lt; 2",
    );
    expect(dsHtml('<font color="red" onclick="z">r</font>')).toBe(
      "<font>r</font>",
    );
  });
});
