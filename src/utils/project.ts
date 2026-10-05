import type { Path, SequenceItem, Settings, Shape, StartPose } from "../types";
import type { FieldPoint } from "./fieldPoints";
import type { AutoSection } from "../lib/auto/types";
import { serializeAuto } from "../lib/auto/normalize";
import { DEFAULT_SETTINGS } from "../config/defaults";

/**
 * The settings a file owns: robot size and the motion model. They time the
 * preview and the park guard's seconds in the exported Java, so an Auto must
 * carry its own. Everything else in Settings (panels, colours, images, the
 * field image) is the viewer's preference.
 */
export const FILE_SETTINGS_KEYS = [
  "xVelocity",
  "yVelocity",
  "aVelocity",
  "kFriction",
  "rWidth",
  "rHeight",
  "safetyMargin",
  "maxVelocity",
  "maxAcceleration",
  "maxDeceleration",
] as const;

/** The file-owned settings present in `settings`. */
export function fileSettings(
  settings: object | null | undefined,
): Partial<Settings> {
  const source = (settings ?? {}) as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const key of FILE_SETTINGS_KEYS) {
    if (typeof source[key] === "number" && Number.isFinite(source[key])) {
      picked[key] = source[key];
    }
  }
  return picked as Partial<Settings>;
}

/**
 * The settings in effect while a file is open: its own robot size and motion
 * model, the defaults for any it lacks (as the command-line export does), and
 * the viewer's own preferences for everything else. So the app and the
 * command line time the same file the same way, whoever opens it.
 */
export function settingsForFile(
  current: Settings,
  fileSettingsSource: unknown,
): Settings {
  const defaults = fileSettings(DEFAULT_SETTINGS);
  return {
    ...current,
    ...defaults,
    ...fileSettings(fileSettingsSource as object | null | undefined),
  };
}

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
  /** The Auto's link paths after laying the lines out (see lib/auto/links.ts); kept in its `auto`. */
  linkPaths?: string[];
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
  const { startPoint, settings, linkPaths, ...edited } = paths;
  if (
    linkPaths &&
    existing.auto &&
    typeof existing.auto === "object" &&
    !Array.isArray(existing.auto)
  ) {
    const auto: Record<string, unknown> = {
      ...(existing.auto as Record<string, unknown>),
    };
    if (linkPaths.length) auto.linkPaths = linkPaths;
    else delete auto.linkPaths;
    existing = { ...existing, auto };
  }
  return {
    ...existing,
    ...(startPoint ? { startPoint } : {}),
    ...edited,
    ...(settings ? { settings } : {}),
    version: PROJECT_VERSION,
    timestamp: new Date().toISOString(),
  };
}
