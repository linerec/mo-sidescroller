/**
 * StoryState — 스토리 진행 상태(플래그/변수).
 * 대화 분기, 트리거 조건, 문 개폐 등 "이야기의 기억"은 모두 여기에 저장한다.
 * 세이브 파일에 그대로 직렬화된다.
 *
 * 조건(cond) 표현 방식 — check(cond):
 *   'met_elder'            → 플래그가 truthy
 *   '!met_elder'           → 플래그가 falsy
 *   'item:memory_fragment>=3' → 숫자 비교 (>=, <=, >, <, ==, !=). 인벤토리 개수는 'item:<id>' 플래그로 자동 반영됨
 *   ['a', '!b']            → 모두 만족
 *   { all: [...], any: [...], not: [...] }
 *   (state) => boolean     → 함수
 */
export class StoryState {
  flags = {};

  constructor(events) { this.events = events; }

  set(key, value = true) {
    if (typeof key === 'object') { for (const k in key) this.set(k, key[k]); return; }
    const prev = this.flags[key];
    this.flags[key] = value;
    if (prev !== value) this.events?.emit('flag:changed', { key, value, prev });
  }
  unset(key) { this.set(key, undefined); delete this.flags[key]; }
  get(key, def) { const v = this.flags[key]; return v === undefined ? def : v; }
  has(key) { return !!this.flags[key]; }
  inc(key, n = 1) { const v = (Number(this.flags[key]) || 0) + n; this.set(key, v); return v; }

  check(cond) {
    if (cond === undefined || cond === null) return true;
    if (typeof cond === 'boolean') return cond;
    if (typeof cond === 'function') return !!cond(this);
    if (Array.isArray(cond)) return cond.every((c) => this.check(c));
    if (typeof cond === 'string') return this.#checkString(cond);
    if (typeof cond === 'object') {
      if (cond.all && !cond.all.every((c) => this.check(c))) return false;
      if (cond.any && !cond.any.some((c) => this.check(c))) return false;
      if (cond.not && cond.not.some((c) => this.check(c))) return false;
      return true;
    }
    return false;
  }

  #checkString(s) {
    const m = s.match(/^\s*([\w:.\-]+)\s*(>=|<=|==|!=|>|<)\s*(-?[\d.]+)\s*$/);
    if (m) {
      const a = Number(this.flags[m[1]]) || 0, b = Number(m[3]);
      switch (m[2]) {
        case '>=': return a >= b; case '<=': return a <= b; case '>': return a > b;
        case '<': return a < b; case '==': return a == b; case '!=': return a != b;
      }
    }
    if (s.startsWith('!')) return !this.has(s.slice(1).trim());
    return this.has(s.trim());
  }

  toJSON() { return { ...this.flags }; }
  load(obj) { this.flags = { ...(obj || {}) }; this.events?.emit('flag:loaded', this.flags); }
  reset() { this.flags = {}; }
}
