import { DEFAULT_SETTINGS } from "../../../config";
import type { Shape } from "../../../types";
import { normalizePaths, normalizeStartPose } from "../../../utils/normalize";
import { settingsForFile } from "../../../utils/project";
import { normalizeAuto } from "../../auto/normalize";
import { adoptPins, predatesPins } from "../../auto/pins";
import { generateAutoJava, type AutoExportResult } from "./javaAuto";

/**
 * Export straight from a .pp file's text, the way the app would after
 * loading it. Used by scripts/export-auto.mjs and the golden test.
 */
export function generateAutoJavaFromText(
  text: string,
  sourceFileName: string,
): AutoExportResult & { loadProblems: string[] } {
  const data = JSON.parse(text);
  const { auto, problems } = normalizeAuto(data.auto);
  if (!auto) {
    return {
      ok: false,
      errors: [`${sourceFileName} has no auto section.`],
      warnings: [],
      loadProblems: problems,
    };
  }
  const startPoint = normalizeStartPose(data.startPoint ?? { x: 72, y: 72 });
  const lines = normalizePaths(data.lines ?? []);
  // As the app does when it opens a file from before pins.
  if (predatesPins(data.auto)) adoptPins(auto, startPoint, lines);
  const result = generateAutoJava({
    auto,
    startPoint,
    lines,
    shapes: (data.shapes ?? []) as Shape[],
    settings: settingsForFile(DEFAULT_SETTINGS, data.settings),
    sourceFileName,
  });
  return { ...result, loadProblems: problems };
}
