// A feeding launch is never cut by its step's time limit on the robot (biobuzz LaunchCards and
// AutoRegistry.holdTimeLimitsWhile): the limit guards the wait for spin-up, and the feed runs its
// own time. So the preview's volley is the timing model's, limit or not, for every LaunchAll.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/config/defaults";
import { parseProject, robotConfigOf } from "../src/io";
import { allCards } from "../src/lib/auto/tree";
import { fallbackValues, VOLLEY_COMMAND } from "../src/lib/timing/model";
import { previewTogether } from "../src/lib/timing/together";

/** r-solo-then-park with every LaunchAll after the first given `timeoutS`, previewed at `volleyS`. */
function volleys(volleyS: number, timeoutS?: number) {
  const loaded = parseProject(
    readFileSync("test/fixtures/autos/r-solo-then-park.pp", "utf8"),
    robotConfigOf(DEFAULT_SETTINGS),
  );
  if (!loaded.ok) throw new Error(loaded.error);
  const doc = loaded.doc;
  const launches = allCards(doc.auto!.cards).filter(
    (card) => card.kind === "action" && card.name === VOLLEY_COMMAND,
  );
  if (timeoutS !== undefined)
    for (const card of launches.slice(1))
      if (card.kind === "action") card.timeoutS = timeoutS;
  const preview = previewTogether(
    [
      {
        auto: doc.auto!,
        startPoint: doc.startPoint,
        lines: doc.lines,
        settings: { ...DEFAULT_SETTINGS, ...doc.robot },
        scenario: {},
      },
    ],
    { ...fallbackValues(), volleyS },
    false,
    { tipsCome: true },
  ).previews[0];
  return preview.actions
    .filter((action) => action.command === VOLLEY_COMMAND)
    .map((action) => action.t1 - action.t0);
}

describe("a LaunchAll with a time limit", () => {
  it("previews at the full volley time, as one without a limit does", () => {
    const limited = volleys(2, 1);
    expect(limited.length).toBeGreaterThan(1);
    // The first also waits out the spin-up; every later one is the volley time alone.
    for (const seconds of limited.slice(1)) expect(seconds).toBeCloseTo(2, 6);
    expect(limited).toEqual(volleys(2));
  });

  it("follows the Volley time what-if, every launch of it", () => {
    const short = volleys(1.5, 0.5);
    const long = volleys(2.5, 0.5);
    expect(long.length).toBe(short.length);
    long.forEach((seconds, i) => expect(seconds - short[i]).toBeCloseTo(1, 6));
  });
});
