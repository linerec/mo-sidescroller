import * as THREE from 'three';
import { Ease } from './Tween.js';

/**
 * FollowCamera — 횡스크롤 추적 카메라.
 * 원근 카메라를 z=distance 에 두고 게임 평면(z=0)을 바라본다 → 배경/전경 레이어가 자연스럽게 시차(parallax)를 가짐.
 * 모드: follow(대상 추적) | fixed(고정) | pan(연출 이동 중)
 */
export class FollowCamera {
  constructor(aspect, game) {
    this.game = game;
    this.cam = new THREE.PerspectiveCamera(50, aspect, 0.1, 300);
    this.distance = 18;     // 평면까지 거리 (줌)
    this.offsetY = 3.0;     // 대상보다 살짝 위를 봄
    this.lookAhead = 2.5;   // 진행 방향 앞을 미리 보여줌
    this.smooth = 5;        // 추적 부드러움 (클수록 빠름)
    this.target = null; this.mode = 'follow';
    this.x = 0; this.y = 0;             // 현재 시점 중심
    this.bounds = null;                 // { minX, maxX, minY, maxY } — 스테이지 경계
    this.shakeT = 0; this.shakeStrength = 0;
  }

  get aspect() { return this.cam.aspect; }
  /** 현재 거리에서 보이는 반폭/반높이 (경계 클램프용) */
  get halfH() { return this.distance * Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2)); }
  get halfW() { return this.halfH * this.cam.aspect; }

  follow(entity, snap = false) {
    this.target = entity; this.mode = 'follow';
    if (snap && entity) { this.x = entity.x; this.y = entity.y; this.#apply(); }
  }
  setBounds(b) { this.bounds = b; }
  resize(aspect) { this.cam.aspect = aspect; this.cam.updateProjectionMatrix(); }

  /** 연출: (x, y)로 카메라를 이동. 이후 follow() 호출 전까지 그 자리에 고정 */
  async panTo(x, y, duration = 1, ease = Ease.inOutCubic) {
    this.mode = 'pan';
    await this.game.tweens.to(this, { x, y }, duration, { ease });
    this.mode = 'fixed';
  }
  /** 연출: 엔티티로 부드럽게 복귀 후 다시 추적 */
  async panBack(duration = 0.8) {
    if (!this.target) return;
    await this.panTo(this.target.x, this.target.y, duration);
    this.mode = 'follow';
  }
  async zoomTo(distance, duration = 1) { await this.game.tweens.to(this, { distance }, duration, { ease: Ease.inOutQuad }); }
  shake(strength = 0.3, duration = 0.3) { this.shakeStrength = strength; this.shakeT = duration; }

  update(dt) {
    if (this.mode === 'follow' && this.target) {
      const facing = this.target.facing ?? 0;
      const tx = this.target.x + facing * this.lookAhead;
      const ty = this.target.y;
      const k = 1 - Math.exp(-this.smooth * dt);
      this.x += (tx - this.x) * k;
      this.y += (ty - this.y) * k * 0.8;
    }
    if (this.shakeT > 0) this.shakeT -= dt;
    this.#apply();
  }

  #apply() {
    let x = this.x, y = this.y + this.offsetY;
    if (this.bounds) {
      const b = this.bounds, hw = this.halfW, hh = this.halfH;
      if (b.minX !== undefined) x = Math.max(x, b.minX + hw);
      if (b.maxX !== undefined) x = Math.min(x, b.maxX - hw);
      if (b.maxX !== undefined && b.minX !== undefined && b.maxX - b.minX < hw * 2) x = (b.minX + b.maxX) / 2;
      if (b.minY !== undefined) y = Math.max(y, b.minY + hh);
      if (b.maxY !== undefined) y = Math.min(y, b.maxY - hh);
    }
    let sx = 0, sy = 0;
    if (this.shakeT > 0) { sx = (Math.random() - 0.5) * this.shakeStrength; sy = (Math.random() - 0.5) * this.shakeStrength; }
    this.cam.position.set(x + sx, y + sy, this.distance);
    this.cam.lookAt(x + sx, y + sy, 0);
  }

  /** 월드 좌표 → 화면 픽셀 (HUD 프롬프트 배치용) */
  project(x, y, z, width, height) {
    const v = new THREE.Vector3(x, y, z).project(this.cam);
    return { x: (v.x + 1) / 2 * width, y: (1 - v.y) / 2 * height, visible: v.z < 1 };
  }
}
