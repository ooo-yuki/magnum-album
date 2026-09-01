// pass42.ts — ПРОПУСК 42 Battle Pass 42 lvl — XP 42/lvl, REWARDS 42, FREE + PREMIUM
export const XP_PER_LEVEL = 42;
export const MAX_LEVEL = 42;
export const SEASON_ID = "s42-2026";
export const SEASON_START_ISO = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
export const SEASON_END_ISO = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

export type PassReward = {
  coins?: number;
  skinId?: string;
  keyId?: string;
  freeze?: number;
  dust?: number;
  title?: string;
};

export type PassLevel = {
  level: number;
  free: PassReward | null;
  premium: PassReward | null;
};

// helper to build rewards
function r(free: PassReward | null, premium: PassReward | null): PassLevel & { level: number } {
  return { level: 0, free, premium } as any;
}

function evenCoins(lv: number): number {
  if (lv % 4 === 0) return 142;
  if (lv % 2 === 0) return 42;
  return 0;
}

// 42 levels — чётные 42/142 монет, 7/14/21/28/35/42 — скины/кейсы/freeze
export const PASS_REWARDS: PassLevel[] = (() => {
  const arr: PassLevel[] = [];
  for (let lv = 1; lv <= 42; lv++) {
    let free: PassReward | null = null;
    let premium: PassReward | null = null;
    const ec = evenCoins(lv);
    if (ec > 0) free = { coins: ec };
    // special 7-multiple free skins/cases/freeze
    if (lv === 7) free = { ...(free || {}), skinId: "skin_pass07_free", title: "Скин 7 — Кузбасс" };
    if (lv === 14) free = { ...(free || {}), skinId: "skin_pass14_free", title: "Скин 14 — Тайга" };
    if (lv === 21) {
      free = { ...(free || {}), skinId: "skin_pass21_free", title: "Скин 21 — Медведь" };
      premium = { coins: 420, skinId: "skin_pass21_prem" };
    }
    if (lv === 28) free = { ...(free || {}), keyId: "case_pass28", dust: 142, title: "Кейс 28" };
    if (lv === 35) free = { ...(free || {}), freeze: 1, title: "Freeze 35" };
    if (lv === 42) {
      free = { ...(free || {}), coins: 142, keyId: "case_legend_42", dust: 420, skinId: "skin_pass42_free", title: "Легенда 42" };
      premium = { coins: 420, keyId: "case_legend_42_prem", skinId: "skin_pass42_prem", dust: 142 };
      if (premium && free) premium.coins = 420; // premium 420 on 42 as spec
      // free on 42 already 142, premium extra 420
    }
    // premium track for other levels: if free coins exists, premium gives same coins extra? Spec says premium track opens VIP, rewards duplicate
    // fill premium coins for even premium levels except already defined
    if (!premium && ec > 0) {
      // premium doubles free coins on even levels? We'll give premium extra coins equal to free
      premium = { coins: ec };
    }
    // for level 21, premium already 420 overrides
    if (lv === 21 && premium) premium.coins = 420;
    // normalize: if free null and premium null => keep both null? but at least one null is okay; level with no rewards is possible (odd non-7)
    if (lv % 2 !== 0 && ![7,21,35].includes(lv)) {
      // odd without special -> free null, but premium may have null
      if (![7,14,21,28,35,42].includes(lv)) {
        free = null;
        if (premium && premium.coins) { /* keep premium coins only on even, so for odd non-special premium should be null */ }
        if (lv % 2 !== 0) premium = null;
      }
    }
    arr.push({ level: lv, free: free && Object.keys(free).length ? free : null, premium: premium && Object.keys(premium).length ? premium : null });
  }
  // fix premium for 42: should be 420 coins + case
  const last = arr[41]!;
  last.premium = { coins: 420, keyId: "case_legend_42_prem", skinId: "skin_pass42_prem" };
  // fix 21 premium
  arr[20]!.premium = { coins: 420, skinId: "skin_pass21_prem" };
  return arr;
})();

export function xpForLevel(level: number): number {
  const lv = Math.max(0, Math.min(MAX_LEVEL, Math.floor(level)));
  return lv * XP_PER_LEVEL;
}
export function levelFromXp(xp: number): number {
  const v = Math.max(0, Math.floor(xp));
  return Math.min(MAX_LEVEL, Math.floor(v / XP_PER_LEVEL));
}
export function xpProgressInLevel(xp: number): { level: number; xpIn: number; xpNeed: number; pct: number } {
  const lv = levelFromXp(xp);
  const xpIn = xp - lv * XP_PER_LEVEL;
  return { level: lv, xpIn, xpNeed: XP_PER_LEVEL, pct: (xpIn / XP_PER_LEVEL) * 100 };
}
export function getRewardForLevel(level: number): PassLevel | null {
  if (level < 1 || level > 42) return null;
  return PASS_REWARDS[level - 1] ?? null;
}
export function totalRewards(): number { return PASS_REWARDS.length; }

// Season helper
export type PassSeason = { id: string; starts_at: string; ends_at: string; rewards: PassLevel[] };
export function getCurrentSeason(): PassSeason {
  return { id: SEASON_ID, starts_at: SEASON_START_ISO, ends_at: SEASON_END_ISO, rewards: PASS_REWARDS };
}

// XP sources canonical
export const XP_SOURCE = {
  game: 10,
  duelWin: 42,
  ecoPoint: 20,
  miningPack: 5,
} as const;
export type XpSource = keyof typeof XP_SOURCE;
export function xpForSource(source: XpSource): number { return XP_SOURCE[source] ?? 0; }
