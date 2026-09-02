// bake.mjs — запекание портретов 42-завров для временных баннеров гачи.
// Запуск (из папки bake/):
//   bun build entry.ts --target=node --outfile=zavri-core.mjs
//   xvfb-run -a node bake.mjs
//
// Пайплайн без браузера: headless-gl (software WebGL1) + three 0.152 (последняя с WebGL1)
// + pngjs. Пиксели: gl.readPixels → PNG 1024×1024 (рендер 2048 + даунсэмпл 2×).
// Геометрия — из zavri-core.mjs (src/lib/zavri), та же, что у живых моделей в террариуме.

import createGL from "gl";
import * as THREE from "three";
import { PNG } from "pngjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ZAVRI_ROSTER, RARITY_COLOR,
  buildParts, partsToGroup,
  hash32, mulberry32,
} from "./zavri-core.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "public", "images", "zavri");
const RENDER = 2048, OUT = 1024;

const BG = {
  common: "#171a21", rare: "#131730", epic: "#1c1128", legendary: "#221605",
};

function makeRenderer(w, h) {
  const gl = createGL(w, h, { preserveDrawingBuffer: true, antialias: true });
  if (!gl) throw new Error("headless-gl: нет WebGL-контекста (нужен xvfb-run)");
  const canvas = {
    width: w, height: h, style: {},
    addEventListener() {}, removeEventListener() {}, setAttribute() {},
    getContext: () => gl,
  };
  const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true });
  renderer.setSize(w, h);
  return { renderer, gl };
}

function buildScene(def) {
  const scene = new THREE.Scene();
  const rarityColor = RARITY_COLOR[def.rarity];
  scene.background = new THREE.Color(BG[def.rarity]);
  scene.fog = new THREE.Fog(new THREE.Color(BG[def.rarity]).getHex(), 8, 14);

  scene.add(new THREE.AmbientLight(0xffffff, 0.42));
  const key = new THREE.DirectionalLight(0xffffff, 1.25); key.position.set(3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(rarityColor, 1.6); rim.position.set(-4, 2.5, -3); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.22); fill.position.set(0, -2, 5); scene.add(fill);

  const podium = new THREE.Mesh(
    new THREE.CylinderGeometry(1.22, 1.42, 0.3, 28),
    new THREE.MeshStandardMaterial({ color: 0x262b38, flatShading: true, roughness: 0.9 }),
  );
  podium.position.y = -1.15; scene.add(podium);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.24, 0.032, 8, 40),
    new THREE.MeshStandardMaterial({ color: rarityColor, emissive: rarityColor, emissiveIntensity: 1.6 }),
  );
  ring.rotation.x = Math.PI / 2; ring.position.y = -0.99; scene.add(ring);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 28),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.985; scene.add(shadow);

  const group = partsToGroup(THREE, buildParts(def, 0));
  group.rotation.y = -0.35;
  scene.add(group);

  if (def.rarity === "epic" || def.rarity === "legendary") {
    const rnd = mulberry32(hash32(def.id));
    const n = def.rarity === "legendary" ? 16 : 9;
    for (let i = 0; i < n; i++) {
      const spark = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.045 + rnd() * 0.035, 0),
        new THREE.MeshStandardMaterial({ color: rarityColor, emissive: rarityColor, emissiveIntensity: 2.2, flatShading: true }),
      );
      const a = rnd() * Math.PI * 2, r = 1.9 + rnd() * 1.2;
      spark.position.set(Math.cos(a) * r, -0.6 + rnd() * 2.4, Math.sin(a) * r * 0.7 - 0.4);
      scene.add(spark);
    }
  }
  return scene;
}

function downsample2x(src, w, h) {
  const out = Buffer.alloc((w / 2) * (h / 2) * 4);
  for (let y = 0; y < h / 2; y++) {
    for (let x = 0; x < w / 2; x++) {
      for (let c = 0; c < 4; c++) {
        // readPixels — bottom-up (стандарт GL): flip по вертикали + даунсэмпл 2×
        const r0 = h - 1 - y * 2, r1 = h - 2 - y * 2;
        const i00 = (r0 * w + x * 2) * 4 + c;
        const i10 = (r0 * w + x * 2 + 1) * 4 + c;
        const i01 = (r1 * w + x * 2) * 4 + c;
        const i11 = (r1 * w + x * 2 + 1) * 4 + c;
        out[(y * (w / 2) + x) * 4 + c] = (src[i00] + src[i10] + src[i01] + src[i11]) / 4;
      }
    }
  }
  return out;
}

function bakeOne(def) {
  const { renderer, gl } = makeRenderer(RENDER, RENDER);
  const scene = buildScene(def);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  cam.position.set(0, 0.35, 6.3);
  cam.lookAt(0, -0.1, 0);
  renderer.render(scene, cam);

  const px = new Uint8Array(RENDER * RENDER * 4);
  gl.readPixels(0, 0, RENDER, RENDER, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const png = new PNG({ width: OUT, height: OUT });
  png.data = downsample2x(px, RENDER, RENDER);
  writeFileSync(join(OUT_DIR, `${def.id}.png`), PNG.sync.write(png));
  console.log(`[bake] ${def.id}.png (${def.rarity})`);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const def of ZAVRI_ROSTER) bakeOne(def);
console.log(`[bake] готово → ${OUT_DIR}`);
