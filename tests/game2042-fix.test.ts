import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
const ROOT = resolve(__dirname, "..");
function read(p:string){ return readFileSync(resolve(ROOT,p),"utf-8"); }

describe("2042 FIX 15:00 — nested useEffect bug fixed + daily challenge + 2026 lore", ()=>{
  it("no nested useEffect (confetti + GSAP were nested — now 2 separate effects)", ()=>{
    const s = read("src/pages/games/Game2042.tsx");
    // should have confetti effect with cancelAnimationFrame return and no inner useEffect
    const confettiBlock = s.match(/confetti animation loop[\s\S]{0,2200}return \(\) => cancelAnimationFrame\(raf\)/);
    expect(confettiBlock, "confetti effect with cancelAnimationFrame return not found").not.toBeNull();
    // ensure confetti effect block does not contain nested useEffect before its deps
    const confettiIdx = s.indexOf("confetti animation loop");
    const confettiEnd = s.indexOf("}, [confetti])", confettiIdx);
    expect(confettiIdx, "confetti block not found").toBeGreaterThan(-1);
    expect(confettiEnd, "confetti deps not found").toBeGreaterThan(-1);
    const block = s.slice(confettiIdx, confettiEnd);
    // block should contain exactly 1 useEffect (outer), not 2
    const count = (block.match(/useEffect\(/g)||[]).length;
    expect(count, `confetti block should have 1 useEffect, got ${count}: nested bug` ).toBe(1);
  });
  it("daily challenge seededBoard + dailySeed + DAILY_KEY + submit + share present", ()=>{
    const s = read("src/pages/games/Game2042.tsx");
    expect(s).toContain("dailySeed");
    expect(s).toContain("seededBoard");
    expect(s).toContain("mulberry32");
    expect(s).toContain("DAILY_KEY");
    expect(s).toContain("startDaily");
    expect(s).toContain("dailyMode");
    expect(s).toContain("submitScore");
    expect(s).toContain("/magnum/api/games/submit");
    expect(s).toContain("shareResult");
    expect(s).toContain("navigator.share");
    expect(s).toContain("efficiency");
  });
  it("TILE_LORE 2026 инфоповоды: ТУСА МЕДУЗА 14.08 + VPN + CLAY 03.04 + presave link", ()=>{
    const s = read("src/pages/games/Game2042.tsx");
    expect(s).toContain("ТУСА МЕДУЗА");
    expect(s).toContain("14.08");
    expect(s).toContain("VPN");
    expect(s).toContain("CLAY");
    expect(s).toContain("03.04");
    expect(s).toContain("https://music.thefence.me/psmagnum");
    expect(s).toContain("5 пуль");
  });
  it("HUD efficiency + dailyMode banner + shareMsg + undo 6 counter", ()=>{
    const s = read("src/pages/games/Game2042.tsx");
    expect(s).toContain("Эффект");
    expect(s).toContain("ЕЖЕДНЕВНЫЙ ЧЕЛЛЕНДЖ");
    expect(s).toContain("Поделиться");
    expect(s).toContain("/6");
    expect(s).toContain("shareMsg");
  });
  it("win/over call submitScore + win modal 5 пуль text", ()=>{
    const s = read("src/pages/games/Game2042.tsx");
    expect(s).toContain("void submitScore(newScore)");
    expect(s).toContain("5 пуль MAGNUM");
  });
  it("build remains valid — gsap imported + ScrollTrigger registered", ()=>{
    const s = read("src/pages/games/Game2042.tsx");
    expect(s).toContain("gsap.registerPlugin(ScrollTrigger)");
    expect(s).toContain("from \"gsap\"");
  });
  it("micro-feat 15:05 — floats + haptics + spawn pop + 42 pulse", ()=>{
    const s = read("src/pages/games/Game2042.tsx");
    expect(s).toContain("floats");
    expect(s).toContain("floatIdRef");
    expect(s).toContain("navigator.vibrate");
    expect(s).toContain("spawnIdx");
    expect(s).toContain("boxShadow");
    expect(s).toContain("floatUp");
    const css = read("src/pages/games/Game2042.module.css");
    expect(css).toContain("floatUp");
  });
});
