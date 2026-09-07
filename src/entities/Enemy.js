import * as THREE from 'three';
import { Entity } from '../engine/Entity.js';
import { Ease } from '../engine/Tween.js';

/**
 * Enemy — 적 기본 클래스. 순찰 AI + 접촉 피해 + 밟기/공격으로 처치.
 * 보스/특수 적은 이 클래스를 상속해 update()/takeDamage()/onDeath() 를 오버라이드한다.
 *  patrol: { minX, maxX } 범위 순찰 (없으면 벽/낭떠러지에서만 방향 전환)
 */
export class Enemy extends Entity {
  constructor({ name = 'enemy', x, y, w = 0.9, h = 0.8, hp = 1, speed = 1.8, damage = 1, patrol = null, stompable = true, color = 0x11343c, dir = -1 } = {}) {
    super({ name, x, y, tags: ['enemy'] });
    this.hp = hp; this.maxHp = hp; this.speed = speed; this.damage = damage;
    this.patrol = patrol; this.stompable = stompable; this.dir = dir;
    this.dead = false; this._flash = 0; this._hitCd = 0;
    this.setBody({ w, h, type: 'dynamic' });
    this.buildMesh(color, w, h);
  }

  /** 오버라이드하여 외형 변경 (기본: 눈 달린 슬라임) */
  buildMesh(color, w, h) {
    this.rig = new THREE.Group();
    this.mat = new THREE.MeshStandardMaterial({ color, roughness: 1.0 });
    const bodyM = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), this.mat);
    bodyM.scale.set(w, h, w * 0.9); bodyM.castShadow = true; bodyM.receiveShadow = true;
    const eyeW = new THREE.MeshStandardMaterial({ color: 0xbac8a2, emissive: 0x526c33, emissiveIntensity: .5 }), eyeB = new THREE.MeshStandardMaterial({ color: 0x111111 });
    for (const dz of [-0.15, 0.15]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), eyeW); e.position.set(dz * w, 0.1 * h, 0.40 * w);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), eyeB); p.position.set(0, 0, 0.08); e.add(p);
      this.rig.add(e);
    }
    this.rig.add(bodyM);
    this.object.add(this.rig);
  }

  update(dt) {
    if (this.dead) { super.update(dt); return; }
    const b = this.body, ph = this.game.physics;
    this._hitCd = Math.max(0, this._hitCd - dt);
    // 순찰: 범위 밖 / 벽 / 낭떠러지 → 반전
    if (this.patrol && (b.x < this.patrol.minX && this.dir < 0 || b.x > this.patrol.maxX && this.dir > 0)) this.dir *= -1;
    else if (this.dir < 0 && b.blockedLeft || this.dir > 0 && b.blockedRight) this.dir *= -1;
    else if (b.onGround && !ph.groundBelow(b.x + this.dir * (b.hw + 0.15), b.bottom)) this.dir *= -1;
    b.vx = this.dir * this.speed;
    // 외형
    const target = this.dir * .45;
    this.rig.rotation.y += (target - this.rig.rotation.y) * Math.min(1, 10 * dt);
    const wob = 1 + Math.sin(this.stage.time * 8 + this.x) * 0.06;
    this.rig.scale.set(1 / wob, wob, 1);
    if (this._flash > 0) { this._flash -= dt; this.mat.emissive.setHex(0xff4444); this.mat.emissiveIntensity = this._flash * 6; } else { this.mat.emissive.setHex(0x16444c); this.mat.emissiveIntensity = .18; }
    super.update(dt);
  }

  onOverlap(other) {
    if (this.dead || !other?.tags?.has('player') || other.state === 'dead') return;
    const p = other, pb = p.body, b = this.body;
    const fromAbove = pb.vy < -0.5 && pb.bottom > b.top - b.hh * 0.9;
    if (this.stompable && fromAbove) { p.bounce(); this.game.audio.play('stomp'); this.takeDamage(1, p, 'stomp'); }
    else if (this._hitCd <= 0) { if (p.takeDamage(this.damage, b.x)) this._hitCd = 0.5; }
  }

  takeDamage(n = 1, source = null, kind = 'attack') {
    if (this.dead) return;
    this.hp -= n; this._flash = 0.25;
    if (source?.body && kind === 'attack') { this.body.vx = Math.sign(this.body.x - source.body.x) * 6; this.body.vy = 4; }
    this.game.events.emit('enemy:hit', { enemy: this, hp: this.hp, kind });
    if (this.hp <= 0) this.die(kind);
  }

  async die(kind) {
    this.dead = true; this.body.enabled = false;
    this.game.events.emit('enemy:died', { enemy: this, name: this.name, kind });
    this.onDeath?.(kind);
    await this.game.tweens.to(this.rig.scale, { x: 1.4, y: 0.05, z: 1.4 }, 0.25, { ease: Ease.outQuad });
    this.destroy();
  }
}

/** 예시 변형: 빠르고 체력이 있는 적 */
export class Beetle extends Enemy {
  constructor(opts) { super({ hp: 2, speed: 2.8, color: 0x3b2636, w: 1.0, h: 0.7, stompable: false, ...opts }); }
}
