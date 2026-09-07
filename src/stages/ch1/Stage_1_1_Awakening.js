import { Stage } from '../../engine/Stage.js';
import { buildFromAscii } from '../../engine/LevelLayout.js';
import { Trigger } from '../../entities/Interactables.js';
import { FOREST_ENV } from '../../world/ForestAtmosphere.js';
import { loadMap } from '../../world/MapData.js';
import { spawnMapEntities } from '../../world/MapEntities.js';
import { mountWoodland, dressForestKeeper } from '../../world/WoodlandStage.js';

/**
 * Stage 1-1 「깨어남」 — 프레임워크의 모든 요소를 한 번씩 보여주는 튜토리얼 스테이지.
 *  • 오프닝 컷씬(대화)   • NPC 대화 + 선택지(플래그 분기)   • 적 2종(밟기/공격)
 *  • 퍼즐: 감시탑 레버 → 문 개방 이벤트(카메라 연출)      • 수집 아이템 / 키 아이템 → 출구 잠금 해제
 *  • 낙사 구간 + 체크포인트                                 • 스테이지 클리어 → 다음 스테이지
 *
 * 지형은 ASCII로, 이야기 요소(NPC/트리거/아이템)는 좌표로 배치한다.
 *  '#' 지형   '=' 한쪽방향 발판   (한 칸 = 1 유닛, 맨 아랫줄 = y 0..1)
 */
// 감시탑: 지면(y2)에서 레버(y8)까지 오른쪽으로 올라가는 3단 계단.
//   P1 x21~28(y4) → P2 x29~36(y6) → P3 x37~44(y8, 레버). 각 도약 +2, 발판이 겹치지 않아
//   머리를 부딪히지 않고 앞으로 뛰어 오른다. P3는 게이트(x44)와 맞닿게 하여 오른쪽 끝에서
//   벽에 막힐 뿐 떨어지지 않는다(레버 발판↔게이트 사이 틈으로 빠지던 문제 수정).
//   실패해도 지면으로만 떨어짐(즉사 없음).
const GROUND = 2;   // 지면 윗면 y

export class Stage_1_1_Awakening extends Stage {
  static meta = { id: 'stage-1-1', title: '깨어남', subtitle: '차가운 흙냄새와 함께', chapter: 'ch1' };
  static env = FOREST_ENV.morning;

  async build() {
    const map = await loadMap(this.id, { draft: new URLSearchParams(location.search).get('draft') === this.id });
    this.game.applyEnvironment(FOREST_ENV[map.mood]);
    const g = this.game;
    this.setBounds({ minX: 0, maxX: map.rows[0].length, minY: -1, maxY: Math.max(30, map.rows.length + 4) });
    this.killY = -8;

    // ── 지형 ──
    buildFromAscii(this, map.rows.join('\n'), { tile: 1, visual: false });
    this.spawnPlayer(map.spawn.x, map.spawn.y);

    // Layered woodland art; terrain collision and stage routes remain stage-owned.
    await mountWoodland(this, map);

    // ── 배치는 데이터에서 (maps/stage-1-1.json 의 entities[]) ──
    //    표지판·NPC·적·수집품·레버/문·함정·체크포인트·출구가 전부 맵 JSON에서 생성된다.
    //    맵 에디터에서 옮기면 코드 수정 없이 반영되고, ?draft=stage-1-1 로 바로 확인할 수 있다.
    const refs = spawnMapEntities(this, map);

    // ── 이야기 연결은 코드에서 (데이터가 아닌 "행동"만) ──
    this.elder = refs.elder;
    if (this.elder) {
      this.elder.dialogue = () => (g.story.has('met_elder') ? 'elder_repeat' : 'elder_first');
      dressForestKeeper(this.elder, this.kit);
    }
    this.gate = refs.gate;
    if (refs.tower_lever) refs.tower_lever.onToggle = () => this.#gateEvent();

    // ── 트리거 (영역 진입 이벤트) ──
    this.add(new Trigger({ name: 'near-elder', x: 8.5, y: GROUND + 1.5, w: 2, h: 3, flag: 'saw_elder', onEnter: () => {
      if (!g.story.has('met_elder')) g.hud.toast('E 키로 말을 걸 수 있다');
    } }));
    this.add(new Trigger({ name: 'tower-foot', x: 27, y: GROUND + 1.5, w: 2, h: 3, flag: 'saw_tower', condition: 'met_elder', onEnter: () => {
      g.dialogue.play({ lines: [{ speaker: 'thought', text: '감시탑… 저 위에 레버가 있다고 했다.' }] });
    } }));

    // ── 아이템 획득에 반응하는 이야기 이벤트 ──
    this._off = [
      g.events.on('item:collected', ({ itemId }) => {
        if (itemId === 'old_key') g.cutscene(async (cs) => { await cs.wait(0.4); await cs.say('found_key'); }, { letterbox: false });
        else if (itemId === 'memory_fragment' && !g.story.has('first_fragment_seen')) { g.story.set('first_fragment_seen'); g.dialogue.play('first_fragment'); }
      }),
    ];
  }

  /** 스테이지 진입 직후: 오프닝 컷씬 (최초 1회) */
  async onEnter() {
    if (new URLSearchParams(location.search).get('draft') === this.id) { this.setObjective('숲 공방 · 편집 초안 테스트'); return; }
    const g = this.game;
    if (g.story.has('intro_seen')) { this.setObjective(g.story.has('met_elder') ? '감시탑의 레버를 당겨 동쪽 문을 열자' : '동쪽의 불빛을 향해 가자'); return; }
    await g.cutscene(async (cs) => {
      await cs.wait(0.8);
      await cs.say('intro_monologue');
      await cs.panTo(this.elder.x, this.elder.y + 1, 1.4);
      await cs.wait(0.9);
      await cs.panBack(1.0);
      cs.set('intro_seen');
      cs.objective('동쪽의 불빛을 향해 가자');
    });
  }

  /** 레버 이벤트: 카메라가 문으로 이동 → 문 개방 → 나레이션 → 복귀 */
  #gateEvent() {
    return this.game.cutscene(async (cs) => {
      await cs.wait(0.3);
      await cs.panTo(this.gate.x, this.gate.y, 1.2);
      await this.gate.open();
      await cs.say('gate_opened');
      await cs.panBack(1.0);
    });
  }

  onUpdate(dt) { this.forest.update(this.time); }

  onExit() { this._off?.forEach((f) => f()); }
}
