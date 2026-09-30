import type { BasePoint, Path, Settings, StartPose } from "../../types";
import { buildPathCatalog } from "./geometry";
import { atomicPaths } from "./pins";
import type { AutoCard, AutoSection } from "./types";

/**
 * Link paths: how a path starts where the robot is, in a file whose paths chain.
 *
 * In a `.pp` file each path starts where the one above it in the Path List ends. An Auto that
 * branches needs a path to start at the wait it branches from, which is rarely the end of the path
 * above. So the editor lays the paths out in the order the Auto drives them, and wherever a path
 * must start somewhere else it puts a straight **link path** in front of it: never driven, only
 * there to move the chain. Links are listed in `auto.linkPaths`, rebuilt after every edit and
 * hidden in the editor; the current editor and the stock Visualizer read the file as usual and
 * draw every path where it really starts.
 */

/** The display name of a link path. */
export const LINK_NAME = "Link (never driven)";

const CLOSE_IN = 1e-3;
const same = (a: BasePoint, b: BasePoint) => Math.hypot(a.x - b.x, a.y - b.y) < CLOSE_IN;

export interface RelinkResult {
  lines: Path[];
  linkIds: string[];
  /** False when the lines and links are already laid out this way. */
  changed: boolean;
}

/** Where a top-level path ends: its end point, or its last segment's for a group. */
function endOf(line: Path): BasePoint {
  if (line.kind === "atomic") return line.endPoint;
  const last = line.segments[line.segments.length - 1];
  return last ? endOf(last) : { x: 0, y: 0 };
}

/**
 * An older hand-made link: a path no card drives, named as one. Kept for files made before the
 * editor managed links, so they do not pile up next to the new ones.
 */
function isLegacyLink(line: Path): boolean {
  return /never driven/i.test(line.name ?? "");
}

/**
 * The lines laid out so every path a card drives starts where the robot is when the card starts:
 * the start pose for the first, else where the path before it in the Auto ended. Routes are laid
 * out depth first (each wait's ✓ route, then its timed-out route). A path the Auto drives twice can
 * only start in one place; the first use wins and validation warns about the other.
 * Paths no card drives keep their shape and come last.
 */
export function relink(
  startPoint: StartPose,
  lines: Path[],
  auto: AutoSection,
  settings: Settings,
): RelinkResult {
  const oldLinks = new Set(auto.linkPaths ?? []);
  const byId = new Map(lines.map((line) => [line.id, line]));
  const catalog = buildPathCatalog(startPoint, lines, settings);
  const endHeading = new Map(catalog.paths.map((path) => [path.id, path.endHeadingDeg]));

  const out: Path[] = [];
  const linkIds: string[] = [];
  let cursor: BasePoint = { x: startPoint.x, y: startPoint.y };
  const placed = new Set<string>();

  const link = (to: BasePoint, headingDeg: number) => {
    const id = `link-${linkIds.length + 1}`;
    out.push({
      id,
      name: LINK_NAME,
      color: "#6b7280",
      kind: "atomic",
      endPoint: { x: to.x, y: to.y },
      controlPoints: [],
      heading: { type: "constant", degrees: headingDeg },
    } as Path);
    linkIds.push(id);
    cursor = { x: to.x, y: to.y };
  };

  const place = (line: Path, from: BasePoint, headingDeg: number) => {
    if (!same(cursor, from)) link(from, headingDeg);
    out.push(line);
    placed.add(line.id);
    cursor = { ...endOf(line) };
  };

  type Where = { at: BasePoint; headingDeg: number };
  const visit = (list: AutoCard[], where: Where): Where => {
    let here = where;
    for (const card of list) {
      if (card.kind === "path") {
        const line = byId.get(card.lineId);
        if (!line || oldLinks.has(line.id)) continue;
        if (!placed.has(line.id)) place(line, here.at, here.headingDeg);
        here = { at: { ...endOf(line) }, headingDeg: endHeading.get(line.id) ?? here.headingDeg };
      } else if (card.kind === "rejoin") {
        const line = byId.get(card.lineId);
        if (!line || oldLinks.has(line.id)) continue;
        if (!placed.has(line.id)) place(line, here.at, here.headingDeg);
        here = { at: { ...endOf(line) }, headingDeg: endHeading.get(line.id) ?? here.headingDeg };
      } else if (card.kind === "firstOf") {
        const ends = card.rows.map((row) => visit(row.cards, here));
        // With no cards on any row the robot has not moved; otherwise the rest of the list runs
        // after whichever route was taken, and the first is as good a guess as any.
        const moved = card.rows.findIndex((row) => row.cards.length > 0);
        if (moved >= 0) here = ends[moved];
      }
    }
    return here;
  };
  visit(auto.cards, { at: { x: startPoint.x, y: startPoint.y }, headingDeg: startPoint.headingDeg });

  // Paths no card drives keep their drawing: each starts where it started before.
  const oldStarts = new Map(catalog.paths.map((path) => [path.id, path.start]));
  for (const line of lines) {
    if (placed.has(line.id) || oldLinks.has(line.id) || isLegacyLink(line)) continue;
    const start = oldStarts.get(line.id) ?? cursor;
    place(line, start, endHeading.get(line.id) ?? 0);
  }

  const changed =
    JSON.stringify(out) !== JSON.stringify(lines) ||
    linkIds.length !== oldLinks.size ||
    linkIds.some((id) => !oldLinks.has(id));
  return { lines: changed ? out : lines, linkIds, changed };
}

/** Whether `id` is a link path (hidden in the editor, never driven). */
export function isLinkPath(auto: AutoSection | null, id: string): boolean {
  return !!auto?.linkPaths?.includes(id);
}

/** Segment ids of the link paths, for code that works on atomic segments. */
export function linkSegmentIds(auto: AutoSection, lines: Path[]): Set<string> {
  const ids = new Set<string>();
  const segments = atomicPaths(lines.filter((line) => isLinkPath(auto, line.id)));
  segments.forEach((_, id) => ids.add(id));
  return ids;
}
