/**
 * The Match view's timeline: what each Auto shown together does on the field's clock, and the
 * shared HIVE between them. Built from the same preview the field plays (lib/timing/together.ts),
 * so the timeline and the robots on the field never disagree.
 *
 * The point is the chain the field cannot show: a volley lands in the raised CELL, the volley that
 * fills it TIPs the HIVE, and the TIP is what ends the other robot's "Wait for TIP or CELL up".
 */
import type { PreviewResult } from "../auto/simulate";
import { AUTO_LENGTH_S, GRAB_COMMANDS } from "../auto/simulate";
import { pathDisplayNames } from "../auto/geometry";
import {
  hiveHistory,
  TIP_CONDITIONS,
  VOLLEY_COMMAND,
  SPIN_UP_COMMAND,
  type CausedTip,
  type TimingValues,
  type VolleyEffect,
} from "../timing/model";
import {
  robotValues,
  tipsInAuto,
  volleysOf,
  type FieldEntry,
} from "../timing/together";

export type SegmentKind =
  "drive" | "volley" | "spinup" | "pick" | "gather" | "action";

/** Something a robot is doing, from t0 to t1. */
export interface Segment {
  kind: SegmentKind;
  t0: number;
  t1: number;
  label: string;
}

/** A wait: drawn out to its "at most", filled to when it ended. */
export interface WaitBar {
  label: string;
  t0: number;
  t1: number;
  limitAt: number | null;
  ended: "trigger" | "time" | "guard";
  condition: string | null;
  /** Its Otherwise list ran (it timed out into a branch). */
  branched: boolean;
  /** The TIP that ended it (index in the HIVE's tips), or null. */
  tip: number | null;
  /** Ended the moment it was asked: its CELL was already up. */
  atOnce: boolean;
}

/** A volley on a robot's row, and what it did to the HIVE. */
export interface VolleyMark {
  t0: number;
  t1: number;
  counted: boolean;
  /** The raised CELL's weight just after it landed. */
  load: number;
  /** The TIP it started (index in the HIVE's tips), or null. */
  tip: number | null;
}

export interface RobotLane {
  name: string;
  color: string;
  segments: Segment[];
  waits: WaitBar[];
  volleys: VolleyMark[];
  endTime: number;
  guard: { t: number; label: string } | null;
  stalled: boolean;
  /** A no-show: the robot does not move. */
  still: boolean;
  /** Seconds spent in waits. */
  waitingS: number;
  /** Seconds to spare at the end of the 30 s Auto (negative: over). */
  spareS: number;
}

/** Which CELL is up, over time (the HIVE starts RIGHT up). */
export interface CellSpan {
  t0: number;
  t1: number;
  state: "right" | "left" | "swing";
  /** The TIP that swings here, or that brought this CELL up (index in the tips); null at the start. */
  tip: number | null;
}

export interface HiveLane {
  tips: CausedTip[];
  volleys: (VolleyEffect & { name: string })[];
  cells: CellSpan[];
  /** TIPs settled by 30 s: what the alliance scores. */
  tipsInAuto: number;
}

/** volley → TIP, or TIP → the wait it ended. */
export interface Link {
  kind: "volley-tip" | "tip-wait";
  /** Robot lane index, or "hive". */
  from: { lane: number | "hive"; t: number };
  to: { lane: number | "hive"; t: number };
}

export interface MatchLanes {
  robots: RobotLane[];
  hive: HiveLane;
  links: Link[];
  /** Seconds the axis spans: the 30 s Auto, or longer when an Auto runs over. */
  span: number;
}

const EPS = 1e-6;

/** A row's name from its file: `biobuzz-l-partner.pp` → `l-partner`. */
export function laneName(filePath: string): string {
  const base = filePath.split("/").pop() ?? filePath;
  return base.replace(/\.pp$/i, "").replace(/^biobuzz-/, "");
}

function segmentKind(command: string): SegmentKind {
  if (command === VOLLEY_COMMAND) return "volley";
  if (command === SPIN_UP_COMMAND) return "spinup";
  if (command === "PickFlower") return "pick";
  if (command === "GardenGather") return "gather";
  return GRAB_COMMANDS.has(command) ? "pick" : "action";
}

const LABELS: Record<string, string> = {
  LaunchAll: "Launch all",
  PickFlower: "Pick flower",
  GardenGather: "Garden gather",
  SpinUp: "Spin up",
};

function cellSpans(tips: CausedTip[], span: number): CellSpan[] {
  const out: CellSpan[] = [];
  let t = 0;
  let up: "right" | "left" = "right";
  let last: number | null = null;
  for (const [i, tip] of tips.entries()) {
    if (tip.start >= span) break;
    if (tip.start > t + EPS)
      out.push({ t0: t, t1: tip.start, state: up, tip: last });
    out.push({
      t0: tip.start,
      t1: Math.min(tip.settled, span),
      state: "swing",
      tip: i,
    });
    t = tip.settled;
    up = up === "right" ? "left" : "right";
    last = i;
  }
  if (t < span - EPS) out.push({ t0: t, t1: span, state: up, tip: last });
  return out;
}

/** The TIP that ended a wait at `t` on `condition`: one that started (Tip) or settled then. */
function tipEnding(
  tips: CausedTip[],
  condition: string,
  t: number,
): number | null {
  const index = tips.findIndex((tip) =>
    condition === "Tip"
      ? Math.abs(tip.start - t) < EPS
      : Math.abs(tip.settled - t) < EPS,
  );
  return index < 0 ? null : index;
}

/**
 * The timeline for Autos previewed together. `previews[i]` is `entries[i]`'s, as
 * `previewTogether` returns them; `names` and `colors` label each robot's row.
 */
export function matchLanes(
  entries: FieldEntry[],
  previews: PreviewResult[],
  values: TimingValues,
  names: string[],
  colors: string[],
): MatchLanes {
  const span = Math.max(AUTO_LENGTH_S, ...previews.map((p) => p.endTime));
  const loads = entries.map((e) => robotValues(e, values).volleyLoad);
  const history = hiveHistory(volleysOf(previews, loads), values);
  const tips = history.tips;
  const links: Link[] = [];

  const robots = previews.map((preview, robot): RobotLane => {
    const pathNames = pathDisplayNames(entries[robot]?.lines ?? []);
    const segments: Segment[] = [
      ...preview.drives.map((d): Segment => ({
        kind: "drive",
        t0: d.t0,
        t1: d.t1,
        label: pathNames.get(d.pathId) ?? "Drive",
      })),
      ...preview.actions.map((a): Segment => ({
        kind: segmentKind(a.command),
        t0: a.t0,
        t1: a.t1,
        label: LABELS[a.command] ?? a.command,
      })),
      ...preview.launches
        .filter((l) => l.command !== SPIN_UP_COMMAND)
        .map((l): Segment => ({
          kind: segmentKind(l.command),
          t0: l.t0,
          t1: l.t1,
          label: `${LABELS[l.command] ?? l.command} (while waiting)`,
        })),
    ].sort((a, b) => a.t0 - b.t0);

    const volleyRuns = [...preview.launches, ...preview.actions]
      .filter((l) => l.command === VOLLEY_COMMAND)
      .sort((a, b) => a.t1 - b.t1);
    const effects = history.volleys.filter((v) => v.robot === robot);
    const volleys = volleyRuns.map((run, i): VolleyMark => {
      const effect = effects[i];
      if (effect?.tip != null) {
        links.push({
          kind: "volley-tip",
          from: { lane: robot, t: run.t1 },
          to: { lane: "hive", t: tips[effect.tip].start },
        });
      }
      return {
        t0: run.t0,
        t1: run.t1,
        counted: effect?.counted ?? false,
        load: effect?.load ?? 0,
        tip: effect?.tip ?? null,
      };
    });

    const waits = preview.waits.map((w): WaitBar => {
      const tipLike =
        w.ended === "trigger" &&
        w.condition !== null &&
        TIP_CONDITIONS.includes(w.condition);
      const atOnce = tipLike && w.t1 - w.t0 < EPS;
      const tip =
        tipLike && !atOnce ? tipEnding(tips, w.condition!, w.t1) : null;
      if (tip !== null) {
        links.push({
          kind: "tip-wait",
          from: { lane: "hive", t: w.t1 },
          to: { lane: robot, t: w.t1 },
        });
      }
      return {
        label: w.label,
        t0: w.t0,
        t1: w.t1,
        limitAt: w.limitAt,
        ended: w.ended,
        condition: w.condition,
        branched: w.branched,
        tip,
        atOnce,
      };
    });

    return {
      name: names[robot] ?? `Auto ${robot + 1}`,
      color: colors[robot] ?? "#888888",
      segments,
      waits,
      volleys,
      endTime: preview.endTime,
      guard: preview.guard,
      stalled: preview.stalled,
      still: entries[robot]?.still ?? false,
      waitingS: waits.reduce((sum, w) => sum + (w.t1 - w.t0), 0),
      spareS: AUTO_LENGTH_S - preview.endTime,
    };
  });

  return {
    robots,
    hive: {
      tips,
      volleys: history.volleys.map((v) => ({
        ...v,
        name: robots[v.robot]?.name ?? "",
      })),
      cells: cellSpans(tips, span),
      tipsInAuto: tipsInAuto(tips),
    },
    links,
    span,
  };
}
