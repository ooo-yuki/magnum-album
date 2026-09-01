// scratch42.ts — daily Scratch artefact 42
// 1/day free swipe opens variable 42/142/420/1420 dust, x2 if via referral, pity+1 sync, gift + OG 1080
export type ScratchReward = 42 | 142 | 420 | 1420;
const REWARDS: ScratchReward[] = [42, 42, 42, 42, 42, 42, 42, 142, 142, 1420];
export function pickScratchReward(rnd: number = Math.random()): ScratchReward {
  const idx = Math.floor(rnd * REWARDS.length);
  return REWARDS[Math.min(idx, REWARDS.length - 1)]!;
}
export function scratchDayKey(d = new Date()): string { return d.toISOString().slice(0,10); }
export function scratchOgUrl(username: string, day: string, v: number, from?: string): string {
  const q = new URLSearchParams({ u: username, d: day, v: String(v) });
  if (from) q.set("from", from);
  return `/magnum/api/scratch/og?${q.toString()}`;
}
