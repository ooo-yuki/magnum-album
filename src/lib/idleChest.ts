// idleChest.ts — Offline chest 42: "набежало 42 пока тебя не было" + streak x2/x3 + cap 8ч + ad x2
// Формула: offline_gain = min(elapsed, cap)*income, адаптация: сундук 42 dust.
// income = IDLE_CHEST_PER_HOUR dust/час, cap 8ч, base 42 + offlineBonus, * multiplier, ad x2.
// Стрик синхронно со SpinWheel: 3дн ×2, 7дн ×3.
import { getStreakMultiplier } from "./spinRewards";

export const IDLE_CHEST_BASE = 42 as const;
export const IDLE_CHEST_PER_HOUR = 5 as const;
export const IDLE_CHEST_CAP_HOURS = 8 as const;
export const IDLE_CHEST_COOLDOWN_MS = 20 * 3600 * 1000;
export const IDLE_CHEST_RESET_MS = 44 * 3600 * 1000;
export const IDLE_CHEST_CAP_MS = IDLE_CHEST_CAP_HOURS * 3600 * 1000;

export type IdleChestPreview = {
  offlineHours: number;
  offlineMs: number;
  cappedMs: number;
  offlineBonus: number;
  baseWithBonus: number;
  multiplier: 1 | 2 | 3;
  dust: number;
  dustDoubled: number;
};

export function calcOfflineBonus(elapsedMs: number): { offlineHours: number; offlineMs: number; cappedMs: number; offlineBonus: number } {
  const ms = Math.max(0, elapsedMs);
  const capped = Math.min(ms, IDLE_CHEST_CAP_MS);
  const hours = capped / 3600000;
  const bonus = Math.floor(hours * IDLE_CHEST_PER_HOUR);
  return { offlineHours: Math.floor(hours * 10) / 10, offlineMs: ms, cappedMs: capped, offlineBonus: bonus };
}

export function calcIdleReward(elapsedMs: number, streak: number): IdleChestPreview {
  const { offlineHours, offlineMs, cappedMs, offlineBonus } = calcOfflineBonus(elapsedMs);
  const baseWithBonus = IDLE_CHEST_BASE + offlineBonus;
  const multiplier = getStreakMultiplier(streak) as 1 | 2 | 3;
  const dust = baseWithBonus * multiplier;
  return { offlineHours, offlineMs, cappedMs, offlineBonus, baseWithBonus, multiplier, dust, dustDoubled: dust * 2 };
}

export function nextStreakForIdle(prevStreak: number, elapsedMsSinceLastClaim: number | null): number {
  if (elapsedMsSinceLastClaim == null) return 1;
  if (elapsedMsSinceLastClaim > IDLE_CHEST_RESET_MS) return 1;
  if (elapsedMsSinceLastClaim >= IDLE_CHEST_COOLDOWN_MS) return Math.min(20, prevStreak + 1);
  return prevStreak;
}

export function idleChestShareText(dust: number, streak: number, doubled: boolean): string {
  const mult = getStreakMultiplier(streak);
  const tag = doubled ? "x2 рекламой" : `×${mult}`;
  return `забрал ${dust} dust пока спал — сундук 42 ${tag} 🔥 пока тебя не было, набежало 42`;
}
