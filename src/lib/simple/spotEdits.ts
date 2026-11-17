/**
 * Fork: edits to a step's spot that both the builder's cards and the Step panel make: linking a
 * team spot in, the PARK spots the drive team may pick in INIT, making a spot a team spot, and
 * turning a launch spot to face its CELL. Each returns the next document; a team spot's change
 * is also recorded for Save team spots (spotsStore.editSpot).
 */
import { get } from "svelte/store";
import type { ProjectDoc } from "../../io/project";
import { linkSpot } from "../team/teamSpots";
import { editSpot, teamSpots } from "../team/spotsStore";
import { setParkChoice, setSpotHeading } from "./steps";

/** The document with the team spot `name` linked in, if it is one and is not yet. */
export function withTeamSpot(doc: ProjectDoc, name: string): ProjectDoc {
  const pose = get(teamSpots)[name];
  return pose && !doc.auto?.points[name] ? linkSpot(doc, name, pose) : doc;
}

/**
 * The other PARK spots the drive team could pick in INIT instead of `spot`: the team's _PARK
 * spots, and any this Auto already has (types.ts parkChoices).
 */
export function parkOffers(doc: ProjectDoc, spot: string | null): string[] {
  const names = new Set<string>([
    ...Object.keys(get(teamSpots)),
    ...Object.keys(doc.auto?.points ?? {}),
  ]);
  return [...names]
    .filter(
      (name) => (name === "PARK" || name.endsWith("_PARK")) && name !== spot,
    )
    .sort();
}

export function toggleParkChoice(
  doc: ProjectDoc,
  name: string,
  on: boolean,
): ProjectDoc {
  return setParkChoice(on ? withTeamSpot(doc, name) : doc, name, on);
}

/** One of this Auto's own spots becomes a team spot (saved with Save team spots). */
export function makeTeamSpot(doc: ProjectDoc, name: string): ProjectDoc {
  const pose = doc.auto?.points[name];
  if (!pose) return doc;
  if (
    get(teamSpots)[name] &&
    !confirm(
      `The team already has a spot ${name}. Move it to where this Auto has it?`,
    )
  )
    return doc;
  editSpot(name, pose);
  return linkSpot(doc, name, pose);
}

/**
 * Turns the spot a launch is made from to face our CELL (aim.ts). A team spot changes for every
 * Auto that uses it, once saved.
 */
export function faceCell(
  doc: ProjectDoc,
  spot: string,
  needDeg: number,
): ProjectDoc {
  const point = doc.auto?.points[spot];
  if (!point) return doc;
  const h = ((Math.round(needDeg) % 360) + 360) % 360;
  if (doc.auto?.teamSpots?.includes(spot))
    editSpot(spot, [point[0], point[1], h]);
  return setSpotHeading(doc, spot, h);
}
