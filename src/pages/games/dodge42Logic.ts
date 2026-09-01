// Pure game logic for 5 ПУЛЬ — extracted for testability

const BULLET_COLORS = ["#ff2d55", "#ffcc00", "#00ff88", "#5865f2", "#ff6b35"];

export interface Bullet {
  x: number; y: number; vx: number; vy: number;
  color: string; trail: { x: number; y: number }[]; alive: boolean;
}

// — deterministic seeded wave for tests and reproducibility
export function spawnWave(wave: number, w: number, h: number, seed = 42): Bullet[] {
  let s = seed + wave * 7919;
  const rnd = () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };
  const bullets: Bullet[] = [];
  const count = Math.min(3 + wave, 12);
  const speed = 1.6 + wave * 0.28;
  for (let i = 0; i < count; i++) {
    const color = BULLET_COLORS[i % 5]!;
    const side = Math.floor(rnd() * 4);
    let x: number, y: number, vx: number, vy: number;
    if (side === 0) { x = 30 + rnd() * (w - 60); y = -10; vx = (rnd() - 0.5) * speed * 0.6; vy = speed; }
    else if (side === 1) { x = -10; y = 30 + rnd() * (h * 0.5); vx = speed; vy = speed * 0.4 * (rnd() > 0.5 ? 1 : -1); }
    else if (side === 2) { x = w + 10; y = 30 + rnd() * (h * 0.5); vx = -speed; vy = speed * 0.4 * (rnd() > 0.5 ? 1 : -1); }
    else { const a = (i / count) * Math.PI * 0.8 + 0.2; x = w / 2 + Math.cos(a) * (w * 0.4); y = -10; vx = -Math.cos(a) * speed * 0.3; vy = speed; }
    bullets.push({ x, y, vx, vy, color, trail: [], alive: true });
  }
  return bullets;
}

// — collision check
export function circleHit(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean {
  const dx = ax - bx; const dy = ay - by;
  return dx * dx + dy * dy < (ar + br) * (ar + br);
}
