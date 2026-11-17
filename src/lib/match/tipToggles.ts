/**
 * Fork: the Match view's TIP what-ifs. With Autos shown together the HIVE is modelled (timing/model.ts
 * hiveHistory): a volley TIPs the raised CELL, and every robot's wait for a CELL reads the HIVE as it
 * is. So the question a drive team asks, "did TIP 1 happen?", is asked of the HIVE, not of a wait:
 * each TIP the robots try for gets a row, ✓ (the first try TIPs it, as modelled), ✓ on a later try
 * (the tries before it miss: an Auto that shoots again at a CELL still up), or ✗ (it never comes).
 * The waits then follow, so what the robot does next is what the field shows.
 *
 * A try is any robot's volley at that CELL, in the order they land: with two Autos shown, "3rd try"
 * can be the partner's. So each try is named by its volley (`TipTry`: whose, after which pickup,
 * when), and the Match view shows the row once, above the field, not in one robot's panel.
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

/** One volley that tries for a TIP, when every try misses: whose, what it fires, when it lands. */
export interface TipTry {
  /** Index in the entries. */
  robot: number;
  /** "preloads", "FLOWER" or "GARDEN" (the pickup before it), else "volley n". */
  what: string;
  /** When it lands, seconds after PLAY. */
  t: number;
}

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
  /** Each try, in the order they land (`tries` of them), as it would go if every one missed. */
  tryList: TipTry[];
}

const PICKUPS: Record<string, string> = {
  PickFlower: "FLOWER",
  GardenGather: "GARDEN",
};

function look(entries: FieldEntry[], values: TimingValues) {
  const { previews } = previewTogether(entries, values, false);
  const loads = entries.map((e) => robotValues(e, values).volleyLoad);
  return { previews, history: hiveHistory(volleysOf(previews, loads), values) };
}

function history(entries: FieldEntry[], values: TimingValues) {
  return look(entries, values).history;
}

/** What a robot's volley landing at `t` fires: its preloads, or what it picked up before it. */
function volleyName(
  preview: ReturnType<typeof previewTogether>["previews"][number],
  t: number,
): string {
  const volleys = volleysOf([preview]).map((v) => v.t);
  const nth = volleys.filter((v) => v < t - 1e-6).length;
  if (nth === 0) return "preloads";
  const before = volleys[nth - 1];
  const pickups = preview.actions.filter(
    (a) => PICKUPS[a.command] && a.t1 <= t + 1e-6 && a.t0 >= before - 1e-6,
  );
  const last = pickups[pickups.length - 1];
  return last ? PICKUPS[last.command] : `volley ${nth + 1}`;
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
      const never = look(entries, {
        ...values,
        [tipMissesKey(tip)]: Infinity,
      });
      const tryList = never.history.volleys
        .filter((e) => e.missed === index)
        .map((e) => ({
          robot: e.robot,
          what: volleyName(never.previews[e.robot], e.t),
          t: e.t,
        }));
      return {
        tip,
        robot: first.get(index)!,
        tries: Math.max(1, tryList.length),
        misses: tipMisses(values, tip),
        tryList,
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
