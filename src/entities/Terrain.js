import * as THREE from 'three';
import { Entity } from '../engine/Entity.js';

const blockMat = new Map();
function mat(color, roughness = 0.95) {
  const k = `${color}:${roughness}`;
  if (!blockMat.has(k)) blockMat.set(k, new THREE.MeshStandardMaterial({ color, roughness }));
  return blockMat.get(k);
}

/** Block — 단단한 지형 박스. depth 로 3D 두께를 준다. */
export class Block extends Entity {
  constructor({ x, y, w = 1, h = 1, depth = 4, color = 0x3b4652, topColor = 0x56657a, name = 'block', visual = true } = {}) {
    super({ name, x, y, tags: ['terrain'] });
    this.setBody({ w, h, type: 'static' });
    if (!visual) return;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), mat(color));
    body.position.z = -depth / 2 + 0.6;
    body.castShadow = true; body.receiveShadow = true;
    // 윗면 살짝 밝은 판 → 발판 가독성
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, depth), mat(topColor));
    top.position.set(0, h / 2 + 0.04, -depth / 2 + 0.6); top.receiveShadow = true;
    this.object.add(body, top);
  }
  disposeObject() { /* 공유 머티리얼이므로 지오메트리만 정리 */ this.object.traverse((o) => o.geometry?.dispose?.()); }
}

/** OneWayPlatform — 아래에서 뛰어 올라올 수 있는 얇은 발판 (↓+점프로 내려감) */
export class OneWayPlatform extends Entity {
  constructor({ x, y, w = 3, h = 0.3, color = 0x7a6a55, visual = true } = {}) {
    super({ name: 'oneway', x, y, tags: ['terrain'] });
    this.setBody({ w, h, type: 'static', oneWay: true });
    if (!visual) return;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.4), mat(color, 0.8));
    m.castShadow = true; m.receiveShadow = true;
    this.object.add(m);
  }
}

/** MovingPlatform — 두 지점을 왕복하는 이동 발판 */
export class MovingPlatform extends Entity {
  constructor({ x, y, w = 3, h = 0.5, to, speed = 2, pause = 0.6, color = 0x8a7a60, visual = true } = {}) {
    super({ name: 'moving-platform', x, y, tags: ['terrain'] });
    this.from = { x, y }; this.to = to; this.speed = speed; this.pause = pause;
    this._dir = 1; this._wait = 0;
    this.setBody({ w, h, type: 'kinematic' });
    if (!visual) return;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.6), mat(color, 0.7));
    m.castShadow = true; m.receiveShadow = true;
    this.object.add(m);
  }
  update(dt) {
    const b = this.body;
    if (this._wait > 0) { this._wait -= dt; b.vx = b.vy = 0; }
    else {
      const tgt = this._dir > 0 ? this.to : this.from;
      const dx = tgt.x - b.x, dy = tgt.y - b.y, d = Math.hypot(dx, dy);
      if (d < this.speed * dt) { b.vx = dx / dt; b.vy = dy / dt; this._dir *= -1; this._wait = this.pause; }
      else { b.vx = dx / d * this.speed; b.vy = dy / d * this.speed; }
    }
    super.update(dt);
  }
}

/** Hazard — 닿으면 피해 + 체크포인트 복귀. kind: 'spikes' | 'pit'(보이지 않음) */
export class Hazard extends Entity {
  constructor({ x, y, w = 2, h = 0.6, kind = 'spikes', damage = 1 } = {}) {
    super({ name: 'hazard', x, y, tags: ['hazard'] });
    this.damage = damage; this.kind = kind;
    this.setBody({ w, h: h * 0.7, type: 'sensor' });
    if (kind === 'spikes') {
      const m = new THREE.MeshStandardMaterial({ color: 0xb8b2a8, roughness: 0.5, metalness: 0.4 });
      const n = Math.max(1, Math.round(w / 0.5));
      for (let i = 0; i < n; i++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.22, h, 6), m);
        c.position.set(-w / 2 + 0.25 + i * 0.5, 0, 0); c.castShadow = true; this.object.add(c);
      }
    }
  }
  onOverlap(other) {
    if (!other?.tags?.has('player') || other.state === 'dead') return;
    if (this.kind === 'pit') other.fallOut();            // 낙사: 체력 -1 후 체크포인트 복귀
    else other.takeDamage(this.damage, this.x);          // 가시: 피해 + 넉백
  }
}
