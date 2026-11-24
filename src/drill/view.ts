/**
 * Draws the drill with three.js: the official field CAD, the balls, the HIVE rockers and our
 * robot with its turret. Adapted from ftc-biobuzz-sim's `src/render/view.ts` (MIT, see
 * sim/LICENSE).
 */
import * as THREE from "three";
import { MonaShoresRobotModel } from "../../sim/src/render/mona-shores-robot";
import type { LightColour } from "./indicator";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FIELD, HIVE } from "../../sim/src/sim/config";
import {
  flowerHeights,
  type BallKind,
  type Sim,
} from "../../sim/src/sim/world";

const COLOR: Record<BallKind, number> = {
  pollen: 0xf2c81e,
  nectar_red: 0xd8261c,
  nectar_blue: 0x1f4fd8,
};
export const CAMERAS = ["driver", "overhead", "chase"] as const;
export type CameraMode = (typeof CAMERAS)[number];

export class DrillView {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(52, 1, 0.05, 40);
  mode: CameraMode = "driver";
  private ballGeo = {
    pollen: new THREE.SphereGeometry(FIELD.pollenRadius, 16, 12),
    nectar: new THREE.SphereGeometry(FIELD.nectarRadius, 16, 12),
  };
  private ballMat = new Map<BallKind, THREE.Material>();
  private ballMeshes = new Map<number, THREE.Mesh>();
  private staticBalls = new THREE.Group();
  /** The Auto replay's pieces (a full match before 2:00), drawn in place of the simulator's. */
  private replayBalls = new THREE.Group();
  private staticKey = "";
  private hiveNodes: { red?: THREE.Object3D; blue?: THREE.Object3D } = {};
  private robots: RobotMesh[] = [];
  private frame: number;
  private chaseAngle: number | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private onProgress: (msg: string | null) => void,
    frameM: number,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene.background = new THREE.Color(0x14171c);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x30343c, 1.25));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-2, 6, 3);
    this.scene.add(sun);
    for (const k of Object.keys(COLOR) as BallKind[])
      this.ballMat.set(
        k,
        new THREE.MeshStandardMaterial({ color: COLOR[k], roughness: 0.45 }),
      );
    this.buildFloor();
    this.scene.add(this.staticBalls);
    this.scene.add(this.replayBalls);
    this.frame = frameM;
    this.loadField();
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  private resize() {
    const w = this.canvas.clientWidth || 1,
      h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private buildFloor() {
    const venue = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 1 }),
    );
    venue.rotation.x = -Math.PI / 2;
    venue.position.y = -0.016;
    this.scene.add(venue);
    const s = FIELD.half * 2;
    const tiles = new THREE.Mesh(
      new THREE.PlaneGeometry(s, s),
      new THREE.MeshStandardMaterial({ color: 0x4a4e55, roughness: 0.95 }),
    );
    tiles.rotation.x = -Math.PI / 2;
    tiles.position.y = -0.0005;
    this.scene.add(tiles);
    const pts: number[] = [];
    for (let i = 1; i < 6; i++) {
      const p = -FIELD.half + (i * s) / 6;
      pts.push(
        p,
        0.0002,
        -FIELD.half,
        p,
        0.0002,
        FIELD.half,
        -FIELD.half,
        0.0002,
        p,
        FIELD.half,
        0.0002,
        p,
      );
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    this.scene.add(
      new THREE.LineSegments(
        g,
        new THREE.LineBasicMaterial({ color: 0x34383f }),
      ),
    );
    // Without the CAD (still loading, or failed), plain walls, so the field is still a field.
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x8a9099,
      transparent: true,
      opacity: 0.25,
    });
    for (const sgn of [-1, 1]) {
      const a = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, FIELD.wallHeight, s),
        wallMat,
      );
      a.position.set(sgn * FIELD.half, FIELD.wallHeight / 2, 0);
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(s, FIELD.wallHeight, 0.02),
        wallMat,
      );
      b.position.set(0, FIELD.wallHeight / 2, sgn * FIELD.half);
      this.scene.add(a, b);
    }
  }

  private loadField() {
    this.onProgress("Loading the field…");
    new GLTFLoader().load(
      "field.glb",
      (gltf) => {
        gltf.scene.traverse((o) => {
          if (o.name === "hive_red") this.hiveNodes.red = o;
          if (o.name === "hive_blue") this.hiveNodes.blue = o;
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            if (!m.geometry.getAttribute("normal"))
              m.geometry.computeVertexNormals();
            const mat = m.material as THREE.MeshStandardMaterial;
            if (o.parent?.name === "perimeter" || o.name === "perimeter") {
              const c = mat.color;
              if (c.r > 0.4 && c.g > 0.4) {
                mat.transparent = true;
                mat.opacity = 0.22;
                mat.depthWrite = false;
              }
            }
          }
        });
        this.scene.add(gltf.scene);
        this.onProgress(null);
      },
      (e) => {
        if (e.total)
          this.onProgress(
            `Loading the field… ${Math.round((100 * e.loaded) / e.total)}%`,
          );
      },
      () => this.onProgress(null),
    );
    new GLTFLoader().load("balls.gltf", (gltf) => {
      for (const kind of ["pollen", "nectar"] as const) {
        const mesh = gltf.scene.getObjectByName(kind) as THREE.Mesh | undefined;
        if (!mesh?.isMesh) continue;
        if (!mesh.geometry.getAttribute("normal"))
          mesh.geometry.computeVertexNormals();
        const old = this.ballGeo[kind];
        this.ballGeo[kind] = mesh.geometry as THREE.SphereGeometry;
        this.scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh && m.geometry === old) m.geometry = mesh.geometry;
        });
      }
    });
  }

  /**
   * One robot: our robot's CAD (sim/src/render/mona-shores-robot.ts, the model AdvantageScope
   * shows), its turret and FLOWER stick moving, with a bumper strip in its team's colours (the CAD
   * is the same grey for both robots), the team number and the lane. Until the meshes load, and if
   * they never do, a box in the team's colours stands in.
   */
  private buildRobot(team: number): RobotMesh {
    const frame = this.frame,
      group = new THREE.Group(),
      colors = TEAM_COLORS[team] ?? { deep: 0x9c231d, bright: 0xd8261c };
    const chassis = new THREE.Mesh(
      new THREE.BoxGeometry(frame, 0.12, frame - 0.06),
      new THREE.MeshStandardMaterial({ color: colors.deep, roughness: 0.6 }),
    );
    chassis.position.y = 0.09;
    const intakeMat = new THREE.MeshStandardMaterial({
      color: 0x3ad17a,
      emissive: 0x0c4022,
    });
    const intake = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.05, frame * 0.86),
      intakeMat,
    );
    intake.position.set(frame / 2 + 0.01, 0.06, 0);
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.045, 0.12, 3),
      new THREE.MeshStandardMaterial({ color: 0xffffff }),
    );
    arrow.rotation.z = -Math.PI / 2;
    arrow.position.set(frame / 2 - 0.08, 0.16, 0);
    const wheelGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.038, 18);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x15171a });
    const wheels: THREE.Mesh[] = [];
    for (const [a, b] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.x = Math.PI / 2;
      w.position.set(a * frame * 0.36, 0.052, b * frame * 0.45);
      group.add(w);
      wheels.push(w);
    }
    // The turret: a disc with the launcher's barrel, behind and right of centre (TurretSubsystem).
    const turret = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.04, 24),
      new THREE.MeshStandardMaterial({ color: 0x2b2f36 }),
    );
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.06, 0.07),
      new THREE.MeshStandardMaterial({ color: colors.bright }),
    );
    barrel.position.set(0.08, 0.05, 0);
    turret.add(disc, barrel);
    turret.position.set(-3.33 * 0.0254, 0.18, 2.68 * 0.0254);
    // The team number on top, so two robots tell apart from any camera.
    const plate = document.createElement("canvas");
    plate.width = 256;
    plate.height = 96;
    const g = plate.getContext("2d");
    if (g) {
      g.fillStyle = `#${colors.bright.toString(16).padStart(6, "0")}`;
      g.fillRect(0, 0, 256, 96);
      g.fillStyle = "#fff";
      g.font = "800 72px ui-sans-serif, system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(team > 0 ? String(team) : "OPP", 128, 52);
    }
    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(plate) }),
    );
    label.scale.set(0.3, 0.11, 1);
    label.position.set(0, 0.42, 0);
    const lane = new THREE.Group();
    // The indicator lights (biobuzz IndicatorSubsystem): two goBILDA lights Y-cabled to the one
    // "indicator" servo port (DeviceNames.INDICATOR), so both show the same colour (the mentor,
    // 24 Nov 2026). One on the Limelight's post facing forward, one at the rear of the frame,
    // centred, facing back. Each a glowing lens with a halo, big enough to read at the drill's zoom.
    // In the CAD's robot frame (biobuzz cad/advantagescope, +X forward, +Z up) the Limelight 3A
    // spans X 0.068 to 0.112 m and Z 0.355 to 0.399 m, centred: the forward light sits on the post
    // just under it, at its front face. The rear light is at the CAD body's rear edge (X -0.192 m);
    // its height is not in the CAD, so mid-height, 0.20 m. Model (x, y, z) is local (x, z, -y).
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const haloMat = new THREE.SpriteMaterial({
      map: haloTexture(),
      color: 0xffffff,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const light = new THREE.Group();
    for (const [x, y] of LIGHT_SPOTS) {
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.028, 16, 12),
        lightMat,
      );
      const halo = new THREE.Sprite(haloMat);
      halo.scale.set(0.17, 0.17, 1);
      lamp.add(halo);
      lamp.position.set(x, y, 0);
      light.add(lamp);
    }
    light.visible = false;
    group.add(chassis, intake, arrow, turret, lane, label, light);
    this.scene.add(group);
    // Ours as the CAD (the box stays until it is in); an opponent stays a box. Once the CAD is in,
    // nothing is drawn over it: no bumper strip (ours have none) and no intake bar (the intake is
    // the simulator's mouth, not this box); the label names the robot.
    const box = [chassis, arrow, turret, intake, ...wheels];
    const model =
      team > 0 ? new MonaShoresRobotModel("robots/mona-shores/") : null;
    model?.ready
      .then(() => {
        group.add(model!.group);
        for (const o of box) o.visible = false;
        // The team's label clear above the body (the Limelight is its top).
        const top = new THREE.Box3().setFromObject(model!.group);
        if (Number.isFinite(top.max.y)) label.position.y = top.max.y + 0.12;
      })
      .catch(() => {
        /* the box stays */
      });
    const aimLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]),
      new THREE.LineBasicMaterial({
        color: 0x41e07f,
        transparent: true,
        opacity: 0.7,
      }),
    );
    aimLine.frustumCulled = false;
    this.scene.add(aimLine);
    return {
      team,
      group,
      turret,
      lane,
      laneKey: "",
      intakeMat,
      aimLine,
      model,
      light,
      lightMat,
      haloMat,
    };
  }

  /**
   * Draws the field. `robots` gives each of `sim.robots` its team and turret angle (deg, from the
   * robot's forward, + left); the chase camera follows the first.
   */
  /** Shows the replay's pieces (one pooled mesh each), and hides the simulator's while it runs. */
  private syncReplay(
    replay: { kind: BallKind; x: number; y: number; z: number }[] | null,
  ) {
    const on = !!replay;
    this.staticBalls.visible = !on;
    for (const m of this.ballMeshes.values()) m.visible = !on;
    this.replayBalls.visible = on;
    if (!replay) return;
    const pool = this.replayBalls.children as THREE.Mesh[];
    replay.forEach((q, i) => {
      let m = pool[i];
      if (!m) {
        m = new THREE.Mesh();
        this.replayBalls.add(m);
      }
      m.geometry =
        q.kind === "pollen" ? this.ballGeo.pollen : this.ballGeo.nectar;
      m.material = this.ballMat.get(q.kind)!;
      m.position.set(q.x, q.y, q.z);
      m.visible = true;
    });
    for (let i = replay.length; i < pool.length; i++) pool[i].visible = false;
  }

  sync(
    sim: Sim,
    robots: {
      team: number;
      turretDeg: number;
      aim?: boolean;
      /** The indicator light's colour now; null off, undefined: no light (not ours). */
      light?: LightColour | null;
    }[],
    showAim: boolean,
    /** The Auto replay's pieces: drawn instead of the simulator's balls and FLOWER stacks. */
    replay: { kind: BallKind; x: number; y: number; z: number }[] | null = null,
  ) {
    robots.forEach((r, i) => {
      if (!this.robots[i] || this.robots[i].team !== r.team) {
        if (this.robots[i])
          this.scene.remove(this.robots[i].group, this.robots[i].aimLine);
        this.robots[i] = this.buildRobot(r.team);
      }
      this.syncRobot(
        this.robots[i],
        sim.view(i),
        r.turretDeg,
        showAim && r.aim !== false,
      );
      const rm = this.robots[i];
      rm.light.visible = r.light !== undefined;
      if (r.light !== undefined) {
        // Off reads as a dark lens, not as nothing.
        rm.lightMat.color.set(r.light ? LIGHT_HEX[r.light] : 0x22252b);
        rm.haloMat.color.set(r.light ? LIGHT_HEX[r.light] : 0x000000);
        rm.haloMat.opacity = r.light ? 0.45 : 0;
      }
    });
    const p = sim.robot.translation();
    const seen = new Set<number>();
    for (const b of sim.balls.values()) {
      let m = this.ballMeshes.get(b.id);
      if (!m) {
        m = new THREE.Mesh(
          b.kind === "pollen" ? this.ballGeo.pollen : this.ballGeo.nectar,
          this.ballMat.get(b.kind),
        );
        this.ballMeshes.set(b.id, m);
        this.scene.add(m);
      }
      const t = b.body.translation(),
        q = b.body.rotation();
      m.position.set(t.x, t.y, t.z);
      m.quaternion.set(q.x, q.y, q.z, q.w);
      seen.add(b.id);
    }
    for (const [id, m] of this.ballMeshes)
      if (!seen.has(id)) {
        this.scene.remove(m);
        this.ballMeshes.delete(id);
      }
    const fkey = sim.flowers.map((f) => f.stack.join()).join("|");
    if (fkey !== this.staticKey) {
      this.staticKey = fkey;
      this.staticBalls.clear();
      for (const f of sim.flowers) {
        const hs = flowerHeights(f.stack);
        f.stack.forEach((k, i) => {
          const r = k === "pollen" ? FIELD.pollenRadius : FIELD.nectarRadius;
          const m = new THREE.Mesh(
            k === "pollen" ? this.ballGeo.pollen : this.ballGeo.nectar,
            this.ballMat.get(k),
          );
          m.position.set(f.x, hs[i] + r, f.z);
          this.staticBalls.add(m);
        });
      }
    }
    this.syncReplay(replay);
    if (this.hiveNodes.red)
      this.hiveNodes.red.rotation.x = sim.hives.red.phi + HIVE.tiltLimit;
    if (this.hiveNodes.blue)
      this.hiveNodes.blue.rotation.x = sim.hives.blue.phi - HIVE.tiltLimit;

    const side = sim.alliance === "red" ? -1 : 1;
    this.camera.up.set(0, 1, 0);
    if (this.mode === "driver") {
      // Standing behind our alliance wall, looking across the field.
      this.camera.fov = 55;
      this.camera.position.set(side * 3.3, 1.7, 0);
      this.camera.lookAt(side * -0.3, 0.2, 0);
    } else if (this.mode === "overhead") {
      this.camera.fov = 40;
      this.camera.position.set(0, 6.6, 0.001);
      this.camera.up.set(-side, 0, 0);
      this.camera.lookAt(0, 0, 0);
    } else {
      const hx = HIVE.pivotX[sim.alliance],
        dx = hx - p.x,
        dz = -p.z,
        want = Math.atan2(dz, dx);
      if (this.chaseAngle === null) this.chaseAngle = want;
      else if (Math.hypot(dx, dz) > 0.4)
        this.chaseAngle +=
          Math.atan2(
            Math.sin(want - this.chaseAngle),
            Math.cos(want - this.chaseAngle),
          ) * 0.08;
      const ux = Math.cos(this.chaseAngle),
        uz = Math.sin(this.chaseAngle);
      this.camera.fov = 70;
      this.camera.position.set(p.x - ux * 1.1, 0.95, p.z - uz * 1.1);
      this.camera.lookAt(p.x + ux * 0.8, 0.45, p.z + uz * 0.8);
    }
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }

  private syncRobot(
    r: RobotMesh,
    sim: Sim,
    turretDeg: number,
    showAim: boolean,
  ) {
    const p = sim.robot.translation(),
      th = sim.heading;
    r.group.position.set(p.x, 0, p.z);
    r.group.rotation.y = th;
    r.turret.rotation.y = (turretDeg * Math.PI) / 180;
    r.model?.setTurretDeg(turretDeg);
    r.model?.setStickOut(!!sim.robots[sim.me].stickDown);
    r.intakeMat.color.set(
      sim.carried.length >= sim.cfg.capacity ? 0xd1833a : 0x3ad17a,
    );
    const key = sim.carried.join();
    if (key !== r.laneKey) {
      r.laneKey = key;
      r.lane.clear();
      sim.carried.forEach((k, i) => {
        const m = new THREE.Mesh(
          k === "pollen" ? this.ballGeo.pollen : this.ballGeo.nectar,
          this.ballMat.get(k),
        );
        m.position.set(0.12 - i * 0.075, 0.19, -0.05);
        r.lane.add(m);
      });
    }
    r.aimLine.visible = showAim;
    if (showAim) {
      const a = th + (turretDeg * Math.PI) / 180,
        o = r.turret.getWorldPosition(new THREE.Vector3());
      const pos = r.aimLine.geometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      pos.setXYZ(0, o.x, 0.02, o.z);
      pos.setXYZ(1, o.x + Math.cos(a) * 1.2, 0.02, o.z - Math.sin(a) * 1.2);
      pos.needsUpdate = true;
    }
  }
}

interface RobotMesh {
  team: number;
  group: THREE.Group;
  turret: THREE.Group;
  lane: THREE.Group;
  laneKey: string;
  intakeMat: THREE.MeshStandardMaterial;
  aimLine: THREE.Line;
  /** Ours only: an opponent is drawn as a box. */
  model: MonaShoresRobotModel | null;
  /** Both indicator lights, which always show the same colour. */
  light: THREE.Group;
  lightMat: THREE.MeshBasicMaterial;
  haloMat: THREE.SpriteMaterial;
}

/**
 * Where the two indicator lights sit, in the robot group's frame (local X forward, Y up), metres:
 * on the Limelight's post facing forward, and at the rear of the frame, centred, facing back.
 */
export const LIGHT_SPOTS: readonly (readonly [number, number])[] = [
  [0.112 + 0.012, 0.355 - 0.03],
  [-0.192 - 0.012, 0.2],
];

/** A round, soft glow for the indicator light's halo (one texture, shared). */
let halo: THREE.Texture | null = null;
function haloTexture(): THREE.Texture | null {
  if (halo) return halo;
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  if (!g) return null;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.35, "rgba(255,255,255,0.55)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  halo = new THREE.CanvasTexture(c);
  return halo;
}

/** The indicator light's colours on screen (goBILDA's light: IndicatorSubsystem's named positions). */
const LIGHT_HEX: Record<LightColour, number> = {
  red: 0xff2a2a,
  green: 0x2bff5e,
  orange: 0xff8c1a,
  blue: 0x3a7bff,
  white: 0xffffff,
};

/** The teams' colours, as their printed cheat sheets (biobuzz `CheatSheet.Team`). */
const TEAM_COLORS: Record<number, { deep: number; bright: number }> = {
  19429: { deep: 0xb0101e, bright: 0xff6a00 },
  20245: { deep: 0x3a0ca3, bright: 0xb14eff },
  /** An opponent: the simulator's planner robot, a box in blue. */
  0: { deep: 0x123a8c, bright: 0x2f6bff },
};
