import { get, writable } from "svelte/store";
import { FIELD_SIZE } from "../../config";
import { normalizeAuto } from "./normalize";
import type { AutoSection, NamedPoint } from "./types";

/**
 * The open project's `auto` section. A store rather than a prop so the many
 * places that load and save a project can carry it without threading it
 * through every upstream component. Null when the project has no Auto.
 */
export const autoSection = writable<AutoSection | null>(null);

/** Whether the left and right panels show the Auto instead of the paths. */
export const autoMode = writable(false);

/** The card whose editor the Controls panel shows. */
export const selectedCardId = writable<string | null>(null);

/**
 * Replace the Auto with the one in a freshly read file. Returns what the
 * loader had to repair, for the caller to show.
 */
export function loadAutoFrom(data: unknown): string[] {
  const raw =
    typeof data === "object" && data !== null
      ? (data as { auto?: unknown }).auto
      : undefined;
  const { auto, problems } = normalizeAuto(raw);
  autoSection.set(auto);
  selectedCardId.set(null);
  if (!auto) autoMode.set(false);
  return problems;
}

/** The current Auto, for the save paths that build a project document. */
export function currentAuto(): AutoSection | null {
  return get(autoSection);
}

/**
 * The Auto of a mirrored copy of the project: drawn for the other alliance,
 * its named points mirrored with the paths. Cards refer to paths by id and so
 * follow the mirrored paths on their own.
 */
export function mirrorAutoData(auto: unknown): unknown {
  const { auto: normalized } = normalizeAuto(auto);
  if (!normalized) return auto;
  normalized.drawnFor = normalized.drawnFor === "RED" ? "BLUE" : "RED";
  for (const [name, point] of Object.entries(normalized.points)) {
    const mirrored: NamedPoint =
      point.length === 3
        ? [FIELD_SIZE - point[0], point[1], 180 - point[2]]
        : [FIELD_SIZE - point[0], point[1]];
    normalized.points[name] = mirrored;
  }
  return normalized;
}
