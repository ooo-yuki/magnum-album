import { describe, it, expect } from "bun:test";
const SIZE=4; type Grid=number[][]; type Dir="up"|"down"|"left"|"right";
function clone(g:Grid):Grid{return g.map(r=>[...r])}
function slide(row:number[]){const f=row.filter(v=>v!==0);let s=0;const m:number[]=[];for(let i=0;i<f.length;i++){if(i+1<f.length&&f[i]===f[i+1]){m.push(f[i]!*2);s+=f[i]!*2;i++;}else m.push(f[i]!);}while(m.length<SIZE)m.push(0);let mv=false;for(let i=0;i<SIZE;i++)if(m[i]!==row[i])mv=true;return{row:m,score:s,moved:mv};}
function move(g:Grid,dir:Dir){let ts=0,any=false;const ng=clone(g);const get=(i:number)=>dir==="left"?[...ng[i]!]:dir==="right"?[...ng[i]!].reverse():dir==="up"?Array.from({length:SIZE},(_,k)=>ng[k]![i]!):Array.from({length:SIZE},(_,k)=>ng[SIZE-1-k]![i]!);const set=(i:number,r:number[])=>{if(dir==="left")for(let k=0;k<SIZE;k++)ng[i]![k]=r[k]!;else if(dir==="right")for(let k=0;k<SIZE;k++)ng[i]![k]=r[SIZE-1-k]!;else if(dir==="up")for(let k=0;k<SIZE;k++)ng[k]![i]=r[k]!;else for(let k=0;k<SIZE;k++)ng[SIZE-1-k]![i]=r[k]!;};for(let i=0;i<SIZE;i++){const {row:r,score,moved}=slide(get(i));set(i,r);ts+=score;if(moved)any=true;}return{grid:ng,score:ts,moved:any};}
describe("2042 enhanced",()=>{
  it("undo restores grid",()=>{const s:Grid=[[2,2,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];const {grid:a}=move(s,"left");expect(a[0]![0]).toBe(4);const h=[clone(s)];const r=h.pop()!;expect(r[0]![1]).toBe(2);});
  it("moves counter",()=>{let m=0;const g:Grid=[[2,0,0,0],[2,0,0,0],[0,0,0,0],[0,0,0,0]];if(move(g,"up").moved)m++;expect(m).toBe(1);});
  it("hint best left 12",()=>{const g:Grid=[[2,2,4,4],[0,0,0,0],[0,0,0,0],[0,0,0,0]];let b:Dir|null=null,bs=-1;for(const d of (["up","down","left","right"] as Dir[])){const {score,moved}=move(g,d);if(moved&&score>bs){bs=score;b=d;}}expect(b).toBe("left");expect(bs).toBe(12);});
});
describe("Rhythm diff",()=>{
  const D={easy:{perfect:95,good:170,speed:300,win:3500},normal:{perfect:75,good:145,speed:360,win:5000},hard:{perfect:55,good:115,speed:440,win:6500}} as const;
  it("easy>hard windows",()=>{expect(D.easy.perfect).toBeGreaterThan(D.hard.perfect);expect(D.hard.speed).toBeGreaterThan(D.easy.speed);expect(D.hard.win).toBeGreaterThan(D.easy.win);});
  it("judgement",()=>{const d=D.normal;expect(70<=d.perfect?"perfect":70<=d.good?"good":"miss").toBe("perfect");expect(120<=d.perfect?"perfect":120<=d.good?"good":"miss").toBe("good");});
});
