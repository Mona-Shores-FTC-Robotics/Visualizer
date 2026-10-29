import type { RobotConfig } from "../types";

export interface MotionProfile {
  /** Seconds to cover the distance. */
  duration: number;
  /** Inches covered after `time` seconds. */
  distanceAt(time: number): number;
}

type ProfileLimits = Pick<
  RobotConfig,
  | "forwardVelocity"
  | "strafeVelocity"
  | "maxVelocity"
  | "maxAcceleration"
  | "maxDeceleration"
>;

/**
 * A trapezoidal velocity profile over `distance` inches, or a triangular one
 * when the distance is too short to reach full speed. Full speed is the
 * `maxVelocity` when the robot sets one (a fork addition), else the average of
 * the forward and strafe velocities, since the profile doesn't know which way
 * the robot is heading. Without usable acceleration limits the robot
 * drives at that speed throughout.
 */
export function motionProfile(
  distance: number,
  limits: ProfileLimits,
): MotionProfile {
  if (distance <= 0) return { duration: 0, distanceAt: () => 0 };

  const maxVelocity =
    limits.maxVelocity && limits.maxVelocity > 0
      ? limits.maxVelocity
      : (limits.forwardVelocity + limits.strafeVelocity) / 2;
  const acceleration = limits.maxAcceleration;
  const deceleration = limits.maxDeceleration || acceleration;
  if (!(acceleration > 0 && deceleration > 0)) {
    return {
      duration: distance / maxVelocity,
      distanceAt: (time) => clampTo(time * maxVelocity, distance),
    };
  }

  const peakVelocity = Math.min(
    maxVelocity,
    Math.sqrt(
      (2 * distance * acceleration * deceleration) /
        (acceleration + deceleration),
    ),
  );
  const accelerationTime = peakVelocity / acceleration;
  const decelerationTime = peakVelocity / deceleration;
  const accelerationDistance = 0.5 * acceleration * accelerationTime ** 2;
  const decelerationDistance = 0.5 * deceleration * decelerationTime ** 2;
  const cruiseTime = Math.max(
    0,
    (distance - accelerationDistance - decelerationDistance) / peakVelocity,
  );
  const cruiseEnd = accelerationTime + cruiseTime;

  return {
    duration: cruiseEnd + decelerationTime,
    distanceAt(time) {
      if (time <= 0) return 0;
      if (time <= accelerationTime) return 0.5 * acceleration * time ** 2;
      if (time <= cruiseEnd) {
        return accelerationDistance + peakVelocity * (time - accelerationTime);
      }
      const braking = Math.min(time - cruiseEnd, decelerationTime);
      return clampTo(
        accelerationDistance +
          peakVelocity * cruiseTime +
          peakVelocity * braking -
          0.5 * deceleration * braking ** 2,
        distance,
      );
    },
  };
}

function clampTo(value: number, max: number) {
  return Math.min(Math.max(value, 0), max);
}

/** Seconds into `profile` at which `distance` inches are covered (its inverse). */
export function timeAtDistance(
  profile: MotionProfile,
  distance: number,
): number {
  if (distance <= 0) return 0;
  let low = 0;
  let high = profile.duration;
  if (profile.distanceAt(high) <= distance) return high;
  // Distance only grows with time, so bisect.
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (profile.distanceAt(mid) < distance) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/**
 * Fork: a run's timing when the robot cannot turn fast enough to hold the heading the path
 * asks for. The trapezoid times the driving; wherever the heading changes faster than
 * `aVelocity` (rad/s) allows, that stretch takes as long as the turn. Without this the preview
 * spins the robot through a piecewise or tight linear turn at any speed (25 Oct 2026: the robot
 * took 1.17 s for R-Quals' FAR_FLOWER to N_FIRE, a 180° turn in 15.5 in; the drive alone
 * previews at 0.78 s). Null when turning never limits the run.
 */
export function turnLimitedTimes(
  profile: MotionProfile,
  totalLength: number,
  headingAt: (distance: number) => number,
  aVelocity: number,
): { distances: number[]; times: number[] } | null {
  if (!(totalLength > 0) || !(aVelocity > 0)) return null;
  // A coarse look first: a path whose heading barely changes (most of them) costs 9 samples.
  const coarse = 8;
  const fastestCoarse = totalLength / coarse / peakSpeed(profile, totalLength);
  let previous = headingAt(0);
  let worth = false;
  for (let i = 1; i <= coarse && !worth; i++) {
    const heading = headingAt((totalLength * i) / coarse);
    const turn = Math.abs(((((heading - previous) % 360) + 540) % 360) - 180);
    // A turn bunched into a short stretch inside one coarse step can still bind, so look closer
    // well before the coarse average does.
    worth = (turn * Math.PI) / 180 / aVelocity > 0.1 * fastestCoarse;
    previous = heading;
  }
  if (!worth) return null;
  const steps = Math.min(40, Math.max(16, Math.ceil(totalLength / 2)));
  // Most paths turn slowly enough: the fastest a step could be driven is at full speed, so if
  // no step turns more than that allows, turning never limits the run.
  const headings: number[] = [];
  for (let i = 0; i <= steps; i++)
    headings.push(headingAt((totalLength * i) / steps));
  const fastest = totalLength / steps / peakSpeed(profile, totalLength);
  const turnOf = (i: number) =>
    (Math.abs(((((headings[i] - headings[i - 1]) % 360) + 540) % 360) - 180) *
      Math.PI) /
    180 /
    aVelocity;
  let anyLimited = false;
  for (let i = 1; i <= steps && !anyLimited; i++)
    anyLimited = turnOf(i) > fastest;
  if (!anyLimited) return null;
  const distances = [0];
  const times = [0];
  // The drive's time at each distance, from one pass over its profile (no search per step).
  const grid = 120;
  const gridTimes: number[] = [];
  const gridDistances: number[] = [];
  for (let k = 0; k <= grid; k++) {
    const t = (profile.duration * k) / grid;
    gridTimes.push(t);
    gridDistances.push(profile.distanceAt(t));
  }
  const driveTime = (distance: number) => {
    let k = 1;
    while (k < grid && gridDistances[k] < distance) k++;
    const span = gridDistances[k] - gridDistances[k - 1];
    const f = span > 0 ? (distance - gridDistances[k - 1]) / span : 1;
    return (
      gridTimes[k - 1] +
      Math.min(1, Math.max(0, f)) * (gridTimes[k] - gridTimes[k - 1])
    );
  };
  let previousDrive = 0;
  let limited = false;
  for (let i = 1; i <= steps; i++) {
    const distance = (totalLength * i) / steps;
    const drive = driveTime(distance);
    const turnTime = turnOf(i);
    const step = Math.max(drive - previousDrive, turnTime);
    if (turnTime > drive - previousDrive + 1e-9) limited = true;
    distances.push(distance);
    times.push(times[i - 1] + step);
    previousDrive = drive;
  }
  return limited ? { distances, times } : null;
}

/** The highest speed (in/s) a profile reaches over `length`. */
function peakSpeed(profile: MotionProfile, length: number): number {
  // Its average over the middle tenth of the time is close enough, and never above the peak.
  const t = profile.duration / 2;
  const dt = profile.duration / 20;
  const speed =
    (profile.distanceAt(t + dt) - profile.distanceAt(t - dt)) / (2 * dt);
  return speed > 0 ? speed : length / Math.max(profile.duration, 1e-9);
}

/** Distance covered `time` seconds into a table from `turnLimitedTimes`. */
export function distanceInTable(
  table: { distances: number[]; times: number[] },
  time: number,
): number {
  const { distances, times } = table;
  if (time <= 0) return 0;
  const last = times.length - 1;
  if (time >= times[last]) return distances[last];
  let low = 0;
  let high = last;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (times[mid] <= time) low = mid;
    else high = mid;
  }
  const span = times[high] - times[low];
  const f = span > 0 ? (time - times[low]) / span : 1;
  return distances[low] + f * (distances[high] - distances[low]);
}

/**
 * Distance into a run `time` seconds after it starts: the run's turn table when turning
 * limits it, else the trapezoid, scaled to the run's own duration (a timeline built at another
 * drive speed stays in step).
 */
export function runDistanceAt(
  run: {
    totalLength: number;
    totalTime: number;
    turn?: { distances: number[]; times: number[] };
  },
  limits: ProfileLimits,
  time: number,
): number {
  if (run.turn) return distanceInTable(run.turn, time);
  const profile = motionProfile(run.totalLength, limits);
  const scale = run.totalTime > 0 ? profile.duration / run.totalTime : 1;
  return profile.distanceAt(Math.min(time, run.totalTime) * scale);
}
