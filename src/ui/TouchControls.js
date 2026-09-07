/**
 * TouchControls — 모바일 화면 터치 조작.
 *
 * 기존 Input 의 "액션"(left/right/jump/attack/interact/use_item/pause/confirm)으로
 * 그대로 흘려보내므로 게임 로직은 전혀 바뀌지 않는다.
 *  - 멀티터치: 버튼마다 pointerId 를 잡아 왼쪽을 누른 채 점프가 된다
 *  - 점프는 누르는 동안 더 높이 뜨고(떼면 감쇠), 공중에서 다시 탭하면 2단 점프
 *  - 상호작용 버튼은 근처에 대상이 있을 때만 나타난다
 *  - 대화 중에는 화면 위쪽 아무 곳이나 탭하면 다음으로 넘어간다
 *  - 메뉴(타이틀/일시정지/게임오버)는 원래 클릭으로 동작하므로 버튼을 숨긴다
 *
 * CSS 는 이 모듈이 직접 주입한다(공용 styles.css 를 건드리지 않기 위해).
 */

const CSS = `
html, body { overscroll-behavior: none; }
#tc { position:absolute; inset:0; pointer-events:none; z-index:15;
  -webkit-user-select:none; user-select:none; -webkit-tap-highlight-color:transparent; }
#tc.off { display:none; }
#tc .pad { position:absolute; display:flex; gap:14px; align-items:flex-end; }
#tc .left  { left:calc(18px + env(safe-area-inset-left));  bottom:calc(20px + env(safe-area-inset-bottom)); }
#tc .right { right:calc(18px + env(safe-area-inset-right)); bottom:calc(20px + env(safe-area-inset-bottom));
  flex-direction:row-reverse; align-items:flex-end; }
#tc button { pointer-events:auto; touch-action:none; -webkit-tap-highlight-color:transparent;
  display:flex; align-items:center; justify-content:center; flex-direction:column; gap:2px;
  border-radius:50%; border:1px solid rgba(255,255,255,.28); background:rgba(12,16,20,.34);
  color:rgba(255,255,255,.9); backdrop-filter:blur(3px); font-family:inherit; font-weight:600;
  width:64px; height:64px; font-size:22px; line-height:1; transition:transform .06s, background .12s; }
#tc button .cap { font-size:9px; font-weight:500; letter-spacing:.06em; opacity:.65; }
#tc button.big { width:82px; height:82px; font-size:15px; background:rgba(233,196,106,.26); border-color:rgba(233,196,106,.5); }
#tc button.on { transform:scale(.92); background:rgba(255,255,255,.30); }
#tc button.hidden { display:none; }
#tc .stack { display:flex; flex-direction:column; gap:12px; align-items:center; }
#tc .pause { position:absolute; top:calc(12px + env(safe-area-inset-top)); right:calc(14px + env(safe-area-inset-right));
  width:42px; height:42px; font-size:15px; }
/* 대화 중: 위쪽 아무 데나 탭하면 진행 (대화창 자체는 원래 클릭 핸들러가 처리) */
#tc .tapcatch { position:absolute; left:0; right:0; top:0; bottom:26vh; pointer-events:auto; display:none; }
#tc.dialogue .tapcatch { display:block; }
#tc .hint { position:absolute; left:50%; bottom:calc(112px + env(safe-area-inset-bottom)); transform:translateX(-50%);
  background:rgba(12,16,20,.62); color:#fff; font-size:12px; padding:6px 12px; border-radius:14px;
  opacity:0; transition:opacity .4s; white-space:nowrap; }
#tc .hint.show { opacity:1; }
@media (orientation: portrait) { #tc .hint.rotate { opacity:1; } }
@media (max-height: 420px) { #tc button { width:56px; height:56px; font-size:19px; } #tc button.big { width:70px; height:70px; font-size:14px; } }
`;

export class TouchControls {
  /** 터치 기기인가 (?touch=1 로 강제, ?touch=0 로 해제 — 데스크톱 테스트용) */
  static isTouchDevice() {
    const q = new URLSearchParams(location.search).get('touch');
    if (q === '1') return true;
    if (q === '0') return false;
    return (matchMedia && matchMedia('(pointer: coarse)').matches)
      || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  constructor(game, root) {
    this.game = game;
    if (!document.getElementById('tc-style')) {
      const st = document.createElement('style'); st.id = 'tc-style'; st.textContent = CSS;
      document.head.appendChild(st);
    }
    this.el = document.createElement('div');
    this.el.id = 'tc';
    root.appendChild(this.el);

    this.tapCatch = this.#add('div', 'tapcatch');
    this.tapCatch.addEventListener('pointerdown', (e) => { e.preventDefault(); game.input.tap('confirm'); });

    // 왼쪽: 이동
    const left = this.#add('div', 'pad left');
    this.btnLeft  = this.#button(left, 'left',  '◀');
    this.btnRight = this.#button(left, 'right', '▶');

    // 오른쪽: 점프 / 공격 / 아이템 / 상호작용
    const right = this.#add('div', 'pad right');
    this.btnJump = this.#button(right, 'jump', '점프', 'big');
    const stack = document.createElement('div'); stack.className = 'stack'; right.appendChild(stack);
    this.btnInteract = this.#button(stack, 'interact', 'E', '', '조사');
    this.btnAttack   = this.#button(stack, 'attack', '⚔');
    this.btnItem     = this.#button(right, 'use_item', '🏮');

    // 일시정지
    this.btnPause = this.#button(this.el, 'pause', 'II', 'pause');

    this.hint = this.#add('div', 'hint rotate');
    this.hint.textContent = '가로로 돌리면 더 넓게 보여요';

    this.enabled = TouchControls.isTouchDevice();
    if (!this.enabled) { this.el.classList.add('off'); return; }
    // 상태 변화에는 즉시 반응하고(탭이 백그라운드라 rAF가 멈춰도 정확), 근처 대상 표시는 매 프레임 갱신
    for (const ev of ['state', 'dialogue:start', 'dialogue:end', 'cutscene:start', 'cutscene:end', 'stage:enter'])
      game.events.on(ev, () => this.sync());
    this.sync();
    this.#loop();
  }

  #add(tag, cls) { const e = document.createElement(tag); e.className = cls; this.el.appendChild(e); return e; }

  /** 버튼 하나 — 멀티터치를 위해 pointerId 를 각자 잡는다 */
  #button(parent, action, label, cls = '', caption = '') {
    const b = document.createElement('button');
    b.className = cls;
    b.innerHTML = `<span>${label}</span>${caption ? `<span class="cap">${caption}</span>` : ''}`;
    b.setAttribute('aria-label', action);
    let id = null;
    const press = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (id !== null) return;
      id = e.pointerId; b.classList.add('on');
      try { b.setPointerCapture(id); } catch { /* 캡처 실패해도 동작엔 지장 없음 */ }
      this.game.input.virtual(action, true);
    };
    const release = (e) => {
      if (id === null || (e && e.pointerId !== undefined && e.pointerId !== id)) return;
      id = null; b.classList.remove('on');
      this.game.input.virtual(action, false);
    };
    b.addEventListener('pointerdown', press);
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('lostpointercapture', release);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    parent.appendChild(b);
    return b;
  }

  #loop = () => {
    if (!this.enabled) return;
    requestAnimationFrame(this.#loop);
    this.sync();
  };

  /** 게임 상태에 따라 무엇을 보여줄지 갱신 */
  sync() {
    const g = this.game, s = g.state;
    const playing = s === 'playing';
    const talking = g.dialogue?.isOpen === true;
    // 메뉴 화면(타이틀/일시정지/게임오버/클리어)은 원래 탭으로 눌리므로 조작 버튼을 숨긴다
    const menu = ['title', 'paused', 'gameover', 'stageclear', 'ending', 'loading'].includes(s);
    this.el.classList.toggle('dialogue', talking || s === 'cutscene');
    const showPad = playing && !talking;
    for (const b of [this.btnLeft, this.btnRight, this.btnJump, this.btnAttack, this.btnItem])
      b.classList.toggle('hidden', !showPad);
    this.btnPause.classList.toggle('hidden', !playing);
    // 상호작용 버튼은 근처에 대상이 있을 때만
    const near = playing && !!g.stage?.player?.nearest;
    this.btnInteract.classList.toggle('hidden', !near);
    // 조작 중 눌린 채로 화면이 바뀌면 입력을 놓아준다
    if (menu || talking) g.input.clearVirtual();
    // 세로 화면 안내는 플레이 중에만
    this.hint.classList.toggle('rotate', playing);
  }

  dispose() { this.enabled = false; this.el.remove(); }
}
