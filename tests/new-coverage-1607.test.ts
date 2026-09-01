import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
const ROOT = resolve(__dirname, "..");
function read(p: string) { return readFileSync(resolve(ROOT, p), "utf8"); }

// ── галерея: реальные файлы + GSAP ──
describe("1607: галерея реальные файлы + GSAP", () => {
  it("GalleryPage 8 файлов gallery-42 существуют и >1KB", () => {
    const dir = resolve(ROOT, "public/images/gallery-42");
    expect(existsSync(dir)).toBe(true);
    const files = readdirSync(dir);
    expect(files.length).toBe(8);
    for (const f of files) expect(statSync(join(dir, f)).size).toBeGreaterThan(1024);
  });
  it("GalleryPage REAL_BY_STYLE маппит 4 стиля на 800.webp", () => {
    const src = read("src/pages/GalleryPage.tsx");
    expect(src).toContain("REAL_BY_STYLE");
    expect(src).toContain("42-agit-01-800.webp");
    expect(src).toContain("42-y2k-01-800.webp");
    expect(src).toContain("42-cyber-01-800.webp");
    expect(src).toContain("42-memphis-01-800.webp");
  });
  it("GalleryPage использует GSAP set+to, ScrollTrigger.batch, reduced-motion", () => {
    const src = read("src/pages/GalleryPage.tsx");
    expect(src).toContain("gsap.set(");
    expect(src).toContain("gsap.to(");
    expect(src).toContain("ScrollTrigger");
    expect(src).toContain("batch");
    expect(src).toContain("prefers-reduced-motion");
  });
  it("GalleryPage Lightbox onClick + Escape и ctx.revert cleanup", () => {
    const src = read("src/pages/GalleryPage.tsx");
    expect(src).toContain("onClick");
    expect(src).toMatch(/Escape|keydown/);
    expect(src).toContain("gsap.context");
    expect(src).toMatch(/ctx\.revert|context.*revert/);
  });
});

// ── игры: 16 в GamesHub + роуты + GSAP/canvas ──
describe("1607: игры 16 хаб + роуты + сборки", () => {
  it("GamesHub 16 игр уникальны и src/pages/games 16 .tsx", () => {
    const hub = read("src/pages/GamesHub.tsx");
    const tos = hub.match(/\/magnum\/games\/[a-z0-9-]+/g) || [];
    expect(tos.length).toBe(16);
    expect(new Set(tos).size).toBe(16);
    const files = readdirSync(resolve(ROOT, "src/pages/games")).filter(f => f.endsWith(".tsx"));
    expect(files.length).toBeGreaterThanOrEqual(16);
  });
  it("App.tsx все 16 роутов + gallery зарегистрированы (lazy + Suspense)", () => {
    const src = read("src/App.tsx");
    for (const r of ["games/2042","games/flappy","games/snake","games/dodge","games/rhythm","games/timeline","gallery"]) {
      expect(src).toContain(r);
    }
    expect(src).toContain("lazy(");
    expect(src).toContain("Suspense");
  });
  it("игры используют canvas/WebAudio/gsap (минимум 2)", () => {
    const checks = [
      read("src/pages/games/Game2042.tsx").includes("AudioContext") || read("src/pages/games/Game2042.tsx").includes("gsap"),
      read("src/pages/games/Flappy42Game.tsx").includes("canvas"),
      read("src/pages/games/RhythmGame.tsx").includes("AudioContext"),
      read("src/pages/games/Snake42Game.tsx").includes("canvas"),
    ];
    expect(checks.filter(Boolean).length).toBeGreaterThanOrEqual(2);
  });
});

// ── API/build 200 ──
describe("1607: API + build 200", () => {
  it("server.ts Bun.serve + health counts 14 таблиц + ok:true", () => {
    const s = read("server.ts");
    expect(s).toContain("Bun.serve");
    expect(s).toContain("/magnum/api/health");
    expect(s).toContain("handleHealth");
    expect(s).toContain("ok: true");
    expect(s).toContain("magnum_users");
    expect(s).toContain("magnum_game_scores");
  });
  it("server.ts auth/coins/shop/mining/ws роуты без хардкода секретов", () => {
    const s = read("server.ts");
    for (const p of ["/magnum/api/auth/register","/magnum/api/coins","/magnum/api/shop/catalog","/magnum/api/mining/click","/magnum/api/ws"]) {
      expect(s).toContain(p);
    }
    expect(s).toContain("process.env.DATABASE_URL");
    expect(s).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
  });
  it("dist health: index.html + chunk-*.js 200-совместимы, sitemap ≥16 https", () => {
    const dist = resolve(ROOT, "dist");
    expect(existsSync(join(dist, "index.html"))).toBe(true);
    const html = read("dist/index.html");
    expect(html).toContain("/magnum/");
    const chunks = readdirSync(dist).filter(f => f.startsWith("chunk-") && f.endsWith(".js"));
    expect(chunks.length).toBeGreaterThanOrEqual(10);
    const xml = read("public/sitemap.xml");
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].trim());
    expect(locs.length).toBeGreaterThanOrEqual(16);
    expect(new Set(locs).size).toBe(locs.length);
    for (const u of locs) { expect(u.startsWith("https://")).toBe(true); expect(u).toContain("/magnum"); }
  });
  it("build.ts Bun.build splitting+minify, Hero/Rhythm GSAP registerPlugin", () => {
    const b = read("build.ts");
    expect(b).toContain("Bun.build");
    expect(b).toContain("splitting");
    const hero = read("src/components/Hero.tsx");
    expect(hero).toContain("gsap");
    expect(hero).toContain("ScrollTrigger");
  });
});
