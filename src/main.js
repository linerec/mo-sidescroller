import { Game } from './engine/Game.js';
import { STAGES } from './stages/index.js';
import { CHAPTERS } from './story/chapters.js';
import { ITEMS } from './story/items.js';
import { CHARACTERS } from './story/characters.js';
import { DIALOGUES } from './story/dialogues/index.js';

/**
 * 진입점. 개발 편의:
 *   ?stage=stage-1-2   → 타이틀 건너뛰고 해당 스테이지로 바로 진입
 *   window.game        → 콘솔에서 엔진 접근 (game.story.set('gate_1_open') 등)
 */
const params = new URLSearchParams(location.search);

const game = new Game({
  canvas: document.getElementById('gl'),
  uiRoot: document.getElementById('ui'),
  registry: STAGES,
  chapters: CHAPTERS,
  items: ITEMS,
  characters: CHARACTERS,
  dialogues: DIALOGUES,
  startStage: params.get('stage'),
});

window.game = game;
game.start();
