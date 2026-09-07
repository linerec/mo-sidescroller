/**
 * Inventory — 아이템 보유 상태. 아이템 정의(ITEMS)는 story/items.js 에서 주입한다.
 * 정의 예시: { old_key: { name: '낡은 열쇠', icon: '🗝', keyItem: true, desc: '...' } }
 */
export class Inventory {
  items = {};                      // id → count

  constructor(events, defs = {}) { this.events = events; this.defs = defs; }

  def(id) { return this.defs[id] || { name: id, icon: '?', desc: '' }; }

  add(id, n = 1) {
    this.items[id] = (this.items[id] || 0) + n;
    this.events?.emit('inventory:changed', { id, count: this.items[id], delta: n, def: this.def(id) });
    return this.items[id];
  }
  remove(id, n = 1) {
    if (!this.items[id]) return false;
    this.items[id] = Math.max(0, this.items[id] - n);
    if (this.items[id] === 0) delete this.items[id];
    this.events?.emit('inventory:changed', { id, count: this.items[id] || 0, delta: -n, def: this.def(id) });
    return true;
  }
  count(id) { return this.items[id] || 0; }
  has(id, n = 1) { return this.count(id) >= n; }
  list() { return Object.entries(this.items).map(([id, count]) => ({ id, count, def: this.def(id) })); }

  toJSON() { return { ...this.items }; }
  load(obj) { this.items = { ...(obj || {}) }; this.events?.emit('inventory:changed', { id: null, loaded: true }); }
  reset() { this.items = {}; this.events?.emit('inventory:changed', { id: null }); }
}
