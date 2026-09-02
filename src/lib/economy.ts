/**
 * MAGNUM · economy.ts — единый каталог экономики 42
 * Источник цен — RARITY_META (синхрон с ShopPage.tsx).
 * Ранее файл содержал 69 QUEST-заглушек (2500 строк) — удалены, дубли устранены.
 */
import { getCoins, addCoins } from "./coins";
import { RARITY_PRICE as CANON_RARITY_PRICE } from "./cosmetics";
import type { Rarity as CanonRarity } from "./cosmetics";
import { SKINS } from "./shopCatalog";

// ── Редкости — единый источник цен в cosmetics.ts (re-export для совместимости)
export type Rarity = CanonRarity;
export const RARITY_PRICE: Record<Rarity, number> = CANON_RARITY_PRICE;
export const RARITY_LABEL: Record<Rarity, string> = {
  common: "COMMON",
  rare: "RARE",
  epic: "EPIC",
  legendary: "LEGENDARY",
};

// ── Базовые скины 4 (совместимость) ────────────────────────────────────────
export const SHOP_ITEMS = [
  { id: "skin_common_01", price: RARITY_PRICE.common, rarity: "common" as const, name: "Кепка 42" },
  { id: "skin_rare_01", price: RARITY_PRICE.rare, rarity: "rare" as const, name: "Худи MAGNUM" },
  { id: "skin_epic_01", price: RARITY_PRICE.epic, rarity: "epic" as const, name: "Куртка Пятерки" },
  { id: "skin_legend_01", price: RARITY_PRICE.legendary, rarity: "legendary" as const, name: "Золотой MAGNUM" },
] as const;
export type ShopItem = (typeof SHOP_ITEMS)[number];

// ── Полный каталог 12 скинов — единый источник src/lib/shopCatalog.ts (SKINS) ──
export type CatalogItem = { id: string; name: string; rarity: Rarity; price: number; emoji: string };
export const SHOP_CATALOG: CatalogItem[] = SKINS.map((s) => ({
  id: s.id, name: s.name, rarity: s.rarity, price: s.price, emoji: s.emoji,
}));

export function getItemPrice(id: string): number {
  const found = SHOP_CATALOG.find((x) => x.id === id) ?? SHOP_ITEMS.find((x) => x.id === id);
  return found?.price ?? 42;
}
export function isValidShopId(id: string): boolean {
  return SHOP_CATALOG.some((x) => x.id === id) || SHOP_ITEMS.some((x) => x.id === id);
}

// ── Инвентарь (LS-совместимый, но основной — сервер) ───────────────────────
export type Inventory = string[];
let inventory: Inventory = [];
let equipped: string | null = null;
export function getInventory(): Inventory { return [...inventory]; }
export function getEquipped(): string | null { return equipped; }
export async function buyItem(id: string): Promise<boolean> {
  const price = getItemPrice(id);
  if (!isValidShopId(id)) return false;
  if (getCoins() < price) return false;
  await addCoins(-price);
  inventory.push(id);
  return true;
}
export function equipItem(id: string): boolean {
  if (!inventory.includes(id)) return false;
  equipped = id;
  return true;
}
export function unequipItem(): void { equipped = null; }

// ── Квест — единый тип (без дублей 69 штук) ────────────────────────────────
export type Quest = { id: string; title: string; reward: number; done: boolean; progress: number; target: number };
export function createQuest(id: string, title: string, reward: number, target: number): Quest {
  return { id, title, reward, done: false, progress: 0, target };
}
export function progressQuest(q: Quest, inc: number): Quest {
  q.progress = Math.min(q.target, q.progress + inc);
  if (q.progress >= q.target) q.done = true;
  return { ...q };
}
export function questProgressPct(q: Quest): number { return (q.progress / q.target) * 100; }
