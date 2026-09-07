/** Fade — 화면 암전/밝아짐. out()/in() 은 Promise. */
export class Fade {
  constructor(root) {
    this.el = document.createElement('div'); this.el.id = 'fade';
    root.appendChild(this.el);
  }
  #to(opacity, dur) {
    this.el.style.transition = `opacity ${dur}s ease`;
    // 리플로우 강제 후 적용 (rAF는 탭이 백그라운드일 때 멈추므로 사용하지 않음)
    void this.el.offsetHeight;
    this.el.style.opacity = opacity;
    return new Promise((res) => setTimeout(res, dur * 1000 + 30));
  }
  out(dur = 0.6) { return this.#to(1, dur); }
  in(dur = 0.6) { return this.#to(0, dur); }
  set(a) { this.el.style.transition = 'none'; this.el.style.opacity = a; }
}

/** Letterbox — 컷씬용 상하 검은 바 */
export class Letterbox {
  constructor(root) {
    this.el = document.createElement('div'); this.el.id = 'letterbox';
    this.el.innerHTML = '<div class="bar top"></div><div class="bar bottom"></div>';
    root.appendChild(this.el);
  }
  set(on) { this.el.classList.toggle('on', on); }
}

/** TitleCard — 챕터/스테이지 진입 시 검은 화면 위의 제목 (LIMBO/INSIDE 풍) */
export class TitleCard {
  constructor(root) {
    this.el = document.createElement('div'); this.el.id = 'title-card'; this.el.classList.add('hidden');
    this.el.innerHTML = '<div class="chapter"></div><div class="title"></div><div class="subtitle"></div>';
    root.appendChild(this.el);
  }
  async show({ chapter = '', title = '', subtitle = '', hold = 1.8 } = {}) {
    this.el.querySelector('.chapter').textContent = chapter;
    this.el.querySelector('.title').textContent = title;
    this.el.querySelector('.subtitle').textContent = subtitle;
    this.el.classList.remove('hidden');
    void this.el.offsetHeight;
    this.el.style.opacity = 1;
    await new Promise((r) => setTimeout(r, 800));
    await new Promise((r) => setTimeout(r, hold * 1000));
    this.el.style.opacity = 0;
    await new Promise((r) => setTimeout(r, 800));
    this.el.classList.add('hidden');
  }
}
