/**
 * CutsceneRunner — "이벤트/연출"을 async 함수로 기술한다.
 *
 *   await game.cutscene(async (cs) => {
 *     await cs.wait(0.5);
 *     await cs.panTo(gate.x, gate.y, 1.2);
 *     await gate.open();
 *     await cs.say('gate_opened');        // 대화 id 또는 인라인 라인 배열
 *     await cs.panBack();
 *   });
 *
 * 실행 중에는 플레이어 입력이 잠기고 레터박스가 표시된다. 대화가 포함되어도 상태는 'cutscene'으로 유지.
 */
export class CutsceneRunner {
  active = false;

  constructor(game) { this.game = game; }

  async run(fn, { letterbox = true, hideHud = true } = {}) {
    const g = this.game;
    const prevState = g.state;
    this.active = true;
    g.setState('cutscene');
    g.input.lock();
    if (letterbox) g.letterbox(true);
    if (hideHud) g.hud.softHide();
    if (g.stage?.player) g.stage.player.stopMoving();
    g.events.emit('cutscene:start');
    try { await fn(this.api()); }
    catch (e) { console.error('[Cutscene]', e); }
    finally {
      g.letterbox(false);
      g.hud.softShow();
      this.active = false;
      if (g.state === 'cutscene') { g.setState(prevState === 'cutscene' ? 'playing' : prevState); }
      if (g.state === 'playing') g.input.unlock();
      g.events.emit('cutscene:end');
    }
  }

  /** 컷씬 본문에서 쓰는 헬퍼 모음 */
  api() {
    const g = this.game;
    return {
      game: g,
      stage: g.stage,
      player: g.stage?.player,
      wait: (sec) => g.wait(sec),
      say: (idOrLines) => g.dialogue.play(Array.isArray(idOrLines) ? { lines: idOrLines } : idOrLines),
      /** 엔티티를 x까지 걷게 함 (Player/NPC의 walkTo 사용) */
      walk: (entity, x, speed) => entity.walkTo(x, speed),
      face: (entity, dir) => entity.setFacing?.(dir),
      panTo: (x, y, dur) => g.camera.panTo(x, y, dur),
      panToEntity: (e, dur) => g.camera.panTo(e.x, e.y, dur),
      panBack: (dur) => g.camera.panBack(dur),
      follow: (e) => g.camera.follow(e),
      zoom: (dist, dur) => g.camera.zoomTo(dist, dur),
      shake: (s, d) => g.camera.shake(s, d),
      fadeOut: (d) => g.fade.out(d),
      fadeIn: (d) => g.fade.in(d),
      title: (opts) => g.titleCard.show(opts),
      toast: (text) => g.hud.toast(text),
      objective: (text) => g.stage?.setObjective(text),
      set: (k, v) => g.story.set(k, v),
      give: (id, n) => g.inventory.add(id, n),
      emit: (t, p) => g.events.emit(t, p),
      tween: g.tweens,
      sfx: (name) => g.audio.play(name),
    };
  }
}
