import { Stage_1_1_Awakening } from './ch1/Stage_1_1_Awakening.js';
import { Stage_1_2_Beyond } from './ch1/Stage_1_2_Beyond.js';
import { Stage_Template } from './_Template.js';   // 연습장 (?stage=stage-template)

/**
 * 스테이지 레지스트리: id → 클래스.
 * 진행 순서는 story/chapters.js 가 결정한다. 새 스테이지는 여기에 한 줄 추가.
 */
const LIST = [
  Stage_1_1_Awakening,
  Stage_1_2_Beyond,
  Stage_Template,
];

export const STAGES = Object.fromEntries(LIST.map((S) => [S.meta.id, S]));
