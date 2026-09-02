import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
function read(p: string): string { return readFileSync(resolve(ROOT, p), "utf-8"); }

// ── Snake42 combo system ──
describe("snake42 combo", () => {
  const src = read("src/pages/games/Snake42Game.tsx");
  const css = read("src/pages/games/Snake42Game.module.css");

  it("playCombo() звук зависит от combo", () => {
    expect(src).toContain("function playCombo");
    expect(src).toContain("combo");
    expect(src).toContain("740 +");
  });

  it("comboRef + lastEatRef + bonusAccRef", () => {
    expect(src).toContain("comboRef");
    expect(src).toContain("lastEatRef");
    expect(src).toContain("bonusAccRef");
    expect(src).toContain("maxComboRef");
  });

  it("комбо окно 1800мс и капа 12", () => {
    expect(src).toContain("1800");
    expect(src).toContain("Math.min(comboRef.current + 1, 12)");
  });

  it("бонус (combo-1)*25", () => {
    expect(src).toContain("(comboRef.current - 1) * 25");
    expect(src).toContain("bonusAccRef.current += bonus");
    expect(src).toContain("baseScore + bonusAccRef.current");
  });

  it("GSAP combo burst на combo>=2", () => {
    expect(src).toContain("comboElRef");
    expect(src).toContain("gsap.fromTo(comboElRef");
    expect(src).toContain("back.out");
    expect(src).toContain("comboFlash");
  });

  it("бейдж COMBO в рендере", () => {
    expect(src).toContain("comboBar");
    expect(src).toContain("КОМБО");
    expect(src).toContain("comboFlash ? styles.comboHot");
  });

  it("float text показывает COMBO xN", () => {
    expect(src).toContain("COMBO x");
    expect(src).toContain("isCombo ?");
  });

  it("CSS comboBar + comboHot + keyframes", () => {
    expect(css).toContain(".comboBar");
    expect(css).toContain(".comboHot");
    expect(css).toContain("@keyframes comboPop");
    expect(css).toContain("comboPop");
  });

  it("shake сильнее на комбо", () => {
    expect(src).toContain("isCombo ? 6 + comboRef.current");
  });

  it("ресет обнуляет комбо", () => {
    expect(src).toContain("comboRef.current = 0");
    expect(src).toContain("setCombo(0)");
    expect(src).toContain("setComboFlash(false)");
  });
});

// ── pure logic ──
function calcCombo(prev: number, dt: number, cap = 12): number {
  if (dt < 1800 && prev !== 0) return Math.min(prev + 1, cap);
  return 1;
}
function comboBonus(combo: number): number { return combo > 1 ? (combo - 1) * 25 : 0; }

describe("snake42 combo pure logic", () => {
  it("первый съед combo=1", () => expect(calcCombo(0, 0)).toBe(1));
  it("быстрый съед инкремент", () => expect(calcCombo(1, 900)).toBe(2));
  it("медленный съед сброс на 1", () => expect(calcCombo(3, 2000)).toBe(1));
  it("капа 12", () => expect(calcCombo(12, 100)).toBe(12));
  it("бонус 0 на x1", () => expect(comboBonus(1)).toBe(0));
  it("бонус 25 на x2, 100 на x5", () => {
    expect(comboBonus(2)).toBe(25);
    expect(comboBonus(5)).toBe(100);
  });
});
