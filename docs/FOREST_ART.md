# 동화 숲 배경

현재 두 스테이지의 나무·지형·발판·소품은 Blender에서 만든 **24종 모듈 GLB**를 조립합니다. 원본과 제작·좌표·충돌·맵 편집 규약은 [숲 키트 가이드](WORLD_KIT.md)에 정리했습니다.

- [숲 맵 공방](http://localhost:8080/map-editor.html): 칠하기, 자동 연결, 소품 배치, 실제 모델 미리보기, 초안 플레이, JSON 저장.
- [숲 입구](http://localhost:8080/?stage=stage-1-1): 따뜻한 햇살과 연두 이끼 (`morning`).
- [깊은 숲](http://localhost:8080/?stage=stage-1-2): 청록빛 안개와 배경 물줄기 (`glade`).
- 원본: `assets/environment/woodland/woodland-kit.blend`.
- 실제 게임 화면: `assets/backgrounds/morning.png`, `glade.png`, `treetops.png`.

큰 둥근 수관, 곡선 줄기, 낮은 버섯·꽃과 밝은 잔디 가장자리로 캐릭터와 착지선을 읽기 쉽게 구성합니다. 원근 카메라의 시차와 먼 실루엣의 안개색이 깊이를 만듭니다. 모델은 무광 PBR 색상이며 외부 이미지 텍스처는 사용하지 않습니다. 하늘·햇살·꽃가루·나비·물은 `ForestAtmosphere.js`의 런타임 효과입니다. 나무와 지형 자체는 GLB에서 가져옵니다.

`MapData.js`의 같은 연결 규칙을 공방과 게임이 공유합니다. 물리는 JSON 격자와 기존 엔진이 관리하며 장식은 충돌을 만들지 않습니다. 조경의 거리·배율과 모델 밀도를 조절해 동선을 가리지 않도록 하세요. NPC와 이야기 오브젝트는 기존 스테이지 코드의 외형·배치를 유지합니다.

이전 `src/entities/StorybookForest.js`는 초기 절차적 배경 시안으로 남아 있으며 현재 스테이지에서는 사용하지 않습니다. 신규 작업은 `src/world/`와 Blender 키트를 기준으로 진행하세요.
