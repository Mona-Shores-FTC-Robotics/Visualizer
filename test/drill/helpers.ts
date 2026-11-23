import RAPIER from "@dimforge/rapier3d-compat";
import type { ControlsFile, PadRead } from "../../src/drill/controls";
import controlsJson from "../fixtures/biobuzz/controls.json";

export const CONTROLS = controlsJson as unknown as ControlsFile;

let ready: Promise<typeof RAPIER> | null = null;
/** Rapier, initialised once. */
export function rapier(): Promise<typeof RAPIER> {
  ready ??= RAPIER.init().then(() => RAPIER);
  return ready;
}

/** A pad holding these inputs (the robot's Input names), with these sticks. */
export function pad(
  held: string[] = [],
  sticks: Partial<Pick<PadRead, "lx" | "ly" | "rx">> = {},
): PadRead {
  const set = new Set(held);
  return { lx: 0, ly: 0, rx: 0, ...sticks, held: (i) => set.has(i) };
}
