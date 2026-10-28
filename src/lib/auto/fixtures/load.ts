import sampleText from "./hive-rush.pp?raw";
import { DEFAULT_SETTINGS } from "../../../config";
import { projectFromJson, robotConfigOf } from "../../../io";
import type { Settings } from "../../../types";
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
  const loaded = projectFromJson(data, robotConfigOf(DEFAULT_SETTINGS));
  if (!loaded.ok) throw new Error(loaded.error);
  const { doc } = loaded;
  return {
    data,
    text: sampleText as string,
    auto,
    problems,
    startPoint: doc.startPoint,
    lines: doc.lines,
    shapes: doc.shapes,
    settings: { ...DEFAULT_SETTINGS, ...doc.robot } as Settings,
  };
}
