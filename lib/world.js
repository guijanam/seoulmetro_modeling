// 선로·전차선·주변 환경. 열차는 고정하고 환경을 -x 방향으로 흘려 주행을 표현한다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONTACT_WIRE_Y, DIM } from './train.js';

const LEN = 900;

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noiseTex(base, spread, dots = 9000, size = 256, seed = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = rng(seed);
  g.fillStyle = `rgb(${base.join(',')})`;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < dots; i++) {
    const k = (r() - 0.5) * spread;
    g.fillStyle = `rgb(${base.map((v) => Math.round(v + k + (r() - 0.5) * 10)).join(',')})`;
    const s = 1 + r() * 3;
    g.fillRect(r() * size, r() * size, s, s);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function facadeTex() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  const r = rng(7);
  g.fillStyle = '#000'; g.fillRect(0, 0, 128, 256);
  const map = document.createElement('canvas');
  map.width = 128; map.height = 256;
  const m = map.getContext('2d');
  m.fillStyle = '#d8d8d8'; m.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 256; y += 20) for (let x = 8; x < 128; x += 20) {
    m.fillStyle = '#4a5560'; m.fillRect(x, y, 12, 12);
    if (r() < 0.45) { g.fillStyle = r() < 0.7 ? '#ffd9a0' : '#e8f0ff'; g.fillRect(x, y, 12, 12); }
  }
  const mk = (cv) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: mk(map), emissive: mk(c) };
}

const clean = (g) => {
  const h = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(h.attributes)) if (!['position', 'normal', 'uv'].includes(k)) h.deleteAttribute(k);
  return h;
};
const merge = (list) => mergeGeometries(list.map(clean));
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

export function buildWorld(scene) {
  const movers = [];
  const addMover = (obj, period) => { scene.add(obj); movers.push({ obj, period }); };

  // 지면
  const groundTex = noiseTex([92, 108, 74], 40, 12000, 256, 3);
  groundTex.repeat.set(LEN / 8, 600 / 8);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(LEN, 600).rotateX(-Math.PI / 2).translate(0, -0.56, 0),
    new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }),
  );
  ground.receiveShadow = true;
  scene.add(ground);

  // 도상 자갈
  const s = new THREE.Shape();
  s.moveTo(-2.6, -0.56); s.lineTo(2.6, -0.56); s.lineTo(1.7, -0.19); s.lineTo(-1.7, -0.19); s.closePath();
  const ballastGeo = new THREE.ExtrudeGeometry(s, { depth: LEN, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-LEN / 2, 0, 0);
  const pos = ballastGeo.attributes.position, uv = ballastGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) * 0.25, (pos.getZ(i) + pos.getY(i)) * 0.25);
  const ballastTex = noiseTex([128, 124, 118], 90, 16000, 256, 5);
  const ballast = new THREE.Mesh(ballastGeo, new THREE.MeshStandardMaterial({ map: ballastTex, roughness: 1 }));
  ballast.receiveShadow = true;
  scene.add(ballast);

  // 레일 (상면 y = 0)
  const railMat = new THREE.MeshStandardMaterial({ color: 0x8b8580, metalness: 0.9, roughness: 0.35 });
  const rz = DIM.GAUGE / 2 + 0.036;
  const railParts = [];
  for (const sz of [-1, 1]) {
    railParts.push(box(LEN, 0.07, 0.072, 0, -0.035, sz * rz));
    railParts.push(box(LEN, 0.06, 0.017, 0, -0.1, sz * rz));
    railParts.push(box(LEN, 0.02, 0.14, 0, -0.14, sz * rz));
  }
  const rails = new THREE.Mesh(merge(railParts), railMat);
  rails.castShadow = rails.receiveShadow = true;
  scene.add(rails);

  // 침목 (콘크리트, 0.6m 간격)
  const SP = 0.6, NS = Math.floor(LEN / SP);
  const sleepers = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.24, 0.16, 2.5),
    new THREE.MeshStandardMaterial({ color: 0xa8a49c, roughness: 0.95 }),
    NS,
  );
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < NS; i++) sleepers.setMatrixAt(i, m4.makeTranslation(i * SP - LEN / 2, -0.23, 0));
  sleepers.receiveShadow = sleepers.castShadow = true;
  addMover(sleepers, SP);

  // 전차선 (가공 전차선, 전주 50m 간격)
  const PERIOD_C = 50;
  const steel = new THREE.MeshStandardMaterial({ color: 0x8a9096, metalness: 0.6, roughness: 0.5 });
  const cParts = [];
  for (let k = -Math.ceil(LEN / PERIOD_C / 2) - 1; k <= Math.ceil(LEN / PERIOD_C / 2) + 1; k++) {
    const x = k * PERIOD_C;
    cParts.push(box(0.32, 7.2, 0.32, x, 3.04, -3.8));
    cParts.push(box(0.08, 0.08, 3.9, x, 6.05, -1.9));
    cParts.push(box(0.06, 0.06, 3.6, x, 5.35, -1.85));
    cParts.push(box(0.05, 0.75, 0.05, x, 5.6, -0.05));
    for (let d = 5; d < PERIOD_C; d += 5) cParts.push(box(0.01, 0.98, 0.01, x + d, CONTACT_WIRE_Y + 0.5, 0));
  }
  const catenary = new THREE.Mesh(merge(cParts), steel);
  catenary.castShadow = true;
  addMover(catenary, PERIOD_C);

  const wireMat = new THREE.MeshStandardMaterial({ color: 0x5b4632, metalness: 0.7, roughness: 0.4 });
  const wires = new THREE.Mesh(merge([
    box(LEN, 0.014, 0.014, 0, CONTACT_WIRE_Y, 0),
    box(LEN, 0.014, 0.014, 0, CONTACT_WIRE_Y + 1.0, 0),
  ]), wireMat);
  scene.add(wires);

  // 방음벽/울타리
  const PERIOD_F = 3;
  const fParts = [];
  for (let x = -LEN / 2; x <= LEN / 2; x += PERIOD_F) for (const z of [-7, 7]) fParts.push(box(0.1, 1.8, 0.1, x, 0.34, z));
  const fence = new THREE.Mesh(merge(fParts), steel);
  fence.castShadow = true;
  addMover(fence, PERIOD_F);
  const fenceRails = new THREE.Mesh(merge([-7, 7].flatMap((z) => [box(LEN, 0.05, 0.04, 0, 1.1, z), box(LEN, 0.05, 0.04, 0, 0.3, z)])), steel);
  scene.add(fenceRails);

  // 도시 배경 (240m 타일을 반복)
  const TILE = 240, PER_TILE = 34;
  const r = rng(42);
  const specs = [];
  for (let i = 0; i < PER_TILE; i++) {
    const side = i % 2 ? 1 : -1;
    specs.push({
      x: r() * TILE, z: side * (28 + r() * 120),
      w: 10 + r() * 26, d: 10 + r() * 20, h: 8 + Math.pow(r(), 1.6) * 70,
      c: new THREE.Color().setHSL(0.58 + r() * 0.08, 0.06 + r() * 0.08, 0.55 + r() * 0.25),
    });
  }
  const tiles = [-2, -1, 0, 1, 2];
  const tex = facadeTex();
  const bMat = new THREE.MeshStandardMaterial({ map: tex.map, emissiveMap: tex.emissive, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.85 });
  const buildings = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), bMat, specs.length * tiles.length);
  let idx = 0;
  const q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  for (const t of tiles) for (const b of specs) {
    p.set(b.x + t * TILE, b.h / 2 - 0.56, b.z);
    sc.set(b.w, b.h, b.d);
    buildings.setMatrixAt(idx, m4.compose(p, q, sc));
    buildings.setColorAt(idx, b.c);
    idx++;
  }
  buildings.castShadow = buildings.receiveShadow = true;
  addMover(buildings, TILE);

  return {
    update(offset) {
      for (const { obj, period } of movers) obj.position.x = -(offset % period);
      groundTex.offset.x = offset / 8;
      ballastTex.offset.x = offset * 0.25;
    },
    setNight(night) {
      bMat.emissiveIntensity = night ? 1.2 : 0;
    },
  };
}
