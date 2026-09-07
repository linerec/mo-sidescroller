# 스테이지 제작 가이드

## 1. 새 스테이지 만들기 (3단계)

```js
// src/stages/ch1/Stage_1_3_Example.js
import { Stage } from '../../engine/Stage.js';
import { buildFromAscii } from '../../engine/LevelLayout.js';
import { NPC } from '../../entities/NPC.js';
import { ExitDoor } from '../../entities/Interactables.js';

const MAP = `
..........................
.....P........###.........
##########....############
##########....############
`;

export class Stage_1_3_Example extends Stage {
  static meta = { id: 'stage-1-3', title: '제목', subtitle: '부제(타이틀카드에 표시)', chapter: 'ch1' };
  static env  = { sky: 0x18222b, fog: { near: 18, far: 70 } };   // 생략 가능

  async build() {
    this.setBounds({ minX: 0, maxX: 26, minY: -1, maxY: 20 });     // 카메라가 보여줄 범위
    const { marks } = buildFromAscii(this, MAP);                   // '#' 지형, '=' 한쪽방향 발판
    const p = marks.P[0]; this.spawnPlayer(p.x, p.y);             // 그 외 문자는 marks 로 돌려받음
    this.add(new NPC({ x: 8, y: 3, dialogue: 'some_dialogue_id' }));
    this.add(new ExitDoor({ x: 24, y: 2.8 }));
    this.setObjective('출구를 찾자');
  }

  async onEnter() { /* 진입 컷씬 (선택) */ }
  onUpdate(dt) { /* 매 스텝 (선택) */ }
  onExit() { /* 이벤트 구독 해제 등 (선택) */ }
}
```

1. 위 파일 작성
2. `src/stages/index.js` 의 `LIST` 에 클래스 추가
3. `src/story/chapters.js` 의 해당 챕터 `stages` 배열에 `'stage-1-3'` 추가

→ 이전 스테이지를 클리어하면 자동으로 이어집니다. `?stage=stage-1-3` 로 바로 테스트하세요.

## 2. 좌표계

- 한 유닛 = 대략 캐릭터 키의 2/3. 플레이어 바디는 0.7 × 1.5.
- ASCII 맵의 **맨 아랫줄이 y = 0..1**, 왼쪽이 x = 0. 지형 윗면 y = 줄 수.
- 점프 최대 높이 ≈ 3.5 유닛, 수평 도약 ≈ 6 유닛. **발판 간격은 세로 2~3, 가로 3~5** 정도가 편안합니다.
- z = 0 이 게임플레이 평면. 배경 장식은 음수 z, 전경은 양수 z (`Decor.*` 참고).
- 엔티티 y 는 바디 **중심**입니다. 지면 위에 세울 때: `y = 지면높이 + 바디높이/2`.

## 3. 사용 가능한 부품

| 클래스 | 용도 | 주요 옵션 |
|---|---|---|
| `Block` | 지형 | x,y,w,h,depth,color |
| `OneWayPlatform` | 아래서 통과 가능한 발판 | x,y,w |
| `MovingPlatform` | 왕복 이동 발판 | x,y,w,to:{x,y},speed,pause |
| `Hazard` | 가시(피해+넉백) / 낙사 구역(kind:'pit') | x,y,w,h,kind,damage |
| `NPC` | 대화 상대 | dialogue(id\|함수\|데이터), onInteract, color |
| `Enemy` / `Beetle` | 적 | hp,speed,patrol:{minX,maxX},stompable,damage |
| `Collectible` | 아이템 | itemId, uid(재입장 시 재생성 방지), count |
| `Sign` | 표지판 | text 또는 dialogue |
| `Lever` | 플래그 토글 | flag, onToggle(on), once |
| `Gate` | 플래그로 열리는 문 | flag, auto(플래그 감시), openBy:'up'\|'down', `await gate.open()` |
| `ExitDoor` | 출구 → `stage.complete()` | requires(조건), requiresItem, lockedText, onOpen |
| `Checkpoint` | 부활 지점 + 자동 저장 | x,y |
| `Trigger` | 영역 진입 이벤트 | w,h,once,condition,flag,onEnter,onExit |

## 4. 이야기 요소 배치 패턴

**NPC 대화가 진행 상황에 따라 달라지게**
```js
new NPC({ dialogue: () => game.story.has('met_elder') ? 'elder_repeat' : 'elder_first' })
```
그리고 `elder_repeat` 안에서 `{ if: 'gate_1_open', then: [...], else: [...] }` 로 세분화.

**퍼즐 → 연출 → 목표 갱신**
```js
this.gate = this.add(new Gate({ x, y, h: 7, flag: 'gate_1_open', auto: false }));
this.add(new Lever({ x, y, flag: 'gate_1_open', onToggle: () => game.cutscene(async (cs) => {
  await cs.panTo(this.gate.x, this.gate.y, 1.2);
  await this.gate.open();
  await cs.say('gate_opened');          // 대화 안에서 { emit: 'story:objective', data: '...' } 로 목표 갱신
  await cs.panBack();
}) }));
```

**아이템 획득에 반응**
```js
game.events.on('item:collected', ({ itemId }) => { if (itemId === 'old_key') game.dialogue.play('found_key'); });
```
(`onExit` 에서 구독 해제하세요 — 데모 스테이지의 `this._off` 패턴 참고)

**영역에 들어오면 한 번만 이벤트**
```js
this.add(new Trigger({ x, y, w: 2, h: 3, flag: 'saw_tower', condition: 'met_elder', onEnter: () => {...} }));
```
`flag` 를 주면 세이브 후 재입장해도 다시 발동하지 않습니다.

**스테이지 클리어 조건을 바꾸고 싶다면** — `ExitDoor` 대신 아무 데서나 `this.complete()`:
```js
game.events.on('enemy:died', () => { if (this.findAll('enemy').length === 0) this.complete(); });
```

## 5. 컷씬 API (`game.cutscene(async (cs) => { ... })`)

`cs.wait(sec)` · `cs.say(id | [라인들])` · `cs.walk(entity, x, speed)` · `cs.face(entity, ±1)` ·
`cs.panTo(x, y, dur)` · `cs.panToEntity(e, dur)` · `cs.panBack(dur)` · `cs.follow(e)` · `cs.zoom(distance, dur)` · `cs.shake(strength, dur)` ·
`cs.fadeOut(dur)` / `cs.fadeIn(dur)` · `cs.title({ chapter, title, subtitle })` · `cs.toast(text)` · `cs.objective(text)` ·
`cs.set(flag, value)` · `cs.give(itemId, n)` · `cs.emit(type, payload)` · `cs.tween.to(obj, props, dur)` · `cs.sfx(name)`

옵션: `game.cutscene(fn, { letterbox: false, hideHud: false })`

## 6. 저장/재입장 시 주의

- 스테이지는 **매번 새로 build** 됩니다. "이미 일어난 일"은 반드시 플래그로 판단하세요.
  (`Gate` 는 플래그가 있으면 열린 채로 생성, `Collectible` 은 `uid` 로 재생성 방지, `Lever` 는 `once` 로 비활성)
- 체크포인트 통과와 스테이지 클리어 시 자동 저장됩니다. 임의 시점 저장: `game.saveProgress()`.

## 7. Blender 숲 키트와 맵 공방

현재 두 스테이지는 `maps/*.json`을 읽고 `buildFromAscii(..., { visual: false })`로 충돌을 만든 뒤 `mountWoodland(this, map)`으로 Blender GLB를 조립합니다. 지형/조경은 [맵 공방](http://localhost:8080/map-editor.html)에서 편집할 수 있습니다. `onUpdate`에서 `forest.update(this.time)`를 호출하고 환경은 `FOREST_ENV[map.mood]`로 맞춥니다.

위의 ASCII 직접 작성 예시는 엔진의 기본 사용법입니다. 실제 숲 스테이지와 신규 모듈 제작은 [키트·맵 제작 가이드](WORLD_KIT.md)를 기준으로 진행하세요. NPC·적·문·레버·출구·이동 발판은 스테이지 코드에서 편집하며 지형 변경 후 동선과 좌표를 함께 확인합니다.
