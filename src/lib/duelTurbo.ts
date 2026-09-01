// duelTurbo.ts — TURBO 42 — x8 <0.2с +10% капа x8 ghost trail
export const TURBO_CAP = 8;
export const TURBO_INTERVAL_MS = 200;
export const TURBO_STEP = 0.10;
export const WAGERS = [0, 42, 142, 420] as const;
export type Wager = typeof WAGERS[number];
export const DURATION_SEC = 10;
export const ELO_WIN = 42;
export const ELO_LOSE = -12;
export const HEARTBEAT_MS = 25_000;
export const CPS_SUSPECT = 20;
export const CPS_THROTTLE = 30;
export const CONFETTI_COUNT = 160;
export const GHOST_PULSE_MS = 900;

export function isValidWager(v: unknown): Wager | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if ((WAGERS as readonly number[]).includes(n)) return n as Wager;
  return null;
}
export function calcTurbo(prevTurbo: number, dtMs: number): number {
  if (dtMs < TURBO_INTERVAL_MS) return Math.min(TURBO_CAP, prevTurbo + 1);
  return 1;
}
export function turboScoreMult(turbo: number): number {
  if (turbo <= 1) return 1;
  const v = 1 + (turbo - 1) * TURBO_STEP;
  return Math.min(1.7, v);
}
export function shouldGhostTrail(turbo: number, suspect: boolean): boolean {
  return turbo >= 5 || suspect;
}
export function isSuspect(cps: number, total10s: number): boolean {
  return cps > CPS_SUSPECT || total10s > 165;
}
export function wagerPayout(wager: Wager, isWin: boolean, isDraw: boolean): number {
  if (wager === 0) return 0;
  if (isDraw) return wager;
  if (isWin) return wager * 2;
  return 0;
}
export function ghostWidth(turbo: number): string {
  return `${Math.min(100, (turbo / TURBO_CAP) * 100)}%`;
}
export type DuelRecord = {
  id: string;
  date: string;
  wager: number;
  winner: string | null;
  scores: Array<{name:string;score:number}>;
  durationSec: number;
};
const LIMIT = 20;
let mem: DuelRecord[] = [];
export function getHistory(): DuelRecord[] { return mem.slice(0, LIMIT); }
export function pushDuel(r: DuelRecord){ mem.unshift(r); mem = mem.slice(0, LIMIT); }
