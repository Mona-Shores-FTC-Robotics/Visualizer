import { DEFAULT_SETTINGS } from "../../../config";
import type { Settings, Shape } from "../../../types";
import { normalizePaths, normalizeStartPose } from "../../../utils/normalize";
import { normalizeAuto } from "../../auto/normalize";
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
  const result = generateAutoJava({
    auto,
    startPoint: normalizeStartPose(data.startPoint ?? { x: 72, y: 72 }),
    lines: normalizePaths(data.lines ?? []),
    shapes: (data.shapes ?? []) as Shape[],
    settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) } as Settings,
    sourceFileName,
  });
  return { ...result, loadProblems: problems };
}
