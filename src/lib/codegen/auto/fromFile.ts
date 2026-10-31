import { DEFAULT_SETTINGS } from "../../../config";
import { projectFromJson, robotConfigOf } from "../../../io";
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
  const { problems } = normalizeAuto(data.auto);
  // Read the way the app reads it, with the default robot for anything the
  // file does not record (as a fresh browser would).
  const loaded = projectFromJson(data, robotConfigOf(DEFAULT_SETTINGS));
  const auto = loaded.ok ? loaded.doc.auto : null;
  if (!loaded.ok || !auto) {
    return {
      ok: false,
      errors: [
        loaded.ok ? `${sourceFileName} has no auto section.` : loaded.error,
      ],
      warnings: [],
      loadProblems: problems,
    };
  }
  const { doc } = loaded;
  const result = generateAutoJava({
    auto,
    startPoint: doc.startPoint,
    lines: doc.lines,
    shapes: doc.shapes,
    settings: { ...DEFAULT_SETTINGS, ...doc.robot },
    sourceFileName,
    savedAt: typeof data.timestamp === "string" ? data.timestamp : undefined,
  });
  return { ...result, loadProblems: problems };
}
