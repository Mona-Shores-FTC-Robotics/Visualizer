/**
 * The BIOBUZZ plays: the tries a ladder can pick from when a tip doesn't come. Game-specific on
 * purpose (see docs/auto-format.md, "Ladders"): next season this file is rewritten, the ladder
 * engine stays.
 *
 * Every point is the field CAD's, as the team's Autos have them (biobuzz `TeamCode/autos/*.pp`),
 * drawn for RED; the robot turns them for BLUE. Times are the Autos' own limits for the same
 * steps.
 */
import type { NamedPoint, Play, Source } from "../auto/types";

const P: Record<string, NamedPoint> = {
  FAR_FLOWER_TURN: [47.36, 118.34, 90],
  FAR_FLOWER: [47.36, 126.64, 90],
  N_FIRE: [57.5, 119, 270],
  WALL_FLOWER_TURN: [23.16, 47.36, 180],
  WALL_FLOWER: [14.86, 47.36, 180],
  FIRE3: [45, 26, 90],
  GARDEN_IN: [9.5, 20.56, 270],
  GARDEN: [9.5, 10.96, 270],
  FIRE_G: [45, 29, 90],
  S_FIRE: [55, 24, 270],
};

const pick = (...names: string[]) =>
  Object.fromEntries(names.map((name) => [name, P[name]])) as Record<
    string,
    NamedPoint
  >;

/** How a source reads in a sentence. */
export const SOURCE_NAMES: Record<Source, string> = {
  FAR_FLOWER: "the far FLOWER",
  WALL_FLOWER: "the wall FLOWER",
  GARDEN: "the GARDEN",
};

export const SOURCES = Object.keys(SOURCE_NAMES) as Source[];

export const BIOBUZZ_PLAYS: Play[] = [
  {
    id: "wall-flower",
    name: "Refill at the wall FLOWER, shoot from FIRE3",
    source: "WALL_FLOWER",
    points: pick("WALL_FLOWER_TURN", "WALL_FLOWER", "FIRE3"),
    steps: [
      { kind: "drive", to: "WALL_FLOWER_TURN" },
      { kind: "drive", to: "WALL_FLOWER" },
      { kind: "collect", upToS: 3 },
      { kind: "drive", to: "FIRE3" },
      { kind: "shoot", upToS: 2.5 },
    ],
  },
  {
    id: "garden",
    name: "Refill in the GARDEN, shoot from FIRE_G",
    source: "GARDEN",
    points: pick("GARDEN_IN", "GARDEN", "FIRE_G"),
    steps: [
      { kind: "drive", to: "GARDEN_IN" },
      { kind: "drive", to: "GARDEN" },
      { kind: "collect", upToS: 1.5 },
      { kind: "drive", to: "FIRE_G" },
      { kind: "shoot", upToS: 2.5 },
    ],
  },
  {
    id: "far-flower",
    name: "Refill at the far FLOWER, shoot from N_FIRE",
    source: "FAR_FLOWER",
    points: pick("FAR_FLOWER_TURN", "FAR_FLOWER", "N_FIRE"),
    steps: [
      { kind: "drive", to: "FAR_FLOWER_TURN" },
      { kind: "drive", to: "FAR_FLOWER" },
      { kind: "collect", upToS: 3 },
      { kind: "drive", to: "N_FIRE" },
      { kind: "shoot", upToS: 2.5 },
    ],
  },
  {
    id: "shoot-held",
    name: "Shoot what we hold from S_FIRE",
    points: pick("S_FIRE"),
    steps: [
      { kind: "drive", to: "S_FIRE" },
      { kind: "shoot", upToS: 3 },
    ],
  },
];
