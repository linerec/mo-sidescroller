import * as THREE from 'three';
import { Entity } from '../engine/Entity.js';
import { CharacterVisual } from '../characters/CharacterVisual.js';
import { characterDefinition } from '../characters/definitions.js';

/** Player physics stay independent of the shared GLB animation contract. */
export class Player extends Entity {
  constructor({ x = 0, y = 2, name = 'player', character = 'mochi' } = {}) {
    super({ name, x, y, tags: ['player'] });
    // 스탯 / 물리 파라미터
    this.maxHp = 3; this.hp = 3;
    this.speed = 7.5; this.accel = 55; this.airAccel = 35; this.friction = 45;
    this.jumpVel = 15.5; this.jumpCutMul = 0.45;   // 점프 중 키를 떼면 속도 감쇠
    this.coyoteTime = 0.1; this.jumpBufferTime = 0.12;
    this.character = characterDefinition(character);
    this.invulnTime = 1.0; this.attackCooldown = this.character.motions.attack.duration;
    this._jumps = 0; this._idleTime = 0; this._pendingAttack = null; this._pendingItem = null; this._lightTime = 0;
    // 상태
    this.facing = 1; this.state = 'idle';
    this.invuln = 0; this._coyote = 0; this._buffer = 0; this._attackCd = 0; this._attackT = 0;
    this._wasGround = false; this._auto = null;           // 컷씬 자동 이동
    this.control = true;                                 // false면 입력 무시
    this.nearest = null;                                 // 상호작용 가능한 가장 가까운 엔티티
    this.setBody({ ...this.character.collider, type: 'dynamic' });
    this.#buildMesh();
  }

  #buildMesh() {
    this.visual = new CharacterVisual(this.character);
    this.rig = this.visual.object; this.rig.position.y = -this.body.hh;
    this.object.add(this.rig);
    this.ready = this.visual.ready;
    this.slash = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.045, 6, 24, Math.PI * 0.9), new THREE.MeshBasicMaterial({ color: 0xffe5a0, transparent: true, opacity: 0.9 }));
    this.slash.visible = false; this.object.add(this.slash);
    this.itemLight = new THREE.PointLight(0xffcd7e, 0, 7);
    this.itemLight.position.set(0, 0.5, 0.6); this.object.add(this.itemLight);
  }

  onSpawn() {
    this.game.events.emit('player:hp', { hp: this.hp, max: this.maxHp });
    this._offCollect = this.game.events.on('item:collected', () => this.celebrate());
    this.ready.then(ok => { if (!ok && this.alive) this.game.hud.toast('캐릭터 모델을 불러오지 못했습니다. 새로고침해 주세요.'); });
  }
  onDestroy() { this._offCollect?.(); this.visual.dispose(); }
  celebrate() { if (this.state !== 'dead') this.visual.play('happy'); }

  setFacing(dir) { if (dir) this.facing = dir; }
  stopMoving() { this._auto = null; if (this.body) this.body.vx = 0; }

  /** 컷씬용: x 까지 걸어가기 */
  walkTo(x, speed = 4) {
    return new Promise((resolve) => { this._auto = { x, speed, resolve }; });
  }

  update(dt) {
    const b = this.body, inp = this.game.input;
    const canControl = this.control && this.game.state === 'playing' && !this._auto && this.state !== 'dead' && this.state !== 'hurt';
    this.invuln = Math.max(0, this.invuln - dt);
    this._attackCd = Math.max(0, this._attackCd - dt);
    this._coyote = b.onGround ? this.coyoteTime : Math.max(0, this._coyote - dt);
    this._buffer = Math.max(0, this._buffer - dt);

    if (b.onGround) this._jumps = 0;
    this._lightTime = Math.max(0, this._lightTime - dt);
    this.itemLight.intensity = this._lightTime > 0 ? 2.5 : 0;
    this.#resolveActions(dt);

    // ── 수평 이동 ──
    let axis = 0;
    if (this._auto) {
      const d = this._auto.x - b.x;
      if (Math.abs(d) < 0.08) { b.vx = 0; const r = this._auto.resolve; this._auto = null; r(); }
      else { axis = Math.sign(d); b.vx = axis * this._auto.speed; }
    } else if (canControl) {
      axis = inp.axis();
      const a = b.onGround ? this.accel : this.airAccel;
      if (axis !== 0) b.vx = THREE.MathUtils.clamp(b.vx + axis * a * dt, -this.speed, this.speed);
      else if (b.onGround) b.vx = Math.abs(b.vx) < this.friction * dt ? 0 : b.vx - Math.sign(b.vx) * this.friction * dt;
      else b.vx *= (1 - 2.5 * dt);
    } else if (this.state !== 'hurt' && b.onGround) b.vx *= (1 - 12 * dt);
    if (axis !== 0) this.facing = axis;

    // ── 점프 ──
    if (canControl) {
      const drop = inp.down('down') && inp.pressed('jump') && b.onGround && b.groundBody?.oneWay;
      if (drop) { b.dropThrough = true; this._buffer = 0; this._coyote = 0; }
      else if (inp.pressed('jump')) this._buffer = this.jumpBufferTime;
      const groundJump = this._coyote > 0;
      const airJump = !b.onGround && inp.pressed('jump') && Math.max(1, this._jumps) < this.character.maxJumps;
      if (!drop && this._buffer > 0 && (groundJump || airJump)) {
        this._jumps = groundJump ? 1 : Math.max(1, this._jumps) + 1;
        b.vy = this.jumpVel * (groundJump ? 1 : 0.9); this._buffer = 0; this._coyote = 0; b.onGround = false;
        this._idleTime = 0;
        this.game.audio.play('jump'); this.game.events.emit('player:jump', { count: this._jumps });
        this.visual.play(groundJump ? 'jump' : 'double_jump');
      }
      if (inp.released('jump') && b.vy > 0) b.vy *= this.jumpCutMul;
      if (inp.down('down') && inp.pressed('down') && b.groundBody?.oneWay) b.dropThrough = true;
      // ── 공격 ──
      if (inp.pressed('attack') && this._attackCd <= 0) this.attack();
      if (inp.pressed('use_item')) this.useItem();
    }
    if (b.onGround && !this._wasGround && this.state !== 'dead') { this.game.audio.play('land'); this.visual.play('land'); }
    this._wasGround = b.onGround;

    // ── 상태 ──
    if (this.state !== 'dead' && this.state !== 'hurt') this.state = !b.onGround ? (b.vy > 0 ? 'jump' : 'fall') : Math.abs(b.vx) > 0.3 ? 'run' : 'idle';
    if (this.state === 'hurt' && b.onGround && this.invuln <= this.invulnTime - this.character.motions.hit.duration - this.character.motions.damage.duration) this.state = 'idle';

    // ── 상호작용 대상 탐색 ──
    this.#scanInteractables(canControl);

    const activeInput = canControl && (axis || ['jump', 'attack', 'interact', 'use_item'].some(a => inp.pressed(a)));
    if (activeInput && this.visual.motion.name === 'happy') this.visual.play(this.state === 'run' ? 'run' : 'idle', { force: true });
    this._idleTime = this.state === 'idle' && canControl && !activeInput && !this.visual.motion.busy ? this._idleTime + dt : 0;
    this.updateVisual(dt);
    super.update(dt);
  }

  #scanInteractables(canControl) {
    const hud = this.game.hud;
    let best = null, bestD = Infinity;
    if (canControl) for (const e of this.stage.entities) {
      if (!e.interactable || !e.alive || e === this) continue;
      const d = e.distanceTo(this);
      if (d < e.interactRange && d < bestD) { best = e; bestD = d; }
    }
    this.nearest = best;
    if (best) {
      hud.showPrompt(best.prompt || '상호작용', best.x, best.y + (best.body?.hh ?? 0.8) + 0.5);
      if (this.game.input.pressed('interact')) { this.body.vx = 0; best.interact(this); }
    } else hud.hidePrompt();
  }

  attack() {
    if (this.state === 'dead' || this.state === 'hurt' || this._attackCd > 0 || this._pendingItem) return false;
    if (!this.visual.play('attack')) return false;
    this._idleTime = 0; this._attackCd = this.attackCooldown;
    this._pendingAttack = { time: this.character.motions.attack.eventAt, facing: this.facing };
    this.game.events.emit('player:attack');
    return true;
  }

  useItem(id = 'lantern') {
    if (this.state === 'dead' || this.state === 'hurt' || this._pendingItem || this._attackCd > 0) return false;
    const def = this.game.inventory.def(id);
    if (!this.game.inventory.has(id) || def.use !== 'light') {
      this.game.hud.toast('사용할 등불이 없습니다. 숲에서 등불을 찾아보세요.'); return false;
    }
    if (!this.visual.play('use_item')) return false;
    this._idleTime = 0;
    this._pendingItem = { id, time: this.character.motions.use_item.eventAt, committed: false };
    return true;
  }

  #resolveActions(dt) {
    const attack = this._pendingAttack;
    if (attack && (attack.time -= dt) <= 0) {
      this._pendingAttack = null;
      const b = this.body, facing = attack.facing;
      this._attackT = 0.18; this.slash.visible = true;
      this.slash.rotation.z = facing > 0 ? -0.9 : Math.PI - 0.6;
      this.slash.position.set(facing * 0.5, 0.1, 0.3);
      this.game.audio.play('attack');
      const hits = this.game.physics.overlapBox(b.x + facing * 0.9, b.y, 1.4, 1.3, o => o.owner && o.owner !== this && o.owner.tags?.has('enemy'));
      for (const h of hits) h.owner.takeDamage?.(1, this, 'attack');
      this.game.events.emit('player:attack-impact');
    }
    const item = this._pendingItem;
    if (item) {
      item.time -= dt;
      if (item.time <= 0 && !item.committed) {
        item.committed = true;
        if (this.game.inventory.has(item.id)) {
          this._lightTime = 4;
          this.game.audio.play('collect');
          this.game.hud.toast('등불이 주변을 따뜻하게 밝힙니다');
          this.game.events.emit('player:item-used', { itemId: item.id });
        }
      }
      if (item.time <= -(this.character.motions.use_item.duration - this.character.motions.use_item.eventAt)) this._pendingItem = null;
    }
  }

  /** 적을 밟았을 때 튀어오름 */
  bounce() { this.body.vy = Math.max(this.body.vy, 9); this.visual.play('jump'); }

  takeDamage(amount = 1, fromX = null) {
    if (this.invuln > 0 || this.state === 'dead') return false;
    this._pendingAttack = null; this._pendingItem = null; this._idleTime = 0;
    this.slash.visible = false; this._attackT = 0;
    this.visual.play('hit', { force: true });
    this.hp = Math.max(0, this.hp - amount);
    this.invuln = this.invulnTime; this.state = 'hurt';
    const dir = fromX === null ? -this.facing : Math.sign(this.body.x - fromX) || -this.facing;
    this.body.vx = dir * 7; this.body.vy = 7;
    this.game.audio.play('hurt'); this.game.camera.shake(0.25, 0.25);
    this.game.events.emit('player:hp', { hp: this.hp, max: this.maxHp });
    this.game.events.emit('player:hurt', { hp: this.hp });
    if (this.hp <= 0) this.die();
    return true;
  }

  heal(n = 1) { this.hp = Math.min(this.maxHp, this.hp + n); this.game.events.emit('player:hp', { hp: this.hp, max: this.maxHp }); }

  die() {
    if (this.state === 'dead') return;
    this.state = 'dead'; this.control = false;
    this.body.vx = 0; this.body.vy = 6;
    this._pendingAttack = null; this._pendingItem = null;
    this.visual.play('dead', { force: true });
    this.game.events.emit('player:died');
  }

  /** 스테이지 밖으로 낙하: 피해 후 체크포인트로 복귀 */
  async fallOut() {
    if (this.state === 'dead' || this._falling) return;
    this._falling = true;
    this.hp = Math.max(0, this.hp - 1);
    this.game.audio.play('hurt');
    this.game.events.emit('player:hp', { hp: this.hp, max: this.maxHp });
    if (this.hp <= 0) { this.die(); this._falling = false; return; }
    this.game.input.lock();
    await this.game.fade.out(0.4);
    const p = this.stage.respawnPoint();
    this.respawnAt(p.x, p.y);
    await this.game.fade.in(0.4);
    if (this.game.state === 'playing') this.game.input.unlock();
    this._falling = false;
  }

  respawnAt(x, y) {
    this.setPosition(x, y); this.body.vx = 0; this.body.vy = 0;
    this.invuln = 0.6; this.state = 'idle'; this.control = true;
    this._jumps = 0; this._idleTime = 0; this._coyote = 0; this._buffer = 0; this._wasGround = false;
    this._pendingAttack = null; this._pendingItem = null; this._attackCd = 0; this._attackT = 0;
    this._lightTime = 0; this.itemLight.intensity = 0;
    this.slash.visible = false; this.visual.reset();
    this.game.camera.follow(this, true);
    this.game.events.emit('player:respawn', { x, y });
  }

  /** Also called while the stage-clear/death screen freezes gameplay physics. */
  updateVisual(dt) {
    const base = this.state === 'dead' ? 'dead' : this.state === 'run' ? 'run' :
      !this.body.onGround ? 'fall' : this._idleTime >= this.character.sleepAfter ? 'sleepy' : 'idle';
    this.visual.update(dt, base, this.facing);
    // Keep the contact pose readable, then blink during recovery.
    this.rig.visible = this.state !== 'dead' && this.invuln > 0 && this.visual.motion.name !== 'hit' ? Math.floor(this.invuln * 12) % 2 === 0 : true;
    if (this._attackT > 0) {
      this._attackT = Math.max(0, this._attackT - dt);
      this.slash.material.opacity = this._attackT / 0.18;
      this.slash.visible = this._attackT > 0;
    }
  }
}
