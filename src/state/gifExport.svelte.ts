import { robotImageSrc } from "../lib/auto/teamRobot";
import { get } from "svelte/store";
import { downloadBlob } from "../utils/download";
import {
  formatGifProgressStatus,
  renderPathGif,
  resolveGifFileName,
  type GifPath,
} from "../lib/export/gifExport";
import { showToast } from "../lib/toast";
import { currentFilePath } from "../stores";
import type { Overlays } from "./overlays.svelte";
import { previewPose, type AutoState } from "./auto.svelte";
import type { PreviewResult } from "../lib/auto/simulate";
import type { ProjectDoc } from "../io/project";
import type { Settings } from "../types";
import type { Prefs } from "./prefs.svelte";
import type { ProjectStore } from "./project.svelte";

/** Progress of a GIF export, shown in a dialog while it runs. */
export class GifExport {
  running = $state(false);
  progress = $state(0);
  status = $state("Preparing...");
  #cancelled = false;

  #project: ProjectStore;
  #prefs: Prefs;
  #overlays: Overlays;

  #auto: AutoState | null;

  constructor(
    project: ProjectStore,
    prefs: Prefs,
    overlays: Overlays,
    auto: AutoState | null = null,
  ) {
    this.#project = project;
    this.#prefs = prefs;
    this.#overlays = overlays;
    this.#auto = auto;
  }

  /** What the field shows: the overlays when there are any, else the project. */
  #paths(): GifPath[] {
    if (this.#overlays.active) {
      const previews = this.#auto?.overlayTogether.previews;
      return this.#overlays.items.map((overlay, index) => {
        const settings = this.#overlays.settingsFor(overlay);
        return {
          ...overlay.doc,
          settings,
          color: overlay.color,
          opacity: Math.max(0.2, 1 - index * 0.15),
          honorLocked: false,
          preview: previewOf(previews?.get(overlay), overlay.doc, settings),
        };
      });
    }
    const settings = this.#prefs.settings;
    return [
      {
        ...this.#project.doc,
        settings,
        preview: this.#project.doc.auto
          ? previewOf(this.#auto?.preview ?? undefined, this.#project.doc, settings)
          : undefined,
      },
    ];
  }

  async run(fieldImageSrc: string, fieldPixels: number) {
    if (this.running) return;
    this.running = true;
    this.#cancelled = false;
    this.progress = 0;
    this.status = "Capturing frames...";
    try {
      const blob = await renderPathGif({
        paths: this.#paths(),
        fieldImageSrc,
        robotImageSrc: robotImageSrc(this.#prefs.settings),
        fieldPixels,
        shouldCancel: () => this.#cancelled,
        onProgress: (progress) => {
          this.progress = progress;
          this.status = formatGifProgressStatus(progress);
        },
      });
      const name = resolveGifFileName(
        get(currentFilePath),
        this.#overlays.active,
      );
      downloadBlob(blob, `${name}.gif`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("cancelled")) {
        console.error("GIF export error:", message);
        showToast(`Failed to export GIF: ${message}`, "error");
      }
    } finally {
      this.running = false;
      this.progress = 0;
    }
  }

  cancel() {
    this.#cancelled = true;
    this.status = "Cancelling...";
  }
}

/**
 * Fork: an Auto's GIF plays its preview, as the field does: the robot waits, picks and takes the
 * route each wait's answer gives, and only the paths it drives are drawn.
 */
function previewOf(
  preview: PreviewResult | undefined,
  doc: Pick<ProjectDoc, "startPoint" | "lines">,
  settings: Settings,
): GifPath["preview"] {
  if (!preview || !(preview.endTime > 0)) return undefined;
  return {
    poseAt: (seconds) => previewPose(preview, seconds, doc, settings),
    duration: preview.endTime,
    drivenLineIds: new Set(preview.drives.map((drive) => drive.pathId)),
  };
}
