import { Stage } from '../engine/Stage.js';
import { buildFromAscii } from '../engine/LevelLayout.js';
import { NPC } from '../entities/NPC.js';
import { Enemy } from '../entities/Enemy.js';
import { Collectible } from '../entities/Items.js';
import { Sign, Lever, Gate, ExitDoor, Checkpoint, Trigger } from '../entities/Interactables.js';
import { MovingPlatform, Hazard } from '../entities/Terrain.js';
import * as Decor from '../entities/Decor.js';

/**
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  스테이지 템플릿 — 이 파일을 복사해서 나만의 스테이지를 만드세요.        │
 * │  테스트: 브라우저에서  http://localhost:8080/?stage=stage-template     │
 * │  (chapters.js 에 넣지 않았으므로 본편 진행에는 영향을 주지 않는 연습장)   │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * 대화는 여기서 인라인({ lines: [...] })으로 바로 씁니다 — 다른 파일을 안 건드려도 됩니다.
 * 나중에 정식 스테이지로 만들 땐 대화를 story/dialogues/ 로 옮기고 id로 참조하세요.
 */

// ── 지형 지도 ──  '#' 땅  '=' 아래서 통과 가능한 발판  '.' 빈칸
//    맨 아랫줄이 y = 0..1. 한 칸 = 1유닛(캐릭터 키의 약 2/3).
//    점프 최대 높이 ≈ 3.5칸, 도약 거리 ≈ 6칸.  글자는 legend 로 좌표를 받습니다.
const MAP = `
..........................................
..........................................
....................========..............
..........................................
...........====...........................
..........................................
S....N.........o.................L.....E...
##########....######....####........######
##########....######....####........######
`;

export class Stage_Template extends Stage {
  // id 는 고유해야 합니다. 파일마다 다르게.
  static meta = { id: 'stage-template', title: '연습장', subtitle: '자유롭게 고쳐 보세요', chapter: null };
  // 분위기(선택). 생략하면 기본값. sky=하늘색, fog=안개 시작/끝 거리
  static env = { sky: 0x1a2230, fog: { near: 20, far: 75 } };

  async build() {
    const g = this.game;

    // 1) 카메라가 보여줄 범위 + 낙사선
    this.setBounds({ minX: 0, maxX: 42, minY: -1, maxY: 16 });
    this.killY = -6;

    // 2) 지형 + 마커. legend 로 특정 글자 위치에 엔티티를 배치.
    buildFromAscii(this, MAP, {
      legend: {
        S: (x, y) => this.spawnPlayer(x, y),                       // 시작 지점
        N: (x, y) => this.#npc(x, y),                              // NPC
        o: (x, y) => this.add(new Collectible({ x, y, itemId: 'memory_fragment', uid: 't_frag' })),
        E: (x, y) => this.add(new Enemy({ name: 'slime', x, y: y - 0.2, patrol: { minX: x - 2, maxX: x + 2 } })),
        L: (x, y) => this.#lever(x, y),                            // 레버(문을 연다)
      },
    });

    // 3) 배경 장식(3D). z가 뒤로 갈수록 시차로 천천히 움직입니다.
    this.addObject(Decor.groundPlane(-10, 60, -3, -1));
    this.addObject(Decor.forest(-5, 50, 2, -5, { count: 18, seed: 4 }));
    this.addObject(Decor.hills(-10, 55, -2, -30, { count: 5, seed: 8 }));
    this.dust = this.addObject(Decor.particles(0, 42, 1, 10, { count: 60, seed: 2 }));

    // 4) 표지판 / 문 / 체크포인트 / 출구
    this.add(new Sign({ x: 2, y: 8.75, dialogue: { lines: [
      { speaker: 'sign', text: 'E키로 말 걸기 · ←→ 이동 · Space 점프 · J 공격' },
    ] } }));
    this.gate = this.add(new Gate({ x: 30, y: 9.5, w: 1, h: 5, flag: 'template_gate', auto: false }));
    this.add(new Checkpoint({ x: 26, y: 9 }));
    // 출구: 조각을 1개 이상 모아야 열림. (requires 조건은 story 플래그로 판단)
    this.add(new ExitDoor({ x: 40, y: 8.8, requires: 'item:memory_fragment>=1',
      lockedText: '기억 조각을 하나라도 주워야 문이 반응한다.' }));

    // 5) 영역 트리거: 특정 지점에 들어오면 1회 발동
    this.add(new Trigger({ x: 20, y: 9, w: 2, h: 3, flag: 't_saw', onEnter: () => {
      g.hud.toast('여기서 무슨 일이든 일어나게 할 수 있어요');
    } }));

    this.setObjective('연습장을 둘러보고 오른쪽 문으로 나가자');
  }

  // 진입 직후 컷씬(선택). 없으면 이 메서드를 지워도 됩니다.
  async onEnter() {
    if (this.game.story.has('template_seen')) return;                // 재입장 시 생략
    await this.game.cutscene(async (cs) => {
      await cs.say({ lines: [
        { speaker: 'narrator', text: '여기는 연습장. 이 파일(_Template.js)을 고치면 바로 반영됩니다.' },
      ] });
      cs.set('template_seen');
    }, { letterbox: false });
  }

  onUpdate(dt) { this.dust.update?.(this.time); }

  // ── 헬퍼: 상태에 따라 다른 대사를 하는 NPC ──
  #npc(x, y) {
    this.add(new NPC({ name: 'guide', x, y, color: 0xd8c9a3, cloth: 0x4d5a44,
      dialogue: () => ({ lines: [
        { speaker: 'guide', text: '무엇을 도와줄까?' },
        { choice: [
          { text: '길을 알려줘', then: [
            { speaker: 'guide', text: '위쪽 레버를 당기면 문이 열려. 그다음 오른쪽으로.' },
            { emit: 'story:objective', data: '레버를 당겨 문을 열자' },
          ] },
          { text: '조각이 뭐야?', then: [
            { speaker: 'guide', text: '푸르게 빛나는 것. 주우면 출구가 반응하지.' },
          ] },
          // if 로 조건부 선택지도 가능: 특정 플래그가 있을 때만 보이게
          { text: '(고맙다고 인사한다)', if: 'template_seen', then: [
            { speaker: 'guide', text: '언제든.' },
          ] },
        ] },
      ] }),
    }));
  }

  // ── 헬퍼: 레버 → 카메라가 문으로 이동 → 문 열림 → 복귀 ──
  #lever(x, y) {
    this.add(new Lever({ x, y, flag: 'template_gate', onToggle: () => this.game.cutscene(async (cs) => {
      await cs.panTo(this.gate.x, this.gate.y, 1.0);
      await this.gate.open();
      await cs.say({ lines: [{ speaker: 'narrator', text: '문이 열렸다.' }] });
      await cs.panBack(0.8);
    }) }));
  }
}
