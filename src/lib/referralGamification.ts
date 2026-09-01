// Referral Earl 2026 — endowed progress + tier ladder + badges + streak
// Gives 2-4x lift per research

export const REFERRAL_TIERS = [
  { n: 1, label: "1 братуха", reward: 142, dust: 142, perk: "+142 dust обоим" },
  { n: 5, label: "5 братух", reward: 420, dust: 420, perk: "+420 dust" },
  { n: 10, label: "10 братух", reward: 1420, dust: 1420, perk: "VIP-сигнатур +1420" },
] as const;

export type ReferralBadgeId = "first_invite" | "viral_5" | "streak_3m";

export const REFERRAL_BADGES: Record<ReferralBadgeId, { title: string; desc: string; icon: string }> = {
  first_invite: { title: "Первый братуха", desc: "Пригласи 1 друга", icon: "🔥" },
  viral_5: { title: "Вирус", desc: "5 приглашений", icon: "⚡" },
  streak_3m: { title: "Братуха-на-замке", desc: "1/мес 3 месяца подряд", icon: "👑" },
};

export function endowedProgress(realCount: number): { display: number; total: number; pct: number; label: string } {
  // Referral Earl: pre-fill 1/5 so user sees progress not zero
  const display = realCount + 1;
  const total = 5;
  const pct = Math.min(100, Math.round((display / total) * 100));
  return { display, total, pct, label: `${display}/${total} до награды` };
}

export function nextTierInfo(count: number): { next: typeof REFERRAL_TIERS[number] | null; remain: number } {
  for (const t of REFERRAL_TIERS) if (count < t.n) return { next: t, remain: t.n - count };
  return { next: null, remain: 0 };
}

export function earnedBadges(count: number, streakMonths: number): ReferralBadgeId[] {
  const out: ReferralBadgeId[] = [];
  if (count >= 1) out.push("first_invite");
  if (count >= 5) out.push("viral_5");
  if (streakMonths >= 3) out.push("streak_3m");
  return out;
}

export function calcStreakMonths(monthKeys: string[]): number {
  // monthKeys like "2026-03", sorted desc; count consecutive from latest
  if (!monthKeys.length) return 0;
  const sorted = [...monthKeys].sort().reverse();
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const [y, m] = sorted[i - 1]!.split("-").map(Number);
    const [py, pm] = sorted[i]!.split("-").map(Number);
    const prev = new Date(y!, m! - 2, 1); // one month before sorted[i-1]
    if (py === prev.getFullYear() && pm === prev.getMonth() + 1) streak++;
    else break;
  }
  return streak;
}

export function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
