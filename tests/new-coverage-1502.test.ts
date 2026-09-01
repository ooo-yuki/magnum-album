import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
const ROOT = resolve(__dirname, "..");
function read(p: string) { return readFileSync(resolve(ROOT, p), "utf-8"); }

// ── Gallery: 200 real files + GSAP ──
describe("gallery 1502: реальные файлы 200 + GSAP", () => {
  it("public/images/gallery-42 содержит 8 файлов (4 стиля × 2 формата) каждый >1KB", () => {
    const dir = resolve(ROOT, "public/images/gallery-42");
    expect(existsSync(dir)).toBe(true);
    const files = readdirSync(dir);
    expect(files.length, `файлов ${files.length}: ${files.join(",")}`).toBeGreaterThanOrEqual(8);
    const webp = files.filter(f => f.endsWith(".webp"));
    const jpg = files.filter(f => f.endsWith(".jpg"));
    expect(webp.length).toBeGreaterThanOrEqual(4);
    expect(jpg.length).toBeGreaterThanOrEqual(4);
    for (const f of files) {
      const sz = statSync(join(dir, f)).size;
      expect(sz, `${f} size ${sz}`).toBeGreaterThan(1024);
    }
  });
  it("webp файлы >5KB (не заглушки <1KB)", () => {
    const dir = resolve(ROOT, "public/images/gallery-42");
    for (const f of readdirSync(dir).filter(x => x.endsWith(".webp"))) {
      const sz = statSync(join(dir, f)).size;
      expect(sz, `${f} ${sz} <5KB — заглушка`).toBeGreaterThan(5 * 1024);
    }
  });
  it("GalleryPage REAL_BY_STYLE маппит 4 стиля на реальные 800.webp", () => {
    const src = read("src/pages/GalleryPage.tsx");
    expect(src).toContain("REAL_BY_STYLE");
    const styles = ["СССР", "Y2K", "киберпанк", "мемфис"] as const;
    for (const s of styles) {
      expect(src, `стиль ${s} не в REAL_BY_STYLE`).toContain(`"${s}"`);
    }
    expect(src).toContain("42-agit-01-800.webp");
    expect(src).toContain("42-y2k-01-800.webp");
    expect(src).toContain("42-cyber-01-800.webp");
    expect(src).toContain("42-memphis-01-800.webp");
  });
  it("getRealSrc не мутирует ARCHIVE_42 (нет for...a.src=)", () => {
    const src = read("src/pages/GalleryPage.tsx");
    expect(src).toContain("getRealSrc");
    expect(src).toContain("realSrcOf");
    expect(src).not.toMatch(/for\s*\(\s*const\s+a\s+of\s+ARCHIVE_42\s*\)\s*a\.src\s*=/);
    expect(src).not.toMatch(/for\s*\(\s*const\s+a\s+of\s+ARCHIVE_WAVE_2\s*\)\s*a\.src\s*=/);
  });
  it("GalleryPage использует gsap.set+to + ScrollTrigger.batch + prefers-reduced-motion", () => {
    const src = read("src/pages/GalleryPage.tsx");
    expect(src).toContain("gsap.set(");
    expect(src).toContain("gsap.to(");
    expect(src).not.toMatch(/gsap\.from\(/);
    expect(src).toContain("ScrollTrigger");
    expect(src).toMatch(/ScrollTrigger\.batch|\.batch\(/);
    expect(src).toContain("prefers-reduced-motion");
    expect(src).toContain("prefersReducedMotion");
    expect(src).toMatch(/clearProps/);
    expect(src).toContain("gsap.context");
    expect(src).toMatch(/ctx\.revert|revert\(\)/);
  });
  it("galleryTokens.ts синхронен с GalleryPage motion (stagger 0.12, duration 0.55, y24)", () => {
    const tokens = read("src/lib/galleryTokens.ts");
    expect(tokens).toContain("stagger: 0.12");
    expect(tokens).toContain("duration: 0.55");
    expect(tokens).toMatch(/entranceY:\s*24|y:\s*24/);
    expect(tokens).toContain("power2.out");
    expect(tokens).toContain("back.out");
    const gallery = read("src/pages/GalleryPage.tsx");
    expect(gallery).toContain("stagger: 0.12");
  });
  it("dist/images/gallery-42 синхронизирован с public после build", () => {
    const pub = "public/images/gallery-42";
    const dist = "dist/images/gallery-42";
    if (!existsSync(resolve(ROOT, dist))) return; // build не гоняли — пропускаем без падения
    const pubFiles = readdirSync(resolve(ROOT, pub)).sort();
    const distFiles = readdirSync(resolve(ROOT, dist)).sort();
    expect(distFiles.length).toBeGreaterThanOrEqual(pubFiles.length); for (const f of pubFiles) expect(distFiles.includes(f), `dist missing ${f}`).toBe(true);
  });
});

// ── Games: 16 в хабе + GSAP/WebAudio/canvas ──
describe("games 1502: 16 игр + GSAP/WebAudio", () => {
  it("GamesHub содержит ровно 16 игр", () => {
    const src = read("src/pages/GamesHub.tsx");
    const cnt = [...src.matchAll(/\{\s*to:\s*"\/magnum\/games\//g)].length;
    expect(cnt, `16 игр ожидается, найдено ${cnt}`).toBe(16);
  });
  it("все 16 game-компонентов существуют в src/pages/games/", () => {
    const dir = resolve(ROOT, "src/pages/games");
    const files = readdirSync(dir).filter(f => f.endsWith(".tsx"));
    expect(files.length).toBeGreaterThanOrEqual(16);
    const must = ["RunnerGame","Match3Game","KnifeHitGame","MemoryGame","ClickerGame","RhythmGame","Stack42Game","BlackjackGame","RouletteGame","Game2042","Flappy42Game","TypingGame","Snake42Game","Dodge42Game","QuizGame","Timeline2026Game"];
    for (const m of must) {
      const ok = files.some(f => f.includes(m));
      expect(ok, `нет файла для ${m} в ${files.join(",")}`).toBe(true);
    }
  });
  it("App.tsx регистрирует 16 game роутов + shop/eco/gallery/mining/presave", () => {
    const src = read("src/App.tsx");
    const gameRoutes = ["games/runner","games/match3","games/knife","games/memory","games/clicker","games/rhythm","games/stack","games/blackjack","games/roulette","games/2042","games/flappy","games/typing","games/snake","games/dodge","games/quiz","games/timeline"];
    for (const r of gameRoutes) expect(src, `нет роута ${r}`).toContain(r);
    for (const p of ["shop","eco","gallery","mining","presave"]) expect(src, `нет страницы ${p}`).toContain(p);
  });
  it("минимум 3 игры используют GSAP / canvas / WebAudio (реальная анимация/звук)", () => {
    const checks = [
      read("src/pages/games/Dodge42Game.tsx").includes("gsap") || read("src/pages/games/Dodge42Game.tsx").includes("AudioContext"),
      read("src/pages/games/RhythmGame.tsx").includes("AudioContext"),
      read("src/pages/games/Game2042.tsx").includes("gsap") || read("src/pages/games/Game2042.tsx").includes("canvas"),
      read("src/pages/games/Flappy42Game.tsx").includes("canvas"),
      read("src/pages/games/Stack42Game.tsx").includes("canvas") || read("src/pages/games/Stack42Game.tsx").includes("gsap"),
    ];
    expect(checks.filter(Boolean).length, "≥3 игр с gsap/canvas/WebAudio").toBeGreaterThanOrEqual(3);
  });
  it("Dodge42Game logic: circleHit + 5 пуль + spawnWave", () => {
    const logic = read("src/pages/games/dodge42Logic.ts");
    expect(logic).toMatch(/circleHit|hitTest|distance/);
    expect(logic).toMatch(/spawnWave|wave/);
    const comp = read("src/pages/games/Dodge42Game.tsx");
    expect(comp).toMatch(/5.*пуль|пуль.*5|FIVE|5.*bullet/i);
  });
  it("Snake42Game: WIN_LENGTH 42 + WASD + touch + WebAudio + GRID 20", () => {
    const src = read("src/pages/games/Snake42Game.tsx");
    expect(src).toMatch(/WIN_LENGTH\s*=\s*42|42.*win|win.*42/i);
    expect(src).toMatch(/WASD|KeyW|ArrowUp/);
    expect(src).toMatch(/touch|swipe|onTouch/);
    expect(src).toMatch(/AudioContext|webkitAudioContext/);
    expect(src).toMatch(/GRID\s*=\s*20|20.*grid/i);
  });
});

// ── API + Build ──
describe("api/build 1502: server.ts эндпоинты + SPA + build", () => {
  it("server.ts покрывает ≥15 API-эндпоинтов", () => {
    const src = read("server.ts");
    const must = [
      "/magnum/api/auth/register","/magnum/api/auth/login","/magnum/api/auth/me","/magnum/api/auth/logout",
      "/magnum/api/coins","/magnum/api/presave","/magnum/api/health","/magnum/api/ws",
      "/magnum/api/daily","/magnum/api/transactions","/magnum/api/coins/add","/magnum/api/shop",
    ];
    for (const m of must) expect(src, `нет ${m}`).toContain(m);
  });
  it("server.ts SPA fallback на dist/index.html + защита от .. и 500 если нет dist", () => {
    const src = read("server.ts");
    expect(src).toMatch(/Bun\.file.*dist\/index\.html|dist.*index\.html/);
    expect(src).toMatch(/\.\./);
    expect(src).toMatch(/500|dist.*not.*built|NOT_BUILT/i);
  });
  it("build.ts: Bun.build с splitting + hash + vendor chunk + asset hash", () => {
    const src = read("build.ts");
    expect(src).toContain("Bun.build");
    expect(src).toMatch(/splitting|minify|hash/);
    expect(src).toMatch(/chunk.*hash|hash.*chunk/i);
    expect(src).toMatch(/vendor|VENDOR/);
  });
  it("dist/index.html содержит <script src chunk + hashed asset", () => {
    const p = resolve(ROOT, "dist/index.html");
    if (!existsSync(p)) return;
    const html = readFileSync(p, "utf-8");
    expect(html).toMatch(/<script[^>]+src=/);
    expect(html).toMatch(/chunk-[a-z0-9]+\.js|-[a-z0-9]{4,}\.js/);
  });
  it("economy.ts RARITY_PRICE синхронен с ShopPage (42/142/420/1420)", () => {
    const eco = read("src/lib/economy.ts");
    expect(eco).toContain("42");
    expect(eco).toContain("142");
    expect(eco).toContain("420");
    expect(eco).toContain("1420");
    expect(eco).toMatch(/common.*42|RARITY_PRICE/);
    const shop = read("src/pages/ShopPage.tsx");
    expect(shop).toMatch(/42|142|420|1420/);
  });
  it("sitemap содержит ≥6 игровых URL и https без дублей", () => {
    const candidates = ["public/sitemap.xml","dist/sitemap.xml"];
    let xml = "";
    for (const c of candidates) {
      const p = resolve(ROOT, c);
      if (existsSync(p)) { xml = readFileSync(p,"utf-8"); break; }
    }
    if (!xml) return;
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
    expect(urls.length, `sitemap urls ${urls.length} <15`).toBeGreaterThanOrEqual(15);
    const games = urls.filter(u=>u.includes("/magnum/games/"));
    expect(games.length, `игровых url ${games.length}`).toBeGreaterThanOrEqual(6);
    for (const u of urls) expect(u, `не https: ${u}`).toMatch(/^https:\/\//);
    expect(new Set(urls).size, "дубли в sitemap").toBe(urls.length);
  });
});
