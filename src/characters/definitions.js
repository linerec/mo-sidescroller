// Character contract v1. Paths resolve relative to this module, including subpath hosting.
export const MOTIONS = {
  idle: { duration: 2.4, loop: true, label: '가만히 숨쉬기' },
  run: { duration: 0.6, loop: true, label: '통통 달리기' },
  attack: { duration: 0.6, priority: 40, eventAt: 0.2, label: '말랑 박치기' },
  use_item: { duration: 1.2, priority: 40, eventAt: 0.6, label: '등불 사용' },
  sleepy: { duration: 3.2, loop: true, label: '꾸벅꾸벅 졸기' },
  jump: { duration: 0.5, priority: 20, label: '점프' },
  double_jump: { duration: 0.6, priority: 30, label: '빙글 더블점프' },
  fall: { duration: 0.8, loop: true, label: '내려오기' },
  land: { duration: 0.3, priority: 25, label: '말랑 착지' },
  hit: { duration: 0.2, priority: 80, next: 'damage', label: '맞는 순간' },
  damage: { duration: 0.7, priority: 70, label: '아파하며 회복' },
  happy: { duration: 1.4, priority: 10, label: '기쁨' },
  dead: { duration: 0.9, priority: 100, hold: true, label: '기운이 쏙' },
};

export const CHARACTER_DEFS = {
  mochi: {
    id: 'mochi', name: '모찌', version: 1,
    description: '말린 줄기를 얹은 동그란 찹쌀떡 모찌. 바닥에서는 말랑하게 눌리고 공중에서는 동그랗게 늘어난다.',
    model: new URL('../../assets/characters/mochi/mochi.glb', import.meta.url).href,
    scale: 1, collider: { w: 0.95, h: 1.08 }, facingAngle: 0.42,
    sleepAfter: 12, maxJumps: 2, motions: MOTIONS,
  },
};

export function characterDefinition(id) {
  const def = CHARACTER_DEFS[id];
  if (!def) throw new Error(`Unknown character: ${id}`);
  return def;
}
