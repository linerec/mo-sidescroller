import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MotionState } from './MotionState.js';

export class CharacterVisual {
  constructor(def) {
    this.def = def; this.object = new THREE.Group(); this.motion = new MotionState(def.motions);
    this.object.name = `character:${def.id}`;
    this.disposed = false; this._serial = -1; this.error = null;
    // Visible only while loading or on a reported asset failure.
    this.placeholder = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf3e5ca }));
    this.placeholder.scale.set(1.3, 1, 1); this.placeholder.position.y = 0.5;
    this.object.add(this.placeholder);
    this.ready = this.load();
  }
  async load() {
    let gltf;
    try {
      gltf = await new GLTFLoader().loadAsync(this.def.model);
      if (this.disposed) { disposeTree(gltf.scene); return false; }
      const clips = new Map(gltf.animations.map(c => [c.name, c]));
      for (const [name, spec] of Object.entries(this.def.motions)) {
        const clip = clips.get(name);
        if (!clip || Math.abs(clip.duration - spec.duration) > 0.05) throw new Error(`Invalid clip ${name}: expected ${spec.duration}s`);
      }
      this.model = gltf.scene; this.model.scale.setScalar(this.def.scale);
      this.model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
      this.mixer = new THREE.AnimationMixer(this.model);
      this.actions = new Map([...clips].map(([name, clip]) => [name, this.mixer.clipAction(clip)]));
      this.object.remove(this.placeholder); disposeTree(this.placeholder);
      this.object.add(this.model); this.syncAction(); this.mixer.update(0);
      return true;
    } catch (error) {
      if (gltf && !this.model) disposeTree(gltf.scene);
      this.error = error; console.error(`[Character ${this.def.id}]`, error); return false;
    }
  }
  play(name, options) { return this.motion.play(name, options); }
  syncAction() {
    if (!this.mixer || this._serial === this.motion.serial) return;
    const next = this.actions.get(this.motion.name), spec = this.motion.spec;
    const prev = this.current;
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);
    next.setLoop(spec.loop ? THREE.LoopRepeat : THREE.LoopOnce, spec.loop ? Infinity : 1);
    next.clampWhenFinished = !spec.loop; next.play();
    if (prev && prev !== next) { prev.fadeOut(0.08); next.fadeIn(0.08); }
    this.current = next; this._serial = this.motion.serial;
  }
  update(dt, base = 'idle', facing = 1) {
    this.motion.update(dt, base); this.syncAction(); this.mixer?.update(dt);
    // Both directions keep the face visible to the side-scroller camera.
    const target = facing * this.def.facingAngle;
    this.object.rotation.y += (target - this.object.rotation.y) * Math.min(1, dt * 14);
  }
  reset() { this.motion.play('idle', { force: true }); this.object.visible = true; }
  dispose() {
    this.disposed = true;
    this.mixer?.stopAllAction();
    if (this.model) this.mixer.uncacheRoot(this.model);
    // Entity.disposeObject owns loaded meshes; late loads are disposed in load().
  }
}

function disposeTree(root) {
  root.traverse(o => { o.geometry?.dispose(); for (const m of [].concat(o.material || [])) m.dispose(); });
}
