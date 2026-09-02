// mesh.ts — сборка частей 42-завра из каталога (pure TS, без three)
// Глаза/ноги/брюхо — общие для всех видов; traits — индивидуальные черты из каталога.

import type { PartDef, Vec3, ZavryDef } from "./catalog";
import { hash32, jitterColor, mulberry32 } from "./rng";

export function buildParts(def: ZavryDef, seed = 0): PartDef[] {
  const rnd = mulberry32(hash32(def.id) ^ Math.imul(seed + 1, 2654435761));
  const s = def.body.scale * (0.97 + rnd() * 0.06);
  const bodyColor = jitterColor(def.body.color, 0.03, rnd);
  const dark = jitterColor(def.body.color, -0.12, rnd);
  const parts: PartDef[] = [];

  // тело — округлый low-poly икосаэдр
  parts.push({
    geo: { kind: "icosa", r: 1, detail: 1 },
    pos: [0, 0, 0],
    scale: [s, s * 0.94, s],
    color: bodyColor,
  });

  // брюхо (слегка выпуклое — должно выглядывать из-под тела)
  if (def.body.belly && def.body.belly.toLowerCase() !== def.body.color.toLowerCase()) {
    parts.push({
      geo: { kind: "sphere", r: 0.65 },
      pos: [0, -0.2 * s, 0.58 * s],
      scale: [s * 0.95, s * 0.82, s * 0.72],
      color: def.body.belly,
    });
  }

  // лапки-ноги
  parts.push(
    { geo: { kind: "sphere", r: 0.2 }, pos: [-0.38 * s, -0.88 * s, 0.12], scale: [1.2, 0.6, 1.5], color: dark },
    { geo: { kind: "sphere", r: 0.2 }, pos: [0.38 * s, -0.88 * s, 0.12], scale: [1.2, 0.6, 1.5], color: dark },
  );

  // боковые лапки
  parts.push(
    { geo: { kind: "sphere", r: 0.2 }, pos: [-0.92 * s, -0.2 * s, 0.1], scale: [0.7, 1.1, 0.7], color: dark },
    { geo: { kind: "sphere", r: 0.2 }, pos: [0.92 * s, -0.2 * s, 0.1], scale: [0.7, 1.1, 0.7], color: dark },
  );

  // глаза по стилю вида
  const eyeY = 0.28 * s;
  if (def.body.eyes === "normal") {
    const ex = 0.31 * s;
    parts.push(
      { geo: { kind: "sphere", r: 0.115 }, pos: [-ex, eyeY, 0.82 * s], scale: 1, color: "#ffffff" },
      { geo: { kind: "sphere", r: 0.115 }, pos: [ex, eyeY, 0.82 * s], scale: 1, color: "#ffffff" },
      { geo: { kind: "sphere", r: 0.055 }, pos: [-ex, eyeY, 0.92 * s], scale: 1, color: "#1c1c1c" },
      { geo: { kind: "sphere", r: 0.055 }, pos: [ex, eyeY, 0.92 * s], scale: 1, color: "#1c1c1c" },
    );
  } else if (def.body.eyes === "shades") {
    const ex = 0.31 * s;
    parts.push(
      { geo: { kind: "sphere", r: 0.145 }, pos: [-ex, eyeY, 0.84 * s], scale: [1, 0.82, 0.5], color: "#141414" },
      { geo: { kind: "sphere", r: 0.145 }, pos: [ex, eyeY, 0.84 * s], scale: [1, 0.82, 0.5], color: "#141414" },
    );
  }

  // брови
  if (def.body.brows && def.body.eyes === "normal") {
    const ex = 0.31 * s;
    parts.push(
      { geo: { kind: "box", w: 0.18, h: 0.045, d: 0.05 }, pos: [-ex, eyeY + 0.17 * s, 0.86 * s], rot: [0, 0, 0.18], color: "#26201a" },
      { geo: { kind: "box", w: 0.18, h: 0.045, d: 0.05 }, pos: [ex, eyeY + 0.17 * s, 0.86 * s], rot: [0, 0, -0.18], color: "#26201a" },
    );
  }

  // индивидуальные черты (координаты каталога даны для s=1 — масштабируем по XZ, чтобы сидели на теле)
  for (const t of def.traits) {
    const pos: Vec3 = [t.pos[0] * s, t.pos[1] * s, t.pos[2] * s];
    const sc = t.scale == null
      ? 1
      : typeof t.scale === "number"
        ? t.scale
        : ([t.scale[0] * (s * 0.5 + 0.5), t.scale[1] * (s * 0.5 + 0.5), t.scale[2] * (s * 0.5 + 0.5)] as Vec3);
    parts.push({ ...t, pos, scale: sc, color: jitterColor(t.color, 0.015, rnd) });
  }

  return parts;
}
