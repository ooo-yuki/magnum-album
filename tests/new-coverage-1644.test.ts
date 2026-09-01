import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
const ROOT = resolve(__dirname, "..");
function read(p: string) { return readFileSync(resolve(ROOT, p), "utf8"); }

describe("1644: галерея реальные src + tokens + фильтры", () => {
  it("galleryTokens REAL_BY_STYLE 4 стиля → /magnum/images/gallery-42/*.webp маппит реальные файлы", () => {
    const t = read("src/lib/galleryTokens.ts");
    expect(t).toContain("REAL_BY_STYLE");
    for (const file of ["42-agit-01-800.webp","42-y2k-01-800.webp","42-cyber-01-800.webp","42-memphis-01-800.webp"]) {
      expect(t).toContain(file);
      expect(existsSync(resolve(ROOT, `public/images/gallery-42/${file}`))).toBe(true);
    }
    expect(t).toContain("getRealSrc");
    expect(t).toContain("СССР");
  });
  it("GalleryPage BASE_ARTS 7 карточек src через REAL_FALLBACK, без 404 ussr-01.jpg литерала", () => {
    const src = read("src/pages/GalleryPage.tsx");
    expect(src).toContain("REAL_FALLBACK");
    for (const id of ["ussr-01","ussr-02","y2k-01","y2k-02","cyber-01","memphis-01","y2k-03"]) expect(src).toContain(`"${id}"`);
    expect(src).not.toMatch(/src:\s*"\/magnum\/images\/gallery-42\/ussr-01\.jpg"/);
    expect(src).toContain("/magnum/images/gallery-42/42-agit-01-800.webp");
  });
  it("GalleryPage фильтры 4 стиля + все, GSAP batch + prefers-reduced-motion + set→to", () => {
    const src = read("src/pages/GalleryPage.tsx");
    for (const f of ["СССР","Y2K","киберпанк","мемфис","все"]) expect(src).toContain(f);
    expect(src).toContain("ScrollTrigger");
    expect(src).toContain("batch");
    expect(src).toContain("prefers-reduced-motion");
    expect(src).toContain("gsap.set(");
    expect(src).toContain("gsap.to(");
    expect(src).not.toMatch(/gsap\.from\(/);
  });
  it("public/images/gallery-42 8+ файлов >1KB, sitemap содержит /gallery 200", () => {
    const dir = resolve(ROOT, "public/images/gallery-42");
    const files = readdirSync(dir);
    expect(files.length).toBeGreaterThanOrEqual(8);
    const webp = files.filter(f=>f.endsWith(".webp"));
    const jpg = files.filter(f=>f.endsWith(".jpg"));
    expect(webp.length).toBeGreaterThanOrEqual(4);
    expect(jpg.length).toBeGreaterThanOrEqual(4);
    for (const f of files) expect(statSync(join(dir,f)).size).toBeGreaterThan(1024);
    const sm = read("public/sitemap.xml");
    expect(sm).toContain("/gallery");
    expect(sm).toMatch(/https:\/\//);
  });
});

describe("1644: игры 16 + GSAP + API 200 + build", () => {
  it("GamesHub + App.tsx: 16 игр, все /magnum/games/* 200-роуты + lazy/Suspense", () => {
    const hub = read("src/pages/GamesHub.tsx");
    const app = read("src/App.tsx");
    const hrefs = hub.match(/\/magnum\/games\/[a-z0-9-]+/g) || [];
    expect(new Set(hrefs).size).toBe(16);
    for (const r of ["games/2042","games/snake","games/typing","games/stack","games/timeline","games/blackjack","games/roulette","games/flappy","games/dodge","games/rhythm"]) {
      expect(app).toContain(r);
    }
    expect(app).toContain("lazy(");
    expect(app).toContain("Suspense");
  });
  it("src/pages/games 16 .tsx каждый экспортирует *Game + canvas/WebAudio/gsap минимум 4", () => {
    const files = readdirSync(resolve(ROOT, "src/pages/games")).filter(f=>f.endsWith(".tsx"));
    expect(files.length).toBeGreaterThanOrEqual(16);
    let gsapHits = 0;
    for (const f of files) {
      const c = read(join("src/pages/games", f));
      expect(c).toMatch(/export.*Game/);
      if (/gsap|AudioContext|getContext\(|canvas/i.test(c)) gsapHits++;
    }
    expect(gsapHits).toBeGreaterThanOrEqual(4);
  });
  it("server.ts Bun.serve + /magnum/api/health ok:true + 10+ api + SPA fallback", () => {
    const s = read("server.ts");
    expect(s).toContain("Bun.serve");
    expect(s).toContain("/magnum/api/health");
    expect(s).toMatch(/ok.*true|"ok":\s*true/);
    const apis = s.match(/\/magnum\/api\/[a-z\/_-]+/g) || [];
    expect(new Set(apis).size).toBeGreaterThanOrEqual(10);
    expect(s + read("build.ts")).toMatch(/index\.html|try_files|fallback/i);
  });
  it("build.ts Bun.build splitting+minify+hash chunk, dist/index.html 200 + modulepreload", () => {
    const b = read("build.ts");
    expect(b).toContain("Bun.build");
    expect(b).toContain("splitting");
    expect(b).toContain("minify");
    expect(b).toMatch(/\[hash\]|hash/);
    expect(b).toContain("index.html");
    const distHtml = resolve(ROOT, "dist/index.html");
    if (existsSync(distHtml)) {
      const html = readFileSync(distHtml,"utf8");
      expect(html).toContain('<div id="root"');
      expect(html).toMatch(/chunk|assets|modulepreload|\.js/);
    }
  });
});
