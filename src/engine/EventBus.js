/**
 * EventBus — 엔진 전역 pub/sub.
 * 시스템 간 결합을 줄이기 위해 사용한다. (예: 'item:collected', 'enemy:died', 'flag:changed')
 */
export class EventBus {
  #map = new Map();

  on(type, fn) {
    if (!this.#map.has(type)) this.#map.set(type, new Set());
    this.#map.get(type).add(fn);
    return () => this.off(type, fn);          // 해제 함수 반환
  }

  once(type, fn) {
    const off = this.on(type, (payload) => { off(); fn(payload); });
    return off;
  }

  off(type, fn) { this.#map.get(type)?.delete(fn); }

  emit(type, payload) {
    const set = this.#map.get(type);
    if (!set) return;
    for (const fn of [...set]) fn(payload);
  }

  /** 특정 이벤트가 한 번 발생할 때까지 대기 (컷씬에서 유용) */
  waitFor(type, predicate = () => true) {
    return new Promise((resolve) => {
      const off = this.on(type, (p) => { if (predicate(p)) { off(); resolve(p); } });
    });
  }
}
