/**
 * NECTAR in the drill: our human player, entering our 5 NECTAR as biobuzz's
 * `doc/human-player-playbook.md` says, and the rule the robot keeps at the lane entrance (see
 * `TeleOp`'s NECTAR gate).
 *
 * The playbook's human player:
 * - enters one NECTAR for each TIP of our HIVE (G426.A), and all the rest once the field timer reads
 *   1:00 or less (G426.B), but never one early: a MINOR FOUL each;
 * - waits for the robot that owns the LOADING ZONE's end to finish firing and turn to reload, so the
 *   NECTAR is one of its next 4 ("Reloading left" is the cue);
 * - never drops while a robot is in the box (G427.C: it would touch the robot before the tile), so
 *   waits for a clear box;
 * - drops it in the middle of the box, about 5 in off the wall, so it lies still;
 * - from 1:00, one at a time, one per reload, never a pile, and stops at 0:15, when our robots park
 *   in the box.
 *
 * The simulator's own human player (NCSSM) stays selectable: one NECTAR 2 s after each TIP, and
 * from 1:00 the rest, one every 0.8 s, wherever the box has room.
 */
import { FIELD } from "../../sim/src/sim/config";
import type { Alliance } from "../../sim/src/sim/hive";
import type { Sim } from "../../sim/src/sim/world";
import { IN } from "./presets";

export type HumanPlayerKind = "playbook" | "ncssm";
export const HUMAN_PLAYERS: { value: HumanPlayerKind; label: string }[] = [
  { value: "playbook", label: "Human player: our playbook" },
  { value: "ncssm", label: "Human player: NCSSM's" },
];

/** The playbook's timings and spot. */
export const PLAYBOOK = {
  /** The rest may all go in from 1:00 on the field timer (G426.B). */
  allFromS: 60,
  /** And stop at 0:15: our robots park in the box. */
  stopAtS: 15,
  /** About 5 in off the wall, in the middle of the box. */
  offWallIn: 5,
  /** Wait for a clear box: no robot within this of it. */
  clearIn: 2,
  /** The simulator's wait after a TIP before its human player drops: our playbook waits for the cue instead, but never sooner. */
  afterTipS: 2,
};

export interface HumanPlayerView {
  /** NECTAR left in hand. */
  left: number;
  /** Earned and not yet entered (one per TIP, or all from 1:00). */
  owed: number;
  /** What the human player is waiting for, in the playbook's words, or "" when idle. */
  waiting: string;
  entered: number;
}

/** Our human player, by the playbook. Fed once per TeleOp loop. */
export class PlaybookHumanPlayer {
  left: number = FIELD.nectarStash;
  entered = 0;
  private lastTipAt = -Infinity;
  private tipsSeen = 0;
  private usedForTips = 0;
  /** The ball last dropped, while it lies in the box: one per reload, never a pile. */
  private lying: number | null = null;
  waiting = "";

  constructor(
    private sim: Sim,
    private alliance: Alliance,
  ) {
    // The simulator's own human player has nothing to enter for us: ours does it.
    sim.stash[alliance] = 0;
  }

  /** The box, as [xMin, xMax, zMin, zMax]. */
  private get zone(): readonly number[] {
    return FIELD.loadingZone[this.alliance];
  }

  /**
   * One loop.
   * @param tips our HIVE's TIPs so far
   * @param remainingS the field timer, seconds
   * @param feederReloading the robot that owns the box's end has finished firing and has room
   */
  update(tips: number, remainingS: number, feederReloading: boolean): void {
    const sim = this.sim;
    if (tips > this.tipsSeen) {
      this.tipsSeen = tips;
      this.lastTipAt = sim.simNow;
    }
    if (this.lying !== null) {
      const b = sim.balls.get(this.lying);
      const p = b?.body.translation();
      if (!p || !this.inZone(p.x, p.z, 0.05)) this.lying = null;
    }
    const allOpen =
      remainingS <= PLAYBOOK.allFromS && remainingS > PLAYBOOK.stopAtS;
    const owedForTips = this.tipsSeen - this.usedForTips;
    const owed = Math.min(this.left, allOpen ? this.left : owedForTips);
    this.waiting = "";
    if (this.left <= 0) return;
    if (remainingS <= PLAYBOOK.stopAtS) {
      this.waiting = "stopped at 0:15 (robots park in the box)";
      return;
    }
    if (owed <= 0) {
      this.waiting =
        remainingS > PLAYBOOK.allFromS ? "holding: one per TIP until 1:00" : "";
      return;
    }
    if (sim.simNow - this.lastTipAt < PLAYBOOK.afterTipS && !allOpen) {
      this.waiting = "TIP, one NECTAR: waiting";
      return;
    }
    if (this.lying !== null) {
      this.waiting = "one per reload: the last is still in the box";
      return;
    }
    if (!this.zoneClear()) {
      this.waiting = "zone busy";
      return;
    }
    if (!feederReloading) {
      this.waiting = 'waiting for "reloading"';
      return;
    }
    this.drop(!allOpen || owedForTips > 0);
  }

  private drop(forATip: boolean) {
    const spot = this.freeSpot();
    if (!spot) {
      this.waiting = "zone busy";
      return;
    }
    const kind = this.alliance === "red" ? "nectar_red" : "nectar_blue";
    // Released low and still, so it lies where it lands.
    const b = this.sim.spawn(kind, spot.x, FIELD.nectarRadius + 0.01, spot.z);
    this.lying = b.id;
    this.left--;
    this.entered++;
    if (forATip) this.usedForTips++;
  }

  /**
   * About 5 in off the wall, as near the middle of the box as is clear of the balls already there
   * (an absent partner's preloads lie in it, §10.3.1), so the NECTAR lies still where it lands.
   */
  private freeSpot(): { x: number; z: number } | null {
    const z = this.zone,
      wall = Math.sign(z[0] + z[1]),
      r = FIELD.nectarRadius,
      gap = 0.01;
    const x = wall * (FIELD.half - PLAYBOOK.offWallIn * IN);
    const zc = (z[2] + z[3]) / 2;
    const floor = [...this.sim.balls.values()]
      .map((b) => ({ p: b.body.translation(), r: b.radius }))
      .filter((o) => o.p.y < 0.2);
    const step = r + gap;
    for (let k = 0; k * step <= (z[3] - z[2]) / 2 - r; k++) {
      for (const sz of k ? [1, -1] : [1]) {
        const s = { x, z: zc + sz * k * step };
        if (
          floor.every(
            (o) => Math.hypot(o.p.x - s.x, o.p.z - s.z) > o.r + r + gap,
          )
        )
          return s;
      }
    }
    return null;
  }

  private inZone(x: number, z: number, pad = 0): boolean {
    const r = this.zone;
    return x > r[0] - pad && x < r[1] + pad && z > r[2] - pad && z < r[3] + pad;
  }

  /** No robot within `clearIn` of the box. */
  private zoneClear(): boolean {
    const pad = PLAYBOOK.clearIn * IN;
    return this.sim.robots.every((r) => {
      const p = r.body.translation(),
        half = Math.hypot(r.cfg.length, r.cfg.width) / 2;
      return !this.inZone(p.x, p.z, half + pad);
    });
  }

  view(remainingS: number, tips: number): HumanPlayerView {
    const allOpen = remainingS <= PLAYBOOK.allFromS;
    return {
      left: this.left,
      owed: Math.min(this.left, allOpen ? this.left : tips - this.usedForTips),
      waiting: this.waiting,
      entered: this.entered,
    };
  }
}

/** Which end of the field the alliance's LOADING ZONE is at: the robot owning that end is fed. */
export function zoneEnd(alliance: Alliance): "rear" | "audience" {
  const z = FIELD.loadingZone[alliance];
  return z[2] + z[3] < 0 ? "rear" : "audience";
}
