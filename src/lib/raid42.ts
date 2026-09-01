// raid42.ts — БОСС-РЕЙД 42 — глобальный клик-босс 42с + HP 42K + топ урона
export const RAID_HP = 42000;
export const RAID_HP_MAX = 42000;
export const DURATION = 42;
export const DURATION_SEC = 42;
export const RAID_INTERVAL_MIN = 15;
export const RAID_INTERVAL_MS = 15 * 60 * 1000;
export const CRIT_CHANCE = 0.05;
export const CRIT_MULT = 2;
export const CPS_SUSPECT = 20;
export const CPS_THROTTLE = 30;
export const HEARTBEAT_MS = 25_000;
export const BOOST_PRICE = 42;
export const BOOST_MULT = 2;
export const CONFETTI_COUNT = 140;

export const REWARDS = {
  participation: 42,
  top10: 142,
  top3: 420,
  mvp: 1420,
} as const;
export const REWARD_TITLE = "Крушитель 42";

export function rollDamage(boostActive = false): { dmg: number; crit: boolean; raw: number } {
  const raw = Math.floor(Math.random() * 42) + 1;
  const crit = Math.random() < CRIT_CHANCE;
  let dmg = crit ? raw * CRIT_MULT : raw;
  if (boostActive) dmg *= BOOST_MULT;
  return { dmg, crit, raw };
}

export function rewardForRank(rank: number, totalParticipants: number): number {
  if (rank === 1) return REWARDS.mvp;
  if (rank <= 3) return REWARDS.top3;
  if (rank <= 10) return REWARDS.top10;
  if (rank >= 1 && rank <= totalParticipants) return REWARDS.participation;
  return 0;
}

export function raidStatusFromTimes(startsAt: number, endsAt: number, now = Date.now()): "waiting" | "active" | "finished" {
  if (now < startsAt) return "waiting";
  if (now >= startsAt && now < endsAt) return "active";
  return "finished";
}

// next 15-min slot aligned to unix epoch
export function nextRaidStart(now = Date.now()): number {
  const iv = RAID_INTERVAL_MS;
  return Math.ceil(now / iv) * iv;
}
export function raidWindowFor(now = Date.now()): { startsAt: number; endsAt: number; status: "waiting" | "active" | "finished" } {
  const s = nextRaidStart(now - DURATION_SEC * 1000);
  // if the last window still active (starts within 42s ago), treat it as active
  const activeStart = Math.floor(now / RAID_INTERVAL_MS) * RAID_INTERVAL_MS;
  // we want raids every 15m starting exactly on slot; if now within slot..slot+42 active
  const slotStart = Math.floor(now / RAID_INTERVAL_MS) * RAID_INTERVAL_MS;
  const slotEnd = slotStart + DURATION_SEC * 1000;
  if (now >= slotStart && now < slotEnd) return { startsAt: slotStart, endsAt: slotEnd, status: "active" };
  const ns = nextRaidStart(now);
  return { startsAt: ns, endsAt: ns + DURATION_SEC * 1000, status: "waiting" };
}

export type RaidBoss = { id: number; hp_max: number; hp_cur: number; starts_at: string; ends_at: string; status: string };
export type RaidTop = { userId: number; username: string; dmg: number; rank: number };
