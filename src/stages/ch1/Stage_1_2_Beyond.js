import { Stage } from '../../engine/Stage.js';
import { buildFromAscii } from '../../engine/LevelLayout.js';
import { Sign, ExitDoor } from '../../entities/Interactables.js';
import { Enemy } from '../../entities/Enemy.js';
import { MovingPlatform } from '../../entities/Terrain.js';
import { FOREST_ENV } from '../../world/ForestAtmosphere.js';
import { loadMap } from '../../world/MapData.js';
import { mountWoodland, dressMovingPlatform } from '../../world/WoodlandStage.js';

/**
 * Stage 1-2 「문 너머」 — 다음 스테이지로 "넘어간다"는 흐름을 보여주는 짧은 플레이스홀더.
 * 이동 발판 예시 포함. 여기서 출구로 나가면 (chapters.js 의 마지막 스테이지이므로) 엔딩 화면.
 */

export class Stage_1_2_Beyond extends Stage {
  static meta = { id: 'stage-1-2', title: '문 너머', subtitle: '등불의 빛이 등 뒤에서 멀어졌다', chapter: 'ch1' };
  static env = FOREST_ENV.glade;

  async build() {
    const map = await loadMap(this.id, { draft: new URLSearchParams(location.search).get('draft') === this.id });
    this.game.applyEnvironment(FOREST_ENV[map.mood]);
    this.setBounds({ minX: 0, maxX: map.rows[0].length, minY: -1, maxY: Math.max(20, map.rows.length + 4) });
    buildFromAscii(this, map.rows.join('\n'), { tile: 1, visual: false });
    this.spawnPlayer(map.spawn.x, map.spawn.y);

    await mountWoodland(this, map);

    this.add(new Sign({ x: 4, y: 2.75, dialogue: 'sign_todo' }));
    const moving = this.add(new MovingPlatform({ x: 8, y: 1.6, w: 3, h: 0.5, to: { x: 15, y: 1.6 }, speed: 2.5, visual: false }));
    dressMovingPlatform(moving, this.kit);
    this.add(new Enemy({ name: 'slime', x: 24, y: 2.5, patrol: { minX: 20, maxX: 27 } }));
    this.add(new ExitDoor({ x: 28, y: 2.8, prompt: '계속' }));
    this.setObjective('앞으로 나아가자');
  }

  async onEnter() {
    if (new URLSearchParams(location.search).get('draft') === this.id) { this.setObjective('숲 공방 · 편집 초안 테스트'); return; }
    if (this.game.story.has('s12_intro')) return;
    await this.game.cutscene(async (cs) => { await cs.wait(0.5); await cs.say('stage12_intro'); cs.set('s12_intro'); }, { letterbox: false });
  }

  onUpdate() { this.forest.update(this.time); }
}
