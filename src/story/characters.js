/**
 * 등장인물 정의 — 대화창의 화자 이름/색상.
 * 대화 라인의 speaker 키로 참조한다. 여기 없는 speaker는 문자열 그대로 표시된다.
 */
export const CHARACTERS = {
  mo:       { name: '모',     color: '#f1e6cf' },
  elder:    { name: '등불 노인', color: '#e9c46a' },
  narrator: { name: '',       color: '#b9b3a6' },   // 나레이션 (이름 없음)
  sign:     { name: '표지판',  color: '#9fb4c7' },
  thought:  { name: '모 (생각)', color: '#a7c4d8' },
};
