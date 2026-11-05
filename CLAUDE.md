# CLAUDE.md

서울 지하철 2호선 전동차를 **Blender로 모델링해 교육 자료**(렌더 이미지·분해도·단면도·애니메이션·GLB)로 만드는 프로젝트입니다.
같은 리포에 기존 Three.js 웹 모델러(Next.js, `app/` `components/` `lib/`)가 있습니다. 요구 사항과 진행 상황은 [PRD.md](PRD.md)에 있습니다.

## 작업 방식

- **PRD의 마일스톤을 하나씩** 진행합니다. 시작 전에 PRD에서 해당 마일스톤의 범위와 완료 기준을 확인하고, 끝나면 체크박스와 "진행 기록"을 갱신합니다.
- 마일스톤 하나가 끝나면 결과(렌더/스크린샷)를 보여 주고 사용자 확인을 받은 뒤 다음으로 넘어갑니다.
- 커밋은 사용자가 요청할 때만 합니다.
- 응답, 코드 주석, 문서는 한국어로 씁니다.

## 참고 자료 (사진·제원)

- 실물 사진은 [reference/photos/](reference/photos/) 아래 부위별 폴더(`front/`, `bogie/` 등)에 있습니다.
- 열차 제원 문서는 [reference/specs/](reference/specs/)에 있습니다. **치수의 우선순위는 제원 문서 > 사진에서 잰 비율 > 기존 웹 모델 값**입니다. 제원 문서의 값을 `dims.py`에 옮길 때는 출처(파일명·쪽)를 주석으로 남깁니다.
- 어떤 부품을 모델링하기 전에 해당 폴더의 사진과 제원 문서를 먼저 Read로 열어 봅니다. 자료가 없으면 그 사실을 말하고 `dims.py`의 기준 치수로 진행합니다.
- 사진에서 확인되지 않는 세부는 지어내지 말고, 추정한 부분은 코드 주석과 PRD에 "추정"으로 적습니다.

## Blender 작업 규칙

### 스크립트가 원본이다

- 모델은 [blender/scripts/](blender/scripts/)의 Python(bpy) 스크립트로 **절차적으로 생성**합니다. `.blend` 파일은 빌드 산출물(`blender/output/`, git 제외)입니다.
- Blender에서 MCP로 직접 손본 결과도 반드시 스크립트에 반영합니다. 스크립트만으로 같은 모델이 다시 만들어져야 합니다.
- 빌드는 **멱등**이어야 합니다. 스크립트는 자기 컬렉션을 비우고 다시 만들며, 다른 컬렉션은 건드리지 않습니다.
- 치수는 `blender/scripts/dims.py` 한 곳에서만 정의합니다. 숫자를 부품 스크립트에 직접 박지 않습니다.

### 실행

- 대화형: MCP `execute_blender_code`에서 리포의 스크립트를 실행합니다 (`sys.path`에 `blender/scripts`를 넣고 모듈을 `importlib.reload`).
- 헤드리스: `/Applications/Blender.app/Contents/MacOS/Blender -b -P blender/scripts/build.py -- <옵션>`
- 대상 Blender: 5.2 LTS. 작업 시작 시 `get_addon_status`, `get_scene_info`로 상태를 확인합니다.

### 좌표·단위

- 단위는 미터(m), 1 Blender unit = 1 m.
- Blender는 Z-up: **X = 열차 진행 방향(차체 길이), Y = 차폭, Z = 위, 레일 상면 z = 0**, 차체 중심 x = 0, y = 0.
- 웹 모델(`lib/train.js`, Y-up)과 축만 다르고 값은 같습니다 (웹 y ↔ Blender z, 웹 z ↔ Blender −y). `DIM`을 바꾸면 양쪽을 맞춥니다.

### 이름·구조

- 컬렉션은 교육 단원 단위로 나눕니다: `Body`(차체), `Doors`(출입문·창), `Cab`(운전실), `Bogie`(대차), `Roof`(지붕 기기), `Underfloor`(하부 기기), `Interior`(실내), `Stage`(조명·카메라·바닥), `Annotations`(라벨).
- 오브젝트 이름은 영문 `단원_부품[_위치]` (예: `Bogie_Wheelset_F1`, `Body_SideWall_L`). 스크립트가 이름으로 찾으므로 바꾸지 않습니다.
- 모든 부품 오브젝트에 사용자 정의 속성을 붙입니다: `label_ko`(한글 부품명, 예: "공기 스프링"), `desc_ko`(한두 문장 설명), `unit`(단원). 라벨·분해도·내보내기가 이 값을 씁니다.
- 움직이는 부품(출입문, 팬터그래프, 윤축)은 회전·이동 기준점(origin)을 실제 회전축·이동 기준에 둡니다.

### MCP 코드 작성 시 주의

- 셰이더 노드는 이름이 아니라 타입으로 찾습니다: `next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")`. 노드 이름은 지역화되어 있습니다.
- enum 값은 하드코딩하지 말고 `bl_rna.properties[...].enum_items`에서 읽습니다. 렌더 엔진 지정은 `try/except TypeError`로 감쌉니다.
- 재질 색은 셰이더 노드 입력에 넣습니다 (`diffuse_color`는 뷰포트에만 적용).
- 작은 단계로 실행하고 필요한 값을 print로 확인합니다. 각 단계 뒤에는 `look`(angles 모드, 작은 `max_size`)으로 결과를 눈으로 확인합니다.

### 품질 기준

- 교육용이므로 **형태가 읽히는 것**이 우선입니다. 과한 디테일보다 부품 경계와 비율이 분명해야 합니다.
- 실시간용(GLB) 1량 기준 삼각형 약 15만 개 이하. 베벨·서브디비전은 모디파이어로 두고 내보낼 때 적용합니다.
- 공식 로고·상표는 넣지 않습니다. 노선 색(초록 `#00A84D`)과 숫자 "2" 표지까지만 씁니다.

## 산출물 위치

| 경로 | 내용 | git |
| --- | --- | --- |
| `blender/scripts/` | 모델 생성 스크립트 (원본) | 포함 |
| `blender/output/` | `.blend` 빌드 결과 | 제외 |
| `blender/renders/` | 교육용 렌더 이미지·영상 | 포함 |
| `public/models/` | 웹 앱에서 쓸 GLB | 포함 |
| `reference/photos/` | 실물 참고 사진 | 포함 |
| `reference/specs/` | 열차 제원 문서 | 포함 |

## 웹 앱 (Next.js)

웹 앱은 PRD에서 GLB 연동 마일스톤에 들어가기 전에는 수정하지 않습니다. 수정할 때는 아래 안내를 따릅니다.

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.
