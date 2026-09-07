import { NPC } from '../entities/NPC.js';
import { Enemy, Beetle } from '../entities/Enemy.js';
import { Collectible } from '../entities/Items.js';
import { Hazard } from '../entities/Terrain.js';
import { Sign, Lever, Gate, ExitDoor, Checkpoint } from '../entities/Interactables.js';

/**
 * 맵 JSON의 entities[] 를 실제 엔티티로 생성한다.
 * "어디에 무엇이 있는가"는 데이터(maps/<id>.json), "어떤 이야기가 붙는가"는 스테이지 코드가 담당한다.
 *
 * 각 항목: { type, x, y, ref?, ...타입별 옵션, opts?:{생성자에 그대로 전달} }
 *   ref 를 주면 반환 객체에 담겨 스테이지가 동작을 연결할 수 있다.
 *     const refs = spawnMapEntities(this, map);
 *     this.gate = refs.gate;
 *     refs.tower_lever.onToggle = () => this.#gateEvent();
 */

/** undefined 키 제거 — 서브클래스 기본값(예: Beetle의 hp:2)을 덮어쓰지 않도록 */
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
/** "#rrggbb" 또는 숫자 → 0xRRGGBB */
const hex = (v) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) ? parseInt(v.slice(1), 16)
  : (Number.isFinite(v) ? v : undefined);

export function spawnMapEntities(stage, map) {
  const refs = {};
  for (const e of map.entities || []) {
    const base = { x: e.x, y: e.y, ...(e.opts || {}) };
    let ent = null;
    switch (e.type) {
      case 'sign':
        ent = new Sign(clean({ ...base, text: e.text, dialogue: e.dialogue, prompt: e.prompt })); break;
      case 'npc':
        ent = new NPC(clean({ ...base, name: e.name, dialogue: e.dialogue, prompt: e.prompt,
          color: hex(e.color), cloth: hex(e.cloth), height: e.height, facing: e.facing })); break;
      case 'enemy': {
        const C = e.variant === 'beetle' ? Beetle : Enemy;
        ent = new C(clean({ ...base, name: e.name, patrol: e.patrol, speed: e.speed, hp: e.hp,
          damage: e.damage, stompable: e.stompable, color: hex(e.color) })); break;
      }
      case 'item':
        ent = new Collectible(clean({ ...base, itemId: e.itemId, uid: e.uid, count: e.count, once: e.once })); break;
      case 'lever':
        ent = new Lever(clean({ ...base, flag: e.flag, once: e.once, prompt: e.prompt })); break;
      case 'gate':
        ent = new Gate(clean({ ...base, flag: e.flag, w: e.w, h: e.h, auto: e.auto, openBy: e.openBy })); break;
      case 'exit':
        ent = new ExitDoor(clean({ ...base, requires: e.requires, requiresItem: e.requiresItem,
          lockedText: e.lockedText, prompt: e.prompt })); break;
      case 'checkpoint':
        ent = new Checkpoint(clean({ ...base })); break;
      case 'hazard':
        ent = new Hazard(clean({ ...base, kind: e.kind, w: e.w, h: e.h, damage: e.damage })); break;
      default:
        console.warn('[MapEntities] 알 수 없는 엔티티 종류:', e.type); continue;
    }
    stage.add(ent);
    if (e.ref) refs[e.ref] = ent;
  }
  return refs;
}
