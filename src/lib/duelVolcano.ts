export type DuelRecord = {
  id: string;
  date: string;
  wager: number;
  winner: string | null;
  scores: Array<{name:string;score:number}>;
  durationSec: number;
};
const KEY = "magnum-duel-history";
const LIMIT = 20;
export function getHistory(): DuelRecord[] {
  try { const raw = localStorage.getItem(KEY); if(!raw) return []; const a = JSON.parse(raw); return Array.isArray(a)? a.slice(0,LIMIT):[]; } catch { return []; }
}
export function pushDuel(r: DuelRecord){
  try { const h = getHistory(); h.unshift(r); localStorage.setItem(KEY, JSON.stringify(h.slice(0,LIMIT))); } catch {}
}
export function calcScore(volcano:number): number {
  if(volcano<=1) return 1;
  return Math.min(1.77, 1+(volcano-1)*0.07);
}
