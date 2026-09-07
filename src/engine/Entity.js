import * as THREE from 'three';
import { Body } from './Physics.js';

/**
 * Entity — 스테이지에 놓이는 모든 것의 기본 클래스 (플레이어, 적, NPC, 아이템, 지형, 트리거...).
 *  - object : THREE.Group. 시각 표현은 이 안에 자식으로 넣는다.
 *  - body   : 물리 바디(선택). 있으면 매 프레임 object 위치가 body를 따라간다.
 * 라이프사이클: constructor → (stage.add) onSpawn → update(dt)... → destroy → onDestroy
 */
export class Entity {
  constructor({ name = 'entity', x = 0, y = 0, z = 0, tags = [] } = {}) {
    this.name = name;
    this.object = new THREE.Group();
    this.object.position.set(x, y, z);
    this.z = z;                       // 게임플레이 평면은 z=0. 장식은 음수(뒤) / 양수(앞)
    this.body = null;
    this.stage = null; this.game = null;
    this.alive = true;
    this.tags = new Set(tags);
    this.interactable = false;        // true면 플레이어가 근처에서 E로 상호작용 가능
    this.prompt = '';                 // 상호작용 안내 문구 (예: '대화')
    this.interactRange = 1.6;
  }

  /** 물리 바디 생성. 위치는 object 위치를 기본으로 사용 */
  setBody(opts = {}) {
    this.body = new Body({ x: this.object.position.x, y: this.object.position.y, owner: this, ...opts });
    if (this.stage) this.game.physics.add(this.body);
    return this.body;
  }

  get x() { return this.body ? this.body.x : this.object.position.x; }
  get y() { return this.body ? this.body.y : this.object.position.y; }
  setPosition(x, y) {
    if (this.body) { this.body.x = x; this.body.y = y; }
    this.object.position.set(x, y, this.z);
  }

  /** 스테이지에 추가된 직후 (this.game / this.stage 사용 가능) */
  onSpawn() {}

  /** 매 고정 스텝. 오버라이드 시 super.update(dt) 호출로 위치 동기화 유지 */
  update(dt) { this.syncObject(); }

  syncObject() {
    if (this.body) { this.object.position.x = this.body.x; this.object.position.y = this.body.y; }
  }

  /** 다른 dynamic/sensor 바디와 겹칠 때 (Physics가 호출) */
  onOverlap(other, otherBody) {}

  /** 플레이어가 E키로 상호작용. 처리했으면 true */
  interact(player) { return false; }

  /** 플레이어와의 거리(상호작용 판정용) */
  distanceTo(e) { return Math.hypot(this.x - e.x, this.y - e.y); }

  destroy() {
    if (!this.alive) return;
    this.alive = false;
    this.stage?.remove(this);
  }
  onDestroy() {}

  /** 메시 리소스 정리 */
  disposeObject() {
    this.object.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
      if (o.userData.sharedKit) { if(o.userData.ownedKitMaterial)o.material.dispose(); return; }
      o.geometry?.dispose?.();
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
      else o.material?.dispose?.();
    });
  }
}
