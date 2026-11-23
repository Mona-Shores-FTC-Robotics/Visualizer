/**
 * The robot's practice readout, ported line for line from biobuzz's
 * `opmodes/CycleReadout.java` (PR #719): every pick-up and every cycle timed the moment it
 * ends, with the same split and the same names, so a time in the drill means what it means on
 * the Driver Station and in `read_logs.py cycles`.
 *
 * - A cycle runs from the end of one feed to the end of the next; the first from PLAY.
 * - A feed is the feed gate's open window; one that opens again within MERGE_S of closing is
 *   the same feed. Its balls are the launches from the gate opening to SHOTS_AFTER_CLOSE_S after
 *   it closed. A feed that launched nothing is no volley: it is counted on the next as an empty feed.
 * - The split: drive to pieces (to the first piece in), pick up (first piece to last), drive
 *   loaded (last piece to the fire press), spin-up and aim (the press to the gate opening), feed
 *   (gate open to gate shut). The press is the first after the last piece in.
 * - The pick-up line: first piece in to the lane reading full, or, when the gate opens on a lane
 *   not yet full, first piece to last ("fired short").
 */

export const MERGE_S = 1.0;
export const SHOTS_AFTER_CLOSE_S = 0.4;
export const BUDGET_S = 9.3;
export const BUDGET_PIECES = 4;

export interface CycleResult {
  n: number;
  /** When the cycle ended (the gate shut), seconds from PLAY. */
  atS: number;
  cycleS: number;
  balls: number;
  toPiecesS: number;
  pickUpS: number;
  driveLoadedS: number;
  spinUpAimS: number;
  feedS: number;
  emptyFeeds: number;
  earlyPresses: number;
}

export interface PickUpResult {
  atS: number;
  s: number;
  pieces: number;
  full: boolean;
}

type Gate = "SHUT" | "OPEN" | "CLOSING";

export class CycleReadout {
  private cycleStartS = 0;
  private ins: number[] = [];
  private presses: number[] = [];
  private emptyFeeds = 0;
  private pickUpShown = false;
  private pickUpWhileClosing = false;
  private lastFull = false;
  private gate: Gate = "SHUT";
  private openS = 0;
  private closeS = 0;
  private launchedAtOpen = 0;
  private launchedAtClose = 0;
  private closeCounted = false;

  readonly cycles: CycleResult[] = [];
  readonly pickUps: PickUpResult[] = [];
  /** Lines as the robot logs them ("practice: …"), newest last. */
  readonly log: string[] = [];

  constructor(private onEvent: (line: string) => void = () => {}) {}

  /** PLAY: the first cycle starts here, and the session's numbers start over. */
  start(tS: number): void {
    this.cycleStartS = tS;
    this.ins = [];
    this.presses = [];
    this.emptyFeeds = 0;
    this.pickUpShown = this.pickUpWhileClosing = this.lastFull = false;
    this.gate = "SHUT";
    this.cycles.length = 0;
    this.pickUps.length = 0;
    this.log.length = 0;
  }

  /**
   * One loop.
   * @param tS seconds since PLAY
   * @param pieceIn a piece came into the lane this loop
   * @param laneFull the lane reads full
   * @param firePress the driver's fire went down this loop
   * @param gateOpen the feed gate is open, feeding
   * @param launched the launches so far
   */
  update(
    tS: number,
    pieceIn: boolean,
    laneFull: boolean,
    firePress: boolean,
    gateOpen: boolean,
    launched: number,
  ): void {
    if (pieceIn) this.ins.push(tS);
    if (firePress) this.presses.push(tS);

    if (
      laneFull &&
      !this.lastFull &&
      !this.pickUpShown &&
      this.ins.length > 0 &&
      this.gate !== "OPEN"
    ) {
      this.pickUp(tS, tS - this.ins[0], true);
    }
    this.lastFull = laneFull;

    switch (this.gate) {
      case "SHUT":
        if (gateOpen) {
          this.gate = "OPEN";
          this.pickUpWhileClosing = false;
          this.openS = tS;
          this.launchedAtOpen = launched;
          const n = countUpTo(this.ins, this.openS);
          if (!this.pickUpShown && n > 0)
            this.pickUp(tS, this.ins[n - 1] - this.ins[0], false);
        }
        break;
      case "OPEN":
        if (!gateOpen) {
          this.gate = "CLOSING";
          this.closeS = tS;
          this.closeCounted = false;
        }
        break;
      case "CLOSING":
        if (gateOpen) {
          this.gate = "OPEN";
          break;
        }
        if (!this.closeCounted && tS >= this.closeS + SHOTS_AFTER_CLOSE_S) {
          this.launchedAtClose = launched;
          this.closeCounted = true;
        }
        if (tS >= this.closeS + MERGE_S) {
          if (!this.closeCounted) this.launchedAtClose = launched;
          this.gate = "SHUT";
          this.feedEnded(tS, laneFull);
        }
        break;
    }
  }

  private feedEnded(tS: number, laneFull: boolean): void {
    const balls = this.launchedAtClose - this.launchedAtOpen;
    if (balls <= 0) {
      this.emptyFeeds++;
      return;
    }
    const nIn = countUpTo(this.ins, this.openS);
    const nPress = countUpTo(this.presses, this.openS);
    let first = 0;
    if (nIn > 0) {
      while (first < nPress && this.presses[first] < this.ins[nIn - 1]) first++;
    }
    const press = first < nPress ? this.presses[first] : this.openS;
    const firstIn = nIn > 0 ? this.ins[0] : press;
    const lastIn = nIn > 0 ? this.ins[nIn - 1] : press;
    const r: CycleResult = {
      n: this.cycles.length + 1,
      atS: this.closeS,
      cycleS: this.closeS - this.cycleStartS,
      balls,
      toPiecesS: firstIn - this.cycleStartS,
      pickUpS: lastIn - firstIn,
      driveLoadedS: press - lastIn,
      spinUpAimS: this.openS - press,
      feedS: this.closeS - this.openS,
      emptyFeeds: this.emptyFeeds,
      earlyPresses: first,
    };
    this.cycles.push(r);
    this.say(
      `practice: cycle ${r.n} ${f1(r.cycleS)} s, ${balls} balls: to pieces ${f1(r.toPiecesS)}, pick up ${f1(r.pickUpS)}, drive loaded ${f1(r.driveLoadedS)}, spin-up and aim ${f1(r.spinUpAimS)}, feed ${f1(r.feedS)} s; ${r.emptyFeeds} empty feeds, ${first} early presses`,
    );
    this.cycleStartS = this.closeS;
    this.ins = this.ins.filter((t) => t >= this.closeS);
    this.presses = this.presses.filter((t) => t >= this.closeS);
    this.emptyFeeds = 0;
    this.pickUpShown = this.pickUpWhileClosing;
    if (!this.pickUpShown && laneFull && this.ins.length > 0)
      this.pickUp(tS, this.ins[this.ins.length - 1] - this.ins[0], true);
  }

  private pickUp(atS: number, s: number, full: boolean): void {
    this.pickUpShown = true;
    if (this.gate === "CLOSING") this.pickUpWhileClosing = true;
    const p: PickUpResult = { atS, s, pieces: this.ins.length, full };
    this.pickUps.push(p);
    this.say(
      `practice: pick-up ${f1(s)} s, ${p.pieces} in, ${full ? "lane full" : "fired short"}`,
    );
  }

  private say(line: string): void {
    this.log.push(line);
    this.onEvent(line);
  }

  /** The session's best and median cycle and pick-up, NaN before the first. */
  stats(): {
    bestCycleS: number;
    medianCycleS: number;
    bestPickUpS: number;
    medianPickUpS: number;
  } {
    const c = this.cycles.map((x) => x.cycleS);
    const p = this.pickUps.map((x) => x.s);
    return {
      bestCycleS: c.length ? Math.min(...c) : NaN,
      medianCycleS: median(c),
      bestPickUpS: p.length ? Math.min(...p) : NaN,
      medianPickUpS: median(p),
    };
  }
}

/** The report's median: the sorted middle, the upper one of an even count. NaN when empty. */
export function median(a: number[]): number {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}

function countUpTo(a: number[], t: number): number {
  let k = 0;
  while (k < a.length && a[k] <= t) k++;
  return k;
}

const f1 = (v: number) => v.toFixed(1);
