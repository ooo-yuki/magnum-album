// cosmetics.ts — единый источник COSMETICS + GLACIER/CRYSTAL/PRISM 12/12/12
// GLACIER 12: frame-glacier-matte … title-rgb-glacier (включая kuzbass-ice, tom-glacier)

export type CosmeticSlot = "frame" | "banner" | "title";
export type Rarity = "common" | "rare" | "epic" | "legendary";
export type CosmeticItem = { id: string; slot: CosmeticSlot; name: string; price: number; rarity: Rarity; style: string };

// ── Единственный источник цен по редкости для всего проекта ──────────────────
// Импортируется economy.ts (RARITY_PRICE), shopCatalog.ts (RARITY_META.price)
export const RARITY_PRICE: Record<Rarity, number> = {
  common: 42,
  rare: 142,
  epic: 420,
  legendary: 1420,
};

export const COSMETICS_CATALOG: CosmeticItem[] = [
  { id: "frame-neon42", slot: "frame", name: "Неон 42", price: 42, rarity: "common", style: "2px solid #ff44cc" },
  { id: "frame-gold", slot: "frame", name: "Золото 42", price: 142, rarity: "rare", style: "3px solid #ffcc00" },
  { id: "frame-rgb", slot: "frame", name: "RGB-пульс", price: 420, rarity: "epic", style: "3px solid #00ffcc" },
  { id: "frame-dragon", slot: "frame", name: "Драконьи когти", price: 1420, rarity: "legendary", style: "4px solid #ff2d55" },
  { id: "frame-ice", slot: "frame", name: "Лёд MAGNUM", price: 42, rarity: "common", style: "2px solid #7dd8ff" },
  { id: "frame-fire", slot: "frame", name: "Пламя", price: 142, rarity: "rare", style: "3px solid #ff6a00" },
  { id: "frame-toxic", slot: "frame", name: "Токсик", price: 420, rarity: "epic", style: "3px solid #7cff00" },
  { id: "frame-void", slot: "frame", name: "Войд", price: 1420, rarity: "legendary", style: "4px solid #7a1ecb" },
  { id: "frame-paper", slot: "frame", name: "Бумажный", price: 42, rarity: "common", style: "2px dashed #aaa" },
  { id: "frame-pixel", slot: "frame", name: "Пиксель 42", price: 142, rarity: "rare", style: "3px solid #5865f2" },
  { id: "frame-holo", slot: "frame", name: "Голо-рамка", price: 420, rarity: "epic", style: "3px solid #9147ff" },
  { id: "frame-crown", slot: "frame", name: "Корона", price: 1420, rarity: "legendary", style: "4px solid #ffd700" },
  { id: "banner-42wave", slot: "banner", name: "Волна 42", price: 42, rarity: "common", style: "linear-gradient(90deg,#ff44cc,#00ffcc)" },
  { id: "banner-magnum", slot: "banner", name: "MAGNUM fire", price: 142, rarity: "rare", style: "linear-gradient(90deg,#ff2d55,#ffcc00)" },
  { id: "banner-glitch", slot: "banner", name: "Глитч", price: 420, rarity: "epic", style: "linear-gradient(90deg,#5865f2,#9147ff)" },
  { id: "banner-voidstar", slot: "banner", name: "Звезда войда", price: 1420, rarity: "legendary", style: "linear-gradient(90deg,#0a0a0a,#7a1ecb 50%,#ff44cc)" },
  { id: "banner-ocean", slot: "banner", name: "Океан", price: 42, rarity: "common", style: "linear-gradient(90deg,#0c2e57,#2b7fd4)" },
  { id: "banner-sunset", slot: "banner", name: "Закат", price: 142, rarity: "rare", style: "linear-gradient(90deg,#ff7b00,#ff44cc)" },
  { id: "banner-forest", slot: "banner", name: "Лес 42", price: 420, rarity: "epic", style: "linear-gradient(90deg,#14401a,#8fe06a)" },
  { id: "banner-nebula", slot: "banner", name: "Туманность", price: 1420, rarity: "legendary", style: "linear-gradient(90deg,#1b0a3a,#ff2d55)" },
  { id: "banner-grid", slot: "banner", name: "Сетка", price: 42, rarity: "common", style: "linear-gradient(90deg,#2e3238,#b8bcc4)" },
  { id: "banner-tiger", slot: "banner", name: "Тигр", price: 420, rarity: "epic", style: "linear-gradient(90deg,#8a3c00,#ffd76a)" },
  { id: "title-bra", slot: "title", name: "Братуха", price: 42, rarity: "common", style: "#9aa4b2" },
  { id: "title-42", slot: "title", name: "42 навсегда", price: 142, rarity: "rare", style: "#5865f2" },
  { id: "title-magnum", slot: "title", name: "MAGNUM", price: 420, rarity: "epic", style: "#ff44cc" },
  { id: "title-legend", slot: "title", name: "Легенда", price: 1420, rarity: "legendary", style: "#ffcc00" },
  { id: "title-neon", slot: "title", name: "Неоновый", price: 42, rarity: "common", style: "#00ffcc" },
  { id: "title-hype", slot: "title", name: "Хайп", price: 142, rarity: "rare", style: "#9147ff" },
  { id: "title-toxic", slot: "title", name: "Токсичный", price: 420, rarity: "epic", style: "#7cff00" },
  { id: "title-vip", slot: "title", name: "VIP 42", price: 1420, rarity: "legendary", style: "#ff2d55" },
  { id: "title-noob", slot: "title", name: "Новичок", price: 42, rarity: "common", style: "#aaa" },
  { id: "title-god", slot: "title", name: "Бог 42", price: 1420, rarity: "legendary", style: "#ffd700" },
  // ── PRISM 12
  { id: "frame-prism-rose", slot: "frame", name: "Призма Роза", price: 42, rarity: "common", style: "conic-gradient(from 0deg,#ff44cc,#ffcc00,#00ffcc,#5865f2,#ff44cc)" },
  { id: "frame-prism-ice", slot: "frame", name: "Призма Лёд", price: 142, rarity: "rare", style: "conic-gradient(from 45deg,#7dd8ff,#00ffcc,#9147ff,#7dd8ff)" },
  { id: "frame-prism-toxic", slot: "frame", name: "Призма Токсик", price: 420, rarity: "epic", style: "conic-gradient(from 90deg,#7cff00,#00ffcc,#ffcc00,#7cff00)" },
  { id: "frame-prism-void", slot: "frame", name: "Призма Войд", price: 1420, rarity: "legendary", style: "conic-gradient(from 180deg,#7a1ecb,#ff44cc,#0a0a0a,#7a1ecb)" },
  { id: "banner-prism-aurora", slot: "banner", name: "Аврора Призм", price: 42, rarity: "common", style: "linear-gradient(90deg,#00ffcc,#5865f2 35%,#ff44cc 70%,#ffcc00)" },
  { id: "banner-prism-neon", slot: "banner", name: "Неон Призм", price: 142, rarity: "rare", style: "linear-gradient(90deg,#ff44cc,#9147ff 40%,#00ffcc)" },
  { id: "banner-prism-sunset", slot: "banner", name: "Призм Закат", price: 420, rarity: "epic", style: "linear-gradient(90deg,#ff7b00,#ff44cc 40%,#7a1ecb)" },
  { id: "banner-prism-abyss", slot: "banner", name: "Призм Бездна", price: 1420, rarity: "legendary", style: "linear-gradient(90deg,#0a0a0a,#7a1ecb 30%,#ffcc00 70%,#ff44cc)" },
  { id: "title-prism-novice", slot: "title", name: "Призм Новичок", price: 42, rarity: "common", style: "#7dd8ff" },
  { id: "title-prism-hype", slot: "title", name: "Призм Хайп", price: 142, rarity: "rare", style: "#ff44cc" },
  { id: "title-prism-aurora", slot: "title", name: "Аврора", price: 420, rarity: "epic", style: "#9147ff" },
  { id: "title-prism-legend", slot: "title", name: "Призм Легенда", price: 1420, rarity: "legendary", style: "conic-gradient(from 0deg,#ffcc00,#ff44cc,#00ffcc,#ffcc00)" },
  // ── GLACIER VAULT 12
  { id: "frame-glacier-matte", slot: "frame", name: "Гляйшер Матт", price: 42, rarity: "common", style: "2px solid #e0faff" },
  { id: "banner-snow-dust", slot: "banner", name: "Снежная Пыль", price: 42, rarity: "common", style: "linear-gradient(90deg,#ffffff,#e0faff)" },
  { id: "title-ice-fence", slot: "title", name: "Ледяной Забор", price: 42, rarity: "common", style: "#b8e6fe" },
  { id: "frame-siberia-frost", slot: "frame", name: "Сибирь Фрост", price: 142, rarity: "rare", style: "3px solid #a5f3fc" },
  { id: "banner-tom-glacier", slot: "banner", name: "Том Гляйшер", price: 142, rarity: "rare", style: "linear-gradient(90deg,#06b6d4,#0891b2)" },
  { id: "title-kuzbass-ice", slot: "title", name: "Кузбасс Лед", price: 142, rarity: "rare", style: "#0e7490" },
  { id: "frame-meduza-glacier", slot: "frame", name: "Медуза Гляйшер", price: 420, rarity: "epic", style: "conic-gradient(from 0deg,#a5f3fc,#06b6d4,#e0faff,#a5f3fc)" },
  { id: "banner-vpn-frost", slot: "banner", name: "ВПН Фрост", price: 420, rarity: "epic", style: "linear-gradient(90deg,#e0faff,#06b6d4)" },
  { id: "title-nova-tundra", slot: "title", name: "Нова Тундра", price: 420, rarity: "epic", style: "#7c3aed" },
  { id: "frame-gold-glacier-spin", slot: "frame", name: "Голд Гляйшер Спин", price: 1420, rarity: "legendary", style: "conic-gradient(from 0deg,#e0faff,#06b6d4,#ffd700,#e0faff)" },
  { id: "banner-diamond-frost", slot: "banner", name: "Даймонд Фрост", price: 1420, rarity: "legendary", style: "linear-gradient(90deg,#e0faff,#ffffff)" },
  { id: "title-rgb-glacier", slot: "title", name: "РГБ Гляйшер", price: 1420, rarity: "legendary", style: "conic-gradient(from 0deg,#e0faff,#ff44cc,#00ffcc,#e0faff)" },
  // ── CRYSTAL VAULT 12
  { id: "frame-crystal-matte", slot: "frame", name: "Кристалл Матт", price: 42, rarity: "common", style: "2px solid #e8f8ff" },
  { id: "banner-snow-quartz", slot: "banner", name: "Снежный Кварц", price: 42, rarity: "common", style: "linear-gradient(90deg,#ffffff,#e8f0ff)" },
  { id: "title-crystal-fence", slot: "title", name: "Кристалл Забор", price: 42, rarity: "common", style: "#b8e0ff" },
  { id: "frame-siberia-crystal", slot: "frame", name: "Сибирь Кристалл", price: 142, rarity: "rare", style: "3px solid #a8e8ff" },
  { id: "banner-tom-quartz", slot: "banner", name: "Том Кварц", price: 142, rarity: "rare", style: "linear-gradient(90deg,#38bdf8,#0ea5e9)" },
  { id: "title-taiga-crystal", slot: "title", name: "Тайга Кристалл", price: 142, rarity: "rare", style: "#0e7490" },
  { id: "frame-meduza-crystal", slot: "frame", name: "Медуза Кристалл", price: 420, rarity: "epic", style: "conic-gradient(from 0deg,#a8e8ff,#38bdf8,#e8f8ff,#a8e8ff)" },
  { id: "banner-vpn-quartz", slot: "banner", name: "ВПН Кварц", price: 420, rarity: "epic", style: "linear-gradient(90deg,#e8f8ff,#38bdf8)" },
  { id: "title-nova-crystal", slot: "title", name: "Нова Кристалл", price: 420, rarity: "epic", style: "conic-gradient(from 90deg,#7c3aed,#38bdf8)" },
  { id: "frame-gold-crystal-spin", slot: "frame", name: "Голд Кристалл Спин", price: 1420, rarity: "legendary", style: "conic-gradient(from 0deg,#e8f8ff,#38bdf8,#ffd700,#e8f8ff)" },
  { id: "banner-diamond-quartz", slot: "banner", name: "Даймонд Кварц", price: 1420, rarity: "legendary", style: "linear-gradient(90deg,#e8f8ff,#ffffff)" },
  { id: "title-rgb-crystal", slot: "title", name: "РГБ Кристалл", price: 1420, rarity: "legendary", style: "conic-gradient(from 0deg,#a8e8ff,#ff44cc,#00ffcc,#a8e8ff)" },
  // ── VOLCANO GOLD 42 — 12 volcano-скинов + eruption glow conic-volcano spin 3s #ff5722 ──
  { id: "frame-volcano-ash", slot: "frame", name: "Вулкан Пепел", price: 42, rarity: "common", style: "2px solid #ff5722" },
  { id: "banner-volcano-ash", slot: "banner", name: "Пепел Вулкана", price: 42, rarity: "common", style: "linear-gradient(90deg,#ff5722,#ff8a65)" },
  { id: "title-volcano-ash", slot: "title", name: "Пепельный", price: 42, rarity: "common", style: "#ff5722" },
  { id: "frame-volcano-lava", slot: "frame", name: "Вулкан Лава", price: 142, rarity: "rare", style: "3px solid #d32f2f" },
  { id: "banner-volcano-lava", slot: "banner", name: "Лава Вулкана", price: 142, rarity: "rare", style: "linear-gradient(90deg,#d32f2f,#ff5722)" },
  { id: "title-volcano-lava", slot: "title", name: "Лавовый", price: 142, rarity: "rare", style: "#d32f2f" },
  { id: "frame-volcano-eruption", slot: "frame", name: "Вулкан Извержение", price: 420, rarity: "epic", style: "conic-gradient(from 0deg,#ff5722,#ff8a65,#ff5722,#d32f2f,#ff5722)" },
  { id: "banner-volcano-eruption", slot: "banner", name: "Извержение", price: 420, rarity: "epic", style: "linear-gradient(90deg,#ff5722,#d32f2f)" },
  { id: "title-volcano-eruption", slot: "title", name: "Извергающий", price: 420, rarity: "epic", style: "#ff5722" },
  { id: "frame-volcano-gold-spin", slot: "frame", name: "Вулкан Голд Спин", price: 1420, rarity: "legendary", style: "conic-gradient(from 0deg,#ff5722,#ffcc00,#ffd700,#ff5722)" },
  { id: "banner-volcano-gold", slot: "banner", name: "Голд Вулкан", price: 1420, rarity: "legendary", style: "linear-gradient(90deg,#ff5722,#ffd700)" },
  { id: "title-volcano-gold", slot: "title", name: "Вулкан Голд", price: 1420, rarity: "legendary", style: "conic-gradient(from 0deg,#ff5722,#ffcc00,#ffd700,#ff5722)" },
  // ── OBSIDIAN FORGE 42 — 12 obsidian: coal-dust 42 mine-shaft 142 meduza-obsidian 420 gold-obsidian-spin epic 1420 spin 3s molten ──
  { id: "frame-obsidian-coal", slot: "frame", name: "Обсидиан Уголь", price: 42, rarity: "common", style: "2px solid #1a1a1a" },
  { id: "banner-obsidian-dust", slot: "banner", name: "Угольная Пыль", price: 42, rarity: "common", style: "linear-gradient(90deg,#0a0a0a,#2b1a0a)" },
  { id: "title-obsidian-coal", slot: "title", name: "Угольный", price: 42, rarity: "common", style: "#1a1a1a" },
  { id: "frame-obsidian-shaft", slot: "frame", name: "Шахта Обсидиан", price: 142, rarity: "rare", style: "3px solid #4a2510" },
  { id: "banner-obsidian-shaft", slot: "banner", name: "Шахта", price: 142, rarity: "rare", style: "linear-gradient(90deg,#1a0a00,#ff4500)" },
  { id: "title-obsidian-shaft", slot: "title", name: "Шахтёр 42", price: 142, rarity: "rare", style: "#8b3a00" },
  { id: "frame-meduza-obsidian", slot: "frame", name: "Медуза Обсидиан", price: 420, rarity: "epic", style: "conic-gradient(from 0deg,#1a1a1a,#ff4500,#ff8c00,#1a1a1a)" },
  { id: "banner-meduza-obsidian", slot: "banner", name: "Медуза Расплав", price: 420, rarity: "epic", style: "linear-gradient(90deg,#1a1a1a,#ff5722)" },
  { id: "title-meduza-obsidian", slot: "title", name: "Расплавленный", price: 420, rarity: "epic", style: "#ff5722" },
  { id: "frame-gold-obsidian-spin", slot: "frame", name: "Голд Обсидиан Спин", price: 1420, rarity: "legendary", style: "conic-gradient(from 0deg,#1a1a1a,#ff4500,#ffcc00,#ffd700,#1a1a1a)" },
  { id: "banner-obsidian-gold", slot: "banner", name: "Золото Обсидиана", price: 1420, rarity: "legendary", style: "linear-gradient(90deg,#1a1a1a,#ffcc00)" },
  { id: "title-obsidian-gold", slot: "title", name: "Обсидиан Голд", price: 1420, rarity: "legendary", style: "conic-gradient(from 0deg,#ff4500,#ffcc00,#ffd700,#ff4500)" },
  // ── SKIN FORGE 42 — vault 12 скинов + крафт + holo epic (hype-queue #16) ── clay-73-brown 142 meduza-holo 420 gold-42-conic epic 1420 spin 3s
  { id: "frame-forge-iron", slot: "frame", name: "Кузня Железо", price: 42, rarity: "common", style: "2px solid #8d6e3e" },
  { id: "banner-forge-dust", slot: "banner", name: "Кузнечная Пыль", price: 42, rarity: "common", style: "linear-gradient(90deg,#3a2a18,#8d6e3e)" },
  { id: "title-forge-spark", slot: "title", name: "Искра 42", price: 42, rarity: "common", style: "#c9a86a" },
  { id: "frame-clay-73-brown", slot: "frame", name: "Глина 73 Браун", price: 142, rarity: "rare", style: "3px solid #a67c52" },
  { id: "banner-forge-anvil", slot: "banner", name: "Наковальня 42", price: 142, rarity: "rare", style: "linear-gradient(90deg,#4a2510,#d17a22)" },
  { id: "title-forge-ember", slot: "title", name: "Уголёк 42", price: 142, rarity: "rare", style: "#d17a22" },
  { id: "frame-meduza-holo", slot: "frame", name: "Медуза Холо", price: 420, rarity: "epic", style: "conic-gradient(from 0deg,#9147ff,#00ffcc,#ff44cc,#9147ff)" },
  { id: "banner-forge-holo", slot: "banner", name: "Кузня Холо", price: 420, rarity: "epic", style: "linear-gradient(90deg,#9147ff,#00ffcc)" },
  { id: "title-forge-prism", slot: "title", name: "Призма Кузни", price: 420, rarity: "epic", style: "#9147ff" },
  { id: "frame-gold-42-conic", slot: "frame", name: "Голд 42 Коник", price: 1420, rarity: "legendary", style: "conic-gradient(from 0deg,#ffcc00,#9147ff,#00ffcc,#ff44cc,#ffcc00)" },
  { id: "banner-gold-forge", slot: "banner", name: "Голд Кузня", price: 1420, rarity: "legendary", style: "linear-gradient(90deg,#ffcc00,#9147ff)" },
  { id: "title-holo-forge", slot: "title", name: "Холо Кузня", price: 1420, rarity: "legendary", style: "conic-gradient(from 0deg,#ffcc00,#9147ff,#00ffcc,#ff44cc,#ffcc00)" },
];

// Явный список 12 GLACIER id — не substring, чтобы не дрифтить (kuzbass-ice, tom-glacier входят)
export const GLACIER_IDS_LIST = [
  "frame-glacier-matte","banner-snow-dust","title-ice-fence","frame-siberia-frost","banner-tom-glacier","title-kuzbass-ice",
  "frame-meduza-glacier","banner-vpn-frost","title-nova-tundra","frame-gold-glacier-spin","banner-diamond-frost","title-rgb-glacier",
] as const;
export const GLACIER_IDS = new Set<string>(GLACIER_IDS_LIST as unknown as string[]);
export function isGlacierCosmetic(id:string):boolean{ return GLACIER_IDS.has(id); }
export const GLACIER_CATALOG = COSMETICS_CATALOG.filter(c=> GLACIER_IDS.has(c.id));
export const GLACIER_IDS_SET = GLACIER_IDS;
export const GLACIER = GLACIER_CATALOG; // alias for task check

export const PRISM_IDS = new Set(COSMETICS_CATALOG.filter(c=>c.id.includes("prism")).map(c=>c.id));
export function isPrismCosmetic(id:string):boolean{ return PRISM_IDS.has(id); }
export const PRISM_CATALOG = COSMETICS_CATALOG.filter(c=>PRISM_IDS.has(c.id));
export const PRISM_IDS_SET = PRISM_IDS;
export const NEON_PRISM_CATALOG = PRISM_CATALOG;
export const NEON_PRISM_IDS_SET = PRISM_IDS_SET;
export function isNeonPrismCosmetic(id:string):boolean{ return isPrismCosmetic(id); }
export const NEON_PRISM_IDS = PRISM_IDS;

export const CRYSTAL_IDS = new Set(COSMETICS_CATALOG.filter(c=>c.id.includes("crystal")||c.id.includes("quartz")).map(c=>c.id));
export function isCrystalCosmetic(id:string):boolean{ return CRYSTAL_IDS.has(id); }
export const CRYSTAL_CATALOG = COSMETICS_CATALOG.filter(c=>CRYSTAL_IDS.has(c.id));
export const CRYSTAL_IDS_SET = CRYSTAL_IDS;
export const CRYSTAL = CRYSTAL_CATALOG;

// ── VOLCANO GOLD 42 — 12 volcano ids + eruption glow conic-volcano spin 3s #ff5722 ──
export const VOLCANO_IDS_LIST = [
  "frame-volcano-ash","banner-volcano-ash","title-volcano-ash",
  "frame-volcano-lava","banner-volcano-lava","title-volcano-lava",
  "frame-volcano-eruption","banner-volcano-eruption","title-volcano-eruption",
  "frame-volcano-gold-spin","banner-volcano-gold","title-volcano-gold",
] as const;
export const VOLCANO_IDS = new Set<string>(VOLCANO_IDS_LIST as unknown as string[]);
export function isVolcanoCosmetic(id:string):boolean{ return VOLCANO_IDS.has(id); }
export const VOLCANO_CATALOG = COSMETICS_CATALOG.filter(c=> VOLCANO_IDS.has(c.id));
export const VOLCANO_IDS_SET = VOLCANO_IDS;
export const VOLCANO = VOLCANO_CATALOG;
export const VOLCANO_GOLD_FRAME_ID = "frame-volcano-gold-spin";
// eruption glow + conic-volcano spin 3s + shadow 0 0 16 volcano #ff5722
export const VOLCANO_GOLD_STYLE = "conic-gradient(from 0deg,#ff5722,#ffcc00,#ffd700,#ff5722)";
export const VOLCANO_SHADOW = "0 0 16px #ff5722";
export const VOLCANO_SPIN = "volcanoSpin 3s linear infinite";

// ── OBSIDIAN FORGE 42 — 12 obsidian ids + molten epic 1420 spin 3s #ff5722/#ffcc00 ──
export const OBSIDIAN_IDS_LIST = [
  "frame-obsidian-coal","banner-obsidian-dust","title-obsidian-coal",
  "frame-obsidian-shaft","banner-obsidian-shaft","title-obsidian-shaft",
  "frame-meduza-obsidian","banner-meduza-obsidian","title-meduza-obsidian",
  "frame-gold-obsidian-spin","banner-obsidian-gold","title-obsidian-gold",
] as const;
export const OBSIDIAN_IDS = new Set<string>(OBSIDIAN_IDS_LIST as unknown as string[]);
export function isObsidianCosmetic(id:string):boolean{ return OBSIDIAN_IDS.has(id); }
export const OBSIDIAN_CATALOG = COSMETICS_CATALOG.filter(c=> OBSIDIAN_IDS.has(c.id));
export const OBSIDIAN_IDS_SET = OBSIDIAN_IDS;
export const OBSIDIAN = OBSIDIAN_CATALOG;
export const OBSIDIAN_GOLD_FRAME_ID = "frame-gold-obsidian-spin";
export const OBSIDIAN_GOLD_STYLE = "conic-gradient(from 0deg,#1a1a1a,#ff4500,#ffcc00,#ffd700,#1a1a1a)";
export const OBSIDIAN_SHADOW = "0 0 16px #ff5722";
export const OBSIDIAN_SPIN = "obsidianSpin 3s linear infinite";

// ── SKIN FORGE 42 — vault 12 (hype-queue #16) clay-73-brown 142 meduza-holo 420 gold-42-conic epic 1420 spin 3s holo ──
export const FORGE_IDS_LIST = [
  "frame-forge-iron","banner-forge-dust","title-forge-spark",
  "frame-clay-73-brown","banner-forge-anvil","title-forge-ember",
  "frame-meduza-holo","banner-forge-holo","title-forge-prism",
  "frame-gold-42-conic","banner-gold-forge","title-holo-forge",
] as const;
export const FORGE_IDS = new Set<string>(FORGE_IDS_LIST as unknown as string[]);
export function isForgeCosmetic(id:string):boolean{ return FORGE_IDS.has(id); }
export const FORGE_CATALOG = COSMETICS_CATALOG.filter(c=> FORGE_IDS.has(c.id));
export const FORGE_IDS_SET = FORGE_IDS;
export const FORGE = FORGE_CATALOG;
export const FORGE_GOLD_FRAME_ID = "frame-gold-42-conic";
export const FORGE_GOLD_STYLE = "conic-gradient(from 0deg,#ffcc00,#9147ff,#00ffcc,#ff44cc,#ffcc00)";
export const FORGE_SHADOW = "0 0 16px #9147ff";
export const FORGE_SPIN = "forgeSpin 3s linear infinite";
export const FORGE_HOLO_STYLE = "conic-gradient(from 0deg,#9147ff,#00ffcc,#ff44cc,#9147ff)";

// ── MAGMA GOLD 42 — 12 magma: conic-magma #ff4500 spin 3s + lava glow — cross -42 glacier/duel ──
export const MAGMA_IDS_LIST = [
  "frame-magma-ash","banner-magma-ash","title-magma-ash",
  "frame-magma-lava","banner-magma-lava","title-magma-lava",
  "frame-magma-eruption","banner-magma-eruption","title-magma-eruption",
  "frame-magma-gold-spin","banner-magma-gold","title-magma-gold",
] as const;
export const MAGMA_IDS = new Set<string>(MAGMA_IDS_LIST as unknown as string[]);
export function isMagmaCosmetic(id:string):boolean{ return MAGMA_IDS.has(id); }
export const MAGMA_GOLD_FRAME_ID = "frame-magma-gold-spin";
export const MAGMA_GOLD_STYLE = "conic-gradient(from 0deg,#ff4500,#ff8c00,#ffd700,#ff4500)";
export const MAGMA_SHADOW = "0 0 16px #ff4500";
export const MAGMA_SPIN = "magmaSpin 3s linear infinite";

export const SKIN_EMOJI: Record<string, string> = {
  mops: "🐗", rhino: "🦏", monkey: "🐵", frog: "🐸",
  panda: "🐼", fox: "🦊", owl: "🦉",
  shark: "🦈", flamingo: "🦩", wolf: "🐺",
  tiger: "🐯", dragon: "🐉",
};

// aliases for ShopPage imports
export const COSMETICS = COSMETICS_CATALOG;
