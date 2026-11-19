/**
 * The Match view's what-ifs: facts changed for this look only, per robot and for the HIVE, which
 * waits' triggers come, and which robot is a no-show. They change what the field and the timeline
 * play, never the team's `timing.json`, this laptop's own facts (lib/timing/store.ts) or a file.
 *
 * Robots are keyed by their file, so a change follows the Auto, not its place in the list.
 */
import type { AutoSection } from "../auto/types";
import { setTrigger, switchKey, type Scenario } from "../auto/simulate";
import {
  FACTS,
  ROBOT_FACTS,
  tipMissesKey,
  type TimingFact,
  type TimingValues,
} from "../timing/model";

/** A ready-made what-if: changes it makes to every robot's facts, and to the HIVE's. */
export interface MatchPreset {
  id: string;
  label: string;
  /** What it shows, for the button's tooltip. */
  title: string;
  robot: (base: TimingValues) => Partial<TimingValues>;
  hive: (base: TimingValues) => Partial<TimingValues>;
}

const round = (v: number, step: number) => Math.round(v / step) * step;

export const MATCH_PRESETS: MatchPreset[] = [
  {
    id: "slow",
    label: "Slow",
    title:
      "Both robots drive 20% slower, launch 25% slower and take a quarter again as long to pick a FLOWER or gather the GARDEN",
    robot: (base) => ({
      driveSpeed: round(base.driveSpeed * 0.8, 0.05),
      volleyS: round(base.volleyS * 1.25, 0.1),
      pickFlowerS: round(base.pickFlowerS * 1.25, 0.1),
      gardenGatherS: round(base.gardenGatherS * 1.25, 0.1),
    }),
    hive: () => ({}),
  },
  {
    id: "lazyHive",
    label: "Slow HIVE",
    title: "The HIVE starts to swing 1 s later and swings half a second longer",
    robot: () => ({}),
    hive: (base) => ({
      tipStartS: round(base.tipStartS + 1, 0.1),
      tipSwingS: round(base.tipSwingS + 0.5, 0.1),
    }),
  },
];

export const ROBOT_FACT_LIST: TimingFact[] = FACTS.filter((f) =>
  ROBOT_FACTS.includes(f.id),
);
export const HIVE_FACT_LIST: TimingFact[] = FACTS.filter(
  (f) => !ROBOT_FACTS.includes(f.id),
);

export { factStep } from "./breakpoints";

/** A value from a slider or box, kept in the fact's range; null when it is not a number. */
export function clampFact(fact: TimingFact, raw: number): number | null {
  if (!Number.isFinite(raw)) return null;
  const [lo, hi] = fact.range;
  return Math.min(hi, Math.max(lo, raw));
}

export class MatchControls {
  /** HIVE facts changed for this look. */
  hive = $state<Partial<TimingValues>>({});
  /** Each robot's facts changed for this look, by file. */
  own = $state<Record<string, Partial<TimingValues>>>({});
  /** Each robot's answers to its waits' triggers, by file (unanswered: the trigger comes). */
  scenario = $state<Record<string, Scenario>>({});
  /** Robots that do not move, by file. */
  still = $state<Record<string, boolean>>({});
  /**
   * Fork: the TIP what-ifs, by TIP number (1-based): how many tries at it miss before one TIPs it
   * (Infinity: it never comes). Unset: the first try does, as the HIVE model says.
   */
  tips = $state<Record<number, number>>({});
  /** The preset last applied, while nothing else has been changed since. */
  preset = $state<string | null>(null);

  /** True when anything differs from the team's facts with every trigger coming. */
  get changed(): boolean {
    return (
      Object.keys(this.hive).length > 0 ||
      Object.values(this.own).some((o) => Object.keys(o).length > 0) ||
      Object.values(this.scenario).some((s) => Object.keys(s).length > 0) ||
      Object.values(this.still).some(Boolean) ||
      Object.keys(this.tips).length > 0
    );
  }

  /** The shared facts for this look: the team's, with the HIVE's changes. */
  shared(base: TimingValues): TimingValues {
    const out = { ...base };
    for (const [id, v] of Object.entries(this.hive))
      if (typeof v === "number") out[id] = v;
    for (const [tip, misses] of Object.entries(this.tips))
      out[tipMissesKey(Number(tip))] = misses;
    return out;
  }

  /**
   * Fork: the team's facts with only the TIP what-ifs: what one Auto previewed alone uses, so a TIP
   * that misses there misses on the HIVE too (its pieces do not land; a later volley TIPs it).
   */
  withTips(base: TimingValues): TimingValues {
    const out = { ...base };
    for (const [tip, misses] of Object.entries(this.tips))
      out[tipMissesKey(Number(tip))] = misses;
    return out;
  }

  /** How many tries TIP `tip` misses in this look (0: the first one TIPs it). */
  tipMisses(tip: number): number {
    return this.tips[tip] ?? 0;
  }

  /**
   * Fork: TIP `tip` comes on try `misses + 1` (0, the default: the first), or never (Infinity).
   * A later TIP's answer is kept: it is about that TIP, whichever volley comes to it.
   */
  setTipMisses(tip: number, misses: number) {
    const next = { ...this.tips };
    if (misses > 0) next[tip] = misses;
    else delete next[tip];
    this.tips = next;
    this.preset = null;
  }

  setHive(id: string, value: number | null) {
    const next = { ...this.hive };
    if (value === null) delete next[id];
    else next[id] = value;
    this.hive = next;
    this.preset = null;
  }

  setOwn(file: string, id: string, value: number | null) {
    const mine = { ...(this.own[file] ?? {}) };
    if (value === null) delete mine[id];
    else mine[id] = value;
    this.own = { ...this.own, [file]: mine };
    this.preset = null;
  }

  setTrigger(file: string, auto: AutoSection, condition: string, yes: boolean) {
    const now = setTrigger(this.scenario[file] ?? {}, auto, condition, yes);
    // "Comes" is the default: keep only the answers that differ from it.
    if (yes) delete now[condition];
    this.scenario = { ...this.scenario, [file]: now };
    this.preset = null;
  }

  /**
   * Fork: one wait's answer alone (simulate.ts switchKey): as planned (its trigger comes in time,
   * the default, so nothing is kept) or late (its time limit passes first).
   */
  setWait(file: string, cardId: string, onTime: boolean) {
    const now = { ...(this.scenario[file] ?? {}) };
    if (onTime) delete now[switchKey(cardId)];
    else now[switchKey(cardId)] = false;
    this.scenario = { ...this.scenario, [file]: now };
    this.preset = null;
  }

  setStill(file: string, still: boolean) {
    const next = { ...this.still };
    if (still) next[file] = true;
    else delete next[file];
    this.still = next;
    this.preset = null;
  }

  /** Back to the team's facts, every trigger coming and every robot moving. */
  reset() {
    this.hive = {};
    this.own = {};
    this.scenario = {};
    this.still = {};
    this.tips = {};
    this.preset = null;
  }

  /** A preset over the team's facts: what it changes, and nothing else. */
  apply(preset: MatchPreset, files: string[], base: TimingValues) {
    this.reset();
    this.hive = preset.hive(base);
    const robot = preset.robot(base);
    this.own = Object.fromEntries(files.map((f) => [f, { ...robot }]));
    this.preset = preset.id;
  }
}
