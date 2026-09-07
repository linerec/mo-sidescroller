import * as THREE from 'three';

/**
 * Decor — 게임플레이에 영향 없는 3D 배경/전경 장식 생성기.
 * 카메라가 원근이므로 z가 멀수록 천천히 움직여 자연스러운 시차(parallax)가 생긴다.
 * 모든 함수는 THREE.Object3D 를 반환 → stage.addObject(...) 로 추가.
 */
export function seeded(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const M = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, ...opts });

/** 나무: 기둥 + 원뿔 잎 (leafColor 생략 시 어두운 청록) */
export function tree(x, y, z, { scale = 1, trunk = 0x3a2e26, leaf = 0x1f3b36, layers = 3 } = {}) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.2 * scale, 1.6 * scale, 7), M(trunk));
  t.position.y = 0.8 * scale; g.add(t);
  for (let i = 0; i < layers; i++) {
    const r = (1.2 - i * 0.28) * scale, h = 1.4 * scale;
    const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), M(leaf));
    c.position.y = (1.5 + i * 0.85) * scale; g.add(c);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.position.set(x, y, z);
  return g;
}

/** 나무 무리: x0~x1 구간에 count 개 (z 주변에 흩뿌림) */
export function forest(x0, x1, y, z, { count = 12, seed = 7, spread = 3, scaleMin = 0.8, scaleMax = 1.8, leaf } = {}) {
  const rnd = seeded(seed), g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const x = x0 + (x1 - x0) * (i + rnd() * 0.8) / count;
    const zz = z - rnd() * spread, s = scaleMin + rnd() * (scaleMax - scaleMin);
    g.add(tree(x, y - 0.3 - rnd() * 0.4, zz, { scale: s, leaf }));
  }
  return g;
}

/** 먼 산/언덕: 납작한 구 */
export function hills(x0, x1, y, z, { count = 6, seed = 3, color = 0x223038, heightMin = 4, heightMax = 10 } = {}) {
  const rnd = seeded(seed), g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const h = heightMin + rnd() * (heightMax - heightMin), w = h * (1.6 + rnd());
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), M(color));
    m.scale.set(w, h, w * 0.6);
    m.position.set(x0 + (x1 - x0) * (i + rnd()) / count, y - h * 0.15, z - rnd() * 6);
    g.add(m);
  }
  return g;
}

/** 폐허 기둥 (전경/배경 겸용) */
export function pillar(x, y, z, { h = 4, r = 0.35, color = 0x4a4f57, broken = true } = {}) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, h, 10), M(color));
  m.position.y = h / 2; m.castShadow = m.receiveShadow = true; g.add(m);
  if (broken) { const cap = new THREE.Mesh(new THREE.BoxGeometry(r * 3, r * 0.8, r * 3), M(color)); cap.position.y = h + r * 0.4; cap.rotation.y = 0.3; cap.castShadow = true; g.add(cap); }
  g.position.set(x, y, z);
  return g;
}

/** 넓은 바닥판 (지형 아래 배경용) */
export function groundPlane(x0, x1, y, z, { depth = 40, color = 0x1a2128 } = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, depth), M(color));
  m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y, z - depth / 2); m.receiveShadow = true;
  return m;
}

/** 달/광원 원판 */
export function moon(x, y, z, { r = 3, color = 0xf4ecd8 } = {}) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshBasicMaterial({ color, fog: false }));
  m.position.set(x, y, z);
  return m;
}

/** 떠다니는 먼지/반딧불 파티클. update(t) 를 스테이지 onUpdate에서 호출하면 움직임 */
export function particles(x0, x1, y0, y1, { count = 80, seed = 11, color = 0xcfe8ff, size = 0.08, zMin = -3, zMax = 2 } = {}) {
  const rnd = seeded(seed), pos = new Float32Array(count * 3), base = [];
  for (let i = 0; i < count; i++) {
    const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0), z = zMin + rnd() * (zMax - zMin);
    pos.set([x, y, z], i * 3); base.push({ x, y, z, p: rnd() * 6.28, s: 0.3 + rnd() * 0.7 });
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.7, sizeAttenuation: true }));
  pts.update = (t) => {
    const a = geo.attributes.position.array;
    for (let i = 0; i < count; i++) { const b = base[i]; a[i * 3] = b.x + Math.sin(t * b.s + b.p) * 0.6; a[i * 3 + 1] = b.y + Math.cos(t * b.s * 0.7 + b.p) * 0.4; }
    geo.attributes.position.needsUpdate = true;
  };
  return pts;
}
