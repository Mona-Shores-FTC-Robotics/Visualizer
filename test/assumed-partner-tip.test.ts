// An Auto previewed alone waits for its partner's TIP, and the preview takes it to come (together.ts
// tipsCome). That TIP must be on the HIVE too: the robot's own CELL is drawn up, a second wait for it
// sees it up at once, and the robot's volley lands in its own CELL, not the far one (mentor, 25 Nov
// 2026: L-NoCross alone looked as if it drove to the FLOWER without shooting).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/config/defaults";
import { parseProject, robotConfigOf } from "../src/io";
import { hiveAt } from "../src/lib/match/hiveView";
import { fallbackValues, hiveHistory } from "../src/lib/timing/model";
import { previewTogether, volleysOf } from "../src/lib/timing/together";

const FILE = "test/fixtures/no-cross-choice/l-no-cross-master.pp";

function alone() {
  const loaded = parseProject(
    readFileSync(FILE, "utf8"),
    robotConfigOf(DEFAULT_SETTINGS),
  );
  if (!loaded.ok) throw new Error(loaded.error);
  const doc = loaded.doc;
  const values = fallbackValues();
  const together = previewTogether(
    [
      {
        auto: doc.auto!,
        startPoint: doc.startPoint,
        lines: doc.lines,
        settings: { ...DEFAULT_SETTINGS, ...doc.robot },
        scenario: {},
      },
    ],
    values,
    true,
    { tipsCome: true },
  );
  const preview = together.previews[0];
  // As the field draws it (state/auto.svelte.ts hive).
  const history = hiveHistory(
    [...volleysOf(together.previews), ...together.assumed],
    values,
  );
  return { together, preview, history, values };
}

describe("L-NoCross alone: the partner's TIP it waits for is on the HIVE", () => {
  it("the first wait ends on the partner's TIP, and the LEFT CELL is drawn up from then", () => {
    const { together, preview, history, values } = alone();
    const [first, second] = preview.waits;
    expect(first.label).toBe("Wait for TIP or CELL up");
    expect(first.ended).toBe("trigger");
    expect(together.assumed).toHaveLength(1);
    expect(together.assumed[0].t).toBeCloseTo(first.t0, 6);
    expect(together.tips[0].assumedAt).toBeCloseTo(first.t0, 6);
    expect(together.tips[0].settled).toBeCloseTo(first.t1, 6);
    const after = hiveAt(history, values, first.t1 + 0.01);
    expect(after.left.down).toBe(0);
    expect(after.right.down).toBe(1);
    // The second wait for the same CELL sees it up at once: no second swing.
    expect(second.label).toBe("LEFT CELL up?");
    expect(second.t1 - second.t0).toBeCloseTo(0, 6);
  });

  it("its volley takes time and lands in its own (LEFT) CELL before it drives to the FLOWER", () => {
    const { preview, history, values } = alone();
    const launch = preview.actions.find((a) => a.command === "LaunchAll")!;
    expect(launch.t1 - launch.t0).toBeCloseTo(values.volleyS, 6);
    expect(launch.unfired).toBeUndefined();
    const drive = preview.log.find((l) =>
      l.text.startsWith("Drive to SCORING_FLOWER_STAGING"),
    )!;
    expect(drive.t).toBeGreaterThanOrEqual(launch.t1 - 1e-9);
    const view = hiveAt(history, values, launch.t1 + 0.01);
    expect(view.left.pollen).toBe(Math.round(values.volleyLoad));
    expect(view.right.down).toBe(1);
    // No TIP credited to the far CELL from that volley.
    const own = history.tips.filter((tip) => tip.assumedAt === undefined);
    expect(own.every((tip) => tip.start > launch.t1 + 1)).toBe(true);
  });
});
