// studio42.ts — канон СТУДИИ 42: BPM треков + пресеты визуализатора + типы сцен

export type StudioTrackSlug = "clay" | "vpn" | "nova" | "magnum";
export type StudioPresetId = "meduza-wave" | "neon-kuzbass" | "glitch-42";

export const STUDIO_BPM: Record<StudioTrackSlug, number> = {
  clay: 73,
  vpn: 86,
  nova: 80,
  magnum: 142,
};

// alias required by task spec: BPM экспортируется как STUDIO_BPM + BPM compat
export const BPM = STUDIO_BPM;

export type StudioTrack = {
  slug: StudioTrackSlug;
  title: string;
  bpm: number;
  color: string;
  subtitle: string;
};

export const STUDIO_TRACKS: StudioTrack[] = [
  { slug: "clay", title: "CLAY", subtitle: "73 BPM • 5opka solo", bpm: 73, color: "#ff2d55" },
  { slug: "vpn", title: "VPN", subtitle: "86 BPM • feat. MellSher", bpm: 86, color: "#00ffcc" },
  { slug: "nova", title: "NOVA", subtitle: "80 BPM • SUPER PUPER NOVA", bpm: 80, color: "#ffcc00" },
  { slug: "magnum", title: "MAGNUM", subtitle: "142 BPM • 5 треков — 5 пуль", bpm: 142, color: "#9147ff" },
];

export type StudioPreset = {
  id: StudioPresetId;
  name: string;
  desc: string;
  barColor: string;
  particleColor: string;
  bg: string;
};

export const STUDIO_PRESETS: StudioPreset[] = [
  { id: "meduza-wave", name: "Медуза-вейв", desc: "плавные волны • медуза 42", barColor: "#00ffcc", particleColor: "#7dd8ff", bg: "linear-gradient(180deg,#0a1a2a,#102030)" },
  { id: "neon-kuzbass", name: "Неон-Кузбасс", desc: "кузбасс-неон • уголь 42", barColor: "#ffcc00", particleColor: "#ff8a65", bg: "linear-gradient(180deg,#1a0a00,#2b1a0a)" },
  { id: "glitch-42", name: "Глитч-42", desc: "глифт-хроматик • 42 глитча", barColor: "#ff2d55", particleColor: "#ff44cc", bg: "linear-gradient(180deg,#1a0a1f,#0a0a1a)" },
];

export const PRESETS = STUDIO_PRESETS;
export const PRESET_IDS = STUDIO_PRESETS.map(p => p.id) as readonly StudioPresetId[];

export function isStudioTrackSlug(v: string): v is StudioTrackSlug {
  return (["clay","vpn","nova","magnum"] as const).includes(v as StudioTrackSlug);
}
export function isStudioPresetId(v: string): v is StudioPresetId {
  return (["meduza-wave","neon-kuzbass","glitch-42"] as const).includes(v as StudioPresetId);
}

export function getBpmForTrack(slug: string): number {
  return STUDIO_BPM[slug as StudioTrackSlug] ?? 80;
}

// — сцены клипа: 4 слота cover/text/glitch/final
export type StudioScene = {
  bg: string;
  text: string;
  filter: string;
};

export const STUDIO_SCENE_DEFAULTS: StudioScene[] = [
  { bg: "linear-gradient(135deg,#ff2d55,#ffcc00)", text: "MAGNUM 42", filter: "none" },
  { bg: "linear-gradient(135deg,#00ffcc,#9147ff)", text: "БРАТУХИ 42", filter: "contrast(1.2)" },
  { bg: "linear-gradient(135deg,#5865f2,#00ff88)", text: "ТУСА МЕДУЗА", filter: "hue-rotate(42deg)" },
  { bg: "linear-gradient(135deg,#0a0a0a,#ff2d55)", text: "5OPKA × MELLSHER", filter: "brightness(1.1)" },
];

export const STUDIO_BG_OPTIONS = [
  "linear-gradient(135deg,#ff2d55,#ffcc00)",
  "linear-gradient(135deg,#00ffcc,#9147ff)",
  "linear-gradient(135deg,#0a0a0a,#ff2d55)",
  "linear-gradient(135deg,#5865f2,#00ff88)",
  "linear-gradient(135deg,#1a1a1a,#ff5722)",
  "linear-gradient(135deg,#0a1a2a,#00ffcc)",
  "linear-gradient(135deg,#ff44cc,#00ff88)",
  "linear-gradient(135deg,#1a0a00,#ffcc00)",
] as const;

export const STUDIO_FILTER_OPTIONS = ["none","contrast(1.3)","hue-rotate(42deg)","grayscale(0.5)","brightness(1.2) saturate(1.4)","blur(1px)"] as const;

export function validateScenes(v: unknown): StudioScene[] | null {
  if (!Array.isArray(v) || v.length !== 4) return null;
  const out: StudioScene[] = [];
  for (const s of v) {
    if (!s || typeof s !== "object") return null;
    const o = s as Record<string,unknown>;
    const bg = typeof o.bg === "string" ? o.bg.trim().slice(0,300) : "";
    const text = typeof o.text === "string" ? o.text.trim().slice(0,64) : "";
    const filter = typeof o.filter === "string" ? o.filter.trim().slice(0,64) : "none";
    if (!bg || !text) return null;
    out.push({ bg, text, filter: filter || "none" });
  }
  return out;
}
