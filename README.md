# Mo — 2.5D 횡스크롤 액션 어드벤처 프레임워크

3D 오브젝트·3D 배경 위에서 **2D 횡스크롤로 움직이는** 이야기 중심 게임을 만들기 위한 보일러플레이트입니다.
슈퍼마리오의 조작감 + LIMBO의 분위기/연출을 목표로, 스테이지·아이템·퍼즐·적·이벤트·대사를 하나의 틀 안에서 다룹니다.

- 런타임: 브라우저 + [Three.js](https://threejs.org) (CDN import map, **빌드 도구 없음**)
- 플레이어: Blender로 제작한 Mochi GLB + 13개 애니메이션
- 배경: Blender 제작 24종 숲 키트 + 1m 격자 자동 조립. 나무·흙·발판·이끼·꽃·버섯·고사리 ([키트 가이드](docs/WORLD_KIT.md))
- 맵 공방: 지형 칠하기·소품 배치·3D 미리보기·초안 플레이·JSON 저장

## 실행

```bash
cd Mo
npm start            # → http://localhost:8080   (또는 python3 -m http.server 8080)
```

ES Module을 사용하므로 `file://`로 열면 동작하지 않습니다. 반드시 로컬 서버로 여세요.

개발 편의:
- `http://localhost:8080/?stage=stage-1-2` — 타이틀을 건너뛰고 특정 스테이지로 진입
- 브라우저 콘솔에서 `game` 객체로 엔진 접근 (`game.story.set('gate_1_open')`, `game.stage.complete()` …)

## Mochi 캐릭터

기본 플레이어에 동화풍 모찌가 적용되어 있습니다. 둥근 몸체가 지상에서 살짝 눌리고, 점프할 때 늘어났다가 착지 때 퍼집니다. [캐릭터 도감](http://localhost:8080/character-preview.html)에서 모든 동작을 회전·확대하며 확인할 수 있습니다.

- 대기, 달리기, 공격, 물건 사용, 졸기, 점프, 더블점프, 낙하, 착지, 맞는 순간, 피해 회복, 기쁨, 탈진의 13개 클립
- 12초 동안 가만히 있으면 졸기. 등불 획득 후 Q로 사용. 수집품/클리어에서 기쁨 표현
- 원본: `assets/characters/mochi/mochi.blend` · 게임 모델: `assets/characters/mochi/mochi.glb`
- [캐릭터 제작·게임 적용 가이드](docs/CHARACTER_AUTHORING.md) · [다음 캐릭터 설명 템플릿](docs/CHARACTER_BRIEF_TEMPLATE.md)
- 검사: `npm run check:character`

## 숲 맵 만들기

[맵 공방 열기](http://localhost:8080/map-editor.html) → 땅/발판 드래그 → 소품 배치 → **초안으로 플레이**. 정식 반영은 내보낸 JSON을 `maps` 폴더의 같은 파일에 저장합니다. NPC·적·문 등의 이야기 위치는 스테이지 코드에서 편집합니다.

- Blender 원본: `assets/environment/woodland/woodland-kit.blend`
- [모듈 원점·연결·충돌·새 에셋 추가 규약](docs/WORLD_KIT.md)
- 검사: `npm run check:world`

## 조작

| 키 | 동작 |
|---|---|
| ← → / A D | 이동 |
| SPACE / K | 점프 (길게 누르면 높이 ↑), 공중에서 한 번 더 누르면 더블점프 |
| J / X | 공격 |
| Q | 획득한 등불 사용 |
| E / ↑ / Enter | 상호작용 (대화, 레버, 문, 표지판) / 대화 넘기기 |
| ↓ + SPACE | 한쪽방향 발판 아래로 내려가기 |
| ESC | 일시정지 |
| ` (백틱) | 디버그 오버레이 (충돌 박스, 플래그) — `Shift+N` 다음 스테이지, `Shift+R` 세이브 초기화, `Shift+H` 회복 |

## 구조

```
index.html               진입 HTML (import map으로 three 로드)
src/main.js              Game 생성 + 스테이지/스토리 데이터 주입
src/engine/              ── 엔진 (게임 내용과 무관한 범용 부분)
  Game.js                메인 루프, 상태 머신, 렌더러/조명, 시스템 소유
  Stage.js               스테이지 기본 클래스 (build / onEnter / onUpdate / onExit / complete)
  StageManager.js        챕터 순서대로 스테이지 로드·전환·클리어
  Entity.js              모든 오브젝트의 기본 클래스 (mesh + body)
  Physics.js             XY 평면 AABB 물리 (중력, 한쪽방향 발판, 이동 발판, 센서)
  FollowCamera.js        횡스크롤 추적 카메라 (원근 → 자연스러운 시차), 팬/줌/흔들림
  DialogueSystem.js      대화창 + 대화 스크립트 실행 (분기, 선택지, 플래그, 아이템)
  Cutscene.js            async/await 로 쓰는 이벤트 연출 (카메라, 이동, 대사, 페이드)
  StoryState.js          스토리 플래그/변수 + 조건식 평가
  Inventory.js           아이템
  SaveSystem.js          localStorage 세이브 (스테이지, 체크포인트, 플래그, 인벤토리)
  LevelLayout.js         ASCII 지형 빌더
  Input.js / EventBus.js / Tween.js / AudioManager.js / Debug.js
src/characters/          GLB 로더, 공통 동작 상태, 캐릭터 등록, 동작 도감
assets/characters/       Blender 원본, GLB, 대표 렌더
tools/blender/           Mochi와 숲 키트 Blender 재생성 스크립트
assets/environment/      Blender 숲 모듈 원본·GLB·manifest
maps/                    스테이지 지형과 조경 JSON
src/world/               모듈 로더·자동 연결·조경·대기 효과
src/editor/              숲 맵 공방
map-editor.html          시각적 맵 편집 진입점
src/entities/            ── 게임 오브젝트 (필요에 따라 상속·확장)
  Player.js              주인공 (이동/점프/공격/피격/사망/컷씬 걷기)
  NPC.js                 대화 가능한 인물
  Enemy.js               적 기본 (순찰 AI, 밟기/공격 처치) + 예시 변형 Beetle
  Items.js               Collectible (수집 아이템)
  Interactables.js       Sign, Lever, Gate, ExitDoor, Checkpoint, Trigger
  Terrain.js             Block, OneWayPlatform, MovingPlatform, Hazard
  Decor.js               3D 배경/전경 장식 생성기 (숲, 언덕, 기둥, 달, 파티클)
src/story/               ── 이야기 데이터 (코드가 아니라 "내용")
  chapters.js            챕터 → 스테이지 순서 (게임 진행의 뼈대)
  characters.js          등장인물 (이름/색)
  items.js               아이템 정의
  dialogues/ch1.js       1장 대화 스크립트
src/stages/              ── 스테이지 구현
  index.js               스테이지 레지스트리
  ch1/Stage_1_1_Awakening.js   데모 스테이지 (모든 요소 사용 예)
  ch1/Stage_1_2_Beyond.js      플레이스홀더
src/ui/                  HUD, 대화창 스타일, 타이틀/클리어/게임오버 화면, 페이드/레터박스/타이틀카드
docs/                    STAGE_AUTHORING.md (스테이지 제작 가이드), STORY.md (스토리 설계 템플릿)
```

### 핵심 개념

**스테이지 진행** — `story/chapters.js` 의 나열 순서가 곧 게임의 흐름입니다. 스테이지 안에서 `this.complete()` 를 부르면
클리어 화면 → 자동 저장 → 다음 스테이지 로드(타이틀카드 포함)가 진행되고, 마지막 스테이지면 엔딩 화면이 나옵니다.

**스토리 상태** — 모든 "이야기의 기억"은 `game.story` 플래그입니다. 대화 분기(`if`), 트리거 조건, 문 개폐, NPC의 재대화 등이
플래그를 읽고 씁니다. 인벤토리 개수는 `item:<id>` 플래그로 자동 반영되어 `'item:old_key'`, `'item:memory_fragment>=3'` 같은 조건을 쓸 수 있습니다.

**대화 스크립트** — 데이터(JS 객체)로 씁니다. 화자, 선택지, 조건 분기, 플래그 설정, 아이템 지급, 이벤트 발행, 임의 코드 실행, 다른 대화로 점프를 지원합니다.
(형식: `src/engine/DialogueSystem.js` 상단 주석)

**컷씬/이벤트** — `game.cutscene(async (cs) => { ... })` 안에서 `await cs.say()`, `cs.panTo()`, `cs.walk()`, `cs.fadeOut()` 등을 순서대로 적으면 연출이 됩니다.
실행 중엔 입력이 잠기고 레터박스가 표시됩니다.

**엔티티** — `Entity` 를 상속해 `object`(THREE.Group)에 외형을 넣고 `setBody()` 로 물리 바디를 붙입니다.
`update(dt)`, `onOverlap(other)`, `interact(player)` 를 오버라이드하면 됩니다. 보스/특수 적은 `Enemy` 를 상속하세요.

**이벤트 버스** — `game.events.on('enemy:died', ...)` 등으로 스테이지가 반응합니다. 주요 이벤트:
`stage:enter/complete`, `dialogue:start/end`, `cutscene:start/end`, `item:collected`, `enemy:died`, `lever:toggled`, `gate:opened`, `checkpoint`,
`player:hp/hurt/died/respawn`, `flag:changed`, `inventory:changed`, `story:objective`.

## 다음 단계 (권장)

1. `docs/STORY.md` 템플릿을 채워 세계관·인물·챕터 비트를 확정
2. `docs/CHARACTER_AUTHORING.md` 규약으로 새 플레이어 캐릭터 추가. NPC/Enemy에도 필요에 따라 공통 `CharacterVisual` 연결
3. 보스: `Enemy` 상속 + 페이즈별 상태 머신, 컷씬으로 등장/퇴장 연출
4. 퍼즐 프리미티브 추가: 밀 수 있는 상자, 압력판, 시간제 스위치, 열쇠-자물쇠 조합
5. 오디오: `AudioManager` 의 합성음을 파일 재생으로 교체, 스테이지별 BGM
6. 세이브 슬롯 확장, 설정 화면(키 리바인딩, 볼륨)
