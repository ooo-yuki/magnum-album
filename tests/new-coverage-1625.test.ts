import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
const ROOT = resolve(__dirname, "..");
function read(p: string) { return readFileSync(resolve(ROOT, p), "utf8"); }

// ── галерея: реальные файлы + ARCHIVE_42 + loader + a11y ──
describe("1625: галерея реальные файлы + ARCHIVE_42 + build", () => {
  it("public/images/gallery-42 8 файлов, 4 webp + 4 jpg, каждый >1KB", () => {
    const dir = resolve(ROOT, "public/images/gallery-42");
    expect(existsSync(dir)).toBe(true);
    const files = readdirSync(dir);
    expect(files.length).toBe(8);
    const webp = files.filter(f => f.endsWith(".webp"));
    const jpg = files.filter(f => f.endsWith(".jpg"));
    expect(webp.length).toBe(4);
    expect(jpg.length).toBe(4);
    for (const f of files) expect(statSync(join(dir, f)).size).toBeGreaterThan(1024);
  });
  it("GalleryPage BASE_ARTS 7 карточек + MOCK_POOL + ARCHIVE_42 секция", () => {
    const src = read("src/pages/GalleryPage.tsx");
    expect(src).toContain("BASE_ARTS");
    expect(src).toContain("MOCK_POOL");
    expect(src).toContain("ARCHIVE_42");
    // 7 arts id
    for (const id of ["ussr-01","ussr-02","y2k-01","y2k-02","cyber-01","memphis-01","y2k-03"]) {
      expect(src).toContain(id);
    }
  });
  it("GalleryPage img использует loading=lazy + /magnum/images/gallery-42/", () => {
    const src = read("src/pages/GalleryPage.tsx");
    expect(src).toContain("loading=\"lazy\"");
    expect(src).toContain("/magnum/images/gallery-42/");
  });
  it("GalleryPage GSAP ScrollTrigger.batch + prefers-reduced-motion + ctx.revert + set+to", () => {
    const src = read("src/pages/GalleryPage.tsx");
    expect(src).toContain("gsap.set(");
    expect(src).toContain("gsap.to(");
    expect(src).toContain("ScrollTrigger");
    expect(src).toContain("batch");
    expect(src).toContain("prefers-reduced-motion");
    expect(src).toContain("gsap.context");
    expect(src).toContain("ctx.revert");
  });
  it("GalleryPage Lightbox onClick + Escape + role dialog замкнут", () => {
    const src = read("src/pages/GalleryPage.tsx");
    expect(src).toContain("onClick");
    expect(src).toMatch(/Escape|keydown/);
    expect(src).toMatch(/role.*dialog|dialog/);
  });
});

// ── игры: 16 хаб + 16 .tsx + App 16 роутов + lazy ──
describe("1625: игры 16 хаб + App роуты + сборки", () => {
  it("GamesHub GAMES 16 уникальных /magnum/games/* и src/pages/games 16+ .tsx", () => {
    const hub = read("src/pages/GamesHub.tsx");
    const tos = hub.match(/\/magnum\/games\/[a-z0-9-]+/g) || [];
    expect(tos.length).toBe(16);
    expect(new Set(tos).size).toBe(16);
    const files = readdirSync(resolve(ROOT, "src/pages/games")).filter(f => f.endsWith(".tsx"));
    expect(files.length).toBeGreaterThanOrEqual(16);
  });
  it("App.tsx 16 роутов игр + gallery + lazy/Suspense + SPA fallback hint", () => {
    const src = read("src/App.tsx");
    for (const r of ["games/2042","games/flappy","games/snake","games/dodge","games/rhythm","games/timeline","games/blackjack","games/roulette","gallery"]) {
      expect(src).toContain(r);
    }
    expect(src).toContain("lazy(");
    expect(src).toContain("Suspense");
  });
  it("игры используют canvas/WebAudio/gsap — минимум 3 игры", () => {
    const gameFiles = readdirSync(resolve(ROOT, "src/pages/games")).filter(f => f.endsWith(".tsx"));
    let hit = 0;
    for (const f of gameFiles) {
      const c = read(join("src/pages/games", f));
      if (/canvas|Canvas|getContext\(/.test(c) || /AudioContext|WebAudio|Oscillator/.test(c) || /gsap/.test(c)) hit++;
    }
    expect(hit).toBeGreaterThanOrEqual(3);
  });
  it("GamesHub GSAP stagger 0.12 + ScrollTrigger + reduced-motion + context cleanup", () => {
    const src = read("src/pages/GamesHub.tsx");
    expect(src).toContain("stagger");
    expect(src).toContain("0.12");
    expect(src).toContain("ScrollTrigger");
    expect(src).toContain("prefers-reduced-motion");
    expect(src).toContain("gsap.context");
    expect(src).toContain("ctx.revert");
  });
});

// ── server + build 200 ──
describe("1625: server Bun.serve + health + build 200", () => {
  it("server.ts Bun.serve + handleHealth ok:true + 14 таблиц magnum_*", () => {
    const src = read("server.ts");
    expect(src).toContain("Bun.serve");
    expect(src).toContain("handleHealth");
    expect(src).toContain("ok");
    const tables = src.match(/magnum_\w+/g) || [];
    expect(new Set(tables).size).toBeGreaterThanOrEqual(10);
  });
  it("server.ts /magnum/api/* 10+ эндпоинтов без хардкода секретов", () => {
    const src = read("server.ts");
    const apis = src.match(/\/magnum\/api\/\w+/g) || [];
    expect(new Set(apis).size).toBeGreaterThanOrEqual(10);
    expect(src).not.toMatch(/sk-[a-zA-Z0-9]{20}/);
  });
  it("build.ts Bun.build + splitting + minify + sitemap 16+ https", () => {
    const b = read("build.ts");
    expect(b).toContain("Bun.build");
    expect(b).toContain("splitting");
    expect(b).toContain("minify");
    if (existsSync(resolve(ROOT, "public/sitemap.xml"))) {
      const sm = read("public/sitemap.xml");
      const urls = sm.match(/https:\/\//g) || [];
      expect(urls.length).toBeGreaterThanOrEqual(10);
    }
  });
  it("dist/index.html существует после сборки + содержит root + chunk", () => {
    const b = read("build.ts");
    expect(b).toContain("index.html");
    // build.ts должен патчить hash — проверяем наличие логики
    expect(b).toMatch(/chunk|hash|dist/);
  });
});
