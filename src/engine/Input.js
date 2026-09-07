/**
 * Input — 키보드 입력을 "액션" 단위로 추상화.
 *  - down(action)    : 누르고 있는 중
 *  - pressed(action) : 이번 스텝에 눌림
 *  - released(action): 이번 스텝에 떼어짐
 * 컷씬/대화 중에는 lock()으로 게임플레이 액션을 차단한다. (UI 액션은 *Raw 로 항상 읽을 수 있음)
 */
export const KEYMAP = {
  left:     ['ArrowLeft', 'KeyA'],
  right:    ['ArrowRight', 'KeyD'],
  up:       ['ArrowUp', 'KeyW'],
  down:     ['ArrowDown', 'KeyS'],
  jump:     ['Space', 'KeyK'],
  attack:   ['KeyJ', 'KeyX'],
  use_item: ['KeyQ'],
  interact: ['KeyE', 'ArrowUp', 'KeyW', 'Enter'],
  confirm:  ['Space', 'Enter', 'KeyE', 'KeyZ', 'KeyK'],
  cancel:   ['Escape', 'Backspace'],
  pause:    ['Escape'],
  debug:    ['Backquote'],
};

const PREVENT = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

export class Input {
  #held = new Set();
  #pressed = new Set();
  #released = new Set();
  // 가상 입력(터치 버튼 등) — 키보드와 동일한 '액션' 이름으로 담긴다
  #vHeld = new Set();
  #vPressed = new Set();
  #vReleased = new Set();
  locked = false;

  constructor(target = window) {
    target.addEventListener('keydown', (e) => {
      if (PREVENT.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.#held.add(e.code);
      this.#pressed.add(e.code);
    });
    target.addEventListener('keyup', (e) => {
      this.#held.delete(e.code);
      this.#released.add(e.code);
    });
    window.addEventListener('blur', () => { this.#held.clear(); this.clearVirtual(); });
  }

  #any(set, action) {
    const codes = KEYMAP[action];
    if (!codes) return false;
    for (const c of codes) if (set.has(c)) return true;
    return false;
  }

  // ── 게임플레이용 (lock 시 false) ──
  down(action)     { return !this.locked && (this.#any(this.#held, action) || this.#vHeld.has(action)); }
  pressed(action)  { return !this.locked && (this.#any(this.#pressed, action) || this.#vPressed.has(action)); }
  released(action) { return !this.locked && (this.#any(this.#released, action) || this.#vReleased.has(action)); }
  /** 좌우 축 (-1, 0, 1) */
  axis() { return (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0); }

  // ── UI용 (lock 무시) ──
  downRaw(action)    { return this.#any(this.#held, action) || this.#vHeld.has(action); }
  pressedRaw(action) { return this.#any(this.#pressed, action) || this.#vPressed.has(action); }

  lock()   { this.locked = true; }
  unlock() { this.locked = false; }

  /**
   * 터치 버튼 등 가상 입력을 키보드와 같은 액션으로 흘려보낸다.
   *   input.virtual('jump', true)  // 누름
   *   input.virtual('jump', false) // 뗌
   */
  virtual(action, on) {
    if (on) { if (!this.#vHeld.has(action)) { this.#vHeld.add(action); this.#vPressed.add(action); } }
    else if (this.#vHeld.delete(action)) this.#vReleased.add(action);
  }
  /** 한 프레임짜리 탭 (누르고 바로 뗌) */
  tap(action) { this.#vPressed.add(action); this.#vReleased.add(action); }
  clearVirtual() { for (const a of this.#vHeld) this.#vReleased.add(a); this.#vHeld.clear(); }

  /** 매 고정 스텝의 끝에서 호출 — 1프레임짜리 상태 정리 */
  endStep() { this.#pressed.clear(); this.#released.clear(); this.#vPressed.clear(); this.#vReleased.clear(); }
}
