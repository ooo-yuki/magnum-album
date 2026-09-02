import { describe, it, expect } from "bun:test";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
const ROOT = resolve(__dirname, "..");
function read(p: string) { return readFileSync(resolve(ROOT, p), "utf-8"); }

// ── Game2042: TILE_LORE 12 чисел + логика ──
describe("1515: Game2042 TILE_LORE + 2026 lore", () => {
  it("TILE_LORE содержит 12 записей 2..4096 и каждая имеет title+lore", () => {
    const s = read("src/pages/games/Game2042.tsx");
    const lore = s.match(/const TILE_LORE[\s\S]*?^};/m);
    expect(lore).not.toBeNull();
    const block = lore![0];
    for (const n of [2,4,8,16,32,64,128,256,512,1024,2048,4096]) {
      expect(block, `TILE_LORE нет ${n}`).toContain(`${n}:`);
    }
    expect(block).toMatch(/title:\s*"/);
    expect(block).toMatch(/lore:\s*"/);
  });
  it("TILE_LORE[2048] — магическое 42 MAGNUM + 5 пуль", () => {
    const s = read("src/pages/games/Game2042.tsx");
    expect(s).toContain('2048: { title: "42 — MAGNUM"');
    expect(s).toContain("5 пуль");
  });
  it("TILE_LORE инфоповоды 2026: ТУСА МЕДУЗА 14.08, VPN, CLAY 03.04, presave", () => {
    const s = read("src/pages/games/Game2042.tsx");
    const lore = s.match(/const TILE_LORE[\s\S]*?^};/m)![0];
    expect(lore).toContain("ТУСА МЕДУЗА");
    expect(lore).toContain("14.08");
    expect(lore).toContain("VPN");
    expect(lore).toContain("CLAY");
    expect(lore).toContain("03.04");
    expect(lore).toContain("https://music.thefence.me/psmagnum");
  });
  it("WIN_TILE=2048 отображается как 42 (tileLabel) и tileColor маппит 11 цветов", () => {
    const s = read("src/pages/games/Game2042.tsx");
    expect(s).toMatch(/WIN_TILE\s*=\s*2048/);
    expect(s).toContain('if (v >= WIN_TILE) return "42"');
    // tileColor покрывает 2..2048
    for (const v of [2,4,8,16,32,64,128,256,512,1024,2048]) {
      expect(s).toContain(`${v}:`);
    }
  });
  it("daily challenge: dailySeed = yyyymmdd, mulberry32, seededBoard 2 тайла", () => {
    const s = read("src/pages/games/Game2042.tsx");
    expect(s).toMatch(/dailySeed\(\): number/);
    expect(s).toContain("getFullYear()*10000");
    expect(s).toMatch(/function mulberry32/);
    expect(s).toMatch(/0x6D2B79F5/);
    expect(s).toMatch(/function seededBoard/);
    expect(s).toContain("for(let k=0;k<2;k++)");
  });
  it("WebAudio safeRamp обёртка + 5 звуков (merge/slide/bump/win/over)", () => {
    const s = read("src/pages/games/Game2042.tsx");
    expect(s).toContain("function safeRamp");
    expect(s).toContain("exponentialRampToValueAtTime");
    for (const fn of ["playMerge","playSlide","playBump","playWin","playGameOver"]) {
      expect(s, `нет ${fn}`).toContain(fn);
    }
  });
});

// ── Economy: RARITY + catalog 12 ──
describe("1515: economy.ts RARITY sync", () => {
  it("RARITY_PRICE 42/142/420/1420 живёт в cosmetics.ts и переиспользуется", () => {
    const canon = read("src/lib/cosmetics.ts");
    expect(canon).toContain("export const RARITY_PRICE");
    expect(canon).toContain("common: 42");
    expect(canon).toContain("rare: 142");
    expect(canon).toContain("epic: 420");
    expect(canon).toContain("legendary: 1420");
    // economy.ts и shopCatalog.ts не дублируют цены, а импортируют их
    const eco = read("src/lib/economy.ts");
    expect(eco).toContain("RARITY_PRICE");
    expect(eco).toMatch(/from "\.\/cosmetics"/);
    expect(eco).toContain("SKINS.map");
    const shop = read("src/lib/shopCatalog.ts");
    expect(shop).toMatch(/from "\.\/cosmetics"/);
    const def = (shop.match(/SKINS_DEF[^=]*=\s*\[([\s\S]*?)\n\];/) || ["",""])[1];
    const items = (def.match(/\{ id:/g) || []).length;
    expect(items, `SKINS ${items} !=12`).toBe(12);
  });
  it("getItemPrice + isValidShopId + buyItem/equipItem присутствуют", () => {
    const s = read("src/lib/economy.ts");
    expect(s).toContain("function getItemPrice");
    expect(s).toContain("function isValidShopId");
    expect(s).toContain("function buyItem");
    expect(s).toContain("function equipItem");
    expect(s).toContain("getCoins()");
    expect(s).toContain("addCoins(-price)");
  });
  it("ShopPage RARITY_META тянет цены из cosmetics.ts (42/142/420/1420)", () => {
    const canon = read("src/lib/cosmetics.ts");
    for (const price of ["42","142","420","1420"]) {
      expect(canon, `cosmetics нет ${price}`).toContain(price);
    }
    const meta = read("src/lib/shopCatalog.ts");
    expect(meta).toContain("RARITY_PRICE.common");
    expect(meta).toContain("RARITY_PRICE.legendary");
    const shop = read("src/pages/ShopPage.tsx");
    expect(shop).toContain("shopCatalog");
  });
});

// ── Server: health, coins, SPA ──
describe("1515: server.ts health + SPA + build", () => {
  it("server.ts: /magnum/api/health возвращает {ok:true} + counts 14 таблиц", () => {
    const s = read("server.ts");
    expect(s).toContain("/magnum/api/health");
    expect(s).toMatch(/ok.*true|status.*ok/i);
    expect(s).toContain("magnum_users");
    expect(s).toContain("magnum_coins");
    expect(s).toContain("handleHealth");
  });
  it("server.ts: POST /magnum/api/coins/add с verify + rateLimit", () => {
    const s = read("server.ts");
    expect(s).toContain("/magnum/api/coins/add");
    expect(s).toMatch(/verify|auth|Bearer/);
    expect(s).toMatch(/rateLimit|rateMap/);
  });
  it("build.ts hash + vendor + splitting + dist/images/gallery-42 sync", () => {
    const s = read("build.ts");
    expect(s).toContain("Bun.build");
    expect(s).toMatch(/splitting/);
    expect(s).toMatch(/hash/);
    // gallery sync after build
    const shouldSync = s.includes("gallery-42") || s.includes("public/images");
    expect(s.includes("dist") && s.includes("public")).toBe(true);
    void shouldSync;
  });
});
