import { useState, useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./BlackjackGame.module.css";
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

const PRESAVE = "https://music.thefence.me/psmagnum";
const GOAL = 4200;
const START_BALANCE = 1000;
const MIN_BET = 10;

// ── Контент-массивы 42 / MAGNUM — 50+ строк лора ──
const LORE_TIPS: string[] = [
  "42 — ответ на главный вопрос жизни, вселенной и всего такого. Ставь на 42!",
  "МАGNUM — альбом 5opka: ТУСА МЕДУЗА, VPN, 42 и ещё 9 треков.",
  "БЛЭКДЖЕК 42 платит 3:2 — как в Вегасе, только с вайбом Братишкино.",
  "Дилер стоит на soft 17 — помни, у него нет эмоций, только математика.",
  "Дабл — шанс удвоить ставку, когда чуешь 21. Рискни на 10 или 11!",
  "Стрик x3 даёт +10% к выплате — катай без поражений и фармь быстрее.",
  "4200 монет = Открытка 42 — дойди до цели и забери пресейв MAGNUM!",
  "Фишка 42 — счастливая: ставь 42 и лови блэкджек на 42-й раздаче!",
  "Нажми H — ещё карту, S — хватит, D — дабл, N — новая раздача.",
  "Свайп влево — хит, вправо — стенд. Играй одной рукой на мобиле!",
  "Перебор — главный враг. Стой на 17+, бери на 11- — база стратегия.",
];

const STREAK_TIERS = [{streak:1,label:"Старт",mult:1,color:"rgba(255,255,255,0.5)"},{streak:2,label:"Разогрев",mult:1.05,color:"#ffcc00"},{streak:3,label:"На кураже",mult:1.1,color:"#ff9500"},{streak:5,label:"Гений 42",mult:1.18,color:"#ff2d55"},{streak:7,label:"MAGNUM",mult:1.28,color:"#00ff88"},{streak:10,label:"ЛЕГЕНДА",mult:1.42,color:"#5865f2"}] as const;

const ACHIEVEMENTS = [{id:"first_win",title:"Первый куш",desc:"Выиграй первую раздачу",icon:"🃏"},{id:"blackjack",title:"БЛЭКДЖЕК 42",desc:"Собери блэкджек",icon:"♠️"},{id:"streak3",title:"На кураже x3",desc:"3 победы подряд",icon:"🔥"},{id:"streak5",title:"Гений 42 x5",desc:"5 побед подряд",icon:"⚡"},{id:"double_win",title:"Дабл-мастер",desc:"Выиграй даблом",icon:"💎"},{id:"balance2k",title:"Катка 2K",desc:"Баланс 2000+",icon:"💰"},{id:"balance42",title:"Открытка 42",desc:"Достигни 4200",icon:"🎉"},{id:"ten_wins",title:"Десятка",desc:"10 побед всего",icon:"🏆"},{id:"no_bust10",title:"Холодная голова",desc:"10 раздач без перебора",icon:"🧊"},{id:"comeback",title:"Камбэк",desc:"Победи после 0 монет",icon:"🚀"},{id:"perfect21",title:"21 из 2",desc:"Собери 21 тремя картами",icon:"✨"},{id:"dealer_bust5",title:"Дилер горит",desc:"5 бюстов дилера",icon:"💥"}] as const;

const STRATEGY_HINTS: Record<string, string> = {
  "5-8": "Бери всегда — мало для стопа.",
  "9": "Дабл vs 3-6, иначе бери.",
  "10": "Дабл vs 2-9, иначе бери.",
  "11": "Дабл vs любого, кроме туза дилера.",
  "12": "Стой vs 4-6, иначе бери (рискуй!).",
  "13-16": "Стой vs 2-6, бери vs 7-A.",
  "17+": "Стой всегда — не гори.",
  "soft13-15": "Бери — soft рука, не сгоришь.",
  "soft16-18": "Стой vs 2-6, иначе бери/дабл.",
  "pairA8": "Сплит A и 8 всегда (в MAGNUM — дабл на 11!).",
};

function getStreakMult(streak: number): number {
  let m = 1;
  for (const t of STREAK_TIERS) if (streak >= t.streak) m = t.mult;
  return m;
}
function getStrategyHint(player: Card[], dealerUp: Card | undefined): string {
  if (!dealerUp || player.length === 0) return "Сделай ставку и раздавай!";
  const pv = handValue(player);
  const hasAce = player.some((c) => c.rank === "A" && c.value === 11);
  const soft = hasAce && pv <= 21 && pv >= 13;
  if (soft) {
    if (pv <= 15) return STRATEGY_HINTS["soft13-15"]!;
    return STRATEGY_HINTS["soft16-18"]!;
  }
  if (pv <= 8) return STRATEGY_HINTS["5-8"]!;
  if (pv >= 17) return STRATEGY_HINTS["17+"]!;
  if (pv >= 13 && pv <= 16) return STRATEGY_HINTS["13-16"]!;
  return STRATEGY_HINTS[String(pv)] ?? "Бери карту — математика за хит.";
}

type Suit = "♠" | "♥" | "♦" | "♣";
type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
interface Card { suit: Suit; rank: Rank; value: number; id: string; hidden?: boolean }

const SUITS: Suit[] = ["♠","♥","♦","♣"];
const RANKS: Rank[] = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

function cardValue(r: Rank): number {
  if (r==="A") return 11;
  if (["J","Q","K"].includes(r)) return 10;
  return Number(r);
}
function makeDeck(): Card[] {
  const d: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) d.push({ suit:s, rank:r, value: cardValue(r), id: `${r}${s}${Math.random().toString(36).slice(2,5)}` });
  return shuffle(d);
}
function shuffle<T>(a: T[]): T[] {
  const b=[...a];
  for(let i=b.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); const tmp=b[i]!; b[i]=b[j]!; b[j]=tmp; }
  return b;
}
function handValue(hand: Card[]): number {
  let total = hand.filter(c=>!c.hidden).reduce((s,c)=>s+c.value,0);
  let aces = hand.filter(c=>!c.hidden && c.rank==="A").length;
  while(total>21 && aces>0){ total-=10; aces--; }
  return total;
}
function isBlackjack(hand: Card[]): boolean { return hand.length===2 && handValue(hand)===21; }
function isBust(hand: Card[]): boolean { return handValue(hand)>21; }
function isSoft17(hand: Card[]): boolean {
  const v = handValue(hand);
  if(v!==17) return false;
  // check if ace counts as 11
  let total=0, aces=0;
  for(const c of hand.filter(c=>!c.hidden)){ total+=c.value; if(c.rank==="A") aces++; }
  while(total>21 && aces>0){ total-=10; aces--; }
  return aces>0;
}

// ── WebAudio ──
let ac: AudioContext | null = null;
function ensureAC(): AudioContext | null {
  if (!ac) try { ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { return null; }
  if (ac && ac.state === "suspended") void ac.resume();
  return ac;
}
function safeRamp(param: AudioParam, fn: () => void, fallback: number) {
  try { fn(); } catch { param.value = fallback; }
}
function playDeal() {
  const ctx = ensureAC(); if (!ctx) return;
  // short click like a card snap
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "square"; o.frequency.value = 800;
  safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(400, ctx.currentTime + 0.03), 400);
  g.gain.setValueAtTime(0.12, ctx.currentTime);
  safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.07);
}
function playHit() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "sine"; o.frequency.value = 520;
  safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(680, ctx.currentTime + 0.06), 680);
  g.gain.setValueAtTime(0.1, ctx.currentTime);
  safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.12);
}
function playBust() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "sawtooth"; o.frequency.value = 200;
  safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.3), 80);
  g.gain.setValueAtTime(0.12, ctx.currentTime);
  safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.38);
}
function playBlackjack() {
  const ctx = ensureAC(); if (!ctx) return;
  // triumphant arpeggio
  [0, 0.08, 0.16, 0.26, 0.38].forEach((d, i) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = i % 2 === 0 ? "sine" : "triangle";
    o.frequency.value = 440 + i * 110;
    g.gain.setValueAtTime(0.14, ctx.currentTime + d);
    safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.4), 0.001);
    o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.45);
  });
}
function playWinSound() {
  const ctx = ensureAC(); if (!ctx) return;
  [0, 0.1, 0.2].forEach((d, i) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.value = 523 + i * 110;
    g.gain.setValueAtTime(0.13, ctx.currentTime + d);
    safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.3), 0.001);
    o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.35);
  });
}
function playLoseSound() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "sawtooth"; o.frequency.value = 180;
  safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.25), 100);
  g.gain.setValueAtTime(0.09, ctx.currentTime);
  safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.32);
}
function shakeWin(el: HTMLElement | null) {
  if (!el) return;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  gsap.fromTo(el, { x: -6, rotate: -1 }, { x: 0, rotate: 0, duration: 0.5, ease: "elastic.out(1,0.6)" });
  gsap.fromTo(el, { scale: 1 }, { scale: 1.04, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.out" });
}
function playPush() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "sine"; o.frequency.value = 440;
  g.gain.setValueAtTime(0.08, ctx.currentTime);
  safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.22);
}

type Phase = "betting"|"player"|"dealer"|"result";
type Result = "win"|"lose"|"push"|"blackjack"|null;

export function BlackjackGame(){
  const pageRef = useRef<HTMLDivElement>(null);
  const [balance,setBalance]=useState<number>(START_BALANCE);
  const [best,setBest]=useState<number>(START_BALANCE);
  // Neon — баланс из /magnum/api/coins, best из /magnum/api/games/my (credentials:include)
  useEffect(()=>{
    fetch("/magnum/api/coins",{credentials:"include"}).then(r=>r.ok?r.json():null).then(j=>{
      const v=j?.balance??j?.coins; if(typeof v==="number"&&Number.isFinite(v)) { setBalance(Math.round(v)); setBest(b=>Math.max(b,Math.round(v))); }
    }).catch(()=>{});
    fetch("/magnum/api/games/my",{credentials:"include"}).then(r=>r.ok?r.json():null).then(j=>{
      const arr=j?.scores as {game:string;score:number}[]|undefined; if(!arr) return;
      let m=0; for(const s of arr) if(s.game==="blackjack"&&s.score>m) m=s.score;
      if(m) setBest(b=>Math.max(b,m));
    }).catch(()=>{});
  },[]);
  const [bet,setBet]=useState(25);
  const [deck,setDeck]=useState<Card[]>(()=>makeDeck());
  const [player,setPlayer]=useState<Card[]>([]);
  const [dealer,setDealer]=useState<Card[]>([]);
  const [phase,setPhase]=useState<Phase>("betting");
  const [result,setResult]=useState<Result>(null);
  const [msg,setMsg]=useState("Сделай ставку, братуха!");
  const [history,setHistory]=useState<string[]>([]);
  const [showWin,setShowWin]=useState(false);
  const [dealt,setDealt]=useState(false);
  const winCheckedRef=useRef(false);
  // ── стрик / статистика / конфетти / подсказки ──
  const [streak,setStreak]=useState(0);
  const [bestStreak,setBestStreak]=useState(0);
  const [wins,setWins]=useState(0);
  const [losses,setLosses]=useState(0);
  const [pushes,setPushes]=useState(0);
  const [bjCount,setBjCount]=useState(0);
  const [dealerBusts,setDealerBusts]=useState(0);
  const [tipIdx,setTipIdx]=useState(0);
  const confettiRef=useRef<HTMLCanvasElement>(null);
  const animConfettiRef=useRef(0);
  const touchStartRef=useRef<{x:number;y:number}|null>(null);
  const cardRowRef=useRef<HTMLDivElement>(null);
  const noBustStreakRef=useRef(0);

  // best — максимум баланса, без LS (Neon единый источник)
  useEffect(()=>{ const nb=Math.max(best,balance); if(nb!==best) setBest(nb); },[balance,best]);

  // rotating tip
  useEffect(()=>{ const id=setInterval(()=>setTipIdx(i=> (i+1)%LORE_TIPS.length), 7000); return ()=>clearInterval(id); },[]);

  // haptics
  function haptic(ms:number){ try{ if("vibrate" in navigator) navigator.vibrate(ms); }catch{} }
  function hapticWin(){ haptic(40); setTimeout(()=>haptic(30),80); setTimeout(()=>haptic(50),180); }

  // confetti canvas (WebAudio уже есть — добавим канвас-частицы)
  const spawnConfetti=useCallback((intense=false)=>{
    const c=confettiRef.current; if(!c) return;
    const ctx=c.getContext("2d"); if(!ctx) return;
    const rect=c.getBoundingClientRect();
    const dpr=window.devicePixelRatio||1;
    c.width=rect.width*dpr; c.height=rect.height*dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const colors=["#ff2d55","#ffcc00","#00ff88","#5865f2","#fff"];
    const parts:{x:number;y:number;vx:number;vy:number;rot:number;vr:number;color:string;life:number}[]=[];
    const n=intense? 82: 38;
    for(let i=0;i<n;i++) parts.push({x:rect.width/2+(Math.random()-0.5)*120, y:18, vx:(Math.random()-0.5)*10, vy:Math.random()* -7 -2, rot:Math.random()*360, vr:(Math.random()-0.5)*12, color:colors[i%colors.length]!, life:1});
    cancelAnimationFrame(animConfettiRef.current);
    let frame=0;
    const draw=()=>{
      frame++; ctx.clearRect(0,0,rect.width,rect.height);
      let alive=0;
      for(const p of parts){
        if(p.life<=0) continue;
        p.x+=p.vx; p.y+=p.vy; p.vy+=0.28; p.vx*=0.99; p.rot+=p.vr; p.life-=0.008;
        if(p.life<=0) continue; alive++;
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot*Math.PI/180); ctx.globalAlpha=Math.max(0,p.life);
        ctx.fillStyle=p.color; ctx.fillRect(-4,-6,8,12); ctx.restore();
      }
      if(alive>0 && frame<220) animConfettiRef.current=requestAnimationFrame(draw);
      else ctx.clearRect(0,0,rect.width,rect.height);
    };
    draw();
  },[]);

  function playChip(){
    const ctx=ensureAC(); if(!ctx) return;
    const o=ctx.createOscillator(); const g=ctx.createGain(); o.connect(g); g.connect(ctx.destination);
    o.type="sine"; o.frequency.value=620; safeRamp(o.frequency,()=>o.frequency.linearRampToValueAtTime(880, ctx.currentTime+0.05),880);
    g.gain.setValueAtTime(0.09, ctx.currentTime); safeRamp(g.gain,()=>g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.09),0.001);
    o.start(); o.stop(ctx.currentTime+0.1);
  }
  function playStreak(lvl:number){
    const ctx=ensureAC(); if(!ctx) return;
    const base=440+lvl*70;
    [0,0.07,0.14].forEach((d,i)=>{ const o=ctx.createOscillator(); const g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type="triangle"; o.frequency.value=base+i*90; g.gain.setValueAtTime(0.11, ctx.currentTime+d); safeRamp(g.gain,()=>g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+d+0.25),0.001); o.start(ctx.currentTime+d); o.stop(ctx.currentTime+d+0.28); });
  }
  // victory check
  useEffect(()=>{
    if(balance>=GOAL && !winCheckedRef.current){
      winCheckedRef.current=true;
      setShowWin(true);
    }
    if(balance<GOAL) winCheckedRef.current=false;
  },[balance]);

  const needReshuffle = useCallback((d: Card[])=> d.length<12,[]);

  const draw = useCallback((d: Card[], n=1): [Card[], Card[]]=>{
    let cur=[...d];
    if(needReshuffle(cur)) cur=makeDeck();
    const out: Card[]=[];
    for(let i=0;i<n;i++){
      if(cur.length===0) cur=makeDeck();
      out.push(cur.pop()!);
    }
    return [cur, out];
  },[needReshuffle]);

  const deal = useCallback(()=>{
    if(balance < bet){ setMsg("Недостаточно монет! Уменьши ставку."); return; }
    let d=[...deck];
    if(needReshuffle(d)) d=makeDeck();
    // deal order: P D P D(hidden)
    const [d1,c1]=draw(d,1);
    const [d2,c2]=draw(d1,1);
    const [d3,c3]=draw(d2,1);
    const [d4,c4]=draw(d3,1);
    const p: Card[]=[c1[0]!, c3[0]!];
    const dl: Card[]=[c2[0]!, {...c4[0]!, hidden:true }];
    setDeck(d4);
    setPlayer(p);
    setDealer(dl);
    setPhase("player");
    setResult(null);
    setDealt(true);
    playDeal();

    // immediate blackjack checks
    const pj = isBlackjack(p);
    // dealer blackjack only if his visible is 10/A but we peek? simplified: reveal and check
    const dlFull: Card[]=[c2[0]!, c4[0]!];
    const dj = isBlackjack(dlFull);

    if(pj && dj){
      setDealer(dlFull);
      setPhase("result");
      setResult("push");
      setMsg("Оба БЛЭКДЖЕК — ничья!");
      setHistory(h=> [`PUSH (оба BJ) — ставка возвращена`,...h].slice(0,8));
      playPush();
    } else if(pj){
      const win = Math.floor(bet*1.5);
      setDealer(dlFull);
      setPhase("result");
      setResult("blackjack");
      setBalance(b=>b+win);
      setMsg(`БЛЭКДЖЕК 42! +${win} монет`);
      shakeWin(pageRef.current);
      setHistory(h=> [`BLACKJACK +${win}`,...h].slice(0,8));
      playBlackjack();
      // стрик + статистика BJ
      { const mult=getStreakMult(streak+1); const bonus=Math.floor(win*(mult-1)); if(bonus>0) setBalance(b=>b+bonus);
        setWins(v=>v+1); setBjCount(v=>v+1); noBustStreakRef.current++;
        setStreak(s=>{const ns=s+1; setBestStreak(bs=>Math.max(bs,ns)); if(ns>=3) spawnConfetti(ns>=5); if(ns>=2) playStreak(ns); hapticWin(); return ns;}); }
    } else if(dj){
      // peek dealer BJ - instant lose (rare)
      setDealer(dlFull);
      setPhase("result");
      setResult("lose");
      setBalance(b=>Math.max(0,b-bet));
      setMsg("У дилера БЛЭКДЖЕК — проигрыш");
      setHistory(h=> [`LOSE vs BJ -${bet}`,...h].slice(0,8));
      playLoseSound(); haptic(90); setLosses(v=>v+1); setStreak(0);
    } else {
      setMsg(`Твоя рука ${handValue(p)} — ещё карту?`);
    }
  },[balance,bet,deck,draw,needReshuffle]);

  const hit = useCallback(()=>{
    if(phase!=="player") return;
    let d=[...deck];
    const [nd,c]=draw(d,1);
    const np=[...player, c[0]!];
    setDeck(nd);
    setPlayer(np);
    playHit();
    if(isBust(np)){
      setPhase("result");
      setResult("lose");
      setBalance(b=>Math.max(0,b-bet));
      setMsg(`Перебор ${handValue(np)} — сгорел!`);
      setHistory(h=> [`BUST ${handValue(np)} -${bet}`,...h].slice(0,8));
      playBust(); haptic(80); setLosses(v=>v+1); setStreak(0); noBustStreakRef.current=0;
    } else if(handValue(np)===21){
      // auto stand on 21
      setMsg("21 — стоим!");
    } else {
      setMsg(`У тебя ${handValue(np)} — ещё?`);
    }
  },[phase,deck,draw,player,bet]);

  const stand = useCallback(()=>{
    if(phase!=="player") return;
    // reveal dealer
    let dl: Card[] = dealer.map(c=>({...c, hidden:false}));
    let d=[...deck];
    // dealer draws
    let msgLocal="";
    const doDealer = ()=>{
      while(true){
        const v=handValue(dl);
        if(v>21){ break; }
        if(v>17) break;
        if(v===17 && !isSoft17(dl)) break;
        // hit
        const [nd,c]=draw(d,1);
        d=nd;
        const nc = c[0]!; dl=[...dl, nc];
        if(isBust(dl)) break;
      }
      setDeck(d);
      setDealer(dl);
      const pv=handValue(player);
      const dv=handValue(dl);
      if(isBust(dl)){
        setResult("win");
        setBalance(b=>b+bet);
        msgLocal=`Дилер сгорел (${dv}) — победа +${bet}!`;
        setHistory(h=> [`WIN vs bust +${bet}`,...h].slice(0,8));
        playWinSound(); shakeWin(pageRef.current); { const mult=getStreakMult(streak+1); const bonus=Math.floor(bet*(mult-1)); if(bonus>0){ setBalance(b=>b+bonus); msgLocal+=` +бонус ${bonus}`; } setWins(v=>v+1); setDealerBusts(v=>v+1); noBustStreakRef.current++; setStreak(s=>{const ns=s+1; setBestStreak(bs=>Math.max(bs,ns)); if(ns>=3) spawnConfetti(ns>=5); if(ns>=2) playStreak(ns); hapticWin(); return ns;}); }
      } else if(dv>pv){
        setResult("lose");
        setBalance(b=>Math.max(0,b-bet));
        msgLocal=`Дилер ${dv} vs ${pv} — проигрыш -${bet}`;
        setHistory(h=> [`LOSE ${pv} vs ${dv} -${bet}`,...h].slice(0,8));
        playLoseSound(); haptic(90); setLosses(v=>v+1); setStreak(0); noBustStreakRef.current=0;
      } else if(dv < pv){
        setResult("win");
        setBalance(b=>b+bet);
        msgLocal=`${pv} vs ${dv} — победа +${bet}!`;
        setHistory(h=> [`WIN ${pv} vs ${dv} +${bet}`,...h].slice(0,8));
        playWinSound(); shakeWin(pageRef.current); { const mult=getStreakMult(streak+1); const bonus=Math.floor(bet*(mult-1)); if(bonus>0){ setBalance(b=>b+bonus); msgLocal+=` +бонус ${bonus}`; } setWins(v=>v+1); noBustStreakRef.current++; setStreak(s=>{const ns=s+1; setBestStreak(bs=>Math.max(bs,ns)); if(ns>=3) spawnConfetti(ns>=5); if(ns>=2) playStreak(ns); hapticWin(); return ns;}); }
      } else {
        setResult("push");
        msgLocal=`Ничья ${pv}:${dv} — ставка сохранена`;
        setHistory(h=> [`PUSH ${pv}:${dv}`,...h].slice(0,8));
        playPush(); haptic(25); setPushes(v=>v+1); // стрик не сбрасываем на пуш
      }
      setMsg(msgLocal);
      setPhase("result");
    };
    // slight delay for drama
    setDealer(dl);
    setPhase("dealer");
    setMsg("Дилер добирает...");
    setTimeout(doDealer, 650);
  },[phase,dealer,deck,draw,player,bet]);

  const doubleDown = useCallback(()=>{
    if(phase!=="player" || player.length!==2) return;
    if(balance < bet*2){ setMsg("Недостаточно монет для удвоения!"); return; }
    // double bet for this hand
    let d=[...deck];
    const [nd,c]=draw(d,1);
    const np=[...player, c[0]!];
    setDeck(nd);
    setPlayer(np);
    const doubledBet = bet*2;
    if(isBust(np)){
      setDealer(dealer.map(c=>({...c, hidden:false}))); // reveal for info
      setPhase("result");
      setResult("lose");
      setBalance(b=>Math.max(0,b - doubledBet));
      setMsg(`Дабл — перебор ${handValue(np)}! -${doubledBet}`);
      setHistory(h=> [`DOUBLE BUST -${doubledBet}`,...h].slice(0,8));
      playBust(); haptic(90); setLosses(v=>v+1); setStreak(0); noBustStreakRef.current=0;
      return;
    }
    // otherwise dealer plays with doubled bet
    let dl: Card[] = dealer.map(c=>({...c, hidden:false}));
    let curD=nd;
    // dealer loop
    while(true){
      const v=handValue(dl);
      if(v>21) break;
      if(v>17) break;
      if(v===17 && !isSoft17(dl)) break;
      const [n2,cc]=draw(curD,1);
      curD=n2;
      const nc2=cc[0]!; dl=[...dl, nc2] as Card[];
      if(isBust(dl)) break;
    }
    setDeck(curD);
    setDealer(dl);
    const pv=handValue(np);
    const dv=handValue(dl);
    if(isBust(dl)){
      setResult("win");
      setBalance(b=>b+doubledBet);
      setMsg(`Дабл! Дилер сгорел — +${doubledBet} 🔥`);
      setHistory(h=> [`DOUBLE WIN +${doubledBet}`,...h].slice(0,8));
      playWinSound(); shakeWin(pageRef.current); { const mult=getStreakMult(streak+1); const bonus=Math.floor(doubledBet*(mult-1)); if(bonus>0) setBalance(b=>b+bonus); setWins(v=>v+1); noBustStreakRef.current++; setStreak(s=>{const ns=s+1; setBestStreak(bs=>Math.max(bs,ns)); if(ns>=3) spawnConfetti(ns>=5); if(ns>=2) playStreak(ns); hapticWin(); return ns;}); }
    } else if(dv>pv){
      setResult("lose");
      setBalance(b=>Math.max(0,b-doubledBet));
      setMsg(`Дабл: ${pv} vs ${dv} — проигрыш -${doubledBet}`);
      setHistory(h=> [`DOUBLE LOSE -${doubledBet}`,...h].slice(0,8));
      playLoseSound(); haptic(90); setLosses(v=>v+1); setStreak(0); noBustStreakRef.current=0;
    } else if(dv < pv){
      setResult("win");
      setBalance(b=>b+doubledBet);
      setMsg(`Дабл победа ${pv} vs ${dv} +${doubledBet}!`);
      setHistory(h=> [`DOUBLE WIN +${doubledBet}`,...h].slice(0,8));
      playWinSound(); shakeWin(pageRef.current); { const mult=getStreakMult(streak+1); const bonus=Math.floor(doubledBet*(mult-1)); if(bonus>0) setBalance(b=>b+bonus); setWins(v=>v+1); noBustStreakRef.current++; setStreak(s=>{const ns=s+1; setBestStreak(bs=>Math.max(bs,ns)); if(ns>=3) spawnConfetti(ns>=5); if(ns>=2) playStreak(ns); hapticWin(); return ns;}); }
    } else {
      setResult("push");
      setMsg(`Дабл ничья ${pv}:${dv}`);
      setHistory(h=> [`DOUBLE PUSH`,...h].slice(0,8));
      playPush(); haptic(25); setPushes(v=>v+1);
    }
    setPhase("result");
  },[phase,player,dealer,deck,draw,bet,balance]);

  const nextRound = useCallback(()=>{
    setPlayer([]);
    setDealer([]);
    setPhase("betting");
    setResult(null);
    setDealt(false);
    setMsg(balance<=0 ? "Банк пуст — сброс!" : "Новая раздача — ставь монеты");
    if(balance<=0){
      // auto reset to 200 to avoid softlock
      setBalance(200);
      setBet(25);
      setMsg("Банк пополнен до 200 — снова в игру!");
    }
  },[balance]);

  const resetAll = useCallback(()=>{
    setBalance(START_BALANCE);
    setBest(START_BALANCE);
    setPlayer([]); setDealer([]); setDeck(makeDeck()); setPhase("betting"); setResult(null); setShowWin(false); winCheckedRef.current=false; setMsg("Баланс сброшен — 1000 монет!");
    setHistory([]);
  },[]);

  const canDouble = phase==="player" && player.length===2 && balance>=bet*2;
  const playerVal = handValue(player);
  const dealerValVisible = dealer.filter(c=>!c.hidden).reduce((s,c)=>s+c.value,0) - (dealer.some(c=>c.hidden && c.rank==="A")?0:0);
  // better visible calc with ace soft
  const dealerShownVal = (()=>{ const v=dealer.filter(c=>!c.hidden); if(!v.length) return 0; return handValue(v as Card[]); })();

  const betChips = [10,25,50,100,250];

  // ── управление: клавиатура H/S/D/N/P/Space + свайп + GSAP раздача ──
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      const k=e.key.toLowerCase();
      if(phase==="betting" && (k===" "||k==="enter")){ e.preventDefault(); deal(); return; }
      if(phase==="player"){
        if(k==="h"){ e.preventDefault(); hit(); }
        else if(k==="s"){ e.preventDefault(); stand(); }
        else if(k==="d" && canDouble){ e.preventDefault(); doubleDown(); }
      }
      if(phase==="result" && k==="n"){ e.preventDefault(); nextRound(); }
      if((phase==="player"||phase==="dealer") && (k==="p"||k===" ")){ /* pause not needed */ }
    };
    window.addEventListener("keydown", onKey);
    return ()=>window.removeEventListener("keydown", onKey);
  },[phase, bet, balance, canDouble, deal, hit, stand, doubleDown, nextRound]);

  // GSAP: карты влетают стаггером при раздаче
  useEffect(()=>{
    if(!dealt || !cardRowRef.current) return;
    if(prefersReducedMotion()) return;
    const cards=cardRowRef.current.querySelectorAll(`.${"card"}`);
    if(!cards.length) return;
    gsap.set(cards,{ y:24, opacity:0, scale:0.92, rotation: -2 });
    gsap.to(cards,{ y:0, opacity:1, scale:1, rotation:0, stagger:0.08, duration:0.45, ease:"back.out(1.2)", overwrite:true });
  },[dealt, player.length, dealer.length]);

  const onTouchStart=useCallback((e:React.TouchEvent)=>{
    const t0=e.touches[0]; if(!t0) return; touchStartRef.current={x:t0.clientX, y:t0.clientY};
  },[]);
  const onTouchEnd=useCallback((e:React.TouchEvent)=>{
    if(phase!=="player"||!touchStartRef.current) return;
    const t0=e.changedTouches[0]; if(!t0) return;
    const dx=t0.clientX-touchStartRef.current.x; const dy=t0.clientY-touchStartRef.current.y;
    touchStartRef.current=null;
    if(Math.abs(dx)<42 || Math.abs(dy)>80) return;
    if(dx<0) hit(); else stand();
  },[phase, hit, stand]);

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

  return (
    <div className={styles.page} ref={pageRef}>
      <h1>БЛЭКДЖЕК 42</h1>
      <p className={styles.sub}>Собери 21 • Дилер берёт до 17 • Цель {GOAL.toLocaleString("ru-RU")} монет</p>

      <div className={styles.hud}>
        <div className={styles.balance}><span>Баланс</span><strong className={balance>=GOAL?styles.gold:""}>{balance} <i>◉</i></strong></div>
        <div className={styles.progressWrap}><div className={styles.progress}><div className={styles.fill} style={{width:`${Math.min(100, (balance/GOAL)*100)}%`}}/></div><span className={styles.goal}>{balance}/{GOAL}</span></div>
        <div className={styles.stat}><span>Рекорд</span><strong>{best}</strong></div>
      </div>

      {/* Стрик + статистика */}
      <div style={{display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center", alignItems:"center", width:"100%", maxWidth:560, padding:"0 1rem"}}>
        <div style={{display:"flex", alignItems:"center", gap:6, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"0.35rem 0.7rem"}}>
          <span style={{fontSize:"0.72rem", color:"rgba(240,240,240,0.55)"}}>Стрик</span>
          <strong style={{color: streak>=3? STREAK_TIERS.find(t=>streak>=t.streak)?.color ?? "#ffcc00" : "rgba(255,255,255,0.85)", fontSize:"0.95rem"}}>{streak} {streak>=3?"🔥":streak>=2?"⚡":""}</strong>
          <span style={{fontSize:"0.68rem", color:"rgba(240,240,240,0.4)"}}>×{getStreakMult(streak).toFixed(2)} {streak>=3? STREAK_TIERS.find(t=>streak>=t.streak)?.label:""}</span>
          {bestStreak>0 && <span style={{fontSize:"0.66rem", color:"rgba(240,240,240,0.35)"}}>· рекорд {bestStreak}</span>}
        </div>
        <div style={{display:"flex", gap:6, fontSize:"0.72rem", color:"rgba(240,240,240,0.55)"}}>
          <span style={{background:"rgba(0,255,136,0.08)", border:"1px solid rgba(0,255,136,0.15)", borderRadius:999, padding:"0.2rem 0.5rem"}}>W {wins}</span>
          <span style={{background:"rgba(255,45,85,0.08)", border:"1px solid rgba(255,45,85,0.15)", borderRadius:999, padding:"0.2rem 0.5rem"}}>L {losses}</span>
          <span style={{background:"rgba(255,204,0,0.08)", border:"1px solid rgba(255,204,0,0.15)", borderRadius:999, padding:"0.2rem 0.5rem"}}>P {pushes}</span>
          <span style={{background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:999, padding:"0.2rem 0.5rem"}}>BJ {bjCount}</span>
        </div>
      </div>

      <div style={{fontSize:"0.74rem", color:"rgba(240,240,240,0.42)", maxWidth:560, textAlign:"center", padding:"0 1rem", minHeight:18}}>
        💡 {LORE_TIPS[tipIdx]} <button onClick={()=>setTipIdx(i=>(i+1)%LORE_TIPS.length)} style={{marginLeft:6, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:999, padding:"0.15rem 0.5rem", fontSize:"0.68rem", color:"rgba(240,240,240,0.6)", cursor:"pointer"}}>ещё</button>
      </div>

      <div className={styles.table} ref={cardRowRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{position:"relative", overflow:"hidden"}}>
        <canvas ref={confettiRef} style={{position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none", zIndex:5}} width={560} height={260} />
        {/* Dealer */}
        <div className={styles.handBlock}>
          <div className={styles.handHead}><span>Дилер</span><span className={styles.handVal}>{phase==="betting" ? "—" : phase==="result" || dealt && dealer.every(c=>!c.hidden) ? handValue(dealer) : `${dealerShownVal} + ?`}</span>{dealer.length>0 && isBlackjack(dealer.filter(c=>!c.hidden) as Card[]) && phase==="result" && <span className={styles.badgeBJ}>BJ</span>}</div>
          <div className={styles.cards}>
            {dealer.length===0 && <div className={styles.placeholder}>Карты дилера</div>}
            {dealer.map((c,i)=>(
              <div key={c.id+i} className={`${styles.card} ${c.hidden?styles.hidden:""} ${c.suit==="♥"||c.suit==="♦"?styles.red:""}`} style={{zIndex:i, marginLeft: i===0?0:-18}}>
                {c.hidden ? <div className={styles.cardBack}><span>42</span></div> : <><span className={styles.rank}>{c.rank}</span><span className={styles.suit}>{c.suit}</span><span className={styles.rankSm}>{c.rank}</span></>}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.divider}/>

        {/* Player */}
        <div className={styles.handBlock}>
          <div className={styles.handHead}><span>Ты</span><span className={`${styles.handVal} ${playerVal>21?styles.bust: playerVal===21?styles.twentyOne:""}`}>{player.length? playerVal : "—"}</span>{isBlackjack(player) && <span className={styles.badgeBJ}>BJ 3:2</span>}{playerVal>21 && <span className={styles.badgeBust}>ПЕРЕБОР</span>}</div>
          <div className={styles.cards}>
            {player.length===0 && <div className={styles.placeholder}>Твои карты</div>}
            {player.map((c,i)=>(
              <div key={c.id+i} className={`${styles.card} ${c.suit==="♥"||c.suit==="♦"?styles.red:""}`} style={{zIndex:i, marginLeft: i===0?0:-18}}>
                <span className={styles.rank}>{c.rank}</span><span className={styles.suit}>{c.suit}</span><span className={styles.rankSm}>{c.rank}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.msg} data-result={result||""}>{msg}</div>
        {phase==="player" && player.length>0 && (
          <div style={{fontSize:"0.74rem", color:"rgba(0,255,136,0.85)", background:"rgba(0,255,136,0.06)", border:"1px solid rgba(0,255,136,0.14)", borderRadius:10, padding:"0.35rem 0.6rem", marginTop:4}}>
            🤖 Подсказка: {getStrategyHint(player, dealer.find(c=>!c.hidden))} <span style={{opacity:0.55}}>(H/S/D)</span>
          </div>
        )}
      </div>

      {/* Betting */}
      {phase==="betting" && (
        <div className={styles.betting}>
          <div className={styles.betRow}>
            <span className={styles.betLabel}>Ставка:</span><strong className={styles.betVal}>{bet} ◉</strong>
            <button className={styles.miniBtn} onClick={()=>setBet(b=>Math.max(MIN_BET, b-10))}>−10</button>
            <button className={styles.miniBtn} onClick={()=>setBet(b=>Math.min(balance, b+10))}>+10</button>
            <button className={styles.miniBtn} onClick={()=>setBet(Math.min(balance, Math.max(MIN_BET, Math.floor(balance/2))))}>½</button>
            <button className={styles.miniBtn} onClick={()=>setBet(balance)}>MAX</button>
          </div>
          <div className={styles.chips}>
            {betChips.map(v=>(
              <button key={v} disabled={balance < v} onClick={()=>{ setBet(v); playChip(); haptic(12); }} className={`${styles.chip} ${bet===v?styles.chipActive:""}`}>{v}</button>
            ))}
          </div>
          <button className={styles.dealBtn} onClick={deal} disabled={balance<bet || bet<MIN_BET}>Раздать 🃏</button>
          <div className={styles.rules}>BJ платит 3:2 • Дилер стоит на 17 • Дабл только на 2 картах • Перебор = проигрыш</div>
        </div>
      )}

      {/* Player actions */}
      {phase==="player" && (
        <div className={styles.controls}>
          <button className={styles.hitBtn} onClick={hit}>Ещё карту</button>
          <button className={styles.standBtn} onClick={stand}>Хватит</button>
          <button className={styles.doubleBtn} onClick={doubleDown} disabled={!canDouble} title={!canDouble?"Нужны 2 карты и баланс x2":"Удвоить и взять 1 карту"}>Дабл x2</button>
        </div>
      )}
      {phase==="dealer" && <div className={styles.controls}><span className={styles.dealing}>Дилер играет...</span></div>}

      {phase==="result" && (
        <div className={styles.controls}>
          <div className={`${styles.resultBadge} ${result==="win"||result==="blackjack"?styles.win : result==="push"?styles.push:styles.lose}`}>
            {result==="blackjack" ? "БЛЭКДЖЕК!" : result==="win" ? "ПОБЕДА!" : result==="push" ? "НИЧЬЯ" : "ПРОИГРЫШ"}
          </div>
          <button className={styles.dealBtn} onClick={nextRound}>Следующая раздача</button>
        </div>
      )}

      <div className={styles.bottomRow}>
        <Link to="/magnum/games" className={styles.back}>← К играм</Link>
        <button className={styles.resetBtn} onClick={resetAll}>Сброс баланса</button>
      </div>

      {history.length>0 && (
        <div className={styles.history}>
          <span className={styles.historyTitle}>История</span>
          {history.map((h,i)=><span key={i} className={styles.historyItem}>{h}</span>)}
        </div>
      )}

      <div style={{display:"flex", gap:6, flexWrap:"wrap", justifyContent:"center", maxWidth:560, padding:"0 0.5rem"}}>
        {ACHIEVEMENTS.map(a=>{ const unlocked = (a.id==="first_win"&&wins>=1)||(a.id==="blackjack"&&bjCount>=1)||(a.id==="streak3"&&bestStreak>=3)||(a.id==="streak5"&&bestStreak>=5)||(a.id==="balance2k"&&best>=2000)||(a.id==="balance42"&&best>=4200)||(a.id==="ten_wins"&&wins>=10)||(a.id==="dealer_bust5"&&dealerBusts>=5); return <span key={a.id} title={`${a.title} — ${a.desc}`} style={{fontSize:"0.68rem", padding:"0.2rem 0.45rem", borderRadius:999, border:"1px solid", borderColor: unlocked?"rgba(255,204,0,0.35)":"rgba(255,255,255,0.07)", background: unlocked?"rgba(255,204,0,0.12)":"rgba(255,255,255,0.03)", color: unlocked?"#ffcc00":"rgba(240,240,240,0.35)", opacity: unlocked?1:0.55}}>{a.icon} {a.title}</span>; })}
      </div>

      <p className={styles.hint}>Подсказка: стой на 17+, бери на 11- • Дилер стоит на soft 17 • Цель 4200 = Открытка 42</p>

      {showWin && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <div className={styles.modalIcon}>🎉</div>
            <h2>Открытка 42</h2>
            <picture><source srcSet="/magnum/images/postcard-4200-800.webp" type="image/webp" /><img src="/magnum/images/postcard-4200.png" alt="Открытка 42 — 4200 монет" className={styles.postcardImg} width={560} height={373} loading="lazy" decoding="async" /></picture>
            <p>Братуха, ты нафармил <strong>{balance}</strong> монет!</p>
            <p className={styles.winSub}>Цель {GOAL} достигнута — казино 42 повержено!</p>
            <div className={styles.modalStats}><span>Баланс {balance} ◉</span><span>Рекорд {best} ◉</span></div>
            <a href={PRESAVE} target="_blank" rel="noreferrer" className={styles.presaveBtn}>Забрать пресейв MAGNUM →</a>
            <div className={styles.modalActions}>
              <button className={styles.playAgainBtn} onClick={()=>setShowWin(false)}>Продолжить катать</button>
              <button className={styles.resetBtn} onClick={resetAll}>Новая игра</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}