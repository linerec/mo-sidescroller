/**
 * StageManager — 챕터/스테이지 진행 관리.
 *  chapters: [{ id, title, stages: ['stage-1-1', 'stage-1-2', ...] }]  (story/chapters.js)
 *  registry: { 'stage-1-1': StageClass, ... }                            (stages/index.js)
 *
 * 스테이지 순서는 chapters의 나열 순서. complete() 호출 시 다음 스테이지로 넘어가고,
 * 마지막 스테이지면 game.showEnding() 을 부른다.
 */
export class StageManager {
  constructor(game, { registry, chapters }) {
    this.game = game;
    this.registry = registry;
    this.chapters = chapters;
    this.current = null;
    this.busy = false;
    this.order = [];                          // [{ chapter, stageId }]
    for (const ch of chapters) for (const s of ch.stages) this.order.push({ chapter: ch, stageId: s });
  }

  get currentId() { return this.current?.id ?? null; }
  chapterOf(stageId) { return this.order.find((o) => o.stageId === stageId)?.chapter ?? null; }
  indexOf(stageId) { return this.order.findIndex((o) => o.stageId === stageId); }
  nextStageId(stageId) { const i = this.indexOf(stageId); return i >= 0 && i + 1 < this.order.length ? this.order[i + 1].stageId : null; }
  isFirstOfChapter(stageId) { const ch = this.chapterOf(stageId); return ch?.stages[0] === stageId; }

  /** 스테이지 로드 (페이드아웃 → 교체 → 타이틀카드 → 페이드인 → onEnter) */
  async load(stageId, { checkpoint = null, titleCard = true } = {}) {
    const Cls = this.registry[stageId];
    if (!Cls) throw new Error(`[StageManager] 등록되지 않은 스테이지: ${stageId}`);
    if (this.busy) return;
    this.busy = true;
    const g = this.game;

    g.setState('loading');
    g.input.lock();
    await g.fade.out(0.6);
    g.hud.hide();
    this.unload();

    const stage = new Cls(g);
    this.current = stage;
    g.scene.add(stage.group);
    g.applyEnvironment(Cls.env);
    await stage.build();
    if (!stage.player) stage.spawnPlayer();
    await stage.player.ready;
    if (checkpoint) { stage.checkpoint = checkpoint; stage.player.setPosition(checkpoint.x, checkpoint.y); }
    g.camera.setBounds(stage.bounds);
    g.camera.follow(stage.player, true);
    g.physics.step(0);                 // 첫 프레임 접촉 상태 확정
    g.hud.setStageName(stage.meta);
    g.hud.setObjective(stage.objective);
    g.events.emit('stage:loaded', stage);

    if (titleCard) {
      const ch = this.chapterOf(stageId);
      await g.titleCard.show({ chapter: ch?.title, title: stage.meta.title, subtitle: stage.meta.subtitle });
    }
    await g.fade.in(0.8);
    g.hud.show();
    g.setState('playing');
    g.input.unlock();
    this.busy = false;
    g.events.emit('stage:enter', stage);
    await stage.onEnter();
  }

  unload() {
    const s = this.current;
    if (!s) return;
    s.onExit();
    this.game.events.emit('stage:exit', s);
    this.game.scene.remove(s.group);
    s.dispose();
    this.game.physics.clear();
    this.game.tweens.killAll();
    this.current = null;
  }

  /** 현재 스테이지 클리어 처리 */
  async complete() {
    if (this.busy || !this.current) return;
    const g = this.game, stage = this.current;
    const nextId = this.nextStageId(stage.id);
    g.events.emit('stage:complete', stage);
    g.story.set(`cleared:${stage.id}`);
    g.saveProgress(nextId ?? stage.id, null);
    g.setState('stageclear');
    stage.player.celebrate();
    g.input.lock();
    await g.screens.stageClear(stage.meta, { time: stage.time });
    if (nextId) await this.load(nextId);
    else await g.showEnding();
  }

  /** 스테이지 처음부터 (게임오버 → 재시도) */
  async restart() {
    if (!this.current) return;
    await this.load(this.current.id, { checkpoint: this.current.checkpoint, titleCard: false });
  }
}
