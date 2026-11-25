/**
 * The driver's heading lock (biobuzz `opmodes/HeadingLock.java`, PR #748), ported line for line.
 * Held: the robot turns to the nearest cardinal (`headingLockStepDeg`) from where the press found it
 * and holds it, and a left stick within `headingLockConeDeg` of a field axis drives dead along it.
 * Let go: the sticks pass through from the next loop. Its numbers are the controls export's
 * (`teleOp.headingLock*`); a file without them has no HEADING_LOCK binding, so it is never held.
 *
 * Sticks are in the robot's drive terms: + forward, + strafe is left, + turn counter-clockwise,
 * already deadbanded and times the speed scale. Headings are the field-centric drive's, radians.
 */

/** `TurretEncoder.wrap180`: into (-180, 180]. */
function wrap180(d: number): number {
  let w = d % 360;
  if (w <= -180) w += 360;
  else if (w > 180) w -= 360;
  return w;
}
const deg = (r: number) => (r * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;
const unit = (v: number) => (v > 0 ? Math.min(v, 1) : 0);

/** The export's numbers (TeleOpConfig.headingLock*), as the robot reads them: NaN or absent is 0. */
export interface HeadingLockNumbers {
  coneDeg: number;
  stepDeg: number;
  kp: number;
  kd: number;
  minTurn: number;
  maxTurn: number;
  stopDeg: number;
}

export function headingLockNumbers(
  t: Record<string, number | boolean>,
): HeadingLockNumbers {
  const n = (k: string) => {
    const v = t[k];
    return typeof v === "number" ? v : NaN;
  };
  return {
    coneDeg: n("headingLockConeDeg"),
    stepDeg: n("headingLockStepDeg"),
    kp: n("headingLockKp"),
    kd: n("headingLockKd"),
    minTurn: n("headingLockMinTurn"),
    maxTurn: n("headingLockMaxTurn"),
    stopDeg: n("headingLockStopDeg"),
  };
}

/** `ChassisAimTurn.power`: 0 inside the stop band, else kp·|err| between min and max, signed. */
export function aimTurnPower(
  errDeg: number,
  kp: number,
  min: number,
  max: number,
  stopDeg: number,
): number {
  if (Math.abs(errDeg) <= stopDeg) return 0;
  const t = Math.abs(kp * rad(errDeg));
  return Math.sign(errDeg) * Math.min(max, Math.max(min, t));
}

export class HeadingLock {
  private heldWas = false;
  private holdingNow = false;
  private pressedNow = false;
  private releasedNow = false;
  private target = NaN;
  forward = 0;
  strafe = 0;
  turn = 0;

  constructor(private n: HeadingLockNumbers) {}

  update(
    held: boolean,
    headingOk: boolean,
    headingRad: number,
    rateRadPerS: number,
    forward: number,
    strafe: number,
    turn: number,
  ): void {
    this.pressedNow = held && !this.heldWas;
    this.releasedNow = !held && this.heldWas;
    this.heldWas = held;
    if (!held) {
      this.holdingNow = false;
      this.target = NaN;
      this.forward = forward;
      this.strafe = strafe;
      this.turn = turn;
      return;
    }
    const canHold = headingOk && !Number.isNaN(headingRad);
    // The press, or a heading that came back mid-hold: the nearest cardinal from here.
    if (canHold && !this.holdingNow)
      this.target = nearestCardinalRad(headingRad, this.stepDeg());
    this.holdingNow = canHold;
    if (!this.holdingNow) this.target = NaN;

    const cone = rad(this.coneDeg());
    const angle = Math.atan2(strafe, forward);
    const quarter = Math.PI / 2;
    const axis = Math.round(angle / quarter);
    const m = Math.hypot(forward, strafe);
    if (m > 0 && Math.abs(angle - axis * quarter) <= cone) {
      switch ((((axis % 4) + 4) % 4) as 0 | 1 | 2 | 3) {
        case 0:
          this.forward = m;
          this.strafe = 0;
          break;
        case 1:
          this.forward = 0;
          this.strafe = m;
          break;
        case 2:
          this.forward = -m;
          this.strafe = 0;
          break;
        default:
          this.forward = 0;
          this.strafe = -m;
      }
    } else {
      this.forward = forward;
      this.strafe = strafe;
    }
    this.turn = this.holdingNow
      ? this.holdTurn(errorRad(this.target, headingRad), rateRadPerS)
      : turn;
  }

  get targetRad(): number {
    return this.target;
  }
  get holding(): boolean {
    return this.holdingNow;
  }
  get held(): boolean {
    return this.heldWas;
  }
  get pressed(): boolean {
    return this.pressedNow;
  }
  get released(): boolean {
    return this.releasedNow;
  }

  private holdTurn(errRad: number, rate: number): number {
    const n = this.n;
    const max = unit(n.maxTurn);
    const min = Math.min(unit(n.minTurn), max);
    const stop = n.stopDeg > 0 ? Math.min(n.stopDeg, 10) : 0;
    const kp = n.kp > 0 ? Math.min(n.kp, 10) : 0;
    const kd = n.kd > 0 ? Math.min(n.kd, 2) : 0;
    const p = aimTurnPower(deg(errRad), kp, min, max, stop);
    const d = Number.isNaN(rate) ? 0 : kd * rate;
    return Math.max(-max, Math.min(max, p - d));
  }

  coneDeg(): number {
    const v = this.n.coneDeg;
    return v > 0 ? Math.min(v, 45) : 0;
  }

  stepDeg(): number {
    const v = this.n.stepDeg;
    if (!(v > 0)) return 90;
    const k = Math.max(2, Math.min(24, Math.round(360 / v)));
    return 360 / k;
  }
}

export function nearestCardinalRad(
  headingRad: number,
  stepDeg: number,
): number {
  const step = rad(stepDeg);
  const snapped = Math.round(headingRad / step) * step;
  return rad(wrap180(deg(snapped)));
}

export function errorRad(targetRad: number, headingRad: number): number {
  return rad(wrap180(deg(targetRad - headingRad)));
}
