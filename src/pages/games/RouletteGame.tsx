import { useRef, useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./RouletteGame.module.css";
gsap.registerPlugin(ScrollTrigger);

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
const RGB_GLOW = "0 12px 36px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,45,85,0.22), 0 0 28px rgba(255,45,85,0.22), 0 0 28px rgba(0,255,136,0.14), 0 0 32px rgba(255,204,0,0.10)";
function hoverIn(el: HTMLElement) {
  if (prefersReducedMotion()) return;
  gsap.to(el, { y: -4, boxShadow: RGB_GLOW, borderColor: "rgba(255,45,85,0.45)", duration: 0.3, ease: "power2.out", overwrite: true });
  const glow = el.querySelector<HTMLElement>("[data-glow]");
  if (glow) gsap.to(glow, { opacity: 1, duration: 0.3, overwrite: true });
}
function hoverOut(el: HTMLElement) {
  if (prefersReducedMotion()) { gsap.set(el, { clearProps: "boxShadow,borderColor" }); return; }
  gsap.to(el, { y: 0, boxShadow: "0 0 0 1px transparent, 0 0 0 transparent", borderColor: "rgba(35,35,43,1)", duration: 0.4, ease: "power2.out", overwrite: true });
  const glow = el.querySelector<HTMLElement>("[data-glow]");
  if (glow) gsap.to(glow, { opacity: 0.95, duration: 0.4, overwrite: true });
}

//Obscura-заглушка AudioParam: прямые вызовы ramp-методов могут кинуть — оборачиваем
function safeRamp(param: AudioParam, fn: () => void, fallbackValue: number) {
  try { fn(); } catch { param.value = fallbackValue; }
}

const PRESAVE = "https://music.thefence.me/psmagnum";
const START_BALANCE = 1000;
const WIN_BALANCE = 4200;

const CHIPS = [1, 5, 25, 100] as const;

const RED_NUMS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
type Color = "red"|"black"|"green";
function getColor(n: number): Color { if(n===0) return "green"; return RED_NUMS.has(n)?"red":"black"; }

// European order 0-36 clockwise
const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26] as const;
const WHEEL_COLORS: Record<number, string> = {};
WHEEL_ORDER.forEach(n=>{ WHEEL_COLORS[n]= getColor(n)==="green"?"#0a7a2e": getColor(n)==="red"?"#c81d25":"#1a1a1a"; });

type BetType = "straight"|"red"|"black"|"even"|"odd"|"low"|"high"|"dozen1"|"dozen2"|"dozen3";
interface Bet { type: BetType; amount: number; num?: number }
interface SpinRecord { n: number; color: Color; win: number; balance: number; }
interface Confetti { x:number; y:number; vx:number; vy:number; rot:number; vr:number; life:number; color:string; size:number; }

function payout(bet: Bet, result: number, color: Color): number {
  if (bet.type==="straight") return bet.num===result ? bet.amount*35 : -bet.amount;
  if (bet.type==="red") return color==="red"? bet.amount : color==="green"? -bet.amount : -bet.amount;
  if (bet.type==="black") return color==="black"? bet.amount : color==="green"? -bet.amount : -bet.amount;
  if (bet.type==="even") return result!==0 && result%2===0 ? bet.amount : -bet.amount;
  if (bet.type==="odd") return result%2===1 ? bet.amount : -bet.amount;
  if (bet.type==="low") return result>=1 && result<=18 ? bet.amount : -bet.amount;
  if (bet.type==="high") return result>=19 && result<=36 ? bet.amount : -bet.amount;
  if (bet.type==="dozen1") return result>=1 && result<=12 ? bet.amount*2 : -bet.amount;
  if (bet.type==="dozen2") return result>=13 && result<=24 ? bet.amount*2 : -bet.amount;
  if (bet.type==="dozen3") return result>=25 && result<=36 ? bet.amount*2 : -bet.amount;
  return 0;
}

// ─── пресеты ставок ─────────────────────────────────────────────────────────
const BET_PRESETS: { label:string; emoji:string; bets:{type:BetType; num?:number}[] }[] = [
  { label:"Красные", emoji:"🔴", bets:[{type:"red"}] },
  { label:"Чёрные", emoji:"⚫", bets:[{type:"black"}] },
  { label:"Чёт", emoji:"2️⃣", bets:[{type:"even"}] },
  { label:"Нечёт", emoji:"1️⃣", bets:[{type:"odd"}] },
  { label:"1-12", emoji:"1️⃣", bets:[{type:"dozen1"}] },
  { label:"13-24", emoji:"2️⃣", bets:[{type:"dozen2"}] },
  { label:"25-36", emoji:"3️⃣", bets:[{type:"dozen3"}] },
  { label:"Осирис", emoji:"👁️", bets:[{type:"straight",num:7},{type:"straight",num:17},{type:"straight",num:27},{type:"red"}] },
  { label:"42", emoji:"💎", bets:[{type:"straight",num:4},{type:"straight",num:2},{type:"straight",num:0},{type:"straight",num:32}] },
  { label:"Соседи 0", emoji:"🟢", bets:[{type:"straight",num:0},{type:"straight",num:32},{type:"straight",num:15},{type:"straight",num:26},{type:"straight",num:3}] },
];

let ac: AudioContext | null = null;
function ensureAC(){ try{ if(!ac) ac=new (window.AudioContext||(window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext)(); if(ac.state==="suspended") void ac.resume(); return ac; }catch{ return null; } }
function playTick(){ const c=ensureAC(); if(!c) return; const o=c.createOscillator(),g=c.createGain(); o.connect(g); g.connect(c.destination); o.type="square"; o.frequency.value=720+Math.random()*200; g.gain.setValueAtTime(0.08,c.currentTime); safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.08), 0.001); o.start(); o.stop(c.currentTime+0.08); }
function playChipStack(){ const c=ensureAC(); if(!c) return; for(let i=0;i<3;i++){ const o=c.createOscillator(),g=c.createGain(); o.connect(g); g.connect(c.destination); o.type="triangle"; o.frequency.value=900+i*180; g.gain.setValueAtTime(0.07,c.currentTime+i*0.04); safeRamp(g.gain,()=>g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+i*0.04+0.12),0.001); o.start(c.currentTime+i*0.04); o.stop(c.currentTime+i*0.04+0.12); } }
function playSpinRumble(){ const c=ensureAC(); if(!c) return; const o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter(); o.connect(f); f.connect(g); g.connect(c.destination); f.type="lowpass"; f.frequency.value=900; o.type="sawtooth"; o.frequency.value=90; safeRamp(o.frequency,()=>o.frequency.linearRampToValueAtTime(42,c.currentTime+3.8),42); g.gain.setValueAtTime(0.09,c.currentTime); safeRamp(g.gain,()=>g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+4.0),0.001); o.start(); o.stop(c.currentTime+4.0); }
function playWinSound(){ const c=ensureAC(); if(!c) return; [0,0.12,0.24,0.38].forEach((d,i)=>{ const o=c.createOscillator(),g=c.createGain(); o.connect(g); g.connect(c.destination); o.type="sine"; o.frequency.value=520+i*120; g.gain.setValueAtTime(0.15,c.currentTime+d); safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+d+0.35), 0.001); o.start(c.currentTime+d); o.stop(c.currentTime+d+0.35); }); const sh=c.createOscillator(),sg=c.createGain(); sh.connect(sg); sg.connect(c.destination); sh.type="triangle"; sh.frequency.value=1800; sg.gain.setValueAtTime(0.05,c.currentTime+0.5); safeRamp(sg.gain,()=>sg.gain.exponentialRampToValueAtTime(0.001,c.currentTime+1.1),0.001); sh.start(c.currentTime+0.5); sh.stop(c.currentTime+1.1); }
function playBigWin(){ const c=ensureAC(); if(!c) return; playWinSound(); setTimeout(()=>{ const notes=[659,784,1046,1318]; notes.forEach((f,i)=>{ const cc=ensureAC(); if(!cc) return; const o=cc.createOscillator(),g=cc.createGain(); o.connect(g); g.connect(cc.destination); o.type="sine"; o.frequency.value=f; g.gain.setValueAtTime(0.13,cc.currentTime+i*0.08); safeRamp(g.gain,()=>g.gain.exponentialRampToValueAtTime(0.001,cc.currentTime+i*0.08+0.4),0.001); o.start(cc.currentTime+i*0.08); o.stop(cc.currentTime+i*0.08+0.45); }); },220); }
function playLoseSound(){ const c=ensureAC(); if(!c) return; const o=c.createOscillator(),g=c.createGain(); o.connect(g); g.connect(c.destination); o.type="sawtooth"; o.frequency.value=140; safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(80,c.currentTime+0.3), 80); g.gain.setValueAtTime(0.1,c.currentTime); safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.35), 0.001); o.start(); o.stop(c.currentTime+0.35); }

export function RouletteGame(){
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const confettiRef = useRef<HTMLCanvasElement>(null);
  const wheelRef = useRef({ rotation: 0 });
  const ballRef = useRef({ angle: 0 });
  const particlesRef = useRef<Confetti[]>([]);
  const animRef = useRef(0);
  const [balance, setBalance] = useState(START_BALANCE);
  const [chip, setChip] = useState<number>(5);
  const [bets, setBets] = useState<Bet[]>([]);
  const [history, setHistory] = useState<SpinRecord[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number|null>(null);
  const [lastWin, setLastWin] = useState<number>(0);
  const [won, setWon] = useState(false);
  // Neon баланс + история — без LS (credentials:include)
  useEffect(()=>{
    fetch("/magnum/api/coins",{credentials:"include"}).then(r=>r.ok?r.json():null).then(j=>{
      const v=j?.balance??j?.coins; if(typeof v==="number"&&Number.isFinite(v)) setBalance(Math.round(v));
    }).catch(()=>{});
    fetch("/magnum/api/games/my",{credentials:"include"}).then(r=>r.ok?r.json():null).then(j=>{
      const arr=j?.scores as {game:string;score:number;coins_earned:number;created_at:string}[]|undefined; if(!arr) return;
      const recs:SpinRecord[]=[]; for(const s of arr){ if(s.game==="roulette") recs.push({n: (s.score%37), color:getColor(s.score%37), win:s.coins_earned, balance:0}); if(recs.length>=20) break; }
      if(recs.length) setHistory(recs);
    }).catch(()=>{});
  },[]);
  const [showModal, setShowModal] = useState(false);
  const [lastBets, setLastBets] = useState<Bet[]>([]);
  const [autoSpin, setAutoSpin] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // win modal — без LS
  useEffect(()=>{ if(balance>=WIN_BALANCE && !won){ setWon(true); setShowModal(true); playBigWin(); burstConfetti(36); } },[balance, won]);

  // GSAP entrance
  useEffect(()=>{
    if(!wrapRef.current) return;
    if(prefersReducedMotion()) { gsap.set(`.${styles.panel}`, { y:0, opacity:1, clearProps:"transform" }); return; }
    const ctx=gsap.context(()=>{ gsap.from(`.${styles.panel}`,{ y:30, opacity:0, duration:0.6, stagger:0.08, ease:"back.out(1.4)"}); },wrapRef);
    return ()=>ctx.revert();
  },[]);

  // GSAP spec: y24 stagger 0.12 ScrollTrigger batch + reduced-motion gate + gsap.context cleanup + hover y:-4 RGB glow
  useEffect(() => {
    const root: HTMLElement | null = document.querySelector<HTMLElement>("[data-gsap-root]") || (document.body as unknown as HTMLElement);
    if (!root) return;
    if (prefersReducedMotion()) {
      const els = root.querySelectorAll<HTMLElement>(".card, [data-card]");
      if (els.length) gsap.set(els, { y: 0, opacity: 1, clearProps: "transform" });
      return;
    }
    const ctx = gsap.context(() => {
      const cards = root.querySelectorAll<HTMLElement>(".card, [data-card], .tile, .cell");
      if (cards.length) {
        gsap.set(cards, { y: 24, opacity: 0 });
        ScrollTrigger.batch(cards, {
          onEnter: (batch) => gsap.to(batch, { y: 0, opacity: 1, stagger: 0.12, duration: 0.55, ease: "power2.out", overwrite: true }),
          start: "top 92%",
          once: true,
        });
      }
      const heroEls = root.querySelectorAll<HTMLElement>(".hero > *, [data-hero] > *");
      if (heroEls.length) {
        gsap.set(heroEls, { y: 24, opacity: 0 });
        gsap.to(heroEls, { y: 0, opacity: 1, stagger: 0.12, duration: 0.55, ease: "power2.out", delay: 0.05, overwrite: true });
      }
    }, root);
    return () => ctx.revert();
  }, []);

  // stats: hot/cold numbers from history
  const freqMap = (()=>{ const m=new Map<number,number>(); history.forEach(h=>m.set(h.n,(m.get(h.n)||0)+1)); return m; })();
  const hotNumbers = [...freqMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4);
  const coldNumbers = WHEEL_ORDER.filter(n=>!freqMap.has(n)).slice(0,4);
  const redCount = history.filter(h=>h.color==="red").length;
  const blackCount = history.filter(h=>h.color==="black").length;

  // confetti burst helper
  const burstConfetti = useCallback((count=22)=>{
    const colors=["#ff2d55","#ffcc00","#00ff88","#a78bfa","#fff","#ff6b35"];
    for(let i=0;i<count;i++){
      particlesRef.current.push({
        x: (0.25+Math.random()*0.5)*window.innerWidth,
        y: -10 - Math.random()*40,
        vx:(Math.random()-0.5)*7, vy: Math.random()*2+2,
        rot: Math.random()*Math.PI*2, vr:(Math.random()-0.5)*0.3,
        life:1, color: colors[Math.floor(Math.random()*colors.length)]!, size: 5+Math.random()*7
      });
    }
  },[]);

  // confetti canvas loop
  useEffect(()=>{
    const canvas=confettiRef.current; if(!canvas) return;
    const ctx=canvas.getContext("2d"); if(!ctx) return;
    const resize=()=>{ canvas.width=window.innerWidth* (window.devicePixelRatio||1); canvas.height=window.innerHeight* (window.devicePixelRatio||1); canvas.style.width=window.innerWidth+"px"; canvas.style.height=window.innerHeight+"px"; ctx.setTransform(window.devicePixelRatio||1,0,0,window.devicePixelRatio||1,0,0); };
    resize(); window.addEventListener("resize",resize);
    const draw=()=>{
      ctx.clearRect(0,0,canvas.width,canvas.height);
      particlesRef.current=particlesRef.current.filter(p=>p.life>0.01 && p.y < window.innerHeight+20);
      for(const p of particlesRef.current){
        p.x+=p.vx; p.y+=p.vy; p.vy+=0.14; p.vx*=0.995; p.rot+=p.vr; p.life-=0.004;
        if(p.life<=0) continue;
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.globalAlpha=Math.max(0,p.life);
        ctx.fillStyle=p.color; ctx.fillRect(-p.size/2,-p.size/3,p.size,p.size*0.6);
        ctx.restore();
      }
      animRef.current=requestAnimationFrame(draw);
    };
    animRef.current=requestAnimationFrame(draw);
    return ()=>{ cancelAnimationFrame(animRef.current); window.removeEventListener("resize",resize); };
  },[]);

  // wheel draw
  const draw = useCallback(()=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const ctx=canvas.getContext("2d"); if(!ctx) return;
    const dpr=window.devicePixelRatio||1;
    const w=canvas.clientWidth, h=canvas.clientHeight;
    canvas.width=w*dpr; canvas.height=h*dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,w,h);
    const cx=w/2, cy=h/2, R=Math.min(w,h)/2 - 8;
    ctx.beginPath(); ctx.arc(cx,cy,R+6,0,Math.PI*2); ctx.fillStyle="#0d0d0d"; ctx.fill();
    ctx.strokeStyle="rgba(255,45,85,0.25)"; ctx.lineWidth=2; ctx.stroke();
    const total=WHEEL_ORDER.length;
    const rot=wheelRef.current.rotation;
    WHEEL_ORDER.forEach((num, idx)=>{
      const start=(idx/total)*Math.PI*2 + rot;
      const end=((idx+1)/total)*Math.PI*2 + rot;
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,R,start,end); ctx.closePath();
      ctx.fillStyle=WHEEL_COLORS[num]||"#111";
      ctx.fill();
      ctx.strokeStyle="rgba(255,255,255,0.12)"; ctx.lineWidth=1; ctx.stroke();
      const mid=(start+end)/2;
      const tx=cx+Math.cos(mid)*(R*0.74);
      const ty=cy+Math.sin(mid)*(R*0.74);
      ctx.save(); ctx.translate(tx,ty); ctx.rotate(mid+Math.PI/2);
      ctx.fillStyle=num===0? "#ffec99" : "#fff";
      ctx.font=`700 ${R<130?9:11}px Inter,system-ui`; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText(String(num),0,0);
      ctx.restore();
    });
    const grad=ctx.createRadialGradient(cx,cy, R*0.08, cx,cy, R*0.22);
    grad.addColorStop(0,"#2a2a2a"); grad.addColorStop(1,"#0a0a0a");
    ctx.beginPath(); ctx.arc(cx,cy,R*0.22,0,Math.PI*2); ctx.fillStyle=grad; ctx.fill();
    ctx.strokeStyle="rgba(255,255,255,0.15)"; ctx.lineWidth=1.5; ctx.stroke();
    // pulsing 42 when win threshold near
    const nearWin = balance/WIN_BALANCE > 0.7;
    if(nearWin){ ctx.shadowColor="#ff2d55"; ctx.shadowBlur=12; }
    ctx.fillStyle="#ff2d55"; ctx.font=`800 ${R*0.12}px Inter`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("42",cx,cy);
    ctx.shadowBlur=0;
    ctx.beginPath(); ctx.arc(cx,cy,R+10,0,Math.PI*2); ctx.strokeStyle="rgba(255,255,255,0.08)"; ctx.lineWidth=2; ctx.stroke();
    const ballAngle=ballRef.current.angle;
    const br=R+10;
    const bx=cx+Math.cos(ballAngle)*br;
    const by=cy+Math.sin(ballAngle)*br;
    ctx.beginPath(); ctx.arc(bx+1,by+1,7,0,Math.PI*2); ctx.fillStyle="rgba(0,0,0,0.4)"; ctx.fill();
    ctx.beginPath(); ctx.arc(bx,by,6.5,0,Math.PI*2);
    const bg=ctx.createRadialGradient(bx-2,by-2,1, bx,by,6.5);
    bg.addColorStop(0,"#fff"); bg.addColorStop(1,"#e0e0e0");
    ctx.fillStyle=bg; ctx.fill();
    ctx.strokeStyle="rgba(0,0,0,0.2)"; ctx.lineWidth=1; ctx.stroke();
    // trail
    ctx.beginPath(); ctx.arc(bx,by,3,0,Math.PI*2); ctx.fillStyle="rgba(255,255,255,0.35)"; ctx.fill();
    ctx.save(); ctx.translate(cx, cy - R - 14);
    ctx.beginPath(); ctx.moveTo(0,10); ctx.lineTo(-8,-6); ctx.lineTo(8,-6); ctx.closePath();
    ctx.fillStyle="#ff2d55"; ctx.fill(); ctx.strokeStyle="#fff"; ctx.lineWidth=1; ctx.stroke();
    ctx.restore();
  },[balance]);

  useEffect(()=>{ draw(); const onResize=()=>draw(); window.addEventListener("resize", onResize); return()=>window.removeEventListener("resize", onResize); },[draw]);

  const totalBet = bets.reduce((s,b)=>s+b.amount,0);

  const placeBet = useCallback((type: BetType, num?: number)=>{
    if(spinning) return;
    if(balance - totalBet < chip) return;
    setBets(prev=>[...prev, { type, amount: chip, num }]);
    playTick();
  },[balance, totalBet, chip, spinning]);

  const applyPreset = useCallback((idx:number)=>{
    if(spinning) return;
    const preset=BET_PRESETS[idx]; if(!preset) return;
    const needed=preset.bets.length*chip;
    if(balance - totalBet < needed) return;
    setBets(prev=>[...prev, ...preset.bets.map(b=>({type:b.type, amount:chip, num:b.num}))]);
    playChipStack();
  },[spinning, chip, balance, totalBet]);

  const doubleBets = useCallback(()=>{
    if(spinning || bets.length===0) return;
    if(balance - totalBet < totalBet) return;
    setBets(prev=>[...prev, ...prev.map(b=>({...b}))]);
    playChipStack();
    if(wrapRef.current && !prefersReducedMotion()) gsap.fromTo(wrapRef.current,{scale:1},{scale:1.012,duration:0.12,yoyo:true,repeat:1,ease:"power1.inOut"});
  },[spinning, bets, balance, totalBet]);

  const repeatLast = useCallback(()=>{
    if(spinning || lastBets.length===0) return;
    const needed=lastBets.reduce((s,b)=>s+b.amount,0);
    if(balance - totalBet < needed) return;
    setBets([...lastBets]);
    playChipStack();
  },[spinning, lastBets, balance, totalBet]);

  const removeLast = ()=> setBets(prev=>prev.slice(0,-1));
  const clearBets = ()=> setBets([]);

  const spin = useCallback(()=>{
    if(spinning || bets.length===0) return;
    setSpinning(true); setResult(null); setLastWin(0);
    setLastBets([...bets]);
    const idx=Math.floor(Math.random()*WHEEL_ORDER.length);
    const winningNumber=WHEEL_ORDER[idx]!;
    const col=getColor(winningNumber);
    const total=WHEEL_ORDER.length;
    const currentRot=wheelRef.current.rotation % (Math.PI*2);
    const targetCenter= -Math.PI/2;
    const segmentCenter=(idx+0.5)/total*Math.PI*2;
    let targetRot = targetCenter - segmentCenter;
    const spins = 4 + Math.floor(Math.random()*3);
    while(targetRot < currentRot) targetRot += Math.PI*2;
    targetRot += spins*Math.PI*2;
    const startRot=wheelRef.current.rotation;
    const delta=targetRot - startRot;
    const ballStart=ballRef.current.angle;
    const ballDelta= -(spins*2.2*Math.PI*2 + Math.random()*1.2);
    playSpinRumble();
    if(wrapRef.current && !prefersReducedMotion()) gsap.to(wrapRef.current,{ scale:1.01, duration:0.15, yoyo:true, repeat:1 });

    const obj={ p:0 };
    gsap.to(obj,{
      p:1, duration:4.2, ease:"power3.inOut",
      onUpdate:()=>{
        const t=obj.p;
        wheelRef.current.rotation = startRot + delta*t;
        ballRef.current.angle = ballStart + ballDelta*t + Math.sin(t*Math.PI)*0.6;
        draw();
        if(Math.random()<0.06) playTick();
      },
      onComplete:()=>{
        wheelRef.current.rotation = targetRot % (Math.PI*2);
        gsap.to(ballRef.current,{ angle: targetCenter, duration:0.35, ease:"back.out(1.5)", onUpdate:draw, onComplete:()=>{
          setResult(winningNumber);
          let net=0;
          bets.forEach(b=>{
            const p=payout(b, winningNumber, col);
            net+=p;
          });
          const newBalance = balance + net;
          const clamped = Math.max(0, newBalance);
          setBalance(clamped);
          setLastWin(net);
          setHistory(prev=>[{ n: winningNumber, color: col, win: net, balance: clamped }, ...prev].slice(0,20));
          setBets([]);
          setSpinning(false);
          if(net>0){
            if(net>=chip*10) { playBigWin(); burstConfetti(32); }
            else playWinSound();
            if(wrapRef.current && !prefersReducedMotion()) gsap.fromTo(wrapRef.current,{scale:1},{scale:1.02,duration:0.18,yoyo:true,repeat:1,ease:"back.out(1.4)"});
          } else { playLoseSound(); if(net< -chip*3 && wrapRef.current && !prefersReducedMotion()) gsap.to(wrapRef.current,{x:4,duration:0.06,yoyo:true,repeat:5,onComplete:()=>gsap.set(wrapRef.current!,{x:0})}); }
          draw();
          // auto-repeat if enabled and balance allows
          if(autoSpin && clamped>0 && clamped < WIN_BALANCE){
            setTimeout(()=>{ if(lastBets.length>0) setBets([...lastBets]); }, 700);
          }
        }});
      }
    });
  },[spinning, bets, balance, draw, chip, burstConfetti, autoSpin, lastBets]);

  // swipe to spin on wheel
  const touchStartRef = useRef<number|null>(null);
  const handleTouchStart = (e:React.TouchEvent)=>{ touchStartRef.current=e.touches[0]!.clientX; };
  const handleTouchEnd = (e:React.TouchEvent)=>{
    if(touchStartRef.current===null) return;
    const dx=e.changedTouches[0]!.clientX - touchStartRef.current;
    touchStartRef.current=null;
    if(Math.abs(dx)>50 && !spinning && bets.length>0) spin();
  };

  const resetGame=()=>{
    setBalance(START_BALANCE); setBets([]); setHistory([]); setResult(null); setLastWin(0); setShowModal(false); setWon(false); setLastBets([]); setAutoSpin(false);
  };

  const canSpin = bets.length>0 && !spinning;
  const straightTotal = (n:number)=> bets.filter(b=>b.type==="straight"&&b.num===n).reduce((s,b)=>s+b.amount,0);

  return (
    <div ref={wrapRef} className={styles.page}>
      <canvas ref={confettiRef} style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:20}} width={800} height={600} />
      <div className={styles.header}>
        <Link to="/magnum/games" className={styles.back}>← Игры</Link>
        <h1 className={styles.title}>РУЛЕТКА 42</h1>
        <p className={styles.sub}>Европейская 0-36 · собери 4200 монет · свайп по колесу = крутить</p>
      </div>

      <div className={styles.layout}>
        <div className={styles.wheelPanel + " " + styles.panel} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <div className={styles.balanceRow}>
            <span className={styles.balanceLabel}>Баланс</span>
            <span className={styles.balanceValue}>{balance} <span className={styles.coin}>◉</span></span>
            <span className={styles.target}>→ 4200</span>
          </div>
          <div className={styles.progressWrap}><div className={styles.progress} style={{width: `${Math.min(100, (balance/WIN_BALANCE)*100)}%`}} /></div>
          <div className={styles.canvasWrap}>
            <canvas ref={canvasRef} className={styles.canvas} width={320} height={320} />
          </div>
          {result!==null && (
            <div className={styles.resultBadge} style={{background: result===0?"#0a7a2e": RED_NUMS.has(result)?"#c81d25":"#1a1a1a"}}>
              {result} <span className={styles.resultColor}>{getColor(result)}</span> {lastWin!==0 && <span className={lastWin>0?styles.winTxt:styles.loseTxt}>{lastWin>0?`+${lastWin}`:lastWin}</span>}
            </div>
          )}
          <div className={styles.history}>
            {history.slice(0,14).map((h,i)=>(
              <span key={i} className={styles.histChip} data-color={h.color} title={`${h.n} ${h.win>0?`+${h.win}`:h.win}`}>{h.n}</span>
            ))}
            {history.length===0 && <span className={styles.histEmpty}>история спинов</span>}
          </div>
          {/* hot/cold + stats */}
          <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap",justifyContent:"center",marginTop:"0.6rem"}}>
            <span style={{fontSize:"0.7rem",color: hotNumbers.length?"#ffcc00":"rgba(240,240,240,0.3)",background:"rgba(255,204,0,0.1)",padding:"0.2rem 0.5rem",borderRadius:"999px",border:"1px solid rgba(255,204,0,0.2)"}}>🔥 HOT: {hotNumbers.length?hotNumbers.map(([n,c])=>`${n}×${c}`).join(" "):"—"}</span>
            <span style={{fontSize:"0.7rem",color:"rgba(160,200,255,0.9)",background:"rgba(100,150,255,0.08)",padding:"0.2rem 0.5rem",borderRadius:"999px",border:"1px solid rgba(100,150,255,0.15)"}}>❄️ COLD: {coldNumbers.length?coldNumbers.join(" "):"—"}</span>
          </div>
          <div style={{display:"flex",gap:"0.6rem",justifyContent:"center",marginTop:"0.35rem",fontSize:"0.7rem",color:"rgba(240,240,240,0.4)"}}>
            <span>🔴 {redCount}</span><span>⚫ {blackCount}</span><span>🟢 {history.filter(h=>h.color==="green").length}</span><span>· спинов {history.length}</span>
          </div>
        </div>

        <div className={styles.betPanel + " " + styles.panel}>
          <div className={styles.chipRow}>
            {CHIPS.map(v=>(
              <button key={v} className={chip===v?styles.chipActive:styles.chip} onClick={()=>setChip(v)}>{v}</button>
            ))}
            <span className={styles.chipHint}>фишка: {chip}</span>
            <label style={{display:"flex",alignItems:"center",gap:"0.3rem",fontSize:"0.73rem",color:"rgba(240,240,240,0.5)",marginLeft:"0.4rem"}}>
              <input type="checkbox" checked={autoSpin} onChange={e=>setAutoSpin(e.target.checked)} /> авто
            </label>
          </div>

          {/* пресеты — контент-массив 10 пресетов */}
          <div style={{display:"flex",gap:"0.35rem",flexWrap:"wrap",marginTop:"0.6rem"}}>
            {BET_PRESETS.map((pr,i)=>(
              <button key={pr.label+i} onClick={()=>applyPreset(i)} disabled={spinning} style={{padding:"0.3rem 0.55rem",borderRadius:"999px",fontSize:"0.72rem",fontWeight:700,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.06)",color:"rgba(240,240,240,0.85)",opacity:spinning?0.5:1,cursor:spinning?"not-allowed":"pointer"}}>
                <span>{pr.emoji}</span> {pr.label}
              </button>
            ))}
          </div>

          <div className={styles.table}>
            <button className={styles.zero} data-sel={straightTotal(0)>0?"1":undefined} onClick={()=>placeBet("straight",0)}>0<span className={styles.badge}>{straightTotal(0)||""}</span></button>
            <div className={styles.numGrid}>
              {Array.from({length:36},(_,i)=>i+1).map(n=>{
                const c=getColor(n);
                const amt=straightTotal(n);
                return <button key={n} className={styles.numCell} data-color={c} data-sel={amt>0?"1":undefined} onClick={()=>placeBet("straight",n)}>{n}{amt>0&&<span className={styles.badge}>{amt}</span>}</button>;
              })}
            </div>
            <div className={styles.outsideRow}>
              <button className={styles.outBtn} data-color="red" onClick={()=>placeBet("red")}>Красное ×2</button>
              <button className={styles.outBtn} data-color="black" onClick={()=>placeBet("black")}>Чёрное ×2</button>
              <button className={styles.outBtn} onClick={()=>placeBet("even")}>Чёт ×2</button>
              <button className={styles.outBtn} onClick={()=>placeBet("odd")}>Нечёт ×2</button>
              <button className={styles.outBtn} onClick={()=>placeBet("low")}>1-18 ×2</button>
              <button className={styles.outBtn} onClick={()=>placeBet("high")}>19-36 ×2</button>
            </div>
            <div className={styles.dozenRow}>
              <button className={styles.dozenBtn} onClick={()=>placeBet("dozen1")}>1-12 ×3</button>
              <button className={styles.dozenBtn} onClick={()=>placeBet("dozen2")}>13-24 ×3</button>
              <button className={styles.dozenBtn} onClick={()=>placeBet("dozen3")}>25-36 ×3</button>
            </div>
          </div>

          <div className={styles.betInfo}>
            <span>Ставка: <b>{totalBet}</b></span>
            <span className={styles.betCount}>{bets.length} фишек {lastBets.length>0 && `· прошлая ${lastBets.reduce((s,b)=>s+b.amount,0)}`}</span>
          </div>
          <div className={styles.betList}>
            {bets.slice(-10).map((b,i)=>(
              <span key={i} className={styles.betTag}>{b.type==="straight"?`#${b.num}`:b.type} {b.amount}</span>
            ))}
            {bets.length===0 && <span className={styles.betEmpty}>поставь фишки на поле или выбери пресет</span>}
          </div>
          <div className={styles.actions}>
            <button className={styles.spinBtn} disabled={!canSpin} onClick={spin}>{spinning?"Крутим…":"КРУТИТЬ"}</button>
            <button className={styles.ghostBtn} onClick={doubleBets} disabled={bets.length===0 || spinning} title="Удвоить ставки">×2</button>
            <button className={styles.ghostBtn} onClick={repeatLast} disabled={lastBets.length===0 || spinning} title="Повторить прошлую">↻</button>
            <button className={styles.ghostBtn} onClick={removeLast} disabled={bets.length===0}>Отменить</button>
            <button className={styles.ghostBtn} onClick={clearBets} disabled={bets.length===0}>Сброс</button>
          </div>
          {balance<=0 && <div className={styles.busted}>Банк пуст <button className={styles.resetBtn} onClick={resetGame}>Заново 1000</button></div>}
          {balance>0 && balance<WIN_BALANCE && <button className={styles.resetLink} onClick={resetGame}>сбросить прогресс</button>}
          <p className={styles.payoutHint}>Прямая 35:1 · Дюжины 2:1 · Цвет/чёт/половины 1:1 · Zero забирает outside · Пресеты и ×2/↻ для быстрой игры · Свайп по колесу — крутить</p>
        </div>
      </div>

      {showModal && (
        <div className={styles.modalOverlay} onClick={()=>setShowModal(false)}>
          <div className={styles.modal} onClick={e=>e.stopPropagation()}>
            <div className={styles.modalBadge}>42</div>
            <h2>РУЛЕТКА 42 — ПОБЕДА!</h2>
            <p>Баланс {balance} · 4200 достигнуто. Твоя открытка ждёт.</p>
            <div className={styles.postcard}>MAGNUM — 42<br/><span>Спасибо, что сыграл. Забери пресейв и открытку.</span></div>
            <picture><source srcSet="/magnum/images/postcard-4200-800.webp" type="image/webp" /><img src="/magnum/images/postcard-4200.png" alt="Открытка 42 — 4200 монет" className={styles.postcardImg} width={560} height={373} loading="lazy" decoding="async" /></picture>
            <a href={PRESAVE} target="_blank" rel="noreferrer" className={styles.presaveBtn}>Открыть https://music.thefence.me/psmagnum</a>
            <div className={styles.modalActions}>
              <button className={styles.ghostBtn} onClick={()=>setShowModal(false)}>Продолжить играть</button>
              <Link to="/magnum/games" className={styles.ghostBtn}>К играм</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}