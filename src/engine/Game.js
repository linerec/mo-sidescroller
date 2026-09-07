import * as THREE from 'three';
import { CinematicRenderer } from '../render/CinematicRenderer.js';
import { EventBus } from './EventBus.js';
import { Input } from './Input.js';
import { Physics } from './Physics.js';
import { FollowCamera } from './FollowCamera.js';
import { StoryState } from './StoryState.js';
import { Inventory } from './Inventory.js';
import { SaveSystem } from './SaveSystem.js';
import { TweenManager } from './Tween.js';
import { StageManager } from './StageManager.js';
import { DialogueSystem } from './DialogueSystem.js';
import { CutsceneRunner } from './Cutscene.js';
import { AudioManager } from './AudioManager.js';
import { Debug } from './Debug.js';
import { HUD } from '../ui/HUD.js';
import { Fade, Letterbox, TitleCard } from '../ui/Overlays.js';
import { Screens } from '../ui/Screens.js';

/**
 * Game — 엔진의 중심. 렌더러/씬/카메라/시스템들을 소유하고 메인 루프를 돌린다.
 *
 * 상태(state): title | loading | playing | dialogue | cutscene | paused | stageclear | gameover | ending
 *  - 월드(엔티티/물리)는 playing / cutscene 에서만 갱신된다.
 *  - 플레이어 입력은 playing 에서만 처리된다 (Input.lock).
 */
export class Game {
  constructor({ canvas, uiRoot, registry, chapters, items = {}, characters = {}, dialogues = [], startStage = null }) {
    this.canvas = canvas; this.uiRoot = uiRoot;
    this.characters = characters; this.startStage = startStage;
    this.isMapDraft = new URLSearchParams(location.search).has('draft');
    this.state = 'boot';
    this.fixedDt = 1 / 60; this._acc = 0; this._last = performance.now();

    // ── 시스템 ──
    this.events = new EventBus();
    this.input = new Input();
    this.physics = new Physics();
    this.tweens = new TweenManager();
    this.story = new StoryState(this.events);
    this.inventory = new Inventory(this.events, items);
    this.save = new SaveSystem();
    this.audio = new AudioManager();

    // ── 렌더러 / 씬 / 카메라 ──
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.camera = new FollowCamera(1, this);
    this.#setupLights();
    this.cinematic = new CinematicRenderer(this.renderer, this.scene, this.camera.cam);

    // ── UI ──
    this.hud = new HUD(this, uiRoot);
    this.dialogue = new DialogueSystem(this, uiRoot);
    this.dialogue.register(dialogues);
    this.fade = new Fade(uiRoot);
    this._letterbox = new Letterbox(uiRoot);
    this.titleCard = new TitleCard(uiRoot);
    this.screens = new Screens(this, uiRoot);
    this.debug = new Debug(this, uiRoot);

    this.cutsceneRunner = new CutsceneRunner(this);
    this.stageManager = new StageManager(this, { registry, chapters });

    this.#resize();
    window.addEventListener('resize', () => this.#resize());
    const unlock = () => this.audio.unlock();
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', (e) => { if (this.debug.hotkey(e)) e.preventDefault(); });
    this.events.on('player:died', () => this.#onPlayerDied());
    // 대화/컷씬에서 emit('story:objective', '텍스트') 로 목표 갱신
    this.events.on('story:objective', (text) => this.stage?.setObjective(text));
    // 인벤토리 개수를 'item:<id>' 플래그로 미러링 → 대화 조건에서 'item:old_key' / 'item:memory_fragment>=3' 사용 가능
    this.events.on('inventory:changed', ({ id }) => { if (id) this.story.set(`item:${id}`, this.inventory.count(id)); });
  }

  // ───── 접근자 / 유틸 ─────
  get stage() { return this.stageManager.current; }
  get worldActive() { return this.state === 'playing' || this.state === 'cutscene'; }
  setState(s) { const prev = this.state; this.state = s; this.events.emit('state', { state: s, prev }); }
  /** 게임 시간 기준 대기 (일시정지 시 함께 멈춤) */
  wait(sec) { return this.tweens.run(sec, () => {}); }
  cutscene(fn, opts) { return this.cutsceneRunner.run(fn, opts); }
  letterbox(on) { this._letterbox.set(on); }

  // ───── 시작 / 타이틀 / 저장 ─────
  start() {
    this.fade.set(1);
    requestAnimationFrame(this.#frame);
    if (this.startStage) { this.setState('loading'); this.stageManager.load(this.startStage); }
    else this.showTitle();
  }

  async showTitle() {
    this.setState('title'); this.input.lock(); this.hud.hide();
    await this.fade.out(0.5);
    this.stageManager.unload();
    const choice = await this.screens.title({ hasSave: this.save.exists() });
    if (choice === 'continue') {
      const d = this.save.load();
      this.story.load(d.flags); this.inventory.load(d.inventory);
      await this.stageManager.load(d.stageId, { checkpoint: d.checkpoint });
    } else {
      if (!this.isMapDraft) this.save.clear(); this.story.reset(); this.inventory.reset();
      await this.stageManager.load(this.stageManager.order[0].stageId);
    }
  }

  saveProgress(stageId = this.stage?.id, checkpoint = this.stage?.checkpoint ?? null) {
    if (!stageId || this.isMapDraft) return;
    this.save.save({ stageId, checkpoint, flags: this.story.toJSON(), inventory: this.inventory.toJSON() });
    this.events.emit('game:saved');
  }

  async showEnding() {
    this.setState('ending'); this.input.lock();
    await this.fade.out(1);
    await this.screens.ending();
    this.showTitle();
  }

  async pause() {
    if (this.state !== 'playing') return;
    this.setState('paused'); this.input.lock();
    const r = await this.screens.pause();
    if (r === 'resume') { this.setState('playing'); this.input.unlock(); }
    else if (r === 'restart') await this.stageManager.restart();
    else await this.showTitle();
  }

  async #onPlayerDied() {
    this.setState('gameover'); this.input.lock();
    this.audio.play('die');
    await new Promise((r) => setTimeout(r, 1400));
    const r = await this.screens.gameOver();
    if (r === 'retry') await this.stageManager.restart();
    else await this.showTitle();
  }

  // ───── 조명 / 환경 ─────
  #setupLights() {
    this.hemi = new THREE.HemisphereLight(0x9fb4c7, 0x2b2620, 0.9);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 1.6);
    this.sun.castShadow = true;
    const s = this.sun.shadow;
    s.mapSize.set(2048, 2048);
    s.camera.near = 1; s.camera.far = 90;
    s.camera.left = -28; s.camera.right = 28; s.camera.top = 22; s.camera.bottom = -22;
    s.bias = -0.0006; s.normalBias = 0.02;
    this.sunTarget = new THREE.Object3D();
    this.sun.target = this.sunTarget;
    this.scene.add(this.hemi, this.sun, this.sunTarget);
    this.applyEnvironment();
  }

  /** 스테이지별 분위기 (Stage.env). 생략된 값은 기본값 사용 */
  applyEnvironment(env = {}) {
    const e = {
      sky: 0x1a232c, fog: { near: 20, far: 75 }, fogColor: null,
      hemi: { sky: 0x9fb4c7, ground: 0x2b2620, intensity: 0.9 },
      sun: { color: 0xfff1d6, intensity: 1.6, offset: [-8, 18, 14] },
      ...env,
    };
    this.scene.background = new THREE.Color(e.sky);
    this.scene.fog = e.fog ? new THREE.Fog(e.fogColor ?? e.sky, e.fog.near, e.fog.far) : null;
    this.hemi.color.set(e.hemi.sky); this.hemi.groundColor.set(e.hemi.ground); this.hemi.intensity = e.hemi.intensity;
    this.sun.color.set(e.sun.color); this.sun.intensity = e.sun.intensity;
    this.sunOffset = e.sun.offset;
  }

  // ───── 메인 루프 ─────
  #frame = (now) => {
    // 탭이 숨겨지면 rAF가 멈추므로 setTimeout으로 대체해 루프를 유지한다
    if (document.hidden) setTimeout(() => this.#frame(performance.now()), 1000 / 60);
    else requestAnimationFrame(this.#frame);
    const dt = Math.min(0.1, (now - this._last) / 1000);
    this._last = now;
    this._acc += dt;
    let steps = 0;
    while (this._acc >= this.fixedDt && steps < 5) { this.#step(this.fixedDt); this._acc -= this.fixedDt; steps++; }
    if (steps === 5) this._acc = 0;
    this.#render();
  };

  #step(dt) {
    if (this.input.pressedRaw('pause') && this.state === 'playing') this.pause();
    this.tweens.update(dt);
    if (this.worldActive && this.stage) {
      this.physics.step(dt);
      this.stage._update(dt);
    }
    if (this.stage && ['stageclear', 'gameover'].includes(this.state)) this.stage.player?.updateVisual(dt);
    this.dialogue.update(dt);
    this.camera.update(dt);
    this.debug.update(dt);
    this.input.endStep();
  }

  #render() {
    // 태양(그림자 카메라)이 시점을 따라다니게 함
    const c = this.camera.cam.position, o = this.sunOffset || [-8, 18, 14];
    this.sun.position.set(c.x + o[0], c.y + o[1] - this.camera.offsetY, o[2]);
    this.sunTarget.position.set(c.x, c.y - this.camera.offsetY, 0);
    this.cinematic.render();
  }

  #resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.cinematic.resize(w, h);
    this.camera.resize(w / h);
  }
}
