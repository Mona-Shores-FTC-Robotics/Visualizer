// The volleys' POLLEN in the preview: from the turret to the CELL (pollen.ts).
import { describe, expect, it } from "vitest";
import { landTimes, PIECE_GAP_S, pollenAt, pollenFlights } from "./pollen";
import { NECTAR_FLIGHT_S, type NectarRobot } from "./nectar";
import { RED_CELLS } from "./hiveView";
import { turretSpans } from "../simple/aim";

const FRAME = { rLength: 18, rWidth: 18, rForward: 0 };
const at = (x: number, y: number, heading: number) => () => ({ x, y, heading });

function robot(
  actions: { command: string; t0: number; t1: number; unfired?: boolean }[],
  pose = at(40, 120, 0),
): NectarRobot {
  return {
    frame: FRAME,
    poseAt: pose,
    preview: {
      actions,
      launches: [],
      waits: [],
    } as unknown as NectarRobot["preview"],
  };
}

describe("the volleys' POLLEN", () => {
  it("lands a volley's pieces a feed's pace apart, the last as it ends", () => {
    expect(landTimes(2, 5, 4)).toEqual([
      5 - 3 * PIECE_GAP_S,
      5 - 2 * PIECE_GAP_S,
      5 - PIECE_GAP_S,
      5,
    ]);
    // A short step: never before a flight after its start.
    expect(landTimes(2, 2.6, 4)[0]).toBeCloseTo(2 + NECTAR_FLIGHT_S);
  });

  it("flies each piece from the turret to the CELL at the robot's end", () => {
    const flights = pollenFlights(
      [robot([{ command: "LaunchAll", t0: 2, t1: 5 }])],
      4,
    );
    expect(flights).toHaveLength(4);
    const last = flights[3];
    // Facing 0°, the turret is 3.33 in behind and 2.68 in right of the centre.
    expect(last.from.x).toBeCloseTo(40 - 3.33);
    expect(last.from.y).toBeCloseTo(120 - 2.68);
    const cell = RED_CELLS.left;
    expect(last.to.y).toBeCloseTo(cell.y + cell.h / 2);
    expect(last.to.x).toBeGreaterThan(cell.x);
    expect(last.to.x).toBeLessThan(cell.x + cell.w);
    expect(pollenAt(flights, 5 - NECTAR_FLIGHT_S / 2).length).toBeGreaterThan(
      0,
    );
    expect(pollenAt(flights, 5)).toEqual([]);
  });

  it("draws nothing for an unfired volley, and leaves the NECTAR's shot to nectar.ts", () => {
    expect(
      pollenFlights(
        [
          robot([
            { command: "LaunchAll", t0: 2, t1: 5, unfired: true },
            { command: "LaunchOneAimed", t0: 6, t1: 7 },
          ]),
        ],
        4,
      ),
    ).toEqual([]);
  });
});

describe("the turret on the CELL", () => {
  it("aims for an aimed shot from the drive before it, and through a NECTAR hold", () => {
    const spans = turretSpans({
      drives: [
        { t0: 4, t1: 5 },
        { t0: 9, t1: 10 },
      ],
      actions: [
        { command: "LaunchAllAimed", t0: 5, t1: 7 },
        { command: "LaunchOneAimed", t0: 12.5, t1: 13.5 },
      ],
      launches: [{ command: "CatchNectar", t0: 10, t1: 12.5 }],
    });
    expect(spans).toEqual([
      { t0: 4, t1: 7 },
      { t0: 9, t1: 13.5 },
    ]);
  });

  it("leaves a locked Launch all straight ahead", () => {
    expect(
      turretSpans({
        drives: [],
        actions: [{ command: "LaunchAll", t0: 1, t1: 3 }],
      }),
    ).toEqual([]);
  });
});
