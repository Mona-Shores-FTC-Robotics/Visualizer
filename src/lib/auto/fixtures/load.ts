import sampleText from "./hive-rush.pp?raw";
import { normalizePaths, normalizeStartPose } from "../../../utils/normalize";
import { DEFAULT_SETTINGS } from "../../../config";
import type { Settings, Shape } from "../../../types";
import { normalizeAuto } from "../normalize";

/** The hive-rush sample project, read the way the app reads a file. */
export function loadSample() {
  return loadProject(sampleText);
}

/** A project file's text, read the way the app reads a file. */
export function loadProject(text: string) {
  const sampleText = text;
  const data = JSON.parse(sampleText);
  const { auto, problems } = normalizeAuto(data.auto);
  if (!auto) throw new Error("sample has no auto section");
  return {
    data,
    text: sampleText as string,
    auto,
    problems,
    startPoint: normalizeStartPose(data.startPoint),
    lines: normalizePaths(data.lines),
    shapes: data.shapes as Shape[],
    settings: { ...DEFAULT_SETTINGS, ...data.settings } as Settings,
  };
}
