/**
 * The robot's indicator light, as biobuzz master drives it: `IndicatorSubsystem.choose` picks the
 * signal (the first that holds), `ArcLight` gives the firing arc's part, and
 * `IndicatorSubsystem.position` the colour, a flashing one off half the time.
 *
 * After PLAY, highest first:
 *   - a fire held with the shot behind the firing arc (FIRING_OUTSIDE_ARC): orange, flashing;
 *   - Circle's arc turn has just started (ARC_TURN): one solid orange pulse;
 *   - the lane is full (FULL, the colour sensor's LaneFull): green;
 *   - the shot behind the firing arc (OUTSIDE_ARC): orange, steady;
 *   - otherwise off.
 * Before PLAY (INIT): the alliance's colour, steady (white flashing for an Auto's INIT warnings,
 * which a TeleOp never has).
 *
 * With `circleTurnsIntoArc` (BasicDriveTeleOp), ArcLight is told "outside" only while a fire is
 * held outside the arc that nothing is turning in, so the light is dark in normal driving and never
 * steady orange; without it, steady orange whenever the shot is behind the arc.
 *
 * The numbers are the export's `indicator` block (controls.json, ControlsExport) when it has one,
 * else master's values: FLASH_MS 250, ARC_TURN_PULSE_MS 400 and ArcLight.CLEAR_MS 300.
 */

export type Signal =
  | "OFF"
  | "CHECK_DRIVER_STATION"
  | "FULL"
  | "ALLIANCE_RED"
  | "ALLIANCE_BLUE"
  | "OUTSIDE_ARC"
  | "FIRING_OUTSIDE_ARC"
  | "ARC_TURN";

export type ArcState = "NONE" | "ORANGE" | "FLASH" | "PULSE";

export interface IndicatorNumbers {
  /** A flashing signal is on this long, then off as long (IndicatorSubsystem.FLASH_MS). */
  flashMs: number;
  /** The arc turn's solid orange (IndicatorSubsystem.ARC_TURN_PULSE_MS); 0 or less: none. */
  arcTurnPulseMs: number;
  /** Back inside the arc this long before the orange clears (ArcLight.CLEAR_MS). */
  arcLightClearMs: number;
}

export const INDICATOR_DEFAULTS: IndicatorNumbers = {
  flashMs: 250,
  arcTurnPulseMs: 400,
  arcLightClearMs: 300,
};

/** IndicatorSubsystem.choose, all seven arguments. Pure. */
export function choose(
  init: boolean,
  warnings: boolean,
  full: boolean,
  alliance: "red" | "blue" | null,
  outsideArc: boolean,
  firingThere: boolean,
  arcTurnPulse: boolean,
): Signal {
  if (init && warnings) return "CHECK_DRIVER_STATION";
  if (!init) {
    if (outsideArc && firingThere) return "FIRING_OUTSIDE_ARC";
    if (arcTurnPulse) return "ARC_TURN";
    if (full) return "FULL";
    return outsideArc ? "OUTSIDE_ARC" : "OFF";
  }
  if (alliance === "red") return "ALLIANCE_RED";
  if (alliance === "blue") return "ALLIANCE_BLUE";
  return "OFF";
}

/** The light's colour for a signal (IndicatorSubsystem.position, as the colour it names), or null off. */
export type LightColour = "red" | "green" | "orange" | "blue" | "white";

export function colour(
  signal: Signal,
  nowMs: number,
  flashMs = INDICATOR_DEFAULTS.flashMs,
): LightColour | null {
  const on = Math.floor(nowMs / Math.max(50, flashMs)) % 2 === 0;
  switch (signal) {
    case "CHECK_DRIVER_STATION":
      return on ? "white" : null;
    case "FULL":
      return "green";
    case "OUTSIDE_ARC":
    case "ARC_TURN":
      return "orange";
    case "FIRING_OUTSIDE_ARC":
      return on ? "orange" : null;
    case "ALLIANCE_RED":
      return "red";
    case "ALLIANCE_BLUE":
      return "blue";
    default:
      return null;
  }
}

/** ArcLight: the firing arc's part of the light. */
export class ArcLight {
  private pulseUntilMs = -Infinity;
  private lastOutsideMs = -Infinity;

  constructor(private clearMs = INDICATOR_DEFAULTS.arcLightClearMs) {}

  /** Starts the arc turn's pulse; it also clears the flash's hold from before. */
  pulse(nowMs: number, lengthMs: number): void {
    this.pulseUntilMs = nowMs + Math.max(0, lengthMs);
    this.lastOutsideMs = -Infinity;
  }

  update(outsideArc: boolean, fireHeld: boolean, nowMs: number): ArcState {
    if (outsideArc) this.lastOutsideMs = nowMs;
    const lit = nowMs - this.lastOutsideMs < this.clearMs;
    if (lit && fireHeld) return "FLASH";
    if (nowMs < this.pulseUntilMs) return "PULSE";
    return lit ? "ORANGE" : "NONE";
  }
}

/**
 * One robot's light, as RobotOpMode.showIndicator and BasicDriveTeleOp feed it each loop: the arc
 * light from the shot's place and the fire, the pulse when the arc turn starts, and the lane.
 */
export class Indicator {
  private arc: ArcLight;
  private turningWas = false;
  signal: Signal = "OFF";
  arcState: ArcState = "NONE";

  constructor(readonly numbers: IndicatorNumbers = INDICATOR_DEFAULTS) {
    this.arc = new ArcLight(numbers.arcLightClearMs);
  }

  /**
   * One loop after PLAY.
   *
   * @param outsideArc the turret, or in AIM the aim, points behind the firing arc
   * @param wantsFeed  a fire is held (Circle, or Square's volley asking to feed)
   * @param arcTurning Circle's arc turn is turning the robot this loop
   * @param circleTurnsIntoArc TeleOpConfig.circleTurnsIntoArc
   * @param full       the lane is full
   */
  update(
    nowMs: number,
    outsideArc: boolean,
    wantsFeed: boolean,
    arcTurning: boolean,
    circleTurnsIntoArc: boolean,
    full: boolean,
  ): Signal {
    if (arcTurning && !this.turningWas)
      this.arc.pulse(nowMs, this.numbers.arcTurnPulseMs);
    this.turningWas = arcTurning;
    const a = this.arc.update(
      circleTurnsIntoArc ? wantsFeed && outsideArc && !arcTurning : outsideArc,
      wantsFeed,
      nowMs,
    );
    this.arcState = a;
    this.signal = choose(
      false,
      false,
      full,
      null,
      a === "ORANGE" || a === "FLASH",
      a === "FLASH",
      a === "PULSE",
    );
    return this.signal;
  }

  /** Before PLAY: the alliance's colour. */
  init(alliance: "red" | "blue"): Signal {
    this.signal = choose(true, false, false, alliance, false, false, false);
    return this.signal;
  }

  colour(nowMs: number): LightColour | null {
    return colour(this.signal, nowMs, this.numbers.flashMs);
  }
}
