// chain42.ts — ЦЕПЬ 42 — челлендж-цепочка 42ч + лента топ-цепей + OG 1080x1920
export const CHAIN_RULES = {
  TTL_HOURS: 42,
  TTL_MS: 42 * 3600 * 1000,
  REWARD_CREATE: 0,
  REWARD_JOIN: 42,
  SHARE_REWARD: 42,
  MULT_PER_LINK: 1.05,
  MULT_CAP: 2.0,
  TOP1: 1420,
  TOP2_3: 420,
  ONE_LINK_PER_HOUR_MS: 3600 * 1000,
  ONE_JOIN_PER_DAY_MS: 24 * 3600 * 1000,
  IP_RATE_LIMIT: 5,
  IP_WINDOW_MS: 60_000,
  CODE_LEN: 4,
  CONF_CODE_ALPHABET: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
} as const;

export type LinkTypeId = "click-10s" | "quiz-1q" | "mem-like";

export type LinkType = {
  id: LinkTypeId;
  title: string;
  shortTitle: string;
  desc: string;
  icon: string;
  durationSec: number;
  target: number;
};

export const LINK_TYPES: LinkType[] = [
  { id: "click-10s", title: "Клик-шторм 10с", shortTitle: "КЛИК-10С", desc: "Накликай 42 за 10 секунд — докажи что живой", icon: "⚡", durationSec: 10, target: 42 },
  { id: "quiz-1q", title: "Квиз 1 вопрос", shortTitle: "КВИЗ", desc: "Ответь верно на 1 вопрос про MAGNUM/42", icon: "🧠", durationSec: 42, target: 1 },
  { id: "mem-like", title: "Мем-лайк", shortTitle: "ПАМЯТЬ", desc: "Повтори последовательность 4 цвета — мем-память", icon: "💜", durationSec: 20, target: 4 },
];

export function isLinkType(v: unknown): v is LinkTypeId {
  return typeof v === "string" && (LINK_TYPES as readonly LinkType[]).some((t) => t.id === v);
}

export function chainMult(length: number): number {
  if (length <= 1) return 1;
  const raw = 1 + (length - 1) * (CHAIN_RULES.MULT_PER_LINK - 1);
  return Math.min(CHAIN_RULES.MULT_CAP, Number(raw.toFixed(3)));
}

export function genChainCode(): string {
  const a = CHAIN_RULES.CONF_CODE_ALPHABET;
  let s = "";
  for (let i = 0; i < CHAIN_RULES.CODE_LEN; i++) s += a[Math.floor(Math.random() * a.length)]!;
  return s;
}

export function normalizeCode(raw: string): string | null {
  const c = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CHAIN_RULES.CODE_LEN);
  return c.length === CHAIN_RULES.CODE_LEN ? c : null;
}

export function chainExpiresAt(from = Date.now()): string {
  return new Date(from + CHAIN_RULES.TTL_MS).toISOString();
}

export function msToChainClock(ms: number): { h: number; m: number; s: number; broken: boolean } {
  if (ms <= 0) return { h: 0, m: 0, s: 0, broken: true };
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return { h, m, s: sec, broken: false };
}

export function formatChainClock(ms: number): string {
  const { h, m, s, broken } = msToChainClock(ms);
  if (broken) return "00:00:00 • ОБРЫВ";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export type ChainRow = {
  id: number;
  root_user_id: number;
  root_username?: string;
  code: string;
  length: number;
  created_at: string;
  expires_at: string;
  broken: boolean;
  crown?: boolean;
};

export type ChainLinkRow = {
  id: number;
  chain_id: number;
  user_id: number;
  username?: string;
  joined_at: string;
  challenge_type: LinkTypeId;
};

export type ChainFeedItem = ChainRow & { mult: number; username: string; remainMs: number };
