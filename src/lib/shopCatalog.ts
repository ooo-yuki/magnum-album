// SHOP PREVIEW 42 — модалка 200px + InventoryBar скролл + SkinCard/EquippedFrame
// common 42 → epic 1420 CSS-градиенты + эмодзи 48px, бейдж rare фиолет/epic золото

import { RARITY_PRICE } from "./cosmetics";
import type { Rarity as CanonRarity } from "./cosmetics";

export type Rarity = CanonRarity;

export type RarityMeta = {
  label: string;
  price: number;
  color: string;
  badge: string; // badge bg
};

// price берётся из RARITY_PRICE (cosmetics.ts) — единый источник цен
export const RARITY_META: Record<Rarity, RarityMeta> = {
  common:    { label: "COMMON",    price: RARITY_PRICE.common,    color: "#9aa4b2", badge: "rgba(154,164,178,0.18)" },
  rare:      { label: "RARE",      price: RARITY_PRICE.rare,      color: "#9147ff", badge: "rgba(145,71,255,0.22)" }, // фиолет
  epic:      { label: "EPIC",      price: RARITY_PRICE.epic,      color: "#ffcc00", badge: "rgba(255,204,0,0.22)" }, // золото
  legendary: { label: "LEGENDARY", price: RARITY_PRICE.legendary, color: "#ffcc00", badge: "rgba(255,204,0,0.28)" },
};

export type Skin = {
  id: string;
  name: string;
  emoji: string;
  rarity: Rarity;
  bg: string; // CSS-градиент
  tagline: string;
  price: number;
};

// price не дублируется: подставляется из RARITY_PRICE по rarity (см. SKINS ниже)
const SKINS_DEF: Array<Omit<Skin, "price">> = [
  { id: "mops",     name: "Мопс 42",     emoji: "🐗", rarity: "common",    bg: "linear-gradient(135deg,#d8a86f,#9a6b3a 55%,#3d2a18)",   tagline: "Братуха с мягкими ушами" },
  { id: "rhino",    name: "Носорог 42",  emoji: "🦏", rarity: "common",    bg: "linear-gradient(135deg,#b8bcc4,#6f757f 55%,#2e3238)",   tagline: "Броня по-магнумовски" },
  { id: "monkey",   name: "Обезьяна 42", emoji: "🐵", rarity: "common",    bg: "linear-gradient(135deg,#c98f4e,#8f5a24 55%,#422711)",   tagline: "42 банана — норм старт" },
  { id: "frog",     name: "Лягуха 42",   emoji: "🐸", rarity: "common",    bg: "linear-gradient(135deg,#8fe06a,#3f9e3a 55%,#14401a)",   tagline: "Сидит тихо, ждёт дроп" },
  { id: "panda",    name: "Панда 42",    emoji: "🐼", rarity: "rare",      bg: "linear-gradient(135deg,#f2f2f2,#8f8f8f 55%,#1c1c1c)",  tagline: "Спит 42 часа в сутки" },
  { id: "fox",      name: "Лиса 42",     emoji: "🦊", rarity: "rare",      bg: "linear-gradient(135deg,#ffb14d,#e26a1e 55%,#7a2f08)",  tagline: "Чует, где лежат монеты" },
  { id: "owl",      name: "Сова 42",     emoji: "🦉", rarity: "rare",      bg: "linear-gradient(135deg,#a98bd6,#6a4fa0 55%,#2c1e47)",  tagline: "42 правила ночного стрима" },
  { id: "shark",    name: "Акула 42",    emoji: "🦈", rarity: "epic",      bg: "linear-gradient(135deg,#6fd8ff,#2b7fd4 55%,#0c2e57)",  tagline: "Хищник чартов" },
  { id: "flamingo", name: "Фламинго 42", emoji: "🦩", rarity: "epic",      bg: "linear-gradient(135deg,#ff9ad5,#f0569b 55%,#7a1f4b)",  tagline: "Розовый, но дерзкий" },
  { id: "wolf",     name: "Волк 42",     emoji: "🐺", rarity: "epic",      bg: "linear-gradient(135deg,#9fb3c8,#51677d 55%,#1c2733)",  tagline: "Одинокий волк 42 квартала" },
  { id: "tiger",    name: "Тигр 42",     emoji: "🐯", rarity: "legendary", bg: "linear-gradient(135deg,#ffd76a,#ff9d1e 55%,#8a3c00)", tagline: "Легенда улиц, все братухи в курсе" },
  { id: "dragon",   name: "Дракон 42",   emoji: "🐉", rarity: "legendary", bg: "linear-gradient(135deg,#ff2d55,#8a1ecb 55%,#1b0a3a)", tagline: "Жжёт чарты как MAGNUM" },
];

export const SKINS: Skin[] = SKINS_DEF.map((s) => ({ ...s, price: RARITY_PRICE[s.rarity] }));

export const SKIN_IDS = SKINS.map(s => s.id) as readonly string[];
export const SKIN_IDS_SET = new Set(SKIN_IDS);

export function getSkinById(id: string): Skin | undefined {
  return SKINS.find(s => s.id === id);
}

export function getSkinPrice(id: string): number | null {
  const s = getSkinById(id);
  return s ? s.price : null;
}

// rarity badge style helper — rare фиолет / epic золото
export function rarityBadgeStyle(rarity: Rarity): React.CSSProperties {
  const meta = RARITY_META[rarity];
  if (rarity === "rare") return { background: "rgba(145,71,255,0.18)", color: "#9147ff", borderColor: "#9147ff" };
  if (rarity === "epic" || rarity === "legendary") return { background: "rgba(255,204,0,0.18)", color: "#ffcc00", borderColor: "#ffcc00" };
  return { background: meta.badge, color: meta.color, borderColor: meta.color };
}

// conic-gradient for EquippedFrame glow
export const EQUIPPED_GLOW = "conic-gradient(from 0deg,#ff2d55,#ffcc00,#00ff88,#00c2ff,#ff2d55)";
export const EQUIPPED_SHADOW = "0 0 0 2px rgba(255,204,0,0.35), 0 0 24px rgba(255,204,0,0.45), 0 0 32px rgba(255,45,85,0.25)";

// storage keys for cross-tab sync
export const STORAGE_KEYS = {
  inventory: "magnum:shop:inventory",
  equipped: "magnum:shop:equipped",
} as const;
