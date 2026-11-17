/**
 * Fork: the Match view's TIP what-ifs. With Autos shown together the HIVE is modelled (timing/model.ts
 * hiveHistory): a volley TIPs the raised CELL, and every robot's wait for a CELL reads the HIVE as it
 * is. So the question a drive team asks, "did TIP 1 happen?", is asked of the HIVE, not of a wait:
 * each TIP the robots try for gets a row, ✓ (the first try TIPs it, as modelled), ✓ on a later try
 * (the tries before it miss: an Auto that shoots again at a CELL still up), or ✗ (it never comes).
 * The waits then follow, so what the robot does next is what the field shows.
 */
import {
  hiveHistory,
  tipMisses,
  tipMissesKey,
  type TimingValues,
} from "../timing/model";
import {
  previewTogether,
  robotValues,
  volleysOf,
  type FieldEntry,
} from "../timing/together";

/** One TIP the robots try for, as the Match view offers it. */
export interface TipToggle {
  /** 1-based: TIP 1 is the match's first. */
  tip: number;
  /** The robot (index in the entries) whose volley tries for it first. */
  robot: number;
  /** How many volleys try for it when it never comes: the choices are "on try 1 … tries", or never. */
  tries: number;
  /** How many tries miss in this look: 0 (the first TIPs it), up to tries - 1, or Infinity (never). */
  misses: number;
}

function history(entries: FieldEntry[], values: TimingValues) {
  const { previews } = previewTogether(entries, values, false);
  const loads = entries.map((e) => robotValues(e, values).volleyLoad);
  return hiveHistory(volleysOf(previews, loads), values);
}

/** Every TIP the shown Autos try for in this look (`values` with its TIP what-ifs), in order. */
export function tipToggles(
  entries: FieldEntry[],
  values: TimingValues,
): TipToggle[] {
  if (!entries.length) return [];
  const now = history(entries, values);
  const first = new Map<number, number>();
  for (const effect of now.volleys) {
    const tip = effect.tip ?? effect.missed;
    if (tip !== null && tip !== undefined && !first.has(tip))
      first.set(tip, effect.robot);
  }
  return [...first.keys()]
    .sort((a, b) => a - b)
    .map((index) => {
      const tip = index + 1;
      // Never: every volley after the TIPs before it tries for this one.
      const never = history(entries, {
        ...values,
        [tipMissesKey(tip)]: Infinity,
      });
      const tries = never.volleys.filter((e) => e.missed === index).length;
      return {
        tip,
        robot: first.get(index)!,
        tries: Math.max(1, tries),
        misses: tipMisses(values, tip),
      };
    });
}

/** A choice's button: "✓", "✓ 2nd try", "✗". */
export function tipChoiceLabel(misses: number): string {
  if (misses === Infinity) return "✗";
  if (misses === 0) return "✓";
  const n = misses + 1;
  const suffix = n === 2 ? "nd" : n === 3 ? "rd" : "th";
  return `✓ ${n}${suffix} try`;
}

/** A choice's tooltip, for TIP `tip`. */
export function tipChoiceHint(tip: number, misses: number): string {
  if (misses === Infinity)
    return `TIP ${tip} never comes: every volley at that CELL misses, so it stays where it is`;
  if (misses === 0)
    return `TIP ${tip} comes on the first volley that can TIP it, as the HIVE model says`;
  return `TIP ${tip} comes on try ${misses + 1}: the ${misses === 1 ? "first volley misses" : `first ${misses} volleys miss`}, and the robot tries again`;
}
