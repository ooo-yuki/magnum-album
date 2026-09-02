import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./MemoryGame.module.css";
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

// ──────────────────────────────────────────────────────────────
// КОНТЕНТ-МАССИВЫ 50+ строк — THEMES + DIFFICULTY + ACHIEVEMENTS
// ──────────────────────────────────────────────────────────────
const THEMES = [
  { id: "classic", label: "42 Classic", emoji: "🪼", colors: ["#ff2d55","#ffcc00"], symbols: ["🪼","🧥","🕶️","🍄","⛓️","🎵","4️⃣","2️⃣","🔥","⭐","🎮","💎"] as const, desc: "Канон 42: медуза, куртка, очки" },
  { id: "magnum", label: "MAGNUM", emoji: "●", colors: ["#ff2d55","#5865f2"], symbols: ["●","🧱","🔒","🎤","💿","🏆","🦊","🌙","⚡","🎯","💥","🚀"] as const, desc: "5 пуль — Туса Медуза, VPN, CLAY" },
  { id: "freakland", label: "Freakland", emoji: "⛏️", colors: ["#00ff88","#ffcc00"], symbols: ["⛏️","🏰","🐺","🌲","🗡️","🛡️","💰","📜","🔮","🧪","👑","🏹"] as const, desc: "Майнкрафт-мир Парадевича" },
  { id: "bratukhi", label: "Братухи", emoji: "🤟", colors: ["#ff6b35","#ff2d55"], symbols: ["🤟","😎","🎬","🍕","🏀","🎧","📸","🚗","🎪","🥊","🍿","❤️"] as const, desc: "Вайб братух — флекс 24/7" },
] as const;
type ThemeId = typeof THEMES[number]["id"];

const DIFFICULTY = {
  easy: { label: "Изи", cols: 3, pairs: 6, total: 12, timeBonus: 120, win: 1500, hint: 3, desc: "3×4 · 6 пар" },
  normal: { label: "Норм", cols: 4, pairs: 8, total: 16, timeBonus: 200, win: 4200, hint: 3, desc: "4×4 · 8 пар" },
  hard: { label: "Хард", cols: 6, pairs: 12, total: 24, timeBonus: 360, win: 7200, hint: 2, desc: "6×4 · 12 пар" },
} as const;
type DiffKey = keyof typeof DIFFICULTY;

const ACHIEVEMENTS = [
  { id: "first", label: "Первый мэтч", need: 1, emoji: "✨" },
  { id: "combo3", label: "Комбо ×3", need: 3, emoji: "🔥" },
  { id: "combo5", label: "Комбо ×5 FEVER", need: 5, emoji: "💥" },
  { id: "speed30", label: "Спидран <30с", need: 30, emoji: "⚡" },
  { id: "perfect", label: "Идеально (пары==ходы)", need: 0, emoji: "💎" },
  { id: "allThemes", label: "Все темы", need: 4, emoji: "🎨" },
] as const;

// баланс: очки = база + комбо + время
const SCORE_BASE = 120;
const SCORE_COMBO_STEP = 35;
const SCORE_TIME_FACTOR = 4;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

interface Card {
  id: number;
  symbol: string;
  flipped: boolean;
  matched: boolean;
}

// ---------- WebAudio — расширено ----------
let ac: AudioContext | null = null;
function ensureAC(): AudioContext | null {
  if (!ac) {
    try {
      const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      ac = new Ctx();
    } catch {
      return null;
    }
  }
  if (ac.state === "suspended") void ac.resume();
  return ac;
}
function safeRamp(param: AudioParam, fn: () => void, fallback: number) {
  try { fn(); } catch { param.value = fallback; }
}
function playFlip() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "sine"; o.frequency.value = 420;
  safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(680, ctx.currentTime + 0.07), 680);
  g.gain.setValueAtTime(0.14, ctx.currentTime);
  safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.14);
}
function playMatch(combo: number) {
  const ctx = ensureAC(); if (!ctx) return;
  const base = 660 + Math.min(combo * 40, 280);
  [0, 0.09].forEach((d, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.value = i === 0 ? base : base + 220;
    safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(i === 0 ? base + 120 : base + 340, ctx.currentTime + d + 0.08), base + 340);
    g.gain.setValueAtTime(0.18, ctx.currentTime + d);
    safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.22), 0.001);
    o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.22);
  });
  if (combo >= 3) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination);
    o.type = "triangle"; o.frequency.value = 1320;
    g.gain.setValueAtTime(0.08, ctx.currentTime); safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18), 0.001);
    o.start(); o.stop(ctx.currentTime + 0.18);
  }
}
function playFever() {
  const ctx = ensureAC(); if (!ctx) return;
  [0,0.08,0.16].forEach((d,i)=>{
    const o=ctx.createOscillator(), g=ctx.createGain(); o.connect(g); g.connect(ctx.destination);
    o.type="sine"; o.frequency.value=880 + i*220;
    g.gain.setValueAtTime(0.14, ctx.currentTime+d); safeRamp(g.gain, ()=>g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+d+0.3),0.001);
    o.start(ctx.currentTime+d); o.stop(ctx.currentTime+d+0.3);
  });
}
function playMiss() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "square"; o.frequency.value = 160;
  safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.12), 110);
  g.gain.setValueAtTime(0.11, ctx.currentTime);
  safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.18);
}
function playHint() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(), g=ctx.createGain(); o.connect(g); g.connect(ctx.destination);
  o.type="sine"; o.frequency.value=520; safeRamp(o.frequency, ()=>o.frequency.linearRampToValueAtTime(720, ctx.currentTime+0.12),720);
  g.gain.setValueAtTime(0.12, ctx.currentTime); safeRamp(g.gain, ()=>g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.25),0.001);
  o.start(); o.stop(ctx.currentTime+0.25);
}
function playWin() {
  const ctx = ensureAC(); if (!ctx) return;
  [0, 0.14, 0.28, 0.42].forEach((d, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.value = 523 + i * 110;
    g.gain.setValueAtTime(0.16, ctx.currentTime + d);
    safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.5), 0.001);
    o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.5);
  });
  const bo=ctx.createOscillator(), bg=ctx.createGain(); bo.connect(bg); bg.connect(ctx.destination);
  bo.type="sine"; bo.frequency.value=88; safeRamp(bo.frequency, ()=>bo.frequency.linearRampToValueAtTime(55, ctx.currentTime+0.6),55);
  bg.gain.setValueAtTime(0.18, ctx.currentTime); safeRamp(bg.gain, ()=>bg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.9),0.001);
  bo.start(); bo.stop(ctx.currentTime+0.9);
}

// ---------- Confetti (win) ----------
function Confetti({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!active || !ref.current) return;
    const canvas = ref.current;
    const ctx = canvas.getContext("2d")!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ["#ff2d55", "#ffcc00", "#00ff88", "#5865f2", "#fff"];
    type P = { x: number; y: number; vx: number; vy: number; r: number; c: string; rot: number; vr: number };
    const parts: P[] = Array.from({ length: 180 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 280,
      vx: (Math.random() - 0.5) * 8,
      vy: 2 + Math.random() * 6,
      r: 5 + Math.random() * 7,
      c: colors[Math.floor(Math.random() * colors.length)]!,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.35,
    }));
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = 0;
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.09; p.rot += p.vr; p.vx *= 0.991;
        if (p.y < canvas.height + 24) alive++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.globalAlpha = Math.max(0, 1 - (p.y / canvas.height) * 0.18);
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.62);
        ctx.restore();
      }
      if (alive > 0) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const onResize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, [active]);
  if (!active) return null;
  return <canvas ref={ref} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 300 }} />;
}

// ---------- Match particles (burst per pair) ----------
type Burst = { x: number; y: number; id: number };
function BurstLayer({ bursts, onDone }: { bursts: Burst[]; onDone: (id: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (bursts.length === 0) return;
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const upd = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    upd();
    window.addEventListener("resize", upd);
    type P2 = { x: number; y: number; vx: number; vy: number; r: number; life: number; c: string };
    const colors = ["#00ff88", "#ffcc00", "#ff2d55", "#fff", "#5865f2"];
    const all: P2[] = [];
    for (const b of bursts) {
      for (let i = 0; i < 24; i++) {
        const ang = (Math.PI * 2 * i) / 24 + Math.random() * 0.3;
        const sp = 3 + Math.random() * 7;
        all.push({ x: b.x, y: b.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - Math.random() * 2, r: 3 + Math.random() * 4, life: 1, c: colors[Math.floor(Math.random() * colors.length)]! });
      }
    }
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let any = false;
      for (const p of all) {
        if (p.life <= 0) continue;
        p.x += p.vx; p.y += p.vy; p.vy += 0.28; p.vx *= 0.98; p.life -= 0.018;
        if (p.life > 0) any = true;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (any) raf = requestAnimationFrame(draw);
      else bursts.forEach((b) => onDone(b.id));
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", upd); };
  }, [bursts, onDone]);
  if (bursts.length === 0) return null;
  return <canvas ref={ref} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 150 }} />;
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function MemoryGame() {
  const [diff, setDiff] = useState<DiffKey>("normal");
  const [theme, setTheme] = useState<ThemeId>("classic");
  const themeData = THEMES.find(t=>t.id===theme) ?? THEMES[0]!;
  const diffData = DIFFICULTY[diff];

  const genCards = useCallback((d: DiffKey, th: ThemeId): Card[] => {
    const td = THEMES.find(t=>t.id===th) ?? THEMES[0]!;
    const pool = td.symbols;
    const need = DIFFICULTY[d].pairs;
    const chosen = shuffle([...pool]).slice(0, need);
    return shuffle([...chosen, ...chosen]).map((s, i) => ({ id: i, symbol: s, flipped: false, matched: false }));
  }, []);

  const [cards, setCards] = useState<Card[]>(() => genCards("normal","classic"));
  const [first, setFirst] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [won, setWon] = useState(false);
  const [moves, setMoves] = useState(0);
  const [pairs, setPairs] = useState(0);
  const [sec, setSec] = useState(0);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [scoreBump, setScoreBump] = useState(false);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [fever, setFever] = useState(false);
  const [hints, setHints] = useState(diffData.hint);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState<number>(0);
  useEffect(()=>{ fetch("/magnum/api/games/my",{credentials:"include"}).then(r=>r.ok?r.json():null).then(j=>{ const arr=j?.scores as {game:string;score:number}[]|undefined; if(!arr) return; let m=0; for(const s of arr) if(s.game==="memory"&&s.score>m) m=s.score; if(m) setBest(m); }).catch(()=>{}); },[]);
  const [focusIdx, setFocusIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const burstIdRef = useRef(0);
  const touchStartRef = useRef<{x:number;y:number}|null>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (prefersReducedMotion()) { gsap.set(`.${styles.grid} .${styles.card}`, { scale: 1, opacity: 1, clearProps: "transform" }); return; }
    const ctx = gsap.context(() => {
      gsap.from(`.${styles.grid} .${styles.card}`, { scale: 0.8, opacity: 0, stagger: 0.06, duration: 0.42, ease: "back.out(1.4)", delay: 0.18 });
    }, ref);
    return () => ctx.revert();
  }, [diff, theme]);

  // timer
  useEffect(() => {
    if (won) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      return;
    }
    if (!startedRef.current) return;
    timerRef.current = window.setInterval(() => setSec((s) => s + 1), 1000);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [won]);

  useEffect(() => {
    const root: HTMLElement | null = document.querySelector<HTMLElement>("[data-gsap-root]") || (document.body as unknown as HTMLElement);
    if (!root) return;
    if (prefersReducedMotion()) {
      const els = root.querySelectorAll<HTMLElement>(".card, [data-card]");
      if (els.length) gsap.set(els, { y: 0, opacity: 1, clearProps: "transform" });
      return;
    }
    const ctx = gsap.context(() => {
      const heroEls = root.querySelectorAll<HTMLElement>(".hero > *, [data-hero] > *");
      if (heroEls.length) {
        gsap.set(heroEls, { y: 24, opacity: 0 });
        gsap.to(heroEls, { y: 0, opacity: 1, stagger: 0.12, duration: 0.55, ease: "power2.out", delay: 0.05, overwrite: true });
      }
    }, root);
    return () => ctx.revert();
  }, []);

  // keyboard navigation — стрелки + Enter/Space, R рестарт
  useEffect(() => {
    const cols = DIFFICULTY[diff].cols;
    const total = DIFFICULTY[diff].total;
    const onKey=(e:KeyboardEvent)=>{
      if (won && e.code==="KeyR") { e.preventDefault(); restart(); return; }
      if (["ArrowRight","ArrowLeft","ArrowUp","ArrowDown"].includes(e.code)) {
        e.preventDefault();
        setFocusIdx(prev=>{
          let n=prev;
          if(e.code==="ArrowRight") n=(prev+1)%total;
          if(e.code==="ArrowLeft") n=(prev-1+total)%total;
          if(e.code==="ArrowDown") n=Math.min(total-1, prev+cols);
          if(e.code==="ArrowUp") n=Math.max(0, prev-cols);
          const el=gridRef.current?.querySelectorAll<HTMLElement>(`.${styles.card}`)[n];
          el?.focus();
          return n;
        });
      }
      if (e.code==="Enter"||e.code==="Space") {
        const el=document.activeElement as HTMLElement|null;
        if(el?.classList.contains(styles.card)) {
          e.preventDefault();
          const idx=Array.from(gridRef.current?.querySelectorAll(`.${styles.card}`)??[]).indexOf(el);
          if(idx>=0) handleClick(idx);
        } else {
          // fallback to focused index
          if(!won && !locked) handleClick(focusIdx);
        }
      }
      if(e.code==="KeyH") { e.preventDefault(); doHint(); }
    };
    window.addEventListener("keydown", onKey);
    return ()=>window.removeEventListener("keydown", onKey);
  }, [diff, won, locked, focusIdx]);

  // swipe handlers on grid — горизонталь смена сложности, вертикаль хинт
  const onTouchStart = useCallback((e: React.TouchEvent)=>{
    const t=e.touches[0]; if(!t) return;
    touchStartRef.current={x:t.clientX, y:t.clientY};
  },[]);
  const onTouchEnd = useCallback((e: React.TouchEvent)=>{
    const s=touchStartRef.current; const t=e.changedTouches[0]; if(!s||!t) return;
    const dx=t.clientX-s.x, dy=t.clientY-s.y;
    if(Math.abs(dx)>Math.abs(dy) && Math.abs(dx)>48){
      if(dx>0){
        // next diff
        const order:(DiffKey)[]=["easy","normal","hard"];
        const i=order.indexOf(diff); if(i<2) { const nd=order[i+1]!; setDiff(nd); restartWith(nd, theme); if(navigator.vibrate) navigator.vibrate(20); }
      } else {
        const order:(DiffKey)[]=["easy","normal","hard"];
        const i=order.indexOf(diff); if(i>0) { const nd=order[i-1]!; setDiff(nd); restartWith(nd, theme); if(navigator.vibrate) navigator.vibrate(20); }
      }
    } else if(dy < -56 && Math.abs(dy)>Math.abs(dx)) {
      doHint();
    }
    touchStartRef.current=null;
  },[diff, theme]);

  const ensureTimer = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => setSec((s) => s + 1), 1000);
  }, []);

  const triggerBurstAt = useCallback((el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const id = ++burstIdRef.current;
    setBursts((prev) => [...prev, { x, y, id }]);
  }, []);

  const restartWith = useCallback((nd: DiffKey, nt: ThemeId)=>{
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current=null; startedRef.current=false;
    setCards(genCards(nd, nt)); setFirst(null); setLocked(false); setWon(false);
    setMoves(0); setPairs(0); setSec(0); setBursts([]); setScoreBump(false);
    setCombo(0); setMaxCombo(0); setFever(false); setHints(DIFFICULTY[nd].hint); setScore(0); setFocusIdx(0);
    setTimeout(()=>{ if(!gridRef.current) return; if(prefersReducedMotion()) return; gsap.from(`.${styles.grid} .${styles.card}`, { scale:0.85, opacity:0, stagger:0.02, duration:0.36, ease:"back.out(1.4)" }); },40);
  },[genCards]);

  const doHint = useCallback(()=>{
    if(won||locked||hints<=0) return;
    const hidden=cards.filter(c=>!c.flipped && !c.matched);
    if(hidden.length<2) return;
    // найти пару среди скрытых
    const bySym=new Map<string, number[]>();
    hidden.forEach(c=>{ const a=bySym.get(c.symbol)??[]; a.push(c.id); bySym.set(c.symbol,a); });
    let pair: number[]|null=null;
    for(const [,ids] of bySym){ if(ids.length>=2){ pair=ids.slice(0,2); break; } }
    if(!pair) return;
    setHints((h)=> (h-1) as typeof hints); playHint();
    const [aId,bId]=pair as [number,number];
    setCards(prev=>prev.map(c=> c.id===aId||c.id===bId ? {...c, flipped:true}:c));
    const els=gridRef.current?.querySelectorAll<HTMLElement>(`.${styles.card}`);
    [aId,bId].forEach(id=>{
      const el=els?.[id]; if(el && !prefersReducedMotion()) gsap.fromTo(el,{scale:1},{scale:1.08, duration:0.12, yoyo:true, repeat:1, ease:"power1.out"});
    });
    if(navigator.vibrate) navigator.vibrate(30);
    setTimeout(()=>{
      setCards(prev=>prev.map(c=> c.id===aId||c.id===bId ? {...c, flipped:false}:c));
    }, 900);
  },[cards, won, locked, hints]);

  const handleClick = (id: number) => {
    if (locked || won) return;
    const c = cards[id];
    if (!c || c.flipped || c.matched) return;
    ensureTimer();
    playFlip();
    if(navigator.vibrate) navigator.vibrate(12);
    const next = cards.map((card) => (card.id === id ? { ...card, flipped: true } : card));
    setCards(next);
    const el = gridRef.current?.querySelectorAll(`.${styles.card}`)[id] as HTMLElement | undefined;
    if (el && !prefersReducedMotion()) gsap.fromTo(el, { scale: 0.92, rotationY: 60 }, { scale: 1, rotationY: 0, duration: 0.28, ease: "back.out(1.5)" });

    if (first === null) {
      setFirst(id);
    } else {
      setLocked(true);
      setMoves((m) => m + 1);
      const a = next[first]!;
      const b = next[id]!;
      if (a.symbol === b.symbol) {
        const newCombo = combo + 1;
        setCombo(newCombo); setMaxCombo(m=>Math.max(m,newCombo));
        if(newCombo>=5 && !fever){ setFever(true); playFever(); if(navigator.vibrate) navigator.vibrate([30,40,30]); }
        else playMatch(newCombo);
        const addScore = SCORE_BASE + newCombo * SCORE_COMBO_STEP + (newCombo>=3 ? 60 : 0);
        const timeBonus = Math.max(0, diffData.timeBonus - sec * SCORE_TIME_FACTOR);
        setScore(s=>s + addScore + (pairs+1===diffData.pairs ? timeBonus : 0));
        const matched = next.map((card) => (card.symbol === a.symbol ? { ...card, matched: true } : card));
        setCards(matched);
        setPairs((p) => p + 1);
        setFirst(null);
        setLocked(false);
        if (el && !prefersReducedMotion()) {
          gsap.to(el, { scale: 1.1, duration: 0.14, yoyo: true, repeat: 1, ease: "power1.out" });
          triggerBurstAt(el);
        }
        const target = gridRef.current?.querySelectorAll(`.${styles.card}`)[first] as HTMLElement | undefined;
        if (target) {
          if(!prefersReducedMotion()) gsap.to(target, { scale: 1.1, duration: 0.14, yoyo: true, repeat: 1, ease: "power1.out" });
          setTimeout(() => triggerBurstAt(target), 40);
        }
        setScoreBump(true);
        setTimeout(() => setScoreBump(false), 280);
        if (matched.every((card) => card.matched)) {
          setTimeout(() => {
            setWon(true);
            playWin();
            const finalScore = score + addScore + timeBonus;
            setBest(v=> finalScore>v?finalScore:v);
            void fetch("/magnum/api/games/submit",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({game:"memory",score:finalScore})}).catch(()=>{});
            if (gridRef.current && !prefersReducedMotion()) gsap.to(gridRef.current, { scale: 1.02, duration: 0.2, yoyo: true, repeat: 1 });
            if(navigator.vibrate) navigator.vibrate([40,30,60,30,80]);
          }, 380);
        }
      } else {
        playMiss();
        if(navigator.vibrate) navigator.vibrate([20,30,20]);
        setCombo(0); setFever(false);
        const el2 = gridRef.current?.querySelectorAll(`.${styles.card}`)[id] as HTMLElement | undefined;
        const el1 = gridRef.current?.querySelectorAll(`.${styles.card}`)[first] as HTMLElement | undefined;
        if (el1 && el2 && !prefersReducedMotion()) {
          gsap.to([el1, el2], { x: 6, duration: 0.06, yoyo: true, repeat: 5, ease: "power1.inOut", onComplete: () => gsap.set([el1, el2], { x: 0 }) });
          if (gridRef.current) gsap.to(gridRef.current, { x: 3, duration: 0.05, yoyo: true, repeat: 3, onComplete: () => gsap.set(gridRef.current!, { x: 0 }) });
        }
        setTimeout(() => {
          setCards((prev) => prev.map((card) => (card.id === first || card.id === id ? { ...card, flipped: false } : card)));
          setFirst(null);
          setLocked(false);
        }, 740);
      }
    }
  };

  const restart = useCallback(() => {
    restartWith(diff, theme);
  }, [diff, theme, restartWith]);

  const changeTheme = useCallback((nt: ThemeId)=>{
    setTheme(nt);
    restartWith(diff, nt);
  },[diff, restartWith]);

  const changeDiff = useCallback((nd: DiffKey)=>{
    setDiff(nd);
    restartWith(nd, theme);
  },[theme, restartWith]);

  const progress = (pairs / diffData.pairs) * 100;
  const colsStyle = { gridTemplateColumns: `repeat(${diffData.cols}, 1fr)` } as React.CSSProperties;

  return (
    <div className={styles.page} ref={ref} style={{ position: "relative" }}>
      <Confetti active={won} />
      <BurstLayer bursts={bursts} onDone={(id) => setBursts((prev) => prev.filter((b) => b.id !== id))} />
      <h1 style={{ background: "var(--gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
        Память 42 {fever && <span style={{ WebkitTextFillColor:"#ffcc00", fontSize:"0.62em", verticalAlign:"middle", marginLeft:8, filter:"drop-shadow(0 0 8px rgba(255,204,0,0.8))"}}>FEVER ×2</span>}
      </h1>
      <p style={{ color: "rgba(240,240,240,0.52)", marginBottom: 8, fontSize: "0.92rem" }}>Найди все {diffData.pairs} пар — свайп ↔ сложность, ↑ хинт, стрелки + Enter</p>

      {/* THEME + DIFFICULTY селекторы */}
      <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap", marginBottom:10 }}>
        {THEMES.map(t=>(
          <button key={t.id} onClick={()=>changeTheme(t.id)} onMouseEnter={(e)=>hoverIn(e.currentTarget)} onMouseLeave={(e)=>hoverOut(e.currentTarget)}
            style={{ padding:"6px 12px", borderRadius:999, border: theme===t.id ? `1px solid ${t.colors[0]}` : "1px solid rgba(255,255,255,0.10)", background: theme===t.id ? `${t.colors[0]}18` : "rgba(255,255,255,0.06)", color: theme===t.id ? "#fff" : "rgba(240,240,240,0.72)", fontSize:"0.84rem", fontWeight: theme===t.id?700:500, cursor:"pointer", transition:"all 0.18s" }}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>
      <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap", marginBottom:12 }}>
        {(Object.keys(DIFFICULTY) as DiffKey[]).map(k=>(
          <button key={k} onClick={()=>changeDiff(k)} onMouseEnter={(e)=>hoverIn(e.currentTarget)} onMouseLeave={(e)=>hoverOut(e.currentTarget)}
            style={{ padding:"6px 14px", borderRadius:999, border: diff===k ? "1px solid rgba(0,255,136,0.45)" : "1px solid rgba(255,255,255,0.10)", background: diff===k ? "rgba(0,255,136,0.13)" : "rgba(255,255,255,0.06)", color: diff===k ? "#00ff88" : "rgba(240,240,240,0.68)", fontSize:"0.84rem", fontWeight:700, cursor:"pointer" }}>
            {DIFFICULTY[k].label} <span style={{fontWeight:400, opacity:0.7}}>{DIFFICULTY[k].desc}</span>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <span style={{ background: "rgba(255,255,255,0.06)", padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.08)", fontSize: "0.9rem" }}>
          ⏱ <b style={{ color: "#fff", fontVariantNumeric: "tabular-nums" }}>{fmtTime(sec)}</b>
        </span>
        <span style={{ background: "rgba(255,255,255,0.06)", padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.08)", fontSize: "0.9rem" }}>
          Ходы: <b style={{ color: "#fff" }}>{moves}</b>
        </span>
        <span style={{ background: combo>=3 ? "rgba(255,204,0,0.18)" : fever ? "rgba(255,204,0,0.26)" : "rgba(0,255,136,0.08)", padding: "6px 12px", borderRadius: 999, border: combo>=3?"1px solid rgba(255,204,0,0.32)":"1px solid rgba(0,255,136,0.18)", color: combo>=3?"#ffcc00":"#00ff88", fontSize:"0.9rem", fontWeight:700 }}>
          {combo>=3 ? `🔥 ×${combo}` : `Комбо ×${combo}`} <span style={{fontWeight:400, opacity:0.7}}>max {maxCombo}</span>
        </span>
        <span
          style={{
            background: scoreBump ? "rgba(0,255,136,0.18)" : "rgba(0,255,136,0.08)",
            padding: "6px 12px",
            borderRadius: 999,
            border: "1px solid rgba(0,255,136,0.18)",
            color: "#00ff88",
            fontSize: "0.9rem",
            transform: scoreBump ? "scale(1.08)" : "scale(1)",
            transition: "transform 0.18s, background 0.18s",
            display: "inline-block",
          }}
        >
          ⭐ {score}
        </span>
        <span style={{ background: "rgba(255,45,85,0.08)", padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(255,45,85,0.18)", color: "#ff2d55", fontSize: "0.9rem" }}>
          {Math.round(progress)}%
        </span>
        <span style={{ background:"rgba(255,255,255,0.05)", padding:"6px 12px", borderRadius:999, border:"1px solid rgba(255,255,255,0.08)", fontSize:"0.9rem", color:"rgba(240,240,240,0.6)" }}>
          Рекорд: <b style={{color:"#fff"}}>{best}</b>
        </span>
      </div>

      <div style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:12 }}>
        <button onClick={doHint} disabled={hints<=0 || won} style={{ padding:"7px 16px", borderRadius:999, border:"1px solid rgba(255,204,0,0.22)", background: hints>0 ? "rgba(255,204,0,0.10)" : "rgba(255,255,255,0.05)", color: hints>0?"#ffcc00":"rgba(255,255,255,0.32)", fontSize:"0.88rem", fontWeight:700, cursor: hints>0?"pointer":"not-allowed", opacity: won?0.5:1 }}>
          💡 Хинт {hints}/{diffData.hint}
        </button>
        <span style={{ alignSelf:"center", fontSize:11, color:"rgba(255,255,255,0.30)", letterSpacing:"0.04em" }}>H / свайп ↑</span>
      </div>

      <div className={styles.grid} ref={gridRef} style={{ ...colsStyle, perspective: 900, maxWidth: diff==="hard" ? 520 : diff==="easy" ? 280 : 360, touchAction:"pan-y" }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {cards.map((c, idx) => (
          <button
            key={c.id}
            aria-label={c.flipped || c.matched ? c.symbol : "закрыто"}
            className={`${styles.card} ${c.flipped || c.matched ? styles.flipped : ""} ${c.matched ? styles.matched : ""}`}
            onClick={() => handleClick(c.id)}
            onFocus={()=>setFocusIdx(idx)}
            tabIndex={0}
            style={{
              boxShadow: c.matched ? "0 0 18px rgba(0,255,136,0.38)" : c.flipped ? "0 0 14px rgba(255,45,85,0.32)" : focusIdx===idx ? "0 0 0 2px rgba(255,204,0,0.55)" : undefined,
              transform: c.flipped || c.matched ? "scale(1.02)" : undefined,
            } as React.CSSProperties}
          >
            <span style={{ display: "inline-block", transform: c.flipped || c.matched ? "scale(1)" : "scale(0.82)", transition: "transform 0.22s", fontSize: diff==="hard" ? "1.35rem" : "1.7rem" }}>
              {c.flipped || c.matched ? c.symbol : "?"}
            </span>
          </button>
        ))}
      </div>

      <div style={{ maxWidth: diff==="hard"?520:360, margin: "1.15rem auto 0", height: 7, background: "rgba(255,255,255,0.07)", borderRadius: 999, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ width: `${progress}%`, height: "100%", background: fever ? "linear-gradient(90deg,#ffcc00,#ff2d55)" : "var(--gradient)", transition: "width 0.42s cubic-bezier(0.22,1,0.36,1)", boxShadow: pairs === diffData.pairs ? "0 0 14px rgba(0,255,136,0.7)" : fever ? "0 0 14px rgba(255,204,0,0.7)" : undefined }} />
      </div>
      <div style={{ maxWidth: diff==="hard"?520:360, margin: "0.4rem auto 0", display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.34)", letterSpacing: "0.06em", textTransform: "uppercase", padding: "0 2px" as unknown as string }}>
        <span>0</span><span>{Math.floor(diffData.pairs/2)} пар</span><span>{diffData.pairs} ✓</span>
      </div>

      {won && (
        <div className={styles.win}>
          <div className={styles.winCard} style={{ boxShadow: "0 0 44px rgba(255,45,85,0.22), 0 0 80px rgba(88,101,242,0.16)", border: "1px solid rgba(255,255,255,0.12)", maxWidth: 440 }}>
            <h2>🎉 Победа!</h2>
            <p style={{ fontSize: "1.15rem", marginBottom: 4 }}>
              <b style={{ color: "#ffcc00", fontSize: "1.45rem" }}>{score}</b> очков • {moves} ходов • {fmtTime(sec)}
            </p>
            <p style={{ fontSize:"0.88rem", color:"rgba(240,240,240,0.58)", marginBottom:6 }}>Пары {pairs}/{diffData.pairs} • Комбо max ×{maxCombo} • Точность {moves>0?Math.round((diffData.pairs/moves)*100):100}% {fever?"• FEVER 🔥":""}</p>
            <p style={{ fontSize:11, color:"rgba(255,255,255,0.32)", marginBottom:14 }}>{themeData.label} · {diffData.label} · {diffData.desc}</p>
            <a href={PRESAVE} target="_blank" rel="noreferrer" className={styles.presaveBtn} style={{ display: "block", textAlign: "center" }}>
              Пресейв MAGNUM →
            </a>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginTop: 8, letterSpacing: "0.04em" }}>победа {score} → пресейв · рекорд {best}</p>
            <button onClick={restart} className={styles.restartBtn} style={{ marginTop: 10, width: "100%" }}>
              Ещё раз
            </button>
          </div>
        </div>
      )}

      <div className={styles.nav}>
        <Link to="/magnum/games" className={styles.back}>
          ← К играм
        </Link>
        <button onClick={restart} className={styles.restartBtn}>
          Заново
        </button>
      </div>
    </div>
  );
}
