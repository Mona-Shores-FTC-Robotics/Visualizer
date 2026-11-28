/**
 * Fork: the human player's NECTAR as the field draws it, at a moment of the preview (biobuzz PR
 * #782). The human enters one NECTAR per TIP of our HIVE into our LOADING ZONE; a robot running
 * `CatchNectar` beside a wait on `NectarIn` takes it in, and `LaunchOneAimed` fires it with the
 * turret into the CELL at the robot's end.
 *
 * The preview decides everything that happens (when a TIP settles, when a wait ends and on what,
 * when a launch lands); this only places the piece between those moments:
 *
 * - it appears at {@link nectarRelease} when its TIP has settled, or, with a robot in the zone
 *   then, once the zone is clear (G427.C: the human does not enter it while a robot is in the zone);
 * - a catch whose wait ends on `NectarIn` (✓) takes the earliest NECTAR that has appeared and is
 *   still in the zone: it rolls in a straight line to the robot's intake mouth (the front of its
 *   frame) and arrives as the wait ends;
 * - a catch whose wait ends any other way (✗, its time limit or the endgame guard) sends it only
 *   {@link NECTAR_SHORT} of the way: it stops there and stays, and no later catch takes it;
 * - a caught NECTAR rides in the robot until that robot's next `LaunchOneAimed` that fires, then
 *   flies to the CELL at the robot's end over the launch's last {@link NECTAR_FLIGHT_S}, landing
 *   as the launch ends (when the preview's HIVE counts it), and is drawn no more: it is the CELL's;
 * - one nobody catches stays where it is.
 *
 * Only red: the Visualizer draws the red alliance (see hiveView.ts).
 */
import type { PreviewResult } from "../auto/simulate";
import type { RobotConfig } from "../../types";
import { boxCentre, robotFootprint } from "../../model/collision";
import { polygonsOverlap } from "../../utils/geometry";
import { aimedLeft } from "../timing/model";
import { RED_CELLS } from "./hiveView";

interface Point {
  x: number;
  y: number;
}

/** Red's LOADING ZONE, Pedro's frame, inches (biobuzz PR #782). */
export const LOADING_ZONE = { x: 0, y: 94, w: 11, h: 24 };
/**
 * Where the human lets a NECTAR go: the zone's middle, 5 in off the wall. A placeholder until the
 * human player's release is measured.
 */
export const NECTAR_RELEASE: Point = {
  x: 5,
  y: LOADING_ZONE.y + LOADING_ZONE.h / 2,
};
/** How far apart NECTARs waiting in the zone are drawn, along the wall, so two are seen as two. */
export const NECTAR_SPACING_IN = 4;
/**
 * Inches a second a NECTAR rolls across the tiles; a placeholder. A caught one arrives as its wait
 * ends whatever this says, so it only sets when the roll starts (never before the piece appears).
 */
export const NECTAR_ROLL_SPEED = 30;
/** How far toward the intake a NECTAR that is not caught rolls before it stops (0 to 1). */
export const NECTAR_SHORT = 0.5;
/** Seconds the NECTAR is drawn flying to the CELL, the last of its launch. */
export const NECTAR_FLIGHT_S = 0.5;
/** Inches behind the intake mouth a held NECTAR is drawn. */
export const NECTAR_HELD_IN = 3;
/** Seconds between looks at the zone while waiting for a robot to leave it. */
const ZONE_STEP_S = 0.1;
/** The last moment a NECTAR may appear: past the 38 s a TIP may take to count as AUTO. */
const HORIZON_S = 40;

export const CATCH_COMMAND = "CatchNectar";
export const NECTAR_IN = "NectarIn";
export const NECTAR_SHOT_COMMAND = "LaunchOneAimed";

/** One robot on the field, as the NECTAR needs it. */
export interface NectarRobot {
  preview: Pick<PreviewResult, "launches" | "actions" | "waits">;
  /** Where the robot is at `t` (heading in degrees); a robot that has finished stays at its end. */
  poseAt(t: number): { x: number; y: number; heading: number };
  /** Its frame, for the zone check and the intake mouth. */
  frame: Pick<RobotConfig, "rLength" | "rWidth" | "rForward">;
}

/** One NECTAR's whole preview. */
export interface NectarTrack {
  /** The TIP it was entered for (index in the tips given). */
  tip: number;
  /** When the human enters it. */
  appearAt: number;
  /** Where it appears. */
  from: Point;
  /** Its roll toward a robot's intake: caught at `t1` and `to`, or stopped there. */
  roll?: { t0: number; t1: number; to: Point; robot: number; caught: boolean };
  /** Where it rides once caught. */
  heldAt?: (t: number) => Point;
  /** Its flight to the CELL; it lands, and is drawn no more, at `t1`. */
  flight?: { t0: number; t1: number; from: Point; to: Point };
}

export type NectarState = "zone" | "rolling" | "stopped" | "held" | "flying";

/** A NECTAR at a moment. */
export interface NectarView extends Point {
  tip: number;
  state: NectarState;
}

/** Where NECTAR `index` (by TIP) is let go: the release point, successive ones spread along the wall. */
export function nectarRelease(index: number): Point {
  // 0, +1, -1, +2, -2 spacings: all inside the zone.
  const step = (index % 2 === 1 ? 1 : -1) * Math.ceil((index % 5) / 2);
  return {
    x: NECTAR_RELEASE.x,
    y: NECTAR_RELEASE.y + step * NECTAR_SPACING_IN,
  };
}

const ZONE_CORNERS: Point[] = [
  { x: LOADING_ZONE.x, y: LOADING_ZONE.y },
  { x: LOADING_ZONE.x + LOADING_ZONE.w, y: LOADING_ZONE.y },
  { x: LOADING_ZONE.x + LOADING_ZONE.w, y: LOADING_ZONE.y + LOADING_ZONE.h },
  { x: LOADING_ZONE.x, y: LOADING_ZONE.y + LOADING_ZONE.h },
];

/** Whether `robot`'s frame is in our LOADING ZONE at `t`. */
export function inLoadingZone(robot: NectarRobot, t: number): boolean {
  return polygonsOverlap(
    robotFootprint(robot.poseAt(t), {
      ...robot.frame,
      features: [],
      safetyMargin: 0,
    }),
    ZONE_CORNERS,
  );
}

/** The middle of the front of `robot`'s frame at `t`, `inside` inches back from it. */
export function intakeMouth(robot: NectarRobot, t: number, inside = 0): Point {
  const pose = robot.poseAt(t);
  const centre = boxCentre(pose, robot.frame);
  const rad = (pose.heading * Math.PI) / 180;
  const ahead = robot.frame.rLength / 2 - inside;
  return {
    x: centre.x + ahead * Math.cos(rad),
    y: centre.y + ahead * Math.sin(rad),
  };
}

/** The first moment at or after `t0` with no robot in the zone, looked for every ZONE_STEP_S; null if never. */
function zoneClearFrom(robots: NectarRobot[], t0: number): number | null {
  for (let t = t0; t <= HORIZON_S + 1e-9; t += ZONE_STEP_S)
    if (!robots.some((robot) => inLoadingZone(robot, t))) return t;
  return null;
}

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const lerp = (a: Point, b: Point, p: number): Point => ({
  x: a.x + (b.x - a.x) * p,
  y: a.y + (b.y - a.y) * p,
});

/** Every NECTAR of a preview: one per TIP (`tips` in order), with what the robots do with it. */
export function nectarTracks(
  tips: { settled: number }[],
  robots: NectarRobot[],
): NectarTrack[] {
  const tracks: NectarTrack[] = [];
  tips.forEach((tip, index) => {
    const appearAt = zoneClearFrom(robots, tip.settled);
    if (appearAt !== null)
      tracks.push({ tip: index, appearAt, from: nectarRelease(index) });
  });
  if (!tracks.length) return tracks;

  /** Each robot's catches (CatchNectar beside a wait), in the order they start. */
  const catches = robots
    .flatMap((robot, index) =>
      robot.preview.launches
        .filter((launch) => launch.command === CATCH_COMMAND)
        .flatMap((launch) => {
          const wait = robot.preview.waits.find(
            (w) =>
              w.cardId === launch.cardId && Math.abs(w.t0 - launch.t0) < 1e-6,
          );
          return wait ? [{ robot: index, wait }] : [];
        }),
    )
    .sort((a, b) => a.wait.t0 - b.wait.t0);
  /** LaunchOneAimed runs already given a NECTAR, by robot. */
  const fired = robots.map(() => new Set<object>());

  for (const { robot: index, wait } of catches) {
    const robot = robots[index];
    // The earliest NECTAR that is in the zone, untouched, before this wait ends.
    const track = tracks
      .filter((t) => !t.roll && t.appearAt < wait.t1 - 1e-9)
      .sort((a, b) => a.appearAt - b.appearAt)[0];
    if (!track) continue;
    const mouth = intakeMouth(robot, wait.t1);
    const caught = wait.ended === "trigger" && wait.condition === NECTAR_IN;
    if (!caught) {
      const to = lerp(track.from, mouth, NECTAR_SHORT);
      const t0 = Math.max(track.appearAt, wait.t0);
      track.roll = {
        t0,
        t1: t0 + distance(track.from, to) / NECTAR_ROLL_SPEED,
        to,
        robot: index,
        caught: false,
      };
      continue;
    }
    track.roll = {
      t0: Math.max(
        track.appearAt,
        wait.t1 - distance(track.from, mouth) / NECTAR_ROLL_SPEED,
      ),
      t1: wait.t1,
      to: mouth,
      robot: index,
      caught: true,
    };
    track.heldAt = (t) => intakeMouth(robot, t, NECTAR_HELD_IN);
    const shot = [...robot.preview.actions, ...robot.preview.launches]
      .filter(
        (a) =>
          a.command === NECTAR_SHOT_COMMAND &&
          !a.unfired &&
          a.t0 >= wait.t1 - 1e-6 &&
          !fired[index].has(a),
      )
      .sort((a, b) => a.t0 - b.t0)[0];
    if (!shot) continue;
    fired[index].add(shot);
    const t0 = Math.max(shot.t0, shot.t1 - NECTAR_FLIGHT_S);
    // The CELL at the robot's end of the field: the only one it can score (and the one the turret aims at).
    const cell = RED_CELLS[aimedLeft(robot.poseAt(t0).y) ? "left" : "right"];
    track.flight = {
      t0,
      t1: shot.t1,
      from: track.heldAt(t0),
      to: { x: cell.x + cell.w / 2, y: cell.y + cell.h / 2 },
    };
  }
  return tracks;
}

/** One NECTAR at `t`; null before it appears and after it lands in the CELL. */
export function nectarAt(track: NectarTrack, t: number): NectarView | null {
  if (t < track.appearAt - 1e-9) return null;
  const view = (at: Point, state: NectarState): NectarView => ({
    x: at.x,
    y: at.y,
    tip: track.tip,
    state,
  });
  const { roll, flight } = track;
  if (!roll || t < roll.t0) return view(track.from, "zone");
  if (t < roll.t1)
    return view(
      lerp(
        track.from,
        roll.to,
        (t - roll.t0) / Math.max(1e-6, roll.t1 - roll.t0),
      ),
      "rolling",
    );
  if (!roll.caught || !track.heldAt) return view(roll.to, "stopped");
  if (!flight || t < flight.t0) return view(track.heldAt(t), "held");
  if (t < flight.t1)
    return view(
      lerp(
        flight.from,
        flight.to,
        (t - flight.t0) / Math.max(1e-6, flight.t1 - flight.t0),
      ),
      "flying",
    );
  return null;
}

/** The NECTARs on the field at `t`. */
export function nectarsAt(tracks: NectarTrack[], t: number): NectarView[] {
  const out: NectarView[] = [];
  for (const track of tracks) {
    const view = nectarAt(track, t);
    if (view) out.push(view);
  }
  return out;
}
