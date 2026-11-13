import type { Path, Settings, Shape, StartPose } from "../../../types";
import { FIELD_SIZE } from "../../../config";
import { buildExportModel } from "../model";
import { pathExpression } from "../emit";
import { javaSpec } from "../languages/java";
import { camelCase, isReservedWord, sanitizeIdentifier } from "../identifiers";
import type {
  HeadingCall,
  InterpolatorRef,
  PathExpr,
  PoseDecl,
} from "../types";
import {
  buildPathCatalog,
  withEndAt,
  type PathCatalog,
} from "../../auto/geometry";
import { parkSeconds } from "../../auto/simulate";
import { validateAuto } from "../../auto/validate";
import { relink } from "../../auto/links";
import { compileLadders } from "../../ladder/compile";
import {
  allCards,
  isPlainWait,
  listLabel,
  locateCard,
  parkLineIds,
  parkSpots,
  rejoinTail,
  parkCardOf,
  rowLabel,
  usedNames,
} from "../../auto/tree";
import { isUsed, pointUses } from "../../auto/pins";
import {
  type AutoCard,
  type AutoRow,
  type AutoSection,
  type FirstOfCard,
  type NamedPoint,
} from "../../auto/types";

/**
 * The Auto builder's Java export: one final class per Auto that builds the
 * whole Autonomous with the robot's `autokit` library. The shape is fixed by
 * the contract between the two (docs/auto-format.md, "Generated Java").
 */

export const AUTO_PACKAGE =
  "org.firstinspires.ftc.teamcode.opmodes.auto.generated";

export interface AutoExportInput {
  auto: AutoSection;
  startPoint: StartPose;
  lines: Path[];
  shapes: Shape[];
  settings: Settings;
  /** The .pp file name, e.g. `hive-rush.pp`; recorded in SOURCE. */
  sourceFileName: string;
  /**
   * When the .pp was saved (its `timestamp`, ISO 8601); recorded in SAVED, which the OpMode's name on the
   * Driver Station ends with, so the drive team can see which save is on the robot.
   */
  savedAt?: string;
}

/** The team's time zone: SAVED reads the same whichever computer exported the Auto. */
export const SAVED_TIME_ZONE = "America/Detroit";

/**
 * The time the Visualizer's own tests freeze the clock at (test/support/setup.ts). A .pp written by a
 * script under them carries it, and it is no save time: such a .pp gets no stamp.
 */
const TEST_CLOCK = "2026-01-01T00:00:00.000Z";

/**
 * `2026-10-31T04:22:12Z` → `10-31|12:22AM` (Michigan time). Empty without a real save time, so the
 * Driver Station shows the plain name until the Auto is next saved.
 */
export function savedStamp(savedAt: string | undefined): string {
  const date = savedAt ? new Date(savedAt) : null;
  if (
    !date ||
    Number.isNaN(date.getTime()) ||
    date.toISOString() === TEST_CLOCK
  )
    return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: SAVED_TIME_ZONE,
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.month}-${parts.day}|${parts.hour}:${parts.minute}${String(parts.dayPeriod).toUpperCase()}`;
}

export type AutoExportResult =
  | {
      ok: true;
      className: string;
      fileName: string;
      source: string;
      warnings: string[];
    }
  | { ok: false; errors: string[]; warnings: string[] };

/** `hive-rush` → `HiveRushAuto`. */
export function autoClassName(exportName: string): string {
  const stem = exportName.replace(/\.pp$/i, "");
  const words = stem.split(/[^A-Za-z0-9]+/).filter(Boolean);
  let name = words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
  if (!name) name = "Untitled";
  if (/^[0-9]/.test(name)) name = `Auto${name}`;
  return `${name}Auto`;
}

/** A plain Java decimal: at most 4 decimals, no trailing zeros. */
export function javaNumber(value: number): string {
  return javaSpec.numberLiteral(value);
}

/** A Java string literal. */
export function javaString(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  return `"${escaped}"`;
}

export { parkSeconds };

class Names {
  private readonly used = new Set<string>(["p", "kit", "rotated"]);

  take(preferred: string): string {
    let base = preferred || "value";
    if (isReservedWord(base)) base = `${base}Value`;
    if (!this.used.has(base)) {
      this.used.add(base);
      return base;
    }
    let counter = 2;
    while (this.used.has(`${base}${counter}`)) counter += 1;
    this.used.add(`${base}${counter}`);
    return `${base}${counter}`;
  }

  has(name: string): boolean {
    return this.used.has(name) || isReservedWord(name);
  }
}

// --- pose references inside path expressions -------------------------------

function interpolatorVars(ref: InterpolatorRef): {
  vars: string[];
  headingVars: string[];
} {
  switch (ref.kind) {
    case "constant":
      return { vars: [ref.poseVar], headingVars: [ref.poseVar] };
    case "linear":
      return {
        vars: [ref.startPoseVar, ref.endPoseVar],
        headingVars: [ref.startPoseVar, ref.endPoseVar],
      };
    case "facingPoint":
      return { vars: [ref.poseVar], headingVars: [] };
    case "tangent":
      return { vars: [], headingVars: [] };
  }
}

function headingVarsOf(heading: HeadingCall | null): {
  vars: string[];
  headingVars: string[];
} {
  if (!heading) return { vars: [], headingVars: [] };
  switch (heading.kind) {
    case "constant":
      return { vars: [heading.poseVar], headingVars: [heading.poseVar] };
    case "linear":
      return {
        vars: [heading.startPoseVar, heading.endPoseVar],
        headingVars: [heading.startPoseVar, heading.endPoseVar],
      };
    case "facingPoint":
      return { vars: [heading.poseVar], headingVars: [] };
    case "piecewise": {
      const vars: string[] = [];
      const headingVars: string[] = [];
      heading.nodes.forEach((node) => {
        const found = interpolatorVars(node.interpolator);
        vars.push(...found.vars);
        headingVars.push(...found.headingVars);
      });
      return { vars, headingVars };
    }
    default:
      return { vars: [], headingVars: [] };
  }
}

function collectVars(
  expr: PathExpr,
  vars: Set<string>,
  headingVars: Set<string>,
): void {
  if (expr.kind === "group") {
    expr.children.forEach((child) => collectVars(child, vars, headingVars));
  } else {
    [
      expr.startPoseVar,
      ...expr.controlPoseVars,
      ...expr.throughPoseVars,
      expr.endPoseVar,
    ].forEach((name) => vars.add(name));
  }
  const found = headingVarsOf(expr.heading);
  found.vars.forEach((name) => vars.add(name));
  found.headingVars.forEach((name) => headingVars.add(name));
}

function usesPiecewise(expr: PathExpr): boolean {
  if (expr.heading?.kind === "piecewise") return true;
  return expr.kind === "group" && expr.children.some(usesPiecewise);
}

function renameInterpolator(
  ref: InterpolatorRef,
  map: (name: string) => string,
): InterpolatorRef {
  switch (ref.kind) {
    case "constant":
      return { kind: "constant", poseVar: map(ref.poseVar) };
    case "linear":
      return {
        kind: "linear",
        startPoseVar: map(ref.startPoseVar),
        endPoseVar: map(ref.endPoseVar),
      };
    case "facingPoint":
      return { kind: "facingPoint", poseVar: map(ref.poseVar) };
    case "tangent":
      return ref;
  }
}

function renameHeading(
  heading: HeadingCall | null,
  map: (name: string) => string,
): HeadingCall | null {
  if (!heading) return null;
  switch (heading.kind) {
    case "constant":
      return { kind: "constant", poseVar: map(heading.poseVar) };
    case "linear":
      return {
        kind: "linear",
        startPoseVar: map(heading.startPoseVar),
        endPoseVar: map(heading.endPoseVar),
      };
    case "facingPoint":
      return { kind: "facingPoint", poseVar: map(heading.poseVar) };
    case "piecewise":
      return {
        kind: "piecewise",
        nodes: heading.nodes.map((node) => ({
          ...node,
          interpolator: renameInterpolator(node.interpolator, map),
        })),
      };
    default:
      return heading;
  }
}

function renameExpr(expr: PathExpr, map: (name: string) => string): PathExpr {
  if (expr.kind === "group") {
    return {
      kind: "group",
      children: expr.children.map((child) => renameExpr(child, map)),
      heading: renameHeading(expr.heading, map),
    };
  }
  return {
    kind: "segment",
    startPoseVar: map(expr.startPoseVar),
    controlPoseVars: expr.controlPoseVars.map(map),
    throughPoseVars: expr.throughPoseVars.map(map),
    endPoseVar: map(expr.endPoseVar),
    heading: renameHeading(expr.heading, map),
  };
}

// --- printing ---------------------------------------------------------------

type JNode =
  | string
  | { head: string; args: string[]; children: JNode[]; close?: string };

/** Fork: a route choice's legs, the drawing's default (its trigger row) first. */
function legsOf(card: FirstOfCard): AutoRow[] {
  return [...card.rows].sort(
    (a, b) => ("when" in a ? 0 : 1) - ("when" in b ? 0 : 1),
  );
}

function printNode(node: JNode, indent: number): string {
  if (typeof node === "string") return node;
  const pad = " ".repeat(indent + 8);
  let out = `${node.head}(${node.args.join(", ")}`;
  if (node.children.length > 0) {
    if (node.args.length > 0) out += ",";
    out += node.children
      .map(
        (child, index) =>
          `${index > 0 ? "," : ""}\n${pad}${printNode(child, indent + 8)}`,
      )
      .join("");
  }
  return `${out}${node.close ?? ")"}`;
}

const sameAngle = (a: number, b: number) =>
  Math.abs(((((a - b) % 360) + 540) % 360) - 180) < 1e-6;

// --- the generator ------------------------------------------------------------

export function generateAutoJava(input: AutoExportInput): AutoExportResult {
  const { startPoint, settings } = input;
  // Build the ladders and lay the paths out as the editor does, so a file straight from disk
  // exports the same.
  const built = compileLadders(input.auto, input.lines);
  const auto = built.auto;
  const lines = relink(startPoint, built.lines, auto, settings).lines;
  const catalog: PathCatalog = buildPathCatalog(startPoint, lines, settings);
  const issues = validateAuto(auto, catalog, startPoint);
  const errors = issues
    .filter((issue) => issue.level === "error")
    .map((issue) => issue.message);
  const warnings = issues
    .filter((issue) => issue.level === "warning")
    .map((issue) => issue.message);
  if (errors.length > 0) return { ok: false, errors, warnings };

  const sourceFileName = input.sourceFileName || "untitled.pp";
  const className = autoClassName(auto.exportName || sourceFileName);
  const model = buildExportModel({ startPoint, lines });
  const names = new Names();

  // Named points keep their names; everything else is named around them.
  // A point nothing uses (validation warns about it) is left out.
  const uses = pointUses(auto);
  const pointVars = new Map<string, string>();
  const pointDecls: { varName: string; point: NamedPoint }[] = [];
  for (const [name, point] of Object.entries(auto.points)) {
    if (!isUsed(uses.get(name))) continue;
    const varName = names.take(
      camelCase(sanitizeIdentifier(lowerShouting(name), "point")),
    );
    pointVars.set(name, varName);
    pointDecls.push({ varName, point });
  }

  // The paths the cards drive, in list order.
  const cards = allCards(auto.cards);
  const referenced = new Set<number>();
  for (const card of cards) {
    if (card.kind !== "path" && card.kind !== "rejoin") continue;
    const info = catalog.byId.get(card.lineId);
    if (info) referenced.add(info.index);
    // Fork: a drive's park from its spot is written too (types.ts parkFrom).
    const parkId = card.kind === "path" ? auto.parkFrom?.[card.id] : undefined;
    const park = parkId ? catalog.byId.get(parkId) : undefined;
    if (park) referenced.add(park.index);
  }
  const usedIndices = [...referenced].sort((a, b) => a - b);

  // Fork: the PARK spot the drive team may change in INIT (types.ts parkChoices). Every park
  // path ends on the picked one, and the guard reserves that one's time.
  const drawnPark = [...parkSpots(auto, catalog)][0];
  const parkChoices = drawnPark
    ? (auto.parkChoices ?? []).filter(
        (name) => name !== drawnPark && auto.points[name],
      )
    : [];
  const parkIds = parkChoices.length ? parkLineIds(auto) : new Set<string>();
  const parkVar = parkChoices.length ? names.take("park") : null;
  /** A park line's seconds with its end moved to each choice, the drawing's first. */
  const parkChoiceSeconds = (lineId: string): number[] => {
    const drawn = catalog.byId.get(lineId)!.seconds;
    return [
      drawn,
      ...parkChoices.map((name) => {
        const [x, y] = auto.points[name];
        const moved = lines.map((line) =>
          line.id === lineId ? withEndAt(line, x, y) : line,
        );
        return (
          buildPathCatalog(startPoint, moved, settings).byId.get(lineId)
            ?.seconds ?? drawn
        );
      }),
    ];
  };

  const usedVars = new Set<string>();
  const headingVars = new Set<string>();
  usedIndices.forEach((index) =>
    collectVars(model.paths[index].expression, usedVars, headingVars),
  );

  // Poses named after a path (its control points) follow the path's Java name.
  const prefixes = catalog.paths
    .map((info) => ({
      raw: camelCase(sanitizeIdentifier(info.name, "path")),
      nice: camelCase(sanitizeIdentifier(lowerShouting(info.name), "path")),
    }))
    .filter((p) => p.raw !== p.nice)
    .sort((a, b) => b.raw.length - a.raw.length);
  const niceName = (name: string) => {
    const hit = prefixes.find((p) => name.startsWith(p.raw));
    return hit ? hit.nice + name.slice(hit.raw.length) : name;
  };

  // A pose that sits on a named point becomes that point, unless the heading
  // it carries matters and differs from the point's.
  const poseRename = new Map<string, string>();
  const poseDecls: PoseDecl[] = [];
  for (const pose of model.poses) {
    if (!usedVars.has(pose.varName) || poseRename.has(pose.varName)) continue;
    const named = pointDecls.find(
      ({ point }) =>
        Math.abs(point[0] - pose.x) < 1e-6 &&
        Math.abs(point[1] - pose.y) < 1e-6 &&
        (!headingVars.has(pose.varName) ||
          sameAngle(point[2] ?? 0, pose.headingDeg)),
    );
    if (named) {
      poseRename.set(pose.varName, named.varName);
      continue;
    }
    const varName = names.take(niceName(pose.varName));
    poseRename.set(pose.varName, varName);
    poseDecls.push({ ...pose, varName });
  }
  const renamePose = (name: string) => poseRename.get(name) ?? name;

  const pose = (x: number, y: number, h: number) =>
    `p.of(${javaNumber(x)}, ${javaNumber(y)}, ${javaNumber(h)})`;

  const pathVars = new Map<number, string>();
  const pathDecls: string[] = [];
  let usesInterpolator = false;
  for (const index of usedIndices) {
    const info = catalog.paths.find((path) => path.index === index)!;
    const base = camelCase(
      sanitizeIdentifier(lowerShouting(info.name), "path"),
    );
    const varName = names.take(names.has(base) ? `${base}Path` : base);
    pathVars.set(index, varName);
    const decl = model.paths[index];
    let expression = renameExpr(decl.expression, renamePose);
    if (parkVar && parkIds.has(info.id)) {
      // Ends on the park the drive team picked, whichever spot that is.
      const end = lastEndVar(expression);
      expression = renameExpr(expression, (name) =>
        name === end ? parkVar : name,
      );
    }
    if (usesPiecewise(expression)) usesInterpolator = true;
    const note = decl.note ? `        // ${decl.note}\n` : "";
    pathDecls.push(
      `${note}        Path ${varName} = ${pathExpression({ ...decl, expression }, javaSpec)};`,
    );
  }

  const pathOf = (lineId: string) => {
    const info = catalog.byId.get(lineId)!;
    return { info, varName: pathVars.get(info.index)! };
  };
  /** A park path's seconds: a number, or the drive team's pick of one per park choice. */
  const parkSecondsOf = (lineId: string): string => {
    if (!parkIds.has(lineId))
      return javaNumber(parkSeconds(catalog.byId.get(lineId)!.seconds));
    const each = parkChoiceSeconds(lineId).map((s) =>
      javaDouble(parkSeconds(s)),
    );
    return `kit.pick(AutoOption.PARK, ${each.join(", ")})`;
  };
  // Fork: each drive carries its time, so the endgame guard does not set off on one that it and
  // the park after it no longer fit (biobuzz AutoKit.path(label, path, seconds)).
  const pathNode = (lineId: string): JNode => {
    const { info, varName } = pathOf(lineId);
    // The drive to the park says which park it drives to, in the trace and the match log.
    const label =
      parkIds.has(lineId) && info.name === `to ${drawnPark}`
        ? `kit.pick(AutoOption.PARK, ${[drawnPark!, ...parkChoices].map((name) => javaString(`to ${name}`)).join(", ")})`
        : javaString(info.name);
    return `kit.path(${label}, ${varName}, ${parkSecondsOf(lineId)})`;
  };
  /** A drive-through chain: one Pedro path, so the robot does not stop between them. */
  const chainNode = (lineIds: string[]): JNode => {
    const parts = lineIds.map(pathOf);
    const seconds = parts.reduce((sum, p) => sum + p.info.seconds, 0);
    return `kit.path(${javaString(parts.map((p) => p.info.name).join(" → "))}, Paths.path(${parts.map((p) => p.varName).join(", ")}), ${javaNumber(parkSeconds(seconds))})`;
  };

  const cardNode = (card: AutoCard): JNode => {
    switch (card.kind) {
      case "action":
        return card.timeoutS
          ? `kit.command(${javaString(card.name)}, ${javaNumber(card.timeoutS)})`
          : `kit.command(${javaString(card.name)})`;
      case "path": {
        // Fork: a drive that carries a park from its spot:
        // kit.path(label, path, seconds, park, parkSeconds).
        const parkId = auto.parkFrom?.[card.id];
        if (parkId && catalog.byId.has(parkId)) {
          const { info, varName } = pathOf(card.lineId);
          const park = pathOf(parkId);
          return `kit.path(${javaString(info.name)}, ${varName}, ${parkSecondsOf(card.lineId)}, ${park.varName}, ${parkSecondsOf(parkId)})`;
        }
        return pathNode(card.lineId);
      }
      case "firstOf":
        return {
          head: "kit.firstOf",
          args: card.alongside
            ? [
                javaString(firstOfLabel(card)),
                `kit.command(${javaString(card.alongside)})`,
              ]
            : [javaString(firstOfLabel(card))],
          children: card.rows.map((row) => rowNode(row, card)),
        };
      case "rejoin": {
        // Joining a drive-through: one Pedro path on through the rest of its chain.
        const through = rejoinTail(auto.cards, card.target)?.through ?? [];
        return through.length > 0
          ? chainNode([card.lineId, ...through.map((c) => c.lineId)])
          : pathNode(card.lineId);
      }
    }
  };

  // Rejoined tails: the steps after a stop that a rejoin joins at are one Supplier both routes
  // call, not a copy. Declared shortest first, since a longer tail may call a shorter one.
  const tailVars = new Map<string, string>();
  const tailDecls: { varName: string; targetId: string; size: number }[] = [];
  for (const card of cards) {
    if (card.kind !== "rejoin") continue;
    const tail = rejoinTail(auto.cards, card.target);
    // Keyed by the stop the shared steps follow: a drive-through target's chain end.
    if (!tail || tailVars.has(tail.join.id)) continue;
    const spot =
      auto.pathEnds[catalog.byId.get(tail.join.lineId)?.endSegmentId ?? ""];
    const base = `after${pascal(spot ?? catalog.byId.get(tail.join.lineId)?.name ?? "Stop")}`;
    const varName = names.take(base);
    tailVars.set(tail.join.id, varName);
    tailDecls.push({
      varName,
      targetId: tail.join.id,
      size: allCards(tail.list.slice(tail.index)).length,
    });
  }
  tailDecls.sort((a, b) => a.size - b.size);

  const listNodes = (list: AutoCard[], label: string): JNode[] => {
    const nodes: JNode[] = [];
    for (let i = 0; i < list.length; i++) {
      const card = list[i];
      if (card.kind === "path" && card.through) {
        // A drive-through chain: one Pedro path, so the robot does not stop between them.
        const chain = [card];
        while (
          chain[chain.length - 1].through &&
          list[i + chain.length]?.kind === "path"
        ) {
          chain.push(list[i + chain.length] as typeof card);
        }
        if (chain.length > 1) {
          nodes.push(chainNode(chain.map((c) => c.lineId)));
          i += chain.length - 1;
          const last = chain[chain.length - 1];
          if (tailVars.has(last.id)) {
            nodes.push(`${tailVars.get(last.id)}.get()`);
            break;
          }
          continue;
        }
      }
      if (card.kind === "firstOf" && card.choice) {
        // Fork: a route choice. Each leg's cards, one leg after the other, each on its own
        // choice of the option: the list stays flat, so the guard plans through the picked leg.
        legsOf(card).forEach((leg, index) => {
          for (const legCard of leg.cards)
            nodes.push(routeNode(card.choice!, index, cardNode(legCard)));
        });
        continue;
      }
      nodes.push(cardNode(card));
      if (card.kind === "rejoin") {
        const join = rejoinTail(auto.cards, card.target)?.join;
        if (join && tailVars.has(join.id))
          nodes.push(`${tailVars.get(join.id)}.get()`);
      }
      if (tailVars.has(card.id)) {
        nodes.push(`${tailVars.get(card.id)}.get()`);
        break;
      }
    }
    const park = parkCardOf(list);
    if (!park) return nodes;
    const { varName } = pathOf(park.lineId);
    return [
      {
        head: "kit.guarded",
        args: [javaString(label), varName, parkSecondsOf(park.lineId)],
        children: nodes,
      },
    ];
  };

  /** Fork: one card of a route choice's leg, built only when the drive team picked that leg. */
  const routeNode = (option: string, index: number, node: JNode): JNode => {
    const open = `kit.route(${javaString(option)}, ${index}, () -> `;
    return typeof node === "string"
      ? `${open}${node})`
      : { head: `${open}${node.head}`, args: node.args, children: node.children, close: "))" };
  };

  /** Fork: the seconds a row's match-clock time is written as: the INIT menu's, or the drawing's. */
  const clockSeconds = (row: AutoRow): string =>
    "afterMs" in row
      ? row.option
        ? `kit.seconds(${javaString(row.option)}, ${javaNumber(row.afterMs / 1000)})`
        : javaNumber(row.afterMs / 1000)
      : "0";

  const rowNode = (row: AutoRow, card: FirstOfCard): JNode => {
    if (card.shot) {
      // Fork: a stop that shoots by the camera or the timer; both rows carry the stop's time.
      const limit = card.rows.find((r) => "afterMs" in r);
      const seconds = limit ? clockSeconds(limit) : "0";
      const condition =
        "when" in row
          ? `kit.shotWhen(${row.when.map(javaString).join(", ")}, ${seconds})`
          : `kit.shotLimit(${seconds})`;
      if (row.cards.length === 0) return condition;
      return {
        head: `${condition}.then`,
        args: [],
        children: listNodes(row.cards, rowLabel(row)),
      };
    }
    // The partner wait's time limit is the one the drive team may move in init
    // (biobuzz AutoKit.partnerWaitMs); the card's own time stays in the Java as the default.
    const condition =
      "when" in row
        ? `kit.when(${row.when.map(javaString).join(", ")})`
        : !row.matchClock
          ? card.partnerWait
            ? `kit.afterMs(kit.partnerWaitMs(${javaNumber(row.afterMs)}))`
            : `kit.afterMs(${javaNumber(row.afterMs)})`
          : row.adjustable
            ? `kit.atMatchSeconds(kit.seconds(${javaString(firstOfLabel(card))}, ${javaNumber(row.afterMs / 1000)}))`
            : `kit.atMatchSeconds(${clockSeconds(row)})`;
    if (row.cards.length === 0) return condition;
    return {
      head: `${condition}.then`,
      args: [],
      children: listNodes(row.cards, rowLabel(row)),
    };
  };

  const used = usedNames(auto);

  // Fork: what the drive team may change in INIT (biobuzz AutoOption), the drawing's first.
  const options: string[] = [];
  if (parkVar)
    options.push(
      `AutoOption.park(${[drawnPark!, ...parkChoices].map(javaString).join(", ")})`,
    );
  for (const card of cards) {
    if (card.kind !== "firstOf") continue;
    for (const row of card.rows)
      if ("afterMs" in row && row.matchClock && row.adjustable)
        options.push(
          `AutoOption.matchSeconds(${javaString(firstOfLabel(card))}, ${javaNumber(row.afterMs / 1000)})`,
        );
  }
  // Fork: a paired Auto's menu: its route choices, the shot trigger, its times in the order the
  // Auto reaches them, and what it assumes of the partner.
  const menu = new Set<string>();
  const firstOfs = cards.filter((c): c is FirstOfCard => c.kind === "firstOf");
  for (const card of firstOfs) {
    if (!card.choice || menu.has(`choice ${card.choice}`)) continue;
    menu.add(`choice ${card.choice}`);
    options.push(
      `AutoOption.choice(${[card.choice, ...legsOf(card).map((leg) => rowLabel(leg))].map(javaString).join(", ")})`,
    );
  }
  if (firstOfs.some((card) => card.shot)) options.push("AutoOption.shotTrigger()");
  for (const card of firstOfs) {
    for (const row of card.rows) {
      if (!("afterMs" in row) || !row.matchClock || !row.option) continue;
      if (menu.has(`time ${row.option}`)) continue;
      menu.add(`time ${row.option}`);
      options.push(
        `AutoOption.time(${javaString(row.option)}, ${javaNumber(row.afterMs / 1000)})`,
      );
    }
  }
  if (auto.partner)
    options.push(
      auto.partner.follows
        ? `AutoOption.partner(${[auto.partner.auto, auto.partner.follows, ...(auto.partner.settings ?? [])].map(javaString).join(", ")})`
        : `AutoOption.partner(${javaString(auto.partner.auto)}, null)`,
    );
  const sortedList = (values: Iterable<string>) =>
    `{${[...new Set(values)].sort().map(javaString).join(", ")}}`;

  // --- assemble -------------------------------------------------------------
  const out: string[] = [];
  out.push(`package ${AUTO_PACKAGE};`, "");
  out.push(
    "import com.pedropathing.api.Paths;",
    "import com.pedropathing.api.PoseFactory;",
    "import com.pedropathing.ivy.Command;",
    "import com.pedropathing.math.Pose;",
    "import com.pedropathing.paths.Path;",
  );
  if (usesInterpolator)
    out.push("import com.pedropathing.paths.interpolator.Interpolator;");
  if (tailDecls.length > 0) out.push("", "import java.util.function.Supplier;");
  out.push(
    "",
    "import org.firstinspires.ftc.teamcode.autokit.AutoKit;",
    "import org.firstinspires.ftc.teamcode.autokit.AutoOption;",
    "",
  );
  out.push(
    "/**",
    ` * Generated by the Auto Builder from ${javadocSafe(sourceFileName)}. Do not edit: change the .pp and export again.`,
    " */",
    `public final class ${className} {`,
    "",
    `    private ${className}() {}`,
    "",
    "    /** The .pp file this was generated from. */",
    `    public static final String SOURCE = ${javaString(sourceFileName)};`,
    "",
    "    /** When the .pp was saved, Michigan time (empty if unknown); the OpMode's name on the Driver Station ends with it. */",
    `    public static final String SAVED = ${javaString(savedStamp(input.savedAt))};`,
    "",
    "    /** Registered robot commands this Auto uses; checked when the OpMode initialises. */",
    `    public static final String[] COMMANDS = ${sortedList(used.actions.keys())};`,
    "",
    "    /** Registered robot triggers this Auto uses; checked when the OpMode initialises. */",
    `    public static final String[] TRIGGERS = ${sortedList(used.conditions.keys())};`,
    "",
    '    /** The alliance the Auto was drawn for ("RED" or "BLUE"); the other alliance runs it rotated half a turn about the field centre. */',
    `    public static final String DRAWN_FOR = ${javaString(auto.drawnFor)};`,
    "",
    "    /** What the drive team may change during INIT, on gamepad 1's D-pad; nothing changed, the Auto runs as drawn. */",
    `    public static final AutoOption[] OPTIONS = {${options.join(", ")}};`,
    "",
    "    /** Where the robot starts, for the given alliance. */",
    "    public static Pose startPose(boolean rotated) {",
    `        return poses(rotated).of(${javaNumber(startPoint.x)}, ${javaNumber(startPoint.y)}, ${javaNumber(startPoint.headingDeg)});`,
    "    }",
    "",
    "    private static PoseFactory poses(boolean rotated) {",
    `        return rotated ? PoseFactory.degrees().mirrorAroundPoint(${javaNumber(FIELD_SIZE / 2)}, ${javaNumber(FIELD_SIZE / 2)}) : PoseFactory.degrees();`,
    "    }",
    "",
    "    /** Builds the whole Auto. Call once, at init; schedule the result at start. */",
    "    public static Command build(AutoKit kit, boolean rotated) {",
    "        PoseFactory p = poses(rotated);",
  );

  if (pointDecls.length > 0) {
    out.push(
      "",
      "        // Named points (x, y in inches, heading in degrees, Pedro field frame).",
    );
    pointDecls.forEach(({ varName, point }) =>
      out.push(
        `        Pose ${varName} = ${pose(point[0], point[1], point[2] ?? 0)};`,
      ),
    );
  }
  if (parkVar) {
    out.push(
      "",
      `        // The park the drive team picked in INIT (OPTIONS); ${javadocSafe(drawnPark!)} as drawn.`,
      `        Pose ${parkVar} = kit.pick(AutoOption.PARK, ${[drawnPark!, ...parkChoices].map((name) => pointVars.get(name)!).join(", ")});`,
    );
  }
  if (poseDecls.length > 0) {
    out.push(
      "",
      "        // Other poses the paths need (control points, unnamed endpoints).",
    );
    poseDecls.forEach((decl) =>
      out.push(
        `        Pose ${decl.varName} = ${pose(decl.x, decl.y, decl.headingDeg)};`,
      ),
    );
  }
  if (pathDecls.length > 0) {
    out.push(
      "",
      "        // Paths, written as the stock Visualizer export writes them.",
    );
    out.push(...pathDecls);
  }
  if (tailDecls.length > 0) {
    out.push(
      "",
      "        // Steps two routes share: a rejoin runs them from the stop it joins at.",
    );
    for (const decl of tailDecls) {
      const tail = rejoinTail(auto.cards, decl.targetId)!;
      const location = locateCard(auto.cards, decl.targetId)!;
      const body: JNode = {
        head: "kit.sequence",
        args: [],
        children: listNodes(
          tail.list.slice(tail.index),
          listLabel(location.parent),
        ),
      };
      out.push(
        `        Supplier<Command> ${decl.varName} = () -> ${printNode(body, 8)};`,
      );
    }
  }
  const top: JNode = {
    head: "kit.sequence",
    args: [],
    children: listNodes(auto.cards, "Auto"),
  };
  out.push("", `        return ${printNode(top, 8)};`, "    }", "}", "");

  return {
    ok: true,
    className,
    fileName: `${className}.java`,
    source: out.join("\n"),
    warnings,
  };
}

export function firstOfLabel(card: FirstOfCard): string {
  if (card.label && card.label.trim()) return card.label.trim();
  if (isPlainWait(card)) {
    const when = card.rows.find((row) => "when" in row) as
      { when: string[] } | undefined;
    return when ? `Wait for ${when.when.join(" or ")}` : "Wait";
  }
  return "Decision";
}

/** A Java double literal, so a list of them never mixes `1` with `2.2`. */
function javaDouble(value: number): string {
  const text = javaNumber(value);
  return /[.eE]/.test(text) ? text : `${text}.0`;
}

/** The pose variable a path expression ends on: its last segment's end. */
function lastEndVar(expr: PathExpr): string {
  return expr.kind === "group"
    ? lastEndVar(expr.children[expr.children.length - 1])
    : expr.endPoseVar;
}

/**
 * `LEFT_FLOWER` → `Left Flower`, `to LEFT_FLOWER` → `to Left Flower`: all-capital words become
 * capitalised, so a spot named the field's way reads as a Java name (`leftFlower`, not
 * `lEFTFLOWER`). Other names are left as they are.
 */
function lowerShouting(text: string): string {
  return text
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word, i) =>
      /^[A-Z0-9]{2,}$/.test(word) && /[A-Z]/.test(word)
        ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        : i === 0
          ? word
          : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join("");
}

/** `LEFT_FLOWER` or `to left flower` → `LeftFlower`. */
function pascal(text: string): string {
  const words = text.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const name = words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
  return /^[A-Za-z]/.test(name) ? name : `Stop${name}`;
}

// Java reads \u escapes even inside comments, so keep backslashes out of them.
function javadocSafe(text: string): string {
  return commentSafe(text).replace(/\*\//g, "* /");
}

function commentSafe(text: string): string {
  return text.replace(/[\r\n]+/g, " ").replace(/\\/g, "/");
}
