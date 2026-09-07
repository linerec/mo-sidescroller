export const DRAFT_PREFIX = 'mo:map-draft:v1:';
export const MAP_IDS = ['stage-1-1', 'stage-1-2'];
export const PROP_IDS = ['tree_oak','tree_birch','tree_willow','bush_0','bush_1','fern','mushrooms','flowers','grass','rock','arch','distant_tree','hill','ancient_tree','root_arch','glow_reeds','hanging_vine'];
export const LAYERS = { far: -32, mid: -12, near: -3 };
/** 맵 JSON에 담을 수 있는 게임플레이 엔티티 종류 (배치는 데이터, 이야기 연결은 스테이지 코드) */
export const ENTITY_TYPES = ['sign','npc','enemy','item','lever','gate','exit','checkpoint','hazard'];

export function validateMap(input) {
  const m = structuredClone(input);
  if (!m || typeof m !== 'object' || m.version !== 1 || !MAP_IDS.includes(m.id)) throw new Error('맵 버전 또는 스테이지 ID가 올바르지 않습니다.');
  if (!Array.isArray(m.rows) || m.rows.length < 4 || m.rows.length > 64) throw new Error('맵 높이는 4~64칸이어야 합니다.');
  const width = m.rows[0]?.length;
  if (!Number.isInteger(width) || width < 8 || width > 160 || m.rows.some(r => typeof r !== 'string' || r.length !== width || /[^.#=]/.test(r))) throw new Error('맵은 8~160칸 너비의 직사각형이며 . # = 문자만 사용할 수 있습니다.');
  if (!['morning','glade'].includes(m.mood) || !Number.isInteger(m.seed)) throw new Error('숲 분위기 또는 seed가 올바르지 않습니다.');
  if (!m.spawn || !Number.isFinite(m.spawn.x) || !Number.isFinite(m.spawn.y) || m.spawn.x < 0 || m.spawn.x >= width || m.spawn.y < 0 || m.spawn.y > m.rows.length + 2) throw new Error('시작 위치가 맵 밖입니다.');
  if (!Array.isArray(m.decorations) || m.decorations.length > 300) throw new Error('장식은 300개까지 배치할 수 있습니다.');
  for (const p of m.decorations) {
    if (!PROP_IDS.includes(p.asset) || !Object.hasOwn(LAYERS,p.layer) || ![p.x,p.y,p.scale].every(Number.isFinite) || p.scale < .25 || p.scale > 3 || p.x < -50 || p.x > width+50 || p.y < -10 || p.y > 70) throw new Error('장식의 종류·위치·배율을 확인하세요.');
  }
  // 게임플레이 엔티티 (선택) — 없으면 빈 배열. 좌표는 월드 단위(좌하단 0,0)
  if (m.entities === undefined) m.entities = [];
  if (!Array.isArray(m.entities) || m.entities.length > 200) throw new Error('엔티티는 200개까지 배치할 수 있습니다.');
  for (const e of m.entities) {
    if (!e || !ENTITY_TYPES.includes(e.type)) throw new Error(`알 수 없는 엔티티 종류: ${e && e.type}`);
    if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) throw new Error('엔티티 좌표가 올바르지 않습니다.');
    if (e.ref !== undefined && typeof e.ref !== 'string') throw new Error('엔티티 ref는 문자열이어야 합니다.');
  }
  m.autoForest = m.autoForest !== false;
  return m;
}

export async function loadMap(id, { draft = false } = {}) {
  if (!MAP_IDS.includes(id)) throw new Error('Unknown map');
  if (draft) {
    const raw = localStorage.getItem(DRAFT_PREFIX + id);
    if (!raw) throw new Error('저장된 편집 초안이 없습니다. 맵 편집기에서 먼저 저장하세요.');
    const map = validateMap(JSON.parse(raw));
    if(map.id !== id) throw new Error('초안의 스테이지 ID가 일치하지 않습니다.');
    return map;
  }
  const response = await fetch(new URL(`../../maps/${id}.json`, import.meta.url));
  if (!response.ok) throw new Error(`Map load failed: ${id}`);
  return validateMap(await response.json());
}

export function saveDraft(map) {
  const valid = validateMap(map);
  localStorage.setItem(DRAFT_PREFIX + valid.id, JSON.stringify(valid));
}

export function cell(rows,x,y) { return rows[rows.length-1-y]?.[x] || '.'; }
export function variant(x,y,seed=0) { return Math.abs(Math.imul(x+31,73856093) ^ Math.imul(y+17,19349663) ^ seed) % 2; }

/** Pure adjacency rules shared by gameplay, the editor and contract tests. */
export function tilePlacements(map) {
  const result=[], {rows,seed}=map;
  const add=(asset,x,y)=>result.push({asset,x,y,z:0,scale:1});
  for(let y=0;y<rows.length;y++) for(let x=0;x<rows[0].length;x++) {
    const ch=cell(rows,x,y);
    if(ch==='#') {
      add(variant(x,y,seed)?'soil_b':'soil_a',x,y);
      if(y===0)add('cliff_face',x,y);
      if(cell(rows,x,y+1)!=='#') add(variant(x,y,seed)?'top_b':'top_a',x,y+1);
      if(cell(rows,x-1,y)!=='#') add('edge_left',x,y);
      if(cell(rows,x+1,y)!=='#') add('edge_right',x,y);
      if(y>0 && cell(rows,x,y-1)!=='#' && variant(x,y,seed)) add('roots',x,y);
    } else if(ch==='=') {
      const left=cell(rows,x-1,y)==='=',right=cell(rows,x+1,y)==='=';
      add(!left&&!right?'platform_single':!left?'platform_left':!right?'platform_right':'platform_middle',x,y+.65);
    }
  }
  return result;
}
