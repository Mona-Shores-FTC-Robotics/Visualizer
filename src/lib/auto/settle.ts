/**
 * Fork: what the editor does to a document after every edit, as a plain function: ladders
 * compiled, pins holding, link paths laid out. The Auto store runs it on the open file; saving
 * team spots runs it on every Auto that uses one (lib/team/teamSpots.ts), with no editor open.
 */
import type { ProjectDoc } from "../../io";
import type { Settings } from "../../types";
import { atomicSegments } from "../../utils/pathTraversal";
import { compileLadders } from "../ladder/compile";
import { relink } from "./links";
import {
  atomicPaths,
  moveEnd,
  pinState,
  resolvePins,
  type PinState,
} from "./pins";

/**
 * `pinned` is the pins as they last held (null for a file just opened: its points win). Locked
 * points never follow a dragged end; the end goes back to the point.
 */
export function settleDoc(
  doc: ProjectDoc,
  settings: Settings,
  pinned: PinState | null,
  locked?: ReadonlySet<string>,
): { doc: ProjectDoc; pinned: PinState } {
  let auto = doc.auto!;
  let { startPoint, lines } = doc;

  // Ladders first: they write cards, paths and pins of their own (lib/ladder).
  const built = compileLadders(auto, lines);
  if (built.changed) {
    auto = built.auto;
    lines = built.lines;
  }

  const segments = atomicPaths(lines);
  const stale = Object.keys(auto.pathEnds).filter((id) => !segments.has(id));
  if (stale.length) {
    const pathEnds = { ...auto.pathEnds };
    stale.forEach((id) => delete pathEnds[id]);
    auto = { ...auto, pathEnds };
  }

  const { points, moves } = resolvePins(
    auto,
    startPoint,
    lines,
    pinned,
    locked,
  );
  for (const move of moves) {
    if (move.segmentId === null) {
      startPoint = { ...startPoint, x: move.x, y: move.y };
    } else {
      lines = moveEnd(lines, move.segmentId, move.x, move.y);
    }
  }
  if (points) auto = { ...auto, points };
  const next: PinState = { ...pinState(auto), points: auto.points };

  let sequence = doc.sequence;
  const result = relink(startPoint, lines, auto, settings);
  if (result.changed) {
    lines = result.lines;
    auto = { ...auto };
    if (result.linkIds.length) auto.linkPaths = result.linkIds;
    else delete auto.linkPaths;
  }
  if (result.changed || built.changed) {
    sequence = atomicSegments(lines).map((line) => ({
      kind: "path" as const,
      lineId: line.id,
    }));
  }

  if (auto === doc.auto && startPoint === doc.startPoint && lines === doc.lines)
    return { doc, pinned: next };
  return { doc: { ...doc, auto, startPoint, lines, sequence }, pinned: next };
}
