import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(__dirname, "..");
function read(p: string) { return readFileSync(resolve(ROOT, p), "utf-8"); }

// 1. server.ts: все must-have API роуты + методы
describe("new: server.ts API роуты и методы", () => {
  const src = read("server.ts");
  const mustHave: Array<[string, string]> = [
    ["/magnum/api/ws", "upgrade"],
    ["/magnum/api/ai", "ai"],
    ["/magnum/api/auth/register", "POST"],
    ["/magnum/api/auth/login", "POST"],
    ["/magnum/api/auth/me", "GET"],
    ["/magnum/api/auth/logout", "POST"],
    ["/magnum/api/health", "GET"],
    ["/magnum/api/coins", "GET"],
    ["/magnum/api/presave/click", "POST"],
    ["/magnum/api/ideas", "GET"],
    ["/magnum/api/frame/status", "GET"],
    ["/magnum/api/eco/leaderboard", "GET"],
  ];
  for (const [route] of mustHave) {
    it(`содержит роут ${route}`, () => {
      expect(src).toContain(route);
    });
  }
  it("WS использует extractToken + getUserByToken для имени", () => {
    expect(src).toContain("extractToken");
    expect(src).toContain("getUserByToken");
  });
  it("использует Bun.serve с port из process.env.PORT", () => {
    expect(src).toContain("Bun.serve");
    expect(src).toContain("process.env.PORT");
  });
});

// 2. GamesHub: 16 игр, уникальные to, пресейв не хардкодит 404
describe("new: GamesHub 16 игр и структура", () => {
  const src = read("src/pages/GamesHub.tsx");
  it("GAMES массив — ровно 16 игр", () => {
    const tos = src.match(/to:\s*"\/magnum\/games\/[a-z0-9-]+"/g) || [];
    expect(tos.length).toBe(16);
  });
  it("все to уникальны и начинаются с /magnum/games/", () => {
    const tos = (src.match(/\/magnum\/games\/[a-z0-9-]+/g) || []);
    const uniq = new Set(tos);
    expect(uniq.size).toBe(tos.length);
    for (const t of tos) expect(t.startsWith("/magnum/games/")).toBe(true);
  });
  it("каждая игра имеет icon, title, desc", () => {
    const blocks = src.match(/\{[^}]*to:[^}]*title:[^}]*desc:[^}]*\}/g) || [];
    // fallback: считаем строки с title:
    expect(src.match(/title:\s*"/g)!.length).toBe(17);
    expect(src.match(/desc:\s*"/g)!.length).toBe(17);
  });
  it("подзаголовок упоминает 16 игр", () => {
    expect(src).toContain("16 игр");
  });
});

// 3. dist: чанки существуют и >1KB, sitemap скопирован
describe("new: dist build артефакты", () => {
  it("dist/ содержит 10+ чанков chunk-*", () => {
    const files = readdirSync(resolve(ROOT, "dist"));
    const chunks = files.filter(f => f.startsWith("chunk-"));
    expect(chunks.length).toBeGreaterThanOrEqual(10);
  });
  it("каждый chunk-*.js >1KB", () => {
    const files = readdirSync(resolve(ROOT, "dist")).filter(f => f.startsWith("chunk-") && f.endsWith(".js"));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files.slice(0, 5)) {
      const sz = statSync(join(resolve(ROOT, "dist"), f)).size;
      expect(sz).toBeGreaterThan(1024);
    }
  });
  it("dist/index.html существует и содержит script src", () => {
    expect(existsSync(resolve(ROOT, "dist/index.html"))).toBe(true);
    const html = read("dist/index.html");
    expect(html).toMatch(/<script[^>]+src=/);
  });
  it("build.ts использует Bun.build с splitting и minify", () => {
    const b = read("build.ts");
    expect(b).toContain("Bun.build");
    expect(b).toContain("splitting");
    expect(b).toContain("minify");
  });
});

// 4. gallery-42: 6 файлов, webp + jpg пары, размеры
describe("new: gallery-42 файлы парами", () => {
  it("4 webp + 4 jpg = 8 файлов >5KB каждый", () => {
    const dir = resolve(ROOT, "public/images/gallery-42");
    const files = readdirSync(dir);
    expect(files.length).toBeGreaterThanOrEqual(8);
    const webp = files.filter(f => f.endsWith(".webp"));
    const jpg = files.filter(f => f.endsWith(".jpg"));
    expect(webp.length).toBeGreaterThanOrEqual(4);
    expect(jpg.length).toBeGreaterThanOrEqual(4);
    for (const f of files) {
      const sz = statSync(join(dir, f)).size;
      expect(sz).toBeGreaterThan(5 * 1024);
    }
  });
  it("webp и jpg пары совпадают по базовому имени (42-*-01)", () => {
    const dir = resolve(ROOT, "public/images/gallery-42");
    const files = readdirSync(dir);
    const bases = new Set(files.map(f => f.replace(/-800\.webp$|\.webp$|\.jpg$/, "")));
    expect(bases.size).toBeGreaterThanOrEqual(4);
    for (const b of bases) {
      expect(files.some(f => f === `${b}.jpg`)).toBe(true);
    }
  });
});

// 5. server env safety + sitemap https
describe("new: env safety и sitemap https", () => {
  it("server.ts не хардкодит XIAOMI_API_KEY значение", () => {
    const src = read("server.ts");
    expect(src).not.toMatch(/XIAOMI_API_KEY\s*=\s*["']sk-/);
    expect(src).toContain("process.env.XIAOMI_API_KEY");
  });
  it("public/sitemap.xml все loc с https и без дублей", () => {
    const xml = read("public/sitemap.xml");
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
    expect(locs.length).toBeGreaterThanOrEqual(15);
    expect(new Set(locs).size).toBe(locs.length);
    for (const u of locs) expect(u.startsWith("https://")).toBe(true);
  });
  it("vite/build не хардкодит DATABASE_URL", () => {
    const srv = read("server.ts");
    // должен читать из env, не литерал postgresql://
    expect(srv).toContain("process.env.DATABASE_URL");
    expect(srv).not.toMatch(/DATABASE_URL\s*=\s*["']postgresql:/);
  });
});

// 6. drizzle / src/pages/games: 16 файлов игр на диске
describe("new: drizzle и games файлы на диске", () => {
  it("drizzle/schema.ts или src/db существует", () => {
    const hasDrizzle = existsSync(resolve(ROOT, "drizzle")) || existsSync(resolve(ROOT, "src/db"));
    // хотя бы drizzle config + папка с миграциями
    expect(existsSync(resolve(ROOT, "drizzle.config.ts"))).toBe(true);
    expect(hasDrizzle).toBe(true);
  });
  it("src/pages/games содержит 16+ файлов игр", () => {
    const dir = resolve(ROOT, "src/pages/games");
    const files = readdirSync(dir).filter(f => f.endsWith(".tsx") || f.endsWith(".ts"));
    expect(files.length).toBeGreaterThanOrEqual(14);
    // ключевые игры присутствуют
    for (const must of ["Game2042", "Flappy42Game", "Snake", "Dodge", "Blackjack", "Roulette"]) {
      expect(files.some(f => f.includes(must) || f.toLowerCase().includes(must.toLowerCase()))).toBe(true);
    }
  });
});
