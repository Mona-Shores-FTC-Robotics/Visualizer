// The human player's NECTAR in the preview: where it is at each moment (nectar.ts).
import { describe, expect, it } from "vitest";
import {
  intakeMouth,
  LOADING_ZONE,
  NECTAR_FLIGHT_S,
  NECTAR_HELD_IN,
  NECTAR_RELEASE,
  NECTAR_ROLL_SPEED,
  NECTAR_SHORT,
  nectarAt,
  nectarRelease,
  nectarsAt,
  nectarTracks,
  type NectarRobot,
} from "./nectar";
import { RED_CELLS } from "./hiveView";

type Pose = { x: number; y: number; heading: number };
const FRAME = { rLength: 18, rWidth: 18, rForward: 0 };
/** At LEFT's end of the field, well clear of the zone, facing the wall the NECTAR comes from. */
const CATCH_SPOT: Pose = { x: 40, y: 120, heading: 180 };

/** A robot with one catch wait from `t0` to `t1`, and a LaunchOneAimed step if `shot` says when. */
function robot(
  opts: {
    pose?: Pose | ((t: number) => Pose);
    wait?: { t0: number; t1: number; caught: boolean };
    shot?: { t0: number; t1: number; unfired?: true };
  } = {},
): NectarRobot {
  const pose = opts.pose ?? CATCH_SPOT;
  const { wait, shot } = opts;
  return {
    frame: FRAME,
    poseAt: typeof pose === "function" ? pose : () => pose,
    preview: {
      launches: wait
        ? [
            {
              cardId: "catch",
              command: "CatchNectar",
              t0: wait.t0,
              t1: wait.t1,
            },
          ]
        : [],
      waits: wait
        ? [
            {
              cardId: "catch",
              label: "Hold for the NECTAR",
              t0: wait.t0,
              t1: wait.t1,
              limitAt: wait.t0 + 2.5,
              ended: wait.caught ? "trigger" : "time",
              condition: wait.caught ? "NectarIn" : null,
              branched: false,
            },
          ]
        : [],
      actions: shot
        ? [{ cardId: "shot", command: "LaunchOneAimed", ...shot }]
        : [],
    },
  };
}

const TIP = [{ settled: 6 }];

describe("the human player's NECTAR", () => {
  it("is let go in the zone's middle, 5 in off the wall", () => {
    expect(NECTAR_RELEASE).toEqual({ x: 5, y: 106 });
    for (let i = 0; i < 5; i++) {
      const at = nectarRelease(i);
      expect(at.y).toBeGreaterThan(LOADING_ZONE.y);
      expect(at.y).toBeLessThan(LOADING_ZONE.y + LOADING_ZONE.h);
    }
    // Successive ones do not sit on each other.
    expect(nectarRelease(1).y).not.toBe(nectarRelease(0).y);
    expect(nectarRelease(2).y).not.toBe(nectarRelease(1).y);
  });

  it("appears when its TIP settles, and stays if nobody catches it", () => {
    const tracks = nectarTracks(TIP, [robot()]);
    expect(nectarsAt(tracks, 5.9)).toEqual([]);
    expect(nectarsAt(tracks, 6)).toEqual([
      { ...NECTAR_RELEASE, tip: 0, state: "zone" },
    ]);
    expect(nectarsAt(tracks, 30)).toEqual([
      { ...NECTAR_RELEASE, tip: 0, state: "zone" },
    ]);
  });

  it("one per TIP", () => {
    const tracks = nectarTracks([{ settled: 6 }, { settled: 14 }], [robot()]);
    expect(nectarsAt(tracks, 10).length).toBe(1);
    expect(nectarsAt(tracks, 15).length).toBe(2);
  });

  it("rolls straight to the intake mouth and arrives as the wait ends on NectarIn", () => {
    const r = robot({ wait: { t0: 8, t1: 8.6, caught: true } });
    const [track] = nectarTracks(TIP, [r]);
    const mouth = intakeMouth(r, 8.6);
    // The front of the frame, facing the wall: 9 in toward it from the centre.
    expect(mouth.x).toBeCloseTo(31);
    expect(mouth.y).toBeCloseTo(120);
    const rollS = Math.hypot(mouth.x - 5, mouth.y - 106) / NECTAR_ROLL_SPEED;
    expect(track.roll).toMatchObject({ t1: 8.6, caught: true, robot: 0 });
    expect(track.roll!.t0).toBeCloseTo(8.6 - rollS);
    // In the zone until the roll starts, then on the line, in step with the clock.
    expect(nectarAt(track, 8.6 - rollS - 0.01)).toMatchObject({
      ...NECTAR_RELEASE,
      state: "zone",
    });
    const mid = nectarAt(track, 8.6 - rollS / 2)!;
    expect(mid.state).toBe("rolling");
    expect(mid.x).toBeCloseTo((5 + mouth.x) / 2);
    expect(mid.y).toBeCloseTo((106 + mouth.y) / 2);
    const justBefore = nectarAt(track, 8.6 - 1e-4)!;
    expect(justBefore.state).toBe("rolling");
    expect(justBefore.x).toBeCloseTo(mouth.x, 1);
    expect(justBefore.y).toBeCloseTo(mouth.y, 1);
  });

  it("never rolls before it appears: a late TIP shortens the roll, not the wait", () => {
    const r = robot({ wait: { t0: 6, t1: 6.2, caught: true } });
    const [track] = nectarTracks(TIP, [r]);
    expect(track.roll!.t0).toBe(6);
    expect(track.roll!.t1).toBe(6.2);
    expect(nectarAt(track, 5.99)).toBeNull();
    expect(nectarAt(track, 6.1)!.state).toBe("rolling");
  });

  it("rides in the robot once caught, then flies from the turret to the CELL at the robot's end and lands as the launch ends", () => {
    // The robot drives on after the catch; the NECTAR goes with it.
    const pose = (t: number): Pose =>
      t <= 9
        ? CATCH_SPOT
        : { x: 40 + 10 * Math.min(1, t - 9), y: 120, heading: 180 };
    const r = robot({
      pose,
      wait: { t0: 8, t1: 8.6, caught: true },
      shot: { t0: 11, t1: 12.2 },
    });
    const [track] = nectarTracks(TIP, [r]);
    expect(nectarAt(track, 8.6)).toMatchObject({
      state: "held",
      x: 31 + NECTAR_HELD_IN,
      y: 120,
    });
    expect(nectarAt(track, 10.5)).toMatchObject({
      state: "held",
      x: 41 + NECTAR_HELD_IN,
    });
    // Held through the launch's spin-up, then the flight over its last NECTAR_FLIGHT_S.
    expect(nectarAt(track, 11.2)!.state).toBe("held");
    const cell = RED_CELLS.left;
    const target = { x: cell.x + cell.w / 2, y: cell.y + cell.h / 2 };
    expect(track.flight).toMatchObject({
      t0: 12.2 - NECTAR_FLIGHT_S,
      t1: 12.2,
      to: target,
    });
    const flying = nectarAt(track, 12.2 - NECTAR_FLIGHT_S / 2)!;
    expect(flying.state).toBe("flying");
    // It leaves from the turret (behind and right of centre: facing 180°, that is +x and +y).
    const turret = { x: 50 + 3.33, y: 120 + 2.68 };
    expect(track.flight!.from.x).toBeCloseTo(turret.x);
    expect(track.flight!.from.y).toBeCloseTo(turret.y);
    expect(flying.x).toBeCloseTo((turret.x + target.x) / 2);
    expect(flying.y).toBeCloseTo((turret.y + target.y) / 2);
    // Landed: it is the CELL's now (the preview's HIVE counts it from here).
    expect(nectarAt(track, 12.2)).toBeNull();
  });

  it("fires at RIGHT from RIGHT's end", () => {
    const spot: Pose = { x: 40, y: 20, heading: 180 };
    const r = robot({
      pose: spot,
      wait: { t0: 8, t1: 9, caught: true },
      shot: { t0: 9, t1: 10 },
    });
    const [track] = nectarTracks(TIP, [r]);
    const cell = RED_CELLS.right;
    expect(track.flight!.to).toEqual({
      x: cell.x + cell.w / 2,
      y: cell.y + cell.h / 2,
    });
  });

  it("stays in the robot when no LaunchOneAimed fires it", () => {
    for (const shot of [
      undefined,
      { t0: 11, t1: 11.2, unfired: true as const },
    ]) {
      const r = robot({ wait: { t0: 8, t1: 8.6, caught: true }, shot });
      const [track] = nectarTracks(TIP, [r]);
      expect(track.flight).toBeUndefined();
      expect(nectarAt(track, 29)!.state).toBe("held");
    }
  });

  it("with NectarIn ✗ it rolls toward the robot, stops short and stays there", () => {
    const r = robot({
      wait: { t0: 8, t1: 10.5, caught: false },
      shot: { t0: 11, t1: 12.2 },
    });
    const [track] = nectarTracks(TIP, [r]);
    const mouth = intakeMouth(r, 10.5);
    const stop = {
      x: 5 + (mouth.x - 5) * NECTAR_SHORT,
      y: 106 + (mouth.y - 106) * NECTAR_SHORT,
    };
    expect(track.roll).toMatchObject({ t0: 8, caught: false });
    expect(nectarAt(track, 7.9)!.state).toBe("zone");
    expect(nectarAt(track, 8.1)!.state).toBe("rolling");
    for (const t of [10.5, 12, 30]) {
      const at = nectarAt(track, t)!;
      expect(at.state).toBe("stopped");
      expect(at.x).toBeCloseTo(stop.x);
      expect(at.y).toBeCloseTo(stop.y);
    }
    // Nothing was caught, so nothing flies.
    expect(track.flight).toBeUndefined();
  });

  it("is not entered while a robot is in the zone (G427.C): it appears once the robot has left", () => {
    // A robot parked in the zone until 9 s, then gone in a second.
    const inZone = (t: number): Pose => ({
      x: t < 9 ? 14 : 14 + 40 * Math.min(1, t - 9),
      y: 106,
      heading: 0,
    });
    const blocker: NectarRobot = { ...robot(), poseAt: inZone };
    const catcher = robot({ wait: { t0: 8, t1: 12, caught: true } });
    const tracks = nectarTracks(TIP, [catcher, blocker]);
    const [track] = tracks;
    // Its frame (9 in each way from x) clears the zone's 11 in once x passes 20: 0.15 s after 9 s.
    expect(track.appearAt).toBeGreaterThan(9.1);
    expect(track.appearAt).toBeLessThan(9.35);
    expect(nectarsAt(tracks, 9)).toEqual([]);
    expect(nectarAt(track, track.appearAt)!.state).toBe("zone");
    // And the roll does not start before that.
    expect(track.roll!.t0).toBeGreaterThanOrEqual(track.appearAt);
    expect(track.roll!.t1).toBe(12);
  });

  it("never appears for a robot that stays in the zone, and a catch then has nothing to draw", () => {
    const parked: Pose = { x: 14.5, y: 117.4, heading: 0 };
    const r = robot({ pose: parked, wait: { t0: 8, t1: 8.6, caught: true } });
    expect(nectarTracks(TIP, [r])).toEqual([]);
  });

  it("a catch takes the earliest NECTAR waiting, and a second catch the next", () => {
    const first = robot({ wait: { t0: 8, t1: 8.6, caught: true } });
    const second: NectarRobot = {
      ...robot({ wait: { t0: 16, t1: 16.6, caught: true } }),
      poseAt: () => ({ x: 44, y: 100, heading: 180 }),
    };
    const tracks = nectarTracks(
      [{ settled: 6 }, { settled: 14 }],
      [second, first],
    );
    expect(tracks[0].roll).toMatchObject({ robot: 1, t1: 8.6 });
    expect(tracks[1].roll).toMatchObject({ robot: 0, t1: 16.6 });
  });

  it("a wait that ended before the NECTAR appeared leaves it in the zone", () => {
    const r = robot({ wait: { t0: 3, t1: 5, caught: false } });
    const [track] = nectarTracks(TIP, [r]);
    expect(track.roll).toBeUndefined();
    expect(nectarAt(track, 20)!.state).toBe("zone");
  });
});
