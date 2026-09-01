// duelMagma.ts — magma x10, lava-spike 2x, overheat, ELO, wager, suspect, season
export const MAGMA_CAP = 10;
export const MAGMA_INTERVAL_MS = 150;
export const LAVA_SPIKE_MULT = 2;
export const OVERHEAT_HOLD_MS = 3500;
export const OVERHEAT_COOLDOWN_MS = 1200;
export const OVERHEAT_PENALTY = 0.4;
export const WAGERS = [0, 42, 142, 420] as const;
export type Wager = typeof WAGERS[number];
export const DURATION_SEC = 10;
export const ELO_WIN = 42;
export const ELO_LOSE = -12;
export const HEARTBEAT_MS = 25_000;

export function isValidWager(v: unknown): Wager | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if ((WAGERS as readonly number[]).includes(n)) return n as Wager;
  return null;
}
export function calcMagma(prevMagma: number, dtMs: number): number {
  if (dtMs < MAGMA_INTERVAL_MS) return Math.min(MAGMA_CAP, prevMagma + 1);
  return 1;
}
export function magmaScoreMult(magma: number): number {
  if (magma <= 1) return 1;
  const v = 1 + (magma - 1) * 1.0;
  return Math.min(10, v);
}
export function shouldLavaSpike(magma: number): boolean {
  return magma >= MAGMA_CAP;
}
export function shouldOverheat(heldAtMaxMs: number): boolean {
  return heldAtMaxMs >= OVERHEAT_HOLD_MS;
}
export function eloDelta(isWin: boolean, isDraw: boolean): number {
  if (isDraw) return 0;
  return isWin ? ELO_WIN : ELO_LOSE;
}
export function isSuspect(cps: number, total10s: number): boolean {
  return cps > 20 || total10s > 160;
}
export function wagerPayout(wager: Wager, isWin: boolean, isDraw: boolean): number {
  if (wager === 0) return 0;
  if (isDraw) return wager; // возврат ставки
  if (isWin) return wager * 2;
  return 0;
}
export function ghostWidth(magma: number): string {
  return `${Math.min(100, (magma / MAGMA_CAP) * 100)}%`;
}
export function magmaBarWidth(magma: number): string {
  return `${Math.min(100, (magma / MAGMA_CAP) * 100)}%`;
}
// season 7d helper
export function seasonStartIso(): string {
  return new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
}
export type MagmaTick = { magma: number; score: number; lavaSpike: boolean; overheat: boolean };
export function nextTick(prev: { magma: number; lastClickAt: number; heldMaxSince: number | null; score: number }, nowMs: number): MagmaTick & { heldMaxSince: number | null; score: number; magma: number } {
  const dt = nowMs - prev.lastClickAt;
  const magma = calcMagma(prev.magma, dt);
  const lavaSpike = shouldLavaSpike(magma);
  const mult = magmaScoreMult(magma);
  let add = 1 * mult;
  if (lavaSpike) add *= LAVA_SPIKE_MULT;
  // overheat check
  let held = prev.heldMaxSince;
  if (magma >= MAGMA_CAP) {
    if (held === null) held = nowMs;
  } else held = null;
  const heldMs = held !== null ? nowMs - held : 0;
  const overheat = shouldOverheat(heldMs);
  let newScore = prev.score + add;
  if (overheat) newScore = newScore * OVERHEAT_PENALTY;
  return { magma, score: newScore, lavaSpike, overheat, heldMaxSince: overheat ? null : held, lastClickAt: nowMs } as unknown as ReturnType<typeof nextTick>;
}
