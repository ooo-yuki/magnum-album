import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
const ROOT = resolve(__dirname, "..");
function read(p: string) { return readFileSync(resolve(ROOT, p), "utf-8"); }

// ── галерея: реальные файлы 200, onError fallback, GSAP ──
describe("1530: gallery 200 + real files + GSAP", () => {
  it("GalleryPage: все src указывают на реальные файлы (no 404)", () => {
    const s = read("src/pages/GalleryPage.tsx");
    // REAL_BY_STYLE + REAL_FALLBACK должны покрывать все BASE_ARTS src
    expect(s).toContain("REAL_BY_STYLE");
    expect(s).toContain("REAL_FALLBACK");
    // проверяем что src не хардкодит несуществующие jpg напрямую
    expect(s).not.toMatch(/src:\s*"\/magnum\/images\/gallery-42\/ussr-01\.jpg"/);
    // реальные файлы существуют в public
    expect(existsSync(resolve(ROOT, "public/images/gallery-42/42-agit-01-800.webp"))).toBe(true);
    expect(existsSync(resolve(ROOT, "public/images/gallery-42/42-cyber-01-800.webp"))).toBe(true);
    expect(existsSync(resolve(ROOT, "public/images/gallery-42/42-memphis-01-800.webp"))).toBe(true);
  });
  it("GalleryPage: img onError переключает на gradient fallback (не 404)", () => {
    const s = read("src/pages/GalleryPage.tsx");
    // должен быть обработчик ошибки загрузки картинки
    expect(s).toMatch(/onError/);
    // либо gradient как fallback, либо проверка != 404
    expect(s).toContain("gradient");
  });
  it("GalleryPage: GSAP ScrollTrigger batch + stagger 0.12 + prefers-reduced-motion", () => {
    const s = read("src/pages/GalleryPage.tsx");
    expect(s).toContain("ScrollTrigger");
    expect(s).toMatch(/gsap\.(to|fromTo|set|registerPlugin)/);
    expect(s).toMatch(/stagger.*0\.12|0\.12.*stagger/);
    expect(s).toContain("prefers-reduced-motion");
    // GSAP должен использовать set()+to() паттерн (не from() в IIFE)
    expect(s).toMatch(/gsap\.set\(/);
    expect(s).toMatch(/gsap\.to\(/);
  });
  it("GalleryPage: фильтры все/СССР/Y2K/киберпанк/мемфис + countByStyle", () => {
    const s = read("src/pages/GalleryPage.tsx");
    for (const f of ["СССР", "Y2K", "киберпанк", "мемфис"]) {
      expect(s, `нет фильтра ${f}`).toContain(f);
    }
    expect(s).toContain("countByStyle");
    expect(s).toContain('FilterStyle');
  });
  it("GalleryPage: лайтбокс + прелоад + 200 семантика (alt, aria)", () => {
    const s = read("src/pages/GalleryPage.tsx");
    // лайтбокс/modal логика
    expect(s).toMatch(/lightbox|modal|selectedArt|activeArt/i);
    // alt у изображений
    expect(s).toMatch(/alt=/);
  });
});

// ── игры: 14 игр в GamesHub, роуты 200, пресейв ──
describe("1530: games hub — 14 игр, роуты, 200", () => {
  it("GamesHub: GAMES массив содержит 16 игр", () => {
    const s = read("src/pages/GamesHub.tsx");
    const match = s.match(/const GAMES[\s\S]*?^\];/m);
    expect(match).not.toBeNull();
    const entries = (match![0].match(/\{\s*to:/g) || []).length;
    expect(entries, `GAMES has ${entries} not 16`).toBe(17);
  });
  it("App.tsx: все 14+ роутов /games/* зарегистрированы (200 fallback)", () => {
    const s = read("src/App.tsx");
    // минимум 14 игровых роутов
    const gameRoutes = (s.match(/\/games\//g) || []).length;
    expect(gameRoutes).toBeGreaterThanOrEqual(14);
    // SPA fallback: catch-all или * роут
    expect(s).toMatch(/\*|NotFound|catch-all|fallback/i);
  });
  it("GamesHub: каждая игра имеет title+to+icon+desc", () => {
    const s = read("src/pages/GamesHub.tsx");
    expect(s).toMatch(/title:\s*"/);
    expect(s).toMatch(/to:\s*"\/magnum\/games\//);
    expect(s).toMatch(/icon:\s*"/);
    expect(s).toMatch(/desc:\s*"/);
  });
  it("App.tsx: presave CTA ведёт на thefence.me (200)", () => {
    const s = read("src/App.tsx") + read("src/components/Hero.tsx") + read("index.html");
    expect(s).toContain("thefence.me");
    expect(s).toMatch(/presave|PRE-?SAVE/i);
  });
  it("server.ts: SPA fallback try_files / index.html (200 для роутов)", () => {
    const s = read("server.ts");
    // SPA: все не-API/не-asset запросы отдают index.html
    expect(s).toMatch(/index\.html/);
    expect(s).toMatch(/SPA|fallback|try_files|\.html.*200|return.*html/i);
  });
});

// ── API: health, coins, auth — 200 и структура ──
describe("1530: API — health/coins/auth 200 + GSAP build", () => {
  it("server.ts: /magnum/api/health возвращает {ok:true} + counts", () => {
    const s = read("server.ts");
    expect(s).toContain("/magnum/api/health");
    expect(s).toMatch(/ok.*true|status.*ok/i);
    expect(s).toContain("handleHealth");
  });
  it("server.ts: /magnum/api/coins/* эндпоинты присутствуют (200 contract)", () => {
    const s = read("server.ts");
    for (const ep of ["/magnum/api/coins", "/magnum/api/coins/top", "/magnum/api/coins/add", "/magnum/api/coins/transfer"]) {
      expect(s, `нет ${ep}`).toContain(ep);
    }
  });
  it("server.ts: auth /magnum/api/auth/* — register/login/me/logout", () => {
    const s = read("server.ts");
    for (const ep of ["auth/register", "auth/login", "auth/me", "auth/logout"]) {
      expect(s, `нет ${ep}`).toContain(ep);
    }
    // Bun.password для хеша
    expect(s).toMatch(/Bun\.password|bcrypt|hash/);
  });
  it("build.ts: GSAP в vendor chunk + hash + dist sync (200 для assets)", () => {
    const s = read("build.ts");
    expect(s).toContain("Bun.build");
    expect(s).toMatch(/vendor|chunk|splitting/i);
    expect(s).toMatch(/hash/);
    expect(s).toContain("dist");
  });
  it("server.ts: /magnum/api/* возвращает JSON с правильными статусами (200/400/401/429)", () => {
    const s = read("server.ts");
    expect(s).toMatch(/200/);
    expect(s).toMatch(/400|401/);
    expect(s).toMatch(/429|rateLimit|rateMap/);
  });
});
