export type DuelRecord = {
  id: string;
  date: string;
  wager: number;
  winner: string | null;
  scores: Array<{name:string;score:number}>;
  durationSec: number;
};
const LIMIT = 20;
// Neon-only: in-memory history — server persists via magnum_duel_history WS
let mem: DuelRecord[] = [];
export function getHistory(): DuelRecord[] {
  return mem.slice(0, LIMIT);
}
export function pushDuel(r: DuelRecord){
  mem.unshift(r);
  mem = mem.slice(0, LIMIT);
  // optional Neon sync is handled server-side via WS persistDuelResults (magnum_duel_history)
}
export function calcScore(volcano:number): number {
  if(volcano<=1) return 1;
  return Math.min(1.77, 1+(volcano-1)*0.07);
}
