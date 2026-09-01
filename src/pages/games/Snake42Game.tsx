import { useRef, useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./Snake42Game.module.css";
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

// Obscura-заглушка AudioParam: ramp может кинуть в некоторых WebAudio реализациях
function safeRamp(param: AudioParam, fn: () => void, fallbackValue: number) {
  try { fn(); } catch { param.value = fallbackValue; }
}

const PRESAVE = "https://music.thefence.me/psmagnum";
const WIN_LENGTH = 42;
const WIN_SCORE = 4200;
const GRID = 20;
const TICK_MS_START = 135;
const TICK_MS_MIN = 62;
const SCORE_PER_FOOD = 100;

type Dir = "up" | "down" | "left" | "right";
type Pt = { x: number; y: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; r: number };
type FloatText = { x: number; y: number; vy: number; life: number; text: string };

const DIR_VECTORS: Record<Dir, Pt> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };
const SNAKE_COLORS = ["#ff2d55", "#ff6b35", "#ffcc00", "#00ff88", "#5865f2", "#a855f7", "#ff2d9a"];

// ─── WebAudio ───────────────────────────────────────────────────────────────
let ac: AudioContext | null = null;
function ensureAC(): AudioContext | null {
  if (!ac) {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ac = new Ctx();
    } catch { return null; }
  }
  if (ac && ac.state === "suspended") void ac.resume();
  return ac;
}
function playMove() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "triangle"; o.frequency.value = 240;
  g.gain.setValueAtTime(0.035, ctx.currentTime);
  safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.095);
}
function playEat() {
  const ctx = ensureAC(); if (!ctx) return;
  // bright pluck: two oscillators for body + chime
  const o = ctx.createOscillator(); const o2 = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); o2.connect(g); g.connect(ctx.destination);
  o.type = "sine"; o.frequency.value = 580; safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.08), 880);
  o2.type = "triangle"; o2.frequency.value = 1160; safeRamp(o2.frequency, () => o2.frequency.linearRampToValueAtTime(980, ctx.currentTime + 0.1), 980);
  g.gain.setValueAtTime(0.2, ctx.currentTime); safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22), 0.001);
  o.start(); o2.start(); o.stop(ctx.currentTime + 0.24); o2.stop(ctx.currentTime + 0.24);
  // click
  const n = ctx.createOscillator(); const ng = ctx.createGain(); n.connect(ng); ng.connect(ctx.destination);
  n.type = "square"; n.frequency.value = 1400; ng.gain.setValueAtTime(0.06, ctx.currentTime);
  safeRamp(ng.gain, () => ng.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05), 0.001);
  n.start(); n.stop(ctx.currentTime + 0.06);
}
function playDie() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain(); const f = ctx.createBiquadFilter();
  o.connect(f); f.connect(g); g.connect(ctx.destination);
  f.type = "lowpass"; f.frequency.value = 1800;
  o.type = "sawtooth"; o.frequency.value = 220; safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(48, ctx.currentTime + 0.42), 48);
  g.gain.setValueAtTime(0.18, ctx.currentTime); safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.48), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.5);
  // thud noise
  const o2 = ctx.createOscillator(); const g2 = ctx.createGain(); o2.connect(g2); g2.connect(ctx.destination);
  o2.type = "square"; o2.frequency.value = 90; g2.gain.setValueAtTime(0.1, ctx.currentTime);
  safeRamp(g2.gain, () => g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2), 0.001);
  o2.start(); o2.stop(ctx.currentTime + 0.22);
}
function playWin() {
  const ctx = ensureAC(); if (!ctx) return;
  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5, 1174.66]; // C5 E5 G5 C6 D6
  notes.forEach((freq, i) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = i % 2 === 0 ? "sine" : "triangle"; o.frequency.value = freq;
    const t0 = now + i * 0.11;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.16, t0 + 0.02);
    safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55), 0.001);
    safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(freq * 1.02, t0 + 0.15), freq * 1.02);
    o.start(t0); o.stop(t0 + 0.6);
  });
  // shimmer
  const sh = ctx.createOscillator(); const sg = ctx.createGain();
  sh.connect(sg); sg.connect(ctx.destination);
  sh.type = "sine"; sh.frequency.value = 1800; sg.gain.setValueAtTime(0.04, now + 0.45);
  safeRamp(sg.gain, () => sg.gain.exponentialRampToValueAtTime(0.001, now + 1.0), 0.001);
  sh.start(now + 0.45); sh.stop(now + 1.05);
}

// ─── helpers ───────────────────────────────────────────────────────────────
function spawnFood(snake: Pt[]): Pt {
  const occupied = new Set(snake.map((p) => `${p.x},${p.y}`));
  const free: Pt[] = [];
  for (let x = 0; x < GRID; x++) for (let y = 0; y < GRID; y++) if (!occupied.has(`${x},${y}`)) free.push({ x, y });
  return free.length > 0 ? free[Math.floor(Math.random() * free.length)]! : { x: 0, y: 0 };
}
function tickForLength(len: number): number {
  // плавная кривая: старт 135 → к 20 длине ~100мс → к 42 ~62мс
  // формула: base - len*1.9 - extraPhase
  const extra = len > 18 ? (len - 18) * 0.7 : 0;
  const curve = Math.log2(len + 2) * 2.2;
  return Math.max(TICK_MS_MIN, TICK_MS_START - len * 1.9 - extra - curve);
}

// ─── component ──────────────────────────────────────────────────────────────
export function Snake42Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"menu" | "playing" | "win" | "over">("menu");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem("snake42-best")) || 0; } catch { return 0; } });
  const [shake, setShake] = useState(0);

  const snakeRef = useRef<Pt[]>([{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]);
  const dirRef = useRef<Dir>("right");
  const nextDirRef = useRef<Dir>("right");
  const foodRef = useRef<Pt>({ x: 15, y: 10 });
  const tickRef = useRef(TICK_MS_START);
  const animRef = useRef(0);
  const lastTickRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const floatsRef = useRef<FloatText[]>([]);
  const shakeRef = useRef(0);
  const moveCountRef = useRef(0);
  const pulseRef = useRef(0);

  const triggerShake = useCallback((intensity: number) => {
    shakeRef.current = intensity;
    setShake(intensity);
    // decay
    const decay = () => {
      shakeRef.current *= 0.78;
      if (shakeRef.current > 0.25) {
        setShake(shakeRef.current);
        requestAnimationFrame(decay);
      } else { shakeRef.current = 0; setShake(0); }
    };
    requestAnimationFrame(decay);
  }, []);

  const reset = useCallback(() => {
    snakeRef.current = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    dirRef.current = "right"; nextDirRef.current = "right";
    foodRef.current = spawnFood(snakeRef.current);
    tickRef.current = TICK_MS_START;
    particlesRef.current = []; floatsRef.current = [];
    moveCountRef.current = 0; pulseRef.current = 0;
    shakeRef.current = 0; setShake(0);
    setScore(0);
  }, []);

  const start = useCallback(() => { reset(); setState("playing"); lastTickRef.current = performance.now(); }, [reset]);

  // keyboard
  useEffect(() => {
    const map: Record<string, Dir> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", KeyW: "up", KeyS: "down", KeyA: "left", KeyD: "right" };
    const onKey = (e: KeyboardEvent) => {
      const d = map[e.code]; if (!d) return;
      e.preventDefault();
      if (d !== OPPOSITE[dirRef.current]) nextDirRef.current = d;
      if (e.code === "Space" && state === "playing") { /* pause reserved */ }
    };
    window.addEventListener("keydown", onKey);
  
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

  return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  // touch
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = useCallback((e: React.TouchEvent) => { touchRef.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY }; }, []);
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const t = e.changedTouches[0]!; const dx = t.clientX - touchRef.current.x; const dy = t.clientY - touchRef.current.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    const d: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
    if (d !== OPPOSITE[dirRef.current]) nextDirRef.current = d;
    touchRef.current = null;
  }, []);

  // main loop
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const DPR = window.devicePixelRatio || 1;
    const SIZE = 400;
    canvas.width = SIZE * DPR; canvas.height = SIZE * DPR;
    canvas.style.width = SIZE + "px"; canvas.style.height = SIZE + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const cellW = SIZE / GRID;

    const draw = (now: number) => {
      // ── game tick ─────────────────────────────────────────────
      if (state === "playing") {
        if (now - lastTickRef.current >= tickRef.current) {
          lastTickRef.current = now;
          dirRef.current = nextDirRef.current;
          const snake = snakeRef.current;
          const head = snake[0]!;
          const vec = DIR_VECTORS[dirRef.current];
          const newHead: Pt = { x: head.x + vec.x, y: head.y + vec.y };

          // wall / self collision
          const hitWall = newHead.x < 0 || newHead.x >= GRID || newHead.y < 0 || newHead.y >= GRID;
          const hitSelf = snake.some((p) => p.x === newHead.x && p.y === newHead.y);
          if (hitWall || hitSelf) {
            playDie(); triggerShake(8);
            const curScore = snake.length * SCORE_PER_FOOD;
            const nb = Math.max(best, curScore); setBest(nb);
            try { localStorage.setItem("snake42-best", String(nb)); } catch {}
            setState("over");
            animRef.current = requestAnimationFrame(draw); return;
          }

          snake.unshift(newHead);
          moveCountRef.current++;
          if (moveCountRef.current % 2 === 0) playMove();

          const ate = newHead.x === foodRef.current.x && newHead.y === foodRef.current.y;
          if (ate) {
            playEat(); triggerShake(4.5);
            foodRef.current = spawnFood(snake);
            const newScore = snake.length * SCORE_PER_FOOD;
            setScore(newScore);
            const nb = Math.max(best, newScore); setBest(nb);
            try { localStorage.setItem("snake42-best", String(nb)); } catch {}

            // particles burst 12
            const burstColor = SNAKE_COLORS[snake.length % SNAKE_COLORS.length]!;
            for (let i = 0; i < 12; i++) {
              const ang = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
              const sp = 2.5 + Math.random() * 3.5;
              particlesRef.current.push({
                x: newHead.x * cellW + cellW / 2, y: newHead.y * cellW + cellW / 2,
                vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - Math.random() * 1.5,
                life: 1, color: burstColor, r: 2.2 + Math.random() * 2.6,
              });
            }
            // floating +100
            floatsRef.current.push({
              x: newHead.x * cellW + cellW / 2, y: newHead.y * cellW + cellW / 2 - 6,
              vy: -1.2, life: 1, text: `+${SCORE_PER_FOOD}`,
            });
            // extra sparkles
            for (let i = 0; i < 4; i++) particlesRef.current.push({
              x: newHead.x * cellW + cellW / 2 + (Math.random() - 0.5) * 10,
              y: newHead.y * cellW + cellW / 2 + (Math.random() - 0.5) * 10,
              vx: (Math.random() - 0.5) * 1.2, vy: -Math.random() * 2 - 0.5,
              life: 1, color: "#fff", r: 1.4,
            });

            tickRef.current = tickForLength(snake.length);

            // win: length 42 OR score 4200
            if (snake.length >= WIN_LENGTH || newScore >= WIN_SCORE) {
              playWin(); triggerShake(10);
              // confetti
              for (let i = 0; i < 22; i++) particlesRef.current.push({
                x: SIZE / 2 + (Math.random() - 0.5) * 80, y: SIZE / 2,
                vx: (Math.random() - 0.5) * 7, vy: -Math.random() * 6 - 2,
                life: 1, color: SNAKE_COLORS[Math.floor(Math.random() * SNAKE_COLORS.length)]!, r: 3 + Math.random() * 3,
              });
              setState("win");
            }
          } else {
            snake.pop();
            // subtle trail particle on fast mode
            if (tickRef.current < 85 && Math.random() < 0.25) {
              const tail = snake[snake.length - 1]!;
              particlesRef.current.push({
                x: tail.x * cellW + cellW / 2, y: tail.y * cellW + cellW / 2,
                vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.8,
                life: 0.6, color: "rgba(255,255,255,0.35)", r: 1.2,
              });
            }
          }
        }
      }

      // ── render ────────────────────────────────────────────────
      ctx.save();
      // shake translate
      if (shakeRef.current > 0.2) {
        const sx = (Math.random() - 0.5) * shakeRef.current;
        const sy = (Math.random() - 0.5) * shakeRef.current;
        ctx.translate(sx, sy);
      }

      ctx.clearRect(-10, -10, SIZE + 20, SIZE + 20);
      const bg = ctx.createLinearGradient(0, 0, 0, SIZE);
      bg.addColorStop(0, "#08081a"); bg.addColorStop(0.5, "#110a22"); bg.addColorStop(1, "#1a0a2e");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, SIZE, SIZE);

      // grid
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      for (let i = 1; i < GRID; i++) {
        ctx.beginPath(); ctx.moveTo(i * cellW, 0); ctx.lineTo(i * cellW, SIZE); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * cellW); ctx.lineTo(SIZE, i * cellW); ctx.stroke();
      }
      // outer glow border
      ctx.strokeStyle = "rgba(255,45,85,0.1)"; ctx.lineWidth = 2; ctx.strokeRect(0.5, 0.5, SIZE - 1, SIZE - 1);

      if (state === "playing" || state === "win" || state === "over") {
        // food with pulse & rotation
        pulseRef.current += 0.08;
        const pulse = 1 + Math.sin(pulseRef.current) * 0.07;
        const f = foodRef.current;
        const fx = f.x * cellW + cellW / 2, fy = f.y * cellW + cellW / 2;
        ctx.save();
        ctx.translate(fx, fy); ctx.scale(pulse, pulse);
        ctx.shadowColor = "#ff2d55"; ctx.shadowBlur = 16;
        ctx.fillStyle = "#ff2d55";
        ctx.beginPath(); ctx.arc(0, 0, cellW * 0.38, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        // inner highlight
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.beginPath(); ctx.arc(-cellW * 0.1, -cellW * 0.1, cellW * 0.13, 0, Math.PI * 2); ctx.fill();
        // label 42
        ctx.fillStyle = "#fff"; ctx.font = `900 ${cellW * 0.42}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("42", 0, 1.2);
        ctx.restore();

        // snake body
        const snake = snakeRef.current;
        for (let i = snake.length - 1; i >= 0; i--) {
          const p = snake[i]!;
          const color = SNAKE_COLORS[i % SNAKE_COLORS.length]!;
          const isHead = i === 0;
          const r = isHead ? cellW * 0.44 : cellW * 0.38;
          const cx = p.x * cellW + cellW / 2, cy = p.y * cellW + cellW / 2;
          // segment shadow
          if (isHead) { ctx.shadowColor = color; ctx.shadowBlur = 14; }
          else if (i === 1) { ctx.shadowColor = color; ctx.shadowBlur = 6; }
          // body fill with subtle gradient
          const grd = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.2, cx, cy, r);
          grd.addColorStop(0, isHead ? "#ffffff22" : color);
          grd.addColorStop(1, color);
          ctx.fillStyle = grd;
          ctx.beginPath();
          // modern roundRect; fallback to arc
          if (typeof (ctx as unknown as { roundRect: unknown }).roundRect === "function") {
            (ctx as unknown as { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(cx - r, cy - r, r * 2, r * 2, isHead ? 6 : 4);
            ctx.fill();
          } else {
            ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
          }
          ctx.shadowBlur = 0;
          // head eyes + nostril
          if (isHead) {
            const vec = DIR_VECTORS[dirRef.current];
            const ex = cx + vec.x * cellW * 0.12, ey = cy + vec.y * cellW * 0.12;
            const off = 3.2;
            // eye whites
            ctx.fillStyle = "#fff";
            ctx.beginPath(); ctx.arc(ex - off, ey - 2, 2.7, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(ex + off, ey - 2, 2.7, 0, Math.PI * 2); ctx.fill();
            // pupils looking forward
            ctx.fillStyle = "#0a0a0a";
            const px = vec.x * 0.9, py = vec.y * 0.9;
            ctx.beginPath(); ctx.arc(ex - off + px, ey - 2 + py, 1.35, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(ex + off + px, ey - 2 + py, 1.35, 0, Math.PI * 2); ctx.fill();
            // shine
            ctx.fillStyle = "rgba(255,255,255,0.9)";
            ctx.beginPath(); ctx.arc(ex - off + 0.6, ey - 2.6, 0.6, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(ex + off + 0.6, ey - 2.6, 0.6, 0, Math.PI * 2); ctx.fill();
            // tongue when moving
            if (moveCountRef.current % 14 === 0) {
              ctx.strokeStyle = "#ff2d55"; ctx.lineWidth = 1.4; ctx.lineCap = "round";
              const tx = cx + vec.x * (cellW * 0.5), ty = cy + vec.y * (cellW * 0.5);
              ctx.beginPath(); ctx.moveTo(cx + vec.x * r, cy + vec.y * r);
              ctx.lineTo(tx, ty); ctx.stroke();
            }
          } else {
            // tail darker crescent
            if (i === snake.length - 1) {
              ctx.fillStyle = "rgba(0,0,0,0.18)";
              ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2); ctx.fill();
            }
          }
        }
      } else {
        // menu idle snakes drifting
        const t = now * 0.0007;
        for (let i = 0; i < 14; i++) {
          const x = ((Math.sin(t * 0.9 + i * 0.7) + 1) / 2) * (GRID - 1);
          const y = ((Math.cos(t * 0.6 + i * 0.55) + 1) / 2) * (GRID - 1);
          ctx.globalAlpha = 0.18 + Math.sin(t * 2 + i) * 0.06;
          ctx.fillStyle = SNAKE_COLORS[i % SNAKE_COLORS.length]!;
          ctx.beginPath();
          if (typeof (ctx as unknown as { roundRect: unknown }).roundRect === "function") {
            (ctx as unknown as { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(x * cellW + 2, y * cellW + 2, cellW - 4, cellW - 4, 5);
            ctx.fill();
          } else { ctx.fillRect(x * cellW + 2, y * cellW + 2, cellW - 4, cellW - 4); }
        }
        ctx.globalAlpha = 1;
        // big 42 watermark
        ctx.fillStyle = "rgba(255,255,255,0.03)";
        ctx.font = "900 72px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("42", SIZE / 2, SIZE / 2);
      }

      // particles (gravity)
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0);
      for (const p of particlesRef.current) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.vx *= 0.99; p.life -= 0.025;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // floating +score texts
      floatsRef.current = floatsRef.current.filter((f) => f.life > 0);
      for (const f of floatsRef.current) {
        f.y += f.vy; f.vy -= 0.03; f.life -= 0.022;
        ctx.globalAlpha = Math.max(0, f.life);
        ctx.fillStyle = "#ffcc00"; ctx.font = "900 13px Inter, sans-serif";
        ctx.textAlign = "center"; ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.lineWidth = 3;
        ctx.strokeText(f.text, f.x, f.y); ctx.fillText(f.text, f.x, f.y);
      }
      ctx.globalAlpha = 1;

      // vignette
      const vig = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.35, SIZE / 2, SIZE / 2, SIZE * 0.82);
      vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(0,0,0,0.38)");
      ctx.fillStyle = vig; ctx.fillRect(0, 0, SIZE, SIZE);

      ctx.restore();
      animRef.current = requestAnimationFrame(draw);
    };
    lastTickRef.current = performance.now();
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [state, best, triggerShake]);

  const progress = Math.min((score / WIN_SCORE) * 100, 100);
  const speedLabel = tickRef.current < 70 ? "ТУРБО" : tickRef.current < 90 ? "БЫСТРО" : tickRef.current < 115 ? "НОРМ" : "СТАРТ";

  return (
    <div className={styles.page} style={shake ? { transform: `translate(${ (Math.random()-0.5)*shake}px, ${(Math.random()-0.5)*shake}px)` } : undefined}>
      <h1>ЗМЕЙКА 42</h1>
      <p className={styles.sub}>Стрелки / WASD / свайп — собери {WIN_LENGTH} клеток или {WIN_SCORE} очков</p>

      {state === "menu" && (
        <div className={styles.menu}>
          <div className={styles.rules}>
            <p>🐍 Управление: стрелки / WASD / свайп</p>
            <p>🍎 Ешь «42» — рост +{SCORE_PER_FOOD} очков</p>
            <p>⚡ Скорость растёт каждые 3 еды — баланс до {TICK_MS_MIN} мс</p>
            <p>💀 Стены и хвост = конец • шейк + частицы на еду</p>
            <p>🏆 Цель: длина {WIN_LENGTH} или {WIN_SCORE} очков → пресейв</p>
          </div>
          <button className={styles.playBtn} onClick={() => { ensureAC(); start(); }}>Начать!</button>
          <p className={styles.hint}>Рекорд: {best} очков • Длина {Math.floor(best / SCORE_PER_FOOD)}</p>
          <Link to="/magnum/games" className={styles.back}>← К играм</Link>
        </div>
      )}

      {(state === "playing" || state === "win" || state === "over") && (
        <div className={styles.gameArea}>
          <div className={styles.hud}>
            <div className={styles.stat}><span>Очки</span><strong>{score}</strong></div>
            <div className={styles.stat}><span>Длина</span><strong>{Math.floor(score / SCORE_PER_FOOD)} / {WIN_LENGTH}</strong></div>
            <div className={styles.stat}><span>Рекорд</span><strong>{best}</strong></div>
            <div className={styles.stat}><span>Скорость</span><strong style={{ fontSize: "0.95rem" }}>{speedLabel}</strong></div>
          </div>
          <div className={styles.progress} aria-label="прогресс к 4200"><div className={styles.fill} style={{ width: `${progress}%` }} /></div>
          <div className={styles.canvasWrap} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <canvas ref={canvasRef} className={styles.canvas} />
          </div>
          <div className={styles.navRow}>
            <button className={styles.restartBtn} onClick={start}>Заново</button>
            <Link to="/magnum/games" className={styles.backInline}>← К играм</Link>
          </div>
          <p className={styles.hint} style={{ marginTop: 8, opacity: 0.5 }}>Каждое движение — тихий «ход», еда — яркий звук, победа — фанфары. Шейк на еду/удар.</p>
        </div>
      )}

      {state === "win" && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2>🏆 ЗМЕЙКА 42 — 4200!</h2>
            <p>Ты собрал {score} очков • Длина {Math.floor(score / SCORE_PER_FOOD)} / {WIN_LENGTH} — магическое число достигнуто!</p>
            <a href={PRESAVE} target="_blank" rel="noreferrer" className={styles.presaveBtn}>Пресейв MAGNUM →</a>
            <div className={styles.navRow} style={{ justifyContent: "center" }}><button className={styles.restartBtn} onClick={start}>Ещё раз</button></div>
          </div>
        </div>
      )}
      {state === "over" && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2>💀 Столкновение!</h2>
            <p>{score} очков • Длина {Math.floor(score / SCORE_PER_FOOD)} / {WIN_LENGTH} • Рекорд {best}</p>
            <button className={styles.playBtn} onClick={start}>Ещё попытка</button>
            <div style={{ marginTop: 10 }}><Link to="/magnum/games" className={styles.backInline}>← К играм</Link></div>
          </div>
        </div>
      )}
    </div>
  );
}