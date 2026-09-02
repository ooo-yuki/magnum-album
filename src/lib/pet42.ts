export const PET_STAGES = ["яйцо", "личинка", "медуза", "титан"] as const;
export type PetStage = 0 | 1 | 2 | 3;
export const PET_STAGE_EMOJI: Record<number, string> = { 0: "🥚", 1: "🐛", 2: "🪼", 3: "🐉" };
export const PET_XP_THRESHOLDS = [0, 142, 420, 1420] as const; // stage 0..3 min XP
export const PET_STAGE_XP = [142, 420, 1420] as const; // evolve at these

export const PET_FEED_COST = 42;
export const PET_FEED_HUNGER = 20;
export const PET_FEED_XP = 42;

export const PET_PLAY_HAPPINESS = 15;
export const PET_PLAY_XP = 24;
export const PET_PLAY_COOLDOWN_MS = 30 * 60 * 1000; // 30m

export const PET_SLEEP_ENERGY = 30;
export const PET_SLEEP_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4h

export const PET_TICK_PER_HOUR = 1; // -1 per hour offline
export const PET_TICK_CAP_HOURS = 24;

export const PET_DAILY_REWARD = 42;
export const PET_CASE_MIN = 42;
export const PET_CASE_MAX = 142;
export const PET_CASE_EPIC_CHANCE = 0.05; // 5% epic flag

export const PET_PRESTIGE_DUST = 1420;
export const PET_PRESTIGE_SKIN = "pet-titan-gold";

export function petStageFromXp(xp: number): PetStage {
  if (xp >= 1420) return 3;
  if (xp >= 420) return 2;
  if (xp >= 142) return 1;
  return 0;
}
export function petMiningBonusPct(stage: number): number {
  // each stage +5% to mining income — stage0 0%, s1 5%, s2 10%, s3 15%
  return Math.max(0, Math.min(3, stage)) * 5;
}
export function petConveyorBonusPct(stage: number): number {
  // spec buffs: s2 +5% mining, s3 +10% conveyor, s4 +15% + case
  // conveyor bonus only from s3 (stage 2) =10%, s4=15%
  if (stage >= 3) return 15;
  if (stage >= 2) return 10;
  return 0;
}
export function petBuffLabel(stage: number): string {
  const m = petMiningBonusPct(stage);
  const c = petConveyorBonusPct(stage);
  if (stage >= 3) return `+${m}% mining · +${c}% conveyor · кейс/день`;
  if (stage >= 2) return `+${petMiningBonusPct(stage)}% mining · +${c}% conveyor`;
  if (stage >= 1) return `+${m}% mining`;
  return "— пока яйцо, расти!";
}
