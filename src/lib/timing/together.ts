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
  previewTiming,
  TIP_CONDITIONS,
  tipsFrom,
  VOLLEY_COMMAND,
  type Tip,
  type TimingValues,
} from "./model";

export interface FieldEntry {
  auto: AutoSection;
  startPoint: StartPose;
  lines: Path[];
  settings: Settings;
  scenario: Scenario;
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

function volleyEnds(previews: PreviewResult[]): number[] {
  return previews.flatMap((p) =>
    p.launches.filter((l) => l.command === VOLLEY_COMMAND).map((l) => l.t1),
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
    trueAt(condition, t0) {
      const modelled = timing.trueAt(condition, t0);
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
  const speed = values.driveSpeed ?? 1;
  const catalogs = entries.map((e) => {
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
      simulateAuto(
        e.auto,
        catalogs[i],
        e.startPoint,
        e.scenario,
        options.tipsCome
          ? tipsCome(previewTiming(values, tips), values)
          : previewTiming(values, tips),
      ),
    );
    const next = tipsFrom(volleyEnds(previews), values);
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
