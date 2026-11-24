/**
 * Our robot as a toy: the shapes a drive team picks out in the match video, drawn bold, with flat
 * cartoon shading and dark outlines, so it reads at a glance from any of the drill's cameras. The
 * CAD (sim/src/render/mona-shores-robot.ts) stays available behind the drill's "Robot look" choice.
 *
 * What the video shows (Fruitport playoffs M-3 and M-10, 20245): a boxy silver aluminium frame
 * with see-through side panels, the number plates in the alliance's colour on its sides, a taller
 * tower at the back carrying the turret with its red-orange launcher on top, the Limelight on a
 * post at the front, and the indicator light glowing green through the panels. The places and sizes
 * come from the same numbers the CAD gives (sim/public/robots/mona-shores/components.json: the
 * turret's and the FLOWER stick's axes) and from the drill's own (LIGHT_SPOTS, the corner wheels'
 * axles); the rest is drawn to look right, not measured.
 *
 * Frame: the drill robot group's own, metres, +X forward, +Y up, -Z to the robot's left, origin on
 * the floor under the robot's centre. A CAD point (x, y, z) (+Y left, +Z up) is (x, z, -y) here.
 * The indicator lights are the drill's own (DrillView), drawn over this model, not part of it.
 */
import * as THREE from "three";
import {
  CORNER_WHEEL_AXLES_IN,
  CORNER_WHEEL_DIAMETER_IN,
  CORNER_WHEEL_RPM,
} from "./teleop";

const IN = 0.0254;

/** The colours a person sees on the robot. */
const C = {
  aluminium: 0xc9ced6,
  aluminiumDark: 0x8c939e,
  panel: 0xbfe3ff,
  deck: 0x2a2e35,
  wheel: 0x1c1f24,
  hub: 0xf2c230,
  launcher: 0xf0552a,
  flywheel: 0x30343b,
  limelight: 0x16181c,
  lens: 0x58e1ff,
  stick: 0xffd21f,
  cornerWheel: 0x35d46a,
  outline: 0x101216,
  plateText: "#ffffff",
};

/** The alliance's number-plate colour (the robot rules: plates in the alliance's colour). */
const PLATE: Record<"red" | "blue", number> = { red: 0xd8261c, blue: 0x2457d6 };

/** The turret's axis, from the CAD (components.json "turret": -0.0844, -0.06791 left, 0.33035 up). */
const TURRET_AT = { x: -0.0844, z: 0.06791, top: 0.33 };
/** The FLOWER stick's pivot, from the CAD (components.json "flower stick": 0.15449, 0.13883 left, 0.18462 up). */
const STICK_AT = { x: 0.15449, y: 0.18462, z: -0.13883 };
/** The stick's swing out, degrees (biobuzz FlowerStickSubsystem.swingDegrees()). */
const STICK_OUT_DEG = 162;
/**
 * The stick's arm, pivot to its top shaft: at 162 degrees out its top shaft lies on the tile, so
 * the arm is the pivot's height over cos(18 degrees).
 */
const STICK_ARM_M =
  STICK_AT.y / Math.cos(((180 - STICK_OUT_DEG) * Math.PI) / 180);

/** A three-step ramp: lit, mid, shade, so every surface reads as flat cartoon colour. */
let ramp: THREE.DataTexture | null = null;
function toonRamp(): THREE.DataTexture {
  if (ramp) return ramp;
  const d = new Uint8Array([
    90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255,
  ]);
  ramp = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  return ramp;
}

function toon(
  color: number,
  extra: Partial<THREE.MeshToonMaterialParameters> = {},
) {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: toonRamp(),
    ...extra,
  });
}

const outlineMat = new THREE.LineBasicMaterial({ color: C.outline });

/** A mesh with its hard edges drawn dark, the cartoon's ink line. */
function inked(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  edgeAngle = 30,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.add(
    new THREE.LineSegments(new THREE.EdgesGeometry(geo, edgeAngle), outlineMat),
  );
  return m;
}

function box(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
) {
  const m = inked(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

/** A number plate's face: the team number in white on the alliance's colour. */
function plateTexture(team: number, color: number): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 96;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
  g.fillRect(0, 0, 256, 96);
  g.fillStyle = C.plateText;
  g.font = "900 70px ui-sans-serif, system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(team), 128, 52);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** One of our robots as a toy. Add `group` to the robot's group; set the turret, stick and corner wheels each frame. */
export class ToyRobotModel {
  readonly group = new THREE.Group();
  /** Built at once; a promise only so it stands in for the CAD model's. */
  readonly ready = Promise.resolve();
  private turret = new THREE.Group();
  private stick = new THREE.Group();
  private corners: THREE.Group[] = [];
  private cornerSpin = 0;

  /** `frame`: the robot's frame width, metres. `alliance` colours the number plates. */
  constructor(team: number, alliance: "red" | "blue", frame: number) {
    const g = this.group,
      half = frame / 2,
      silver = toon(C.aluminium),
      darkSilver = toon(C.aluminiumDark),
      rail = 1.0 * IN,
      railH = 2.0 * IN;

    // The chassis: a dark deck, side rails and cross members, and four chunky wheels.
    g.add(
      box(
        frame - 2 * rail,
        0.25 * IN,
        frame - 2 * rail,
        toon(C.deck),
        0,
        1.6 * IN,
        0,
      ),
    );
    for (const s of [1, -1]) {
      g.add(
        box(frame, railH, rail, silver, 0, 2.0 * IN, s * (half - rail / 2)),
      );
      g.add(
        box(rail, railH, frame, silver, s * (half - rail / 2), 2.0 * IN, 0),
      );
    }
    const wheelGeo = new THREE.CylinderGeometry(
      2.05 * IN,
      2.05 * IN,
      1.5 * IN,
      20,
    );
    const hubGeo = new THREE.CylinderGeometry(
      0.8 * IN,
      0.8 * IN,
      1.55 * IN,
      12,
    );
    for (const [a, b] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const w = inked(wheelGeo, toon(C.wheel), 50);
      w.rotation.x = Math.PI / 2;
      w.position.set(a * (half - 3.0 * IN), 2.05 * IN, b * (half - 1.9 * IN));
      w.add(new THREE.Mesh(hubGeo, toon(C.hub)));
      g.add(w);
    }

    // The cage: corner posts and top rails, with see-through panels between, as the video shows it.
    const cageH = 9.5 * IN,
      post = 0.9 * IN;
    for (const [a, b] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ])
      g.add(
        box(
          post,
          cageH,
          post,
          silver,
          a * (half - post / 2),
          cageH / 2 + 1 * IN,
          b * (half - post / 2),
        ),
      );
    for (const s of [1, -1]) {
      g.add(
        box(
          frame,
          post,
          post,
          silver,
          0,
          cageH + 0.6 * IN,
          s * (half - post / 2),
        ),
      );
      g.add(
        box(post, post, frame, silver, -half + post / 2, cageH + 0.6 * IN, 0),
      );
    }
    const panelMat = toon(C.panel, {
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    for (const s of [1, -1]) {
      const p = inked(
        new THREE.BoxGeometry(frame - 2 * post, cageH - 3 * IN, 0.1 * IN),
        panelMat,
      );
      p.position.set(0, cageH / 2 + 2.6 * IN, s * (half - 0.2 * IN));
      g.add(p);
    }

    // The number plates: both sides and the back, in the alliance's colour.
    const tex = plateTexture(team, PLATE[alliance]);
    const plateMat = tex
      ? new THREE.MeshBasicMaterial({ map: tex })
      : toon(PLATE[alliance]);
    const plateGeo = new THREE.PlaneGeometry(8.5 * IN, 3.2 * IN);
    for (const [x, z, ry] of [
      [-0.6 * IN, half + 0.15 * IN, 0],
      [-0.6 * IN, -half - 0.15 * IN, Math.PI],
      [-half - 0.15 * IN, 0, -Math.PI / 2],
    ]) {
      const p = inked(plateGeo, plateMat);
      p.position.set(x, 5.3 * IN, z);
      p.rotation.y = ry;
      g.add(p);
    }

    // The intake: a roller across the mouth (9.7 in, the CAD's) with its two side guides.
    const roller = inked(
      new THREE.CylinderGeometry(0.75 * IN, 0.75 * IN, 9.7 * IN, 16),
      toon(0x3ad17a),
      50,
    );
    roller.rotation.x = Math.PI / 2;
    roller.position.set(half - 0.4 * IN, 1.8 * IN, 0);
    this.rollerMat = roller.material as THREE.MeshToonMaterial;
    g.add(roller);
    for (const s of [1, -1])
      g.add(
        box(
          3 * IN,
          2.6 * IN,
          0.35 * IN,
          darkSilver,
          half - 1.2 * IN,
          2.2 * IN,
          s * 4.9 * IN,
        ),
      );

    // The tower at the back right, up to the turret: the lane and feeder, behind a clear panel.
    const towerTop = TURRET_AT.top - 1.6 * IN;
    g.add(
      box(
        5.2 * IN,
        towerTop - 2 * IN,
        5.2 * IN,
        darkSilver,
        TURRET_AT.x,
        (towerTop + 2 * IN) / 2,
        TURRET_AT.z,
      ),
    );

    // The turret: a ring and the launcher on it, red-orange as on the robot, its barrel along the
    // turret's forward (its zero is the nose).
    this.turret.position.set(TURRET_AT.x, towerTop, TURRET_AT.z);
    this.turret.add(
      inked(
        new THREE.CylinderGeometry(3.4 * IN, 3.4 * IN, 0.8 * IN, 28),
        toon(C.aluminiumDark),
        50,
      ),
    );
    const hood = box(
      6.2 * IN,
      3.4 * IN,
      4.4 * IN,
      toon(C.launcher),
      0.4 * IN,
      2.1 * IN,
      0,
    );
    this.turret.add(hood);
    const fly = inked(
      new THREE.CylinderGeometry(1.9 * IN, 1.9 * IN, 3.0 * IN, 20),
      toon(C.flywheel),
      50,
    );
    fly.rotation.x = Math.PI / 2;
    fly.position.set(-0.8 * IN, 2.2 * IN, 0);
    this.turret.add(fly);
    const barrel = box(
      3.0 * IN,
      1.6 * IN,
      2.4 * IN,
      toon(C.launcher),
      4.6 * IN,
      3.0 * IN,
      0,
    );
    barrel.rotation.z = 0.35;
    this.turret.add(barrel);
    g.add(this.turret);

    // The Limelight on its post at the front, centred (CAD: X 0.068 to 0.112 m, 0.355 to 0.399 m up),
    // with a bright lens so the robot's front reads from any side.
    g.add(
      box(
        0.8 * IN,
        0.355 - 2 * IN,
        0.8 * IN,
        silver,
        0.075,
        (0.355 + 2 * IN) / 2,
        0,
      ),
    );
    g.add(box(0.044, 0.044, 3.0 * IN, toon(C.limelight), 0.09, 0.377, 0));
    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.55 * IN, 20),
      new THREE.MeshBasicMaterial({ color: C.lens }),
    );
    lens.position.set(0.1125, 0.377, 0);
    lens.rotation.y = Math.PI / 2;
    g.add(lens);

    // The FLOWER stick: an arm from its pivot at the front left, ending in the top shaft that lies
    // on the tile when it is out. Bright yellow, so a pick reads from across the field.
    this.stick.position.set(STICK_AT.x, STICK_AT.y, STICK_AT.z);
    const stickMat = toon(C.stick);
    const arm = box(
      0.8 * IN,
      STICK_ARM_M,
      0.8 * IN,
      stickMat,
      0,
      STICK_ARM_M / 2,
      0,
    );
    const shaft = inked(
      new THREE.CylinderGeometry(0.45 * IN, 0.45 * IN, 4.0 * IN, 12),
      stickMat,
      50,
    );
    shaft.rotation.x = Math.PI / 2;
    shaft.position.set(0, STICK_ARM_M, 1.6 * IN);
    this.stick.add(arm, shaft);
    g.add(this.stick);

    // The corner wheels (the drill's experiment): a 2.5 in wheel at each front corner on a vertical
    // axle, with flaps, so a spin shows. Hidden unless the experiment is on.
    const r = (CORNER_WHEEL_DIAMETER_IN / 2) * IN;
    for (const [aheadIn, outIn] of CORNER_WHEEL_AXLES_IN) {
      const w = new THREE.Group();
      w.position.set(half + aheadIn * IN, 0.9 * IN, -outIn * IN);
      w.add(
        inked(
          new THREE.CylinderGeometry(r * 0.4, r * 0.4, 1.3 * IN, 16),
          toon(C.flywheel),
          50,
        ),
      );
      // Six flaps through the axle, twelve tips out to the rim.
      for (let k = 0; k < 6; k++) {
        const flap = box(
          2 * r,
          1.1 * IN,
          0.18 * IN,
          toon(C.cornerWheel),
          0,
          0,
          0,
        );
        flap.rotation.y = (k * Math.PI) / 6;
        w.add(flap);
      }
      w.visible = false;
      this.corners.push(w);
      g.add(w);
    }

    this.setTurretDeg(0);
    this.setStickOut(false);
  }

  /** The roller's material, which the drill colours green, or orange with the lane full. */
  readonly rollerMat: THREE.MeshToonMaterial;

  /** The turret's angle, degrees counter-clockwise from the nose, as TurretSubsystem.angleDegrees() reports it. */
  setTurretDeg(deg: number) {
    this.turret.rotation.y = (deg * Math.PI) / 180;
  }

  /** The FLOWER stick out (162 degrees, its top shaft on the tile) or stowed (upright), or an angle between. */
  setStickOut(out: boolean | number) {
    const deg = typeof out === "number" ? out : out ? STICK_OUT_DEG : 0;
    // Out swings the upright arm forward and down: about the robot's left axis, up toward forward.
    this.stick.rotation.z = (-deg * Math.PI) / 180;
  }

  /** The corner wheels: shown while the experiment is on, turning inward while they rake. `dt` in seconds. */
  setCornerWheels(shown: boolean, spinning: boolean, dt: number) {
    if (spinning)
      this.cornerSpin +=
        ((CORNER_WHEEL_RPM / 60) * 2 * Math.PI * dt) % (2 * Math.PI);
    this.corners.forEach((w, i) => {
      w.visible = shown;
      // Inward: the left wheel's front moves right, the right wheel's the mirror.
      w.rotation.y =
        (CORNER_WHEEL_AXLES_IN[i][1] > 0 ? -1 : 1) * this.cornerSpin;
    });
  }
}
