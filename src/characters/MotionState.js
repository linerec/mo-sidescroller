/** Gameplay-clock motion arbitration, independent of the renderer and asset loading. */
export class MotionState {
  constructor(motions) { this.motions = motions; this.name = 'idle'; this.time = 0; this.serial = 0; }
  get spec() { return this.motions[this.name]; }
  get busy() { return !this.spec.loop && (this.spec.hold || this.time < this.spec.duration); }
  play(name, { force = false } = {}) {
    if (!this.motions[name]) throw new Error(`Missing motion: ${name}`);
    if (!force && this.busy && (this.spec.priority || 0) > (this.motions[name].priority || 0)) return false;
    this.name = name; this.time = 0; this.serial++; return true;
  }
  update(dt, base = 'idle') {
    this.time += dt;
    if (!this.spec.loop && !this.spec.hold && this.time >= this.spec.duration) {
      this.play(this.spec.next || base, { force: true });
    } else if (this.spec.loop && this.name !== base) this.play(base, { force: true });
  }
}
