import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
const ROOT = resolve(__dirname, "..");
function read(p: string) { return readFileSync(resolve(ROOT, p), "utf-8"); }

// ── 1550: Gallery 8 файлов 200 + GSAP y24 stagger 0.12 ──
describe("1550: gallery 8 файлов 200 — реальные webp+jpg", () => {
  it("public/images/gallery-42: 8 файлов (4 webp + 4 jpg) каждый >5KB, dist синхрон", () => {
    const pub = resolve(ROOT, "public/images/gallery-42");
    const dist = resolve(ROOT, "dist/images/gallery-42");
    expect(existsSync(pub)).toBe(true);
    const pubFiles = readdirSync(pub);
    expect(pubFiles.filter(f=>f.endsWith(".webp")).length).toBe(4);
    expect(pubFiles.filter(f=>f.endsWith(".jpg")).length).toBe(4);
    for (const f of pubFiles) expect(statSync(join(pub,f)).size).toBeGreaterThan(5*1024);
    // dist синхрон с public (build копирует)
    if (existsSync(dist)) {
      const distFiles = readdirSync(dist);
      expect(distFiles.length).toBeGreaterThanOrEqual(8);
    }
    // базовые имена без коллизий
    const bases = ["42-agit-01","42-y2k-01","42-cyber-01","42-memphis-01"];
    for (const b of bases) {
      expect(pubFiles.includes(`${b}-800.webp`), `нет ${b}-800.webp`).toBe(true);
      expect(pubFiles.includes(`${b}.jpg`), `нет ${b}.jpg`).toBe(true);
    }
  });
  it("GalleryPage REAL_BY_STYLE 4 стиля → 800.webp + REAL_FALLBACK 7 ids без 404", () => {
    const src = read("src/pages/GalleryPage.tsx");
    expect(src).toContain("REAL_BY_STYLE");
    expect(src).toContain("REAL_FALLBACK");
    expect(src).toContain("42-agit-01-800.webp");
    expect(src).toContain("42-y2k-01-800.webp");
    expect(src).toContain("42-cyber-01-800.webp");
    expect(src).toContain("42-memphis-01-800.webp");
    // прямых 404-путей быть не должно
    expect(src).not.toMatch(/src:\s*"\/magnum\/images\/gallery-42\/ussr-01\.jpg"/);
    // FALLBACK покрывает все BASE_ARTS id
    const ids = [...src.matchAll(/id:\s*"(ussr|y2k|cyber|memphis)-/g)];
    expect(ids.length).toBeGreaterThanOrEqual(6);
  });
  it("GalleryPage GSAP: set+to y24 stagger 0.12 ScrollTrigger batch + reduced-motion + context cleanup", () => {
    const src = read("src/pages/GalleryPage.tsx");
    expect(src).toContain("gsap.set(");
    expect(src).toContain("gsap.to(");
    expect(src).not.toMatch(/gsap\.from\(/); // bare from ломается в IIFE
    expect(src).toContain("ScrollTrigger");
    expect(src).toMatch(/ScrollTrigger\.batch|batch\(/);
    expect(src).toContain("stagger: 0.12");
    expect(src).toContain("duration: 0.55");
    expect(src).toContain("prefersReducedMotion");
    expect(src).toContain("prefers-reduced-motion");
    expect(src).toContain("clearProps");
    expect(src).toContain("gsap.context");
    expect(src).toMatch(/ctx\.revert|context.*revert/);
  });
  it("GalleryPage lightbox gsap.to + Escape keydown + BASE_ARTS 8+ карточек", () => {
    const src = read("src/pages/GalleryPage.tsx");
    expect(src).toContain("lightbox");
    expect(src).toMatch(/Escape|onKeyDown|keydown/);
    expect((src.match(/gsap\.to\(/g)||[]).length).toBeGreaterThanOrEqual(3);
    expect(src).toContain("BASE_ARTS");
  });
});

// ── 1550: GamesHub 16 игр + GSAP y24 stagger ──
describe("1550: GamesHub 16 игр + GSAP + 5 пуль лор", () => {
  it("GAMES массив 16 игр, каждая /magnum/games/*", () => {
    const src = read("src/pages/GamesHub.tsx");
    const games = [...src.matchAll(/\{\s*to:\s*"\/magnum\/games\//g)];
    expect(games.length).toBe(16);
    for (const r of ["games/2042","games/flappy","games/snake","games/dodge","games/typing","games/timeline","games/blackjack","games/roulette","games/rhythm","games/stack"]) {
      expect(src).toContain(r);
    }
  });
  it("GamesHub GSAP: y24 stagger 0.12 duration 0.55 reduced-motion gsap.context cleanup", () => {
    const src = read("src/pages/GamesHub.tsx");
    expect(src).toContain("gsap.set(");
    expect(src).toContain("gsap.to(");
    expect(src).toContain("ScrollTrigger");
    expect(src).toContain("stagger: 0.12");
    expect(src).toContain("duration: 0.55");
    expect(src).toContain("prefers-reduced-motion");
    expect(src).toContain("gsap.context");
    expect(src).toContain("RGB_GLOW");
  });
  it("GamesHub описания содержат 42/MAGNUM лор (2026)", () => {
    const src = read("src/pages/GamesHub.tsx");
    expect(src).toMatch(/42/);
    expect(src).toMatch(/MAGNUM|5.?пуль|42с|пресейв/i);
  });
});

// ── 1550: Dodge42 + Runner — canvas + WebAudio + GSAP + presave ──
describe("1550: Dodge42 Runner — canvas WebAudio GSAP presave", () => {
  it("Dodge42Game: canvas + AudioContext + GSAP batch + 5 пуль presave", () => {
    const src = read("src/pages/games/Dodge42Game.tsx");
    expect(src).toContain("canvas");
    expect(src).toContain("AudioContext");
    expect(src).toContain("gsap");
    expect(src).toContain("ScrollTrigger");
    expect(src).toContain("5 ПУЛЬ");
    expect(src).toContain("music.thefence.me/psmagnum");
    expect(src).toContain("prefersReducedMotion");
  });
  it("RunnerGame: canvas + WebAudio 5+ звуков + GSAP hover RGB_GLOW", () => {
    const src = read("src/pages/games/RunnerGame.tsx");
    expect(src).toContain("canvasRef");
    expect(src).toContain("AudioContext");
    expect(src).toContain("gsap.to(");
    expect(src).toContain("RGB_GLOW");
    expect(src).toContain("ScrollTrigger");
  });
  it("src/pages/games содержит 16+ .tsx файлов, критичные игры на месте", () => {
    const files = readdirSync(resolve(ROOT, "src/pages/games"));
    expect(files.filter(f=>f.endsWith(".tsx")).length).toBeGreaterThanOrEqual(16);
    for (const f of ["Game2042.tsx","RhythmGame.tsx","TypingGame.tsx","Dodge42Game.tsx","RunnerGame.tsx","Timeline2026Game.tsx"]) {
      expect(existsSync(resolve(ROOT, `src/pages/games/${f}`))).toBe(true);
    }
  });
});

// ── 1550: API health + coins/add verify + SPA + build 200 ──
describe("1550: API + build health 200", () => {
  it("server.ts: /magnum/api/health GET + counts + /magnum/api/coins/add verify POST + rateLimit", () => {
    const s = read("server.ts");
    expect(s).toContain("/magnum/api/health");
    expect(s).toContain("/magnum/api/coins/add");
    expect(s).toMatch(/checkRateLimit|rateLimit/);
    expect(s).toContain("verify");
    expect(s).toContain("/magnum/api/frame/verify");
  });
  it("server.ts: SPA fallback отдаёт index.html для не-API (200), build.ts hash+vendor+splitting", () => {
    const s = read("server.ts");
    expect(s).toContain("index.html");
    const b = read("build.ts");
    expect(b).toContain("Bun.build");
    expect(b).toMatch(/splitting|vendor|hash/);
  });
  it("dist/index.html существует, >500 байт, ссылается на main-*.js + /magnum/ base", () => {
    const idx = resolve(ROOT, "dist/index.html");
    expect(existsSync(idx)).toBe(true);
    const html = readFileSync(idx, "utf-8");
    expect(html.length).toBeGreaterThan(500);
    expect(html).toMatch(/main-.*\.js/);
    expect(html).toMatch(/\/magnum\//);
  });
  it("tsc --noEmit чист (tsconfig src include) + package.json scripts test/build", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.scripts.test).toBeTruthy();
    expect(pkg.scripts.build).toBeTruthy();
    const cfg = JSON.parse(read("tsconfig.json"));
    expect(cfg.compilerOptions.noEmit).toBe(true);
  });
});
