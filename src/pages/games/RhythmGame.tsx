import { useRef, useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./RhythmGame.module.css";
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
const WIN_SCORE = 5000;
const LANE_COUNT = 4;
const LANE_KEYS = ["KeyD", "KeyF", "KeyJ", "KeyK"] as const;
const LANE_LABELS = ["D", "F", "J", "K"];
const LANE_COLORS = ["#ff2d55", "#ffcc00", "#00ff88", "#5865f2"];
const LANE_EMOJI = ["🪼", "🧥", "🕶️", "42"];
const HIT_Y_RATIO = 0.85;

// баланс v2: мягче окна для новичков, скорость чуть ниже
const PERFECT_WINDOW = 75;
const GOOD_WINDOW = 145;
const NOTE_SPEED = 360; // было 380 — чуть комфортнее

const DIFFICULTY = {
  easy: { perfect: 95, good: 170, speed: 300, win: 3500, label: "Легко" },
  normal: { perfect: 75, good: 145, speed: 360, win: 5000, label: "Нормал" },
  hard: { perfect: 55, good: 115, speed: 440, win: 6500, label: "Хард" },
} as const;
type DiffKey = keyof typeof DIFFICULTY;

type Judgement = "perfect" | "good" | "miss" | null;
interface Note {
  id: number;
  lane: number;
  y: number;
  hitTime: number;
  judged: boolean;
  judgement: Judgement;
}
interface HitEffect {
  lane: number;
  text: string;
  color: string;
  life: number;
  scale: number;
}
interface LaneFlash {
  lane: number;
  alpha: number;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}
interface Song {
  name: string;
  bpm: number;
  duration: number;
  patternSeed: number;
}
const SONGS: Song[] = [
  { name: "ТУСА МЕДУЗА", bpm: 128, duration: 45, patternSeed: 42 },
  { name: "VPN", bpm: 142, duration: 40, patternSeed: 7 },
  { name: "MAGNUM — Intro", bpm: 100, duration: 50, patternSeed: 99 },
];

let noteId = 0;
function genChart(song: Song, totalNotes = 64): { time: number; lane: number }[] {
  const beatMs = 60000 / song.bpm;
  const chart: { time: number; lane: number }[] = [];
  let seed = song.patternSeed;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
  // баланс: на высоком BPM чуть реже ноты чтобы не заспамливать
  const density = song.bpm > 135 ? 0.42 : 0.35;
  for (let i = 0; i < totalNotes; i++) {
    const beatOffset = i * (rnd() > density ? 1 : 0.5);
    const time = 1200 + beatOffset * beatMs + rnd() * 80;
    const lane = Math.floor(rnd() * LANE_COUNT);
    if (chart.length >= 2 && chart[chart.length - 1]!.lane === lane && chart[chart.length - 2]!.lane === lane) {
      chart.push({ time, lane: (lane + 1) % LANE_COUNT });
    } else {
      chart.push({ time, lane });
    }
    if (rnd() > 0.90 && i > 4) {
      const other = (lane + 1 + Math.floor(rnd() * 2)) % LANE_COUNT;
      chart.push({ time: time + 12, lane: other });
    }
  }
  chart.sort((a, b) => a.time - b.time);
  return chart;
}

// WebAudio hits
let ac: AudioContext | null = null;
function ensureAC() {
  if (!ac) {
    try { ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { return null; }
  }
  if (ac.state === "suspended") void ac.resume();
  return ac;
}
function playHit(j: Judgement) {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  if (j === "perfect") { o.type = "sine"; o.frequency.value = 880; safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(1320, ctx.currentTime + 0.08), 1320); g.gain.setValueAtTime(0.22, ctx.currentTime); safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22), 0.001); }
  else if (j === "good") { o.type = "triangle"; o.frequency.value = 550; safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(700, ctx.currentTime + 0.06), 700); g.gain.setValueAtTime(0.16, ctx.currentTime); safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16), 0.001); }
  else { o.type = "square"; o.frequency.value = 180; g.gain.setValueAtTime(0.12, ctx.currentTime); safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18), 0.001); }
  o.start(); o.stop(ctx.currentTime + 0.25);
}
function playKeyTap(lane: number) {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "sine"; o.frequency.value = 220 + lane * 80;
  g.gain.setValueAtTime(0.08, ctx.currentTime); safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.10), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.10);
}
function playWinSound() {
  const ctx = ensureAC(); if (!ctx) return;
  [0, 0.12, 0.24, 0.36].forEach((d, i) => {
    const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.value = 523 + i * 110; g.gain.setValueAtTime(0.14, ctx.currentTime + d); safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.42), 0.001); o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.42);
  });
}

export function RhythmGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [songIdx, setSongIdx] = useState(0);
  const [diff, setDiff] = useState<DiffKey>("normal");
  const [state, setState] = useState<"menu" | "playing" | "paused" | "win" | "fail">("menu");
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [judgement, setJudgement] = useState<Judgement>(null);
  const [accuracy, setAccuracy] = useState(100);
  const [missStreak, setMissStreak] = useState(0);

  const statsRef = useRef({ score: 0, combo: 0, maxCombo: 0, perfect: 0, good: 0, miss: 0, total: 0 });
  const notesRef = useRef<Note[]>([]);
  const chartRef = useRef<{ time: number; lane: number }[]>([]);
  const effectsRef = useRef<HitEffect[]>([]);
  const flashesRef = useRef<LaneFlash[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const shakeRef = useRef(0);
  const pulseRef = useRef(0);
  const keysDownRef = useRef<boolean[]>([false, false, false, false]);
  const startTimeRef = useRef(0);
  const pressedRef = useRef<boolean[]>([false, false, false, false]);
  const pausedTimeRef = useRef(0);
  const pauseStartRef = useRef(0);
  const missStreakRef = useRef(0);
  const animRef = useRef(0);
  const canvasSizeRef = useRef({ w: 600, h: 560 });

  const hitNote = useCallback((lane: number, nowMs: number) => {
    const d = DIFFICULTY[diff];
    const notes = notesRef.current;
    let best: Note | null = null;
    let bestDiff = Infinity;
    for (const n of notes) {
      if (n.judged || n.lane !== lane) continue;
      const dff = Math.abs(nowMs - n.hitTime);
      if (dff < bestDiff && dff <= d.good) { bestDiff = dff; best = n; }
    }
    if (!best) {
      playKeyTap(lane);
      flashesRef.current.push({ lane, alpha: 0.35 });
      return;
    }
    let j: Judgement;
    if (bestDiff <= d.perfect) j = "perfect";
    else j = "good";
    best.judged = true;
    best.judgement = j;
    const s = statsRef.current;
    s.total++;
    if (j === "perfect") { s.perfect++; s.score += 100 + Math.min(s.combo * 5, 100); }
    else { s.good++; s.score += 55 + Math.min(s.combo * 2, 40); }
    s.combo++; s.maxCombo = Math.max(s.maxCombo, s.combo);
    setScore(s.score); setCombo(s.combo); setMaxCombo(s.maxCombo);
    setJudgement(j); setTimeout(() => setJudgement((prev) => prev === j ? null : prev), 280);
    setAccuracy(Math.round(((s.perfect * 1 + s.good * 0.6) / Math.max(1, s.total)) * 100));
    const isPerfect = j === "perfect";
    effectsRef.current.push({ lane, text: isPerfect ? "PERFECT!" : "GOOD!", color: isPerfect ? "#ffcc00" : "#00ff88", life: 1, scale: 1 });
    flashesRef.current.push({ lane, alpha: 1 });
    missStreakRef.current = 0; setMissStreak(0);
    // частицы + шейк
    if (isPerfect) {
      shakeRef.current = Math.min(10, 3 + s.combo * 0.4);
      pulseRef.current = 1;
      const count = s.combo >= 8 ? 18 : s.combo >= 4 ? 12 : 8;
      for (let i = 0; i < count; i++) {
        particlesRef.current.push({
          x: lane, y: 0, vx: (Math.random() - 0.5) * 8, vy: -Math.random() * 6 - 1.5, life: 1,
          color: i % 3 === 0 ? "#fff" : i % 3 === 1 ? "#ffcc00" : LANE_COLORS[lane]!,
          size: 2.5 + Math.random() * 3.5,
        });
      }
    } else {
      shakeRef.current = 2;
      for (let i = 0; i < 5; i++) particlesRef.current.push({ x: lane, y: 0, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 3 - 1, life: 1, color: "#00ff88", size: 2 + Math.random() * 2 });
    }
    playHit(j);
    setTimeout(() => { best.y = -9999; }, 120);
  }, [diff]);

  const startGame = useCallback((idx: number) => {
    const song = SONGS[idx]!;
    const totalNotes = 64 + Math.round((song.bpm - 100) * 0.15);
    const chart = genChart(song, totalNotes);
    chartRef.current = chart;
    noteId = 0;
    notesRef.current = chart.map((c) => ({ id: noteId++, lane: c.lane, y: -200, hitTime: c.time, judged: false, judgement: null }));
    statsRef.current = { score: 0, combo: 0, maxCombo: 0, perfect: 0, good: 0, miss: 0, total: 0 };
    setScore(0); setCombo(0); setMaxCombo(0); setAccuracy(100); setJudgement(null); setMissStreak(0);
    effectsRef.current = []; flashesRef.current = []; particlesRef.current = []; shakeRef.current = 0; pulseRef.current = 0;
    startTimeRef.current = performance.now(); pausedTimeRef.current = 0; missStreakRef.current = 0;
    setSongIdx(idx);
    setState("playing");
  }, []);

  const togglePause = useCallback(() => {
    if (state === "playing") { pauseStartRef.current = performance.now(); setState("paused"); }
    else if (state === "paused") { pausedTimeRef.current += performance.now() - pauseStartRef.current; setState("playing"); }
  }, [state]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.code === "KeyP" || e.code === "Escape") && (state === "playing" || state === "paused")) { e.preventDefault(); togglePause(); return; }
      const lane = LANE_KEYS.indexOf(e.code as typeof LANE_KEYS[number]);
      if (lane === -1) return;
      if (keysDownRef.current[lane]) return;
      keysDownRef.current[lane] = true;
      pressedRef.current[lane] = true;
      setTimeout(() => { pressedRef.current[lane] = false; }, 120);
      if (state === "playing") {
        const now = performance.now() - startTimeRef.current - pausedTimeRef.current;
        hitNote(lane, now);
      }
      e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const lane = LANE_KEYS.indexOf(e.code as typeof LANE_KEYS[number]);
      if (lane !== -1) keysDownRef.current[lane] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
  
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

  return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  }, [state, hitNote]);

  // canvas loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let lastW = 0;
    const resize = () => {
      const parentW = canvas.parentElement?.clientWidth || 600;
      const w = Math.min(parentW, 560);
      canvas.width = w * (window.devicePixelRatio || 1);
      canvas.height = 560 * (window.devicePixelRatio || 1);
      canvas.style.width = w + "px";
      canvas.style.height = "560px";
      ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
      canvasSizeRef.current = { w, h: 560 };
      lastW = w;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const { w, h } = canvasSizeRef.current;
      const laneW = w / LANE_COUNT;
      const hitY = h * HIT_Y_RATIO;
      // shake decay
      if (shakeRef.current > 0) shakeRef.current *= 0.88;
      if (pulseRef.current > 0) pulseRef.current *= 0.91;
      ctx.save();
      if (shakeRef.current > 0.4) ctx.translate((Math.random() - 0.5) * shakeRef.current, (Math.random() - 0.5) * shakeRef.current);
      ctx.clearRect(-10, -10, w + 20, h + 20);

      // bg gradient
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#08081a"); bg.addColorStop(0.5, "#12082e"); bg.addColorStop(1, "#1a0a2e");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      // combo aura
      if (combo > 5) {
        ctx.fillStyle = `rgba(255,204,0,${0.04 + pulseRef.current * 0.07})`;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.04)"; ctx.lineWidth = 1;
      for (let i = 1; i < LANE_COUNT; i++) { ctx.beginPath(); ctx.moveTo(i * laneW, 0); ctx.lineTo(i * laneW, h); ctx.stroke(); }
      ctx.strokeStyle = "rgba(255,255,255,0.02)";
      for (let y = 0; y < h; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

      // lane flashes
      flashesRef.current = flashesRef.current.filter((f) => f.alpha > 0.01);
      for (const f of flashesRef.current) {
        f.alpha *= 0.88;
        ctx.fillStyle = LANE_COLORS[f.lane] + Math.round(f.alpha * 120).toString(16).padStart(2, "0");
        ctx.fillRect(f.lane * laneW + 1, 0, laneW - 2, h);
      }

      for (let i = 0; i < LANE_COUNT; i++) if (pressedRef.current[i]) {
        ctx.fillStyle = LANE_COLORS[i] + "22";
        ctx.fillRect(i * laneW, hitY - 14, laneW, 28);
      }

      if (state === "playing") {
        const now = performance.now() - startTimeRef.current - pausedTimeRef.current;
        const curD = DIFFICULTY[diff];
        for (const n of notesRef.current) {
          if (n.judged && n.y < -100) continue;
          n.y = hitY - (n.hitTime - now) * (curD.speed / 1000);
          if (!n.judged && now - n.hitTime > curD.good) {
            n.judged = true; n.judgement = "miss";
            const s = statsRef.current; s.miss++; s.total++; s.combo = 0;
            setCombo(0); missStreakRef.current++; setMissStreak(missStreakRef.current);
            setJudgement("miss"); setTimeout(() => setJudgement((p) => p === "miss" ? null : p), 280);
            setAccuracy(Math.round(((s.perfect * 1 + s.good * 0.6) / Math.max(1, s.total)) * 100));
            effectsRef.current.push({ lane: n.lane, text: "MISS", color: "#ff2d55", life: 1, scale: 1 });
            shakeRef.current = 6;
            for (let k = 0; k < 6; k++) particlesRef.current.push({ x: n.lane, y: hitY, vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 2 - 0.5, life: 1, color: "rgba(255,45,85,0.9)", size: 2.2 });
            playHit("miss");
          }
        }

        for (const n of notesRef.current) {
          if (n.y < -40 || n.y > h + 40) continue;
          if (n.judged && n.judgement !== null) continue;
          const cx = n.lane * laneW + laneW / 2;
          const isNear = Math.abs(n.y - hitY) < 18;
          ctx.shadowColor = LANE_COLORS[n.lane]!; ctx.shadowBlur = isNear ? 18 : 10;
          const nw = laneW * 0.78; const nh = 22;
          const x = cx - nw / 2; const y = n.y - nh / 2;
          ctx.fillStyle = LANE_COLORS[n.lane]!;
          ctx.beginPath();
          const r = 7;
          ctx.moveTo(x + r, y); ctx.lineTo(x + nw - r, y); ctx.quadraticCurveTo(x + nw, y, x + nw, y + r);
          ctx.lineTo(x + nw, y + nh - r); ctx.quadraticCurveTo(x + nw, y + nh, x + nw - r, y + nh);
          ctx.lineTo(x + r, y + nh); ctx.quadraticCurveTo(x, y + nh, x, y + nh - r);
          ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fillRect(x + 6, y + 5, nw - 12, 3);
          ctx.font = "11px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillStyle = "#000"; ctx.fillText(LANE_EMOJI[n.lane]!, cx, n.y + 1);
          ctx.fillStyle = LANE_COLORS[n.lane] + "28";
          ctx.fillRect(cx - 2, n.y + 14, 4, 18);
        }

        ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 2.5; ctx.shadowColor = "#ff2d55"; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.moveTo(0, hitY); ctx.lineTo(w, hitY); ctx.stroke(); ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,45,85,0.10)"; ctx.fillRect(0, hitY - 16, w, 32);
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        for (let i = 0; i < LANE_COUNT; i++) {
          const cx = i * laneW + laneW / 2;
          ctx.beginPath(); ctx.arc(cx, hitY, 3, 0, Math.PI * 2); ctx.fill();
        }

        const song = SONGS[songIdx]!;
        const allJudged = notesRef.current.every((n) => n.judged);
        if (now > song.duration * 1000 + 1200 || allJudged) {
          const s = statsRef.current;
          if (s.score >= DIFFICULTY[diff].win) { playWinSound(); setState("win"); }
          else setState("fail");
        }
      } else {
        const t = performance.now() * 0.001;
        for (let i = 0; i < 18; i++) {
          const lane = i % LANE_COUNT;
          const cx = lane * laneW + laneW / 2;
          const y = ((t * 60 + i * 47) % (h * 1.2)) - 20;
          ctx.globalAlpha = 0.10;
          ctx.fillStyle = LANE_COLORS[lane]!;
          ctx.beginPath(); ctx.roundRect(cx - laneW * 0.32, y, laneW * 0.64, 10, 5); ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, h * HIT_Y_RATIO); ctx.lineTo(w, h * HIT_Y_RATIO); ctx.stroke();
      }

      for (let i = 0; i < LANE_COUNT; i++) {
        const cx = i * laneW + laneW / 2; const y = h * HIT_Y_RATIO;
        const active = pressedRef.current[i];
        ctx.strokeStyle = LANE_COLORS[i]!; ctx.lineWidth = active ? 3 : 1.8;
        ctx.globalAlpha = active ? 1 : 0.65;
        ctx.shadowColor = LANE_COLORS[i]!; ctx.shadowBlur = active ? 16 : 6;
        ctx.strokeRect(cx - laneW * 0.36, y - 18, laneW * 0.72, 36);
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        ctx.fillStyle = active ? LANE_COLORS[i]! : "rgba(255,255,255,0.06)";
        ctx.fillRect(cx - laneW * 0.36, y - 18, laneW * 0.72, 36);
        ctx.fillStyle = LANE_COLORS[i]!; ctx.font = `900 ${active ? 15 : 13}px Inter, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(LANE_LABELS[i]!, cx, y + 1);
      }

      // particles (burst)
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0.01);
      for (const p of particlesRef.current) {
        // p.x is lane index initially, convert; if already pixel skip
        const baseX = p.x < LANE_COUNT ? p.x * laneW + laneW / 2 : p.x;
        const px = baseX + p.vx * 8;
        const py = HIT_Y_RATIO * h - 6 + p.vy * 8 - (1 - p.life) * 18;
        // update velocity/physics inline via life
        p.vy += 0.32; p.life -= 0.022;
        if (p.life <= 0) continue;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(px, py, p.size * p.life, 0, Math.PI * 2); ctx.fill();
        // store back for next frame movement approximation (keep x lane-based, update via vx)
        p.x = p.x < LANE_COUNT ? p.x + p.vx * 0.015 : p.x + p.vx * 0.3;
      }
      ctx.globalAlpha = 1;

      effectsRef.current = effectsRef.current.filter((e) => e.life > 0);
      for (const e of effectsRef.current) {
        e.life -= 0.018; e.scale += 0.01;
        const cx = e.lane * laneW + laneW / 2;
        const y = h * HIT_Y_RATIO - 42 - (1 - e.life) * 44;
        ctx.globalAlpha = Math.max(0, e.life);
        ctx.fillStyle = e.color;
        ctx.font = `900 ${e.text === "PERFECT!" ? 18 : 15}px Inter, sans-serif`;
        ctx.textAlign = "center"; ctx.strokeStyle = "rgba(0,0,0,0.85)"; ctx.lineWidth = 4;
        ctx.strokeText(e.text, cx, y); ctx.fillText(e.text, cx, y);
        ctx.globalAlpha = 1;
      }

      // pulse border
      if (pulseRef.current > 0.06) {
        ctx.strokeStyle = `rgba(255,204,0,${pulseRef.current * 0.42})`; ctx.lineWidth = 2 + pulseRef.current * 3; ctx.strokeRect(1, 1, w - 2, h - 2);
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(draw);
      void lastW;
    };
    animRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener("resize", resize); };
  }, [state, songIdx, combo, diff]);

  const song = SONGS[songIdx]!;

  return (
    <div className={styles.page}>
      <h1>РИТМ MAGNUM</h1>
      <p className={styles.sub}>Лови ноты в такт — D F J K или тапай по дорожкам {combo >= 5 ? "🔥" : ""}</p>

      {state === "menu" && (
        <div className={styles.menu}>
          <div className={styles.songs}>
            {SONGS.map((s, i) => (
              <button key={s.name} className={`${styles.songBtn} ${i === songIdx ? styles.active : ""}`} onClick={() => setSongIdx(i)}>
                <span className={styles.songName}>{s.name}</span>
                <span className={styles.songMeta}>{s.bpm} BPM • {s.duration}с • {i === songIdx ? "выбран" : "выбрать"}</span>
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {(Object.keys(DIFFICULTY) as DiffKey[]).map((k) => (
              <button key={k} onClick={() => setDiff(k)} style={{ padding: "0.45rem 0.9rem", borderRadius: 999, fontSize: "0.82rem", fontWeight: 800, cursor: "pointer", border: "1px solid", borderColor: diff === k ? "rgba(255,45,85,0.6)" : "rgba(255,255,255,0.12)", background: diff === k ? "rgba(255,45,85,0.14)" : "rgba(255,255,255,0.06)", color: diff === k ? "#ffcc00" : "rgba(240,240,240,0.7)" }}>{DIFFICULTY[k].label} · {DIFFICULTY[k].win}</button>
            ))}
          </div>
          <button className={styles.playBtn} onClick={() => startGame(songIdx)}>Играть — {song.name}!</button>
          <p className={styles.hint}>Клавиши D F J K • Perfect +100 (+комбо) • Good +55 • Нужно {DIFFICULTY[diff].win} очков • {DIFFICULTY[diff].label}</p>
          <Link to="/magnum/games" className={styles.back}>← К играм</Link>
        </div>
      )}

      {(state === "playing" || state === "paused" || state === "win" || state === "fail") && (
        <div className={styles.gameArea}>
          <div className={styles.hud}>
            <div className={styles.stat}><span>Очки</span><strong>{score}</strong></div>
            <div className={styles.stat}><span>Комбо</span><strong className={combo > 6 ? styles.comboHot : ""}>{combo} {combo > 3 ? "🔥" : ""}</strong></div>
            <div className={styles.stat}><span>Макс</span><strong>{maxCombo}</strong></div>
            <div className={styles.stat}><span>Точность</span><strong>{accuracy}%</strong></div>
          </div>
          <div className={styles.progress}><div className={styles.fill} style={{ width: `${Math.min((score / DIFFICULTY[diff].win) * 100, 100)}%` }} /></div>
          {judgement && <div className={`${styles.judgement} ${styles[judgement]}`}>{judgement === "perfect" ? "PERFECT!" : judgement === "good" ? "GOOD!" : "MISS"}</div>}
          <div className={styles.canvasWrap}>
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              onPointerDown={(e) => {
                if (state !== "playing") return;
                const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
                const x = e.clientX - rect.left;
                const lane = Math.min(LANE_COUNT - 1, Math.max(0, Math.floor((x / rect.width) * LANE_COUNT)));
                const now = performance.now() - startTimeRef.current - pausedTimeRef.current;
                pressedRef.current[lane] = true; setTimeout(() => { pressedRef.current[lane] = false; }, 140);
                hitNote(lane, now);
              }}
            />
          </div>
          <div className={styles.controls}>
            {LANE_LABELS.map((lb, i) => (
              <button key={lb} className={styles.keyBtn} style={{ borderColor: LANE_COLORS[i], color: LANE_COLORS[i] }} onPointerDown={(e) => { e.preventDefault(); if (state !== "playing") return; const now = performance.now() - startTimeRef.current - pausedTimeRef.current; pressedRef.current[i] = true; setTimeout(() => { pressedRef.current[i] = false; }, 140); hitNote(i, now); }}>
                {lb}
              </button>
            ))}
          </div>
          {missStreak >= 3 && state === "playing" && <div style={{ fontSize: "0.82rem", color: "rgba(255,204,0,0.9)", background: "rgba(255,204,0,0.08)", border: "1px solid rgba(255,204,0,0.22)", borderRadius: 10, padding: "0.45rem 0.75rem", maxWidth: 520 }}>💡 Подсказка: бей чуть раньше — цель на линии! Попробуй сложность «Легко» (окна шире).</div>}
          <div className={styles.navRow}>
            <button className={styles.restartBtn} onClick={togglePause} style={{ borderColor: state==="paused" ? "rgba(0,255,136,0.35)" : undefined }}>{state === "paused" ? "▶ Продолжить" : "⏸ Пауза (P/Space)"}</button>
            <button className={styles.restartBtn} onClick={() => startGame(songIdx)}>Заново</button>
            <Link to="/magnum/games" className={styles.backInline}>← К играм</Link>
          </div>
          {state === "paused" && <div style={{ fontSize: "0.84rem", color: "rgba(240,240,240,0.62)", marginTop: 4 }}>⏸ Пауза — нажми P / Space / Продолжить • <a href="https://music.thefence.me/psmagnum" target="_blank" rel="noreferrer" style={{ color: "#ff2d55", textDecoration: "underline" }}>Пресейв MAGNUM →</a></div>}
        </div>
      )}

      {state === "win" && (
        <div className={styles.modal} onClick={() => setState("menu")}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h2>🎉 Ритм-мастер!</h2>
            <p>{score} очков • макс комбо {maxCombo} • {accuracy}% точность</p>
            <p className={styles.songDone}>{song.name} — пройден!</p>
            <a href={PRESAVE} target="_blank" rel="noreferrer" className={styles.presaveBtn}>Пресейв MAGNUM →</a>
            <button className={styles.restartBtn} onClick={() => startGame(songIdx)}>Ещё раз</button>
          </div>
        </div>
      )}
      {state === "fail" && (
        <div className={styles.modal} onClick={() => setState("menu")}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h2>Попробуй ещё! 🥁</h2>
            <p>{score} / {DIFFICULTY[diff].win} • комбо {maxCombo} • {accuracy}%</p>
            <p className={styles.failHint}>Нужно больше Perfect — бей точнее в такт!</p>
            <button className={styles.playBtn} onClick={() => startGame(songIdx)}>Ещё попытка</button>
            <Link to="/magnum/games" className={styles.backInline}>← К играм</Link>
          </div>
        </div>
      )}
    </div>
  );
}