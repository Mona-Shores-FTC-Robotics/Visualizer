import { describe, expect, test } from "vitest";
import { CycleReadout, fullPickUps } from "../../src/drill/readout";

// The cases of biobuzz's CycleReadoutTest (TeamCode/src/test/.../opmodes/CycleReadoutTest.java),
// on the drill's port: the same events give the same split as the Driver Station and
// read_logs.py cycles.

const DT = 0.02;

class Rig {
  log: string[] = [];
  r = new CycleReadout((l) => this.log.push(l));
  t = 0;
  launched = 0;
  lane = 0;
  ins: number[] = [];
  presses: number[] = [];
  gates: [number, number][] = [];
  shots: number[] = [];
  constructor() {
    this.r.start(0);
  }
  in(...ts: number[]) {
    this.ins.push(...ts);
    return this;
  }
  press(x: number) {
    this.presses.push(x);
    return this;
  }
  feed(a: number, b: number, balls: number) {
    this.gates.push([a, b]);
    for (let i = 0; i < balls; i++)
      this.shots.push(a + ((b - a) * (i + 0.5)) / balls);
    return this;
  }
  runTo(end: number) {
    while (this.t < end - 1e-9) {
      this.t += DT;
      const t = this.t,
        w = (x: number) => x > t - DT && x <= t;
      const pieceIn = this.ins.some(w);
      if (pieceIn) this.lane++;
      const press = this.presses.some(w);
      const gate = this.gates.some(([a, b]) => t >= a && t < b);
      for (const x of this.shots)
        if (w(x)) {
          this.launched++;
          this.lane = Math.max(0, this.lane - 1);
        }
      this.r.update(t, pieceIn, this.lane >= 4, press, gate, this.launched);
    }
  }
}

const last = (g: Rig) => g.r.cycles[g.r.cycles.length - 1];

describe("practice readout, as the robot's", () => {
  test("the report's fixture gives the report's split", () => {
    const g = new Rig()
      .in(5, 8, 30, 33, 44)
      .press(19.6)
      .press(49.5)
      .feed(20, 21.5, 2)
      .feed(40, 40.3, 0)
      .feed(50, 52, 4);
    g.runTo(23);
    expect(g.r.cycles).toHaveLength(1);
    const c = last(g);
    expect(c.balls).toBe(2);
    expect(c.toPiecesS).toBeCloseTo(5, 1);
    expect(c.pickUpS).toBeCloseTo(3, 1);
    expect(c.driveLoadedS).toBeCloseTo(11.6, 1);
    expect(c.spinUpAimS).toBeCloseTo(0.4, 1);
    expect(c.feedS).toBeCloseTo(1.5, 1);
    g.runTo(60);
    expect(g.r.cycles).toHaveLength(2);
    const d = last(g);
    expect(d.balls).toBe(4);
    expect(d.emptyFeeds).toBe(1);
    expect(d.cycleS).toBeCloseTo(52 - 21.5, 1);
    expect(d.toPiecesS).toBeCloseTo(30 - 21.5, 1);
    expect(d.pickUpS).toBeCloseTo(14, 1);
    expect(d.driveLoadedS).toBeCloseTo(5.5, 1);
    expect(d.spinUpAimS).toBeCloseTo(0.5, 1);
    expect(d.feedS).toBeCloseTo(2, 1);
  });

  test("a full load is a pick-up to green, and a cycle to the feed's end", () => {
    const g = new Rig().in(2, 2.8, 3.6, 4.4).press(6).feed(6.4, 7.7, 4);
    g.runTo(4.5);
    expect(g.r.pickUps[0]).toMatchObject({ pieces: 4, full: true });
    expect(g.r.pickUps[0].s).toBeCloseTo(2.4, 1);
    expect(g.log[0]).toBe("practice: pick-up 2.4 s, 4 in, lane full");
    expect(g.r.cycles).toHaveLength(0);
    g.runTo(10);
    expect(last(g).balls).toBe(4);
  });

  test("the next cycle starts at the feed's end; the session keeps best and median", () => {
    const g = new Rig()
      .in(2, 2.5, 3, 3.5)
      .press(4)
      .feed(4.3, 5.5, 4)
      .in(9, 9.5, 10, 10.5)
      .press(11)
      .feed(11.3, 12.5, 4)
      .in(15, 15.5, 16, 16.5)
      .press(18)
      .feed(18.3, 19.5, 4);
    g.runTo(22);
    expect(g.r.cycles).toHaveLength(3);
    expect(last(g).cycleS).toBeCloseTo(7, 1);
    expect(last(g).toPiecesS).toBeCloseTo(15 - 12.5, 1);
    const s = g.r.stats();
    expect(s.bestCycleS).toBeCloseTo(5.5, 1);
    expect(s.medianCycleS).toBeCloseTo(7, 1);
    expect(s.bestPickUpS).toBeCloseTo(1.5, 1);
  });

  test("a short fire ends the pick-up at the last piece in", () => {
    const g = new Rig().in(2, 3, 3.8).press(5).feed(5.4, 6.4, 3);
    g.runTo(5.3);
    expect(g.r.pickUps).toHaveLength(0);
    g.runTo(5.5);
    expect(g.r.pickUps[0]).toMatchObject({ pieces: 3, full: false });
    expect(g.log[0]).toBe("practice: pick-up 1.8 s, 3 in, fired short");
    g.runTo(8);
    expect(last(g).balls).toBe(3);
  });

  test("best and median pick-up count full loads only: a short one stays listed but never sets them (mentor, 26 Nov 2026)", () => {
    // A 1-ball fire short (0 s), then a full load of 4 in 1.5 s.
    const g = new Rig()
      .in(2)
      .press(3)
      .feed(3.3, 4.3, 1)
      .in(8, 8.5, 9, 9.5)
      .press(11)
      .feed(11.3, 12.5, 4);
    g.runTo(5);
    expect(g.r.pickUps).toHaveLength(1);
    expect(g.r.pickUps[0]).toMatchObject({ pieces: 1, full: false, s: 0 });
    expect(fullPickUps(g.r.pickUps)).toEqual([]);
    expect(g.r.stats().bestPickUpS).toBeNaN();
    g.runTo(15);
    expect(g.r.pickUps).toHaveLength(2);
    expect(fullPickUps(g.r.pickUps)).toHaveLength(1);
    expect(g.r.stats().bestPickUpS).toBeCloseTo(1.5, 1);
    expect(g.r.stats().medianPickUpS).toBeCloseTo(1.5, 1);
  });
});
