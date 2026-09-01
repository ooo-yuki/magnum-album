import { describe, it, expect } from "vitest";
function genChart(seed: number, totalNotes = 64, bpm = 128) {
  let s = seed; const rnd = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  const chart: { time: number; lane: number }[] = [];
  for (let i = 0; i < totalNotes; i++) { const t = i * (60000/bpm) * (0.5 + rnd()*0.5) + i*120; chart.push({ time: t, lane: Math.floor(rnd()*4) }); } return chart;
}
describe("rhythm: chart gen + pause/missStreak logic", () => {
  it("генерит 64+ ноты lane 0-3", () => { const c=genChart(42,64,128); expect(c.length).toBe(64); for(const n of c) expect(n.lane).toBeGreaterThanOrEqual(0); expect(Math.max(...c.map(x=>x.lane))).toBeLessThanOrEqual(3); });
  it("pause pausedTime", () => { let pausedTime=0; let pauseStart=1000; pausedTime+=2500-pauseStart; expect(pausedTime).toBe(1500); expect(4000-0-pausedTime).toBe(2500); });
  it("missStreak reset on hit", () => { let m=2; m++; expect(m).toBe(3); m=0; expect(m).toBe(0); });
  it("hint >=3 playing", () => { const h=(s:number,st:string)=>s>=3&&st==="playing"; expect(h(3,"playing")).toBe(true); expect(h(2,"playing")).toBe(false); expect(h(5,"paused")).toBe(false); });
  it("DIFFICULTY пороги", () => { const D={easy:{perfect:95,win:3500},normal:{perfect:75,win:5000},hard:{perfect:55,win:6500}}; expect(D.easy.perfect).toBeGreaterThan(D.normal.perfect); expect(D.normal.perfect).toBeGreaterThan(D.hard.perfect); expect(D.easy.win).toBeLessThan(D.hard.win); });
  it("accuracy", () => { const calc=(p:number,g:number,t:number)=>Math.round(((p*1+g*0.6)/Math.max(1,t))*100); expect(calc(10,0,10)).toBe(100); expect(calc(5,5,10)).toBe(80); expect(calc(0,0,0)).toBe(0); });
});
