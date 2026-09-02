// crash42.ts — ШАХТА-КРАШ 42 — Crash-множитель на майнинге
// Provably fair: seed = hash раунда, crash 1.2-42, curve exp 6-12с, tick 10Hz
export const CRASH_STAKES = [42, 142, 420] as const;
export type CrashStake = typeof CRASH_STAKES[number];
export const CRASH_MIN = 1.2;
export const CRASH_MAX = 42;
export const CRASH_TICK_HZ = 10;

export function isValidStake(v: unknown): v is CrashStake {
  return v === 42 || v === 142 || v === 420;
}

export function crashFromSeed(seed: string): number {
  // deterministic 0..1 from seed hex prefix
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  // second hash mix
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  const r = (h >>> 0) / 0xffffffff; // 0..1
  // classic crash distribution: 0.97/(1-r) capped 1.2..42, skewed low
  const clampedR = Math.min(0.997, Math.max(0, r));
  let crash = 0.97 / (1 - clampedR);
  if (!Number.isFinite(crash)) crash = CRASH_MAX;
  crash = Math.max(CRASH_MIN, Math.min(CRASH_MAX, crash));
  // floor to 2 decimals for provably fair
  return Math.floor(crash * 100) / 100;
}

export function hashSeed(seed: string): string {
  // simple hex of djb2 for client display; server uses crypto.randomUUID as seed source
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0");
}

export function durationFromCrash(crashAt: number): number {
  // map log(1.2)->6s, log(42)->12s
  const lo = Math.log(CRASH_MIN);
  const hi = Math.log(CRASH_MAX);
  const v = Math.log(Math.max(CRASH_MIN, Math.min(CRASH_MAX, crashAt)));
  const t = (v - lo) / (hi - lo); // 0..1
  return 6 + t * 6; // 6..12
}

export function multiplierAt(elapsedMs: number, crashAt: number): number {
  const durSec = durationFromCrash(crashAt);
  const elapsedSec = Math.max(0, elapsedMs / 1000);
  if (elapsedSec >= durSec) return crashAt;
  const k = Math.log(crashAt) / durSec;
  const m = Math.exp(k * elapsedSec);
  return Math.min(m, crashAt);
}

export function formatMult(m: number): string {
  return `x${m.toFixed(2)}`;
}

export function payoutFor(stake: number, mult: number): number {
  const gross = Math.floor(stake * mult);
  return Math.min(gross, stake * 42);
}

export type CrashHistoryEntry = { id: number; crash_at: number; seed: string; created_at: string };
export type CrashCashoutLive = { username: string; stake: number; multiplier: number; payout: number; ts: number };

export const CRASH_WS_PATH = "/magnum/api/crash";
export const CRASH_STAKE_OPTIONS = CRASH_STAKES as readonly number[];
