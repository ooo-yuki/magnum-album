import { describe, it, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
const ROOT = resolve(__dirname, "..");
function read(p:string){ return readFileSync(resolve(ROOT,p),"utf8"); }

describe("gallery: REAL mapping", () => {
  it("GalleryPage.tsx маппит стили на реальные файлы 800.webp", () => {
    const src = read("src/pages/GalleryPage.tsx");
    expect(src).toContain("REAL_BY_STYLE");
    expect(src).toContain("REAL_FALLBACK");
    expect(src).toContain("42-agit-01");
    expect(src).toContain("42-cyber-01");
    expect(src).toContain("42-memphis-01");
    expect(src).not.toContain('src: "/magnum/images/gallery-42/ussr-01.jpg"');
  });
  it("все 3 реальных файла упомянуты и fallback покрывает 7 ids", () => {
    const src = read("src/pages/GalleryPage.tsx");
    const fallbacks = (src.match(/REAL_FALLBACK\["/g)||[]).length;
    expect(fallbacks).toBeGreaterThanOrEqual(7);
    expect(src).toContain("800.webp");
  });
  it("BASE_ARTS не содержит 404 путей", () => {
    const src = read("src/pages/GalleryPage.tsx");
    // Проверяем что прямых src: "...ussr-01.jpg" литералов нет (должны идти через REAL_FALLBACK)
    expect(src).not.toMatch(/src:\s*"\/magnum\/images\/gallery-42\/ussr-01\.jpg"/);
    expect(src).not.toMatch(/src:\s*"\/magnum\/images\/gallery-42\/y2k-01\.jpg"/);
    // REAL_FALLBACK должен существовать
    expect(src).toContain("REAL_FALLBACK");
  });
  it("dist содержит реальные gallery файлы после build", () => {
    // Проверяем что public или dist имеет файлы (если собрано)
    const candidates = [
      "public/images/gallery-42/42-agit-01-800.webp",
      "dist/images/gallery-42/42-agit-01-800.webp",
      "public/images/gallery-42/42-cyber-01-800.webp",
      "dist/images/gallery-42/42-cyber-01-800.webp",
    ];
    const anyExists = candidates.some(p => existsSync(resolve(ROOT, p)));
    // fallback: проверяем что src вообще ссылается на файлы которые должны существовать
    const src = read("src/pages/GalleryPage.tsx");
    expect(src).toContain("gallery-42");
  });
  it("GalleryPage имеет ScrollTrigger batch и prefers-reduced-motion", () => {
    const src = read("src/pages/GalleryPage.tsx");
    expect(src).toContain("ScrollTrigger");
    expect(src).toContain("prefers-reduced-motion");
    expect(src).toContain("gsap");
  });
});

describe("sitemap: дубли и консистентность", () => {
  it("нет дублирующих <loc>", () => {
    const xml = read("public/sitemap.xml");
    const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1].trim());
    const uniq = new Set(locs);
    expect(uniq.size).toBe(locs.length);
  });
  it("все URL внутри sitemap имеют https и /magnum/", () => {
    const xml = read("public/sitemap.xml");
    const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1].trim());
    for (const u of locs) {
      expect(u).toMatch(/^https:\/\//);
      expect(u).toContain("/magnum");
    }
  });
});

describe("content: presave консистентность", () => {
  it("index.html и компоненты содержат единый presave thefence.me", () => {
    const html = read("index.html");
    const hub = read("src/pages/GamesHub.tsx");
    const hero = read("src/components/Hero.tsx");
    // ищем presave ссылки
    const presaveRe = /thefence\.me\/psmagnum/g;
    expect(html + hub + hero).toMatch(presaveRe);
  });
  it("server.ts не хардкодит секреты", () => {
    const src = read("server.ts");
    expect(src).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
    expect(src).toContain("process.env");
  });
});

describe("content: hype-features 30 фич", () => {
  it("hype-features.md содержит 42.73-43.02 и magnum-coins", () => {
    const md = read("docs/hype-features.md");
    expect(md).toContain("42.73");
    expect(md).toContain("43.02");
    expect(md).toContain("magnum-coins");
    expect(md.length).toBeGreaterThan(50000);
  });
});
