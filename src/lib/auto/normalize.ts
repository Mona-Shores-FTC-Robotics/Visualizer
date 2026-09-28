import {
  AUTO_FORMAT_VERSION,
  type Alliance,
  type AutoCard,
  type AutoRow,
  type AutoSection,
  type NamedPoint,
  type PathEvent,
} from "./types";
import { makeCardId } from "./tree";

/**
 * Reading the `auto` section of a file.
 *
 * The loader is forgiving: it keeps everything it can make sense of and
 * reports, in plain words, what it had to drop or repair. It never throws, so
 * a damaged `auto` section cannot stop the paths themselves from loading.
 */
export interface NormalizeResult {
  /** Null when the file has no `auto` section. */
  auto: AutoSection | null;
  problems: string[];
}

export function createEmptyAuto(drawnFor: Alliance = "BLUE"): AutoSection {
  return {
    version: AUTO_FORMAT_VERSION,
    drawnFor,
    registry: { actions: [], conditions: [] },
    points: {},
    cards: [],
  };
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function nameList(value: unknown, where: string, problems: string[]): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    problems.push(`${where} should be a list of names; ignored it.`);
    return [];
  }
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !entry.trim()) {
      problems.push(`${where} has an entry that is not a name; dropped it.`);
      continue;
    }
    const name = entry.trim();
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

export function normalizeAuto(raw: unknown): NormalizeResult {
  const problems: string[] = [];
  if (raw === undefined || raw === null) return { auto: null, problems };
  if (!isObject(raw)) {
    return {
      auto: null,
      problems: ["The file's `auto` section is not an object, so it was not loaded."],
    };
  }

  if (raw.version !== undefined && raw.version !== AUTO_FORMAT_VERSION) {
    const newer = finite(raw.version) && raw.version > AUTO_FORMAT_VERSION;
    problems.push(
      newer
        ? `The Auto was saved by a newer Auto builder (format ${raw.version}, this one reads ${AUTO_FORMAT_VERSION}). Parts of it may be missing.`
        : `Unknown Auto format version ${String(raw.version)}; read it as version ${AUTO_FORMAT_VERSION}.`,
    );
  }

  let drawnFor: Alliance = "BLUE";
  if (raw.drawnFor === "RED" || raw.drawnFor === "BLUE") {
    drawnFor = raw.drawnFor;
  } else if (raw.drawnFor !== undefined) {
    problems.push(`drawnFor must be "RED" or "BLUE"; used BLUE.`);
  }

  const registryRaw = isObject(raw.registry) ? raw.registry : {};
  if (raw.registry !== undefined && !isObject(raw.registry)) {
    problems.push("The registry is not an object; started an empty one.");
  }
  const registry = {
    actions: nameList(registryRaw.actions, "registry.actions", problems),
    conditions: nameList(registryRaw.conditions, "registry.conditions", problems),
  };

  const points: Record<string, NamedPoint> = {};
  if (raw.points !== undefined && !isObject(raw.points)) {
    problems.push("points is not an object of name → [x, y]; ignored it.");
  } else if (isObject(raw.points)) {
    for (const [name, value] of Object.entries(raw.points)) {
      if (
        Array.isArray(value) &&
        (value.length === 2 || value.length === 3) &&
        value.every(finite) &&
        name.trim()
      ) {
        points[name.trim()] = [...value] as NamedPoint;
      } else {
        problems.push(`Point "${name}" is not [x, y] or [x, y, heading]; dropped it.`);
      }
    }
  }

  const seenIds = new Set<string>();
  const cards = normalizeCards(raw.cards, "cards", problems, seenIds);

  const auto: AutoSection = {
    version: AUTO_FORMAT_VERSION,
    drawnFor,
    registry,
    points,
    cards,
  };
  if (typeof raw.exportName === "string" && raw.exportName.trim()) {
    auto.exportName = raw.exportName.trim();
  }
  return { auto, problems };
}

function normalizeCards(
  value: unknown,
  where: string,
  problems: string[],
  seenIds: Set<string>,
): AutoCard[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    problems.push(`${where} is not a list; ignored it.`);
    return [];
  }
  const out: AutoCard[] = [];
  value.forEach((entry, index) => {
    const card = normalizeCard(entry, `${where}[${index}]`, problems, seenIds);
    if (card) out.push(card);
  });
  return out;
}

function cardId(raw: Record<string, unknown>, seenIds: Set<string>): string {
  let id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : "";
  // Ids address cards in the editor, so a duplicate would make two cards one.
  // "#" separates a card from its row in the editor's selection.
  if (!id || seenIds.has(id) || id.includes("#")) id = makeCardId();
  seenIds.add(id);
  return id;
}

function normalizeCard(
  raw: unknown,
  where: string,
  problems: string[],
  seenIds: Set<string>,
): AutoCard | null {
  if (!isObject(raw)) {
    problems.push(`${where} is not a card; dropped it.`);
    return null;
  }
  switch (raw.kind) {
    case "action": {
      const card: AutoCard = {
        id: cardId(raw, seenIds),
        kind: "action",
        name: typeof raw.name === "string" ? raw.name.trim() : "",
      };
      if (!card.name) problems.push(`${where} is an action with no name.`);
      if (finite(raw.previewMs) && raw.previewMs > 0) {
        card.previewMs = raw.previewMs;
      }
      return card;
    }
    case "path": {
      const events: PathEvent[] = [];
      if (Array.isArray(raw.events)) {
        raw.events.forEach((event, index) => {
          if (
            isObject(event) &&
            finite(event.at) &&
            typeof event.action === "string" &&
            event.action.trim()
          ) {
            events.push({
              at: Math.min(1, Math.max(0, event.at)),
              action: event.action.trim(),
            });
          } else {
            problems.push(`${where}.events[${index}] needs "at" (0..1) and "action"; dropped it.`);
          }
        });
      }
      events.sort((a, b) => a.at - b.at);
      const lineId = typeof raw.lineId === "string" ? raw.lineId : "";
      if (!lineId) problems.push(`${where} is a path card with no lineId.`);
      return {
        id: cardId(raw, seenIds),
        kind: "path",
        lineId,
        while: nameList(raw.while, `${where}.while`, problems),
        events,
        park: raw.park === true,
      };
    }
    case "firstOf": {
      const rows: AutoRow[] = [];
      if (Array.isArray(raw.rows)) {
        raw.rows.forEach((row, index) => {
          const normalized = normalizeRow(row, `${where}.rows[${index}]`, problems, seenIds);
          if (normalized) rows.push(normalized);
        });
      } else {
        problems.push(`${where} has no rows.`);
      }
      return {
        id: cardId(raw, seenIds),
        kind: "firstOf",
        label: typeof raw.label === "string" ? raw.label : "",
        rows,
      };
    }
    default:
      problems.push(
        `${where} has unknown kind ${JSON.stringify(raw.kind)}; dropped it (this build knows action, path and firstOf).`,
      );
      return null;
  }
}

const ROW_KEYS = [
  "when",
  "afterMs",
  "timeLeftBelowS",
  "otherwise",
  "nearPoint",
  "inArea",
] as const;

function normalizeRow(
  raw: unknown,
  where: string,
  problems: string[],
  seenIds: Set<string>,
): AutoRow | null {
  if (!isObject(raw)) {
    problems.push(`${where} is not a row; dropped it.`);
    return null;
  }
  const keys = ROW_KEYS.filter((key) => raw[key] !== undefined);
  if (keys.length !== 1) {
    problems.push(
      keys.length === 0
        ? `${where} has no condition (when, afterMs, timeLeftBelowS, otherwise, nearPoint or inArea); dropped it.`
        : `${where} has more than one condition (${keys.join(", ")}); dropped it.`,
    );
    return null;
  }
  const cards = normalizeCards(raw.cards, `${where}.cards`, problems, seenIds);
  const common: { cards: AutoCard[]; label?: string } = { cards };
  if (typeof raw.label === "string" && raw.label.trim()) {
    common.label = raw.label.trim();
  }

  const nonNegative = (value: unknown, what: string): number | null => {
    if (finite(value) && value >= 0) return value;
    problems.push(`${where}: ${what} must be a number ≥ 0; dropped the row.`);
    return null;
  };

  switch (keys[0]) {
    case "when":
      return { ...common, when: nameList(raw.when, `${where}.when`, problems) };
    case "afterMs": {
      const ms = nonNegative(raw.afterMs, "afterMs");
      return ms === null ? null : { ...common, afterMs: ms };
    }
    case "timeLeftBelowS": {
      const s = nonNegative(raw.timeLeftBelowS, "timeLeftBelowS");
      return s === null ? null : { ...common, timeLeftBelowS: s };
    }
    case "otherwise":
      return { ...common, otherwise: true };
    case "nearPoint": {
      const radius = nonNegative(raw.radiusIn ?? 6, "radiusIn");
      if (typeof raw.nearPoint !== "string" || radius === null) {
        if (typeof raw.nearPoint !== "string")
          problems.push(`${where}: nearPoint must name a point; dropped the row.`);
        return null;
      }
      return { ...common, nearPoint: raw.nearPoint, radiusIn: radius };
    }
    case "inArea": {
      const area = raw.inArea;
      if (
        !Array.isArray(area) ||
        area.length !== 2 ||
        !area.every((name) => typeof name === "string")
      ) {
        problems.push(`${where}: inArea must name two corner points; dropped the row.`);
        return null;
      }
      return { ...common, inArea: [area[0], area[1]] as [string, string] };
    }
  }
}

/**
 * The section as it is written to a file: the normalized object with keys in
 * a fixed order, so saving twice gives the same bytes.
 */
export function serializeAuto(auto: AutoSection): AutoSection {
  const card = (c: AutoCard): AutoCard => {
    switch (c.kind) {
      case "action":
        return c.previewMs
          ? { id: c.id, kind: "action", name: c.name, previewMs: c.previewMs }
          : { id: c.id, kind: "action", name: c.name };
      case "path":
        return {
          id: c.id,
          kind: "path",
          lineId: c.lineId,
          while: [...c.while],
          events: c.events.map((e) => ({ at: e.at, action: e.action })),
          park: c.park,
        };
      case "firstOf":
        return {
          id: c.id,
          kind: "firstOf",
          label: c.label,
          rows: c.rows.map(row),
        };
    }
  };
  const row = (r: AutoRow): AutoRow => {
    const { cards, label, ...condition } = r;
    const out = { ...condition } as AutoRow;
    if (label) out.label = label;
    out.cards = cards.map(card);
    return out;
  };
  const out: AutoSection = {
    version: AUTO_FORMAT_VERSION,
    drawnFor: auto.drawnFor,
    registry: {
      actions: [...auto.registry.actions],
      conditions: [...auto.registry.conditions],
    },
    points: Object.fromEntries(
      Object.entries(auto.points).map(([name, point]) => [name, [...point]]),
    ) as Record<string, NamedPoint>,
    cards: auto.cards.map(card),
  };
  if (auto.exportName) out.exportName = auto.exportName;
  return out;
}
