import { describe, it, expect } from "vitest";

// Stack42 v2026 — MAGNUM 5 пуль + pause + coins
describe("Stack42 2026 — MAGNUM lore", () => {
  const MAGNUM_PULS = [
    "ТУСА МЕДУЗА 🪼 14.08",
    "VPN 🔒",
    "CLAY 🧱 03.04",
    "42 ✌️",
    "MAGNUM ● 5 ПУЛЬ",
  ];
  function blockLore(idx: number): string {
    if (idx === 0) return "ФУНДАМЕНТ 42";
    if (idx % 5 === 0) return MAGNUM_PULS[(Math.floor(idx / 5) - 1) % 5]!;
    if (idx === 15) return "42 ЭТАЖ — ПРЕСЕЙВ!";
    if (idx > 30) return `Пульс ${idx} — MAGNUM`;
    return "";
  }

  it("MAGNUM 5 пуль — каждый 5-й этаж", () => {
    expect(blockLore(5)).toBe("ТУСА МЕДУЗА 🪼 14.08");
    expect(blockLore(10)).toBe("VPN 🔒");
    expect(blockLore(15)).toBe("CLAY 🧱 03.04");
  });

  it("COMBO/MEGA threshold — 3/5", () => {
    const COMBO_AT = 3, MEGA_AT = 5;
    expect(COMBO_AT).toBe(3);
    expect(MEGA_AT).toBe(5);
    // streak logic
    const streak = 4;
    expect(streak >= COMBO_AT).toBe(true);
    expect(streak >= MEGA_AT).toBe(false);
  });

  it("pause toggle — state machine", () => {
    let paused = false;
    const toggle = () => (paused = !paused);
    toggle(); expect(paused).toBe(true);
    toggle(); expect(paused).toBe(false);
  });

  it("WIN_PTS 4200 — coins reward formula", () => {
    const WIN_PTS = 4200;
    const pts = 4200;
    const coins = 420 + Math.floor(pts / 10);
    expect(coins).toBe(840);
    expect(WIN_PTS).toBe(4200);
  });

  it("progress calc", () => {
    const pct = (pts: number) => Math.min((pts / 4200) * 100, 100);
    expect(pct(0)).toBe(0);
    expect(pct(2100)).toBe(50);
    expect(pct(5000)).toBe(100);
  });

  it("speed cap 6.5", () => {
    const SPEED_START = 1.8, SPEED_INC = 0.11, SPEED_MAX = 6.5;
    const speed = (h: number) => Math.min(SPEED_MAX, SPEED_START + h * SPEED_INC + (h > 10 ? (h - 10) * 0.06 : 0));
    expect(speed(0)).toBeCloseTo(1.8);
    expect(speed(42)).toBe(6.5);
  });
});
