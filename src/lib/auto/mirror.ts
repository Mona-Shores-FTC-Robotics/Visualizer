import type { AutoSection, NamedPoint } from "./types";

/**
 * An Auto mirrored for the other alliance, with the paths (model/mirror.ts):
 * its named points reflect the same way, so the pins still hold, and it is
 * drawn for the other alliance.
 */
export function mirrorAuto(
  auto: AutoSection,
  mirrorX: (x: number) => number,
  mirrorAngle: (degrees: number) => number,
): AutoSection {
  const points: Record<string, NamedPoint> = {};
  for (const [name, [x, y, heading]] of Object.entries(auto.points)) {
    points[name] =
      heading === undefined
        ? [mirrorX(x), y]
        : [mirrorX(x), y, mirrorAngle(heading)];
  }
  return {
    ...auto,
    points,
    drawnFor: auto.drawnFor === "RED" ? "BLUE" : "RED",
  };
}
