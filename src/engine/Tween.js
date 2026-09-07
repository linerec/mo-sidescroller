/** 간단한 트윈 시스템 — 연출(문 열림, 카메라 팬, 스쿼시 등)에 사용. Promise 반환. */
export const Ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => t * (2 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  outElastic: (t) => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1,
};

export class TweenManager {
  list = [];

  /**
   * to(target, { x: 1, y: 2 }, 0.5, { ease, onUpdate, delay })
   * target의 숫자 속성을 duration(초) 동안 보간한다.
   */
  to(target, props, duration = 0.5, { ease = Ease.outQuad, onUpdate, delay = 0 } = {}) {
    return new Promise((resolve) => {
      const from = {}; for (const k in props) from[k] = target[k];
      this.list.push({ target, props, from, duration, ease, onUpdate, t: -delay, resolve });
    });
  }

  /** duration 동안 매 프레임 fn(progress 0..1) 호출 */
  run(duration, fn, ease = Ease.linear) {
    return new Promise((resolve) => this.list.push({ duration, fn, ease, t: 0, resolve }));
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const tw = this.list[i];
      tw.t += dt;
      if (tw.t < 0) continue;
      const p = tw.duration <= 0 ? 1 : Math.min(1, tw.t / tw.duration);
      const e = tw.ease(p);
      if (tw.fn) tw.fn(e, p);
      else {
        for (const k in tw.props) tw.target[k] = tw.from[k] + (tw.props[k] - tw.from[k]) * e;
        tw.onUpdate?.(e);
      }
      if (p >= 1) { this.list.splice(i, 1); tw.resolve(); }
    }
  }

  killAll() { this.list.length = 0; }
}
