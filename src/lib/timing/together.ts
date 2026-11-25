/**
 * Previews one or more Autos on the same field with typical timing: their volleys share one HIVE,
 * so a wait for "our CELL up" ends when some robot's volley has TIPped it. Each Auto's waits depend
 * on the TIPs and the TIPs on the volleys, so the previews are repeated until the TIPs stop moving.
 */
import type { Path, Settings, StartPose } from "../../types";
import { buildPathCatalog } from "../auto/geometry";
import { simTurning } from "./simDrive";
import type { AutoSection } from "../auto/types";
import {
  simulateAuto,
  type PreviewResult,
  type PreviewTiming,
  type Scenario,
} from "../auto/simulate";
import {
  FACTS,
  hiveHistory,
  previewTiming,
  ROBOT_FACTS,
  TIP_CONDITIONS,
  volleysIn,
  countsInAuto,
  type Tip,
  type TimingValues,
  type Volley,
} from "./model";

export interface FieldEntry {
  auto: AutoSection;
  startPoint: StartPose;
  lines: Path[];
  settings: Settings;
  scenario: Scenario;
  /**
   * This robot's own facts (ROBOT_FACTS: its drive speed, volley, intake, hits per volley), over
   * the shared ones; the HIVE's facts are always shared.
   */
  own?: Partial<TimingValues>;
  /** The robot does not move: a no-show partner. Its preview is an empty one. */
  still?: boolean;
}

/** The facts one robot is previewed with: the shared ones, and its own over them. */
export function robotValues(
  entry: Pick<FieldEntry, "own">,
  values: TimingValues,
): TimingValues {
  if (!entry.own) return values;
  const out = { ...values };
  for (const id of ROBOT_FACTS) {
    const v = entry.own[id];
    if (typeof v === "number" && Number.isFinite(v)) out[id] = v;
  }
  return out;
}

/** A preview of a robot that never moves. */
export function stillPreview(): PreviewResult {
  return {
    timeline: [],
    log: [{ t: 0, text: "Does not move (no-show)", kind: "end" }],
    endTime: 0,
    ran: new Set(),
    taken: new Map(),
    drives: [],
    motions: [],
    launches: [],
    actions: [],
    waits: [],
    guard: null,
    stalled: false,
  };
}

export interface TogetherResult {
  previews: PreviewResult[];
  tips: Tip[];
  /**
   * With `tipsCome`: the stand-in volleys for the partner's TIPs the Autos were taken to wait for
   * (one per wait that ended on the assumption), so the HIVE drawn has them too. Empty otherwise.
   */
  assumed: Volley[];
}

/** Rounds of preview before giving up on the TIPs settling (each round is cheap). */
const MAX_ROUNDS = 12;

/** The settings with the robot driving `speed` times as fast: every path takes 1/speed as long. */
function atSpeed(settings: Settings, speed: number): Settings {
  if (!(speed > 0) || Math.abs(speed - 1) < 1e-9) return settings;
  const s = settings as Settings & Record<string, number>;
  const scaled: Record<string, number> = {};
  for (const key of [
    "maxVelocity",
    "forwardVelocity",
    "strafeVelocity",
    "aVelocity",
  ]) {
    if (typeof s[key] === "number") scaled[key] = s[key] * speed;
  }
  for (const key of ["maxAcceleration", "maxDeceleration"]) {
    if (typeof s[key] === "number") scaled[key] = s[key] * speed * speed;
  }
  return { ...settings, ...scaled };
}

/**
 * Every volley on the field, by robot: a LaunchAll run alongside a wait, or a LaunchAll step (the
 * simple builder's Launch all). `loads[i]` is what robot i's volleys land (its hits per volley).
 */
export function volleysOf(
  previews: PreviewResult[],
  loads: (number | undefined)[] = [],
): Volley[] {
  return previews.flatMap((p, robot) =>
    [...p.launches, ...p.actions]
      .filter((l) => volleysIn(l.command) > 0 && !l.unfired)
      .map((l) => ({
        t: l.t1,
        robot,
        load: loads[robot],
        ...(volleysIn(l.command) === 1
          ? {}
          : { volleys: volleysIn(l.command) }),
      })),
  );
}

function sameTips(a: Tip[], b: Tip[]): boolean {
  return (
    a.length === b.length &&
    a.every((tip, i) => Math.abs(tip.start - b[i].start) < 1e-6)
  );
}

/**
 * A tip the robot waits for comes within one HIVE swing of the wait starting, unless the TIPs
 * the volleys make bring it sooner. For an Auto previewed alone: nothing models the partner's
 * Auto, so without this a wait for the partner's tip would never end and the good path (every
 * tip comes) could not be shown.
 */
function tipsCome(
  timing: PreviewTiming,
  values: TimingValues,
  tips: Tip[],
  guesses: Assumption[],
): PreviewTiming {
  const swing = Math.max(0, values.tipStartS) + Math.max(0, values.tipSwingS);
  return {
    ...timing,
    trueAt(condition, t0, at) {
      // Pass the robot's position on: CellUp is the CELL at the robot's end of the field.
      const modelled = timing.trueAt(condition, t0, at);
      if (!TIP_CONDITIONS.includes(condition)) return modelled;
      const assumedAt = t0 + swing;
      const when = Math.min(modelled ?? t0, assumedAt);
      // Note what the answer rests on, for the HIVE: a TIP taken to come from this wait's start, or
      // one taken to come for an earlier wait (whose stand-in volley is already in `tips`).
      if (assumedAt < (modelled ?? t0) - 1e-9)
        guesses.push({ from: t0, at: when });
      else {
        const earlier = tips.find(
          (tip) =>
            tip.assumedAt !== undefined &&
            (Math.abs(tip.settled - when) < 1e-6 ||
              Math.abs(tip.start - when) < 1e-6),
        );
        if (earlier) guesses.push({ from: earlier.assumedAt!, at: when });
      }
      return when;
    },
  };
}

/** A wait's answer that rests on a partner's TIP taken to come: the TIP's stand-in volley lands at `from`. */
interface Assumption {
  from: number;
  /** When the wait would end on it. */
  at: number;
}

/**
 * The stand-in volleys for the partner's TIPs the previews were taken to wait for: one for each
 * wait that really ended on an assumption (a wait asks for times it does not end on, when a time
 * row or another trigger comes first).
 */
function assumedVolleys(
  previews: PreviewResult[],
  guesses: Assumption[][],
): Volley[] {
  const out: Volley[] = [];
  previews.forEach((preview, robot) => {
    for (const g of guesses[robot]) {
      const ended = preview.waits.some(
        (w) => w.ended === "trigger" && Math.abs(w.t1 - g.at) < 1e-6,
      );
      if (ended && !out.some((v) => Math.abs(v.t - g.from) < 1e-6))
        out.push({ t: g.from, robot, assumed: true });
    }
  });
  return out.sort((a, b) => a.t - b.t);
}

function sameVolleys(a: Volley[], b: Volley[]): boolean {
  return (
    a.length === b.length && a.every((v, i) => Math.abs(v.t - b[i].t) < 1e-6)
  );
}

export function previewTogether(
  entries: FieldEntry[],
  values: TimingValues,
  withLog = true,
  options: {
    tipsCome?: boolean;
    /**
     * "sim" (the default): paths turn as biobuzz's Java simulator turns the competition robot
     * (simDrive.ts). "drawn": at the drawing's own turn rate, as the preview did before, for a
     * robot the simulator does not describe (the 25 Oct light chassis).
     */
    turning?: "sim" | "drawn";
  } = {},
): TogetherResult {
  const own = entries.map((e) => robotValues(e, values));
  const loads = own.map((v) => v.volleyLoad);
  const catalogs = entries.map((e, i) => {
    const speed = own[i].driveSpeed ?? 1;
    // Fork: the preview drives and turns as the Java simulator does (simDrive.ts).
    const catalog = buildPathCatalog(
      e.startPoint,
      e.lines,
      options.turning === "drawn"
        ? atSpeed(e.settings, speed)
        : simTurning(atSpeed(e.settings, speed), speed),
    );
    if (catalog.paths.length) {
      // The robot's endgame guard reserves the export's time, at the drawing's speed and turning.
      const drawn = buildPathCatalog(e.startPoint, e.lines, e.settings);
      for (const path of catalog.paths)
        path.drawnSeconds = drawn.byId.get(path.id)?.seconds;
    }
    return catalog;
  });
  let tips: Tip[] = [];
  let previews: PreviewResult[] = [];
  let assumed: Volley[] = [];
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const guesses: Assumption[][] = entries.map(() => []);
    previews = entries.map((e, i) =>
      e.still
        ? stillPreview()
        : simulateAuto(
            e.auto,
            catalogs[i],
            e.startPoint,
            e.scenario,
            options.tipsCome
              ? tipsCome(previewTiming(own[i], tips), own[i], tips, guesses[i])
              : previewTiming(own[i], tips),
          ),
    );
    const nextAssumed = options.tipsCome
      ? assumedVolleys(previews, guesses)
      : [];
    const next: Tip[] = hiveHistory(
      [...volleysOf(previews, loads), ...nextAssumed],
      values,
    ).tips.map(({ start, settled, lastBall, assumedAt }) => ({
      start,
      settled,
      lastBall,
      ...(assumedAt === undefined ? {} : { assumedAt }),
    }));
    const settledDown =
      sameTips(next, tips) && sameVolleys(nextAssumed, assumed);
    tips = next;
    assumed = nextAssumed;
    if (settledDown) break;
  }
  if (withLog) {
    // Each preview's log shows the TIPs, on the field's clock.
    for (const preview of previews) {
      tips.forEach((tip, i) => {
        if (tip.start <= preview.endTime + 1e-9) {
          preview.log.push({
            t: tip.start,
            text: `TIP ${i + 1} starts (settled ${tip.settled.toFixed(1)} s)${tip.assumedAt === undefined ? "" : ", the partner's, taken to come"}`,
            kind: "event",
          });
        }
      });
      preview.log.sort((a, b) => a.t - b.t);
    }
  }
  return { previews, tips, assumed };
}

/**
 * TIPs that count as AUTO, what the alliance scores: every ball for one left by 30 s and it settles
 * by 38 s (model.ts countsInAuto, the team's rule).
 */
export function tipsInAuto(tips: Tip[]): number {
  return tips.filter(countsInAuto).length;
}

/** Where changing one fact changes how many TIPs settle by 30 s. */
export interface Breakpoint {
  id: string;
  /** Raising the fact past `value` takes the TIPs from `from` to `to`. */
  up: { value: number; from: number; to: number } | null;
  /** Lowering it past `value`. */
  down: { value: number; from: number; to: number } | null;
}

/** Steps a search takes across a fact's range before narrowing in. */
const SCAN_STEPS = 30;
const NARROW_STEPS = 8;

/**
 * For each fact, the nearest value above and below today's at which the TIPs counted as AUTO change,
 * holding the other facts where they are.
 */
export function breakpoints(
  entries: FieldEntry[],
  values: TimingValues,
): Breakpoint[] {
  const count = (v: TimingValues) =>
    tipsInAuto(previewTogether(entries, v, false).tips);
  const base = count(values);
  const search = (id: string, from: number, to: number) => {
    const at = (x: number) => count({ ...values, [id]: x });
    let last = from;
    for (let k = 1; k <= SCAN_STEPS; k++) {
      const x = from + ((to - from) * k) / SCAN_STEPS;
      const n = at(x);
      if (n !== base) {
        // Narrow in between the last value that kept `base` and this one.
        let keep = last;
        let change = x;
        let changed = n;
        for (let j = 0; j < NARROW_STEPS; j++) {
          const mid = (keep + change) / 2;
          const m = at(mid);
          if (m === base) keep = mid;
          else {
            change = mid;
            changed = m;
          }
        }
        return {
          value: Math.round(change * 100) / 100,
          from: base,
          to: changed,
        };
      }
      last = x;
    }
    return null;
  };
  return FACTS.map((fact) => {
    const now = values[fact.id] ?? fact.fallback;
    const [lo, hi] = fact.range;
    return {
      id: fact.id,
      up: now < hi ? search(fact.id, now, hi) : null,
      down: now > lo ? search(fact.id, now, lo) : null,
    };
  });
}
