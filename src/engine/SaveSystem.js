/**
 * SaveSystem — localStorage 기반 단일 슬롯 세이브.
 * 저장 데이터 형태: { stageId, checkpoint, flags, inventory, savedAt }
 */
export class SaveSystem {
  constructor(key = 'mo.save.v1') { this.key = key; }

  exists() { return !!localStorage.getItem(this.key); }

  save(data) {
    try {
      localStorage.setItem(this.key, JSON.stringify({ ...data, savedAt: Date.now() }));
      return true;
    } catch (e) { console.warn('[Save] 실패', e); return false; }
  }

  load() {
    try { const raw = localStorage.getItem(this.key); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  }

  clear() { localStorage.removeItem(this.key); }
}
