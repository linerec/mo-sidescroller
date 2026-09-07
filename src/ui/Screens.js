/**
 * Screens — 타이틀 / 스테이지 클리어 / 게임오버 / 일시정지 / 엔딩 메뉴 화면.
 * 각 메서드는 사용자의 선택을 resolve 하는 Promise를 반환한다.
 */
export class Screens {
  constructor(game, root) { this.game = game; this.root = root; this.current = null; }

  #make(html, cls = '') {
    this.close();
    const el = document.createElement('div');
    el.className = `screen ${cls}`; el.innerHTML = html;
    this.root.appendChild(el); this.current = el;
    return el;
  }
  close() { this.current?.remove(); this.current = null; }

  /** 메뉴 상호작용: options [{ id, label, disabled }] → 선택된 id */
  #menu(el, options) {
    const wrap = el.querySelector('.menu');
    const items = options.map((o) => {
      const d = document.createElement('div');
      d.className = 'opt' + (o.disabled ? ' disabled' : ''); d.textContent = o.label; wrap.appendChild(d); return d;
    });
    let idx = options.findIndex((o) => !o.disabled);
    const render = () => items.forEach((it, i) => it.classList.toggle('selected', i === idx));
    render();
    return new Promise((resolve) => {
      const done = (i) => { window.removeEventListener('keydown', onKey); this.game.audio.play('confirm'); resolve(options[i].id); };
      const move = (d) => { const n = options.length; for (let k = 0; k < n; k++) { idx = (idx + d + n) % n; if (!options[idx].disabled) break; } this.game.audio.play('tick'); render(); };
      const onKey = (e) => {
        if (['ArrowUp', 'KeyW'].includes(e.code)) move(-1);
        else if (['ArrowDown', 'KeyS'].includes(e.code)) move(1);
        else if (['Enter', 'Space', 'KeyE', 'KeyZ', 'KeyK'].includes(e.code)) done(idx);
      };
      window.addEventListener('keydown', onKey);
      items.forEach((it, i) => { it.onmouseenter = () => { if (!options[i].disabled) { idx = i; render(); } }; it.onclick = () => !options[i].disabled && done(i); });
    });
  }

  async title({ hasSave }) {
    const el = this.#make(`
      <div class="title-eyebrow">A SMALL LIGHT IN A VAST WORLD</div>
      <h1>MO</h1>
      <p class="title-subtitle">빛이 잠든 숲</p>
      <p class="title-story">작은 발걸음으로, 깊은 어둠 너머로.</p>
      <div class="menu"></div>
      <div class="keys">← → 이동 · SPACE 2단 점프 · E 상호작용 · J 공격 · Q 등불 · ESC 일시정지<br><a href="./character-preview.html" style="color:inherit">모찌 동작 도감 ↗</a> · <a href="./map-editor.html" style="color:inherit">숲 맵 공방 ↗</a></div>`, 'title-screen');
    const r = await this.#menu(el, [
      { id: 'continue', label: '이어하기', disabled: !hasSave },
      { id: 'new', label: '새로 시작' },
    ]);
    this.close(); return r;
  }

  async stageClear(meta, { time = 0 } = {}) {
    const el = this.#make(`
      <h2>STAGE CLEAR</h2>
      <p>${meta.title}<br><span style="opacity:.6">${Math.floor(time / 60)}분 ${Math.floor(time % 60)}초</span></p>
      <div class="menu"></div>`, 'transparent');
    await this.#menu(el, [{ id: 'next', label: '계속 →' }]);
    this.close();
  }

  async gameOver() {
    const el = this.#make(`<h2>GAME OVER</h2><p>어둠이 다시 눈을 감긴다.</p><div class="menu"></div>`);
    const r = await this.#menu(el, [{ id: 'retry', label: '체크포인트에서 다시' }, { id: 'title', label: '타이틀로' }]);
    this.close(); return r;
  }

  async pause() {
    const el = this.#make(`<h2>PAUSED</h2><div class="menu"></div>`, 'transparent');
    const r = await this.#menu(el, [{ id: 'resume', label: '계속하기' }, { id: 'restart', label: '체크포인트에서 다시' }, { id: 'title', label: '타이틀로' }]);
    this.close(); return r;
  }

  async ending() {
    const el = this.#make(`
      <h2>TO BE CONTINUED</h2>
      <p>작은 빛은 아직 꺼지지 않았다.<br>숲의 이야기는 계속됩니다.</p>
      <div class="menu"></div>`);
    await this.#menu(el, [{ id: 'title', label: '타이틀로' }]);
    this.close();
  }
}
