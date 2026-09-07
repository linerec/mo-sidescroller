import * as THREE from 'three';

/**
 * Debug — ` 키로 토글. FPS/상태/플레이어/플래그 표시 + 충돌 박스 와이어프레임.
 * 단축키: Shift+N 다음 스테이지 / Shift+R 세이브 초기화 후 새로고침 / Shift+H 체력 회복
 */
export class Debug {
  enabled = false;

  constructor(game, root) {
    this.game = game;
    this.el = document.createElement('div'); this.el.id = 'debug'; this.el.classList.add('hidden');
    root.appendChild(this.el);
    this.wire = new THREE.Group(); this.wire.visible = false;
    game.scene.add(this.wire);
    this._boxes = new Map();
    this._fps = 0; this._t = 0; this._frames = 0;
  }

  toggle() { this.enabled = !this.enabled; this.el.classList.toggle('hidden', !this.enabled); this.wire.visible = this.enabled; }

  update(dt) {
    const g = this.game, inp = g.input;
    if (inp.pressedRaw('debug')) this.toggle();
    if (inp.downRaw('debug') === false && this.enabled) {
      // Shift 조합 단축키
    }
    this._t += dt; this._frames++;
    if (this._t >= 0.5) { this._fps = Math.round(this._frames / this._t); this._t = 0; this._frames = 0; }
    if (!this.enabled) return;

    const p = g.stage?.player;
    const flags = Object.entries(g.story.flags).map(([k, v]) => `${k}=${v}`).join('  ');
    this.el.textContent =
      `fps ${this._fps} | state ${g.state} | stage ${g.stage?.id ?? '-'} | bodies ${g.physics.bodies.length}\n` +
      (p ? `player x ${p.x.toFixed(2)} y ${p.y.toFixed(2)} vx ${p.body.vx.toFixed(1)} vy ${p.body.vy.toFixed(1)} ground ${p.body.onGround} hp ${p.hp}\n` : '') +
      `flags: ${flags || '(none)'}\n` +
      `[Shift+N] 다음 스테이지  [Shift+R] 세이브 초기화  [Shift+H] 회복`;
    this.#syncWire();
  }

  #syncWire() {
    const seen = new Set();
    for (const b of this.game.physics.bodies) {
      seen.add(b);
      let m = this._boxes.get(b);
      if (!m) {
        const color = b.type === 'static' ? 0x44ff88 : b.type === 'sensor' ? 0xffdd44 : b.type === 'kinematic' ? 0x44ddff : 0xff5577;
        m = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 0.01)), new THREE.LineBasicMaterial({ color, depthTest: false }));
        m.renderOrder = 999;
        this.wire.add(m); this._boxes.set(b, m);
      }
      m.position.set(b.x, b.y, 0.6); m.scale.set(b.w, b.h, 1); m.visible = b.enabled;
    }
    for (const [b, m] of this._boxes) if (!seen.has(b)) { this.wire.remove(m); m.geometry.dispose(); m.material.dispose(); this._boxes.delete(b); }
  }

  /** Game 이 keydown 에서 호출 */
  hotkey(e) {
    const g = this.game;
    if (!e.shiftKey) return false;
    if (e.code === 'KeyN' && g.stage) { g.stage.complete(); return true; }
    if (e.code === 'KeyR') { g.save.clear(); location.reload(); return true; }
    if (e.code === 'KeyH' && g.stage?.player) { g.stage.player.heal(99); return true; }
    return false;
  }
}
