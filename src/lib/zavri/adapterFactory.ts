// adapterFactory.ts — конвертация PartDef → three.js объекты.
// Принимает namespace THREE параметром, чтобы работать с любой версией three
// (браузер: three 0.185, запекание: three 0.152 под headless-gl). Чистый JS-API только.

import type { GeoDef, PartDef, Vec3 } from "./catalog";

export interface ThreeLike {
  Color: new (hex: string) => { set: (hex: string) => unknown };
  MeshStandardMaterial: new (opts: Record<string, unknown>) => unknown;
  Mesh: new (geo: unknown, mat: unknown) => MeshLike;
  Group: new () => GroupLike;
  IcosahedronGeometry: new (r: number, detail: number) => unknown;
  SphereGeometry: new (r: number, w?: number, h?: number) => unknown;
  ConeGeometry: new (r: number, h: number, seg?: number) => unknown;
  CylinderGeometry: new (rTop: number, rBottom: number, h: number, seg?: number) => unknown;
  BoxGeometry: new (w: number, h: number, d: number) => unknown;
  TorusGeometry: new (r: number, tube: number, radial?: number, tubular?: number, arc?: number) => unknown;
}

export interface MeshLike {
  position: { set: (x: number, y: number, z: number) => unknown };
  rotation: { set: (x: number, y: number, z: number) => unknown };
  scale: { set: (x: number, y: number, z: number) => unknown };
  add: (c: unknown) => unknown;
}

export interface GroupLike extends MeshLike {
  children: unknown[];
}

function makeGeo(THREE: ThreeLike, g: GeoDef): unknown {
  switch (g.kind) {
    case "icosa": return new THREE.IcosahedronGeometry(g.r, g.detail);
    case "sphere": return new THREE.SphereGeometry(g.r, g.w ?? 14, g.h ?? 12);
    case "cone": return new THREE.ConeGeometry(g.r, g.h, 8);
    case "cyl": return new THREE.CylinderGeometry(g.rTop, g.rBottom, g.h, 12);
    case "box": return new THREE.BoxGeometry(g.w, g.h, g.d);
    case "torus": return new THREE.TorusGeometry(g.r, g.tube, 8, 18, g.arc ?? Math.PI * 2);
  }
}

export function partToMesh(THREE: ThreeLike, p: PartDef): MeshLike {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(p.color),
    flatShading: true,
    metalness: p.metal ? 0.85 : 0,
    roughness: p.metal ? 0.35 : 0.8,
    transparent: p.opacity != null && p.opacity < 1,
    opacity: p.opacity ?? 1,
  });
  if (p.emissive) {
    (mat as unknown as Record<string, unknown>).emissive = new THREE.Color(p.emissive);
    (mat as unknown as Record<string, unknown>).emissiveIntensity = 1.4;
  }
  const mesh = new THREE.Mesh(makeGeo(THREE, p.geo), mat);
  mesh.position.set(p.pos[0], p.pos[1], p.pos[2]);
  if (p.rot) mesh.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
  const sc = p.scale ?? 1;
  if (typeof sc === "number") mesh.scale.set(sc, sc, sc);
  else mesh.scale.set(sc[0], sc[1], sc[2]);
  return mesh;
}

export function partsToGroup(THREE: ThreeLike, parts: PartDef[]): GroupLike {
  const group = new THREE.Group();
  for (const p of parts) group.add(partToMesh(THREE, p));
  return group;
}

export type { Vec3 };
