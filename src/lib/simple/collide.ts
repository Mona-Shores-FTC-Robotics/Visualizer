/**
 * Fork: what each drive of a simple Auto runs into. Every drive step's path, and the park from its
 * spot (parkFrom.ts), is driven through the field's collision check (model/collision.ts): the
 * robot's whole footprint, its FLOWER poker and its safety margin, against the field elements the
 * file draws (the HIVEs, the FLOWERs) and the walls. The builder puts the result on the step, so a
 * drive that clips the HIVE is seen while it is drawn rather than on the field. Only as good as
 * the drawn field elements: something under the HIVE that the file does not draw is not seen.
 */
import type { ProjectDoc } from "../../io/project";
import { findCollisions, type Collision } from "../../model/collision";
import type { PathCatalog } from "../auto/geometry";

/** Contact at a drive's start that ends sooner than this, seconds, is the spot's, not the drive's. */
const LEAVES_WITHIN_S = 0.75;

/** A drive step's collisions: its own drive's, and its spot's park's. */
export interface StepHits {
  drive: string[];
  park: string[];
}

/** Drive card id → what its drive, and the park from its spot, touch. Steps with none are left out. */
export function stepCollisions(
  doc: ProjectDoc,
  catalog: PathCatalog,
): Map<string, StepHits> {
  const out = new Map<string, StepHits>();
  const auto = doc.auto;
  if (!auto) return out;
  const cache = new Map<string, string[]>();
  const hitsOf = (lineId: string): string[] => {
    const known = cache.get(lineId);
    if (known) return known;
    const info = catalog.byId.get(lineId);
    // Contact already there where the drive begins, and left at once, is where the step before
    // left the robot (a start's back on the wall, a spot close by a FLOWER), not this drive's
    // doing; a spot truly inside something is the drive that went there's hit.
    const names = info
      ? [
          ...new Set(
            findCollisions(doc, info.travel)
              .filter((c) => c.start > 1e-3 || c.end > LEAVES_WITHIN_S)
              .map((c) => what(doc, c)),
          ),
        ]
      : [];
    cache.set(lineId, names);
    return names;
  };
  for (const card of auto.cards) {
    if (card.kind !== "path") continue;
    const drive = hitsOf(card.lineId);
    const parkId = auto.parkFrom?.[card.id];
    const park = parkId ? hitsOf(parkId) : [];
    if (drive.length || park.length) out.set(card.id, { drive, park });
  }
  return out;
}

/** "the Red HIVE", or "the wall". */
function what(doc: ProjectDoc, collision: Collision): string {
  if (collision.obstacle.kind === "wall") return "the wall";
  const { shapeId } = collision.obstacle;
  const shape = doc.shapes.find((s) => s.id === shapeId);
  return `the ${shape?.name ?? "field element"}`;
}
