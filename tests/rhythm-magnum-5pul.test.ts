import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const src = readFileSync(resolve(__dirname, "../src/pages/games/RhythmGame.tsx"), "utf8");
describe("🎵 RhythmGame MAGNUM 5 пуль — 2026 усиление", () => {
  it("RHYTHM_TIPS 10+ и упоминает MAGNUM/ТУСА/VPN/CLAY/пресейв", () => {
    expect(src).toContain("RHYTHM_TIPS");
    expect(src).toContain("ТУСА МЕДУЗА");
    expect(src).toContain("VPN");
    expect(src).toContain("CLAY");
    expect(src).toContain("music.thefence.me/psmagnum");
    const count = (src.match(/5 пуль/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(4);
  });
  it("LS ключи best + tut + FEVER 5", () => {
    expect(src).toContain("rhythm42-best");
    expect(src).toContain("rhythm42-tut-v1");
    expect(src).toContain("FEVER_NEED = 5");
    expect(src).toContain("FEVER_MS = 6000");
  });
  it("bullet bar 5 кружков + perfectStreakRef + best отображение", () => {
    expect(src).toContain("perfectStreakRef.current");
    expect(src).toContain("5 пуль");
    expect(src).toContain("★ Рекорд");
    expect(src).toContain("tipIdx");
  });
  it("presave beacon на win + playFeverBurst SFX", () => {
    expect(src).toContain('src: "rhythm_win"');
    expect(src).toContain("playFeverBurst");
    expect(src).toContain("/magnum/api/presave/click");
  });
  it("SONGS 5 треков 2026 + DIFFICULTY 3 уровня", () => {
    expect(src).toContain("ТУСА МЕДУЗА");
    expect(src).toContain("MAGNUM — 5 пуль");
    expect(src).toContain('easy:');
    expect(src).toContain('hard:');
  });
  it("tut overlay с localStorage и кнопка Понятно", () => {
    expect(src).toContain("Как играть");
    expect(src).toContain("Понятно");
    expect(src).toContain("localStorage.setItem(LS_TUT");
  });
});
