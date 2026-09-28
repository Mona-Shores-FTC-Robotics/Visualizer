import type { Path, Settings, Shape, StartPose } from "../../../types";
import { FIELD_SIZE } from "../../../config";
import { buildExportModel } from "../model";
import { pathExpression } from "../emit";
import { javaSpec } from "../languages/java";
import { camelCase, isReservedWord, sanitizeIdentifier } from "../identifiers";
import type { HeadingCall, InterpolatorRef, PathExpr, PoseDecl } from "../types";
import { buildPathCatalog, type PathCatalog } from "../../auto/geometry";
import { validateAuto } from "../../auto/validate";
import {
  allCards,
  isPlainWait,
  parkCardOf,
  rowLabel,
  usedNames,
} from "../../auto/tree";
import {
  rowKind,
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
  private readonly used = new Set<string>(["p", "kit", "mirrored"]);

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
  const { auto, startPoint, lines, shapes, settings } = input;
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
  const pointVars = new Map<string, string>();
  const pointDecls: { varName: string; point: NamedPoint }[] = [];
  for (const [name, point] of Object.entries(auto.points)) {
    const varName = names.take(camelCase(sanitizeIdentifier(name, "point")));
    pointVars.set(name, varName);
    pointDecls.push({ varName, point });
  }

  // The paths the cards drive, in list order.
  const cards = allCards(auto.cards);
  const referenced = new Set<number>();
  for (const card of cards) {
    if (card.kind !== "path") continue;
    const info = catalog.byId.get(card.lineId);
    if (info) referenced.add(info.index);
  }
  const usedIndices = [...referenced].sort((a, b) => a - b);

  const usedVars = new Set<string>();
  const headingVars = new Set<string>();
  usedIndices.forEach((index) =>
    collectVars(model.paths[index].expression, usedVars, headingVars),
  );

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
    const varName = names.take(pose.varName);
    poseRename.set(pose.varName, varName);
    poseDecls.push({ ...pose, varName });
  }
  const renamePose = (name: string) => poseRename.get(name) ?? name;

  const pathVars = new Map<number, string>();
  const pathDecls: string[] = [];
  let usesInterpolator = false;
  for (const index of usedIndices) {
    const info = catalog.paths.find((path) => path.index === index)!;
    const base = camelCase(sanitizeIdentifier(info.name, "path"));
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

  const pose = (x: number, y: number, h: number) =>
    `p.of(${javaNumber(x)}, ${javaNumber(y)}, ${javaNumber(h)})`;

  const stringArray = (values: string[]) =>
    `new String[] {${values.map(javaString).join(", ")}}`;

  const cardNode = (card: AutoCard): JNode => {
    switch (card.kind) {
      case "action":
        return `kit.action(${javaString(card.name)})`;
      case "path": {
        const { info, varName } = pathOf(card.lineId);
        const args = [javaString(info.name), varName];
        if (card.while.length > 0 || card.events.length > 0) {
          args.push(stringArray(card.while));
          [...card.events]
            .sort((a, b) => a.at - b.at)
            .forEach((event) =>
              args.push(`AutoKit.at(${javaNumber(event.at)}, ${javaString(event.action)})`),
            );
        }
        return `kit.path(${args.join(", ")})`;
      }
      case "firstOf":
        return {
          head: "kit.firstOf",
          args: [javaString(firstOfLabel(card))],
          children: card.rows.map(rowNode),
        };
    }
  };

  const listNodes = (list: AutoCard[], label: string): JNode[] => {
    const nodes = list.map(cardNode);
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
    let condition: string;
    switch (rowKind(row)) {
      case "when":
        condition = `kit.when(${(row as { when: string[] }).when.map(javaString).join(", ")})`;
        break;
      case "afterMs":
        condition = `kit.afterMs(${javaNumber((row as { afterMs: number }).afterMs)})`;
        break;
      case "timeLeftBelowS":
        condition = `kit.timeLeftBelow(${javaNumber((row as { timeLeftBelowS: number }).timeLeftBelowS)})`;
        break;
      case "otherwise":
        condition = "kit.otherwise()";
        break;
      case "nearPoint": {
        const near = row as { nearPoint: string; radiusIn: number };
        condition = `kit.nearPoint(${pointVars.get(near.nearPoint)}, ${javaNumber(near.radiusIn)})`;
        break;
      }
      case "inArea": {
        const [a, b] = (row as { inArea: [string, string] }).inArea;
        condition = `kit.inArea(${pointVars.get(a)}, ${pointVars.get(b)})`;
        break;
      }
    }
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
    "    /** Registered robot actions this Auto uses; checked when the OpMode initialises. */",
    `    public static final String[] ACTIONS = ${sortedList(used.actions.keys())};`,
    "",
    "    /** Registered robot conditions this Auto uses; checked when the OpMode initialises. */",
    `    public static final String[] CONDITIONS = ${sortedList(used.conditions.keys())};`,
    "",
    '    /** The alliance the Auto was drawn for ("RED" or "BLUE"); the other alliance runs it mirrored. */',
    `    public static final String DRAWN_FOR = ${javaString(auto.drawnFor)};`,
    "",
    "    /** Where the robot starts, for the given alliance. */",
    "    public static Pose startPose(boolean mirrored) {",
    `        return poses(mirrored).of(${javaNumber(startPoint.x)}, ${javaNumber(startPoint.y)}, ${javaNumber(startPoint.headingDeg)});`,
    "    }",
    "",
    "    private static PoseFactory poses(boolean mirrored) {",
    `        return mirrored ? PoseFactory.degrees().mirrorX(${javaNumber(FIELD_SIZE / 2)}) : PoseFactory.degrees();`,
    "    }",
    "",
    "    /** Builds the whole Auto. Call once, at init; schedule the result at start. */",
    "    public static Command build(AutoKit kit, boolean mirrored) {",
    "        PoseFactory p = poses(mirrored);",
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
  const zones = shapes.filter((shape) => (shape.vertices?.length ?? 0) >= 3);
  if (zones.length > 0) {
    out.push("", "        // Keep-out zones (from the .pp `shapes`), corners in order.");
    zones.forEach((shape) =>
      out.push(
        `        kit.keepOut(${shape.vertices.map((v) => pose(v.x, v.y, 0)).join(", ")});${shape.name ? ` // ${commentSafe(shape.name)}` : ""}`,
      ),
    );
  }
  if (pathDecls.length > 0) {
    out.push("", "        // Paths, written as the stock Visualizer export writes them.");
    out.push(...pathDecls);
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

// Java reads \u escapes even inside comments, so keep backslashes out of them.
function javadocSafe(text: string): string {
  return commentSafe(text).replace(/\*\//g, "* /");
}

function commentSafe(text: string): string {
  return text.replace(/[\r\n]+/g, " ").replace(/\\/g, "/");
}
