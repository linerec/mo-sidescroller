import * as THREE from 'three';
import { Entity } from '../engine/Entity.js';

/**
 * Collectible — 닿으면 인벤토리에 들어가는 아이템.
 *  itemId : story/items.js 의 키. 외형은 def.shape ('gem' | 'key' | 'orb') 로 결정.
 *  once   : true면 스토리 플래그(`got:${uid}`)를 남겨 재입장 시 다시 나타나지 않음 (uid 필요)
 */
export class Collectible extends Entity {
  constructor({ x, y, itemId, count = 1, uid = null, once = true } = {}) {
    super({ name: `item:${itemId}`, x, y, tags: ['item'] });
    this.itemId = itemId; this.count = count; this.uid = uid; this.once = once;
    this.setBody({ w: 0.7, h: 0.7, type: 'sensor' });
    this._collected = false;
  }

  onSpawn() {
    if (this.once && this.uid && this.game.story.has(`got:${this.uid}`)) { this.destroy(); return; }
    const def = this.game.inventory.def(this.itemId);
    const color = new THREE.Color(def.color || '#7ec8e3');
    this.mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.2 });
    let m;
    if (def.shape === 'key') {
      m = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 8, 16), this.mat);
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), this.mat); shaft.position.y = -0.4;
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.1), this.mat); tooth.position.set(0.1, -0.58, 0);
      m.add(ring, shaft, tooth); m.position.y = 0.2;
    } else if (def.shape === 'orb') m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), this.mat);
    else m = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), this.mat);
    m.traverse?.((o) => { if (o.isMesh) o.castShadow = true; });
    this.mesh = m; this.object.add(m);
    const light = new THREE.PointLight(color, 1.2, 4); light.position.z = 0.6; this.object.add(light);
  }

  update(dt) {
    if (!this.mesh) return;
    const t = this.stage.time;
    this.mesh.rotation.y = t * 1.8;
    this.mesh.position.y = Math.sin(t * 2.5 + this.x) * 0.15;
    super.update(dt);
  }

  onOverlap(other) {
    if (this._collected || !other?.tags?.has('player')) return;
    this._collected = true;
    const g = this.game, def = g.inventory.def(this.itemId);
    g.inventory.add(this.itemId, this.count);
    if (this.once && this.uid) g.story.set(`got:${this.uid}`);
    g.audio.play('collect');
    g.hud.toast(`${def.icon} ${def.name} 획득`);
    g.events.emit('item:collected', { itemId: this.itemId, count: this.count, uid: this.uid, entity: this });
    g.tweens.to(this.mesh.scale, { x: 0.01, y: 0.01, z: 0.01 }, 0.18).then(() => this.destroy());
    g.tweens.to(this.mesh.position, { y: this.mesh.position.y + 1 }, 0.18);
  }
}
