// DUEL KOMBO 42 — WS-арена 2-4 + код ABCD + kombo x4 +25%
// Используется клиентом (MiningPage/DuelLobbyPage) и частично сервером (константы wager).

export const WAGER_OPTIONS = [0, 42, 142, 420] as const;
export type Wager = typeof WAGER_OPTIONS[number];

export const DUEL_DURATION_SEC = 10;
export const HEARTBEAT_MS = 25_000;
export const CPS_SUSPECT = 20; // CPS>20 → suspect flag + ghost
export const CPS_THROTTLE = 30; // throttle 30/сек server wsRateOk
export const ELO_WIN = 42;
export const ELO_LOSE = -12;
export const ELO_SEASON = "duel42";
export const TOP3_BONUS = 1420; // сезон crown топ-3

// KOMBO 42 — x4 <0.4с +25% damage
export const KOMBO_WINDOW_MS = 400;
export const KOMBO_NEED = 4;
export const KOMBO_MULT = 1.25;
export const CONFETTI_COUNT = 160;
export const COMBO_BURST_EASE = "back.out(1.7)";

export type DuelLobbyState = "waiting" | "playing" | "finished";

export type DuelPlayer = {
  name: string;
  score: number;
  ready?: boolean;
  suspect?: boolean;
  cps?: number;
  kombo?: number;
  combo?: number;
  nitro?: number;
  volcano?: number;
  magma?: number;
};

export type DuelRoomPublic = {
  id: string;
  state: DuelLobbyState;
  players: DuelPlayer[];
  durationSec: number;
  wager: number;
  code?: string; // ABCD для room:ABCD
};

export function isWager(v: unknown): v is Wager {
  return (WAGER_OPTIONS as readonly number[]).includes(Number(v));
}

export function validateWager(v: unknown): Wager {
  const n = Number(v);
  if ((WAGER_OPTIONS as readonly number[]).includes(n)) return n as Wager;
  return 0;
}

// ABCD — 4 символа из A-Z2-9 без O0/1I для читаемости
const ABCD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function genABCD(): string {
  let s = "";
  for (let i = 0; i < 4; i++) s += ABCD_ALPHABET[Math.floor(Math.random() * ABCD_ALPHABET.length)]!;
  return s;
}
export function normalizeCode(raw: string): string | null {
  const c = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  return c.length === 4 ? c : null;
}
export function roomIdForCode(code: string): string {
  return `room:${code.toUpperCase()}`;
}
export function codeFromRoomId(roomId: string): string | null {
  if (roomId.startsWith("room:")) {
    const c = roomId.slice(5);
    return c.length === 4 ? c : null;
  }
  return null;
}

// ELO + wager settlement helpers
export function settleReward(wager: Wager, isWin: boolean, isDraw: boolean): { coins: number; elo: number } {
  if (isDraw) return { coins: wager, elo: 0 };
  if (isWin) return { coins: wager * 2, elo: ELO_WIN };
  return { coins: 0, elo: ELO_LOSE };
}

// CPS detect
export function isSuspectCps(cpsLastSec: number, cps10s: number): boolean {
  return cpsLastSec > CPS_SUSPECT || cps10s > 165;
}

// kombo helper — pure
export function nextKombo(prev: number, dtMs: number): { kombo: number; burst: boolean } {
  let k = dtMs < KOMBO_WINDOW_MS ? Math.min(KOMBO_NEED, prev + 1) : 1;
  if (k >= KOMBO_NEED) return { kombo: 0, burst: true };
  return { kombo: k, burst: false };
}
export function komboMult(burst: boolean): number {
  return burst ? KOMBO_MULT : 1;
}
export function isKomboBurst(k: number): boolean {
  return k === 0; // after reset 0 means just bursted; caller should track burst flag directly
}

// confetti helper (160 canvas divs) — pure, caller inserts into DOM
export function confettiColors(i: number): string {
  return i % 3 === 0 ? "#ff2d55" : i % 3 === 1 ? "#00ff88" : "#ffd42a";
}
export const CONFETTI_COLORS = ["#ff2d55", "#00ff88", "#ffd42a"] as const;

// протокол WS lobby: server→client
export type LobbyMsg =
  | { type: "lobby:created"; code: string; room: DuelRoomPublic; wager: number }
  | { type: "room"; room: DuelRoomPublic; you?: string; yourId?: string }
  | { type: "ready"; from: string; ready: boolean; room: DuelRoomPublic }
  | { type: "start"; room: DuelRoomPublic; duration: number }
  | { type: "tick"; from: string; nitro: number; magma: number; volcano: number; kombo: number; combo: number; score: number; komboBurst?: boolean; comboBurst?: boolean; ghostTrail?: boolean; overheat?: boolean; eruption?: boolean; lavaSpike?: boolean }
  | { type: "suspect"; from: string; cps?: number; ghost?: boolean; toast?: string }
  | { type: "overheat"; from: string; ghost?: boolean }
  | { type: "finish"; room: DuelRoomPublic }
  | { type: "scores"; room: DuelRoomPublic }
  | { type: "wager"; from: string; wager: number }
  | { type: "ping" }
  | { type: "pong" };
