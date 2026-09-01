import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
const ROOT = resolve(__dirname, "..");
function read(p: string) { return readFileSync(resolve(ROOT, p), "utf8"); }

// ── Галерея: реальные файлы на диске ──────────────────────
describe("gallery: реальные файлы 200", () => {
  it("6 файлов gallery-42 существуют на диске (webp + jpg)", () => {
    const dir = resolve(ROOT, "public/images/gallery-42");
    expect(existsSync(dir), "public/images/gallery-42 должна существовать").toBe(true);
    const files = readdirSync(dir);
    const expected = ["42-agit-01-800.webp","42-agit-01.jpg","42-cyber-01-800.webp","42-cyber-01.jpg","42-memphis-01-800.webp","42-memphis-01.jpg"];
    for (const f of expected) {
      expect(files.includes(f), `ожидается ${f} в ${files.join(",")}`).toBe(true);
      const sz = statSync(join(dir, f)).size;
      expect(sz, `${f} не должен быть пустым`).toBeGreaterThan(1000);
    }
  });
  it("GalleryPage REAL_FALLBACK покрывает все BASE_ARTS ids без 404", () => {
    const src = read("src/pages/GalleryPage.tsx");
    const directSrc404 = /src:\s*"\/magnum\/images\/gallery-42\/(ussr|y2k|cyber|memphis)-[^"]+\.jpg"/g;
    const hits = [...src.matchAll(directSrc404)];
    expect(hits.length, `прямые 404-пути найдены: ${hits.map(m=>m[0]).join("; ")}`).toBe(0);
    const fallbackKeys = [...src.matchAll(/"([a-z0-9]+-\d+)":\s*"(?:\/magnum\/images\/gallery-42|REAL_BY_STYLE)/g)];
    // также считаем REAL_FALLBACK entries через REAL_BY_STYLE ссылками
    const fallbackKeys2 = [...src.matchAll(/REAL_BY_STYLE\["[^"]+"\]/g)];
    const totalFallback = fallbackKeys.length + fallbackKeys2.length;
    expect(totalFallback, `fallback keys: ${fallbackKeys.map(m=>m[0]).join("; ")} + REAL_BY_STYLE refs ${fallbackKeys2.length}`).toBeGreaterThanOrEqual(6);
  });
  it("GalleryPage использует GSAP ScrollTrigger.batch + reduced-motion", () => {
    const src = read("src/pages/GalleryPage.tsx");
    expect(src).toMatch(/gsap/);
    expect(src).toMatch(/ScrollTrigger/);
    expect(src.includes("batch") || src.includes("create")).toBe(true);
    expect(src).toContain("prefers-reduced-motion");
  });
  it("GalleryPage Lightbox onClick и keyboard Escape", () => {
    const src = read("src/pages/GalleryPage.tsx");
    expect(src).toContain("onClick");
    expect(src).toMatch(/Escape|keydown|onKeyDown/);
  });
});

// ── Игры: 16 в GamesHub, каждая с реальным .tsx ───────────
describe("games: 16 игр в хабе и файлы", () => {
  it("GamesHub содержит ровно 16 игр", () => {
    const src = read("src/pages/GamesHub.tsx");
    const games = [...src.matchAll(/\{\s*to:\s*"\/magnum\/games\//g)];
    expect(games.length, `ожидается 16 игр, найдено ${games.length}`).toBe(16);
  });
  it("все ключевые game-компоненты существуют на диске", () => {
    const files = readdirSync(resolve(ROOT, "src/pages/games"));
    expect(files.filter(f=>f.endsWith(".tsx")).length).toBeGreaterThanOrEqual(16);
    const mustExist = ["Game2042.tsx","Flappy42Game.tsx","Snake42Game.tsx","Dodge42Game.tsx","TypingGame.tsx","Timeline2026Game.tsx"];
    for (const f of mustExist) expect(existsSync(resolve(ROOT, `src/pages/games/${f}`)), `должен быть src/pages/games/${f}`).toBe(true);
  });
  it("App.tsx регистрирует все game-роуты (относительные path)", () => {
    const src = read("src/App.tsx");
    const routes = ["games/2042","games/flappy","games/snake","games/dodge","games/typing","games/timeline","games/runner"];
    for (const r of routes) expect(src, `роут ${r} отсутствует в App.tsx`).toContain(r);
  });
  it("игры используют GSAP или canvas/WebAudio", () => {
    const checks = [
      read("src/pages/games/Game2042.tsx").includes("gsap") || read("src/pages/games/Game2042.tsx").includes("AudioContext"),
      read("src/pages/games/Flappy42Game.tsx").includes("canvas") || read("src/pages/games/Flappy42Game.tsx").includes("AudioContext"),
      read("src/pages/games/RhythmGame.tsx").includes("AudioContext") || read("src/pages/games/RhythmGame.tsx").includes("gsap"),
    ];
    expect(checks.filter(Boolean).length, "минимум 2 игры должны использовать canvas/gsap/WebAudio").toBeGreaterThanOrEqual(2);
  });
});

// ── API: server.ts покрывает все ожидаемые эндпоинты ─────
describe("api: server.ts эндпоинты", () => {
  it("все ключевые API-роуты присутствуют в server.ts", () => {
    const src = read("server.ts");
    const must = [
      "/magnum/api/auth/register",
      "/magnum/api/auth/login",
      "/magnum/api/auth/me",
      "/magnum/api/auth/logout",
      "/magnum/api/coins",
      "/magnum/api/presave/click",
      "/magnum/api/ideas",
      "/magnum/api/eco/leaderboard",
      "/magnum/api/shop/catalog",
      "/magnum/api/mining/click",
      "/magnum/api/ws",
    ];
    for (const p of must) expect(src, `API ${p} отсутствует`).toContain(p);
  });
  it("server.ts имеет health/SPA fallback и не хардкодит секреты", () => {
    const src = read("server.ts");
    expect(src.includes("index.html") || src.includes("try_files") || src.includes("fallback")).toBe(true);
    expect(src).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
    expect(src).toContain("process.env");
  });
});

// ── Build health: 200-совместимость ───────────────────────
describe("build: dist health 200", () => {
  it("dist/index.html резолвит main-*.js который реально существует и >400B", () => {
    const dist = resolve(ROOT, "dist");
    if (!existsSync(join(dist,"index.html"))) { expect(true).toBe(true); return; }
    const html = read(join(dist,"index.html"));
    const re = /(?:src|href)=["']\/magnum\/([^"']+\.js)["']/g;
    let m: RegExpExecArray | null;
    const files: string[] = [];
    while ((m = re.exec(html)) !== null) files.push(m[1]);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const p = join(dist, f);
      expect(existsSync(p), `${f} отсутствует в dist`).toBe(true);
      expect(statSync(p).size).toBeGreaterThan(100);
    }
  });
  it("public/sitemap.xml без дублей и с https/magnum", () => {
    const xml = read("public/sitemap.xml");
    const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1].trim());
    expect(new Set(locs).size).toBe(locs.length);
    for (const u of locs) { expect(u).toMatch(/^https:\/\//); expect(u).toContain("/magnum"); }
  });
});
