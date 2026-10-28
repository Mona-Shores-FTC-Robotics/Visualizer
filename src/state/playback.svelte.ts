import { getContext, setContext } from "svelte";
import type { Settings } from "../types";
import { findCollisions, type Collision } from "../model/collision";
import { robotPoseAt, type RobotPose } from "../sim/pose";
import { createAnimationController } from "../utils/animation";
import { calculateVisualizationPathTime } from "../utils/timeCalculator";
import type { Overlays } from "./overlays.svelte";
import { previewPose, type AutoState } from "./auto.svelte";
import type { PreviewResult } from "../lib/auto/simulate";
import type { TimePrediction } from "../types";
import type { ProjectStore } from "./project.svelte";

/**
 * The shared playback clock, and where every robot is on it. With overlays
 * shown, the clock runs for the longest overlay and the open project's robot
 * is hidden.
 */
export class Playback {
  percent = $state(0);
  playing = $state(false);
  loop = $state(true);

  #project: ProjectStore;
  #overlays: Overlays;
  #getSettings: () => Settings;
  #controller: ReturnType<typeof createAnimationController>;
  /** Fork: an Auto plays out its preview (waits and decisions included). */
  #auto: AutoState | null;

  prediction = $derived.by(() => {
    const preview = this.#auto?.preview;
    if (preview) return previewPrediction(preview);
    return calculateVisualizationPathTime(
      this.#project.doc.startPoint,
      this.#project.doc.lines,
      this.#getSettings(),
      this.#project.doc.sequence,
    );
  });
  overlayPredictions = $derived.by(() =>
    this.#overlays.items.map((overlay) => {
      const preview = this.#auto?.overlayTogether.previews.get(overlay);
      if (preview) return previewPrediction(preview);
      return calculateVisualizationPathTime(
        overlay.doc.startPoint,
        overlay.doc.lines,
        this.#overlays.settingsFor(overlay),
        overlay.doc.sequence,
      );
    }),
  );
  /** Seconds the clock runs for. */
  duration = $derived.by(() =>
    this.#overlays.active
      ? Math.max(0, ...this.overlayPredictions.map((p) => p.totalTime))
      : this.prediction.totalTime,
  );
  seconds = $derived((this.percent / 100) * this.duration);

  robotPose: RobotPose = $derived.by(() => {
    const preview = this.#auto?.preview;
    if (preview) {
      return previewPose(
        preview,
        this.seconds,
        this.#project.doc,
        this.#getSettings(),
      );
    }
    return robotPoseAt(
      this.seconds,
      this.prediction.timeline,
      this.#project.doc.startPoint,
      this.#project.doc.lines,
      this.#getSettings(),
    );
  });
  /** Each overlay's robot; one that finishes early waits at its end. */
  overlayPoses: RobotPose[] = $derived.by(() =>
    this.#overlays.items.map((overlay, index) => {
      const prediction = this.overlayPredictions[index];
      const preview = this.#auto?.overlayTogether.previews.get(overlay);
      if (preview) {
        return previewPose(
          preview,
          Math.min(this.seconds, prediction.totalTime),
          overlay.doc,
          this.#overlays.settingsFor(overlay),
        );
      }
      return robotPoseAt(
        Math.min(this.seconds, prediction.totalTime),
        prediction.timeline,
        overlay.doc.startPoint,
        overlay.doc.lines,
        this.#overlays.settingsFor(overlay),
      );
    }),
  );

  /** Where the open project's robot hits an obstacle or wall, when obstacles are on. */
  collisions: Collision[] = $derived.by(() =>
    this.#getSettings().experimentalFeatures?.obstacles
      ? findCollisions(this.#project.doc, this.prediction.timeline)
      : [],
  );

  constructor(
    project: ProjectStore,
    overlays: Overlays,
    getSettings: () => Settings,
    auto: AutoState | null = null,
  ) {
    this.#project = project;
    this.#overlays = overlays;
    this.#getSettings = getSettings;
    this.#auto = auto;
    this.#controller = createAnimationController(
      this.duration,
      (percent) => (this.percent = percent),
      () => (this.playing = false),
    );
    $effect(() => this.#controller.setDuration(this.duration));
    $effect(() => this.#controller.setLoop(this.loop));
    $effect(() => () => this.#controller.pause());
  }

  play() {
    this.#controller.play();
    this.playing = true;
  }

  pause() {
    this.#controller.pause();
    this.playing = false;
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  seek(percent: number) {
    this.#controller.seekToPercent(percent);
  }

  reset() {
    this.#controller.reset();
    this.playing = false;
  }
}

/** A preview in the shape of the app's own timing. */
function previewPrediction(preview: PreviewResult): TimePrediction {
  return {
    totalTime: preview.endTime,
    segmentTimes: [],
    totalDistance: 0,
    timeline: preview.timeline,
  };
}

const CONTEXT_KEY = Symbol("playback");

export function providePlayback(playback: Playback) {
  setContext(CONTEXT_KEY, playback);
}

export function usePlayback(): Playback {
  return getContext<Playback>(CONTEXT_KEY);
}
