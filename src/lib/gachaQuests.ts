// gachaQuests.ts — GACHA QUESTS 42 — daily/weekly + comeback
// Daily (reset 00:00 UTC): 3 duels / 5 wins / 30 mining clicks → 1 roll standard each
// Weekly (Mon 00:00 UTC, weekId YYYY-WW): 7d streak daily (>=1 daily/day ×7) → 3 rolls event (MAGMA FROST)
// Comeback: offline >=7d → 10 rolls +42 coins, 1×/7d

export type QuestDef = { id: string; title: string; desc: string; target: number; reward: number; banner: "standard"|"event"; icon: string };

export const QUEST_DEFS: QuestDef[] = [
  { id: "daily_duel3", title: "Дуэли 42", desc: "Сыграй 3 дуэли (WS 2-4 любой исход)", target: 3, reward: 1, banner: "standard", icon: "⚔️" },
  { id: "daily_win5", title: "Победы 42", desc: "Выиграй 5 игр (любые из 16 + конвейер/майнинг)", target: 5, reward: 1, banner: "standard", icon: "🎮" },
  { id: "daily_mining30", title: "Майнинг 42", desc: "30 майнинг-кликов пачкой", target: 30, reward: 1, banner: "standard", icon: "⛏️" },
];

export const WEEKLY_DEF: QuestDef = { id: "weekly_streak7", title: "Стрик 7д", desc: "7д стрик daily (≥1 daily/день ×7) → 3 крутки MAGMA FROST", target: 7, reward: 3, banner: "event", icon: "🔥" };
export const WEEKLY_QUEST_ID = WEEKLY_DEF.id;
export const COMEBACK_REWARD_ROLLS = 10;
export const COMEBACK_COINS = 42;

export function dayId(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}
export function weekId(d = new Date()): string {
  // ISO week YYYY-WW (Mon 00:00 UTC)
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
export function weekStart(d = new Date()): Date {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() - (day - 1));
  dt.setUTCHours(0,0,0,0);
  return dt;
}
export function eligibleComeback(lastActivity: Date | null, now = new Date()): { eligible: boolean; days: number } {
  if (!lastActivity) return { eligible: true, days: 999 };
  const diff = (now.getTime() - lastActivity.getTime()) / 86400000;
  return { eligible: diff >= 7, days: Math.floor(diff) };
}

export function progressPct(progress: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, (progress / target) * 100));
}
