import { Game } from './engine/Game.js';
import { STAGES } from './stages/index.js';
import { CHAPTERS } from './story/chapters.js';
import { ITEMS } from './story/items.js';
import { CHARACTERS } from './story/characters.js';
import { DIALOGUES } from './story/dialogues/index.js';
import { TouchControls } from './ui/TouchControls.js';

/**
 * 진입점. 개발 편의:
 *   ?stage=stage-1-2   → 타이틀 건너뛰고 해당 스테이지로 바로 진입
 *   ?touch=1 / ?touch=0 → 터치 조작 강제 표시 / 숨김 (데스크톱에서 확인용)
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

// 모바일 터치 조작 (터치 기기에서만 표시되고, 기존 키보드 입력과 그대로 공존한다)
game.touch = new TouchControls(game, document.getElementById('ui'));

// 모바일 성능: 픽셀 비율을 낮춰 프레임을 확보한다 (고해상도 폰에서 특히 효과가 크다)
if (TouchControls.isTouchDevice()) {
  game.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
}

window.game = game;
game.start();
