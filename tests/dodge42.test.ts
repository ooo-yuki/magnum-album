import { describe, it, expect } from "vitest";
import { circleHit, spawnWave } from "../src/pages/games/dodge42Logic";

// ---- circleHit collision ----
describe("dodge42: circleHit", () => {
  it("returns true when circles overlap", () => {
    expect(circleHit(100, 100, 14, 105, 105, 7)).toBe(true);
  });

  it("returns false when circles are far apart", () => {
    expect(circleHit(100, 100, 14, 300, 300, 7)).toBe(false);
  });

  it("returns false at exact boundary (touching)", () => {
    // distance = 21 = 14 + 7 → just touching, should be false (strict <)
    expect(circleHit(0, 0, 14, 21, 0, 7)).toBe(false);
    // distance = 20.9 < 21 → true
    expect(circleHit(0, 0, 14, 20.9, 0, 7)).toBe(true);
  });

  it("returns true when circles fully overlap", () => {
    expect(circleHit(50, 50, 14, 50, 50, 7)).toBe(true);
  });

  it("handles zero-radius circles", () => {
    expect(circleHit(10, 10, 0, 10, 10, 0)).toBe(false);
    expect(circleHit(10, 10, 5, 10, 10, 0)).toBe(true);
  });
});

// ---- spawnWave ----
describe("dodge42: spawnWave", () => {
  it("returns correct number of bullets for wave 0", () => {
    const bullets = spawnWave(0, 400, 560);
    expect(bullets.length).toBe(3); // min(3+0, 12) = 3
  });

  it("returns more bullets for higher waves", () => {
    const w5 = spawnWave(5, 400, 560);
    expect(w5.length).toBe(8); // min(3+5, 12) = 8
  });

  it("caps at 12 bullets max", () => {
    const w20 = spawnWave(20, 400, 560);
    expect(w20.length).toBe(12); // min(3+20, 12) = 12
  });

  it("bullets have valid velocities", () => {
    const bullets = spawnWave(1, 400, 560);
    for (const b of bullets) {
      expect(typeof b.vx).toBe("number");
      expect(typeof b.vy).toBe("number");
      expect(isFinite(b.vx)).toBe(true);
      expect(isFinite(b.vy)).toBe(true);
      // at least one component should be non-zero (bullet moves)
      expect(Math.abs(b.vx) + Math.abs(b.vy)).toBeGreaterThan(0);
    }
  });

  it("bullets have colors from BULLET_COLORS palette", () => {
    const validColors = ["#ff2d55", "#ffcc00", "#00ff88", "#5865f2", "#ff6b35"];
    const bullets = spawnWave(3, 400, 560);
    for (const b of bullets) {
      expect(validColors).toContain(b.color);
    }
  });

  it("deterministic: same seed produces same result", () => {
    const a = spawnWave(2, 400, 560, 42);
    const b = spawnWave(2, 400, 560, 42);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i]!.x).toBe(b[i]!.x);
      expect(a[i]!.y).toBe(b[i]!.y);
      expect(a[i]!.vx).toBe(b[i]!.vx);
      expect(a[i]!.vy).toBe(b[i]!.vy);
    }
  });

  it("different seeds produce different results", () => {
    const a = spawnWave(1, 400, 560, 42);
    const b = spawnWave(1, 400, 560, 99);
    // at least one bullet should differ
    const someDiffer = a.some((ab, i) => ab.x !== b[i]!.x || ab.y !== b[i]!.y);
    expect(someDiffer).toBe(true);
  });

  it("speed increases with wave number", () => {
    const w0 = spawnWave(0, 400, 560, 100);
    const w10 = spawnWave(10, 400, 560, 100);
    // average speed magnitude should be higher for wave 10
    const avgSpeed = (arr: typeof w0) => {
      let total = 0;
      for (const b of arr) total += Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      return total / arr.length;
    };
    expect(avgSpeed(w10)).toBeGreaterThan(avgSpeed(w0));
  });
});
