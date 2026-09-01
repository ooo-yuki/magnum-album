export type TamagotchiStage = "egg" | "chick" | "bra" | "legend";
export type TamagotchiState = {
  hunger: number; // 0..100
  energy: number;
  stage: TamagotchiStage;
  bonus: number; // +1% per validated referral, cap 10
  fedToday: boolean;
  prestige: number;
};

export function getTamagotchiStage(streak: number, prestige: number): TamagotchiStage {
  if (streak >= 7) return "legend";
  if (prestige >= 3 || streak >= 3) return "bra";
  if (streak >= 1) return "chick";
  return "egg";
}
export function getTamagotchiState(opts: { streak: number; prestige: number; canClaim: boolean }): TamagotchiState {
  const { streak, prestige, canClaim } = opts;
  const stage = getTamagotchiStage(streak, prestige);
  const fedToday = !canClaim;
  const hunger = fedToday ? 28 : Math.min(100, 42 + (7 - Math.min(7, streak)) * 8);
  const energy = Math.min(100, 42 + streak * 8 + Math.min(10, prestige) * 4);
  const bonus = Math.min(10, prestige);
  return { hunger, energy, stage, bonus, fedToday, prestige };
}
export function tamagotchiEmoji(stage: TamagotchiStage): string {
  if (stage === "legend") return "🐉";
  if (stage === "bra") return "🐣🔥";
  if (stage === "chick") return "🐥";
  return "🥚";
}
