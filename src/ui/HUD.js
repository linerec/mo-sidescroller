/**
 * HUD — 체력, 아이템, 목표, 상호작용 프롬프트, 토스트.
 * EventBus를 구독하여 자동 갱신된다.
 */
export class HUD {
  constructor(game, root) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.id = 'hud';
    this.el.innerHTML = `
      <div class="hearts"></div>
      <div class="objective"></div>
      <div class="items"></div>
      <div class="stage-name"></div>
      <div class="prompt hidden"><kbd>E</kbd><span></span></div>
      <div class="toast"></div>`;
    root.appendChild(this.el);
    this.$hearts = this.el.querySelector('.hearts');
    this.$objective = this.el.querySelector('.objective');
    this.$items = this.el.querySelector('.items');
    this.$stage = this.el.querySelector('.stage-name');
    this.$prompt = this.el.querySelector('.prompt');
    this.$toast = this.el.querySelector('.toast');
    this._toastTimer = null;

    game.events.on('player:hp', ({ hp, max }) => this.setHealth(hp, max));
    game.events.on('inventory:changed', () => this.setItems(game.inventory.list()));
    this.hide();
  }

  show() { this.el.classList.remove('hidden'); }
  hide() { this.el.classList.add('hidden'); }
  softHide() { this.el.classList.add('hidden-soft'); }
  softShow() { this.el.classList.remove('hidden-soft'); }

  setHealth(hp, max) {
    const prev = this.$hearts.children.length;
    this.$hearts.innerHTML = '';
    for (let i = 0; i < max; i++) {
      const s = document.createElement('span');
      s.className = 'heart' + (i < hp ? '' : ' empty');
      s.textContent = i < hp ? '♥' : '♡';
      this.$hearts.appendChild(s);
    }
    if (prev) { const last = this.$hearts.children[Math.max(0, hp - 1)]; last?.classList.add('pop'); setTimeout(() => last?.classList.remove('pop'), 150); }
  }

  setItems(list) {
    this.$items.innerHTML = '';
    for (const { count, def } of list) {
      const d = document.createElement('div');
      d.className = 'item'; d.title = def.desc || '';
      d.innerHTML = `<span class="icon">${def.icon}</span><span class="name">${def.name}</span>` + (count > 1 || def.stackable ? `<span class="count">×${count}</span>` : '');
      this.$items.appendChild(d);
    }
  }

  setObjective(text) { this.$objective.innerHTML = text ? `<b>목표</b>${text}` : ''; }
  setStageName(meta) { this.$stage.textContent = meta ? `${meta.id.toUpperCase()} · ${meta.title}` : ''; }

  /** 월드 좌표 위에 프롬프트 표시 */
  showPrompt(text, worldX, worldY) {
    const r = this.game.renderer.domElement;
    const p = this.game.camera.project(worldX, worldY, 0, r.clientWidth, r.clientHeight);
    this.$prompt.style.left = `${p.x}px`; this.$prompt.style.top = `${p.y - 10}px`;
    this.$prompt.querySelector('span').textContent = text;
    this.$prompt.classList.remove('hidden');
  }
  hidePrompt() { this.$prompt.classList.add('hidden'); }

  toast(text, duration = 2.2) {
    this.$toast.textContent = text;
    this.$toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.$toast.classList.remove('show'), duration * 1000);
  }
}
