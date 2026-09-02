import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
function read(p: string): string { return readFileSync(resolve(ROOT, p), "utf8"); }

// ---- Flappy42Game: content checks ----
describe("flappy42: component renders", () => {
  const src = read("src/pages/games/Flappy42Game.tsx");
  it("renders title FLAPPY 42", () => { expect(src).toContain("FLAPPY 42"); });
  it("renders goal 42 in HUD", () => { expect(src).toContain("WIN_SCORE = 42"); });
  it("renders play button", () => { expect(src).toContain("Играть!"); });
  it("renders back link to games", () => { expect(src).toContain("/magnum/games"); });
  it("renders canvas element", () => { expect(src).toContain("<canvas"); });
  it("renders HUD with 3 stats", () => {
    expect(src).toContain("Очки");
    expect(src).toContain("Цель");
    expect(src).toContain("Рекорд");
  });
});

// ---- Flappy42Game: in GamesHub ----
describe("flappy42: listed in GamesHub", () => {
  const hub = read("src/pages/GamesHub.tsx");
  it("GamesHub includes FLAPPY 42 card", () => {
    expect(hub).toContain("FLAPPY 42");
    expect(hub).toContain("Пролети 42 трубы");
  });
  it("GamesHub has 12 games total", () => {
    const count = (hub.match(/to: \"\/magnum\/games\//g) || []).length;
    expect(count).toBeGreaterThanOrEqual(12);
  });
});

// ---- Flappy42Game: presave link ----
describe("flappy42: presave link", () => {
  const src = read("src/pages/games/Flappy42Game.tsx");
  it("presave URL points to thefence.me", () => {
    expect(src).toContain("music.thefence.me/psmagnum");
  });
});
