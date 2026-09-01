// meme42.ts — МЕМ-КУЗНИЦА 42 — 8 шаблонов MAGNUM (42/батюх/Кузбасс/майнинг) + canvas 1080х1080
export type MemeTemplate = {
  id: string;
  name: string;
  label: string;
  emoji: string;
  bg: string; // css gradient
  accent: string;
  hint: string;
};

export const TEMPLATES: MemeTemplate[] = [
  { id: "42-magnum", name: "MAGNUM 42", label: "MAGNUM", emoji: "🔥", bg: "linear-gradient(135deg,#ff2d55,#8a162c 45%,#1a1a1a 100%)", accent: "#ff2d55", hint: "МАГНУМ — 5 пуль" },
  { id: "42-bro", name: "БРАТУХА 42", label: "БРАТУХА", emoji: "🧢", bg: "linear-gradient(135deg,#5865f2,#0a0a0a 55%,#ff2d55 100%)", accent: "#5865f2", hint: "Где б я ни был — 42" },
  { id: "42-kuzbass", name: "КУЗБАСС 42", label: "КУЗБАСС", emoji: "🏭", bg: "linear-gradient(135deg,#ff8a00,#1a0a0a 50%,#00ff88 100%)", accent: "#ff8a00", hint: "КЕМЕРОВО — УГОЛЬ 42" },
  { id: "42-mining", name: "МАЙНИНГ 42", label: "МАЙНИНГ", emoji: "⛏️", bg: "linear-gradient(135deg,#00ff88,#00331a 45%,#ffcc00 100%)", accent: "#00ff88", hint: "КЛИКАЙ 42 — ДОБЫВАЙ" },
  { id: "42-meduza", name: "МЕДУЗА 42", label: "МЕДУЗА", emoji: "🪼", bg: "linear-gradient(135deg,#ff44cc,#00ffcc 55%,#0a0a1a 100%)", accent: "#ff44cc", hint: "ТУСА МЕДУЗА 42" },
  { id: "42-vpn", name: "VPN 42", label: "VPN", emoji: "🧠", bg: "linear-gradient(135deg,#0a1a2a,#00ffcc 50%,#9147ff 100%)", accent: "#00ffcc", hint: "VPN — 86 BPM" },
  { id: "42-clay", name: "CLAY 42", label: "CLAY", emoji: "🪨", bg: "linear-gradient(135deg,#8a3c00,#ffd76a 55%,#ff2d55 100%)", accent: "#8a3c00", hint: "CLAY — 73 BPM" },
  { id: "42-neon", name: "НЕОН 42", label: "НЕОН", emoji: "🌃", bg: "linear-gradient(135deg,#9147ff,#ff2d55 45%,#ffcc00 90%)", accent: "#9147ff", hint: "НЕОН-КУЗБАСС 2142" },
];

export const MEME_FONTS = [
  { id: "impact", label: "IMPACT", family: "Impact, Anton, Haettenschweiler, sans-serif", stroke: 8 },
  { id: "42-bold", label: "42 BOLD", family: "Inter, system-ui, sans-serif", weight: "900" as const, stroke: 6 },
] as const;

export type MemeFontId = typeof MEME_FONTS[number]["id"];

export function isValidTemplate(id: string): boolean {
  return TEMPLATES.some(t => t.id === id);
}

export function validateMemeText(v: string): string | null {
  const t = v.trim();
  if (t.length === 0) return null; // empty allowed
  if (t.length > 40) return "макс 40 символов";
  if (/<script|javascript:/i.test(t)) return "без скриптов";
  return null;
}

export function validateTemplateId(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0,64);
  if (!s || s.length < 2) return null;
  if (!/^[a-z0-9-]{2,64}$/.test(s)) return null;
  if (!isValidTemplate(s)) return null;
  return s;
}
