/**
 * TerrainShapes — 비정규 지형의 "윤곽선"을 만드는 생성기 모음.
 * 모두 [[x,y], ...] (x 오름차순) 배열을 돌려주며, 그대로 TerrainSurface 에 넣으면 된다.
 *
 *   import * as T from '../../world/TerrainShapes.js';
 *   const pts = T.join(
 *     T.flat(0, 8, 2),
 *     T.cliff(8, 2, 7, { width: 1.2 }),     // 가파른 절벽
 *     T.ridge(9.2, 24, 7, { amp: 0.8 }),    // 울퉁불퉁한 능선
 *   );
 *
 * 한 x에 높이 하나(높이 함수)라는 제약이 있다 — 오버행/동굴은 AABB 블록과 섞어서 표현한다.
 */

const smoothstep = (t) => t * t * (3 - 2 * t);

/** 평평한 바닥 */
export function flat(x0, x1, y, steps = 2) {
  const pts = [];
  for (let i = 0; i <= steps; i++) pts.push([x0 + (x1 - x0) * (i / steps), y]);
  return pts;
}

/** 직선 경사 */
export function slope(x0, y0, x1, y1, steps = 8) {
  const pts = [];
  for (let i = 0; i <= steps; i++) { const t = i / steps; pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]); }
  return pts;
}

/** 가파른 절벽 — 짧은 폭에서 급격히 솟는 면 (maxSlope를 넘기면 못 오르고 막힌다) */
export function cliff(x, yBottom, yTop, { width = 0.8, steps = 20 } = {}) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([x + width * t, yBottom + (yTop - yBottom) * smoothstep(t)]);
  }
  return pts;
}

/** 둥근 언덕 하나 */
export function hill(x0, x1, baseY, height, steps = 40) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([x0 + (x1 - x0) * t, baseY + Math.sin(Math.PI * t) * height]);
  }
  return pts;
}

/** 타원 윗면 — 바위/등껍질 같은 볼록면 */
export function dome(cx, baseY, rx, ry, steps = 48) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, a = Math.PI * (1 - t);      // π → 0 (왼쪽에서 오른쪽으로)
    pts.push([cx + Math.cos(a) * rx, baseY + Math.sin(a) * ry]);
  }
  return pts;
}

/** 3차 베지에 곡선 — 자유로운 굴곡 */
export function bezier(p0, p1, p2, p3, steps = 48) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    const x = u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0];
    const y = u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1];
    pts.push([x, y]);
  }
  return pts;
}

/** 자연스러운 울퉁불퉁 능선 (seed 고정 노이즈) */
export function ridge(x0, x1, y, { amp = 1.2, freq = 0.35, seed = 1, steps = 120 } = {}) {
  const rand = (n) => { const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return s - Math.floor(s); };
  const noise = (t) => { const i = Math.floor(t), f = t - i, u = smoothstep(f); return rand(i) * (1 - u) + rand(i + 1) * u; };
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, px = x0 + (x1 - x0) * t;
    const n = noise(px * freq) * 0.7 + noise(px * freq * 2.3) * 0.3;
    pts.push([px, y + (n - 0.5) * 2 * amp]);
  }
  return pts;
}

/**
 * 커다란 괴물의 등 — 완만한 아치 위에 등뼈 마디가 얹힌 형태.
 * plates 로 마디 수, plateHeight 로 마디 높이를 조절한다.
 */
export function creatureBack({ x = 0, y = 0, length = 20, height = 4, plates = 5, plateHeight = 0.45, steps = 200 } = {}) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const arch = Math.pow(Math.sin(Math.PI * t), 0.7);                       // 몸통
    const plate = Math.pow(Math.abs(Math.sin(Math.PI * t * plates)), 1.6)    // 등딱지
                  * plateHeight * Math.sin(Math.PI * t);
    pts.push([x + length * t, y + arch * height + plate]);
  }
  return pts;
}

/** 윤곽선들을 이어붙인다 (x 오름차순 정렬 + 같은 x 중복 제거) */
export function join(...parts) {
  const all = [].concat(...parts).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const p of all) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev[0] - p[0]) < 1e-4) { out[out.length - 1] = [p[0], Math.max(prev[1], p[1])]; continue; }
    out.push([p[0], p[1]]);
  }
  return out;
}

/** 이동 평균으로 부드럽게 (모서리를 둥글릴 때) */
export function smooth(pts, passes = 1) {
  let p = pts.map((q) => [q[0], q[1]]);
  for (let k = 0; k < passes; k++) {
    const n = p.map((q, i) => {
      if (i === 0 || i === p.length - 1) return q;
      return [q[0], (p[i - 1][1] + q[1] * 2 + p[i + 1][1]) / 4];
    });
    p = n;
  }
  return p;
}

/** 윤곽선 전체를 평행이동 */
export function translate(pts, dx, dy) { return pts.map(([x, y]) => [x + dx, y + dy]); }
