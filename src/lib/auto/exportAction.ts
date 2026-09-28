import type { Path, Settings, Shape, StartPose } from "../../types";
import { downloadBlob } from "../../utils/download";
import { showToast } from "../toast";
import { generateAutoJava } from "../codegen/auto/javaAuto";
import { currentAuto } from "./store";

/**
 * "Export Auto (Java)": generate the class and download `<ClassName>.java`,
 * or explain what blocks it. Returns the blocking errors (empty on success).
 */
export function exportAutoJava(input: {
  startPoint: StartPose;
  lines: Path[];
  shapes: Shape[];
  settings: Settings;
  sourceFileName: string;
}): string[] {
  const auto = currentAuto();
  if (!auto) {
    showToast("This project has no Auto yet. Turn on Auto mode to build one.", "warning");
    return ["This project has no Auto yet."];
  }
  const result = generateAutoJava({ ...input, auto });
  if (!result.ok) {
    const more = result.errors.length > 1 ? ` (+${result.errors.length - 1} more, listed in the Auto panel)` : "";
    showToast(`Export blocked: ${result.errors[0]}${more}`, "error");
    return result.errors;
  }
  downloadBlob(new Blob([result.source], { type: "text/x-java" }), result.fileName);
  showToast(
    result.warnings.length
      ? `Exported ${result.fileName} with ${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"}`
      : `Exported ${result.fileName}`,
    result.warnings.length ? "warning" : "success",
  );
  return [];
}
