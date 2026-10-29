/**
 * Ladders: what the robot tries when a tip doesn't come, built into ordinary cards.
 *
 * A ladder sits on a wait on the plan (`FirstOfCard.ladder`): a wait in the main sequence, or in
 * the row of an earlier wait that the plan takes. Its tries are plays (`AutoSection.plays`). This
 * module writes the Auto so that:
 * - the plan after the wait is its "tip came" row (moved there the first time, so every route
 *   ends in its own row and nothing falls through to steps after the wait);
 * - its time-limit row is the ladder: each try's drives, collect and shot, then a wait for the tip.
 *   The preview, the Java export and a stock Visualizer read these cards as any others.
 * Every outcome is decided here, when the Auto is built; the robot never improvises.
 *
 * Three fixed rules finish each route:
 * 1. A try that works goes back to the plan, at its next stop after the wait (a rejoin).
 * 2. A source is used once. A try whose source is already used (on the plan before the wait, or
 *    by an earlier try) is skipped. After a try that works, if the rest of the plan goes back to a
 *    source already used, the route follows the plan up to the drive there, then parks.
 * 3. When every try has failed, the robot parks. When time runs short on any route, the endgame
 *    guard parks it, as everywhere else.
 */
import type { Path } from "../../types";
import type {
  AutoCard,
  AutoSection,
  FirstOfCard,
  LadderTry,
  NamedPoint,
  PathCard,
  Play,
  RejoinCard,
  Source,
} from "../auto/types";
import { SOURCES, SOURCE_NAMES } from "./plays";

/** Card and path ids the compiler owns start with this, then the wait's id. */
export const LADDER_PREFIX = "lad-";
export const ownPrefix = (waitId: string) => `${LADDER_PREFIX}${waitId}-`;

export const TIP_TRIGGER = "Tip";
export const FULL_TRIGGER = "IntakeFull";
export const EMPTY_TRIGGER = "Empty";
export const SHOOT_COMMAND = "LaunchAll";

const LADDER_COLOR = "#f59e0b";

/** How each try on a ladder is used, for the editor to show. */
export interface TryInfo {
  index: number;
  try: LadderTry;
  play: Play | null;
  /** "skipped": its source is already used; "missing": its play is not in the file. */
  status: "kept" | "skipped" | "missing";
  reason?: string;
  /** Kept tries: the card that waits for the tip after this try's shot. */
  waitId?: string;
  /** Kept tries: when it works, back to the plan, or the plan until it needs a used source. */
  then?: { kind: "plan" } | { kind: "parkEarly"; before: Source };
}

export interface LadderInfo {
  waitId: string;
  tries: TryInfo[];
  /** False when the plan has no park path, so a ladder whose tries all fail cannot park. */
  parks: boolean;
}

type Visit = (list: AutoCard[], index: number) => boolean | void;

/**
 * The plan's cards in order: the main sequence, and for a wait whose rows hold routes, the row
 * taken when its trigger comes. Stops when `visit` returns true; returns whether it stopped.
 */
function planWalk(cards: AutoCard[], visit: Visit): boolean {
  for (let index = 0; index < cards.length; index++) {
    if (visit(cards, index)) return true;
    const card = cards[index];
    if (card.kind === "firstOf") {
      const good = card.rows.find((row) => "when" in row);
      if (good?.cards.length && planWalk(good.cards, visit)) return true;
    }
  }
  return false;
}

/** The list on the plan that holds `id`, and where. */
function locateOnPlan(
  cards: AutoCard[],
  id: string,
): { list: AutoCard[]; index: number } | null {
  let found: { list: AutoCard[]; index: number } | null = null;
  planWalk(cards, (list, index) => {
    if (list[index].id !== id) return false;
    found = { list, index };
    return true;
  });
  return found;
}

/** Where a card collects from: a wait for a full intake right after a drive to a source. */
function collectSource(
  list: AutoCard[],
  index: number,
  pathEnds: Record<string, string>,
): Source | null {
  const card = list[index];
  if (card.kind !== "firstOf") return null;
  if (
    !card.rows.some((row) => "when" in row && row.when.includes(FULL_TRIGGER))
  )
    return null;
  for (let i = index - 1; i >= 0; i--) {
    const before = list[i];
    if (before.kind === "path") {
      const end = pathEnds[before.lineId];
      return SOURCES.includes(end as Source) ? (end as Source) : null;
    }
    if (before.kind !== "action") return null;
  }
  return null;
}

/** Sources the plan collects from before it reaches `waitId`. */
function sourcesBefore(auto: AutoSection, waitId: string): Set<Source> {
  const used = new Set<Source>();
  planWalk(auto.cards, (list, index) => {
    if (list[index].id === waitId) return true;
    const source = collectSource(list, index, auto.pathEnds);
    if (source) used.add(source);
  });
  return used;
}

/** The first used source the plan in `cards` collects from, if any. */
function firstUsed(
  cards: AutoCard[],
  used: Set<Source>,
  pathEnds: Record<string, string>,
): Source | null {
  let found: Source | null = null;
  planWalk(cards, (list, index) => {
    const source = collectSource(list, index, pathEnds);
    if (source && used.has(source)) found = source;
    return found !== null;
  });
  return found;
}

function endHeading(line: Path | undefined): number | null {
  if (!line) return null;
  if (line.kind === "compound")
    return endHeading(line.segments[line.segments.length - 1]);
  if (line.heading.type === "linear") return line.heading.endDeg;
  if (line.heading.type === "constant") return line.heading.degrees;
  return null;
}

function endSegment(line: Path): Path {
  return line.kind === "compound"
    ? endSegment(line.segments[line.segments.length - 1])
    : line;
}

function tipName(wait: FirstOfCard): string {
  return (
    /TIP\s*\d+/i.exec(wait.label)?.[0].toUpperCase().replace(/\s+/, " ") ??
    "the tip"
  );
}

/** The plan's park path: the last one on it. */
function planPark(auto: AutoSection): PathCard | null {
  let park: PathCard | null = null;
  planWalk(auto.cards, (list, index) => {
    const card = list[index];
    if (card.kind === "path" && card.park) park = card;
  });
  return park;
}

/** What the ladder on `waitId` does, try by try: the rules applied, nothing written. */
export function ladderInfo(
  auto: AutoSection,
  waitId: string,
): LadderInfo | null {
  const at = locateOnPlan(auto.cards, waitId);
  const wait = at?.list[at.index];
  if (!at || wait?.kind !== "firstOf" || !wait.ladder) return null;
  // The plan after the wait: its own row once built, else the cards after it.
  const good = wait.rows.find((row) => "when" in row);
  const rest = [...(good?.cards ?? []), ...at.list.slice(at.index + 1)];
  let used = sourcesBefore(auto, waitId);
  const tries: TryInfo[] = wait.ladder.tries.map((entry, index): TryInfo => {
    const play = auto.plays?.[entry.play] ?? null;
    if (!play)
      return {
        index,
        try: entry,
        play,
        status: "missing",
        reason: "This play is not in the file.",
      };
    if (play.source && used.has(play.source)) {
      return {
        index,
        try: entry,
        play,
        status: "skipped",
        reason: `Skipped: ${SOURCE_NAMES[play.source]} is already used by then.`,
      };
    }
    used = new Set(used);
    if (play.source) used.add(play.source);
    const before = firstUsed(rest, used, auto.pathEnds);
    return {
      index,
      try: entry,
      play,
      status: "kept",
      waitId: `${ownPrefix(waitId)}${play.id}-tip`,
      then: before ? { kind: "parkEarly", before } : { kind: "plan" },
    };
  });
  return { waitId, tries, parks: !!planPark(auto) };
}

/** The named point the park path starts from: where the path before it on the plan ends. */
function parkStart(
  auto: AutoSection,
  b: { lineById: Map<string, Path> },
  park: PathCard,
): string | undefined {
  let before: PathCard | null = null;
  planWalk(auto.cards, (list, index) => {
    const card = list[index];
    if (card === park) return true;
    if (card.kind === "path") before = card;
  });
  const line = before ? b.lineById.get((before as PathCard).lineId) : undefined;
  return line
    ? auto.pathEnds[endSegment(line).id]
    : (auto.startAt ?? undefined);
}

/** Waits on the plan that carry a ladder, in plan order. */
function ladderWaits(auto: AutoSection): string[] {
  const ids: string[] = [];
  planWalk(auto.cards, (list, index) => {
    const card = list[index];
    if (card.kind === "firstOf" && card.ladder) ids.push(card.id);
  });
  return ids;
}

interface Spot {
  name: string;
  heading: number | null;
}

class Builder {
  auto: AutoSection;
  lines: Path[];
  lineById: Map<string, Path>;
  /** Shapes of the paths a ladder drew last time, to keep a student's bends. */
  previous = new Map<string, Path>();

  constructor(auto: AutoSection, lines: Path[]) {
    this.auto = JSON.parse(JSON.stringify(auto)) as AutoSection;
    this.auto.pathEnds = { ...this.auto.pathEnds };
    this.auto.points = { ...this.auto.points };
    this.lines = [...lines];
    this.lineById = new Map(lines.map((line) => [line.id, line]));
  }

  /** Forget what `prefix` drew, keeping the shapes. */
  clear(prefix: string): void {
    this.previous = new Map();
    this.lines = this.lines.filter((line) => {
      if (!line.id.startsWith(prefix)) return true;
      this.previous.set(line.id, line);
      return false;
    });
    for (const id of Object.keys(this.auto.pathEnds))
      if (id.startsWith(prefix)) delete this.auto.pathEnds[id];
    this.lineById = new Map(this.lines.map((line) => [line.id, line]));
  }

  spotAfter(card: PathCard | undefined, fallback: Spot): Spot {
    if (!card) return fallback;
    const line = this.lineById.get(card.lineId);
    if (!line) return fallback;
    const name =
      this.auto.pathEnds[endSegment(line).id] ?? line.name ?? fallback.name;
    return { name, heading: endHeading(line) };
  }

  /** A straight path from `from` to the named point `to`, keeping a bend drawn on it before. */
  line(id: string, to: string, from: Spot): Path {
    const point = this.auto.points[to];
    const heading = point?.[2] ?? from.heading ?? 0;
    const name = `${from.name} to ${to}`;
    const old = this.previous.get(id);
    const line: Path =
      old?.kind === "atomic" && old.name === name
        ? { ...old, endPoint: { x: point[0], y: point[1] } }
        : {
            id,
            name,
            color: LADDER_COLOR,
            kind: "atomic",
            endPoint: { x: point?.[0] ?? 0, y: point?.[1] ?? 0 },
            controlPoints: [],
            heading:
              from.heading === null
                ? { type: "constant", degrees: heading }
                : { type: "linear", startDeg: from.heading, endDeg: heading },
          };
    this.lines.push(line);
    this.lineById.set(id, line);
    if (point) this.auto.pathEnds[id] = to;
    return line;
  }

  drive(id: string, to: string, from: Spot): PathCard {
    this.line(id, to, from);
    return { id, kind: "path", lineId: id, park: false };
  }

  /** A copy of a plan card for a route of its own: new ids, its own copy of every path. */
  copy(card: AutoCard, prefix: string): AutoCard {
    const copyLine = (lineId: string): string => {
      const line = this.lineById.get(lineId);
      if (!line) return lineId;
      const copied = this.copyPath(line, prefix);
      this.lines.push(copied);
      this.lineById.set(copied.id, copied);
      return copied.id;
    };
    switch (card.kind) {
      case "action":
        return { ...card, id: prefix + card.id };
      case "path":
        return { ...card, id: prefix + card.id, lineId: copyLine(card.lineId) };
      case "rejoin":
        return { ...card, id: prefix + card.id, lineId: copyLine(card.lineId) };
      case "firstOf": {
        const { ladder: _ladder, ...rest } = card;
        return {
          ...rest,
          id: prefix + card.id,
          rows: card.rows.map((row) => ({
            ...row,
            cards: row.cards.map((c) => this.copy(c, prefix)),
          })),
        };
      }
    }
  }

  copyPath(line: Path, prefix: string): Path {
    const id = prefix + line.id;
    const pinned = this.auto.pathEnds[line.id];
    if (pinned) this.auto.pathEnds[id] = pinned;
    if (line.kind === "compound") {
      return {
        ...line,
        id,
        segments: line.segments.map((segment) =>
          this.copyPath(segment, prefix),
        ),
      };
    }
    return JSON.parse(JSON.stringify({ ...line, id })) as Path;
  }
}

/**
 * The Auto with every ladder built into its wait, and the paths its routes drive. Returns the
 * same objects when nothing changes, so it runs after every edit.
 */
export function compileLadders(
  auto: AutoSection,
  lines: Path[],
): { auto: AutoSection; lines: Path[]; changed: boolean } {
  const waits = ladderWaits(auto);
  if (!waits.length) return { auto, lines, changed: false };
  const b = new Builder(auto, lines);
  // Last first: an earlier try that parks early copies the plan after it, later ladders included.
  for (const id of [...waits].reverse()) build(b, id);
  // Paths keep their place in the list (the editor lays them out in driving order after this),
  // so building again changes nothing.
  const place = new Map(lines.map((line, i) => [line.id, i]));
  b.lines = b.lines
    .map((line, i) => ({ line, at: place.get(line.id) ?? lines.length + i }))
    .sort((a, c) => a.at - c.at)
    .map(({ line }) => line);
  const changed =
    canonical(b.auto) !== canonical(auto) ||
    canonical(b.lines) !== canonical(lines);
  return changed
    ? { auto: b.auto, lines: b.lines, changed }
    : { auto, lines, changed };
}

function build(b: Builder, waitId: string): void {
  const auto = b.auto;
  const at = locateOnPlan(auto.cards, waitId)!;
  const wait = at.list[at.index] as FirstOfCard;
  const good = wait.rows.find((row) => "when" in row);
  const timeout = wait.rows.find((row) => "afterMs" in row);
  if (!good || !timeout) return;

  // Every route goes on to the plan's park, which stays where it is (at the end of the main
  // sequence), so the endgame guard covers every route. The rest of the plan after the wait
  // becomes its "tip came" row, so the other routes skip it.
  const park = planPark(auto);
  const after = at.list.splice(at.index + 1);
  const parkAt = park ? after.indexOf(park) : -1;
  if (parkAt >= 0) at.list.push(...after.splice(parkAt));
  good.cards.push(...after);
  good.label ??= `${tipName(wait)} came`;
  timeout.label ??= `${tipName(wait)} didn't come`;

  const prefix = ownPrefix(waitId);
  b.clear(prefix);
  const info = ladderInfo(auto, waitId)!;
  const kept = info.tries.filter((t) => t.status === "kept");
  /** Where the park path starts: where every route ends. */
  const parkFrom = park ? parkStart(auto, b, park) : undefined;
  const tip = tipName(wait);
  const rest = good.cards;
  /** The plan's next stop after the wait: where a try that works goes back to. */
  const nextStop = rest.findIndex((card) => card.kind === "path");

  // Where the robot is at the wait: the end of the last path before it on the plan.
  let here: Spot = { name: "the wait", heading: null };
  planWalk(auto.cards, (list, index) => {
    if (list[index].id === waitId) return true;
    const card = list[index];
    if (card.kind === "path") here = b.spotAfter(card, here);
  });

  /** The drive to where the park path starts, unless the robot is there already. */
  const toPark = (id: string, from: Spot): AutoCard[] =>
    parkFrom && from.name !== parkFrom ? [b.drive(id, parkFrom, from)] : [];

  const backToPlan = (id: string, from: Spot): AutoCard[] => {
    if (nextStop < 0) return toPark(id, from);
    const target = rest[nextStop] as PathCard;
    const line = b.lineById.get(target.lineId);
    const to = line ? b.auto.pathEnds[endSegment(line).id] : undefined;
    if (!to) return []; // A stop not on a named point: nothing to drive to by name.
    b.line(id, to, from);
    const card: RejoinCard = {
      id,
      kind: "rejoin",
      lineId: id,
      target: target.id,
    };
    return [card];
  };

  /**
   * The plan from its next stop, up to the drive to a source in `used`, then park. A wait on the
   * way whose own plan row reaches that source is copied with that row cut the same way.
   */
  const parkEarly = (
    copyPrefix: string,
    from: Spot,
    used: Set<Source>,
  ): AutoCard[] => {
    let first = true;
    const cutList = (
      list: AutoCard[],
      start: number,
      entry: Spot,
    ): AutoCard[] => {
      const out: AutoCard[] = [];
      /** Where the robot is after the cards copied so far. */
      const spot = () => {
        const lastPath = out
          .filter((card): card is PathCard => card.kind === "path")
          .pop();
        return lastPath ? b.spotAfter(lastPath, entry) : entry;
      };
      for (let i = start; i < list.length; i++) {
        const source = collectSource(list, i, b.auto.pathEnds);
        if (source && used.has(source)) {
          // Back over the drives and commands that lead there.
          while (
            out.length &&
            (out[out.length - 1].kind === "path" ||
              out[out.length - 1].kind === "action")
          ) {
            out.pop();
          }
          return [...out, ...toPark(`${copyPrefix}park`, spot())];
        }
        const card = list[i];
        if (card.kind === "firstOf") {
          const row = card.rows.find((r) => "when" in r);
          if (
            row?.cards.length &&
            firstUsed(row.cards, used, b.auto.pathEnds)
          ) {
            const empty = card.rows.map((r) =>
              r === row ? { ...r, cards: [] } : r,
            );
            const copied = b.copy(
              { ...card, rows: empty },
              copyPrefix,
            ) as FirstOfCard;
            copied.rows.find((r) => "when" in r)!.cards = cutList(
              row.cards,
              0,
              spot(),
            );
            return [...out, copied];
          }
        }
        const copied = b.copy(card, copyPrefix);
        if (copied.kind === "path" && first) {
          // The first stop is now driven from the try's last spot: name it so.
          first = false;
          const line = b.lineById.get(copied.lineId);
          const to = b.spotAfter(copied, entry).name;
          if (line) line.name = `${entry.name} to ${to}`;
        }
        out.push(copied);
      }
      return out;
    };
    return cutList(rest, Math.max(0, nextStop), from);
  };

  const route = (k: number, from: Spot, used: Set<Source>): AutoCard[] => {
    const entry = kept[k];
    if (!entry) return toPark(`${prefix}park`, from);
    const play = entry.play!;
    for (const [name, point] of Object.entries(play.points))
      b.auto.points[name] ??= [...point] as NamedPoint;
    const base = `${prefix}${play.id}-`;
    const n = entry.index + 1;
    const nowUsed = new Set(used);
    if (play.source) nowUsed.add(play.source);
    const cards: AutoCard[] = [];
    let spot = from;
    const shots = play.steps.filter((step) => step.kind === "shoot").length;
    let shot = 0;
    play.steps.forEach((step, s) => {
      if (step.kind === "drive") {
        cards.push(b.drive(`${base}${s}`, step.to, spot));
        spot = {
          name: step.to,
          heading: b.auto.points[step.to]?.[2] ?? spot.heading,
        };
      } else if (step.kind === "collect") {
        const upToS = entry.try.collectS ?? step.upToS;
        cards.push({
          id: `${base}${s}`,
          kind: "firstOf",
          label: `Try ${n}: collect${play.source ? ` at ${SOURCE_NAMES[play.source]}` : ""}`,
          rows: [
            { when: [FULL_TRIGGER], cards: [] },
            { afterMs: Math.round(upToS * 1000), cards: [] },
          ],
        });
      } else if (++shot < shots) {
        cards.push({
          id: `${base}${s}`,
          kind: "firstOf",
          label: `Try ${n}: shoot`,
          alongside: SHOOT_COMMAND,
          rows: [
            { when: [EMPTY_TRIGGER], cards: [] },
            { afterMs: Math.round(step.upToS * 1000), cards: [] },
          ],
        });
      } else {
        const upToS = entry.try.shootS ?? step.upToS;
        const works =
          entry.then?.kind === "parkEarly"
            ? parkEarly(`${base}c-`, spot, nowUsed)
            : backToPlan(`${base}back`, spot);
        cards.push({
          id: entry.waitId!,
          kind: "firstOf",
          label: `Try ${n}: shoot for ${tip}`,
          alongside: SHOOT_COMMAND,
          rows: [
            { when: [TIP_TRIGGER], cards: works, label: `Try ${n} worked` },
            {
              afterMs: Math.round(upToS * 1000),
              cards: route(k + 1, spot, nowUsed),
              label: `Try ${n} missed`,
            },
          ],
        });
      }
    });
    return cards;
  };

  timeout.cards = route(0, here, sourcesBefore(auto, waitId));
}

/** JSON with keys sorted: the same text for the same content, whichever order keys were set in. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [c]) =>
            a.localeCompare(c),
          ),
        )
      : v,
  );
}
