/**
 * 1장 대화 스크립트.
 * 형식은 engine/DialogueSystem.js 상단 주석 참고.
 * 플래그 규약: met_elder / asked_who / asked_where / gate_1_open / got:key_1 / cleared:stage-1-1
 */
export const CH1_DIALOGUES = [
  // ── 오프닝 (컷씬에서 재생) ──
  {
    id: 'intro_monologue',
    lines: [
      { speaker: 'narrator', text: '차가운 흙냄새. 멀리서 물 흐르는 소리.' },
      { speaker: 'mo', text: '……여긴, 어디지.' },
      { speaker: 'thought', text: '이름이 떠오르지 않는다. 어제가 떠오르지 않는다.\n다만 — 어디론가 가야 한다는 감각만이 남아 있다.' },
      { speaker: 'narrator', text: '동쪽에서 희미한 불빛이 흔들린다.' },
    ],
  },

  // ── 표지판 ──
  { id: 'sign_start', lines: [{ speaker: 'sign', text: '→ 동쪽 · 감시탑\n"돌아오지 못한 자들의 이름을 여기 새기지 못했다."' }] },

  // ── 등불 노인: 첫 만남 (선택지 분기) ──
  {
    id: 'elder_first',
    lines: [
      { speaker: 'elder', text: '……깨어났군. 이 숲에서 깨어나는 이는 오랜만이다.' },
      { speaker: 'mo', text: '당신은……' },
      {
        choice: [
          { text: '당신은 누구죠?', set: 'asked_who', then: [
            { speaker: 'elder', text: '이름은 오래전에 숲에 두고 왔다. 등불을 지키는 자, 그거면 된다.' },
          ] },
          { text: '여긴 어디죠?', set: 'asked_where', then: [
            { speaker: 'elder', text: '잊혀진 것들이 흘러드는 곳. 사람들은 숲이라 부르지만, 사실은 기억의 강바닥이지.' },
          ] },
          { text: '(말없이 바라본다)', set: 'silent_first', then: [
            { speaker: 'elder', text: '……말이 없군. 그것도 나쁘지 않다. 여기선 말보다 발이 먼저지.' },
          ] },
        ],
      },
      { speaker: 'elder', text: '네가 가야 할 길은 저 동쪽 문 너머다. 하지만 문은 오래전에 잠겼어.' },
      { speaker: 'elder', text: '위쪽 감시탑에 레버가 있다. 그걸 당기면 문이 열릴 거다. 조심해라 — 요즘 숲에 "덩어리"들이 돌아다닌다.' },
      { speaker: 'elder', text: '그리고 푸르게 빛나는 조각을 보면 주워라. 그건 네 것일지도 모르니.' },
      { set: 'met_elder', emit: 'story:objective', data: '감시탑의 레버를 당겨 동쪽 문을 열자' },
    ],
  },

  // ── 등불 노인: 재대화 (상태에 따라 다른 말) ──
  {
    id: 'elder_repeat',
    lines: [
      { if: 'got:key_1', then: [
          { speaker: 'elder', text: '열쇠를 찾았군. 그 열쇠가 어디에 맞는지는… 가보면 알 거다.' },
          { if: 'item:memory_fragment>=3', then: [{ speaker: 'elder', text: '조각도 꽤 모았고. 언젠가 그것들이 네게 이름을 돌려줄지도.' }] },
          { speaker: 'elder', text: '가라. 등불은 여기서 계속 타고 있을 테니.' },
        ],
        else: [
          { if: 'gate_1_open', then: [
              { speaker: 'elder', text: '문이 열리는 소리를 들었다. 문 너머 어딘가에 열쇠가 있을 거다.' },
            ],
            else: [
              { speaker: 'elder', text: '레버는 위쪽 감시탑에 있다. 발판을 딛고 올라가 봐라.' },
              { speaker: 'elder', text: '덩어리는 위에서 밟거나, 손에 든 것으로 쳐라. 정면으로 부딪히진 말고.' },
            ] },
        ] },
    ],
  },

  // ── 이벤트 ──
  { id: 'gate_opened', lines: [
      { speaker: 'narrator', text: '어딘가에서 무거운 것이 끌려 올라가는 소리가 숲을 울렸다.' },
      { emit: 'story:objective', data: '열린 동쪽 문 너머로 가자' },
  ] },
  { id: 'found_key', lines: [
      { speaker: 'thought', text: '낡은 열쇠. 손에 닿는 순간, 낯선 방의 문고리가 스쳐 지나갔다.' },
      { speaker: 'thought', text: '……누군가가 이 문을 잠갔다. 내가?' },
      { emit: 'story:objective', data: '열쇠로 출구의 문을 열자' },
  ] },
  { id: 'first_fragment', lines: [
      { speaker: 'thought', text: '차갑다. 그런데 어딘가 익숙한 온도다.' },
  ] },
  { id: 'door_locked', lines: [{ speaker: 'narrator', text: '문은 굳게 닫혀 있다. 열쇠 구멍이 희미하게 빛난다.' }] },

  // ── 1-2 (플레이스홀더) ──
  { id: 'sign_todo', lines: [
      { speaker: 'sign', text: '여기부터는 아직 쓰이지 않은 이야기.\nstages/ch1/ 에 새 Stage 클래스를 만들고 story/chapters.js 에 등록하세요.' },
  ] },
  { id: 'stage12_intro', lines: [
      { speaker: 'narrator', text: '문 너머의 숲은 더 조용했다. 등불의 빛이 등 뒤에서 멀어졌다.' },
  ] },
];
