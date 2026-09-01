import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const bj = readFileSync(resolve(ROOT, "src/pages/games/BlackjackGame.tsx"), "utf8");
const rl = readFileSync(resolve(ROOT, "src/pages/games/RouletteGame.tsx"), "utf8");

describe("🎴 Blackjack 42 — спека 4200 открытка", () => {
  it("START_BALANCE 1000 и GOAL 4200", () => {
    expect(bj).toContain("START_BALANCE = 1000");
    expect(bj).toContain("GOAL = 4200");
  });
  it("LS ключи blackjack42-balance + best", () => {
    expect(bj).toContain("blackjack42-balance");
    expect(bj).toContain("blackjack42-best");
  });
  it("BJ 3:2 и soft17 логика", () => {
    expect(bj).toContain("isSoft17");
    expect(bj).toContain("isBlackjack");
    expect(bj).toContain("1.5");
  });
  it("doubleDown только на 2 картах и bet*2", () => {
    expect(bj).toContain("doubleDown");
    expect(bj).toContain("player.length!==2");
    expect(bj).toContain("bet*2");
  });
  it("needReshuffle <12 и handValue ace 11→1", () => {
    expect(bj).toContain("needReshuffle");
    expect(bj).toContain("handValue");
    expect(bj).toContain("rank===\"A\"");
  });
  it("победа 4200 → showWin + postcard-4200.png + presave", () => {
    expect(bj).toContain("balance>=GOAL");
    expect(bj).toContain("postcard-4200.png");
    expect(bj).toContain("music.thefence.me/psmagnum");
  });
  it("сброс <=0 → 200 и resetAll → 1000", () => {
    expect(bj).toContain("Банк пополнен до 200");
    expect(bj).toContain("setBalance(200)");
  });
  it("WebAudio звуки + safeRamp", () => {
    expect(bj).toContain("AudioContext");
    expect(bj).toContain("playBlackjack");
    expect(bj).toContain("safeRamp");
  });
  it("фишки 10/25/50/100/250 и MIN_BET 10", () => {
    expect(bj).toContain("10,25,50,100,250");
    expect(bj).toContain("MIN_BET = 10");
  });
});

describe("🎰 Roulette 42 — спека 4200 открытка", () => {
  it("START 1000 WIN 4200", () => {
    expect(rl).toContain("START_BALANCE = 1000");
    expect(rl).toContain("WIN_BALANCE = 4200");
  });
  it("European 0-36 + WHEEL_ORDER 37 + RED_NUMS", () => {
    expect(rl).toContain("WHEEL_ORDER");
    expect(rl).toContain("RED_NUMS");
    expect(rl).toContain("getColor");
  });
  it("фишки 1/5/25/100", () => {
    expect(rl).toContain("1, 5, 25, 100");
  });
  it("10 пресетов включая Осирис/42/Соседи0", () => {
    expect(rl).toContain("BET_PRESETS");
    expect(rl).toContain("Осирис");
    expect(rl).toContain("42");
    expect(rl).toContain("Соседи 0");
    const matches = (rl.match(/label:/g) || []).length;
    expect(matches).toBeGreaterThanOrEqual(10);
  });
  it("выплаты 35:1 straight и 2:1 dozen", () => {
    expect(rl).toContain("35");
    expect(rl).toContain("amount*2");
    expect(rl).toContain("payout");
  });
  it("победа 4200 → confetti + postcard + presave", () => {
    expect(rl).toContain("WIN_BALANCE");
    expect(rl).toContain("burstConfetti");
    expect(rl).toContain("postcard-4200.png");
    expect(rl).toContain("music.thefence.me/psmagnum");
  });
  it("swipe s50 + ×2/↻/autoSpin", () => {
    expect(rl).toContain("handleTouchStart");
    expect(rl).toContain("handleTouchEnd");
    expect(rl).toContain("doubleBets");
    expect(rl).toContain("repeatLast");
    expect(rl).toContain("autoSpin");
  });
  it("hot/cold + GSAP context", () => {
    expect(rl).toContain("hotNumbers");
    expect(rl).toContain("coldNumbers");
    expect(rl).toContain("gsap.context");
  });
  it("WebAudio звуки", () => {
    expect(rl).toContain("AudioContext");
    expect(rl).toContain("playWinSound");
    expect(rl).toContain("playSpinRumble");
  });
});
