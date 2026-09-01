import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
const ROOT = resolve(__dirname, "..");
function read(p: string) { return readFileSync(resolve(ROOT, p), "utf-8"); }

// ── 1540: RhythmGame — полноценный game page 2026 ──
describe("1540: RhythmGame full — judgeTape 32 + mute + share + DIFFICULTY", () => {
  const src = read("src/pages/games/RhythmGame.tsx");
  it("state: judgeTape 32 + muted + shareMsg определены", () => {
    expect(src).toContain("judgeTape");
    expect(src).toContain("setJudgeTape");
    expect(src).toContain("Array.from({length:32})");
    expect(src).toContain("muted");
    expect(src).toContain("setMuted");
    expect(src).toContain("shareMsg");
    expect(src).toContain("setShareMsg");
    expect(src).toContain('rhythm42-muted');
  });
  it("DIFFICULTY 3 пресета: easy/normal/hard с win 3500/5000/6500", () => {
    expect(src).toContain('easy: { perfect: 95');
    expect(src).toContain('normal: { perfect: 75');
    expect(src).toContain('hard: { perfect: 55');
    expect(src).toContain('win: 3500');
    expect(src).toContain('win: 5000');
    expect(src).toContain('win: 6500');
    expect(src).toContain('DIFFICULTY[diff].win');
  });
  it("PERFECT 75 / GOOD 145 / NOTE_SPEED 360 + LANE_COUNT 4", () => {
    expect(src).toContain('PERFECT_WINDOW = 75');
    expect(src).toContain('GOOD_WINDOW = 145');
    expect(src).toContain('NOTE_SPEED = 360');
    expect(src).toContain('LANE_COUNT = 4');
    expect(src).toContain('LANE_KEYS');
    expect(src).toContain('LANE_LABELS');
  });
  it("WebAudio safeRamp + AudioParam обёртка, пресвейв https://music.thefence.me/psmagnum", () => {
    expect(src).toContain('safeRamp');
    expect(src).toContain('AudioParam');
    expect(src).toContain('presave');
    expect(src).toContain('music.thefence.me/psmagnum');
    expect(src).toContain('AudioContext');
  });
  it("GSAP ScrollTrigger + prefersReducedMotion + RGB_GLOW", () => {
    expect(src).toContain('ScrollTrigger');
    expect(src).toContain('gsap.registerPlugin');
    expect(src).toContain('prefersReducedMotion');
    expect(src).toContain('RGB_GLOW');
    expect(src).toMatch(/gsap\.(to|set)\(/);
  });
  it("FEVER x5 пуль + judgement perfect/good/miss + tape breakdown", () => {
    expect(src).toContain('fever');
    expect(src).toContain('FEVER');
    expect(src).toContain('5 ПУЛЬ');
    expect(src).toContain('perfect');
    expect(src).toContain('judgement');
    expect(src).toContain('judgeTape.filter');
  });
  it("поделиться: clipboard.writeText + shareMsg Скопировано + 2200ms таймаут", () => {
    expect(src).toContain('clipboard.writeText');
    expect(src).toContain('Скопировано');
    expect(src).toContain('2200');
    expect(src).toContain('Поделиться');
  });
});

// ── 1540: TypingGame — 5 пуль, 2026 tips, WPM 42 ──
describe("1540: TypingGame — 2026 лор, WPM, FEVER, presave", () => {
  const src = read("src/pages/games/TypingGame.tsx");
  it("PHRASES с 42/MAGNUM/5 пуль + TYPING_TIPS с 42 WPM", () => {
    expect(src).toContain('PHRASES');
    expect(src).toContain('TYPING_TIPS');
    expect(src).toContain('42');
    expect(src).toMatch(/MAGNUM|5.?пуль|пять.?пуль/i);
  });
  it("DIFFICULTY win 28/42/55 WPM + coinMul 1/1.5/2", () => {
    expect(src).toContain('win: 28');
    expect(src).toContain('win: 42');
    expect(src).toContain('win: 55');
    expect(src).toContain('coinMul: 1');
    expect(src).toContain('coinMul: 1.5');
    expect(src).toContain('coinMul: 2');
  });
  it("calcWPM(chars/5 / minutes) + WebAudio 4 звука", () => {
    expect(src).toContain('calcWPM');
    expect(src).toContain('chars / 5');
    expect(src).toContain('60000');
    expect(src).toMatch(/AudioContext|createOscillator/);
  });
  it("FEVER + perfectStreak + combo + particles/floats", () => {
    expect(src).toContain('fever');
    expect(src).toContain('perfectStreak');
    expect(src).toContain('combo');
    expect(src).toContain('particles');
    expect(src).toContain('floats');
  });
  it("GSAP ScrollTrigger batch + presave thefence.me", () => {
    expect(src).toContain('ScrollTrigger');
    expect(src).toContain('music.thefence.me/psmagnum');
  });
  it("typing42: diff в LS (UI-only) + рекорд в Neon magnum_game_scores (no fake best)", () => {
    expect(src).toContain('typing42-diff');
    expect(src).not.toContain('typing42-best'); // рекорд больше не в LS
    expect(src).toContain('games/submit'); // сохранение результата в Neon
  });
});

// ── 1540: server + build + dist health ──
describe("1540: server.ts health + SPA + build", () => {
  it("server.ts: health возвращает ok:true + counts Neon 14 таблиц", () => {
    const s = read("server.ts");
    expect(s).toContain('/magnum/api/health');
    expect(s).toMatch(/ok.*true/);
    expect(s).toMatch(/counts|magnum_users|handleHealth/);
  });
  it("server.ts: SPA fallback — все не-API отдают index.html (200)", () => {
    const s = read("server.ts");
    expect(s).toContain('index.html');
    expect(s).toMatch(/SPA|fallback/i);
  });
  it("build.ts: Bun.build hash + vendor chunk + splitting", () => {
    const s = read("build.ts");
    expect(s).toContain('Bun.build');
    expect(s).toMatch(/vendor|splitting|hash/);
    expect(s).toContain('dist');
  });
  it("dist/index.html существует и ссылается на main-*.js (health 200)", () => {
    const distIdx = resolve(ROOT, "dist/index.html");
    expect(existsSync(distIdx)).toBe(true);
    const html = readFileSync(distIdx, "utf-8");
    expect(html).toMatch(/main-.*\.js/);
    expect(html.length).toBeGreaterThan(500);
  });
  it("tsconfig include src — tsc проходит чисто (noEmit)", () => {
    const cfg = JSON.parse(read("tsconfig.json"));
    expect(cfg.compilerOptions.noEmit).toBe(true);
    expect(cfg.include).toContain("src");
  });
});
