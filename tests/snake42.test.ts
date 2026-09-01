import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
function read(p: string): string {
  return readFileSync(resolve(ROOT, p), "utf-8");
}

// ------------------------------------------------------------
// Snake42Game — content checks
// ------------------------------------------------------------
describe("content: Snake42Game.tsx", () => {
  const src = read("src/pages/games/Snake42Game.tsx");

  it("существует и экспортирует Snake42Game", () => {
    expect(src).toContain("export function Snake42Game");
  });

  it("цель WIN_LENGTH = 42", () => {
    expect(src).toContain("WIN_LENGTH = 42");
  });

  it("содержит пресейв ссылку thefence.me", () => {
    expect(src).toContain("music.thefence.me/psmagnum");
  });

  it("поддерживает WASD и стрелки", () => {
    expect(src).toContain("ArrowUp");
    expect(src).toContain("KeyW");
    expect(src).toContain("KeyA");
    expect(src).toContain("KeyS");
    expect(src).toContain("KeyD");
  });

  it("поддерживает touch swipe", () => {
    expect(src).toContain("onTouchStart");
    expect(src).toContain("onTouchEnd");
  });

  it("использует WebAudio для звуков", () => {
    expect(src).toContain("AudioContext");
    expect(src).toContain("playEat");
    expect(src).toContain("playDie");
    expect(src).toContain("playWin");
  });

  it("GRID = 20 (поле 20x20)", () => {
    expect(src).toContain("GRID = 20");
  });

  it("сохраняет рекорд в Neon magnum_game_scores (games/submit), не в LS", () => {
    expect(src).not.toContain("snake42-best");
    expect(src).toContain("games/submit");
  });
});

// ------------------------------------------------------------
// Snake42Game — route registered in App.tsx
// ------------------------------------------------------------
describe("content: Snake42Game route", () => {
  const appSrc = read("src/App.tsx");

  it("импорт Snake42Game в App.tsx", () => {
    expect(appSrc).toContain('Snake42Game');
  });

  it("роут /games/snake зарегистрирован", () => {
    expect(appSrc).toContain('games/snake');
    expect(appSrc).toContain('<Snake42Game');
  });
});

// ------------------------------------------------------------
// Snake42Game — карточка в GamesHub
// ------------------------------------------------------------
describe("content: Snake42Game в GamesHub", () => {
  const hubSrc = read("src/pages/GamesHub.tsx");

  it("карточка Змейка 42 в массиве GAMES", () => {
    expect(hubSrc).toContain("Змейка 42");
    expect(hubSrc).toContain("/magnum/games/snake");
    expect(hubSrc).toContain("🐍");
  });

  it("всего 14 игр в хабе", () => {
    const titles = (hubSrc.match(/title:\s*"/g) || []).length;
    expect(titles).toBeGreaterThanOrEqual(14);
  });
});
