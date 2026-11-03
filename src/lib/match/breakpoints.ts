/**
 * Tipping points for the Match view's sliders: for each what-if, the nearest value above and below
 * today's at which the match comes out differently, holding everything else where it is.
 *
 * "Comes out differently" is more than the TIP count (lib/timing/together.ts `breakpoints`): it is
 * also how each robot's waits end (a TIP, or running out of time) and whether the endgame guard
 * parks a robot early, since those are what the drive team sees go wrong.
 */
import { FACTS, type TimingValues } from "../timing/model";
import {
  previewTogether,
  robotValues,
  tipsInAuto,
  type FieldEntry,
} from "../timing/together";

/** A slider: a HIVE fact, or one robot's own fact. */
export type Knob = { robot: null; id: string } | { robot: number; id: string };

/** Where moving a slider past `value` changes the outcome, and how. */
export interface Tick {
  value: number;
  /** What changes, in words: "TIPs 2 → 1", "l-partner: wait 1 times out". */
  change: string;
}

export interface KnobBreaks {
  knob: Knob;
  up: Tick | null;
  down: Tick | null;
}

/** How a match comes out, as far as the ticks care. */
export interface Outcome {
  tips: number;
  /** Per robot: how each of its waits ended, in order. */
  waits: ("trigger" | "time" | "guard")[][];
  /** Per robot: whether the endgame guard parked it. */
  guarded: boolean[];
}

export function outcomeOf(
  entries: FieldEntry[],
  values: TimingValues,
): Outcome {
  const { previews, tips } = previewTogether(entries, values, false);
  return {
    tips: tipsInAuto(tips),
    waits: previews.map((p) => p.waits.map((w) => w.ended)),
    guarded: previews.map((p) => p.guard !== null),
  };
}

const ENDED: Record<"trigger" | "time" | "guard", string> = {
  trigger: "ends on its trigger",
  time: "times out",
  guard: "is cut by the endgame",
};

/** What differs between two outcomes, in words; null when they are the same. */
export function outcomeChange(
  from: Outcome,
  to: Outcome,
  names: string[],
): string | null {
  if (from.tips !== to.tips) return `TIPs ${from.tips} → ${to.tips}`;
  for (let r = 0; r < Math.max(from.waits.length, to.waits.length); r++) {
    const a = from.waits[r] ?? [];
    const b = to.waits[r] ?? [];
    const name = names[r] ?? `Auto ${r + 1}`;
    for (let k = 0; k < Math.max(a.length, b.length); k++) {
      if (a[k] === b[k]) continue;
      if (b[k] === undefined) return `${name}: wait ${k + 1} not reached`;
      return `${name}: wait ${k + 1} ${ENDED[b[k]]}`;
    }
    if (from.guarded[r] !== to.guarded[r])
      return to.guarded[r]
        ? `${name}: endgame guard parks it`
        : `${name}: parks on its own`;
  }
  return null;
}

/** The entries and values with one slider moved to `x`. */
function withKnob(
  entries: FieldEntry[],
  values: TimingValues,
  knob: Knob,
  x: number,
): { entries: FieldEntry[]; values: TimingValues } {
  if (knob.robot === null)
    return { entries, values: { ...values, [knob.id]: x } };
  return {
    entries: entries.map((e, i) =>
      i === knob.robot ? { ...e, own: { ...(e.own ?? {}), [knob.id]: x } } : e,
    ),
    values,
  };
}

/** The slider's value now. */
export function knobValue(
  entries: FieldEntry[],
  values: TimingValues,
  knob: Knob,
): number {
  return knob.robot === null
    ? values[knob.id]
    : robotValues(entries[knob.robot], values)[knob.id];
}

/** Steps a search takes across a slider's range before narrowing in. */
const SCAN_STEPS = 24;

/** The step a slider moves by. */
export function factStep(fact: { unit?: string }): number {
  if (fact.unit === "POLLEN") return 1;
  if (fact.unit === "×") return 0.05;
  return 0.1;
}

/** The tipping points of one slider, up and down from its value now. */
export function knobBreaks(
  entries: FieldEntry[],
  values: TimingValues,
  knob: Knob,
  names: string[],
): KnobBreaks {
  const fact = FACTS.find((f) => f.id === knob.id);
  if (!fact) return { knob, up: null, down: null };
  const now = knobValue(entries, values, knob);
  const base = outcomeOf(entries, values);
  const at = (x: number) => {
    const moved = withKnob(entries, values, knob, x);
    return outcomeOf(moved.entries, moved.values);
  };
  const step = factStep(fact);
  // Values the slider can take: whole POLLEN, tenths of a second, 0.05× of speed.
  const snap = (x: number) => Math.round(x / step) * step;
  const search = (to: number): Tick | null => {
    const sign = Math.sign(to - now);
    let last = now;
    for (let k = 1; k <= SCAN_STEPS; k++) {
      // At least one step further each time, so a short range is walked step by step.
      let x = snap(now + ((to - now) * k) / SCAN_STEPS);
      if ((x - last) * sign < step - 1e-9) x = last + sign * step;
      if ((x - to) * sign > 1e-9) break;
      const change = outcomeChange(base, at(x), names);
      if (change === null) {
        last = x;
        continue;
      }
      // Narrow in, on the slider's steps, between the last value that kept the outcome and this one.
      let keep = last;
      let moved = x;
      let what = change;
      while (Math.abs(moved - keep) > step + 1e-9) {
        const mid = snap((keep + moved) / 2);
        if (Math.abs(mid - keep) < 1e-9 || Math.abs(mid - moved) < 1e-9) break;
        const c = outcomeChange(base, at(mid), names);
        if (c === null) keep = mid;
        else {
          moved = mid;
          what = c;
        }
      }
      return { value: Math.round(moved * 100) / 100, change: what };
    }
    return null;
  };
  const [lo, hi] = fact.range;
  return {
    knob,
    up: now < hi - 1e-9 ? search(hi) : null,
    down: now > lo + 1e-9 ? search(lo) : null,
  };
}
