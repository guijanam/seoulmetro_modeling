// Three.js 뷰어: 렌더러·조명·카메라·주행 루프. React UI와는 createViewer()의 반환 API로 소통한다.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildTrain, setTrainNight, DIM, BOGIE_X } from './train.js';
import { buildWorld } from './world.js';

export const VIEWS = [
  { id: 'overview', label: '전체' },
  { id: 'front', label: '정면' },
  { id: 'side', label: '측면' },
  { id: 'bogie', label: '대차' },
  { id: 'roof', label: '지붕' },
  { id: 'interior', label: '실내' },
];

/**
 * @param {object} o
 * @param {HTMLElement} o.container  캔버스를 붙일 요소
 * @param {(s: object) => void} o.onState  UI 상태 변경 알림
 * @param {(msg: string) => void} o.onToast
 * @param {(hud: {kmh: number, km: number}) => void} o.onHud  매 프레임 계기 값 (DOM 직접 갱신용)
 * @param {(tip: null | {label: string, car: string, x: number, y: number}) => void} o.onTip
 */
export function createViewer({ container, onState, onToast, onHud, onTip }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  const SKY = { day: new THREE.Color(0xbcd3e3), night: new THREE.Color(0x0a0f1c) };
  scene.background = SKY.day.clone();
  scene.fog = new THREE.Fog(SKY.day.clone(), 140, 520);

  const camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.05, 2000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2 - 0.01;
  controls.maxDistance = 260;

  const hemi = new THREE.HemisphereLight(0xe2efff, 0x5a5040, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dd, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 220 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const SUN_OFFSET = new THREE.Vector3(32, 55, 26);

  const headlight = new THREE.SpotLight(0xfff2d8, 0, 160, 0.38, 0.6, 1.4);
  scene.add(headlight, headlight.target);

  const world = buildWorld(scene);

  /* ── 상태 ── */
  const S = { running: false, kmh: 60, v: 0, offset: 0, night: false };
  const ACC = 1.0, DEC = 1.2; // m/s²
  let train;

  const emit = () => onState?.({
    running: S.running,
    doorsOpen: !!train.state.doorT,
    pantoUp: !!train.state.pantoT,
    night: S.night,
    cars: train.count,
    length: train.length,
  });

  function makeTrain(n) {
    if (train) scene.remove(train.group);
    const prev = train?.state;
    train = buildTrain(n);
    if (prev) Object.assign(train.state, { doorT: prev.doorT, doorAmt: prev.doorAmt, pantoT: prev.pantoT, pantoAmt: prev.pantoAmt });
    scene.add(train.group);
    headlight.position.set(train.frontX + 0.2, 1.5, 0);
    headlight.target.position.set(train.frontX + 40, 0, 0);
  }
  makeTrain(10);

  /* ── 카메라 프리셋 ── */
  const cam = { from: null, to: null, t: 1 };
  let currentView = 'overview';
  function flyTo(pos, target, minDist = 1.5) {
    cam.from = { p: camera.position.clone(), t: controls.target.clone() };
    cam.to = { p: pos, t: target };
    cam.t = 0;
    controls.minDistance = minDist;
  }
  const carX = (i) => train.cars[Math.min(i, train.cars.length - 1)].position.x;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const PRESETS = {
    overview: () => { const f = train.frontX; flyTo(V3(f + 17, 6.5, 15), V3(f - 14, 1.8, 0)); },
    front: () => { const f = train.frontX; flyTo(V3(f + 9.5, 2.3, 2.6), V3(f, 2.0, 0)); },
    side: () => { const x = carX(0) - 1; flyTo(V3(x, 2.4, 25), V3(x, 2.0, 0)); },
    bogie: () => { const x = carX(0) + BOGIE_X; flyTo(V3(x + 2.6, 0.95, 3.9), V3(x, 0.5, 0.5), 0.5); },
    roof: () => {
      const p = train.pantos[0];
      const x = p ? p.getWorldPosition(new THREE.Vector3()).x : carX(1);
      flyTo(V3(x + 7, 8, 7.5), V3(x, 4.2, 0));
    },
    interior: () => {
      const x = carX(1);
      flyTo(V3(x - 7.6, DIM.FLOOR + 1.55, 0.25), V3(x + 2, DIM.FLOOR + 1.3, 0), 0.1);
    },
  };

  camera.position.set(train.frontX + 40, 14, 34);
  controls.target.set(train.frontX - 14, 1.8, 0);
  PRESETS.overview();

  /* ── 조작 API ── */
  const api = {
    toggleDoors() {
      if (S.v > 0.05 || S.running) return onToast?.('정차 중에만 출입문을 열 수 있어요');
      train.state.doorT = train.state.doorT ? 0 : 1;
      emit();
    },
    toggleRun() {
      if (!S.running && !train.doorsClosed) return onToast?.('출입문이 닫힌 뒤 출발할 수 있어요');
      if (!S.running && train.state.pantoT === 0) return onToast?.('팬터그래프를 올려야 전력을 받을 수 있어요');
      S.running = !S.running;
      emit();
    },
    togglePanto() {
      if (S.running && train.state.pantoT === 1) return onToast?.('주행 중에는 팬터그래프를 내릴 수 없어요');
      train.state.pantoT = train.state.pantoT ? 0 : 1;
      emit();
    },
    setNight(n) {
      S.night = n;
      scene.background.copy(n ? SKY.night : SKY.day);
      scene.fog.color.copy(n ? SKY.night : SKY.day);
      sun.intensity = n ? 0.25 : 2.6;
      sun.color.set(n ? 0x8fa8ff : 0xfff1dd);
      hemi.intensity = n ? 0.12 : 0.9;
      scene.environmentIntensity = n ? 0.18 : 1;
      headlight.intensity = n ? 900 : 0;
      setTrainNight(n);
      world.setNight(n);
      emit();
    },
    toggleNight() { api.setNight(!S.night); },
    setSpeed(kmh) { S.kmh = kmh; },
    /** @returns {boolean} 변경 성공 여부 */
    setCars(n) {
      if (S.v > 0.05) { onToast?.('정차 중에만 편성을 바꿀 수 있어요'); return false; }
      if (n !== train.count) { makeTrain(n); PRESETS[currentView](); emit(); }
      return true;
    },
    view(id) { currentView = id; PRESETS[id](); },
    exportGLB() {
      new GLTFExporter().parse(train.group, (glb) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' }));
        a.download = `seoul-line2-${train.count}cars.glb`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        onToast?.('GLB 파일을 내보냈어요');
      }, (err) => onToast?.('내보내기 실패: ' + err.message), { binary: true });
    },
    dispose,
  };

  /* ── 키보드 ── */
  const onKey = (e) => {
    if (e.target.tagName === 'INPUT' || e.metaKey || e.ctrlKey) return;
    const k = e.key.toLowerCase();
    if (k === 'd') api.toggleDoors();
    else if (k === ' ') { e.preventDefault(); api.toggleRun(); }
    else if (k === 'p') api.togglePanto();
    else if (k === 'n') api.toggleNight();
    else if (k >= '1' && k <= '6') { const v = VIEWS[+k - 1].id; api.view(v); onState?.({ view: v }); }
  };
  window.addEventListener('keydown', onKey);

  /* ── 부품 툴팁 ── */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hoverEvt = null;
  const onMove = (e) => { hoverEvt = e; };
  const onLeave = () => { hoverEvt = null; onTip?.(null); };
  renderer.domElement.addEventListener('pointermove', onMove);
  renderer.domElement.addEventListener('pointerleave', onLeave);
  function updateHover() {
    if (!hoverEvt) return;
    const e = hoverEvt; hoverEvt = null;
    if (e.buttons) return onTip?.(null);
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObject(train.group, true).filter((h) => h.object.userData.label);
    const hit = hits.find((h) => !h.object.material.transparent) || hits[0];
    if (!hit) return onTip?.(null);
    let car = hit.object;
    while (car && car.userData.index === undefined) car = car.parent;
    onTip?.({ label: hit.object.userData.label, car: car ? `${car.userData.index + 1}호차` : '', x: e.clientX, y: e.clientY });
  }

  /* ── 루프 ── */
  const clock = new THREE.Clock();
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  let raf = 0;
  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const target = S.running ? S.kmh / 3.6 : 0;
    S.v += THREE.MathUtils.clamp(target - S.v, -DEC * dt, ACC * dt);
    if (S.v < 1e-3 && !S.running) S.v = 0;
    S.offset += S.v * dt;

    world.update(S.offset);
    train.update(dt, S.v);

    if (cam.t < 1) {
      cam.t = Math.min(1, cam.t + dt / 1.4);
      const k = ease(cam.t);
      camera.position.lerpVectors(cam.from.p, cam.to.p, k);
      controls.target.lerpVectors(cam.from.t, cam.to.t, k);
    }
    controls.update();
    sun.target.position.copy(controls.target);
    sun.position.copy(controls.target).add(SUN_OFFSET);

    onHud?.({ kmh: S.v * 3.6, km: S.offset / 1000 });
    updateHover();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  const ro = new ResizeObserver(() => {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  ro.observe(container);

  function dispose() {
    cancelAnimationFrame(raf);
    ro.disconnect();
    window.removeEventListener('keydown', onKey);
    renderer.domElement.removeEventListener('pointermove', onMove);
    renderer.domElement.removeEventListener('pointerleave', onLeave);
    controls.dispose();
    envTex.dispose();
    pmrem.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  }

  emit();
  return api;
}
