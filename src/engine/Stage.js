import * as THREE from 'three';
import { Player } from '../entities/Player.js';

/**
 * Stage — 하나의 "스테이지(레벨)". 서브클래스에서 build()/onEnter()/onUpdate()를 오버라이드한다.
 *
 * static meta = { id, title, subtitle, chapter }  ← StageManager/타이틀카드가 사용
 * static env  = { sky, fog: { near, far }, sun }  ← 조명/안개 분위기 (선택)
 *
 * 라이프사이클 (StageManager가 호출):
 *   new Stage(game) → build() → (페이드인, 타이틀카드) → onEnter() → onUpdate(dt)... → onExit() → dispose()
 * 클리어: 어디서든 this.complete() 를 호출하면 다음 스테이지로 진행된다.
 */
export class Stage {
  static meta = { id: 'stage', title: '이름 없는 스테이지', subtitle: '', chapter: null };
  static env = {};

  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();       // 이 스테이지의 모든 3D 오브젝트
    this.entities = [];
    this.bounds = { minX: -5, maxX: 60, minY: 0, maxY: 40 };   // 카메라 경계
    this.killY = -6;                                            // 이 아래로 떨어지면 낙사
    this.spawn = { x: 0, y: 2 };
    this.checkpoint = null;
    this.player = null;
    this.objective = '';
    this.completed = false;
    this.time = 0;
  }

  get meta() { return this.constructor.meta; }
  get id() { return this.constructor.meta.id; }

  // ───── 오버라이드 포인트 ─────
  async build() {}
  async onEnter() {}
  onUpdate(dt) {}
  onExit() {}

  // ───── 엔티티 관리 ─────
  add(entity) {
    entity.stage = this; entity.game = this.game;
    this.entities.push(entity);
    this.group.add(entity.object);
    if (entity.body) this.game.physics.add(entity.body);
    entity.onSpawn();
    return entity;
  }
  remove(entity) {
    const i = this.entities.indexOf(entity);
    if (i >= 0) this.entities.splice(i, 1);
    if (entity.body) this.game.physics.remove(entity.body);
    this.group.remove(entity.object);
    entity.alive = false;
    entity.onDestroy();
    entity.disposeObject();
  }
  find(name) { return this.entities.find((e) => e.name === name); }
  findAll(tag) { return this.entities.filter((e) => e.tags.has(tag)); }
  /** 장식용 THREE 오브젝트 (엔티티가 아님) */
  addObject(obj) { this.group.add(obj); return obj; }

  // ───── 플레이어 / 카메라 / 진행 ─────
  spawnPlayer(x = this.spawn.x, y = this.spawn.y, character = 'mochi') {
    this.spawn = { x, y };
    this.player = this.add(new Player({ x, y, character }));
    this.game.camera.follow(this.player, true);
    return this.player;
  }
  setBounds(b) { this.bounds = { ...this.bounds, ...b }; this.game.camera.setBounds(this.bounds); }
  setObjective(text) { this.objective = text; this.game.hud.setObjective(text); }
  setCheckpoint(x, y) { this.checkpoint = { x, y }; this.game.saveProgress(); }
  respawnPoint() { return this.checkpoint || this.spawn; }

  /** 스테이지 클리어 → 다음 스테이지 */
  complete() {
    if (this.completed) return;
    this.completed = true;
    this.game.stageManager.complete();
  }

  // ───── 내부 ─────
  _update(dt) {
    this.time += dt;
    for (const e of this.entities) if (e.alive) e.update(dt);
    // 스테이지 밖으로 떨어진 플레이어
    if (this.player?.alive && this.player.body.top < this.killY) this.player.fallOut();
    this.onUpdate(dt);
  }

  dispose() {
    for (const e of [...this.entities]) this.remove(e);
    this.group.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
      if (o.userData.sharedKit) { if(o.userData.ownedKitMaterial)o.material.dispose(); return; }
      o.geometry?.dispose?.();
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
      else o.material?.dispose?.();
    });
    this.group.clear();
  }
}
