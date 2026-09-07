/**
 * DialogueSystem — 대화창 UI + 대화 스크립트 실행기.
 *
 * 대화 데이터 형식 (story/dialogues/*.js):
 *   { id: 'elder_intro', lines: [ ...라인 ] }
 * 라인 종류:
 *   '문자열'                                → 화자 없는 나레이션
 *   { speaker: 'elder', text: '...' }      → speaker는 CHARACTERS 키 또는 그냥 이름
 *   { if: cond, then: [라인들], else: [라인들] }   → StoryState.check(cond) 분기
 *   { choice: [ { text, if?, set?, give?, next?, then?: [라인들] } ] }  → 선택지
 *   { set: 'flag' } | { set: { a: 1, b: true } } | { unset: 'flag' }
 *   { give: 'item_id', count?: 1 }          → 인벤토리 지급
 *   { emit: 'event:name', data }            → EventBus
 *   { action: async (game) => {} }          → 임의 코드 (연출 등)
 *   { next: 'other_dialogue_id' }           → 다른 대화로 점프
 *   { wait: 0.5 }                           → 잠깐 멈춤
 * 텍스트 내 {flag_or_character} 는 스토리 변수/캐릭터 이름으로 치환된다.
 */
export class DialogueSystem {
  registry = new Map();
  isOpen = false;
  charsPerSec = 40;

  constructor(game, root) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.id = 'dialogue';
    this.el.className = 'hidden';
    this.el.innerHTML = `<div class="box"><div class="speaker"></div><div class="text"></div><div class="choices"></div><div class="hint"></div></div>`;
    root.appendChild(this.el);
    this.$speaker = this.el.querySelector('.speaker');
    this.$text = this.el.querySelector('.text');
    this.$choices = this.el.querySelector('.choices');
    this.$hint = this.el.querySelector('.hint');
    this._wait = null;      // { type:'advance'|'choice', resolve, ... }
    this._typing = null;    // { full, shown, t }
    this._delay = 0;
    this.el.addEventListener('click', () => this.#onConfirm());
  }

  register(dialogues) {
    const list = Array.isArray(dialogues) ? dialogues : Object.values(dialogues);
    for (const d of list) this.registry.set(d.id, d);
  }
  get(id) { const d = this.registry.get(id); if (!d) console.warn(`[Dialogue] 없음: ${id}`); return d; }

  /** 대화 실행. 끝나면 resolve. */
  async play(idOrData) {
    const data = typeof idOrData === 'string' ? this.get(idOrData) : idOrData;
    if (!data) return;
    const lines = Array.isArray(data) ? data : data.lines;
    const g = this.game;
    const wasPlaying = g.state === 'playing';
    if (wasPlaying) { g.setState('dialogue'); g.input.lock(); }
    this.isOpen = true;
    this.el.classList.remove('hidden');
    g.events.emit('dialogue:start', data);
    try { await this.#runLines(lines); }
    finally {
      this.isOpen = false;
      this.el.classList.add('hidden');
      this.$text.textContent = ''; this.$speaker.textContent = ''; this.$choices.innerHTML = '';
      if (wasPlaying && g.state === 'dialogue') { g.setState('playing'); g.input.unlock(); }
      g.events.emit('dialogue:end', data);
    }
  }

  async #runLines(lines) {
    const g = this.game;
    for (const raw of lines) {
      const line = typeof raw === 'string' ? { text: raw } : raw;
      if (line.if !== undefined) {
        await this.#runLines(g.story.check(line.if) ? line.then || [] : line.else || []);
        continue;
      }
      if (line.set !== undefined) g.story.set(line.set);
      if (line.unset) g.story.unset(line.unset);
      if (line.give) { g.inventory.add(line.give, line.count ?? 1); g.hud.toast(`${g.inventory.def(line.give).icon} ${g.inventory.def(line.give).name} 획득`); }
      if (line.emit) g.events.emit(line.emit, line.data);
      if (line.action) await line.action(g);
      if (line.wait) await g.wait(line.wait);
      if (line.next) { await this.#runLines(this.get(line.next)?.lines || []); return; }
      if (line.choice) {
        const opts = line.choice.filter((c) => g.story.check(c.if));
        const picked = opts[await this.#showChoices(opts)];
        if (picked.set !== undefined) g.story.set(picked.set);
        if (picked.give) g.inventory.add(picked.give, picked.count ?? 1);
        if (picked.emit) g.events.emit(picked.emit, picked.data);
        if (picked.then) await this.#runLines(picked.then);
        if (picked.next) { await this.#runLines(this.get(picked.next)?.lines || []); return; }
        continue;
      }
      if (line.text !== undefined) await this.#showLine(line);
    }
  }

  #format(text) {
    return text.replace(/\{(\w+)\}/g, (_, k) => {
      const ch = this.game.characters?.[k];
      const v = this.game.story.get(k);
      return v !== undefined ? String(v) : ch ? ch.name : `{${k}}`;
    });
  }

  #showLine(line) {
    const ch = this.game.characters?.[line.speaker];
    this.$speaker.textContent = ch ? ch.name : line.speaker || '';
    this.$speaker.style.color = ch?.color || 'var(--accent)';
    this.$choices.innerHTML = '';
    this.$hint.textContent = ''; this.$hint.classList.remove('blink');
    this._typing = { full: this.#format(line.text), shown: 0, t: 0 };
    this.$text.textContent = '';
    this._delay = 0.12;
    return new Promise((resolve) => { this._wait = { type: 'advance', resolve }; });
  }

  #showChoices(opts) {
    this.$hint.textContent = '';
    this.$choices.innerHTML = '';
    const els = opts.map((o, i) => {
      const d = document.createElement('div');
      d.className = 'choice'; d.textContent = this.#format(o.text);
      d.addEventListener('click', (e) => { e.stopPropagation(); this._wait?.resolve(i); this._wait = null; });
      d.addEventListener('mouseenter', () => { if (this._wait?.type === 'choice') { this._wait.index = i; this.#renderChoice(); } });
      this.$choices.appendChild(d); return d;
    });
    this._delay = 0.15;
    return new Promise((resolve) => { this._wait = { type: 'choice', resolve, index: 0, els }; this.#renderChoice(); });
  }
  #renderChoice() { this._wait.els.forEach((el, i) => el.classList.toggle('selected', i === this._wait.index)); }

  #onConfirm() {
    if (!this._wait || this._delay > 0) return;
    if (this._wait.type === 'advance') {
      if (this._typing && this._typing.shown < this._typing.full.length) { this._typing.shown = this._typing.full.length; this.$text.textContent = this._typing.full; this.$hint.textContent = '▼'; this.$hint.classList.add('blink'); return; }
      const w = this._wait; this._wait = null; w.resolve();
    } else if (this._wait.type === 'choice') {
      const w = this._wait; this._wait = null; w.resolve(w.index);
    }
  }

  /** 매 고정 스텝 호출 (Game) */
  update(dt) {
    if (!this.isOpen) return;
    if (this._delay > 0) this._delay -= dt;
    const t = this._typing;
    if (t && t.shown < t.full.length) {
      t.t += dt * this.charsPerSec;
      const n = Math.min(t.full.length, Math.floor(t.t));
      if (n !== t.shown) { t.shown = n; this.$text.textContent = t.full.slice(0, n); }
      if (t.shown >= t.full.length) { this.$hint.textContent = '▼'; this.$hint.classList.add('blink'); }
    }
    const inp = this.game.input;
    if (this._wait?.type === 'choice' && this._delay <= 0) {
      const n = this._wait.els.length;
      if (inp.pressedRaw('up'))   { this._wait.index = (this._wait.index + n - 1) % n; this.#renderChoice(); return; }
      if (inp.pressedRaw('down')) { this._wait.index = (this._wait.index + 1) % n; this.#renderChoice(); return; }
    }
    if (inp.pressedRaw('confirm')) this.#onConfirm();
  }
}
