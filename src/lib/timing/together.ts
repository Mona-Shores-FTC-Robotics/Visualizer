/**
 * Previews one or more Autos on the same field with typical timing: their volleys share one HIVE,
 * so a wait for "our CELL up" ends when some robot's volley has TIPped it. Each Auto's waits depend
 * on the TIPs and the TIPs on the volleys, so the previews are repeated until the TIPs stop moving.
 */
import type { Path, Settings, StartPose } from "../../types";
import { buildPathCatalog } from "../auto/geometry";
import type { AutoSection } from "../auto/types";
import {
  AUTO_LENGTH_S,
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
  VOLLEY_COMMAND,
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
      .filter((l) => l.command === VOLLEY_COMMAND)
      .map((l) => ({ t: l.t1, robot, load: loads[robot] })),
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
function tipsCome(timing: PreviewTiming, values: TimingValues): PreviewTiming {
  const swing = Math.max(0, values.tipStartS) + Math.max(0, values.tipSwingS);
  return {
    ...timing,
    trueAt(condition, t0, at) {
      // Pass the robot's position on: CellUp is the CELL at the robot's end of the field.
      const modelled = timing.trueAt(condition, t0, at);
      if (!TIP_CONDITIONS.includes(condition)) return modelled;
      return Math.min(modelled ?? t0, t0 + swing);
    },
  };
}

export function previewTogether(
  entries: FieldEntry[],
  values: TimingValues,
  withLog = true,
  options: { tipsCome?: boolean } = {},
): TogetherResult {
  const own = entries.map((e) => robotValues(e, values));
  const loads = own.map((v) => v.volleyLoad);
  const catalogs = entries.map((e, i) => {
    const speed = own[i].driveSpeed ?? 1;
    const catalog = buildPathCatalog(
      e.startPoint,
      e.lines,
      atSpeed(e.settings, speed),
    );
    if (catalog.paths.length && atSpeed(e.settings, speed) !== e.settings) {
      // The robot's endgame guard reserves the export's time, at the drawing's speed.
      const drawn = buildPathCatalog(e.startPoint, e.lines, e.settings);
      for (const path of catalog.paths)
        path.drawnSeconds = drawn.byId.get(path.id)?.seconds;
    }
    return catalog;
  });
  let tips: Tip[] = [];
  let previews: PreviewResult[] = [];
  for (let round = 0; round < MAX_ROUNDS; round++) {
    previews = entries.map((e, i) =>
      e.still
        ? stillPreview()
        : simulateAuto(
            e.auto,
            catalogs[i],
            e.startPoint,
            e.scenario,
            options.tipsCome
              ? tipsCome(previewTiming(own[i], tips), own[i])
              : previewTiming(own[i], tips),
          ),
    );
    const next = hiveHistory(volleysOf(previews, loads), values).tips.map(
      ({ start, settled }) => ({ start, settled }),
    );
    if (sameTips(next, tips)) break;
    tips = next;
  }
  if (withLog) {
    // Each preview's log shows the TIPs, on the field's clock.
    for (const preview of previews) {
      tips.forEach((tip, i) => {
        if (tip.start <= preview.endTime + 1e-9) {
          preview.log.push({
            t: tip.start,
            text: `TIP ${i + 1} starts (settled ${tip.settled.toFixed(1)} s)`,
            kind: "event",
          });
        }
      });
      preview.log.sort((a, b) => a.t - b.t);
    }
  }
  return { previews, tips };
}

/** TIPs settled by the end of the Auto: what the alliance scores. */
export function tipsInAuto(tips: Tip[]): number {
  return tips.filter((tip) => tip.settled <= AUTO_LENGTH_S + 1e-9).length;
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
 * For each fact, the nearest value above and below today's at which the TIPs by 30 s change,
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
