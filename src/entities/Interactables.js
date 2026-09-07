import * as THREE from 'three';
import { Entity } from '../engine/Entity.js';
import { Ease } from '../engine/Tween.js';

/** Sign — 읽을 수 있는 표지판. text(문자열) 또는 dialogue(id) */
export class Sign extends Entity {
  constructor({ x, y, text = '', dialogue = null, prompt = '읽기' } = {}) {
    super({ name: 'sign', x, y, tags: ['sign'] });
    this.text = text; this.dialogue = dialogue; this.interactable = true; this.prompt = prompt;
    const wood = new THREE.MeshStandardMaterial({ color: 0x6d5537, roughness: 0.9 });
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), wood); post.position.y = -0.2;
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.1), wood); board.position.y = 0.45;
    post.castShadow = board.castShadow = true;
    this.object.add(post, board);
  }
  async interact(player) {
    await this.game.dialogue.play(this.dialogue || { lines: [{ speaker: 'sign', text: this.text }] });
    return true;
  }
}

/** Lever — 당기면 플래그 토글. onToggle(on, lever) 콜백 */
export class Lever extends Entity {
  constructor({ x, y, flag, onToggle = null, once = true, prompt = '레버 당기기' } = {}) {
    super({ name: `lever:${flag}`, x, y, tags: ['lever'] });
    this.flag = flag; this.onToggle = onToggle; this.once = once;
    this.interactable = true; this.prompt = prompt;
    const metal = new THREE.MeshStandardMaterial({ color: 0x8b8f96, roughness: 0.4, metalness: 0.6 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.6), metal); base.position.y = -0.35;
    this.handle = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 8), metal); stick.position.y = 0.5;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd9534f })); knob.position.y = 1;
    this.handle.add(stick, knob); this.handle.position.y = -0.2;
    base.castShadow = stick.castShadow = true;
    this.object.add(base, this.handle);
  }
  onSpawn() { this.handle.rotation.z = this.game.story.has(this.flag) ? -0.9 : 0.9; if (this.once && this.game.story.has(this.flag)) this.interactable = false; }
  async interact(player) {
    const g = this.game, on = !g.story.has(this.flag);
    g.story.set(this.flag, on);
    g.audio.play('lever');
    if (this.once) this.interactable = false;
    await g.tweens.to(this.handle.rotation, { z: on ? -0.9 : 0.9 }, 0.35, { ease: Ease.outBack });
    g.events.emit('lever:toggled', { flag: this.flag, on, lever: this });
    await this.onToggle?.(on, this);
    return true;
  }
}

/**
 * Gate — 조건(플래그)이 충족되면 열리는 문/벽. open()은 Promise (컷씬에서 await 가능).
 *  auto: true 면 플래그 변화를 감시해 자동으로 연다. false면 코드에서 open() 호출.
 */
export class Gate extends Entity {
  constructor({ x, y, w = 1, h = 3, flag = null, auto = true, openBy = 'up', color = 0x5a4634 } = {}) {
    super({ name: `gate:${flag ?? 'manual'}`, x, y, tags: ['gate'] });
    this.flag = flag; this.auto = auto; this.openBy = openBy; this.isOpen = false; this.h = h;
    this.setBody({ w, h, type: 'static' });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.2), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
    m.castShadow = m.receiveShadow = true;
    const bars = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, h * 0.9, 1.3), new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.5, roughness: 0.4 }));
    this.mesh = new THREE.Group(); this.mesh.add(m, bars); this.object.add(this.mesh);
  }
  onSpawn() {
    if (this.flag && this.game.story.has(this.flag)) this.open(true);
    else if (this.flag && this.auto) this._off = this.game.events.on('flag:changed', ({ key, value }) => { if (key === this.flag && value) this.open(); });
  }
  onDestroy() { this._off?.(); }
  async open(instant = false) {
    if (this.isOpen) return; this.isOpen = true;
    this.body.enabled = false;
    const dy = this.openBy === 'down' ? -this.h : this.h;
    if (instant) { this.mesh.position.y = dy; return; }
    this.game.audio.play('gate'); this.game.camera.shake(0.08, 1.0);
    await this.game.tweens.to(this.mesh.position, { y: dy }, 1.2, { ease: Ease.inOutQuad });
    this.game.events.emit('gate:opened', { gate: this });
  }
}

/**
 * ExitDoor — 스테이지 출구. requires(조건) 충족 시 상호작용하면 stage.complete().
 *  lockedText: 잠겨있을 때 보여줄 문장
 */
export class ExitDoor extends Entity {
  constructor({ x, y, requires = null, requiresItem = null, lockedText = '잠겨 있다.', prompt = '나가기', onOpen = null } = {}) {
    super({ name: 'exit', x, y, tags: ['exit'] });
    this.requires = requires; this.requiresItem = requiresItem; this.lockedText = lockedText; this.onOpen = onOpen;
    this.interactable = true; this.prompt = prompt; this.interactRange = 1.4;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 0.5), new THREE.MeshStandardMaterial({ color: 0x3b3129, roughness: 0.9 }));
    frame.position.set(0, 0.5, -0.4); frame.castShadow = frame.receiveShadow = true;
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.1), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.35 }));
    this.glow.position.set(0, 0.35, -0.1);
    this.light = new THREE.PointLight(0xffd27a, 1.5, 6); this.light.position.set(0, 0.6, 1);
    this.object.add(frame, this.glow, this.light);
  }
  get unlocked() { return this.game.story.check(this.requires) && (!this.requiresItem || this.game.inventory.has(this.requiresItem)); }
  update(dt) { const on = this.unlocked; this.glow.material.opacity = on ? 0.5 + Math.sin(this.stage.time * 3) * 0.15 : 0.08; this.light.intensity = on ? 1.6 : 0.2; super.update(dt); }
  async interact(player) {
    const g = this.game;
    if (!this.unlocked) { await g.dialogue.play({ lines: [{ speaker: 'narrator', text: this.lockedText }] }); return true; }
    this.interactable = false; g.input.lock();
    g.audio.play('clear');
    await this.onOpen?.(this);
    if (this.requiresItem && g.inventory.def(this.requiresItem).consume) g.inventory.remove(this.requiresItem);
    await player.walkTo(this.x, 3).catch(() => {});
    this.stage.complete();
    return true;
  }
}

/** Checkpoint — 지나가면 부활 지점 갱신 + 자동 저장 */
export class Checkpoint extends Entity {
  constructor({ x, y } = {}) {
    super({ name: 'checkpoint', x, y, tags: ['checkpoint'] });
    this.setBody({ w: 1, h: 2, type: 'sensor' });
    this.active = false;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8), new THREE.MeshStandardMaterial({ color: 0x777 }));
    this.flagMat = new THREE.MeshStandardMaterial({ color: 0x555a60, emissive: 0x000000, side: THREE.DoubleSide });
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), this.flagMat); flag.position.set(0.38, 0.75, 0);
    pole.castShadow = true; this.object.add(pole, flag);
  }
  onOverlap(other) {
    if (this.active || !other?.tags?.has('player')) return;
    this.active = true;
    this.flagMat.color.setHex(0xe9c46a); this.flagMat.emissive.setHex(0x8a6a20);
    this.stage.setCheckpoint(this.x, this.y + 0.5);
    this.game.audio.play('checkpoint'); this.game.hud.toast('체크포인트 — 저장됨');
    this.game.events.emit('checkpoint', { x: this.x, y: this.y });
  }
}

/**
 * Trigger — 보이지 않는 영역. 플레이어가 들어오면 onEnter, 나가면 onExit.
 *  once: 한 번만 / condition: StoryState 조건 / flag: 발동 시 자동으로 set 되는 플래그(재입장 방지용)
 */
export class Trigger extends Entity {
  constructor({ name = 'trigger', x, y, w = 2, h = 3, once = true, condition = null, flag = null, onEnter = null, onExit = null } = {}) {
    super({ name, x, y, tags: ['trigger'] });
    this.once = once; this.condition = condition; this.flag = flag; this.onEnter = onEnter; this.onExit = onExit;
    this.inside = false; this.fired = false; this._touched = false;
    this.setBody({ w, h, type: 'sensor' });
  }
  onSpawn() { if (this.flag && this.game.story.has(this.flag)) this.fired = true; }
  onOverlap(other) { if (other?.tags?.has('player')) this._touched = true; }
  update(dt) {
    if (this._touched && !this.inside) {
      this.inside = true;
      if (!(this.once && this.fired) && this.game.story.check(this.condition)) {
        this.fired = true; if (this.flag) this.game.story.set(this.flag);
        this.onEnter?.(this.stage.player, this);
      }
    } else if (!this._touched && this.inside) { this.inside = false; this.onExit?.(this.stage.player, this); }
    this._touched = false;
  }
}
