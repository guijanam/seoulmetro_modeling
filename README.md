# 서울 지하철 2호선 3D 모델러

서울 지하철 2호선 전동차를 브라우저에서 돌려보고, 문을 열고, 달려볼 수 있는 3D 웹사이트입니다.
외부 3D 모델 파일 없이 Three.js 코드로 차체·실내·대차·팬터그래프를 직접 만듭니다.

- Next.js 16 (App Router) · React 19 · Three.js 0.170

## 개발

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # 프로덕션 빌드 (정적 페이지로 생성됨)
```

## Vercel 배포

1. [vercel.com/new](https://vercel.com/new)에서 이 GitHub 리포를 Import 합니다.
2. Framework Preset이 **Next.js**로 자동 인식됩니다. 설정은 기본값 그대로 두고 Deploy 합니다.
3. 이후 `main` 브랜치에 push 할 때마다 자동으로 재배포됩니다.

환경 변수는 필요 없습니다.

## 기능

- 10량 편성(2~10량 조절), 양쪽 끝 운전실, 중간 차량 팬터그래프
- 출입문 개폐 애니메이션 (편측 4개, 양개식)
- 주행: 가감속, 차륜 회전, 차체 흔들림 (열차는 고정하고 주변 환경을 흘려보내는 방식)
- 팬터그래프 승강, 주간/야간 모드(전조등·실내등)
- 시점 프리셋: 전체 / 정면 / 측면 / 대차 / 지붕 / 실내
- 부품에 마우스를 올리면 부품 이름과 호차 표시
- GLB 내보내기 (Blender 등에서 열 수 있음)

단축키: `Space` 출발/정지 · `D` 출입문 · `P` 팬터그래프 · `N` 야간 · `1–6` 시점

## 구조

| 경로 | 역할 |
| --- | --- |
| `app/` | 레이아웃, 페이지, 전역 CSS |
| `components/TrainApp.jsx` | 조작 패널 UI (클라이언트 컴포넌트). Three.js는 `useEffect`에서 동적 import |
| `lib/viewer.js` | 렌더러·조명·카메라·주행 루프, UI가 호출하는 API (`createViewer`) |
| `lib/train.js` | 열차 모델 (치수 `DIM`, 재질 `MAT`, 차량·편성 생성) |
| `lib/world.js` | 선로, 침목, 전차선, 울타리, 도시 배경 |

치수는 `lib/train.js` 맨 위의 `DIM`, 색과 재질은 `MAT`에서 바꿀 수 있습니다.
