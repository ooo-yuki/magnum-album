// radio42 — РАДИО 42 эфир MAGNUM 24/7 — единый источник клиенты+сервер
// 5 треков loop crossfade 2s, heartbeat 30s +42/5мин 1ч кд, стрик 7д +420, шаринг OG 1080

export type RadioTrackSlug = "vpn" | "42" | "clay" | "nova" | "tusa";
export type RadioTrack = {
  slug: RadioTrackSlug;
  title: string;
  subtitle: string;
  cover: string;
  color: string;
  bpm: number;
  durationSec: number;
  audio: string;
};

export const RADIO_TRACKS: RadioTrack[] = [
  { slug: "vpn", title: "VPN", subtitle: "feat. MellSher • 86 BPM", cover: "/magnum/radio-covers/vpn.svg", color: "#00ffcc", bpm: 86, durationSec: 218, audio: "/magnum/audio/vpn.mp3" },
  { slug: "42", title: "42", subtitle: "42 братухи • 42 BPM", cover: "/magnum/radio-covers/42.svg", color: "#ff2d55", bpm: 42, durationSec: 202, audio: "/magnum/audio/42.mp3" },
  { slug: "clay", title: "CLAY", subtitle: "CLAY 73 • 73 BPM", cover: "/magnum/radio-covers/clay.svg", color: "#a67c52", bpm: 73, durationSec: 195, audio: "/magnum/audio/clay.mp3" },
  { slug: "nova", title: "NOVA", subtitle: "NOVA • 80 BPM", cover: "/magnum/radio-covers/nova.svg", color: "#ffcc00", bpm: 80, durationSec: 210, audio: "/magnum/audio/nova.mp3" },
  { slug: "tusa", title: "ТУСА", subtitle: "Туса Медуза • 96 BPM", cover: "/magnum/radio-covers/tusa.svg", color: "#7dd8ff", bpm: 96, durationSec: 188, audio: "/magnum/audio/tusa.mp3" },
];

export const RADIO_SLUGS = RADIO_TRACKS.map(t=>t.slug) as RadioTrackSlug[];
export function isRadioTrackSlug(v: string): v is RadioTrackSlug { return (RADIO_SLUGS as string[]).includes(v); }
export function findRadioTrack(slug: string): RadioTrack | undefined { return RADIO_TRACKS.find(t=>t.slug===slug); }

export const RADIO_TOTAL_SEC = RADIO_TRACKS.reduce((s,t)=>s+t.durationSec,0);
export const RADIO_EPOCH_MS = Date.UTC(2025,0,1,0,0,0); // stable epoch 2025-01-01

export function getRadioNow(atMs = Date.now()): { track: RadioTrack; position: number; index: number; next: RadioTrack } {
  const elapsed = Math.floor((atMs - RADIO_EPOCH_MS)/1000);
  const loopPos = ((elapsed % RADIO_TOTAL_SEC)+RADIO_TOTAL_SEC)%RADIO_TOTAL_SEC;
  let acc = 0;
  for (let i=0;i<RADIO_TRACKS.length;i++){
    const t = RADIO_TRACKS[i]!;
    if (loopPos < acc + t.durationSec) {
      const pos = loopPos - acc;
      const next = RADIO_TRACKS[(i+1)%RADIO_TRACKS.length]!;
      return { track: t, position: pos, index: i, next };
    }
    acc += t.durationSec;
  }
  return { track: RADIO_TRACKS[0]!, position: 0, index: 0, next: RADIO_TRACKS[1]! };
}

export const RADIO_REACTION_EMOJIS = ["🔥","💜","⛷️","42"] as const;
export type RadioEmoji = typeof RADIO_REACTION_EMOJIS[number];
export function isRadioEmoji(v: string): v is RadioEmoji { return (RADIO_REACTION_EMOJIS as readonly string[]).includes(v); }

export const RADIO_HEARTBEAT_SEC = 30;
export const RADIO_REWARD_SEC = 300; // 5min
export const RADIO_REWARD_COINS = 42;
export const RADIO_REWARD_COOLDOWN_MS = 60*60*1000; // 1h
export const RADIO_STREAK_DAYS = 7;
export const RADIO_STREAK_BONUS = 420;
export const RADIO_SHARE_REWARD = 42;
export const RADIO_SHARE_COOLDOWN_MS = 24*60*60*1000;
export const RADIO_DONATE_PRICE = 142;

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s/60);
  const r = s%60;
  return `${String(m).padStart(2,"0")}:${String(r).padStart(2,"0")}`;
}
