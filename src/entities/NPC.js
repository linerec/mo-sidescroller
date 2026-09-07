import * as THREE from 'three';
import { Entity } from '../engine/Entity.js';

/**
 * NPC — 말을 걸 수 있는 인물. (임시 형태: Player와 같은 실루엣, 색만 다름)
 *  dialogue : 대화 id | 대화 데이터 | (npc, player) => id   ← 플래그에 따라 다른 대화를 돌려줄 수 있음
 *  onInteract(player, npc) : 대화 대신 커스텀 로직
 */
export class NPC extends Entity {
  constructor({ name = 'npc', x, y, color = 0xc8b48a, cloth = 0x4d4238, height = 1.5, dialogue = null, onInteract = null, prompt = '대화', facing = -1, gravity = true } = {}) {
    super({ name, x, y, tags: ['npc'] });
    this.dialogue = dialogue; this.onInteract = onInteract;
    this.interactable = true; this.prompt = prompt; this.facing = facing;
    this.talking = false; this._auto = null;
    this.setBody({ w: 0.7, h: height, type: 'dynamic', gravity });
    this.#buildMesh(color, cloth, height);
  }

  #buildMesh(color, cloth, height) {
    const skin = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
    const clothM = new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.95 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    this.rig = new THREE.Group();
    const s = height / 1.5;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62 * s, 0.8 * s, 0.45 * s), clothM); torso.position.y = -0.22 * s;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.31 * s, 20, 16), skin); head.position.y = 0.44 * s;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.3 * s, 0.4 * s), dark); legs.position.y = -0.62 * s;
    this.eyes = new THREE.Group();
    for (const dz of [-0.1, 0.1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.04 * s, 8, 8), dark); e.position.set(0.27 * s, 0.47 * s, dz * s); this.eyes.add(e); }
    this.rig.add(torso, head, legs, this.eyes);
    this.rig.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.object.add(this.rig);
  }

  setFacing(dir) { if (dir) this.facing = dir; }
  faceToward(e) { this.setFacing(Math.sign(e.x - this.x) || this.facing); }
  walkTo(x, speed = 3) { return new Promise((resolve) => { this._auto = { x, speed, resolve }; }); }

  async interact(player) {
    if (this.talking) return true;
    this.talking = true;
    this.faceToward(player); player.setFacing(Math.sign(this.x - player.x));
    try {
      if (this.onInteract) await this.onInteract(player, this);
      else if (this.dialogue) {
        const d = typeof this.dialogue === 'function' ? this.dialogue(this, player) : this.dialogue;
        if (d) await this.game.dialogue.play(d);
      }
    } finally { this.talking = false; }
    return true;
  }

  update(dt) {
    const b = this.body;
    if (this._auto) {
      const d = this._auto.x - b.x;
      if (Math.abs(d) < 0.08) { b.vx = 0; const r = this._auto.resolve; this._auto = null; r(); }
      else { b.vx = Math.sign(d) * this._auto.speed; this.facing = Math.sign(d); }
    } else b.vx = 0;
    const target = this.frontFacing ? this.facing * .35 : this.facing > 0 ? 0 : Math.PI;
    this.rig.rotation.y += (target - this.rig.rotation.y) * Math.min(1, 12 * dt);
    this.rig.position.y = Math.sin(this.stage.time * 2.2 + this.x) * 0.02;   // 숨쉬기
    super.update(dt);
  }
}
