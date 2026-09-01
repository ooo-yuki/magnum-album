// spinRewards.ts — Daily Spin Wheel 42 — 8 sectors, streak x2/x3, 1420 2% epic
export type SpinRewardKind = "dust" | "skin" | "empty" | "spin";
export type SpinSector = {
  id: string;
  label: string;
  kind: SpinRewardKind;
  dust?: number;
  skinId?: string;
  color: string;
  epicChance?: number; // for 1420 — 0.02
};

// 8 секторов (45° each) — spec: 42 dust / 142 dust / 1420 epic-шанс 2% / скины glacier/obsidian / 'пусто' / +1 спин
export const SPIN_SECTORS: SpinSector[] = [
  { id: "dust-42-a", label: "42 DUST", kind: "dust", dust: 42, color: "#ff2d55" },
  { id: "dust-142", label: "142 DUST", kind: "dust", dust: 142, color: "#ff6b35" },
  { id: "dust-1420-epic", label: "1420 EPIC", kind: "dust", dust: 1420, color: "#ffd700", epicChance: 0.02 },
  { id: "skin-glacier", label: "GLACIER", kind: "skin", skinId: "frame-glacier-matte", color: "#7dd8ff" },
  { id: "empty", label: "ПУСТО", kind: "empty", color: "#2a2a2a" },
  { id: "spin-plus1", label: "+1 СПИН", kind: "spin", color: "#00ff88" },
  { id: "skin-obsidian", label: "OBSIDIAN", kind: "skin", skinId: "frame-obsidian-coal", color: "#1a1a1a" },
  { id: "dust-42-b", label: "42 DUST", kind: "dust", dust: 42, color: "#5865f2" },
];

export function getStreakMultiplier(streak: number): 1 | 2 | 3 {
  const s = Math.max(0, Math.floor(streak));
  if (s >= 7) return 3;
  if (s >= 3) return 2;
  return 1;
}

export function spinStreakLabel(streak: number): string {
  const m = getStreakMultiplier(streak);
  if (m === 3) return `7дн ×3`;
  if (m === 2) return `3дн ×2`;
  return "×1";
}

export type SpinResult = {
  sectorIndex: number;
  sector: SpinSector;
  dust: number;
  skinId: string | null;
  isEmpty: boolean;
  extraSpin: boolean;
  epicRolled: boolean;
  multiplier: 1 | 2 | 3;
  appliedDust: number;
};

// Pure helper for client preview — does NOT touch DB, uses Math.random for epic 2%
export function resolveSpinReward(sectorIndex: number, streak: number): SpinResult {
  const idx = ((Math.floor(sectorIndex) % SPIN_SECTORS.length) + SPIN_SECTORS.length) % SPIN_SECTORS.length;
  const sector = SPIN_SECTORS[idx]!;
  const multiplier = getStreakMultiplier(streak);
  let dust = 0;
  let skinId: string | null = null;
  let isEmpty = false;
  let extraSpin = false;
  let epicRolled = false;
  if (sector.kind === "dust") {
    const base = sector.dust ?? 0;
    if (sector.epicChance != null) {
      const hit = Math.random() < sector.epicChance;
      epicRolled = hit;
      dust = hit ? base : 42; // fallback 42 on miss
    } else {
      dust = base;
    }
  } else if (sector.kind === "skin") {
    skinId = sector.skinId ?? null;
  } else if (sector.kind === "empty") {
    isEmpty = true;
  } else if (sector.kind === "spin") {
    extraSpin = true;
  }
  const appliedDust = dust * multiplier;
  return { sectorIndex: idx, sector, dust, skinId, isEmpty, extraSpin, epicRolled, multiplier, appliedDust };
}

// For server: weighted random pick among 8 sectors equally (wheel rotation picks index)
// But 1420 epic sector internally 2% — handled in resolveSpinReward.
export function pickRandomSectorIndex(): number {
  return Math.floor(Math.random() * SPIN_SECTORS.length);
}

export function sektorAngleDeg(index: number): number {
  return index * 45;
}
