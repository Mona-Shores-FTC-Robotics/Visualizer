import {
  AUTO_FORMAT_VERSION,
  type Alliance,
  type AutoCard,
  type AutoRegistry,
  type AutoRow,
  type AutoSection,
  type NamedPoint,
  type PathEvent,
  type RoutineDef,
  type RoutineStep,
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
    pathEnds: {},
    routines: {},
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
  const registry: AutoRegistry = {
    actions: nameList(registryRaw.actions, "registry.actions", problems),
    conditions: nameList(registryRaw.conditions, "registry.conditions", problems),
  };
  if (registryRaw.events !== undefined) {
    const events = nameList(registryRaw.events, "registry.events", problems);
    const known = events.filter((name) => registry.conditions.includes(name));
    if (known.length < events.length) {
      problems.push("registry.events names a condition that is not registered; dropped it.");
    }
    if (known.length) registry.events = known;
  }
  if (isObject(registryRaw.typicalS)) {
    const typicalS: Record<string, number> = {};
    for (const [name, seconds] of Object.entries(registryRaw.typicalS)) {
      if (finite(seconds) && seconds >= 0) typicalS[name] = seconds;
    }
    if (Object.keys(typicalS).length) registry.typicalS = typicalS;
  }

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

  const pathEnds: Record<string, string> = {};
  if (raw.pathEnds !== undefined && !isObject(raw.pathEnds)) {
    problems.push("pathEnds is not an object of path id → point name; ignored it.");
  } else if (isObject(raw.pathEnds)) {
    for (const [lineId, name] of Object.entries(raw.pathEnds)) {
      if (typeof name === "string" && points[name.trim()]) pathEnds[lineId] = name.trim();
      else problems.push(`pathEnds: path ${lineId} is on "${String(name)}", which is not a named point; unpinned it.`);
    }
  }
  let startAt: string | undefined;
  if (raw.startAt !== undefined) {
    if (typeof raw.startAt === "string" && points[raw.startAt.trim()]) startAt = raw.startAt.trim();
    else problems.push(`startAt: "${String(raw.startAt)}" is not a named point; unpinned the start.`);
  }

  const routines: Record<string, RoutineDef> = {};
  if (raw.routines !== undefined && !isObject(raw.routines)) {
    problems.push("routines is not an object of name → routine; ignored it.");
  } else if (isObject(raw.routines)) {
    for (const [name, value] of Object.entries(raw.routines)) {
      const routine = normalizeRoutine(value, `routines.${name}`, problems);
      if (routine && name.trim()) routines[name.trim()] = routine;
    }
  }

  const seenIds = new Set<string>();
  const cards = normalizeCards(raw.cards, "cards", problems, seenIds);

  const auto: AutoSection = {
    version: AUTO_FORMAT_VERSION,
    drawnFor,
    registry,
    points,
    pathEnds,
    routines,
    cards,
  };
  if (startAt) auto.startAt = startAt;
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
      if (finite(raw.timeoutS) && raw.timeoutS > 0) card.timeoutS = raw.timeoutS;
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
        ...(typeof raw.alongside === "string" && raw.alongside.trim()
          ? { alongside: raw.alongside.trim() }
          : {}),
      };
    }
    case "routine":
      return {
        id: cardId(raw, seenIds),
        kind: "routine",
        routine: typeof raw.routine === "string" ? raw.routine : "",
        at: typeof raw.at === "string" ? raw.at : "",
        facingDeg: finite(raw.facingDeg) ? raw.facingDeg : 0,
        mirror: raw.mirror === true,
        exit: typeof raw.exit === "string" ? raw.exit : "",
      };
    case "goTo":
      return {
        id: cardId(raw, seenIds),
        kind: "goTo",
        label: typeof raw.label === "string" ? raw.label : "",
        point: typeof raw.point === "string" ? raw.point : "",
        maxDistanceIn: finite(raw.maxDistanceIn) && raw.maxDistanceIn > 0 ? raw.maxDistanceIn : 24,
        ifRefused: normalizeCards(raw.ifRefused, `${where}.ifRefused`, problems, seenIds),
      };
    case "together":
      if (raw.ends !== undefined && raw.ends !== "ALL" && raw.ends !== "FIRST") {
        problems.push(`${where}: ends must be "ALL" or "FIRST"; used ALL.`);
      }
      return {
        id: cardId(raw, seenIds),
        kind: "together",
        label: typeof raw.label === "string" ? raw.label : "",
        ends: raw.ends === "FIRST" ? "FIRST" : "ALL",
        cards: normalizeCards(raw.cards, `${where}.cards`, problems, seenIds),
      };
    default:
      problems.push(
        `${where} has unknown kind ${JSON.stringify(raw.kind)}; dropped it (this build knows action, path, firstOf, routine, goTo and together).`,
      );
      return null;
  }
}

function normalizeRoutine(
  raw: unknown,
  where: string,
  problems: string[],
): RoutineDef | null {
  if (!isObject(raw)) {
    problems.push(`${where} is not a routine; dropped it.`);
    return null;
  }
  const steps: RoutineStep[] = [];
  if (Array.isArray(raw.steps)) {
    raw.steps.forEach((step, index) => {
      if (isObject(step) && finite(step.forward) && finite(step.left)) {
        const out: RoutineStep = { forward: step.forward, left: step.left };
        if (
          Array.isArray(step.control) &&
          step.control.length === 2 &&
          step.control.every(finite)
        ) {
          out.control = [step.control[0], step.control[1]];
        }
        steps.push(out);
      } else {
        problems.push(`${where}.steps[${index}] needs numbers "forward" and "left"; dropped it.`);
      }
    });
  }
  return {
    steps,
    endsWhen: typeof raw.endsWhen === "string" ? raw.endsWhen.trim() : "",
    timeoutMs: finite(raw.timeoutMs) && raw.timeoutMs > 0 ? raw.timeoutMs : 3000,
    while: nameList(raw.while, `${where}.while`, problems),
    exit: nameList(raw.exit, `${where}.exit`, problems),
  };
}

const ROW_KEYS = [
  "when",
  "afterMs",
  "timeLeftBelowS",
  "otherwise",
  "nearPoint",
  "inArea",
  "finished",
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
        ? `${where} has no condition (when, afterMs, timeLeftBelowS, otherwise, nearPoint, inArea or finished); dropped it.`
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
    case "finished":
      return { ...common, finished: true };
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
        return {
          id: c.id,
          kind: "action",
          name: c.name,
          ...(c.timeoutS ? { timeoutS: c.timeoutS } : {}),
          ...(c.previewMs ? { previewMs: c.previewMs } : {}),
        };
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
          ...(c.alongside ? { alongside: c.alongside } : {}),
        };
      case "routine":
        return {
          id: c.id,
          kind: "routine",
          routine: c.routine,
          at: c.at,
          facingDeg: c.facingDeg,
          mirror: c.mirror,
          exit: c.exit,
        };
      case "goTo":
        return {
          id: c.id,
          kind: "goTo",
          label: c.label,
          point: c.point,
          maxDistanceIn: c.maxDistanceIn,
          ifRefused: c.ifRefused.map(card),
        };
      case "together":
        return {
          id: c.id,
          kind: "together",
          label: c.label,
          ends: c.ends,
          cards: c.cards.map(card),
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
      // Written only when there are some, so older files stay as they were.
      ...(auto.registry.events?.length ? { events: [...auto.registry.events] } : {}),
      ...(auto.registry.typicalS && Object.keys(auto.registry.typicalS).length
        ? { typicalS: { ...auto.registry.typicalS } }
        : {}),
    },
    points: Object.fromEntries(
      Object.entries(auto.points).map(([name, point]) => [name, [...point]]),
    ) as Record<string, NamedPoint>,
    // Always written, even empty: a file without it is one from before pins,
    // whose ends on named points the editor pins when it opens the file.
    pathEnds: { ...auto.pathEnds },
    routines: Object.fromEntries(
      Object.entries(auto.routines).map(([name, routine]) => [
        name,
        {
          steps: routine.steps.map((step) =>
            step.control
              ? { forward: step.forward, left: step.left, control: [step.control[0], step.control[1]] }
              : { forward: step.forward, left: step.left },
          ),
          endsWhen: routine.endsWhen,
          timeoutMs: routine.timeoutMs,
          while: [...routine.while],
          exit: [...routine.exit],
        },
      ]),
    ) as Record<string, RoutineDef>,
    cards: auto.cards.map(card),
  };
  // Written only when there are some, so files without routines stay as they were.
  if (Object.keys(out.routines).length === 0) {
    delete (out as Partial<AutoSection>).routines;
  }
  if (auto.startAt) out.startAt = auto.startAt;
  if (auto.exportName) out.exportName = auto.exportName;
  return out;
}
