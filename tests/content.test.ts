import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Content tests — реально читают файлы с диска и проверяют содержимое.
 * Никаких моков: каждый тест парсит реальный файл проекта.
 */

const ROOT = resolve(__dirname, "..");

function read(p: string): string {
  return readFileSync(resolve(ROOT, p), "utf-8");
}

// ------------------------------------------------------------
// 1. sitemap.xml — валидный XML, 15+ url
// ------------------------------------------------------------
describe("content: sitemap.xml", () => {
  const xml = read("public/sitemap.xml");

  it("существует и является валидным XML", () => {
    expect(xml).toBeTruthy();
    expect(xml).toMatch(/^\s*<\?xml/i);
    expect(xml).toContain("<urlset");
    // Валидность: парсим через DOMParser если доступен, иначе фолбэк на строки (для bun:test без jsdom)
    if (typeof DOMParser !== "undefined") {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, "application/xml");
      expect(doc.querySelector("parsererror")).toBeNull();
      expect(doc.querySelector("urlset")).not.toBeNull();
    } else {
      expect(xml).toContain("<urlset");
      expect(xml).not.toContain("parsererror");
      expect(xml).toContain("</urlset>");
    }
  });

  it("содержит 15+ url", () => {
    const urls = (xml.match(/<url>/g) || []).length;
    expect(urls).toBeGreaterThanOrEqual(15);
    // каждый url должен иметь <loc>
    const locs = (xml.match(/<loc>/g) || []).length;
    expect(locs).toBe(urls);
  });
});

// ------------------------------------------------------------
// 2. robots.txt содержит Sitemap
// ------------------------------------------------------------
describe("content: robots.txt", () => {
  const txt = read("public/robots.txt");

  it("содержит директиву Sitemap с абсолютным URL", () => {
    expect(txt).toMatch(/^Sitemap:\s*\S+/im);
    expect(txt).toMatch(/^Sitemap:\s*https?:\/\//im);
  });
});

// ------------------------------------------------------------
// 3. index.html — OG-теги и json-ld MusicAlbum
// ------------------------------------------------------------
describe("content: index.html", () => {
  const html = read("index.html");

  it("содержит OG-теги", () => {
    for (const prop of ["og:title", "og:description", "og:image", "og:url", "og:type"]) {
      expect(html).toContain(`property="${prop}"`);
    }
  });

  it("содержит json-ld разметку MusicAlbum", () => {
    const ldMatch = html.match(
      /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/,
    );
    expect(ldMatch).not.toBeNull();
    const parsed = JSON.parse(ldMatch![1]);
    const blocks = Array.isArray(parsed) ? parsed : [parsed];
    const albums = blocks.filter(
      (b: Record<string, unknown>) => b["@type"] === "MusicAlbum",
    );
    expect(albums.length).toBeGreaterThanOrEqual(1);
    expect(albums[0].name).toBeTruthy();
  });
});

// ------------------------------------------------------------
// 4. GamesHub.tsx — карточки минимум 8 игр
// ------------------------------------------------------------
describe("content: GamesHub.tsx", () => {
  const src = read("src/pages/GamesHub.tsx");

  it("содержит карточки минимум 8 игр (уникальные роуты)", () => {
    const paths = src.match(/\/magnum\/games\/[a-z0-9-]+/g) || [];
    const unique = [...new Set(paths)];
    expect(unique.length).toBeGreaterThanOrEqual(8);
  });

  it("карточки имеют title и desc (структура hub-массива)", () => {
    // 12 карточек в массиве — каждая с title и desc
    const titles = (src.match(/title:\s*"/g) || []).length;
    const descs = (src.match(/desc:\s*"/g) || []).length;
    expect(titles).toBeGreaterThanOrEqual(8);
    expect(descs).toBeGreaterThanOrEqual(8);
  });
});

// ------------------------------------------------------------
// 5. AiBot.tsx — compressImage и прокси-путь /magnum/api/ai
// ------------------------------------------------------------
describe("content: AiBot.tsx", () => {
  const src = read("src/components/AiBot.tsx");

  it("содержит клиентское сжатие изображений (compressImage)", () => {
    expect(src).toContain("compressImage");
    // декларация + реальный вызов await compressImage(...) при отправке
    expect(src).toMatch(/const\s+compressImage\s*=/);
    expect(src).toMatch(/await\s+compressImage\s*\(/);
  });

  it("ходить не напрямую в API, а через прокси /magnum/api/ai", () => {
    expect(src).toContain("/magnum/api/ai");
    // запрос именно POST на прокси-роут
    expect(src).toMatch(/fetch\([^)]*\/magnum\/api\/ai/);
  });
});

// ------------------------------------------------------------
// 6. BlackjackGame.tsx — цель 4200 и открытка postcard-4200.png
// ------------------------------------------------------------
describe("content: BlackjackGame.tsx", () => {
  const src = read("src/pages/games/BlackjackGame.tsx");

  it("содержит цель 4200 монет", () => {
    expect(src).toContain("4200");
  });

  it("показывает открытку postcard-4200.png при достижении цели", () => {
    expect(src).toContain("postcard-4200.png");
  });
});

// ------------------------------------------------------------
// 7. RouletteGame.tsx — содержит 4200
// ------------------------------------------------------------
describe("content: RouletteGame.tsx", () => {
  const src = read("src/pages/games/RouletteGame.tsx");

  it("содержит цель 4200 монет", () => {
    expect(src).toContain("4200");
  });
});

// ------------------------------------------------------------
// 8. server.ts — бэкенд-прокси xiaomimimo.com + XIAOMI_API_KEY
// ------------------------------------------------------------
describe("content: server.ts", () => {
  const src = read("server.ts");

  it("проксирует на xiaomimimo.com", () => {
    expect(src).toContain("xiaomimimo.com");
  });

  it("использует XIAOMI_API_KEY из окружения", () => {
    expect(src).toContain("XIAOMI_API_KEY");
  });
});

// ------------------------------------------------------------
// 9. Timeline.tsx — 8 вех
// ------------------------------------------------------------
describe("content: Timeline.tsx", () => {
  const src = read("src/components/Timeline.tsx");

  it("содержит 8 вех в массиве таймлайна", () => {
    // массив вех (Milestones/STEPS): считаем объекты с полем date/date/label
    const arrMatch = src.match(
      /const\s+\w+\s*:\s*\w*[Mm]ilestone\w*\[\]\s*=\s*\[([\s\S]*?)\n\];/,
    );
    expect(arrMatch).not.toBeNull();
    const items = (arrMatch![1].match(/^\s*\{/gm) || []).length;
    // требование: MILESTONES.length >= 8 либо 8 элементов в массиве
    expect(items).toBeGreaterThanOrEqual(8);
  });
});

// ------------------------------------------------------------
// 10. News2026.tsx — существует и содержит ТУСА МЕДУЗА
// ------------------------------------------------------------
describe("content: News2026.tsx", () => {
  const src = read("src/components/News2026.tsx");

  it("существует и содержит упоминание ТУСА МЕДУЗА", () => {
    expect(src.length).toBeGreaterThan(0);
    expect(src).toContain("ТУСА МЕДУЗА");
  });
});

// ------------------------------------------------------------
// 11. GalleryPage REAL_FALLBACK — не 404
// ------------------------------------------------------------
describe("content: GalleryPage REAL mapping", () => {
  const src = read("src/pages/GalleryPage.tsx");
  it("маппит стили на реальные 800.webp файлы", () => {
    expect(src).toContain("REAL_BY_STYLE");
    expect(src).toContain("42-agit-01-800.webp");
    expect(src).toContain("42-cyber-01-800.webp");
    expect(src).toContain("42-memphis-01-800.webp");
  });
  it("не содержит прямых 404 путей ussr-01.jpg как src литерала", () => {
    expect(src).not.toMatch(/src:\s*"\/magnum\/images\/gallery-42\/ussr-01\.jpg"/);
  });
});

// ------------------------------------------------------------
// 12. sitemap — без дублей
// ------------------------------------------------------------
describe("content: sitemap no duplicates", () => {
  const xml = read("public/sitemap.xml");
  it("не содержит дублирующих loc", () => {
    const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1].trim());
    expect(new Set(locs).size).toBe(locs.length);
  });
});

// ------------------------------------------------------------
// 13. server.ts — секреты через env
// ------------------------------------------------------------
describe("content: server env safety", () => {
  const src = read("server.ts");
  it("не хардкодит секреты, использует process.env", () => {
    expect(src).toContain("process.env");
    expect(src).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
  });
});

// ------------------------------------------------------------
// 14. hype-features — 30 фич 42.73-43.02
// ------------------------------------------------------------
describe("content: hype 30 fich", () => {
  const md = read("docs/hype-features.md");
  it("содержит 42.73-43.02 и magnum-coins", () => {
    expect(md).toContain("42.73");
    expect(md).toContain("43.02");
    expect(md).toContain("magnum-coins");
  });
});

// ------------------------------------------------------------
// 15. build health — dist не пустой
// ------------------------------------------------------------
describe("content: dist health", () => {
  it("dist/index.html существует после build", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    expect(fs.existsSync(path.resolve(ROOT,"dist/index.html"))).toBe(true);
  });
});
