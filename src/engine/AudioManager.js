/**
 * AudioManager — 에셋 없이 WebAudio로 합성한 효과음. 추후 실제 사운드 파일로 교체 가능.
 * 브라우저 정책상 첫 사용자 입력 이후에만 재생된다 (unlock()).
 */
export class AudioManager {
  ctx = null; muted = false; volume = 0.35;

  unlock() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.ctx = null; }
  }

  /** 짧은 톤 재생: freq(Hz) → freqEnd 로 슬라이드 */
  #tone({ type = 'square', freq = 440, freqEnd = freq, dur = 0.1, vol = 1, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    gain.gain.setValueAtTime(this.volume * vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  play(name) {
    switch (name) {
      case 'jump':    return this.#tone({ type: 'square', freq: 300, freqEnd: 600, dur: 0.12, vol: 0.5 });
      case 'land':    return this.#tone({ type: 'triangle', freq: 120, freqEnd: 60, dur: 0.08, vol: 0.5 });
      case 'collect': this.#tone({ type: 'sine', freq: 880, freqEnd: 880, dur: 0.08 }); return this.#tone({ type: 'sine', freq: 1320, dur: 0.16, delay: 0.07 });
      case 'hurt':    return this.#tone({ type: 'sawtooth', freq: 220, freqEnd: 80, dur: 0.3, vol: 0.7 });
      case 'stomp':   return this.#tone({ type: 'square', freq: 200, freqEnd: 50, dur: 0.15 });
      case 'attack':  return this.#tone({ type: 'sawtooth', freq: 500, freqEnd: 200, dur: 0.08, vol: 0.4 });
      case 'lever':   this.#tone({ type: 'square', freq: 160, dur: 0.08 }); return this.#tone({ type: 'square', freq: 240, dur: 0.12, delay: 0.1 });
      case 'gate':    return this.#tone({ type: 'sawtooth', freq: 60, freqEnd: 90, dur: 1.2, vol: 0.5 });
      case 'checkpoint': [523, 659, 784].forEach((f, i) => this.#tone({ type: 'sine', freq: f, dur: 0.2, delay: i * 0.09 })); return;
      case 'clear':   [523, 659, 784, 1046].forEach((f, i) => this.#tone({ type: 'triangle', freq: f, dur: 0.3, delay: i * 0.12 })); return;
      case 'die':     return this.#tone({ type: 'sawtooth', freq: 300, freqEnd: 40, dur: 0.8, vol: 0.6 });
      case 'tick':    return this.#tone({ type: 'sine', freq: 700, dur: 0.04, vol: 0.4 });
      case 'confirm': return this.#tone({ type: 'sine', freq: 900, freqEnd: 1200, dur: 0.1, vol: 0.4 });
      case 'talk':    return this.#tone({ type: 'sine', freq: 600, dur: 0.04, vol: 0.2 });
      default: return;
    }
  }
}
