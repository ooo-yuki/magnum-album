/**
 * MAGNUM · economy.ts — единый каталог экономики 42
 * Источник цен — RARITY_META (синхрон с ShopPage.tsx).
 * Ранее файл содержал 69 QUEST-заглушек (2500 строк) — удалены, дубли устранены.
 */
import { getCoins, addCoins } from "./coins";

// ── Редкости (синхрон с ShopPage.tsx RARITY_META) ──────────────────────────
export type Rarity = "common" | "rare" | "epic" | "legendary";
export const RARITY_PRICE: Record<Rarity, number> = {
  common: 42,
  rare: 142,
  epic: 420,
  legendary: 1420,
} as const;
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

// ── Полный каталог 12 скинов (синхрон с ShopPage SKINS) ────────────────────
export const SHOP_CATALOG = [
  { id: "mops", name: "Мопс 42", rarity: "common" as const, price: 42, emoji: "🐗" },
  { id: "rhino", name: "Носорог 42", rarity: "common" as const, price: 42, emoji: "🦏" },
  { id: "monkey", name: "Обезьяна 42", rarity: "common" as const, price: 42, emoji: "🐵" },
  { id: "frog", name: "Лягуха 42", rarity: "common" as const, price: 42, emoji: "🐸" },
  { id: "panda", name: "Панда 42", rarity: "rare" as const, price: 142, emoji: "🐼" },
  { id: "fox", name: "Лиса 42", rarity: "rare" as const, price: 142, emoji: "🦊" },
  { id: "owl", name: "Сова 42", rarity: "rare" as const, price: 142, emoji: "🦉" },
  { id: "shark", name: "Акула 42", rarity: "epic" as const, price: 420, emoji: "🦈" },
  { id: "flamingo", name: "Фламинго 42", rarity: "epic" as const, price: 420, emoji: "🦩" },
  { id: "wolf", name: "Волк 42", rarity: "epic" as const, price: 420, emoji: "🐺" },
  { id: "tiger", name: "Тигр 42", rarity: "legendary" as const, price: 1420, emoji: "🐯" },
  { id: "dragon", name: "Дракон 42", rarity: "legendary" as const, price: 1420, emoji: "🐉" },
] as const;
export type CatalogItem = (typeof SHOP_CATALOG)[number];

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
