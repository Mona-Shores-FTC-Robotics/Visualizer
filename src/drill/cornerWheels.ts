/**
 * The corner wheels, as both robots have them (biobuzz `CornerWheelSubsystem`, doc/corner-wheels.md;
 * mentor, 26 Nov 2026, after robot testing: they "worked very, very well"). At each front corner of
 * the intake, a 3.5 in SWYFT Intake Wheel stands upright on a 1/2 in hex axle that points forward,
 * its servo behind it, and its bottom edge sweeps inward: a POLLEN at the robot's corner, or pinned
 * against a wall there, is raked into the intake mouth.
 *
 * Geometry, robot frame (inches, +X forward, +Y left, from the robot's centre): the wheel faces at
 * X 9.3, the axles at Y +-6.9, the wheel's centre 1.8 in up. Calibrated from the mentor's clip
 * (26 Nov 2026): at 150 rpm a wheel moves a ball pressed against it inward at about 6.3 in/s (the
 * ball slips on the paddles: the rim itself runs at 27 in/s), and the intake grabs a ball about
 * 1.2 in ahead of the wheel faces.
 *
 * The wheels have no collider: only their rake is modelled (TeleOp.rakeCorners), and the drawing
 * (CornerWheelMeshes), the same on the toy and the CAD.
 */
import * as THREE from "three";

export const CORNER_WHEEL_RPM = 150;
export const CORNER_WHEEL_DIAMETER_IN = 3.5;
/** The wheels' front faces, inches ahead of the robot's centre. */
export const CORNER_WHEEL_FACE_X_IN = 9.3;
/** The axles, inches left of the centre line (+ left). */
export const CORNER_WHEEL_Y_IN: readonly number[] = [6.9, -6.9];
/** The wheel's centre above the tiles, inches. */
export const CORNER_WHEEL_CENTRE_Z_IN = 1.8;
/** The wheel's width along its axle, inches (the paddles' span). */
export const CORNER_WHEEL_WIDTH_IN = 0.9;
/** How fast a wheel moves a ball pressed against it inward, in/s (the clip). */
export const CORNER_WHEEL_RAKE_IN_PER_S = 6.3;
/** The intake grabs a ball this far ahead of the wheel faces, inches (the clip): its near side. */
export const CORNER_WHEEL_GRAB_AHEAD_IN = 1.2;
/** A ball this far off the face still counts as pressed on it (the paddles stand proud of the rim). */
const PRESS_SLACK_IN = 0.15;

/**
 * Where a ball (centre in the robot frame, metres: `f` forward, `l` left) meets a wheel, or null.
 * It is pressed on the wheel's front face where the face reaches it: within the ball's radius (plus
 * the paddles) ahead of the face, and across the face as far as the wheel spans at the ball's
 * centre height. Returns the wheel (its Y, inches) and the inward direction (+1 left, -1 right).
 */
export function pressedOn(
  f: number,
  l: number,
  ballRadius: number,
): { wheelYIn: number; inward: number } | null {
  const IN = 0.0254;
  const face = CORNER_WHEEL_FACE_X_IN * IN;
  if (f < face - 1e-3 || f > face + ballRadius + PRESS_SLACK_IN * IN)
    return null;
  // The wheel's half span at the ball's centre height.
  const r = (CORNER_WHEEL_DIAMETER_IN / 2) * IN,
    dz = CORNER_WHEEL_CENTRE_Z_IN * IN - ballRadius,
    half = Math.sqrt(Math.max(0, r * r - dz * dz));
  for (const y of CORNER_WHEEL_Y_IN) {
    if (Math.abs(l - y * IN) <= half)
      return { wheelYIn: y, inward: y > 0 ? -1 : 1 };
  }
  return null;
}

/**
 * The intake's reach with the wheels fitted, metres past the front face `halfLengthM` (the
 * simulator's `cfg.intake.reach`): the grab line, CORNER_WHEEL_GRAB_AHEAD_IN past the faces.
 */
export function wheelIntakeReach(halfLengthM: number): number {
  return Math.max(
    0,
    (CORNER_WHEEL_FACE_X_IN + CORNER_WHEEL_GRAB_AHEAD_IN) * 0.0254 -
      halfLengthM,
  );
}

const WHITE = 0xf2f2ee,
  HUB = 0x2f3338,
  SERVO = 0x1b1d21,
  PADDLE = 0x9aa3ad;

/**
 * The two wheels, drawn: a white rim, 12 swept spokes and 12 paddles on a hex hub, upright with the
 * axle forward, and the servo behind. Add `group` to the robot's group (local +x forward, +y up,
 * +z the robot's right); `set` each frame.
 */
export class CornerWheelMeshes {
  readonly group = new THREE.Group();
  private wheels: { spin: THREE.Group; inward: number }[] = [];
  private angle = 0;

  constructor() {
    const IN = 0.0254,
      r = (CORNER_WHEEL_DIAMETER_IN / 2) * IN,
      w = CORNER_WHEEL_WIDTH_IN * IN;
    const white = new THREE.MeshStandardMaterial({
        color: WHITE,
        roughness: 0.5,
      }),
      hub = new THREE.MeshStandardMaterial({ color: HUB, roughness: 0.6 }),
      paddle = new THREE.MeshStandardMaterial({
        color: PADDLE,
        roughness: 0.7,
      }),
      servo = new THREE.MeshStandardMaterial({ color: SERVO, roughness: 0.8 });
    for (const y of CORNER_WHEEL_Y_IN) {
      const mount = new THREE.Group();
      // The wheel's centre: its front face at FACE_X, so the middle half a width behind.
      mount.position.set(
        CORNER_WHEEL_FACE_X_IN * IN - w / 2,
        CORNER_WHEEL_CENTRE_Z_IN * IN,
        -y * IN,
      );
      const spin = new THREE.Group();
      // The rim: a ring about the axle (local x).
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(r * 0.88, r * 0.1, 8, 36),
        white,
      );
      rim.rotation.y = Math.PI / 2;
      spin.add(rim);
      // The hex hub on the 1/2 in hex axle.
      const hexHub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45 * IN, 0.45 * IN, w, 6),
        hub,
      );
      hexHub.rotation.z = Math.PI / 2;
      spin.add(hexHub);
      for (let k = 0; k < 12; k++) {
        const a = (k * Math.PI * 2) / 12;
        // A swept spoke: from the hub out to the rim, leaning a quarter-step round.
        const spoke = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.35, r * 0.78, 0.09 * IN),
          white,
        );
        spoke.position.set(
          0,
          Math.cos(a + 0.12) * r * 0.48,
          Math.sin(a + 0.12) * r * 0.48,
        );
        spoke.rotation.x = -(a + 0.12) - 0.35;
        spin.add(spoke);
        // A paddle at the rim, standing out across the wheel's width.
        const pad = new THREE.Mesh(
          new THREE.BoxGeometry(w, 0.32 * IN, 0.07 * IN),
          paddle,
        );
        pad.position.set(0, Math.cos(a) * r, Math.sin(a) * r);
        pad.rotation.x = -a;
        spin.add(pad);
      }
      mount.add(spin);
      // The servo behind the wheel, on the axle's line.
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.6 * IN, 0.8 * IN, 1.6 * IN),
        servo,
      );
      body.position.set(-(w / 2 + 0.9 * IN), 0, 0);
      mount.add(body);
      this.group.add(mount);
      // Inward at the bottom: the left wheel's bottom moves toward the centre (+z here), which is a
      // negative turn about +x; the right wheel's the other way.
      this.wheels.push({ spin, inward: y > 0 ? -1 : 1 });
    }
  }

  /** Shown when fitted; turning, inward at the bottom, while they rake. `dt` in seconds. */
  set(shown: boolean, spinning: boolean, dt: number) {
    this.group.visible = shown;
    if (spinning)
      this.angle =
        (this.angle + (CORNER_WHEEL_RPM / 60) * 2 * Math.PI * dt) %
        (2 * Math.PI);
    for (const wheel of this.wheels)
      wheel.spin.rotation.x = wheel.inward * this.angle;
  }
}
