// gacha.ts — GACHA CORE 42 — pity 90/180 + 50/50 + soft-pity 65
// Китайский стандарт 2026: гарант 90 на 4* (epic 420), гарант 180 на 5* (legendary 1420), 50/50 на ивент-баннер, soft-pity с 65 (+6%/крутка)

export type BannerType = "standard" | "event";
export type Rarity = "common" | "rare" | "epic" | "legendary";

export const RARITY_TABLE: Record<Rarity, number> = {
  // базовые шансы (до soft-pity): сумма =1
  // legendary 0.6% — из спеки; epic ~5.1%; rare ~20%; common остальное
  legendary: 0.006,
  epic: 0.051,
  rare: 0.2,
  common: 0.743,
} as const;

export const RARITY_PRICE: Record<Rarity, number> = {
  common: 42,
  rare: 142,
  epic: 420,
  legendary: 1420,
} as const;

// dust за дубликат (спека: epic 100, legendary 420; остальные — 14/42 для целостности)
export const DUST_REWARD: Record<Rarity, number> = {
  common: 14,
  rare: 42,
  epic: 100,
  legendary: 420,
} as const;

// ── soft-pity кривая для 5* ──────────────────────────────────────────────
// база 0.6% до 64; с 65 +6% за крутку (спека). 75 → 66.6% (>15% для теста), 85 → 100%
export function softPityCurve(pity5: number): number {
  if (pity5 < 65) return 0.006;
  const extra = (pity5 - 64) * 0.06;
  return Math.min(1, 0.006 + extra);
}
export function getLegendaryChance(pity5: number): number {
  return softPityCurve(pity5);
}

// ── пулы айтемов — берём из COSMETICS_CATALOG без жёсткой зависимости ──
// Для изоляции от циклических импортов — список копируется лениво через динамический импорт в рантайме.
// Но для детерминированности тестов экспортируем статический пул (ид совпадают с cosmetics.ts)
export const GACHA_POOL: Record<Rarity, string[]> = {
  common: [
    "frame-neon42","frame-ice","frame-paper","banner-42wave","banner-ocean","banner-grid",
    "title-bra","title-neon","title-noob",
    "frame-prism-rose","banner-prism-aurora","title-prism-novice",
    "frame-glacier-matte","banner-snow-dust","title-ice-fence",
    "frame-crystal-matte","banner-snow-quartz","title-crystal-fence",
    "frame-volcano-ash","banner-volcano-ash","title-volcano-ash",
    "frame-obsidian-coal","banner-obsidian-dust","title-obsidian-coal",
  ],
  rare: [
    "frame-gold","frame-fire","frame-pixel","banner-magnum","banner-sunset","banner-grid",
    "title-42","title-hype",
    "frame-prism-ice","banner-prism-neon","title-prism-hype",
    "frame-siberia-frost","banner-tom-glacier","title-kuzbass-ice",
    "frame-siberia-crystal","banner-tom-quartz","title-taiga-crystal",
    "frame-volcano-lava","banner-volcano-lava","title-volcano-lava",
    "frame-obsidian-shaft","banner-obsidian-shaft","title-obsidian-shaft",
  ],
  epic: [
    "frame-rgb","frame-toxic","frame-holo","banner-glitch","banner-forest","banner-tiger","title-magnum","title-toxic",
    "frame-prism-toxic","banner-prism-sunset","title-prism-aurora",
    "frame-meduza-glacier","banner-vpn-frost","title-nova-tundra",
    "frame-meduza-crystal","banner-vpn-quartz","title-nova-crystal",
    "frame-volcano-eruption","banner-volcano-eruption","title-volcano-eruption",
    "frame-meduza-obsidian","banner-meduza-obsidian","title-meduza-obsidian",
  ],
  legendary: [
    "frame-dragon","frame-void","frame-crown","banner-voidstar","banner-nebula","title-legend","title-vip","title-god",
    "frame-prism-void","banner-prism-abyss","title-prism-legend",
    "frame-gold-glacier-spin","banner-diamond-frost","title-rgb-glacier",
    "frame-gold-crystal-spin","banner-diamond-quartz","title-rgb-crystal",
    "frame-volcano-gold-spin","banner-volcano-gold","title-volcano-gold",
    "frame-gold-obsidian-spin","banner-obsidian-gold","title-obsidian-gold",
  ],
};

// ивент-легендарки — первые 3 легендарки считаются ивентовыми (детерминированно для 50/50)
export const EVENT_LEGENDARY_POOL = GACHA_POOL.legendary.slice(0, 6);
export const STANDARD_LEGENDARY_POOL = GACHA_POOL.legendary.slice(6);

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function pickItemId(rarity: Rarity, bannerType: BannerType, isEventWin: boolean): string {
  if (rarity === "legendary" && bannerType === "event") {
    if (isEventWin) return pickRandom(EVENT_LEGENDARY_POOL);
    return pickRandom(STANDARD_LEGENDARY_POOL);
  }
  return pickRandom(GACHA_POOL[rarity]);
}

// ── основной ролл с pity/soft-pity/50-50 логикой ───────────────────────────
// Сигнатура для спеки: rollWithPity(pity, bannerType) — pity = pity_5star.
// Для 4* гаранта принимаем opts.pity4 (pity_counter). Если не передан — гарант 90 не применяется (тест 90 pulls требует).
export type RollResult = {
  rarity: Rarity;
  id: string;
  isEvent: boolean; // true если выпал ивент-легендарка (для 50/50)
  nextLost5050: boolean | null; // null если не легендарка; иначе флаг на будущее
};

export function rollWithPity(
  pity: number,
  bannerType: BannerType,
  opts?: { pity4?: number; lost5050?: boolean },
): RollResult {
  const pity5 = Math.max(0, Math.floor(pity));
  const pity4 = opts?.pity4 != null ? Math.max(0, Math.floor(opts.pity4)) : 0;
  const lost5050 = Boolean(opts?.lost5050);

  // 1) гарант 180 на 5* — переопределяет всё
  const guaranteeLegendary = pity5 >= 179;
  // 2) гарант 90 на 4*+ (epic+) — если 89 без epic+, следующая минимум epic
  const guaranteeEpicPlus = !guaranteeLegendary && pity4 >= 89;

  let rarity: Rarity;
  if (guaranteeLegendary) {
    rarity = "legendary";
  } else if (guaranteeEpicPlus) {
    // гарант 90: минимум epic; но soft-pity может дать legendary
    const legChance = softPityCurve(pity5);
    const r = Math.random();
    if (r < legChance) rarity = "legendary";
    else rarity = "epic";
  } else {
    const legChance = softPityCurve(pity5);
    const r = Math.random();
    if (r < legChance) rarity = "legendary";
    else if (r < legChance + RARITY_TABLE.epic) rarity = "epic";
    else if (r < legChance + RARITY_TABLE.epic + RARITY_TABLE.rare) rarity = "rare";
    else rarity = "common";
  }

  // 50/50 на ивент-баннере для легендарок
  let isEvent = false;
  let nextLost: boolean | null = null;
  if (rarity === "legendary" && bannerType === "event") {
    if (lost5050) {
      isEvent = true;
      nextLost = false;
    } else {
      const win = Math.random() < 0.5;
      isEvent = win;
      nextLost = win ? false : true;
    }
  }

  const id = pickItemId(rarity, bannerType, isEvent);
  return { rarity, id, isEvent, nextLost5050: nextLost };
}

// ── хелпер для цены крутки (спека: 42/420, 10-я 390) ──
export function gachaPrice(count: 1 | 10): number {
  if (count === 10) return 390;
  return 42;
}
