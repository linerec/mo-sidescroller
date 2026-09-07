# Mo 캐릭터 제작 규약 · v1

## 지금 바로 보기

프로젝트 폴더에서 `npm run dev`를 실행하고 아래 주소를 여세요.

- 게임: `http://localhost:8080/` — 기본 플레이어가 Mochi입니다.
- 동작 도감: `http://localhost:8080/character-preview.html` — 13개 동작, 회전, 확대, 정지, 속도 조절.
- Blender 원본: `assets/characters/mochi/mochi.blend`
- 게임 파일: `assets/characters/mochi/mochi.glb`
- 정면에 가까운 렌더: `assets/characters/mochi/preview.png`

모델을 따로 가져오는 작업은 필요 없습니다. `StageManager`가 플레이어의 GLB 로딩을 기다린 후 스테이지를 보여줍니다. 외형 로딩에 실패하면 임시 떡 모양과 오류 안내가 나오고, 콘솔에 원인이 기록됩니다. Three.js는 기존 프로젝트와 동일한 0.165.0 CDN을 사용하므로 최초 로딩에는 인터넷이 필요합니다.

## Mochi의 미술 방향

현재 외형의 기준은 사용자 스케치 `assets/mo.png`입니다. 식빵처럼 수직으로 내려오는 옆면을 없앤 둥근 떡 실루엣, 작은 동그란 눈, 가는 사선 눈썹, 작은 V자 입을 사용합니다. 얼굴은 살짝 오른쪽으로 치우쳐 있고, 분홍 볼은 옅은 색 얼룩이 있는 네모 형태입니다. 하얀 무광 몸체 위에는 잎 대신 가느다란 검은 줄기가 말려 올라가며, 양옆에 작은 손을 붙였습니다. 이전 `assets/mochi_attack.gif` 기반의 W 입·둥근 볼·잎 장식은 이 스케치 버전으로 교체했습니다.

지상에서는 몸의 접지면을 넓히고 가로 약 1.04~1.07배, 세로 약 0.915~0.965배의 호흡으로 중력에 살짝 눌린 느낌을 유지합니다. 옆면과 윗면은 원형 단면으로 부드럽게 이어집니다. 공중에서는 늘어나고, 착지 때 더 크게 퍼졌다가 지상 대기 자세로 돌아옵니다. 이 변형은 본 애니메이션이며 충돌 박스를 바꾸지 않습니다.

외형에서 가장 중요한 것은 작은 화면에서 읽히는 실루엣과 표정입니다. 광택이 강한 플라스틱, 복잡한 장식, 날카로운 무기보다 넓은 색면과 부드러운 형태를 사용하세요. 공격은 힘을 모았다가 말랑하게 들이받는 표현이며, 피격은 유혈 없이 눌림과 움찔거림으로 표현합니다.

현재 모델은 18개 메시, 16,646개 Blender 정점, 15개 본, 약 1.1MB GLB입니다. 몸체는 `body` 본으로 스쿼시·스트레치를 하고, 표정과 소품은 자식 본으로 움직입니다. 머리 줄기의 `curl` 본도 호흡과 함께 살짝 움직입니다. 고급 연체 시뮬레이션은 사용하지 않습니다. 재질은 텍스처 없는 PBR 색상과 볼의 정점 색상을 사용합니다. Blender 스튜디오의 조명과 배경은 GLB에 포함하지 않습니다.

## 공통 좌표와 파일 계약

| 항목 | 규칙 |
|---|---|
| 출력 | 원본 `.blend` + 스킨/애니메이션/재질을 포함한 단일 `.glb` |
| 단위 | Blender 1 unit = 게임 1 unit |
| 원점 | 바닥 접점의 중앙, Blender Z=0 / glTF Y=0 |
| 정면 | Blender -Y → glTF +Z |
| 축 | Blender Z up, GLB 내보내기 Y Up 활성화 |
| 루트 | `root` 본, 월드 이동 키프레임 없음 |
| 변형 | `body` 본 또는 해당 캐릭터의 자체 리그로 처리 |
| 아이템 접점 | `socket_item` 본/노드, 필요하면 캐릭터 전용 소품을 부착 |
| 이동 | 캐릭터는 제자리 동작, 실제 위치·점프 높이·넉백은 Player/Physics 소유 |
| 이름 | 아래 13개 클립을 정확히 사용. `idle`이며 `idel`이 아님 |
| 프레임 | 30fps, 0부터 시작. `duration × 30` 프레임을 끝에 포함 |
| 회전 | 미러 스케일 대신 바깥 Group의 작은 Y축 회전으로 얼굴을 양쪽에서 보여줌 |
| 충돌 | 외형과 독립된 AABB. 스쿼시나 머리 줄기가 충돌 크기를 바꾸지 않음 |

Mochi의 충돌 크기는 폭 0.95 × 높이 1.08입니다. `Player.object`는 물리 중심이고, `CharacterVisual.object`는 `-body.hh`만큼 내려가 발을 바닥에 맞춥니다. 외형 전체 너비는 충돌보다 조금 넓습니다. 다른 체형을 넣을 때는 좁은 통로, 발판 착지, 문 상호작용 거리를 실제 스테이지에서 확인하세요.

## 동작 표준

기준 데이터는 `src/characters/definitions.js`의 `MOTIONS`입니다. 시간 변경 시 GLB와 설정을 함께 바꿔야 하며 로더가 누락/길이 불일치를 검사합니다.

| 클립 | 길이 | 반복 | 연기와 게임 연결 |
|---|---:|:---:|---|
| `idle` | 2.40초 | ○ | 지면에 살짝 눌린 호흡과 눈깜빡임. 첫/끝 자세 일치 |
| `run` | 0.60초 | ○ | 통통 튀며 이동. 월드 X 이동은 넣지 않음 |
| `attack` | 0.60초 | — | 0–0.20초 준비 → 0.20초 충격 → 회복. **0.20초에 한 번 판정** |
| `use_item` | 1.20초 | — | 소품을 들어 올림. **0.60초에 한 번 효과** |
| `sleepy` | 3.20초 | ○ | 게임 입력 없이 지상 idle 12초 후. 눈을 감고 호흡, 작은 Z |
| `jump` | 0.50초 | — | 위로 길어짐. 물리의 1차 점프 이벤트에 재생 |
| `double_jump` | 0.60초 | — | 한 바퀴 회전과 별빛. 공중의 2차 점프 이벤트 |
| `fall` | 0.80초 | ○ | 공중에서 몸을 펼침. 점프 클립 이후 공중 기본 자세 |
| `land` | 0.30초 | — | 바닥에 닿을 때 퍼졌다가 복원 |
| `hit` | 0.20초 | — | **맞는 순간** 움찔하며 눈을 감음. HP 감소는 이때 게임 로직에서 한 번 |
| `damage` | 0.70초 | — | **아파하는 반응과 회복**. hit 종료 후 자동 재생, 추가 HP 차감 없음 |
| `happy` | 1.40초 | — | 두 번 작은 바운스와 반짝임. 수집/클리어에 연결 |
| `dead` | 0.90초 | 끝 유지 | 힘이 빠져 납작해짐. 마지막 자세 유지, 리스폰 때 초기화 |

우선순위는 `dead(100) > hit(80) > damage(70) > attack/use_item(40) > double_jump(30) > land(25) > jump(20) > happy(10) > 기본 반복 동작`입니다. 짧은 동작은 종료 후 이동/공중/idle 상태로 돌아갑니다. 피격은 공격과 사용 대기 이벤트를 취소합니다. 졸기는 이동·점프·공격·상호작용 입력으로 깨고, 기쁨은 조작을 시작하면 중단됩니다. 일시정지에서는 동작·효과 시계도 멈춥니다. 클리어/게임오버 화면에서는 외형만 업데이트해서 기쁨/탈진을 보여줍니다.

## 게임에서 확인하기

1. A/D 또는 방향키로 이동합니다.
2. SPACE/K를 누르고 공중에서 다시 눌러 더블점프합니다. 세 번째 공중 점프는 차단됩니다. 착지하면 횟수가 초기화됩니다.
3. J/X로 공격합니다. 준비 동작 동안은 적에게 데미지를 주지 않으며, 피격되면 예약된 공격이 취소됩니다.
4. 이야기에서 등불을 획득한 후 Q를 누릅니다. 들어 올리는 동작과 함께 주변이 4초간 밝아집니다. 등불은 소모되지 않습니다. 미보유 상태에서는 안내만 나옵니다.
5. 안전한 바닥에서 12초 가만히 기다립니다. 메뉴·대화 시간은 졸기 대기 시간에 포함하지 않습니다.
6. 적에게 맞으면 hit → damage가 재생되고, 무적 시간이 끝나기 전에는 중복 피해를 받지 않습니다.
7. 수집품을 먹거나 스테이지를 클리어하면 기쁨을 표현합니다.

개발 중 등불 사용만 바로 확인하려면 브라우저 콘솔에서 `game.inventory.add('lantern')`를 실행한 뒤 Q를 누르세요. 동작 도감은 인벤토리 없이 모든 애니메이션을 보여줍니다.

## 다음 캐릭터 만들기

`docs/CHARACTER_BRIEF_TEMPLATE.md`의 설명을 채워 제작자 또는 AI에게 전달하세요. 설명에서 새 3D 모델을 만드는 단계는 제작자가 수행합니다. 이 프로젝트에 자연어만 입력하면 임의의 캐릭터가 자동 생성되는 서비스가 들어 있는 것은 아닙니다. 제작 결과가 이 규약을 따르면 게임의 상태 머신을 다시 작성하지 않고 등록해서 사용할 수 있습니다.

1. 새 `.blend`에서 캐릭터를 만들고, 위 좌표/13개 클립/소품 접점을 맞춥니다. 몸체에 맞는 자체 리그를 써도 됩니다. 캐릭터마다 본 계층까지 같을 필요는 없으며 **다른 리그 사이의 자동 리타게팅은 제공하지 않습니다**.
2. 불필요한 조명·카메라·바닥을 제외하고 캐릭터와 리그만 선택해 GLB로 내보냅니다. Active Scene과 Selected Objects를 모두 켜세요. Blender의 여러 열린 씬이 섞이지 않도록 주의합니다.
3. `assets/characters/<id>/<id>.glb`와 원본을 저장합니다.
4. `CHARACTER_DEFS`에 다음 형식으로 등록합니다.

```js
// src/characters/definitions.js의 CHARACTER_DEFS 안
sprout: {
  id: 'sprout', name: 'Sprout', version: 1,
  description: '머리에 새싹을 얹은 수줍은 숲의 친구',
  model: new URL('../../assets/characters/sprout/sprout.glb', import.meta.url).href,
  scale: 1, collider: { w: 0.95, h: 1.08 }, facingAngle: 0.42,
  sleepAfter: 12, maxJumps: 2, motions: MOTIONS,
},
```

5. 스테이지 `build()`에서 `this.spawnPlayer(2, 3, 'sprout')`을 호출하면 새 캐릭터가 사용됩니다. 별도 설정이 없는 스테이지의 기본값은 Mochi입니다. NPC/Enemy는 기존 외형을 사용하며 이 플레이어 교체로 바뀌지 않습니다.
6. `node tools/check-character.mjs sprout`으로 클립/스킨/길이를 검사하고, 실제 스테이지에서 충돌·점프·양방향 얼굴·아이템 사용을 확인합니다. 다른 소품 효과가 필요하면 `Player.useItem`의 효과 처리를 확장해야 합니다. 지금 지원하는 게임 효과는 등불입니다.

## Blender 제작 소스와 재출력

`tools/blender/build_mochi.py`는 Mochi의 메시, 리그, 13개 Action, GLB, 스튜디오 씬을 재구성하는 소스입니다. Blender MCP의 `execute_blender_code`에서 실행했습니다. 열린 기존 작업 파일은 덮어쓰지 않고 새 씬을 만들며, `bpy.data.libraries.write`로 Mochi 씬과 의존 데이터만 독립 원본에 저장합니다.

다른 컴퓨터에서 재생성할 때는 아래처럼 프로젝트 경로를 지정하세요. 다른 열린 씬에 같은 이름의 Action이 있어도 GLB와 독립 Blender 원본에는 정확한 동작 이름으로 저장됩니다. 기존 열린 씬의 Action 이름은 저장 직후 복원합니다. 재생성은 같은 경로의 Mochi 산출물을 갱신합니다.

```python
MO_PROJECT_ROOT = '/absolute/path/to/Mo'
path = MO_PROJECT_ROOT + '/tools/blender/build_mochi.py'
exec(compile(open(path).read(), path, 'exec'))
bpy.ops.render.render(write_still=True)  # preview.png
```

원본에서 직접 애니메이션을 고칠 때는 MochiRig의 Action을 선택합니다. NLA에는 각 Action이 보관되어 있고, 기본 포즈에서는 idle이 활성화됩니다. Blender의 Actions 모드로 내보내며 강제 샘플링을 켭니다. 내보내기 방식은 [Blender glTF 공식 문서](https://docs.blender.org/manual/en/5.1/addons/import_export/scene_gltf2.html)를 참고하세요.

## 검증

`npm run check:character`는 GLB 구조·13개 클립·길이·리그 접점과 동작 우선순위/피격 후 회복/졸기 해제/사망 유지를 확인합니다. 브라우저 통합 검증은 `tools/check-character-browser.cjs`입니다. Playwright가 설치된 환경에서 서버를 실행하고 다음 명령을 사용합니다.

```bash
node tools/check-character-browser.cjs
# 기존 Playwright 설치 경로를 사용할 경우
PLAYWRIGHT_PACKAGE=/path/to/playwright node tools/check-character-browser.cjs
```

실제 GLTFLoader 로딩, 미리보기 버튼, 모바일 가로 넘침, 점프 제한, 지연 공격 1회, 아이템 효과, 피격 취소, 회복, 졸기와 깨기, 사망과 리스폰을 검증합니다. `/tmp/mochi-preview-browser.png`, `/tmp/mochi-game-browser.png`에 화면을 저장합니다. 시각적 아트 품질과 스테이지 전체 난이도는 별도로 플레이하며 확인해야 합니다.
