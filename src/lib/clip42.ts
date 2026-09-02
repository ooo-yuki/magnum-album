// clip42.ts — канон КЛИП-БАТТЛА 42: 15с клип-дуэли, 5 треков MAGNUM, монетки, WS
export const CLIP_MAX_SECONDS = 15;
export const CLIP_MAX_BYTES = 2 * 1024 * 1024;
export const CLIP_TRACKS = ["clay", "vpn", "nova", "magnum", "tusa"] as const;
export type ClipTrack = typeof CLIP_TRACKS[number];
export const CLIP_TRACK_LABELS: Record<ClipTrack, string> = {
  clay: "CLAY • 73 BPM",
  vpn: "VPN • 86 BPM",
  nova: "NOVA • 80 BPM",
  magnum: "MAGNUM • 142 BPM",
  tusa: "ТУСА МЕДУЗА • 95 BPM",
};
export function isClipTrack(v: string): v is ClipTrack {
  return (CLIP_TRACKS as readonly string[]).includes(v);
}
export const CLIP_COST_VOTE = 42;
export const CLIP_REWARD_WIN = 1420;
export const CLIP_REWARD_TAKE_PART = 42;
export const CLIP_REWARD_SHARE = 42;
export const CLIP_REWARD_TOP_WEEK = 420;
export const CLIP_VOTE_RATE_LIMIT = 5; // 5/час
export const CLIP_UPLOAD_LIMIT_PER_DAY = 1;
export const CLIP_PAGE_SIZE = 20;
export const CLIP_BATTLE_DURATION_SEC = 24 * 3600;

export type ClipItem = {
  id: number;
  userId: number;
  username: string;
  trackSlug: string;
  mediaUrl: string;
  likes: number;
  created_at: string;
};
export type ClipBattle = {
  id: number;
  clipAId: number;
  clipBId: number;
  votesA: number;
  votesB: number;
  endsAt: string;
  winnerId: number | null;
  clipA?: ClipItem;
  clipB?: ClipItem;
};
