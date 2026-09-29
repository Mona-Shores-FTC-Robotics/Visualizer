import type { Path, SequenceItem, Settings, Shape, StartPose } from "../types";
import type { FieldPoint } from "./fieldPoints";
import type { AutoSection } from "../lib/auto/types";
import { serializeAuto } from "../lib/auto/normalize";

export const PROJECT_VERSION = "1.5.0";

/**
 * A warning when the document came from a newer build, else null. Fields added
 * after this build are dropped silently, so the file may not mean what it says.
 */
export function newerVersionWarning(version: unknown): string | null {
  if (typeof version !== "string") return null;

  const parse = (value: string) =>
    value.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const stored = parse(version);
  const current = parse(PROJECT_VERSION);

  for (
    let index = 0;
    index < Math.max(stored.length, current.length);
    index++
  ) {
    const left = stored[index] ?? 0;
    const right = current[index] ?? 0;
    if (left > right) {
      return `This file was saved by a newer version of the visualizer (${version}, this build writes ${PROJECT_VERSION}). Some settings may not load correctly.`;
    }
    if (left < right) return null;
  }

  return null;
}

export interface ProjectDoc {
  startPoint: StartPose;
  lines: Path[];
  shapes: Shape[];
  sequence: SequenceItem[];
  fieldPoints?: FieldPoint[];
  settings?: Settings;
  activePaths?: string[];
  /** The Auto builder's section; omitted from the file when there is none. */
  auto?: AutoSection | null;
}

export function buildProject(
  doc: ProjectDoc,
  overrides: Record<string, unknown> = {},
) {
  const { auto, ...rest } = doc;
  return {
    ...rest,
    ...(auto ? { auto: serializeAuto(auto) } : {}),
    version: PROJECT_VERSION,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

export function serializeProject(
  doc: ProjectDoc,
  options: { pretty?: boolean; overrides?: Record<string, unknown> } = {},
): string {
  const { pretty = false, overrides = {} } = options;
  return JSON.stringify(
    buildProject(doc, overrides),
    null,
    pretty ? 2 : undefined,
  );
}

/** What a file shown beside the main one (second or additional path) edits. */
export interface OtherFilePaths {
  /** Null keeps the start point the file has. */
  startPoint: StartPose | null;
  lines: Path[];
  shapes: Shape[];
  sequence: SequenceItem[];
  settings?: Settings;
}

/**
 * The document for saving a file shown beside the main one: the dual-path
 * second file or an additional path. Only what is edited on screen is
 * replaced; everything else the file already had (its own Auto, field points,
 * settings) is kept, and nothing of the main project is written into it.
 * `existingText` is the file as stored, or null when it cannot be read.
 */
export function buildOtherFileProject(
  existingText: string | null,
  paths: OtherFilePaths,
): Record<string, unknown> {
  let existing: Record<string, unknown> = {};
  if (existingText) {
    try {
      const parsed = JSON.parse(existingText);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        existing = parsed;
      }
    } catch {
      // Unreadable: write the paths alone rather than keep nothing at all.
    }
  }
  const { startPoint, settings, ...edited } = paths;
  return {
    ...existing,
    ...(startPoint ? { startPoint } : {}),
    ...edited,
    ...(settings ? { settings } : {}),
    version: PROJECT_VERSION,
    timestamp: new Date().toISOString(),
  };
}
