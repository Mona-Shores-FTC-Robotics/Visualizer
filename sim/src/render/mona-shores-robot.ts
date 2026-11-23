// Mona Shores: our robot as its Onshape CAD draws it, for the sim's and the drill's three.js views. The model is the one
// AdvantageScope shows in a match log (biobuzz cad/advantagescope/Robot_BIOBUZZ, built by from_onshape.py), copied to
// sim/public/robots/mona-shores/: model.glb (the body), model_0.glb (the turret), model_1.glb (the FLOWER stick), and
// components.json (each moving part's axis). Copy all four again after a rebuild there.
//
// Frames. The model is in AdvantageScope's robot frame: metres, +X forward, +Y left, +Z up, origin on the floor under
// the middle of the drive axles. A sim robot's group is three.js, Y up, with local +X forward and local -Z to the left
// (the sim's forward is (cos h, -sin h) in world X, Z for heading h, which a rotation.y of h gives local +X). So a model
// point (x, y, z) goes to local (x, z, -y): one fixed rotation, -90 degrees about X.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface Component { index: number; name: string; axis_point_m: [number, number, number]; axis_direction: [number, number, number]; drawn_at_deg: number }

/** The FLOWER stick's swing out, degrees (biobuzz FlowerStickSubsystem.swingDegrees(); cad/advantagescope/README). */
export const STICK_OUT_DEG = 162;

/** One of our robots, built from the CAD. Add `group` to a robot's group; call setTurretDeg and setStickOut each frame. */
export class MonaShoresRobotModel {
  readonly group = new THREE.Group();
  private turret = new THREE.Group(); private stick = new THREE.Group();
  private turretAxis = new THREE.Vector3(0, 0, 1); private stickAxis = new THREE.Vector3(0, 1, 0);
  private turretDrawnAt = 0; private stickDrawnAt = 0;
  /** Resolves once all three meshes are in; until then the group is empty. */
  readonly ready: Promise<void>;

  /** `baseUrl` ends with a slash and holds the four files, e.g. `${import.meta.env.BASE_URL}robots/mona-shores/`. */
  constructor(baseUrl: string) {
    // model frame -> the robot group's local frame (Y up, +X forward, -Z left)
    const frame = new THREE.Group(); frame.rotation.x = -Math.PI / 2; this.group.add(frame);
    this.ready = (async () => {
      const comps: { components: Component[] } = await (await fetch(`${baseUrl}components.json`)).json();
      const load = (f: string) => new GLTFLoader().loadAsync(`${baseUrl}${f}`).then(g => g.scene);
      const [body, turret, stick] = await Promise.all([load('model.glb'), load('model_0.glb'), load('model_1.glb')]);
      // The CAD's thinned meshes have faces wound both ways: draw both sides, or they show as black holes.
      for (const o of [body, turret, stick]) o.traverse(m => { const mm = (m as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined; if (mm) for (const x of Array.isArray(mm) ? mm : [mm]) x.side = THREE.DoubleSide; });
      frame.add(body);
      const pivot = (holder: THREE.Group, mesh: THREE.Object3D, c: Component) => {
        // The holder sits on the axis; the mesh is moved back so it turns about that point.
        holder.position.set(...c.axis_point_m); mesh.position.set(-c.axis_point_m[0], -c.axis_point_m[1], -c.axis_point_m[2]);
        holder.add(mesh); frame.add(holder);
        return new THREE.Vector3(...c.axis_direction).normalize();
      };
      const t = comps.components.find(c => c.name === 'turret')!, s = comps.components.find(c => c.name === 'flower stick')!;
      this.turretAxis = pivot(this.turret, turret, t); this.turretDrawnAt = t.drawn_at_deg;
      this.stickAxis = pivot(this.stick, stick, s); this.stickDrawnAt = s.drawn_at_deg;
      this.setTurretDeg(0); this.setStickOut(false);
    })();
  }
  /** The turret's angle, degrees counter-clockwise from home (the nose), as TurretSubsystem.angleDegrees() reports it. */
  setTurretDeg(deg: number) { this.turret.quaternion.setFromAxisAngle(this.turretAxis, THREE.MathUtils.degToRad(deg - this.turretDrawnAt)); }
  /** The FLOWER stick out (162 degrees, its top shaft on the tile) or in (stowed), or an angle between. */
  setStickOut(out: boolean | number) {
    const deg = typeof out === 'number' ? out : out ? STICK_OUT_DEG : 0;
    this.stick.quaternion.setFromAxisAngle(this.stickAxis, THREE.MathUtils.degToRad(deg - this.stickDrawnAt));
  }
}
