// threeAdapter.ts — браузерный адаптер 42-завров (three 0.185)
// Собирает Group из PartDef и предоставляет готовый световой риг для сцен.

import * as THREE from "three";
import type { ZavryDef } from "./catalog";
import type { ThreeLike } from "./adapterFactory";
import { partsToGroup as factoryPartsToGroup, partToMesh as factoryPartToMesh } from "./adapterFactory";
import { buildParts } from "./mesh";

const THREE_ANY = THREE as unknown as ThreeLike;

export function buildZavryGroup(def: ZavryDef, seed = 0): THREE.Group {
  return factoryPartsToGroup(THREE_ANY, buildParts(def, seed)) as unknown as THREE.Group;
}

export function partToMesh(p: Parameters<typeof factoryPartToMesh>[1]): THREE.Mesh {
  return factoryPartToMesh(THREE_ANY, p) as unknown as THREE.Mesh;
}

/** Мягкий студийный свет для портрета/террариума */
export function createLightRig(opts?: { rimColor?: string; rimIntensity?: number }): THREE.Group {
  const rig = new THREE.Group();
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(3, 5, 4);
  const rim = new THREE.DirectionalLight(opts?.rimColor ?? "#5865f2", opts?.rimIntensity ?? 1.6);
  rim.position.set(-4, 2, -3);
  rig.add(ambient, key, rim);
  return rig;
}

/** Подстилка-тень под завром в террариуме */
export function createGroundShadow(radius = 0.85): THREE.Mesh {
  const geo = new THREE.CircleGeometry(radius, 24);
  const mat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = -1.02;
  return m;
}
