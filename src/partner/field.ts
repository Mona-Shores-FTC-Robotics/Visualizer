/**
 * The partner page's field: a canvas with the field image, each robot's route (where its preview
 * takes it), each robot's frame at the moment shown, and where the two first touch. Red's frame is
 * drawn as the Visualizer draws it (+y up); blue's is the same match turned half a turn about the
 * field's centre, so only the drawing turns, never the numbers.
 */
import { FIELD_IMAGE_OVERHANG, FIELD_SIZE } from "../config/defaults";
import { robotFootprint } from "../model/collision";
import type { BasePoint } from "../types";
import { poseOf, type Contact, type Robot } from "./beside";
import type { PreviewResult } from "../lib/auto/simulate";

export interface FieldScene {
  robots: Robot[];
  previews: PreviewResult[];
  colors: string[];
  /** Each robot's route, sampled once per look. */
  routes: BasePoint[][];
  t: number;
  contact: Contact | null;
  blue: boolean;
  image: HTMLImageElement | null;
  /** The partner's spots, numbered, to drag while its Auto is edited; null when not editing. */
  markers: Marker[] | null;
}

export interface Marker {
  at: BasePoint;
  /** "S" for the start, else the step's number. */
  label: string;
  /** The one being dragged or picked in the list. */
  active: boolean;
}

/** A marker's radius on screen, CSS pixels: big enough for a fingertip. */
export const MARKER_PX = 13;

/** Which marker a touch at (px, py) grabs: the nearest within a fingertip, else -1. */
export function markerAt(
  markers: Marker[],
  px: number,
  py: number,
  size: number,
  blue: boolean,
): number {
  const at = mapper(size, blue);
  let best = -1;
  let bestD = MARKER_PX * 2.2;
  // Later markers are drawn on top, so they win a tie.
  markers.forEach((m, i) => {
    const q = at(m.at);
    const d = Math.hypot(q.x - px, q.y - py);
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/** Each robot's route: where its preview has it every 0.1 s through `span`. */
export function routesOf(
  robots: Robot[],
  previews: PreviewResult[],
  span: number,
): BasePoint[][] {
  return robots.map((robot, i) => {
    const out: BasePoint[] = [];
    for (let t = 0; t <= span + 1e-9; t += 0.1) {
      const p = poseOf(robot, previews[i], t);
      const last = out[out.length - 1];
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.3)
        out.push({ x: p.x, y: p.y });
    }
    return out;
  });
}

/** Canvas pixels per field inch, and a field point's pixel. */
function mapper(size: number, blue: boolean) {
  const scale = size / FIELD_SIZE;
  return (p: BasePoint) =>
    blue
      ? { x: (FIELD_SIZE - p.x) * scale, y: p.y * scale }
      : { x: p.x * scale, y: size - p.y * scale };
}

/** A canvas pixel (CSS pixels from its top-left) back to field inches, red's frame. */
export function toField(
  px: number,
  py: number,
  size: number,
  blue: boolean,
): BasePoint {
  const scale = size / FIELD_SIZE;
  const x = px / scale;
  const y = (size - py) / scale;
  return blue ? { x: FIELD_SIZE - x, y: FIELD_SIZE - y } : { x, y };
}

export function drawField(
  ctx: CanvasRenderingContext2D,
  size: number,
  scene: FieldScene,
) {
  const at = mapper(size, scene.blue);
  const scale = size / FIELD_SIZE;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#2b2b2b";
  ctx.fillRect(0, 0, size, size);
  if (scene.image?.complete && scene.image.naturalWidth) {
    // The image shows all six tiles; the floor is FIELD_SIZE of it, centred.
    const over = FIELD_IMAGE_OVERHANG * scale;
    ctx.save();
    if (scene.blue) {
      ctx.translate(size, size);
      ctx.rotate(Math.PI);
    }
    ctx.drawImage(scene.image, -over, -over, size + 2 * over, size + 2 * over);
    ctx.restore();
  }

  const line = (points: BasePoint[], color: string, width: number) => {
    if (points.length < 2) return;
    ctx.beginPath();
    points.forEach((p, i) => {
      const q = at(p);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  };

  // Routes: a dark casing under each so they read on the light and dark field alike.
  scene.routes.forEach((route, i) => {
    line(route, "rgba(0,0,0,.55)", Math.max(3, scale * 1.6));
    line(route, scene.colors[i], Math.max(2, scale * 0.9));
  });

  // The robots at `t`: frame, and a stripe on the front.
  const touching = scene.contact !== null && scene.t >= scene.contact.t - 1e-9;
  scene.robots.forEach((robot, i) => {
    const preview = scene.previews[i];
    if (!preview) return;
    const pose = poseOf(robot, preview, scene.t);
    const corners = robotFootprint(pose, {
      ...robot.settings,
      safetyMargin: 0,
    });
    ctx.beginPath();
    corners.forEach((c, k) => {
      const q = at(c);
      if (k === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    ctx.closePath();
    ctx.fillStyle = scene.colors[i] + "cc";
    ctx.fill();
    ctx.lineWidth = Math.max(2, scale * 0.7);
    ctx.strokeStyle = touching ? "#ff2d2d" : "#111";
    ctx.stroke();
    // Front: from the centre toward the heading.
    const rad = (pose.heading * Math.PI) / 180;
    const half = robot.settings.rLength / 2;
    const tip = at({
      x: pose.x + half * Math.cos(rad),
      y: pose.y + half * Math.sin(rad),
    });
    const mid = at(pose);
    ctx.beginPath();
    ctx.moveTo(mid.x, mid.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = Math.max(2, scale * 0.8);
    ctx.stroke();
  });

  // The partner's spots, while its Auto is edited: a numbered disc on each.
  for (const m of scene.markers ?? []) {
    const q = at(m.at);
    ctx.beginPath();
    ctx.arc(q.x, q.y, MARKER_PX, 0, Math.PI * 2);
    ctx.fillStyle = m.active ? "#ffffff" : (scene.colors[1] ?? "#4ECDC4");
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = m.active ? (scene.colors[1] ?? "#4ECDC4") : "#111";
    ctx.stroke();
    ctx.fillStyle = "#111";
    ctx.font = "800 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(m.label, q.x, q.y + 0.5);
  }

  // Where they first touch: a ring, from the moment they do.
  if (scene.contact) {
    const c = at(scene.contact.at);
    ctx.beginPath();
    ctx.arc(c.x, c.y, Math.max(10, scale * 9), 0, Math.PI * 2);
    ctx.lineWidth = Math.max(3, scale * 1.2);
    ctx.strokeStyle = touching ? "#ff2d2d" : "rgba(255,45,45,.55)";
    ctx.setLineDash(touching ? [] : [6, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
