// charts42 — seeded mock streams for MAGNUM 5 tracks
export type Period = "week" | "month" | "all";
export type TrackSlug = "vpn" | "clay" | "nova" | "magnum" | "meduza";
export type ChartTrack = { slug: TrackSlug; title: string; color: string; bpm: number };
export const TRACKS: ChartTrack[] = [
  { slug: "vpn", title: "VPN", color: "#00ffcc", bpm: 86 },
  { slug: "clay", title: "CLAY", color: "#ff2d55", bpm: 73 },
  { slug: "nova", title: "NOVA", color: "#ffcc00", bpm: 80 },
  { slug: "magnum", title: "MAGNUM", color: "#9147ff", bpm: 142 },
  { slug: "meduza", title: "MEDUZA", color: "#7dd8ff", bpm: 96 },
];
export const TRACK_SLUGS = TRACKS.map(t => t.slug) as TrackSlug[];
export function isTrackSlug(v: string): v is TrackSlug {
  return (TRACK_SLUGS as string[]).includes(v);
}
export function isPeriod(v: string): v is Period {
  return v === "week" || v === "month" || v === "all";
}
export function formatK(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "K";
  return String(n);
}
export function formatDelta(n: number): string {
  return (n > 0 ? "+" : "") + formatK(n);
}
// mulberry32 seeded RNG — deterministic per day+period
export function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function seedFrom(period: Period, day: string): number {
  let h = 0;
  const s = period + ":" + day;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return h;
}
// base streams seeded: VPN hits 363K plays, others scaled
export type Snapshot = { track_slug: TrackSlug; plays: number; views: number; delta: number; delta_views: number; period: Period; updated_at: string };
export function seededSnapshots(period: Period, day: string): Snapshot[] {
  const rnd = mulberry32(seedFrom(period, day));
  const mult = period === "week" ? 1 : period === "month" ? 3.4 : 8;
  const bases: Record<TrackSlug, { plays: number; views: number }> = {
    vpn: { plays: 363_000, views: 2_100_000 },
    clay: { plays: 210_000, views: 890_000 },
    nova: { plays: 185_000, views: 720_000 },
    magnum: { plays: 142_000, views: 540_000 },
    meduza: { plays: 98_000, views: 410_000 },
  };
  return TRACKS.map(t => {
    const b = bases[t.slug];
    const jitter = 0.85 + rnd() * 0.3; // 0.85-1.15
    const plays = Math.round(b.plays * mult * jitter);
    const views = Math.round(b.views * mult * jitter);
    const delta = Math.round((rnd() * 0.12 - 0.04) * plays); // -4%..+8%
    const delta_views = Math.round((rnd() * 0.12 - 0.04) * views);
    return { track_slug: t.slug, plays, views, delta, delta_views, period, updated_at: new Date().toISOString() };
  }).sort((a, b) => b.plays - a.plays);
}
