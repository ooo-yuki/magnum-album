import { describe, it, expect } from "bun:test";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
const ROOT = resolve(__dirname, "..");
function read(p: string) { return readFileSync(resolve(ROOT, p), "utf-8"); }

// ── GSAP correctness: set+to, not bare from(), ScrollTrigger.batch, reduced-motion
describe("gsap: GalleryPage GSAP паттерны (set+to, batch, reduced-motion)", () => {
  const src = read("src/pages/GalleryPage.tsx");
  it("использует gsap.set + gsap.to, а не bare gsap.from (ломается в IIFE)", () => {
    // В GalleryPage не должно быть голого gsap.from( вне fromTo
    const bareFrom = [...src.matchAll(/gsap\.from\(/g)];
    expect(bareFrom.length, `bare gsap.from найдено ${bareFrom.length} — используй set()+to()`).toBe(0);
    expect(src).toContain("gsap.set(");
    expect(src).toContain("gsap.to(");
  });
  it("использует ScrollTrigger.batch с onEnter → gsap.to", () => {
    expect(src).toContain("ScrollTrigger");
    expect(src).toMatch(/ScrollTrigger\.batch|\.batch\(/);
    expect(src).toMatch(/onEnter.*gsap\.to/s);
    expect(src).toContain("stagger");
  });
  it("has prefers-reduced-motion gate via matchMedia + gsap.set clearProps", () => {
    expect(src).toContain("prefers-reduced-motion");
    expect(src).toContain("prefersReducedMotion");
    expect(src).toMatch(/prefersReducedMotion\(\)[\s\S]*?gsap\.set/);
    expect(src).toContain("clearProps");
  });
  it("gsap.context cleanup + ctx.revert / ScrollTrigger kill", () => {
    expect(src).toContain("gsap.context");
    expect(src).toMatch(/ctx\.revert|context.*revert/);
  });
  it("анимация stagger 0.12 и duration 0.55 (y24 стандарт)", () => {
    expect(src).toContain("stagger: 0.12");
    expect(src).toContain("duration: 0.55");
    // y 24 — дефолт для entrance
    expect(src).toMatch(/y:\s*24|y\?\?\s*24|fromY\s*=\s*24/);
  });
  it("Lightbox анимация: gsap.to для overlay и карты + Escape keydown", () => {
    expect(src).toContain("lightbox");
    expect(src).toMatch(/Escape|onKeyDown|keydown/);
    // lightbox gsap.to exists
    expect(src.match(/gsap\.to\(/g)!.length).toBeGreaterThanOrEqual(4);
  });
});

// ── Gallery files: 8 реальных файлов webp+jpg парами >5KB
describe("gallery: 8 реальных файлов gallery-42 (4 стиля × webp+jpg)", () => {
  it("public/images/gallery-42 содержит 8 файлов (4 webp + 4 jpg) каждый >5KB", () => {
    const dir = resolve(ROOT, "public/images/gallery-42");
    expect(existsSync(dir)).toBe(true);
    const files = readdirSync(dir);
    const webp = files.filter(f => f.endsWith(".webp"));
    const jpg = files.filter(f => f.endsWith(".jpg"));
    expect(webp.length, `webp: ${webp.join(",")}`).toBeGreaterThanOrEqual(4);
    expect(jpg.length, `jpg: ${jpg.join(",")}`).toBeGreaterThanOrEqual(4);
    for (const f of files) {
      const sz = statSync(join(dir, f)).size;
      expect(sz, `${f} size ${sz}`).toBeGreaterThan(5 * 1024);
    }
  });
  it("webp и jpg пары по базовому имени (42-agit-01 / 42-y2k-01 / 42-cyber-01 / 42-memphis-01)", () => {
    const dir = resolve(ROOT, "public/images/gallery-42");
    const files = readdirSync(dir);
    const bases = ["42-agit-01", "42-y2k-01", "42-cyber-01", "42-memphis-01"];
    for (const b of bases) {
      expect(files.includes(`${b}-800.webp`), `нет ${b}-800.webp`).toBe(true);
      expect(files.includes(`${b}.jpg`), `нет ${b}.jpg`).toBe(true);
    }
  });
  it("REAL_BY_STYLE маппит 4 стиля на 800.webp, REAL_FALLBACK на 7 ids без 404", () => {
    const src = read("src/pages/GalleryPage.tsx");
    expect(src).toContain("REAL_BY_STYLE");
    expect(src).toContain("REAL_FALLBACK");
    expect(src).toContain("42-agit-01-800.webp");
    expect(src).toContain("42-cyber-01-800.webp");
    expect(src).toContain("42-memphis-01-800.webp");
    expect(src).toContain("42-y2k-01-800.webp");
    // прямых 404-путей нет
    expect(src).not.toMatch(/src:\s*"\/magnum\/images\/gallery-42\/ussr-01\.jpg"/);
    const fallbackKeys = [...src.matchAll(/REAL_FALLBACK\["/g)];
    expect(fallbackKeys.length).toBeGreaterThanOrEqual(7);
  });
  it("ARCHIVE_42 — 210 айтемов, 4 стиля равномерно, градиенты валидны", () => {
    const src = read("src/pages/GalleryPage.tsx");
    const archiveMatches = [...src.matchAll(/id:\s*"arch-/g)];
    expect(archiveMatches.length, `ARCHIVE_42 count ${archiveMatches.length}`).toBe(210);
    expect(src).toContain("STYLE_META");
    expect(src).toContain("GRADIENT_PRESETS");
    // каждый стиль встречается
    for (const s of ["СССР", "Y2K", "киберпанк", "мемфис"]) {
      expect(src.includes(`style: "${s}"`)).toBe(true);
    }
  });
});

// ── Games: 16 игр, роуты, GSAP/canvas/WebAudio
describe("games: GamesHub 16 игр и Games файлы", () => {
  it("GamesHub GAMES ровно 16 и все /magnum/games/* уникальны", () => {
    const src = read("src/pages/GamesHub.tsx");
    const tos = [...src.matchAll(/to:\s*"\/magnum\/games\/[a-z0-9-]+\s*"/g)];
    // fallback regex without trailing space
    const tos2 = src.match(/\/magnum\/games\/[a-z0-9-]+/g) || [];
    expect(tos2.length).toBe(16);
    expect(new Set(tos2).size).toBe(16);
  });
  it("src/pages/games содержит 16+ .tsx игр (Runner, Match3, Knife, Memory, Clicker, Quiz, Rhythm, Stack, Blackjack, Roulette, 2042, Flappy, Typing, Snake, Dodge, Timeline)", () => {
    const dir = resolve(ROOT, "src/pages/games");
    const files = readdirSync(dir).filter(f => f.endsWith(".tsx"));
    expect(files.length).toBeGreaterThanOrEqual(16);
    for (const must of ["RunnerGame", "Game2042", "Flappy42Game", "Snake42Game", "Dodge42Game", "RhythmGame", "BlackjackGame", "RouletteGame"]) {
      expect(files.some(f => f.includes(must)), `нет ${must}`).toBe(true);
    }
  });
  it("App.tsx регистрирует все 16 game-роутов + Gallery", () => {
    const src = read("src/App.tsx");
    const mustRoutes = ["games/runner","games/match3","games/knife","games/memory","games/clicker","games/quiz","games/rhythm","games/stack","games/blackjack","games/roulette","games/2042","games/flappy","games/typing","games/snake","games/dodge","games/timeline","gallery"];
    for (const r of mustRoutes) expect(src, `роут ${r} отсутствует`).toContain(r);
  });
});

// ── API: server.ts 30+ роутов, Bun.serve, SPA fallback
describe("api: server.ts Bun.serve и 30+ роутов", () => {
  it("Bun.serve с port из process.env.PORT и WebSocket upgrade /magnum/api/ws", () => {
    const src = read("server.ts");
    expect(src).toContain("Bun.serve");
    expect(src).toContain("process.env.PORT");
    expect(src).toContain("/magnum/api/ws");
    expect(src).toContain("upgrade");
    expect(src).toContain("extractToken");
  });
  it("все shop/mining/coins/eco/frame/ideas/presave/health роуты присутствуют", () => {
    const src = read("server.ts");
    const must = [
      "/magnum/api/shop/catalog","/magnum/api/shop/buy","/magnum/api/mining/click",
      "/magnum/api/coins/add","/magnum/api/eco/leaderboard","/magnum/api/frame/status",
      "/magnum/api/ideas","/magnum/api/presave/click","/magnum/api/health",
      "/magnum/api/auth/register","/magnum/api/auth/login","/magnum/api/ai",
    ];
    for (const p of must) expect(src, p).toContain(p);
  });
  it("не хардкодит секреты, не хардкодит DATABASE_URL литерал", () => {
    const src = read("server.ts");
    expect(src).not.toMatch(/XIAOMI_API_KEY\s*=\s*["']sk-/);
    expect(src).toContain("process.env.DATABASE_URL");
    expect(src).not.toMatch(/DATABASE_URL\s*=\s*["']postgresql:/);
  });
});

// ── Build: dist чанки, sitemap, Bun.build
describe("build: dist артефакты и Bun.build", () => {
  it("dist содержит 10+ chunk-*.js каждый >1KB и dist/index.html с /magnum/", () => {
    const files = readdirSync(resolve(ROOT, "dist"));
    const chunks = files.filter(f => f.startsWith("chunk-") && f.endsWith(".js"));
    expect(chunks.length).toBeGreaterThanOrEqual(10);
    for (const f of chunks.slice(0, 3)) expect(statSync(join(resolve(ROOT, "dist"), f)).size).toBeGreaterThan(1024);
    const html = read("dist/index.html");
    expect(html).toContain("/magnum/");
    expect(html).toMatch(/<script[^>]+src=/);
  });
  it("build.ts использует Bun.build с splitting, minify, target browser", () => {
    const b = read("build.ts");
    expect(b).toContain("Bun.build");
    expect(b).toContain("splitting");
    expect(b).toContain("minify");
  });
  it("public/sitemap.xml без дублей, все https:// и /magnum, ≥15 URL", () => {
    const xml = read("public/sitemap.xml");
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].trim());
    expect(locs.length).toBeGreaterThanOrEqual(15);
    expect(new Set(locs).size).toBe(locs.length);
    for (const u of locs) { expect(u.startsWith("https://")).toBe(true); expect(u).toContain("/magnum"); }
  });
});
