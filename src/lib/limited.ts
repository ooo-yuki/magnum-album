// LIMITED DROP 42 — 6 лимиток / 72ч тираж 42 — hype-queue #3 §7.14
export const LIMITED_DROP_ID = "magnum-limited-042";
export const LIMITED_SUPPLY = 42;
export const LIMITED_DURATION_MS = 72 * 3600 * 1000;

export type LimitedRarity = "uncommon" | "rare" | "epic";
export type LimitedSkin = {
  id: string;
  name: string;
  emoji: string;
  rarity: LimitedRarity;
  price: number;
  bg: string;
  tagline: string;
};

export const LIMITED_CATALOG: LimitedSkin[] = [
  { id: "meduza-gold-42", name: "Медуза Gold", emoji: "🪼", rarity: "epic", price: 1420, bg: "conic-gradient(from 0deg,#ffd700,#ff8c00,#ffd700)", tagline: "conic-gold spin 3s · лимитка 42" },
  { id: "tusa-8k-holo", name: "Туса Holo 8K", emoji: "🎬", rarity: "rare", price: 420, bg: "linear-gradient(135deg,#00ccff,#ff2d55)", tagline: "8K клипов · голограмма" },
  { id: "vpn-neon-42", name: "VPN Neon", emoji: "📡", rarity: "rare", price: 420, bg: "linear-gradient(135deg,#ff2d55,#5865f2)", tagline: "VPN 28.04 · неон" },
  { id: "clay-73-brown", name: "CLAY 73", emoji: "🧱", rarity: "uncommon", price: 142, bg: "linear-gradient(135deg,#8b4513,#ffcc00)", tagline: "РЗТ 73 · глина Кузбасса" },
  { id: "nova-80-purple", name: "Nova 80", emoji: "💜", rarity: "rare", price: 420, bg: "conic-gradient(from 180deg,#9b59b6,#ff2d55)", tagline: "РЗТ 80 · фиолет" },
  { id: "fence-42-black", name: "The Fence 42", emoji: "🏴", rarity: "epic", price: 1420, bg: "linear-gradient(135deg,#111,#444)", tagline: "Забор 42 · андеграунд" },
];

export const LIMITED_IDS = new Set(LIMITED_CATALOG.map(s => s.id));
export function isLimitedId(id: string): boolean { return LIMITED_IDS.has(id); }
export function getLimitedPrice(id: string): number | null { return LIMITED_CATALOG.find(s => s.id === id)?.price ?? null; }

export type LimitedDropState = {
  dropId: string;
  endsAt: string; // ISO
  items: { id: string; left: number; price: number }[];
};

export function defaultEndsAt(): string {
  return new Date(Date.now() + LIMITED_DURATION_MS).toISOString();
}
export function timeLeft(endsAt: string): { ms: number; h: number; m: number; s: number; ended: boolean } {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return { ms: 0, h: 0, m: 0, s: 0, ended: true };
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return { ms, h, m, s, ended: false };
}
export function formatFomo(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
export const LS_KEY = "magnum-limited";
export function loadLimitedLS(): LimitedDropState | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as LimitedDropState;
    if (!v || typeof v.dropId !== "string" || typeof v.endsAt !== "string" || !Array.isArray(v.items)) return null;
    return v;
  } catch { return null; }
}
export function saveLimitedLS(s: LimitedDropState): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {}
}
export function makeDefaultState(): LimitedDropState {
  return {
    dropId: LIMITED_DROP_ID,
    endsAt: defaultEndsAt(),
    items: LIMITED_CATALOG.map(s => ({ id: s.id, left: LIMITED_SUPPLY, price: s.price })),
  };
}
