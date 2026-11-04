import { publicAsset } from "../../utils/publicAsset";
import type {
  BasePoint,
  Path,
  SequenceItem,
  Settings,
  StartPose,
} from "../../types";
import {
  FIELD_IMAGE_OVERHANG,
  FIELD_SIZE,
  LINE_WIDTH,
} from "../../config/defaults";
import { robotPoseAt, type RobotPose } from "../../sim/pose";
import { boxCentre, featureBoxes } from "../../model/collision";
import { exportAsGif } from "../../utils/gifExporter";
import { pathStem } from "../../utils/filename";
import { flattenToAtomicSegments } from "../../utils/pathTraversal";
import { calculateVisualizationPathTime } from "../../utils/timeCalculator";
import { POLYLINE_SAMPLES } from "../scene/stroke";

export const GIF_EXPORT_SCALE = 0.65;
export const GIF_EXPORT_FPS = 20;
export const GIF_EXPORT_QUALITY = 15;

/** One robot and the path it drives. */
export interface GifPath {
  startPoint: StartPose;
  lines: Path[];
  sequence: SequenceItem[];
  settings: Settings;
  /** Draws every segment in this colour instead of its own. */
  color?: string;
  opacity?: number;
  /** Draw locked segments dashed and dimmer. */
  honorLocked?: boolean;
  /**
   * Fork: the Auto's preview, when it has one. The robot follows `poseAt` (waits, picks and the
   * route each wait takes, as the preview plays it) for `duration` seconds instead of driving every
   * path in list order, and only the paths in `drivenLineIds` (top-level path ids) are drawn.
   */
  preview?: {
    poseAt: (seconds: number) => RobotPose;
    duration: number;
    drivenLineIds: ReadonlySet<string>;
  };
}

export interface GifRequest {
  paths: GifPath[];
  fieldImageSrc: string;
  robotImageSrc: string;
  /** The on-screen field size in pixels; the GIF is a fixed fraction of it. */
  fieldPixels: number;
  onProgress?: (progress: number) => void;
  shouldCancel?: () => boolean;
  /** Frames per second; the app's default when unset. Fewer make a smaller file. */
  fps?: number;
}

/**
 * Render the paths and their robots as an animated GIF. Each frame is painted
 * from the simulated poses, so it never depends on what the screen shows.
 */
export async function renderPathGif(request: GifRequest): Promise<Blob> {
  const size = Math.max(1, Math.floor(request.fieldPixels * GIF_EXPORT_SCALE));
  const pixelsPerInch = size / FIELD_SIZE;
  const toX = (inches: number) => inches * pixelsPerInch;
  const toY = (inches: number) => size - inches * pixelsPerInch;

  const loadImage = createImageLoader();
  const [fieldImage, robotImage] = await Promise.all([
    loadImage(publicAsset(request.fieldImageSrc)).catch(() =>
      loadImage(publicAsset("/fields/decode.webp")),
    ),
    loadImage(publicAsset(request.robotImageSrc)).catch(() =>
      loadImage(publicAsset("/robot.png")),
    ),
  ]);

  const background = document.createElement("canvas");
  background.width = size;
  background.height = size;
  const backgroundContext = background.getContext("2d");
  if (!backgroundContext) throw new Error("Failed to get canvas context");
  const overhang = toX(FIELD_IMAGE_OVERHANG);
  backgroundContext.drawImage(
    fieldImage,
    -overhang,
    -overhang,
    size + 2 * overhang,
    size + 2 * overhang,
  );
  for (const path of request.paths) {
    drawPathLayer(backgroundContext, path, toX, toY, toX(LINE_WIDTH));
  }

  const timelines = request.paths.map((path) =>
    calculateVisualizationPathTime(
      path.startPoint,
      path.lines,
      path.settings,
      path.sequence,
    ),
  );
  const durations = request.paths.map(
    (path, index) => path.preview?.duration ?? timelines[index].totalTime,
  );
  const duration = Math.max(0, ...durations);
  // Fork: an Auto's preview gets the match clock in the corner.
  const showClock = request.paths.some((path) => path.preview);
  if (duration <= 0) throw new Error("Path duration is too short to export.");

  return exportAsGif({
    width: size,
    height: size,
    duration: duration * 1000,
    fps: request.fps ?? GIF_EXPORT_FPS,
    quality: GIF_EXPORT_QUALITY,
    shouldCancel: request.shouldCancel,
    onProgress: request.onProgress,
    onDrawFrame: (context, _width, _height, _frame, _frames, percent) => {
      context.drawImage(background, 0, 0, size, size);
      const seconds = (percent / 100) * duration;
      request.paths.forEach((path, index) => {
        const timeline = timelines[index];
        const pose = path.preview
          ? path.preview.poseAt(Math.min(seconds, path.preview.duration))
          : robotPoseAt(
              Math.min(seconds, timeline.totalTime),
              timeline.timeline,
              path.startPoint,
              path.lines,
              path.settings,
            );
        const centre = boxCentre(pose, path.settings);
        drawRobot(
          context,
          robotImage,
          { x: toX(centre.x), y: toY(centre.y) },
          -pose.heading,
          path.settings.rLength * pixelsPerInch,
          path.settings.rWidth * pixelsPerInch,
          path.opacity ?? 1,
        );
        // Fork: several Autos together share one robot image; each robot gets its path's colour.
        if (path.color && path.preview)
          drawOutline(
            context,
            { x: toX(centre.x), y: toY(centre.y) },
            -pose.heading,
            path.settings.rLength * pixelsPerInch,
            path.settings.rWidth * pixelsPerInch,
            path.color,
          );
        drawFeatures(
          context,
          featureBoxes(pose, path.settings).map((box) => ({
            color: box.color,
            corners: box.corners.map((c) => ({ x: toX(c.x), y: toY(c.y) })),
          })),
          path.opacity ?? 1,
        );
      });
      if (showClock) drawClock(context, seconds, size);
    },
  });
}

/** Fork: the match clock, top left, readable on either field image. */
function drawClock(context: CanvasRenderingContext2D, seconds: number, size: number) {
  const font = Math.max(12, Math.round(size / 26));
  const text = `${seconds.toFixed(1)} s`;
  context.save();
  context.font = `600 ${font}px ui-monospace, Menlo, Consolas, monospace`;
  const width = context.measureText(text).width;
  context.fillStyle = "rgba(15, 18, 22, 0.72)";
  context.fillRect(6, 6, width + font, font * 1.6);
  context.fillStyle = "#f5f7f8";
  context.textBaseline = "middle";
  context.fillText(text, 6 + font / 2, 6 + font * 0.8);
  context.restore();
}

function drawPathLayer(
  context: CanvasRenderingContext2D,
  path: GifPath,
  toX: (inches: number) => number,
  toY: (inches: number) => number,
  lineWidth: number,
) {
  const honorLocked = path.honorLocked ?? true;
  for (const segment of flattenToAtomicSegments(path.startPoint, path.lines)) {
    // Fork: with a preview, only the paths the Auto drives (not other branches, nor a spot's park).
    const topId = segment.ancestors[0]?.id ?? segment.line.id;
    if (path.preview && !path.preview.drivenLineIds.has(topId)) continue;
    const locked = honorLocked && Boolean(segment.line.locked);
    context.save();
    context.globalAlpha =
      (path.opacity ?? path.settings.pathOpacity ?? 1) * (locked ? 0.7 : 1);
    context.strokeStyle = path.color || segment.line.color;
    context.lineWidth = lineWidth;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.setLineDash(locked ? [lineWidth * 1.5, lineWidth * 1.5] : []);
    context.beginPath();
    segment.curve.sample(POLYLINE_SAMPLES).forEach((point, i) => {
      if (i === 0) context.moveTo(toX(point.x), toY(point.y));
      else context.lineTo(toX(point.x), toY(point.y));
    });
    context.stroke();
    context.restore();
  }
}

/** `screenHeading` is clockwise degrees, as the canvas rotates. */
function drawRobot(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  center: BasePoint,
  screenHeading: number,
  width: number,
  height: number,
  opacity: number,
) {
  context.save();
  context.globalAlpha = opacity;
  context.translate(center.x, center.y);
  context.rotate((screenHeading * Math.PI) / 180);
  context.drawImage(image, -width / 2, -height / 2, width, height);
  context.restore();
}

/** Fork: a coloured frame round a robot, to tell several apart. */
function drawOutline(
  context: CanvasRenderingContext2D,
  center: BasePoint,
  screenHeading: number,
  width: number,
  height: number,
  color: string,
) {
  context.save();
  context.translate(center.x, center.y);
  context.rotate((screenHeading * Math.PI) / 180);
  context.strokeStyle = color;
  context.lineWidth = Math.max(2, width / 12);
  context.strokeRect(-width / 2, -height / 2, width, height);
  context.restore();
}

/** Fork: the robot's features, on top of its image (see RobotFeatures.svelte). */
function drawFeatures(
  context: CanvasRenderingContext2D,
  boxes: { color?: string; corners: BasePoint[] }[],
  opacity: number,
) {
  context.save();
  context.globalAlpha = opacity;
  context.strokeStyle = "#1d1f23";
  context.lineWidth = 1;
  for (const { color, corners } of boxes) {
    context.fillStyle = color ?? "#f2c94c";
    context.beginPath();
    corners.forEach((c, i) =>
      i ? context.lineTo(c.x, c.y) : context.moveTo(c.x, c.y),
    );
    context.closePath();
    context.fill();
    context.stroke();
  }
  context.restore();
}

function createImageLoader() {
  const cache = new Map<string, Promise<HTMLImageElement>>();
  return (src: string): Promise<HTMLImageElement> => {
    let pending = cache.get(src);
    if (!pending) {
      pending = new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
        image.src = src;
      });
      cache.set(src, pending);
    }
    return pending;
  };
}

export function resolveGifFileName(
  currentFilePath: string | null,
  hasActivePaths: boolean,
): string {
  if (currentFilePath) return pathStem(currentFilePath);
  if (hasActivePaths) return "multiple_paths";
  return "path_animation";
}

/** Frame capture occupies the first half of the progress bar, encoding the second. */
export function formatGifProgressStatus(progress: number): string {
  return progress < 0.5
    ? `Capturing frames... ${Math.round(progress * 200)}%`
    : `Encoding GIF... ${Math.round((progress - 0.5) * 200)}%`;
}
