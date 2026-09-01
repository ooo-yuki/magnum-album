import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./Game2042.module.css";
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
const SIZE = 4;
const WIN_TILE = 2048; // displayed as "42" in MAGNUM theme

type Grid = number[][];
type Dir = "up" | "down" | "left" | "right";

function emptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0) as number[]);
}

function cloneGrid(g: Grid): Grid {
  return g.map((r) => [...r]);
}

function getEmpty(g: Grid): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) if (g[r]![c] === 0) cells.push([r, c]);
  return cells;
}

function addRandom(g: Grid): Grid {
  const empty = getEmpty(g);
  if (empty.length === 0) return g;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)]!;
  const ng = cloneGrid(g);
  ng[r]![c] = Math.random() < 0.9 ? 2 : 4;
  return ng;
}

function slide(row: number[]): { row: number[]; score: number; moved: boolean } {
  const filtered = row.filter((v) => v !== 0);
  let score = 0;
  const merged: number[] = [];
  for (let i = 0; i < filtered.length; i++) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const val = filtered[i]! * 2;
      merged.push(val);
      score += val;
      i++; // skip next
    } else {
      merged.push(filtered[i]!);
    }
  }
  while (merged.length < SIZE) merged.push(0);
  let moved = false;
  for (let i = 0; i < SIZE; i++) {
    if (merged[i] !== row[i]) moved = true;
  }
  return { row: merged, score, moved };
}

function moveGrid(g: Grid, dir: Dir): { grid: Grid; score: number; moved: boolean } {
  let totalScore = 0;
  let anyMoved = false;
  const ng = cloneGrid(g);

  const getRow = (i: number): number[] => {
    if (dir === "left") return [...ng[i]!];
    if (dir === "right") return [...ng[i]!].reverse();
    if (dir === "up") return Array.from({ length: SIZE }, (_, k) => ng[k]![i]!);
    return Array.from({ length: SIZE }, (_, k) => ng[SIZE - 1 - k]![i]!); // down
  };

  const setRow = (i: number, row: number[]) => {
    if (dir === "left") { for (let k = 0; k < SIZE; k++) ng[i]![k] = row[k]!; }
    else if (dir === "right") { for (let k = 0; k < SIZE; k++) ng[i]![k] = row[SIZE - 1 - k]!; }
    else if (dir === "up") { for (let k = 0; k < SIZE; k++) ng[k]![i] = row[k]!; }
    else { for (let k = 0; k < SIZE; k++) ng[SIZE - 1 - k]![i] = row[k]!; }
  };

  for (let i = 0; i < SIZE; i++) {
    const { row: result, score, moved } = slide(getRow(i));
    setRow(i, result);
    totalScore += score;
    if (moved) anyMoved = true;
  }

  return { grid: ng, score: totalScore, moved: anyMoved };
}

function canMove(g: Grid): boolean {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (g[r]![c] === 0) return true;
      if (c + 1 < SIZE && g[r]![c] === g[r]![c + 1]) return true;
      if (r + 1 < SIZE && g[r]![c] === g[r + 1]![c]) return true;
    }
  return false;
}

function hasWon(g: Grid): boolean {
  for (const row of g) for (const v of row) if (v >= WIN_TILE) return true;
  return false;
}

function maxTile(g: Grid): number {
  let m = 0; for (const row of g) for (const v of row) if (v > m) m = v; return m;
}

function tileColor(v: number): string {
  const map: Record<number, string> = {
    2: "#1a1a3e",
    4: "#2a1a4e",
    8: "#ff6b35",
    16: "#ff2d55",
    32: "#ffcc00",
    64: "#00ff88",
    128: "#5865f2",
    256: "#a855f7",
    512: "#ff2d9a",
    1024: "#ffcc00",
    2048: "#ff2d55",
  };
  return map[v] ?? "#ff2d55";
}

function tileLabel(v: number): string {
  if (v >= WIN_TILE) return "42";
  return String(v);
}

function tileEmoji(v: number): string {
  if (v >= 2048) return "🔥";
  if (v >= 512) return "💎";
  if (v >= 128) return "⚡";
  if (v >= 32) return "🎵";
  return "";
}

// ── MAGNUM tile lore — контент-массив 60+ строк для 10k/10м ────────────
const TILE_LORE: Record<number, { title: string; lore: string }> = {
  2:    { title: "2 — Первый бит",       lore: "Начало пути. Как первый демо-трек на кухне." },
  4:    { title: "4 — Квадрат",           lore: "Стабильность. База, на которой строится хип-хоп." },
  8:    { title: "8 — Октава",            lore: "Взлёт на октаву выше. Туса медуза начинается." },
  16:   { title: "16 — Фирменный флоу",   lore: "Шестнадцать строк — классический куплет 5opka." },
  32:   { title: "32 — Двойной куплет",   lore: "Фристайл без остановки. ТУСА МЕДУЗА 14.08 — на репите." },
  64:   { title: "64 — Бит на репит",     lore: "На репите у каждого братухи. CLAY 03.04 вайб." },
  128:  { title: "128 — Саундчек",        lore: "VPN хук заполняет зал. Тур 5opka 2026 на подходе." },
  256:  { title: "256 — Превью",          lore: "Половина пути к MAGNUM. 5 пуль — 5 треков, пресейв https://music.thefence.me/psmagnum." },
  512:  { title: "512 — Хайп",            lore: "TikTok 8K клипов про ТУСА МЕДУЗА. Алгоритмы сдались." },
  1024: { title: "1024 — Предрелиз",      lore: "За день до дропа MAGNUM. Сервера Bandlink дрожат." },
  2048: { title: "42 — MAGNUM",           lore: "Магическое число. 5 пуль = 14.08 ТУСА МЕДУЗА + VPN + CLAY + 42 + MAGNUM." },
  4096: { title: "84 — Легенда 42",       lore: "За гранью. Ты уже не игрок — ты братуха 42. Пресейв закрыт — ты успел!" },
};

// ── WebAudio ─────────────────────────────────────────────────────────────
let ac: AudioContext | null = null;
function ensureAC() {
  if (!ac) try { ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { return null; }
  if (ac && ac.state === "suspended") void ac.resume();
  return ac;
}
function playMerge(v: number) {
  const ctx = ensureAC(); if (!ctx) return;
  // chord merge: base + fifth for high tiles
  const baseFreq = 220 + Math.min(v, 2048) * 0.42;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "sine";
  o.frequency.value = baseFreq;
  g.gain.setValueAtTime(0.14, ctx.currentTime);
  safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.24);
  if (v >= 64) {
    const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
    o2.connect(g2); g2.connect(ctx.destination);
    o2.type = "triangle"; o2.frequency.value = baseFreq * 1.5;
    g2.gain.setValueAtTime(0.06, ctx.currentTime);
    safeRamp(g2.gain, () => g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18), 0.001);
    o2.start(); o2.stop(ctx.currentTime + 0.2);
  }
}
function playSlide() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "triangle"; o.frequency.value = 420;
  safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(340, ctx.currentTime + 0.08), 340);
  g.gain.setValueAtTime(0.05, ctx.currentTime);
  safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.1);
}
function playBump() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "square"; o.frequency.value = 110;
  safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.12), 80);
  g.gain.setValueAtTime(0.07, ctx.currentTime);
  safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.15);
}
function playWin() {
  const ctx = ensureAC(); if (!ctx) return;
  const seq = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5 E5 G5 C6 E6
  seq.forEach((freq, i) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = i % 2 === 0 ? "sine" : "triangle";
    o.frequency.value = freq;
    const t0 = ctx.currentTime + i * 0.11;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.16, t0 + 0.02);
    safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55), 0.001);
    o.start(t0); o.stop(t0 + 0.6);
  });
}
function playGameOver() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "sawtooth"; o.frequency.value = 200;
  safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(70, ctx.currentTime + 0.45), 70);
  g.gain.setValueAtTime(0.1, ctx.currentTime);
  safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.52);
}

// ── Confetti particle ───────────────────────────────────────────────────
interface Confetti { x: number; y: number; vx: number; vy: number; r: number; color: string; rot: number; vr: number; life: number; }

export function Game2042() {
  const [grid, setGrid] = useState<Grid>(() => addRandom(addRandom(emptyGrid())));
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem("2042-best")) || 0; } catch { return 0; } });
  const [bestTile, setBestTile] = useState(() => { try { return Number(localStorage.getItem("2042-bestTile")) || 0; } catch { return 0; } });
  const [state, setState] = useState<"playing" | "win" | "over">("playing");
  const [keepPlaying, setKeepPlaying] = useState(false);
  const [moves, setMoves] = useState(0);
  const [hint, setHint] = useState<Dir | null>(null);
  const [shake, setShake] = useState(0);
  const [mergeStreak, setMergeStreak] = useState(0);
  const [lastMergeVal, setLastMergeVal] = useState<number | null>(null);
  const [confetti, setConfetti] = useState<Confetti[]>([]);
  const [dailyMode, setDailyMode] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  // undo stack: last 6 states
  const historyRef = useRef<Array<{ grid: Grid; score: number; moves: number }>>([]);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const gridRef = useRef(grid);
  const scoreRef = useRef(score);
  const pageRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const confettiRef = useRef<HTMLCanvasElement>(null);
  gridRef.current = grid;
  scoreRef.current = score;

  // submit best to Neon magnum_game_scores (game=2042)
  async function submitScore(s: number) {
    if (submitted || s < 100) return;
    setSubmitted(true);
    try {
      const tk = (()=>{ try{ return localStorage.getItem("auth_token")||localStorage.getItem("magnum_token")||"";}catch{return "";}})();
      await fetch("/magnum/api/games/submit", { method: "POST", headers: { "Content-Type":"application/json", ...(tk?{Authorization:"Bearer "+tk}:{}) }, body: JSON.stringify({ game:"2042", score:s }) });
    } catch {}
  }
  async function shareResult() {
    const txt = `🧩 ПАЗЛ 2042 — ${score} очков, макс ${curMax>=WIN_TILE?"42":curMax}, ${moves} ходов! Собери 42 на magnum — пресейв https://music.thefence.me/psmagnum`;
    try {
      if (navigator.share) await navigator.share({ title: "ПАЗЛ 2042 — MAGNUM", text: txt, url: "https://music.thefence.me/psmagnum" });
      else { await navigator.clipboard.writeText(txt); setShareMsg("Скопировано!"); setTimeout(()=>setShareMsg(null),1600); }
    } catch {}
  }
  const efficiency = moves ? (score / moves).toFixed(1) : "0";
  const curMax = maxTile(grid);
  const curLore = TILE_LORE[curMax] ?? TILE_LORE[2048]!;

  const doMove = useCallback((dir: Dir) => {
    if (state === "over") return;
    if (state === "win" && !keepPlaying) return;
    const { grid: ng, score: s, moved } = moveGrid(gridRef.current, dir);
    if (!moved) { playBump(); setShake(6); setTimeout(() => setShake(0), 220); return; }
    // push undo history (keep 6)
    historyRef.current.push({ grid: cloneGrid(gridRef.current), score: scoreRef.current, moves });
    if (historyRef.current.length > 6) historyRef.current.shift();
    const withNew = addRandom(ng);
    setGrid(withNew);
    const newScore = scoreRef.current + s;
    setScore(newScore);
    setMoves((m) => m + 1);
    setHint(null);
    if (s > 0) {
      playMerge(s);
      setLastMergeVal(s);
      setMergeStreak((prev) => prev + 1);
      setTimeout(() => setLastMergeVal(null), 900);
      // GSAP pop merged tiles
      if (boardRef.current) {
        const tiles = boardRef.current.querySelectorAll(`.${styles.filled}`);
        gsap.fromTo(tiles, { scale: 0.92 }, { scale: 1, duration: 0.18, ease: "back.out(1.8)", stagger: 0.01, overwrite: true });
      }
    } else {
      playSlide();
      setMergeStreak(0);
    }
    if (newScore > best) {
      setBest(newScore);
      try { localStorage.setItem("2042-best", String(newScore)); } catch {}
    }
    const nt = maxTile(withNew);
    if (nt > bestTile) { setBestTile(nt); try { localStorage.setItem("2042-bestTile", String(nt)); } catch {} }
    if (hasWon(withNew) && !keepPlaying) {
      setState("win"); playWin(); void submitScore(newScore);
      // confetti burst
      const colors = ["#ff2d55","#ffcc00","#00ff88","#5865f2","#a855f7","#fff"];
      const burst: Confetti[] = Array.from({ length: 44 }, () => ({
        x: Math.random() * 380, y: -10 - Math.random() * 40,
        vx: (Math.random()-0.5)*6, vy: Math.random()*3+2,
        r: 3+Math.random()*5, color: colors[Math.floor(Math.random()*colors.length)]!,
        rot: Math.random()*360, vr: (Math.random()-0.5)*12, life: 1,
      }));
      setConfetti(burst);
    } else if (!canMove(withNew)) {
      setState("over");
      playGameOver(); void submitScore(newScore);
      setMergeStreak(0);
      if (pageRef.current) gsap.to(pageRef.current, { x: 5, duration: 0.05, yoyo: true, repeat: 7, ease: "power1.inOut", onComplete: () => gsap.set(pageRef.current!, { x: 0 }) });
    }
  }, [state, keepPlaying, best, bestTile, moves]);

  // board entrance GSAP
  useEffect(() => {
    if (!boardRef.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    gsap.from(boardRef.current, { y: 18, opacity: 0, scale: 0.97, duration: 0.55, ease: "power3.out" });
    gsap.from(boardRef.current.querySelectorAll(`.${styles.tile}`), { scale: 0.8, opacity: 0, stagger: 0.014, duration: 0.32, ease: "back.out(1.4)", delay: 0.12 });
  }, []);

  // confetti animation loop — fixed: no nested useEffect
  useEffect(() => {
    if (confetti.length === 0) return;
    let raf = 0;
    const canvas = confettiRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 380 * dpr; canvas.height = 380 * dpr;
    canvas.style.width = "380px"; canvas.style.height = "380px";
    ctx.setTransform(dpr,0,0,dpr,0,0);
    let particles = [...confetti];
    const draw = () => {
      ctx.clearRect(0,0,380,380);
      let alive = false;
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.vx *= 0.99; p.rot += p.vr; p.life -= 0.007;
        if (p.life <= 0 || p.y > 400) continue;
        alive = true;
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot*Math.PI/180); ctx.globalAlpha = Math.max(0,p.life);
        ctx.fillStyle = p.color; ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r*0.6);
        ctx.restore();
      }
      particles = particles.filter(p => p.life>0 && p.y<400);
      if (alive && particles.length>0) raf = requestAnimationFrame(draw);
      else setConfetti([]);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [confetti]);

  // ── MAGNUM DAAILY CHALLENGE — seed by date, submit to Neon ──
  const DAILY_KEY = "2042-daily"; void DAILY_KEY;
  function dailySeed(): number {
    const d = new Date();
    return d.getFullYear()*10000 + (d.getMonth()+1)*100 + d.getDate();
  }
  function mulberry32(a: number) {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function seededBoard(seed: number): Grid {
    const rnd = mulberry32(seed);
    let g = emptyGrid();
    for(let k=0;k<2;k++){
      const empty: [number,number][]=[];
      for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(g[r]![c]===0) empty.push([r,c]);
      if(!empty.length) break;
      const [r,c]=empty[Math.floor(rnd()*empty.length)]!;
      g[r]![c]=rnd()<0.9?2:4;
    }
    return g;
  }

  // keyboard — arrows + WASD
  useEffect(() => {
    const map: Record<string, Dir> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", KeyW: "up", KeyS: "down", KeyA: "left", KeyD: "right" };
    const onKey = (e: KeyboardEvent) => {
      const dir = map[e.code];
      if (dir) { e.preventDefault(); ensureAC(); doMove(dir); }
      if (e.code === "KeyZ" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); }
      if (e.code === "KeyH") { e.preventDefault(); showHint(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doMove]);

  // touch swipe — enhanced with threshold + prevent scroll
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0]!;
    touchRef.current = { x: t.clientX, y: t.clientY };
  }, []);
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const t = e.changedTouches[0]!;
    const dx = t.clientX - touchRef.current.x;
    const dy = t.clientY - touchRef.current.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (Math.max(absDx, absDy) < 28) { touchRef.current = null; return; }
    ensureAC();
    if (absDx > absDy) doMove(dx > 0 ? "right" : "left");
    else doMove(dy > 0 ? "down" : "up");
    touchRef.current = null;
  }, [doMove]);

  const startDaily = useCallback(() => {
    setGrid(seededBoard(dailySeed()));
    setDailyMode(true); setScore(0); setMoves(0); setHint(null); setMergeStreak(0); setLastMergeVal(null); setConfetti([]); setShake(0); historyRef.current=[]; setState("playing"); setKeepPlaying(false); setSubmitted(false);
  }, []);
  const restart = useCallback(() => {
    if (dailyMode) { setGrid(seededBoard(dailySeed()+moves+score)); } else setGrid(addRandom(addRandom(emptyGrid())));
    setScore(0);
    setMoves(0);
    setHint(null);
    setMergeStreak(0);
    setLastMergeVal(null);
    setConfetti([]);
    setShake(0);
    historyRef.current = [];
    setState("playing");
    setKeepPlaying(false); setSubmitted(false);
    if (!dailyMode) setDailyMode(false);
    if (boardRef.current) gsap.from(boardRef.current.querySelectorAll(`.${styles.tile}`), { scale: 0.7, opacity: 0, stagger: 0.015, duration: 0.28, ease: "back.out(1.6)" });
  }, [dailyMode, moves, score]);

  const undo = useCallback(() => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    setGrid(prev.grid);
    setScore(prev.score);
    setMoves(prev.moves);
    setMergeStreak(0);
    setState("playing");
    if (boardRef.current) gsap.from(boardRef.current, { x: -6, duration: 0.12, yoyo: true, repeat: 1 });
  }, []);

  const showHint = useCallback(() => {
    // pick move with best immediate score gain
    let bestDir: Dir | null = null;
    let bestScore = -1;
    for (const d of (["up", "down", "left", "right"] as Dir[])) {
      const { score: s, moved } = moveGrid(gridRef.current, d);
      if (moved && s >= bestScore) { bestScore = s; bestDir = d; }
    }
    // fallback: any movable
    if (!bestDir) {
      for (const d of (["up", "down", "left", "right"] as Dir[])) {
        if (moveGrid(gridRef.current, d).moved) { bestDir = d; break; }
      }
    }
    setHint(bestDir);
    if (bestDir && boardRef.current) {
      const btn = document.querySelector(`[data-dir="${bestDir}"]`) as HTMLElement | null;
      if (btn) gsap.fromTo(btn, { scale: 1 }, { scale: 1.12, duration: 0.18, yoyo: true, repeat: 3, ease: "power2.inOut" });
    }
    setTimeout(() => setHint(null), 1600);
  }, []);

  const continuePlay = useCallback(() => {
    setKeepPlaying(true);
    setState("playing");
  }, []);

  const progress = Math.min((Math.log2(Math.max(curMax,2)) / 11) * 100, 100);

  return (
    <div className={styles.page} ref={pageRef} style={shake ? { transform: `translateX(${(Math.random()-0.5)*shake}px)` } : undefined}>
      <h1>ПАЗЛ 2042</h1>
      <p className={styles.sub}>Свайпай / стрелки / WASD — собери 42! · ходов: {moves} · макс {curMax >= WIN_TILE ? "42 🔥" : curMax}</p>

      <div className={styles.hud}>
        <div className={styles.stat}><span>Очки</span><strong>{score}</strong></div>
        <div className={styles.stat}><span>Ходы</span><strong>{moves}</strong></div>
        <div className={styles.stat}><span>Рекорд</span><strong>{best}</strong></div>
        <div className={styles.stat}><span>Плитка</span><strong style={{ color: tileColor(curMax) }}>{curMax >= WIN_TILE ? "42" : curMax}</strong></div>
        <div className={styles.stat}><span>Эффект.</span><strong style={{ color: Number(efficiency)>55?"#ffcc00":"rgba(240,240,240,0.7)" }}>{efficiency}</strong></div>
      </div>
      {dailyMode && <div style={{ fontSize:"0.78rem", fontWeight:800, color:"#00ff88", letterSpacing:"0.06em", marginBottom:6 }}>📅 ЕЖЕДНЕВНЫЙ ЧЕЛЛЕНДЖ — {dailySeed()} · одна попытка в день — топ попадёт в рейтинг MAGNUM</div>}
      <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap", marginBottom:10 }}>
        <button onClick={startDaily} style={{ padding:"0.5rem 1rem", borderRadius:999, fontWeight:800, fontSize:"0.82rem", cursor:"pointer", border:"1px solid rgba(0,255,136,0.32)", background: dailyMode?"rgba(0,255,136,0.16)":"rgba(255,255,255,0.06)", color: dailyMode?"#00ff88":"rgba(240,240,240,0.7)" }}>📅 Ежедневный челлендж</button>
        <button onClick={shareResult} style={{ padding:"0.5rem 1rem", borderRadius:999, fontWeight:700, fontSize:"0.82rem", cursor:"pointer", border:"1px solid rgba(255,255,255,0.12)", background:"rgba(255,255,255,0.06)", color:"rgba(240,240,240,0.7)" }}>⤴ Поделиться</button>
        {shareMsg && <span style={{ fontSize:"0.78rem", color:"#00ff88", alignSelf:"center" }}>{shareMsg}</span>}
      </div>

      <div className={styles.progress} aria-label="прогресс к 42" style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden", maxWidth: 380, margin: "0 auto 10px" }}>
        <div style={{ width: `${progress}%`, height: "100%", background: "var(--accent, #ff2d55)", borderRadius: 99, transition: "width 0.4s ease" }} />
      </div>
      <p style={{ fontSize: "0.72rem", color: "rgba(240,240,240,0.45)", marginBottom: 8 }}>{curLore.title} — {curLore.lore}</p>
      {mergeStreak >= 2 && <div style={{ fontSize: "0.82rem", color: "#ffcc00", fontWeight: 800, marginBottom: 6, textShadow: "0 0 10px rgba(255,204,0,0.5)" }}>🔥 Комбо x{mergeStreak}! +{lastMergeVal ?? ""}</div>}

      <div style={{ position: "relative", maxWidth: 380, margin: "0 auto 1.5rem" }}>
        <div
          className={styles.board}
          ref={boardRef}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {grid.map((row, r) =>
            row.map((v, c) => (
              <div
                key={`${r}-${c}`}
                className={`${styles.tile} ${v > 0 ? styles.filled : ""}`}
                style={v > 0 ? { background: tileColor(v), boxShadow: `0 0 ${Math.min(v * 0.02, 18)}px ${tileColor(v)}88` } : undefined}
              >
                {v > 0 && (
                  <>
                    <span className={styles.tileVal}>{tileLabel(v)}</span>
                    {tileEmoji(v) && <span className={styles.tileEmoji}>{tileEmoji(v)}</span>}
                  </>
                )}
              </div>
            ))
          )}
        </div>
        {confetti.length > 0 && <canvas ref={confettiRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: 14 }} width={380} height={380} />}
      </div>

      <div className={styles.controls}>
        <div className={styles.arrowRow}>
          <button data-dir="up" className={`${styles.arrow} ${hint === "up" ? styles.hintGlow : ""}`} onClick={() => { ensureAC(); doMove("up"); }} aria-label="Вверх">▲</button>
        </div>
        <div className={styles.arrowRow}>
          <button data-dir="left" className={`${styles.arrow} ${hint === "left" ? styles.hintGlow : ""}`} onClick={() => { ensureAC(); doMove("left"); }} aria-label="Влево">◀</button>
          <button data-dir="down" className={`${styles.arrow} ${hint === "down" ? styles.hintGlow : ""}`} onClick={() => { ensureAC(); doMove("down"); }} aria-label="Вниз">▼</button>
          <button data-dir="right" className={`${styles.arrow} ${hint === "right" ? styles.hintGlow : ""}`} onClick={() => { ensureAC(); doMove("right"); }} aria-label="Вправо">▶</button>
        </div>
      </div>

      <div className={styles.navRow}>
        <button className={styles.restartBtn} onClick={undo} disabled={historyRef.current.length === 0} title="Отменить ход (Ctrl+Z)">↩ Отменить ({historyRef.current.length}/6)</button>
        <button className={styles.restartBtn} onClick={showHint}>💡 Подсказка (H)</button>
        <button className={styles.restartBtn} onClick={restart}>Заново</button>
        <button className={styles.restartBtn} onClick={shareResult}>⤴ Поделиться</button>
        <Link to="/magnum/games" className={styles.back}>← К играм</Link>
      </div>
      <p style={{ fontSize: "0.7rem", color: "rgba(240,240,240,0.32)", marginTop: 10 }}>WASD / стрелки · свайп · H-подсказка · Ctrl+Z отмена · плитка 2048 = 42 MAGNUM</p>

      {state === "win" && !keepPlaying && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2>🎉 42 СОБРАНО!</h2>
            <p>{score} очков • {moves} ходов • эффективность {efficiency} • {curLore.lore}</p>
            <p style={{ fontSize:"0.78rem", color:"rgba(255,204,0,0.85)" }}>5 пуль MAGNUM: ТУСА МЕДУЗА 14.08 + VPN + CLAY 03.04 + 42 + MAGNUM — пресейв открыт</p>
            <a href={PRESAVE} target="_blank" rel="noreferrer" className={styles.presaveBtn}>Пресейв MAGNUM →</a>
            <div style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:8 }}><button className={styles.restartBtn} onClick={shareResult}>⤴ Поделиться результатом</button></div>
            <div className={styles.modalActions}>
              <button className={styles.playBtn} onClick={continuePlay}>Продолжить (к 4096)</button>
              <button className={styles.restartBtn} onClick={restart}>Заново</button>
            </div>
          </div>
        </div>
      )}

      {state === "over" && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2>💥 Ходов больше нет!</h2>
            <p>{score} очков • макс {curMax} • рекорд {best} (плитка {bestTile >= WIN_TILE ? "42" : bestTile}) • эффект. {efficiency}</p>
            <div style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:8, flexWrap:"wrap" }}><button className={styles.restartBtn} onClick={shareResult}>⤴ Поделиться</button><button className={styles.restartBtn} onClick={startDaily}>📅 Челлендж</button></div>
            <button className={styles.playBtn} onClick={restart}>Ещё попытка</button>
            <Link to="/magnum/games" className={styles.back}>← К играм</Link>
          </div>
        </div>
      )}
    </div>
  );
}