/**
 * biobuzz `opmodes/FreshSticks`: whether the drive sticks take the robot back from a held routine
 * (the launch-spot drive, a FLOWER pick, a corner gather). Sticks always win, but only a stick
 * movement made after the press: a stick already off centre when the button went down is the
 * driver still driving up to it. That stick is stale; it becomes fresh, and from then on cancels,
 * when it comes back to centre once, or when it is still off centre `staleCancelsAfterS` after the
 * press (TeleOpConfig.staleStickCancelsAfterS: a driver still pushing by then means it).
 */
export class FreshSticks {
  private wasHeld = false;
  private stale = false;
  private pressS = 0;

  /** One step: whether the sticks take the robot back this loop. */
  moved(
    held: boolean,
    offCentre: boolean,
    nowS: number,
    staleCancelsAfterS: number,
  ): boolean {
    if (!held) {
      this.wasHeld = false;
      this.stale = false;
      return offCentre;
    }
    if (!this.wasHeld) {
      this.wasHeld = true;
      this.stale = offCentre;
      this.pressS = nowS;
    }
    if (
      this.stale &&
      (!offCentre || !(nowS - this.pressS < staleCancelsAfterS))
    )
      this.stale = false;
    return offCentre && !this.stale;
  }
}
