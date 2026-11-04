// 서울 지하철 2호선 전동차 — 절차적(procedural) 3D 모델
// 좌표계: x = 열차 진행 방향(길이), y = 위(레일 상면 = 0), z = 차폭 방향
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const DIM = {
  L: 19.5,          // 차체 길이 (m)
  W: 3.12,          // 차체 폭
  FLOOR: 1.15,      // 바닥 높이 (레일면 기준)
  WALL_BOTTOM: 0.85,
  WALL_TOP: 3.3,
  ROOF_RISE: 0.32,
  GAP: 0.6,         // 차량 간 간격
  DW: 1.3,          // 출입문 폭
  DH: 1.85,         // 출입문 높이
  WHEEL_R: 0.43,    // 차륜 반지름 (Ø860mm)
  GAUGE: 1.435,     // 표준궤
};
const { L, W, FLOOR, WALL_BOTTOM, WALL_TOP, ROOF_RISE, GAP, DW, DH, WHEEL_R } = DIM;
const ROOF_TOP = WALL_TOP + ROOF_RISE;
const DOOR_X = [-7.2, -2.4, 2.4, 7.2];
const WINDOWS = [[-9.35, -8.1], [-6.3, -3.3], [-1.5, 1.5], [3.3, 6.3], [8.1, 9.35]];
const WIN_Y0 = FLOOR + 0.9, WIN_Y1 = FLOOR + 1.8;
const BAND_Y = 1.92, BAND_H = 0.13;
export const BOGIE_X = L / 2 - 2.6;
export const LINE_GREEN = 0x00a84d;
export const CONTACT_WIRE_Y = 5.0;

/* ───────────── 재질 ───────────── */
const std = (o) => new THREE.MeshStandardMaterial(o);

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const KFONT = '"Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif';

export const MAT = {
  steel: std({ color: 0xd9dde1, metalness: 0.9, roughness: 0.28 }),
  steelDark: std({ color: 0x8d949b, metalness: 0.8, roughness: 0.45 }),
  green: std({ color: LINE_GREEN, metalness: 0.25, roughness: 0.38 }),
  paint: std({ color: 0xeef0f2, metalness: 0.15, roughness: 0.3 }),
  black: std({ color: 0x16191c, metalness: 0.2, roughness: 0.6 }),
  glass: std({ color: 0x1c2a31, metalness: 0.3, roughness: 0.05, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }),
  windshield: std({ color: 0x07090b, metalness: 0.6, roughness: 0.08 }),
  under: std({ color: 0x2b2e33, metalness: 0.35, roughness: 0.75 }),
  rubber: std({ color: 0x141516, roughness: 0.95 }),
  wheel: std({ color: 0x6a6f74, metalness: 0.95, roughness: 0.35 }),
  floor: std({ color: 0x80868c, roughness: 0.85, emissive: 0x80868c, emissiveIntensity: 0.12 }),
  ceiling: std({ color: 0xf1f3f4, roughness: 0.55, emissive: 0xf1f3f4, emissiveIntensity: 0.18 }),
  seat: std({ color: 0x2a74b8, roughness: 0.8, emissive: 0x2a74b8, emissiveIntensity: 0.12 }),
  seatP: std({ color: 0xd0435f, roughness: 0.8, emissive: 0xd0435f, emissiveIntensity: 0.12 }),
  pole: std({ color: 0xc9ced3, metalness: 0.95, roughness: 0.2 }),
  strap: std({ color: 0xf2f2f2, roughness: 0.6, emissive: 0xf2f2f2, emissiveIntensity: 0.12 }),
  lamp: std({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.6 }),
  lcd: std({ color: 0x0a1830, emissive: 0x2a6fd6, emissiveIntensity: 0.7, roughness: 0.3 }),
  headOn: std({ color: 0xffffff, emissive: 0xfff2d0, emissiveIntensity: 3 }),
  headOff: std({ color: 0x9aa3aa, metalness: 0.6, roughness: 0.2 }),
  tailOn: std({ color: 0xff3030, emissive: 0xff1a1a, emissiveIntensity: 3 }),
  tailOff: std({ color: 0x4a0d0d, roughness: 0.3 }),
  insulator: std({ color: 0x7a3326, roughness: 0.35 }),
  led: new THREE.MeshBasicMaterial({
    toneMapped: false,
    map: canvasTex(512, 80, (g, w, h) => {
      g.fillStyle = '#050505'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffae1a';
      g.font = `800 52px ${KFONT}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('2  내선순환', w / 2, h / 2 + 3);
    }),
  }),
  badge: std({
    roughness: 0.4,
    map: canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#00a84d'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffffff';
      g.font = `900 92px ${KFONT}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('2', w / 2, h / 2 + 6);
    }),
  }),
};
// 실내 재질: 야간 모드에서 자체발광을 키워 객실 조명을 표현
const INTERIOR = ['floor', 'ceiling', 'seat', 'seatP', 'strap'];
export function setTrainNight(night) {
  for (const k of INTERIOR) MAT[k].emissiveIntensity = night ? 0.42 : 0.12;
  MAT.ceiling.emissiveIntensity = night ? 0.6 : 0.18;
  MAT.lamp.emissiveIntensity = night ? 3 : 1.6;
}

/* ───────────── 지오메트리 헬퍼 ───────────── */
const KEEP = new Set(['position', 'normal', 'uv']);

class Bin {
  constructor() { this.parts = new Map(); }
  add(mat, label, geo) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes)) if (!KEEP.has(k)) g.deleteAttribute(k);
    g.clearGroups();
    const key = mat + '|' + label;
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key).push(g);
  }
  build(parent) {
    for (const [key, list] of this.parts) {
      const [mat, label] = key.split('|');
      const mesh = new THREE.Mesh(mergeGeometries(list, false), MAT[mat]);
      mesh.userData.label = label;
      mesh.castShadow = !MAT[mat].transparent;
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
  }
}

function box(w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  return g.translate(x, y, z);
}
function cyl(r, h, x, y, z, axis = 'y', seg = 12) {
  const g = new THREE.CylinderGeometry(r, r, h, seg);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  return g.translate(x, y, z);
}
function rectPath(x0, y0, x1, y1) {
  const p = new THREE.Path();
  p.moveTo(x0, y0); p.lineTo(x0, y1); p.lineTo(x1, y1); p.lineTo(x1, y0); p.closePath();
  return p;
}
const smooth = (t) => t * t * (3 - 2 * t);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ───────────── 차체 부품 ───────────── */
function sideWallGeo() {
  const s = new THREE.Shape();
  s.moveTo(-L / 2, WALL_BOTTOM); s.lineTo(L / 2, WALL_BOTTOM);
  s.lineTo(L / 2, WALL_TOP); s.lineTo(-L / 2, WALL_TOP); s.closePath();
  for (const dx of DOOR_X) s.holes.push(rectPath(dx - DW / 2, FLOOR, dx + DW / 2, FLOOR + DH));
  for (const [a, b] of WINDOWS) s.holes.push(rectPath(a, WIN_Y0, b, WIN_Y1));
  return new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false });
}

function roofGeo() {
  const s = new THREE.Shape(), N = 28, t = 0.05;
  for (let i = 0; i <= N; i++) {
    const th = Math.PI * i / N;
    const x = (W / 2) * Math.cos(th), y = WALL_TOP + ROOF_RISE * Math.sin(th);
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  for (let i = N; i >= 0; i--) {
    const th = Math.PI * i / N;
    s.lineTo((W / 2 - t) * Math.cos(th), WALL_TOP + (ROOF_RISE - t) * Math.sin(th));
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: L, bevelEnabled: false });
  g.rotateY(Math.PI / 2);          // 단면 (z,y) → 길이 방향 x 로 압출
  return g.translate(-L / 2, 0, 0);
}

function endWallGeo(withHole) {
  const s = new THREE.Shape();
  s.moveTo(-W / 2, WALL_BOTTOM); s.lineTo(W / 2, WALL_BOTTOM); s.lineTo(W / 2, WALL_TOP);
  for (let i = 1; i <= 28; i++) {
    const th = Math.PI * i / 28;
    s.lineTo((W / 2) * Math.cos(th), WALL_TOP + ROOF_RISE * Math.sin(th));
  }
  s.closePath();
  if (withHole) s.holes.push(rectPath(-0.55, FLOOR, 0.55, FLOOR + 1.95));
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false });
  return g.rotateY(Math.PI / 2);
}

// 운전실 전두부 측면 프로파일 (x는 차체 끝 L/2 기준)
const NOSE = [[0, 0.9], [0.45, 0.9], [0.58, 2.0], [0.42, 3.02]];
function noseGeo() {
  const s = new THREE.Shape();
  NOSE.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.quadraticCurveTo(0.36, 3.24, 0.0, 3.24);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: W - 0.2, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.08, bevelSegments: 4, curveSegments: 8,
  });
  return g.translate(L / 2, 0, -(W - 0.2) / 2);
}
// 전두부 경사면 위에 평면 부품을 붙이는 헬퍼 (geo는 XY 평면, +z를 바라봄)
function onSeg(geo, a, b, tc, zc, off) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  const nx = dy / len, ny = -dx / len;
  geo.rotateY(Math.PI / 2);
  geo.rotateZ(Math.atan2(ny, nx));
  return geo.translate(L / 2 + a[0] + dx * tc + nx * off, a[1] + dy * tc + ny * off, zc);
}
const segLen = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/* ───────────── 출입문 ───────────── */
const LEAF_W = DW / 2 - 0.01;
let LEAF;
function leafGeos() {
  if (LEAF) return LEAF;
  const s = new THREE.Shape();
  s.moveTo(-LEAF_W / 2, 0); s.lineTo(LEAF_W / 2, 0); s.lineTo(LEAF_W / 2, DH); s.lineTo(-LEAF_W / 2, DH); s.closePath();
  const hx0 = -LEAF_W / 2 + 0.1, hx1 = LEAF_W / 2 - 0.1, hy0 = 0.9, hy1 = 1.68;
  s.holes.push(rectPath(hx0, hy0, hx1, hy1));
  LEAF = {
    body: new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false }),
    glass: new THREE.PlaneGeometry(hx1 - hx0, hy1 - hy0).translate(0, (hy0 + hy1) / 2, 0.015),
    band: new THREE.BoxGeometry(LEAF_W, BAND_H, 0.006).translate(0, BAND_Y - FLOOR, 0.033),
  };
  return LEAF;
}
function makeDoorLeaf(x, side, dir) {
  const G = leafGeos();
  const g = new THREE.Group();
  const body = new THREE.Mesh(G.body, MAT.steel);
  const glass = new THREE.Mesh(G.glass, MAT.glass);
  const band = new THREE.Mesh(G.band, MAT.green);
  body.castShadow = body.receiveShadow = true;
  for (const m of [body, glass, band]) { m.userData.label = '객실 출입문 (양개식 미닫이)'; g.add(m); }
  g.position.set(x, FLOOR, side * (W / 2 + 0.01));
  g.scale.z = side;
  g.userData.door = { closedX: x, dir };
  return g;
}

/* ───────────── 윤축 / 팬터그래프 ───────────── */
let WHEELSET_GEO;
function wheelsetGeo() {
  if (WHEELSET_GEO) return WHEELSET_GEO;
  const parts = [];
  const zc = DIM.GAUGE / 2 + 0.035;
  for (const s of [-1, 1]) {
    parts.push(cyl(WHEEL_R, 0.13, 0, 0, s * zc, 'z', 32));
    parts.push(cyl(WHEEL_R + 0.03, 0.025, 0, 0, s * (zc - 0.075), 'z', 32)); // 플랜지
    parts.push(cyl(0.16, 0.16, 0, 0, s * (zc + 0.02), 'z', 16));             // 허브
    for (let k = 0; k < 4; k++) {                                             // 회전이 보이도록 표식
      const a = k * Math.PI / 2;
      parts.push(box(0.05, 0.05, 0.02, Math.cos(a) * 0.28, Math.sin(a) * 0.28, s * (zc + 0.07)));
    }
  }
  parts.push(cyl(0.08, 2.0, 0, 0, 0, 'z', 12));
  WHEELSET_GEO = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => {
    for (const k of Object.keys(g.attributes)) if (!KEEP.has(k)) g.deleteAttribute(k);
    return g;
  }));
  return WHEELSET_GEO;
}

const P_PIVOT_X = 0.1, P_PIVOT_Y = ROOF_TOP + 0.3, P_LA = 1.25, P_LB = 1.35;
export const PANTO_HIGH = CONTACT_WIRE_Y - 0.01 - 0.055 - P_PIVOT_Y;
export const PANTO_LOW = 0.18;
const unitArm = (r) => new THREE.CylinderGeometry(r, r, 1, 8).translate(0, 0.5, 0);

function makePantograph(px) {
  const g = new THREE.Group();
  g.position.x = px;
  g.userData.panto = true;
  const LBL = '팬터그래프 (싱글암 집전장치)';
  const bin = new Bin();
  for (const sx of [-0.6, 0.45]) for (const sz of [-0.45, 0.45])
    bin.add('insulator', LBL, cyl(0.06, 0.2, sx, ROOF_TOP + 0.08, sz, 'y', 10));
  bin.add('steelDark', LBL, box(1.25, 0.07, 1.1, -0.08, ROOF_TOP + 0.2, 0));
  bin.add('steelDark', LBL, box(0.12, 0.14, 0.9, P_PIVOT_X, P_PIVOT_Y - 0.05, 0));
  bin.build(g);

  const lower = unitArm(0.035), upper = unitArm(0.025);
  for (const z of [-0.3, 0.3]) {
    const m = new THREE.Mesh(lower, MAT.steelDark);
    m.name = 'lower'; m.position.set(P_PIVOT_X, P_PIVOT_Y, z); m.castShadow = true; m.userData.label = LBL; g.add(m);
  }
  for (const z of [-0.14, 0.14]) {
    const m = new THREE.Mesh(upper, MAT.steelDark);
    m.name = 'upper'; m.position.z = z; m.castShadow = true; m.userData.label = LBL; g.add(m);
  }
  const head = new THREE.Group();
  head.name = 'head';
  const hb = new Bin();
  hb.add('steelDark', LBL, box(0.1, 0.05, 1.7, 0, 0, 0));
  for (const x of [-0.07, 0.07]) hb.add('black', LBL, box(0.05, 0.03, 1.15, x, 0.04, 0));
  for (const s of [-1, 1]) hb.add('steelDark', LBL, box(0.06, 0.03, 0.32, 0, -0.06, s * 0.98, s * 0.5, 0, 0));
  hb.build(head);
  g.add(head);
  setPantoHeight(g, PANTO_HIGH);
  return g;
}

// 하부 암 각도 θ로부터 집전판 높이를 계산하고, 목표 높이를 이분탐색으로 맞춘다.
function pantoPose(th) {
  const kx = P_LA * Math.cos(th), ky = P_LA * Math.sin(th);
  const c = clamp((-0.1 - kx) / P_LB, -1, 1);       // 집전판은 피벗보다 0.1m 앞(= px)에 위치
  const th2 = Math.acos(c);
  return { kx, ky, th2, hy: ky + P_LB * Math.sin(th2) };
}
export function setPantoHeight(g, h) {
  let lo = 0.02, hi = 1.1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (pantoPose(mid).hy < h) lo = mid; else hi = mid;
  }
  const th = (lo + hi) / 2, p = pantoPose(th);
  for (const m of g.children) {
    if (m.name === 'lower') { m.rotation.z = th - Math.PI / 2; m.scale.y = P_LA; }
    else if (m.name === 'upper') {
      m.position.x = P_PIVOT_X + p.kx; m.position.y = P_PIVOT_Y + p.ky;
      m.rotation.z = p.th2 - Math.PI / 2; m.scale.y = P_LB;
    } else if (m.name === 'head') m.position.set(0, P_PIVOT_Y + p.hy, 0);
  }
}

/* ───────────── 차량 1량 ───────────── */
function buildCar({ cab = false, front = true, panto = false }) {
  const car = new THREE.Group();
  const bin = new Bin();
  const BODY = '스테인리스 차체';

  // 측벽·지붕·마구리
  const wall = sideWallGeo();
  bin.add('steel', BODY, wall.clone().translate(0, 0, W / 2 - 0.05));
  bin.add('steel', BODY, wall.clone().translate(0, 0, -W / 2));
  bin.add('steel', BODY, roofGeo());
  bin.add('steel', BODY, endWallGeo(true).translate(-L / 2, 0, 0));
  bin.add('steel', BODY, endWallGeo(!cab).translate(L / 2 - 0.05, 0, 0));
  bin.add('glass', '관통문', new THREE.PlaneGeometry(1.1, 1.95).rotateY(Math.PI / 2).translate(-L / 2 + 0.025, FLOOR + 0.975, 0));
  if (!cab) bin.add('glass', '관통문', new THREE.PlaneGeometry(1.1, 1.95).rotateY(Math.PI / 2).translate(L / 2 - 0.025, FLOOR + 0.975, 0));

  // 객실 창
  for (const s of [-1, 1]) for (const [a, b] of WINDOWS) {
    bin.add('glass', '객실 창', new THREE.PlaneGeometry(b - a, WIN_Y1 - WIN_Y0).translate((a + b) / 2, (WIN_Y0 + WIN_Y1) / 2, s * (W / 2 - 0.025)));
    if (b - a > 2) bin.add('black', '창틀', box(0.05, WIN_Y1 - WIN_Y0, 0.05, (a + b) / 2, (WIN_Y0 + WIN_Y1) / 2, s * (W / 2 - 0.025)));
  }

  // 2호선 초록색 띠
  const BAND = '2호선 상징색 띠 (초록)';
  const edges = [-L / 2, ...DOOR_X.flatMap((x) => [x - DW / 2, x + DW / 2]), L / 2];
  for (const s of [-1, 1]) {
    for (let i = 0; i < edges.length; i += 2) {
      const a = edges[i], b = edges[i + 1];
      bin.add('green', BAND, box(b - a, BAND_H, 0.008, (a + b) / 2, BAND_Y, s * (W / 2 + 0.004)));
    }
    bin.add('green', BAND, box(L, 0.06, 0.008, 0, 3.17, s * (W / 2 + 0.004)));
    bin.add('steelDark', '빗물받이', box(L, 0.04, 0.04, 0, WALL_TOP + 0.01, s * (W / 2 + 0.01)));
  }

  // 지붕 냉방장치
  for (const x of [-4.6, 4.6]) {
    bin.add('steelDark', '냉난방 장치 (지붕 에어컨)', box(3.4, 0.38, 2.1, x, ROOF_TOP + 0.08, 0));
    for (const dx of [-0.8, 0.8]) bin.add('black', '냉난방 장치 (지붕 에어컨)', cyl(0.34, 0.03, x + dx, ROOF_TOP + 0.28, 0, 'y', 24));
  }

  // 하부: 차체 하부, 전장품, 대차
  bin.add('under', '차체 하부 (언더프레임)', box(L, FLOOR - WALL_BOTTOM, W - 0.1, 0, (FLOOR + WALL_BOTTOM) / 2, 0));
  const EQUIP = '하부 전장품 (인버터·보조전원·공기압축기)';
  for (const [x, len, dep, z, h] of [[-3.6, 1.8, 1.2, 0.5, 0.5], [-1.2, 2.2, 1.0, -0.6, 0.45], [1.5, 1.6, 1.4, 0.4, 0.55], [3.8, 1.4, 0.9, -0.7, 0.4]])
    bin.add('under', EQUIP, box(len, h, dep, x, WALL_BOTTOM - h / 2, z));
  bin.add('steelDark', '공기 탱크', cyl(0.17, 2.2, 0.5, 0.62, -1.15, 'x', 16));
  const BOGIE = '대차 (Bogie)';
  for (const bx of [-BOGIE_X, BOGIE_X]) {
    for (const s of [-1, 1]) {
      bin.add('under', BOGIE, box(2.8, 0.22, 0.14, bx, 0.55, s * 1.0));
      bin.add('rubber', '공기 스프링', cyl(0.26, 0.22, bx, 0.75, s * 1.0, 'y', 20));
      for (const d of [-1.05, 1.05]) {
        bin.add('steelDark', '축상 (액슬박스)', box(0.32, 0.26, 0.22, bx + d, 0.43, s * 1.0));
        bin.add('steelDark', BOGIE, cyl(0.08, 0.2, bx + d, 0.66, s * 1.0, 'y', 10));
      }
    }
    bin.add('under', BOGIE, box(0.5, 0.22, 2.0, bx, 0.55, 0));
    bin.add('under', BOGIE, box(0.6, 0.12, 2.4, bx, 0.86, 0));
    for (const d of [-0.55, 0.55]) bin.add('under', '견인 전동기', cyl(0.22, 0.7, bx + d, 0.45, 0.2, 'z', 16));
  }

  // 연결막 (갱웨이)
  const GANG = '연결막 (갱웨이)';
  const gangEnds = cab ? [-1] : [-1, 1];
  for (const e of gangEnds) {
    for (let k = 0; k < 3; k++) {
      const x = e * (L / 2 + 0.05 + k * 0.1 + 0.05);
      bin.add('rubber', GANG, box(0.09, 2.25 - (k % 2) * 0.06, 1.5 - (k % 2) * 0.06, x, FLOOR + 1.05, 0));
    }
    bin.add('steelDark', '연결기', box(0.35, 0.18, 0.25, e * (L / 2 + 0.17), 0.95, 0));
  }

  // ── 실내 ──
  bin.add('floor', '객실 바닥', new THREE.PlaneGeometry(L - 0.1, W - 0.1).rotateX(-Math.PI / 2).translate(0, FLOOR + 0.002, 0));
  bin.add('ceiling', '천장', new THREE.PlaneGeometry(L - 0.1, W - 0.1).rotateX(Math.PI / 2).translate(0, WALL_TOP - 0.02, 0));
  for (const z of [-0.55, 0.55]) bin.add('lamp', 'LED 실내등', box(L - 1.2, 0.02, 0.1, 0, WALL_TOP - 0.035, z));

  const general = [[-6.45, -3.15], [-1.65, 1.65], [3.15, 6.45]];
  const priority = cab ? [[-9.6, -7.95]] : [[-9.6, -7.95], [7.95, 9.6]];
  const barY = FLOOR + 1.9;
  const addBench = (a, b, s, mat, label) => {
    const len = b - a, cx = (a + b) / 2, zw = W / 2 - 0.05;
    bin.add(mat, label, box(len, 0.1, 0.48, cx, FLOOR + 0.42, s * (zw - 0.24)));
    bin.add(mat, label, box(len, 0.5, 0.08, cx, FLOOR + 0.76, s * (zw - 0.06), -s * 0.12));
    bin.add('steelDark', '좌석 하부', box(len, 0.36, 0.4, cx, FLOOR + 0.19, s * (zw - 0.22)));
    bin.add('glass', '좌석 옆 칸막이', box(0.02, 1.0, 0.5, a - 0.03, FLOOR + 0.85, s * (zw - 0.25)));
    bin.add('glass', '좌석 옆 칸막이', box(0.02, 1.0, 0.5, b + 0.03, FLOOR + 0.85, s * (zw - 0.25)));
    const POLE = '손잡이 기둥·선반';
    for (const px of [a - 0.06, b + 0.06]) bin.add('pole', POLE, cyl(0.02, WALL_TOP - FLOOR, px, (FLOOR + WALL_TOP) / 2, s * 1.0, 'y', 10));
    if (len > 3) bin.add('pole', POLE, cyl(0.02, WALL_TOP - FLOOR - 0.47, cx, (FLOOR + 0.47 + WALL_TOP) / 2, s * 1.0, 'y', 10));
    bin.add('pole', POLE, cyl(0.016, len + 0.12, cx, barY, s * 0.95, 'x', 8));
    bin.add('pole', POLE, box(len, 0.02, 0.32, cx, FLOOR + 1.78, s * (zw - 0.18)));
    const n = Math.max(2, Math.round(len / 0.42));
    for (let i = 0; i < n; i++) {
      const x = a + (i + 0.5) * (len / n);
      bin.add('strap', '손잡이', box(0.03, 0.22, 0.008, x, barY - 0.12, s * 0.95));
      bin.add('strap', '손잡이', new THREE.TorusGeometry(0.065, 0.011, 6, 16).rotateY(Math.PI / 2).translate(x, barY - 0.3, s * 0.95));
    }
  };
  for (const s of [-1, 1]) {
    for (const [a, b] of general) addBench(a, b, s, 'seat', '일반석 (롱시트)');
    for (const [a, b] of priority) addBench(a, b, s, 'seatP', '교통약자 배려석');
    for (const dx of DOOR_X) bin.add('lcd', '행선 안내 LCD', box(0.55, 0.18, 0.03, dx, FLOOR + 2.02, s * (W / 2 - 0.07)));
  }

  // ── 운전실 ──
  if (cab) {
    const PX = L / 2 - 1.75;
    bin.add('ceiling', '운전실 칸막이', box(0.05, WALL_TOP - FLOOR, W - 0.1, PX, (FLOOR + WALL_TOP) / 2, 0));
    bin.add('black', '운전 제어대', box(0.8, 1.0, 2.6, L / 2 - 0.5, FLOOR + 0.5, 0));
    bin.add('black', '운전석', box(0.5, 0.5, 0.5, L / 2 - 1.2, FLOOR + 0.25, 0.6));

    bin.add('paint', '운전실 전두부', noseGeo());
    const [P0, P1, P2, P3] = NOSE;
    const la = segLen(P1, P2), lw = segLen(P2, P3);
    bin.add('green', '전면 초록 도장', onSeg(new THREE.PlaneGeometry(W - 0.12, la * 0.98), P1, P2, 0.5, 0, 0.087));
    bin.add('windshield', '운전실 전면 유리', onSeg(new THREE.PlaneGeometry(W - 0.3, lw * 0.96), P2, P3, 0.5, 0, 0.087));
    bin.add('led', '행선 표시기 (LED)', onSeg(new THREE.PlaneGeometry(1.35, 0.21), P2, P3, 0.83, 0, 0.093));
    bin.add('badge', '노선 표지', onSeg(new THREE.CircleGeometry(0.15, 40), P1, P2, 0.58, 0, 0.093));
    for (const s of [-1, 1]) {
      bin.add('black', '전조등·후미등', onSeg(new THREE.PlaneGeometry(0.62, 0.24), P1, P2, 0.45, s * 1.15, 0.091));
      bin.add(front ? 'headOn' : 'headOff', '전조등', onSeg(new THREE.CircleGeometry(0.08, 24), P1, P2, 0.45, s * 1.02, 0.094));
      bin.add(front ? 'tailOff' : 'tailOn', '후미등', onSeg(new THREE.CircleGeometry(0.065, 24), P1, P2, 0.45, s * 1.3, 0.094));
      bin.add('green', BAND, box(0.42, BAND_H, 0.008, L / 2 + 0.24, BAND_Y, s * (W / 2 + 0.004)));
    }
    bin.add('black', '와이퍼', onSeg(new THREE.PlaneGeometry(0.03, 0.55), P2, P3, 0.3, 0.3, 0.095));
    bin.add('black', '전면 스커트 (배장기)', box(0.5, 0.35, W - 0.25, L / 2 + 0.22, 0.7, 0));
    bin.add('steelDark', '자동 연결기', box(0.5, 0.18, 0.25, L / 2 + 0.6, 0.85, 0));
  }

  bin.build(car);

  // 출입문 (편측 4개, 양개식)
  for (const s of [-1, 1]) for (const dx of DOOR_X) for (const k of [-1, 1])
    car.add(makeDoorLeaf(dx + k * DW / 4, s, k));

  // 윤축
  for (const bx of [-BOGIE_X, BOGIE_X]) for (const d of [-1.05, 1.05]) {
    const ws = new THREE.Mesh(wheelsetGeo(), MAT.wheel);
    ws.position.set(bx + d, WHEEL_R, 0);
    ws.castShadow = true;
    ws.userData.wheelset = true;
    ws.userData.label = '윤축 (차륜·차축)';
    car.add(ws);
  }

  if (panto) car.add(makePantograph(0));
  return car;
}

/* ───────────── 편성 ───────────── */
const templates = new Map();
function template(cfg) {
  const key = JSON.stringify(cfg);
  if (!templates.has(key)) templates.set(key, buildCar(cfg));
  return templates.get(key);
}

export function buildTrain(n) {
  const group = new THREE.Group();
  group.name = 'Seoul_Line2_Train';
  const pitch = L + GAP;
  const total = n * pitch - GAP;
  const cars = [], doors = [], wheelsets = [], pantos = [];
  const pantoIdx = new Set();
  for (let i = 1; i < n - 1; i++) if (i % 3 === 1) pantoIdx.add(i);
  if (n <= 3) pantoIdx.add(n === 2 ? 0 : 1);

  for (let i = 0; i < n; i++) {
    const isFront = i === 0, isRear = i === n - 1;
    const cfg = isFront || isRear
      ? { cab: true, front: isFront, panto: pantoIdx.has(i) }
      : { cab: false, front: true, panto: pantoIdx.has(i) };
    const car = template(cfg).clone();
    car.position.x = total / 2 - L / 2 - i * pitch;
    if (isRear) car.rotation.y = Math.PI;
    car.name = `car_${i + 1}`;
    car.userData.index = i;
    const sign = isRear ? -1 : 1;
    car.traverse((o) => {
      if (o.userData.door) doors.push(o);
      if (o.userData.wheelset) { o.userData.sign = sign; wheelsets.push(o); }
      if (o.userData.panto) pantos.push(o);
    });
    group.add(car);
    cars.push(car);
  }

  const state = { doorT: 0, doorAmt: 0, pantoT: 1, pantoAmt: 1, t: 0 };

  return {
    group, cars, doors, wheelsets, pantos, state,
    count: n,
    frontX: total / 2 + 0.7,
    length: total + 1.4,
    get doorsMoving() { return Math.abs(state.doorT - state.doorAmt) > 1e-3; },
    get doorsClosed() { return state.doorT === 0 && state.doorAmt <= 1e-3; },
    update(dt, v) {
      state.t += dt;
      const ds = dt / 2.2;
      state.doorAmt += clamp(state.doorT - state.doorAmt, -ds, ds);
      const e = smooth(state.doorAmt) * (DW / 2 - 0.05);
      for (const d of doors) d.position.x = d.userData.door.closedX + d.userData.door.dir * e;

      const ps = dt / 3;
      const prev = state.pantoAmt;
      state.pantoAmt += clamp(state.pantoT - state.pantoAmt, -ps, ps);
      if (prev !== state.pantoAmt || !state.pantoInit) {
        const h = PANTO_LOW + (PANTO_HIGH - PANTO_LOW) * smooth(state.pantoAmt);
        for (const p of pantos) setPantoHeight(p, h);
        state.pantoInit = true;
      }

      for (const w of wheelsets) w.rotation.z -= w.userData.sign * v * dt / WHEEL_R;

      const amp = Math.min(v / 20, 1);
      cars.forEach((c, i) => {
        c.rotation.x = amp * 0.004 * Math.sin(state.t * 2.1 + i * 1.7);
        c.position.y = amp * 0.006 * Math.sin(state.t * 7.3 + i * 0.9);
      });
    },
  };
}
