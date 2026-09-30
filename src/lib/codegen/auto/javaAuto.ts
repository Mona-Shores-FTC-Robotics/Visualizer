import type { Path, Settings, Shape, StartPose } from "../../../types";
import { FIELD_SIZE } from "../../../config";
import { buildExportModel } from "../model";
import { pathExpression } from "../emit";
import { javaSpec } from "../languages/java";
import { camelCase, isReservedWord, sanitizeIdentifier } from "../identifiers";
import type { HeadingCall, InterpolatorRef, PathExpr, PoseDecl } from "../types";
import { buildPathCatalog, type PathCatalog } from "../../auto/geometry";
import { validateAuto } from "../../auto/validate";
import { relink } from "../../auto/links";
import {
  allCards,
  isPlainWait,
  listLabel,
  locateCard,
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

export const AUTO_PACKAGE = "org.firstinspires.ftc.teamcode.opmodes.auto.generated";

export interface AutoExportInput {
  auto: AutoSection;
  startPoint: StartPose;
  lines: Path[];
  shapes: Shape[];
  settings: Settings;
  /** The .pp file name, e.g. `hive-rush.pp`; recorded in SOURCE. */
  sourceFileName: string;
}

export type AutoExportResult =
  | { ok: true; className: string; fileName: string; source: string; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

/** `hive-rush` → `HiveRushAuto`. */
export function autoClassName(exportName: string): string {
  const stem = exportName.replace(/\.pp$/i, "");
  const words = stem.split(/[^A-Za-z0-9]+/).filter(Boolean);
  let name = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("");
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

/** Seconds reserved for the park path: the drive time, rounded up to 0.1 s. */
export function parkSeconds(seconds: number): number {
  return Math.ceil(Math.round(seconds * 1000) / 100) / 10;
}

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

function interpolatorVars(ref: InterpolatorRef): { vars: string[]; headingVars: string[] } {
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

function headingVarsOf(heading: HeadingCall | null): { vars: string[]; headingVars: string[] } {
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

function collectVars(expr: PathExpr, vars: Set<string>, headingVars: Set<string>): void {
  if (expr.kind === "group") {
    expr.children.forEach((child) => collectVars(child, vars, headingVars));
  } else {
    [expr.startPoseVar, ...expr.controlPoseVars, ...expr.throughPoseVars, expr.endPoseVar].forEach(
      (name) => vars.add(name),
    );
  }
  const found = headingVarsOf(expr.heading);
  found.vars.forEach((name) => vars.add(name));
  found.headingVars.forEach((name) => headingVars.add(name));
}

function usesPiecewise(expr: PathExpr): boolean {
  if (expr.heading?.kind === "piecewise") return true;
  return expr.kind === "group" && expr.children.some(usesPiecewise);
}

function renameInterpolator(ref: InterpolatorRef, map: (name: string) => string): InterpolatorRef {
  switch (ref.kind) {
    case "constant":
      return { kind: "constant", poseVar: map(ref.poseVar) };
    case "linear":
      return { kind: "linear", startPoseVar: map(ref.startPoseVar), endPoseVar: map(ref.endPoseVar) };
    case "facingPoint":
      return { kind: "facingPoint", poseVar: map(ref.poseVar) };
    case "tangent":
      return ref;
  }
}

function renameHeading(heading: HeadingCall | null, map: (name: string) => string): HeadingCall | null {
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

type JNode = string | { head: string; args: string[]; children: JNode[] };

function printNode(node: JNode, indent: number): string {
  if (typeof node === "string") return node;
  const pad = " ".repeat(indent + 8);
  let out = `${node.head}(${node.args.join(", ")}`;
  if (node.children.length > 0) {
    if (node.args.length > 0) out += ",";
    out += node.children
      .map((child, index) => `${index > 0 ? "," : ""}\n${pad}${printNode(child, indent + 8)}`)
      .join("");
  }
  return `${out})`;
}

const sameAngle = (a: number, b: number) =>
  Math.abs((((a - b) % 360) + 540) % 360 - 180) < 1e-6;

// --- the generator ------------------------------------------------------------

export function generateAutoJava(input: AutoExportInput): AutoExportResult {
  const { auto, startPoint, settings } = input;
  // Lay the paths out as the editor does, so a file straight from disk exports the same.
  const lines = relink(startPoint, input.lines, auto, settings).lines;
  const catalog: PathCatalog = buildPathCatalog(startPoint, lines, settings);
  const issues = validateAuto(auto, catalog, startPoint);
  const errors = issues.filter((issue) => issue.level === "error").map((issue) => issue.message);
  const warnings = issues.filter((issue) => issue.level === "warning").map((issue) => issue.message);
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
    const varName = names.take(camelCase(sanitizeIdentifier(lowerShouting(name), "point")));
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
  }
  const usedIndices = [...referenced].sort((a, b) => a - b);

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
        (!headingVars.has(pose.varName) || sameAngle(point[2] ?? 0, pose.headingDeg)),
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
    const base = camelCase(sanitizeIdentifier(lowerShouting(info.name), "path"));
    const varName = names.take(names.has(base) ? `${base}Path` : base);
    pathVars.set(index, varName);
    const decl = model.paths[index];
    const expression = renameExpr(decl.expression, renamePose);
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

  const cardNode = (card: AutoCard): JNode => {
    switch (card.kind) {
      case "action":
        return card.timeoutS
          ? `kit.command(${javaString(card.name)}, ${javaNumber(card.timeoutS)})`
          : `kit.command(${javaString(card.name)})`;
      case "path": {
        const { info, varName } = pathOf(card.lineId);
        return `kit.path(${javaString(info.name)}, ${varName})`;
      }
      case "firstOf":
        return {
          head: "kit.firstOf",
          args: card.alongside
            ? [javaString(firstOfLabel(card)), `kit.command(${javaString(card.alongside)})`]
            : [javaString(firstOfLabel(card))],
          children: card.rows.map(rowNode),
        };
      case "rejoin": {
        const { info, varName } = pathOf(card.lineId);
        return `kit.path(${javaString(info.name)}, ${varName})`;
      }
    }
  };

  // Rejoined tails: the steps after a stop that a rejoin joins at are one Supplier both routes
  // call, not a copy. Declared shortest first, since a longer tail may call a shorter one.
  const tailVars = new Map<string, string>();
  const tailDecls: { varName: string; targetId: string; size: number }[] = [];
  for (const card of cards) {
    if (card.kind !== "rejoin" || tailVars.has(card.target)) continue;
    const tail = rejoinTail(auto.cards, card.target);
    if (!tail) continue;
    const spot = auto.pathEnds[catalog.byId.get(tail.target.lineId)?.endSegmentId ?? ""];
    const base = `after${pascal(spot ?? catalog.byId.get(tail.target.lineId)?.name ?? "Stop")}`;
    const varName = names.take(base);
    tailVars.set(card.target, varName);
    tailDecls.push({ varName, targetId: card.target, size: allCards(tail.list.slice(tail.index)).length });
  }
  tailDecls.sort((a, b) => a.size - b.size);

  const listNodes = (list: AutoCard[], label: string): JNode[] => {
    const nodes: JNode[] = [];
    for (let i = 0; i < list.length; i++) {
      const card = list[i];
      if (card.kind === "path" && card.through) {
        // A drive-through chain: one Pedro path, so the robot does not stop between them.
        const chain = [card];
        while (chain[chain.length - 1].through && list[i + chain.length]?.kind === "path") {
          chain.push(list[i + chain.length] as typeof card);
        }
        if (chain.length > 1) {
          const parts = chain.map((c) => pathOf(c.lineId));
          nodes.push(
            `kit.path(${javaString(parts.map((p) => p.info.name).join(" → "))}, Paths.path(${parts.map((p) => p.varName).join(", ")}))`,
          );
          i += chain.length - 1;
          const last = chain[chain.length - 1];
          if (tailVars.has(last.id)) {
            nodes.push(`${tailVars.get(last.id)}.get()`);
            break;
          }
          continue;
        }
      }
      nodes.push(cardNode(card));
      if (card.kind === "rejoin" && tailVars.has(card.target)) nodes.push(`${tailVars.get(card.target)}.get()`);
      if (tailVars.has(card.id)) {
        nodes.push(`${tailVars.get(card.id)}.get()`);
        break;
      }
    }
    const park = parkCardOf(list);
    if (!park) return nodes;
    const { info, varName } = pathOf(park.lineId);
    return [
      {
        head: "kit.guarded",
        args: [javaString(label), varName, javaNumber(parkSeconds(info.seconds))],
        children: nodes,
      },
    ];
  };

  const rowNode = (row: AutoRow): JNode => {
    const condition =
      "when" in row
        ? `kit.when(${row.when.map(javaString).join(", ")})`
        : `kit.afterMs(${javaNumber(row.afterMs)})`;
    if (row.cards.length === 0) return condition;
    return { head: `${condition}.then`, args: [], children: listNodes(row.cards, rowLabel(row)) };
  };

  const used = usedNames(auto);
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
  if (usesInterpolator) out.push("import com.pedropathing.paths.interpolator.Interpolator;");
  if (tailDecls.length > 0) out.push("", "import java.util.function.Supplier;");
  out.push("", "import org.firstinspires.ftc.teamcode.autokit.AutoKit;", "");
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
    "    /** Registered robot commands this Auto uses; checked when the OpMode initialises. */",
    `    public static final String[] COMMANDS = ${sortedList(used.actions.keys())};`,
    "",
    "    /** Registered robot triggers this Auto uses; checked when the OpMode initialises. */",
    `    public static final String[] TRIGGERS = ${sortedList(used.conditions.keys())};`,
    "",
    '    /** The alliance the Auto was drawn for ("RED" or "BLUE"); the other alliance runs it rotated half a turn about the field centre. */',
    `    public static final String DRAWN_FOR = ${javaString(auto.drawnFor)};`,
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
    out.push("", "        // Named points (x, y in inches, heading in degrees, Pedro field frame).");
    pointDecls.forEach(({ varName, point }) =>
      out.push(`        Pose ${varName} = ${pose(point[0], point[1], point[2] ?? 0)};`),
    );
  }
  if (poseDecls.length > 0) {
    out.push("", "        // Other poses the paths need (control points, unnamed endpoints).");
    poseDecls.forEach((decl) =>
      out.push(`        Pose ${decl.varName} = ${pose(decl.x, decl.y, decl.headingDeg)};`),
    );
  }
  if (pathDecls.length > 0) {
    out.push("", "        // Paths, written as the stock Visualizer export writes them.");
    out.push(...pathDecls);
  }
  if (tailDecls.length > 0) {
    out.push("", "        // Steps two routes share: a rejoin runs them from the stop it joins at.");
    for (const decl of tailDecls) {
      const tail = rejoinTail(auto.cards, decl.targetId)!;
      const location = locateCard(auto.cards, decl.targetId)!;
      const body: JNode = {
        head: "kit.sequence",
        args: [],
        children: listNodes(tail.list.slice(tail.index), listLabel(location.parent)),
      };
      out.push(`        Supplier<Command> ${decl.varName} = () -> ${printNode(body, 8)};`);
    }
  }
  const top: JNode = {
    head: "kit.sequence",
    args: [],
    children: listNodes(auto.cards, "Auto"),
  };
  out.push("", `        return ${printNode(top, 8)};`, "    }", "}", "");

  return { ok: true, className, fileName: `${className}.java`, source: out.join("\n"), warnings };
}

export function firstOfLabel(card: FirstOfCard): string {
  if (card.label && card.label.trim()) return card.label.trim();
  if (isPlainWait(card)) {
    const when = card.rows.find((row) => "when" in row) as { when: string[] } | undefined;
    return when ? `Wait for ${when.when.join(" or ")}` : "Wait";
  }
  return "Decision";
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
  const name = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");
  return /^[A-Za-z]/.test(name) ? name : `Stop${name}`;
}

// Java reads \u escapes even inside comments, so keep backslashes out of them.
function javadocSafe(text: string): string {
  return commentSafe(text).replace(/\*\//g, "* /");
}

function commentSafe(text: string): string {
  return text.replace(/[\r\n]+/g, " ").replace(/\\/g, "/");
}
