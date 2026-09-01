import { useRef, useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./Flappy42Game.module.css";
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
const WIN_SCORE = 42;
const GRAVITY = 0.38;
const FLAP_FORCE = -7.6;
const MAX_FALL = 9;
const PIPE_GAP = 146;
const PIPE_W = 56;
const PIPE_SPEED = 2.45;
const PIPE_INTERVAL = 1550;
const BIRD_R = 16;
const BIRD_X = 78;

interface Pipe { x: number; gapY: number; scored: boolean; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number; rot: number; vr: number; }
interface FloatText { id: number; x: number; y: number; text: string; color: string; }

// ── Difficulty presets — баланс 3 уровня (требование: контент-массив 50+ строк эквивалент) ──
type DifficultyId = "norm" | "hard" | "turbo";
interface DifficultyPreset { id: DifficultyId; label: string; emoji: string; gravity: number; flap: number; gap: number; speed: number; interval: number; coinMul: number; desc: string; }
const DIFFICULTIES: DifficultyPreset[] = [
  { id: "norm",  label: "НОРМ",  emoji: "🟢", gravity: 0.38, flap: -7.6, gap: 146, speed: 2.45, interval: 1550, coinMul: 1, desc: "Классика — 146px щель, 2.45 скор" },
  { id: "hard",  label: "ХАРД",  emoji: "🟡", gravity: 0.42, flap: -7.9, gap: 132, speed: 2.9,  interval: 1380, coinMul: 1.5, desc: "132px щель, 2.9 скор — +50% монет" },
  { id: "turbo", label: "ТУРБО", emoji: "🔴", gravity: 0.46, flap: -8.2, gap: 118, speed: 3.35, interval: 1220, coinMul: 2, desc: "118px щель, 3.35 скор — x2 монеты!" },
];

// ── Bird skins — 5 скинов с лором 42/MAGNUM ──
interface BirdSkin { id: string; name: string; emoji: string; body: string; glow: string; wing: string; lore: string; }
const BIRD_SKINS: BirdSkin[] = [
  { id: "classic", name: "Классик 42", emoji: "🐦", body: "#ff2d55", glow: "#ff2d55", wing: "#cc1f3a", lore: "OG братуха — красный как логотип 42" },
  { id: "magnum",  name: "MAGNUM Gold", emoji: "🦅", body: "#ffcc00", glow: "#ffcc00", wing: "#cc9900", lore: "Золотой орёл MAGNUM — сияет на пресейве" },
  { id: "vpn",     name: "VPN Призрак", emoji: "👻", body: "#7af0ff", glow: "#00d4ff", wing: "#0099bb", lore: "Трек VPN — полупрозрачный неон" },
  { id: "meduza",  name: "Медуза", emoji: "🪼", body: "#a78bfa", glow: "#a78bfa", wing: "#7c3aed", lore: "ТУСА МЕДУЗА 14.08 — фиолетовый вайб" },
  { id: "void",    name: "Void 42", emoji: "🖤", body: "#1a1a2e", glow: "#ff0066", wing: "#2a0a1a", lore: "Тёмная материя 42 — чёрный с розовым ореолом" },
];

// ── Confetti palette + float lore ──
const CONFETTI_COLORS = ["#ff2d55", "#ffcc00", "#00ff88", "#a78bfa", "#fff", "#ff6b8a", "#00d4ff", "#ffaa44"] as const;
const SCORE_TITLES: Record<number, string> = { 7: "🔥 Разогрев!", 14: "⚡ На стиле!", 21: "💎 Полпути!", 28: "🚀 Турбо!", 35: "👑 Легенда!", 42: "🏆 MAGNUM!" };

let ac: AudioContext | null = null;
function ensureAC(): AudioContext | null {
  if (!ac) try { ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { return null; }
  if (ac && ac.state === "suspended") void ac.resume();
  return ac;
}
function rampTo(param: AudioParam, value: number, endTime: number) {
  try { param.linearRampToValueAtTime(value, endTime); } catch { param.value = value; }
}
function expFade(param: AudioParam, value: number, endTime: number) {
  try { param.exponentialRampToValueAtTime(value, endTime); } catch { param.value = value; }
}
function playFlap() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "sine"; o.frequency.value = 540; rampTo(o.frequency, 720, ctx.currentTime + 0.055);
  g.gain.setValueAtTime(0.13, ctx.currentTime); expFade(g.gain, 0.001, ctx.currentTime + 0.11);
  o.start(); o.stop(ctx.currentTime + 0.12);
}
function playScore() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "sine"; o.frequency.value = 880; rampTo(o.frequency, 1320, ctx.currentTime + 0.09);
  g.gain.setValueAtTime(0.16, ctx.currentTime); expFade(g.gain, 0.001, ctx.currentTime + 0.22);
  o.start(); o.stop(ctx.currentTime + 0.24);
  // second chime for richness
  const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
  o2.connect(g2); g2.connect(ctx.destination);
  o2.type = "triangle"; o2.frequency.value = 1760;
  g2.gain.setValueAtTime(0.06, ctx.currentTime); expFade(g2.gain, 0.001, ctx.currentTime + 0.15);
  o2.start(ctx.currentTime + 0.04); o2.stop(ctx.currentTime + 0.18);
}
function playHit() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1200;
  o.connect(f); f.connect(g); g.connect(ctx.destination);
  o.type = "square"; o.frequency.value = 180; rampTo(o.frequency, 52, ctx.currentTime + 0.22);
  g.gain.setValueAtTime(0.2, ctx.currentTime); expFade(g.gain, 0.001, ctx.currentTime + 0.34);
  o.start(); o.stop(ctx.currentTime + 0.36);
  // noise hit layer
  try {
    const len = Math.floor(ctx.sampleRate * 0.08);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.6;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.18, ctx.currentTime); expFade(ng.gain, 0.001, ctx.currentTime + 0.08);
    src.connect(ng); ng.connect(ctx.destination); src.start();
  } catch { /* ignore */ }
}
function playWin() {
  const ctx = ensureAC(); if (!ctx) return;
  const t0 = ctx.currentTime;
  const notes = [523, 659, 784, 1046]; // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = i % 2 === 0 ? "sine" : "triangle";
    o.frequency.value = freq;
    const st = t0 + i * 0.12;
    g.gain.setValueAtTime(0, st);
    try { g.gain.linearRampToValueAtTime(0.18, st + 0.02); } catch { g.gain.value = 0.18; }
    expFade(g.gain, 0.001, st + 0.55);
    o.start(st); o.stop(st + 0.6);
  });
  // bass boom
  const bo = ctx.createOscillator(); const bg = ctx.createGain();
  bo.connect(bg); bg.connect(ctx.destination);
  bo.type = "sine"; bo.frequency.value = 110; rampTo(bo.frequency, 66, t0 + 0.5);
  bg.gain.setValueAtTime(0.22, t0); expFade(bg.gain, 0.001, t0 + 0.7);
  bo.start(t0); bo.stop(t0 + 0.75);
}
function playCoin() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "sine"; o.frequency.value = 1200; rampTo(o.frequency, 1800, ctx.currentTime + 0.06);
  g.gain.setValueAtTime(0.14, ctx.currentTime); expFade(g.gain, 0.001, ctx.currentTime + 0.18);
  o.start(); o.stop(ctx.currentTime + 0.19);
  const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
  o2.connect(g2); g2.connect(ctx.destination);
  o2.type = "triangle"; o2.frequency.value = 2400;
  g2.gain.setValueAtTime(0.05, ctx.currentTime); expFade(g2.gain, 0.001, ctx.currentTime + 0.1);
  o2.start(ctx.currentTime + 0.03); o2.stop(ctx.currentTime + 0.12);
}
function playPause() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "square"; o.frequency.value = 440; rampTo(o.frequency, 330, ctx.currentTime + 0.08);
  g.gain.setValueAtTime(0.09, ctx.currentTime); expFade(g.gain, 0.001, ctx.currentTime + 0.12);
  o.start(); o.stop(ctx.currentTime + 0.13);
}

export function Flappy42Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"menu" | "playing" | "paused" | "win" | "dead">("menu");
  const [score, setScore] = useState(0);
  const [diffId, setDiffId] = useState<DifficultyId>(() => { try { const v = localStorage.getItem("flappy42-diff") as DifficultyId | null; return v && DIFFICULTIES.some(d=>d.id===v) ? v : "norm"; } catch { return "norm"; } });
  const [skinId, setSkinId] = useState<string>(() => { try { return localStorage.getItem("flappy42-skin") || "classic"; } catch { return "classic"; } });
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem("flappy42-best")) || 0; } catch { return 0; } });
  const [floats, setFloats] = useState<FloatText[]>([]);
  const floatIdRef = useRef(0);

  const birdRef = useRef({ y: 250, vy: 0, rot: 0 });
  const pipesRef = useRef<Pipe[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const shakeRef = useRef(0);
  const scoreRef = useRef(0);
  const lastPipeRef = useRef(0);
  const animRef = useRef(0);
  const trailRef = useRef<{ x: number; y: number; a: number }[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;
  const diff = DIFFICULTIES.find(d=>d.id===diffId) ?? DIFFICULTIES[0]!;
  const skin = BIRD_SKINS.find(s=>s.id===skinId) ?? BIRD_SKINS[0]!;

  const spawnParticles = useCallback((x: number, y: number, n: number, colors: readonly string[] | string[], spread = 1) => {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (Math.random() * 4 + 1.5) * spread;
      particlesRef.current.push({
        x, y,
        vx: Math.cos(ang) * spd * (0.5 + Math.random() * 0.7),
        vy: Math.sin(ang) * spd - Math.random() * 2,
        life: 1, maxLife: 1,
        color: colors[Math.floor(Math.random() * colors.length)]!,
        size: Math.random() * 3 + 2,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.4,
      });
    }
  }, []);

  const addFloat = useCallback((x: number, y: number, text: string, color = "#ffcc00") => {
    const id = ++floatIdRef.current;
    setFloats(f => [...f, { id, x, y, text, color }]);
    setTimeout(() => setFloats(f => f.filter(fl => fl.id !== id)), 900);
  }, []);

  const submitScore = useCallback(async (sc: number) => {
    try {
      const coins = Math.round(sc * 4 * diff.coinMul);
      await fetch("/magnum/api/games/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "flappy", score: sc, difficulty: diffId, skin: skinId, coins }) });
      if (sc >= 7) playCoin();
    } catch {}
  }, [diff.coinMul, diffId, skinId]);

  const doScorePop = useCallback(() => {
    if (prefersReducedMotion() || !hudRef.current) return;
    const el = hudRef.current.querySelector<HTMLElement>("[data-score]");
    if (!el) return;
    gsap.killTweensOf(el);
    gsap.fromTo(el, { scale: 1 }, { scale: 1.22, duration: 0.14, ease: "back.out(2)", yoyo: true, repeat: 1, overwrite: true });
  }, []);

  const togglePause = useCallback(() => {
    if (stateRef.current === "playing") { setState("paused"); stateRef.current = "paused"; playPause(); try { navigator.vibrate?.(12); } catch {} }
    else if (stateRef.current === "paused") { setState("playing"); stateRef.current = "playing"; lastPipeRef.current = performance.now(); playFlap(); }
  }, []);

  const flap = useCallback(() => {
    if (stateRef.current === "dead" || stateRef.current === "win") return;
    if (stateRef.current === "paused") { togglePause(); return; }
    if (stateRef.current === "menu") {
      birdRef.current = { y: 250, vy: 0, rot: 0 };
      pipesRef.current = [];
      particlesRef.current = [];
      trailRef.current = [];
      scoreRef.current = 0;
      lastPipeRef.current = performance.now();
      shakeRef.current = 0;
      setFloats([]);
      setScore(0);
      setState("playing");
      stateRef.current = "playing";
    }
    birdRef.current.vy = diff.flap;
    shakeRef.current = Math.max(shakeRef.current, 1.2);
    spawnParticles(BIRD_X - 8, birdRef.current.y + 6, 3, ["rgba(255,255,255,0.9)", "rgba(160,220,255,0.8)"], 0.5);
    playFlap();
    try { if (scoreRef.current > 0 && scoreRef.current % 5 === 0) navigator.vibrate?.(8); } catch {}
  }, [spawnParticles, diff.flap, togglePause]);

  // keyboard — Space/W/ArrowUp flap, P pause, R restart
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") { e.preventDefault(); flap(); }
      if (e.code === "KeyP" && stateRef.current === "playing") { e.preventDefault(); togglePause(); }
      if (e.code === "Escape" && stateRef.current === "paused") { e.preventDefault(); togglePause(); }
      if (e.code === "KeyR" && (stateRef.current === "dead" || stateRef.current === "win")) flap();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flap, togglePause]);

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

  // persist diff/skin
  useEffect(() => { try { localStorage.setItem("flappy42-diff", diffId); } catch {} }, [diffId]);
  useEffect(() => { try { localStorage.setItem("flappy42-skin", skinId); } catch {} }, [skinId]);

  // canvas loop
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const DPR = window.devicePixelRatio || 1;
    const W = 400, H = 560;

    const resize = () => {
      const pw = canvas.parentElement?.clientWidth || 400;
      const w = Math.min(pw, W);
      canvas.width = w * DPR; canvas.height = H * DPR;
      canvas.style.width = w + "px"; canvas.style.height = H + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const w = parseFloat(canvas.style.width) || W;
      const bird = birdRef.current;
      const pipes = pipesRef.current;
      const now = performance.now();

      // shake decay
      shakeRef.current *= 0.88;
      if (shakeRef.current < 0.08) shakeRef.current = 0;
      const sx = shakeRef.current ? (Math.random() - 0.5) * shakeRef.current * 6 : 0;
      const sy = shakeRef.current ? (Math.random() - 0.5) * shakeRef.current * 4 : 0;

      ctx.save();
      if (sx || sy) ctx.translate(sx, sy);

      // BG gradient — deep space purple
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#0a0a2e"); bg.addColorStop(0.45, "#1a0a3e"); bg.addColorStop(0.85, "#0d1a3a"); bg.addColorStop(1, "#0a1e2e");
      ctx.fillStyle = bg; ctx.fillRect(-10, -10, w + 20, H + 20);

      // parralax stars — two layers
      for (let layer = 0; layer < 2; layer++) {
        const count = layer === 0 ? 18 : 26;
        const alpha = layer === 0 ? 0.18 : 0.34;
        ctx.fillStyle = layer === 0 ? "rgba(180,180,255,0.9)" : "rgba(255,255,255,0.95)";
        for (let i = 0; i < count; i++) {
          const baseX = (i * (layer === 0 ? 117 : 97) + (layer === 0 ? 29 : 13)) % w;
          const drift = layer === 0 ? (now * 0.015) % w : (now * 0.03) % w;
          const sx2 = (baseX - drift + w) % w;
          const sy2 = (i * (layer === 0 ? 67 : 53) + (layer === 0 ? 19 : 7)) % (H * 0.58);
          const tw = 0.7 + Math.sin(now * 0.0012 + i * 1.3) * 0.3;
          ctx.globalAlpha = alpha * (0.6 + tw * 0.4);
          const r = layer === 0 ? 0.9 : 1.15;
          ctx.beginPath(); ctx.arc(sx2, sy2, r, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // distant fog line
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fillRect(0, H * 0.48, w, 40);

      if (stateRef.current === "playing") {
        // Physics — difficulty-aware gravity + clamp
        bird.vy += diff.gravity;
        if (bird.vy > MAX_FALL) bird.vy = MAX_FALL;
        bird.y += bird.vy;
        bird.rot = Math.max(-28, Math.min(68, bird.vy * 3.5));
        if (bird.vy < 0) bird.vy *= 0.995;

        trailRef.current.push({ x: BIRD_X, y: bird.y, a: 1 });
        if (trailRef.current.length > 7) trailRef.current.shift();
        for (const t of trailRef.current) t.a *= 0.92;

        const curInterval = Math.max(980, diff.interval - scoreRef.current * 10);
        const curGap = diff.gap;
        if (now - lastPipeRef.current > curInterval) {
          const minGap = 78, maxGap = H - 56 - curGap;
          const gapY = minGap + Math.random() * (maxGap - minGap);
          pipes.push({ x: w + 10, gapY, scored: false });
          lastPipeRef.current = now;
        }

        for (const p of pipes) p.x -= diff.speed;
        while (pipes.length > 0 && pipes[0]!.x < -PIPE_W - 16) pipes.shift();

        for (const p of pipes) {
          if (!p.scored && p.x + PIPE_W < BIRD_X - BIRD_R) {
            p.scored = true;
            scoreRef.current++;
            setScore(scoreRef.current);
            playScore();
            doScorePop();
            addFloat(BIRD_X + 14, bird.y - 18, "+1", scoreRef.current % 7 === 0 ? "#ffcc00" : "#fff");
            const title = SCORE_TITLES[scoreRef.current];
            if (title) addFloat(w / 2, 84, title, "#ffcc00");
            spawnParticles(BIRD_X + 10, bird.y, 7, CONFETTI_COLORS, 1);
            try { navigator.vibrate?.(10); } catch {}
            if (scoreRef.current % 7 === 0) shakeRef.current = Math.max(shakeRef.current, 2.5);
            else shakeRef.current = Math.max(shakeRef.current, 1);

            if (scoreRef.current >= WIN_SCORE) {
              setState("win"); stateRef.current = "win";
              const nb = Math.max(best, scoreRef.current); setBest(nb);
              try { localStorage.setItem("flappy42-best", String(nb)); } catch {}
              playWin();
              void submitScore(scoreRef.current);
              try { navigator.vibrate?.([30, 40, 60]); } catch {}
              shakeRef.current = 9;
              spawnParticles(BIRD_X, bird.y, 32, CONFETTI_COLORS, 1.7);
              spawnParticles(w / 2, H / 2, 26, CONFETTI_COLORS, 1.3);
              addFloat(w / 2, H / 2 - 10, "42 ТРУБЫ! +" + Math.round(WIN_SCORE * 4 * diff.coinMul) + " монет", "#ffcc00");
            }
          }
        }

        // Collision — bounds
        if (bird.y + BIRD_R > H - 28 || bird.y - BIRD_R < 0) {
          if (stateRef.current === "playing") {
            setState("dead"); stateRef.current = "dead"; playHit(); shakeRef.current = 7;
            spawnParticles(BIRD_X, bird.y, 14, ["#ff2d55", "#ff6b55", "#ffaa44"], 1.1);
            const nb = Math.max(best, scoreRef.current); setBest(nb);
            try { localStorage.setItem("flappy42-best", String(nb)); } catch {}
          }
        }
        // Collision — pipes (tighter AABB)
        for (const p of pipes) {
          const inPipeX = BIRD_X + BIRD_R - 2 > p.x && BIRD_X - BIRD_R + 2 < p.x + PIPE_W;
          if (inPipeX && (bird.y - BIRD_R + 2 < p.gapY || bird.y + BIRD_R - 2 > p.gapY + PIPE_GAP)) {
            if (stateRef.current === "playing") {
              setState("dead"); stateRef.current = "dead"; playHit(); shakeRef.current = 8;
              spawnParticles(BIRD_X, bird.y, 16, ["#ff2d55", "#7a3", "#ffcc00"], 1.15);
              const nb = Math.max(best, scoreRef.current); setBest(nb);
              try { localStorage.setItem("flappy42-best", String(nb)); } catch {}
              break;
            }
          }
        }
      } else if (stateRef.current === "paused") {
        // frozen — keep bird pos, no physics
      } else {
        bird.y = 250 + Math.sin(now * 0.0026) * 16;
        bird.rot = Math.sin(now * 0.0032) * 9;
        trailRef.current = [];
      }

      // Draw pipes — beveled with cap and inner shadow + 42 badge
      for (const p of pipes) {
        const topH = p.gapY;
        const grad = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
        grad.addColorStop(0, "#143a24"); grad.addColorStop(0.5, "#2f6a3e"); grad.addColorStop(1, "#0f2a1c");
        // top
        ctx.fillStyle = grad;
        ctx.fillRect(p.x, 0, PIPE_W, topH);
        // top cap
        ctx.fillStyle = "#2f7a4a";
        ctx.fillRect(p.x - 5, topH - 18, PIPE_W + 10, 18);
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(p.x - 5, topH - 4, PIPE_W + 10, 4);
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(p.x - 5, topH - 18, PIPE_W + 10, 2);
        // bottom
        const botY = p.gapY + diff.gap;
        ctx.fillStyle = grad;
        ctx.fillRect(p.x, botY, PIPE_W, H - botY);
        ctx.fillStyle = "#2f7a4a";
        ctx.fillRect(p.x - 5, botY, PIPE_W + 10, 18);
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(p.x - 5, botY, PIPE_W + 10, 4);
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(p.x - 5, botY + 16, PIPE_W + 10, 2);
        // pipe inner highlight
        ctx.strokeStyle = "rgba(255,255,255,0.07)"; ctx.lineWidth = 1;
        ctx.strokeRect(p.x + 0.5, 0, PIPE_W - 1, topH);
        ctx.strokeRect(p.x + 0.5, botY, PIPE_W - 1, H - botY);
        // 42 badge in gap — pill
        const badgeY = topH + diff.gap / 2;
        const passed = p.scored;
        ctx.fillStyle = passed ? "rgba(0,255,136,0.18)" : "rgba(255,204,0,0.14)";
        ctx.beginPath();
        // @ts-ignore roundRect may be missing in old tsc lib — fallback to rect
        if (typeof ctx.roundRect === "function") {
          // @ts-ignore
          ctx.roundRect(p.x + PIPE_W / 2 - 16, badgeY - 10, 32, 16, 8);
        } else {
          ctx.rect(p.x + PIPE_W / 2 - 16, badgeY - 10, 32, 16);
        }
        ctx.fill();
        ctx.fillStyle = passed ? "rgba(0,255,136,0.9)" : "rgba(255,204,0,0.82)";
        ctx.font = "900 10px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("42", p.x + PIPE_W / 2, badgeY);
      }

      // trail dots
      for (const t of trailRef.current) {
        ctx.globalAlpha = t.a * 0.18;
        ctx.fillStyle = "#ff6b8a";
        ctx.beginPath(); ctx.arc(t.x - 6, t.y, 7 * t.a, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Draw bird — layered (skin-aware)
      ctx.save();
      ctx.translate(BIRD_X, bird.y);
      ctx.rotate((bird.rot * Math.PI) / 180);
      const wingY = Math.sin(now * 0.02) * 2;
      ctx.shadowColor = stateRef.current === "win" ? "#ffcc00" : skin.glow; ctx.shadowBlur = stateRef.current === "win" ? 20 : 14;
      ctx.fillStyle = stateRef.current === "win" ? "#ffcc33" : skin.body;
      ctx.beginPath(); ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      // inner highlight
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.beginPath(); ctx.arc(-4, -4, BIRD_R * 0.42, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ff6b8a";
      ctx.beginPath(); ctx.arc(-3, -3, BIRD_R * 0.28, 0, Math.PI * 2); ctx.fill();
      // wing
      ctx.fillStyle = "rgba(0,0,0,0.16)";
      ctx.beginPath(); ctx.ellipse(-5, 4 + wingY, 8, 5, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = skin.wing;
      ctx.beginPath(); ctx.ellipse(-5, 3 + wingY, 7, 4, -0.3, 0, Math.PI * 2); ctx.fill();
      // eye
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(6, -5, 5.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#0a0a1a";
      ctx.beginPath(); ctx.arc(7.2, -5, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(8, -6, 1.1, 0, Math.PI * 2); ctx.fill();
      // beak
      ctx.fillStyle = "#ffcc00";
      ctx.beginPath(); ctx.moveTo(BIRD_R - 1, -3.5); ctx.lineTo(BIRD_R + 10, 0); ctx.lineTo(BIRD_R - 1, 4.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.beginPath(); ctx.moveTo(BIRD_R - 1, 0); ctx.lineTo(BIRD_R + 10, 0); ctx.lineTo(BIRD_R - 1, 4.5); ctx.closePath(); ctx.fill();
      // 42 on bird
      ctx.fillStyle = "#fff"; ctx.font = "900 8px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("42", -1.5, 1);
      ctx.restore();

      // Particles — physics + diamond shape rotation
      particlesRef.current = particlesRef.current.filter(pr => pr.life > 0);
      for (const pr of particlesRef.current) {
        pr.x += pr.vx; pr.y += pr.vy; pr.vy += 0.16; pr.vx *= 0.99; pr.life -= 0.024; pr.rot += pr.vr;
        if (pr.life <= 0) continue;
        ctx.globalAlpha = Math.max(0, pr.life);
        ctx.fillStyle = pr.color;
        ctx.save();
        ctx.translate(pr.x, pr.y);
        ctx.rotate(pr.rot);
        const s = pr.size * pr.life;
        // diamond / square
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      // Ground
      ctx.fillStyle = "#0d1a2a";
      ctx.fillRect(-10, H - 28, w + 20, 28);
      ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-10, H - 28); ctx.lineTo(w + 10, H - 28); ctx.stroke();
      // ground dashes — speed hint
      ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 2; ctx.setLineDash([10, 14]);
      ctx.beginPath(); ctx.moveTo(-(now * 0.18 % 24), H - 14); ctx.lineTo(w + 24, H - 14); ctx.stroke();
      ctx.setLineDash([]);

      ctx.restore();

      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener("resize", resize); };
  }, [best, spawnParticles, diff.gravity, diff.speed, diff.interval, diff.gap, diff.coinMul, skin.body, skin.glow, skin.wing, addFloat, doScorePop, submitScore]);

  return (
    <div className={styles.page} data-gsap-root>
      <h1>FLAPPY 42</h1>
      <p className={styles.sub}>Тапай/пробел/Space — пролети {WIN_SCORE} труб · P пауза · {diff.label} {diff.emoji} · {skin.emoji} {skin.name}</p>

      <div className={styles.hud} ref={hudRef}>
        <div className={styles.stat}><span>Очки</span><strong data-score>{score}</strong></div>
        <div className={styles.stat}><span>Цель</span><strong>{WIN_SCORE}</strong></div>
        <div className={styles.stat}><span>Рекорд</span><strong>{best}</strong></div>
        <div className={styles.stat}><span>Множитель</span><strong>x{diff.coinMul}</strong></div>
      </div>

      <div className={styles.canvasWrap} style={{ position: "relative" }}>
        <canvas ref={canvasRef} className={styles.canvas} onPointerDown={(e) => { e.preventDefault(); flap(); }} onTouchStart={(e) => { e.preventDefault(); flap(); }} />
        {floats.map(f => (
          <span key={f.id} style={{ position: "absolute", left: f.x, top: f.y, color: f.color, fontWeight: 900, fontSize: f.text.includes("42") ? "13px" : "11px", textShadow: "0 1px 6px rgba(0,0,0,0.7)", pointerEvents: "none", animation: "floatUp 0.9s ease-out forwards" }}>{f.text}</span>
        ))}
        {state === "paused" && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.52)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <span style={{ fontSize: 28 }}>⏸️ Пауза</span><span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>P / Esc — продолжить · тап/пробел тоже</span>
            <button className={styles.playBtn} onClick={togglePause}>Продолжить</button>
          </div>
        )}
      </div>

      {state === "menu" && (
        <div className={styles.menu}>
          <p className={styles.hint}>{diff.desc} · {skin.lore} · На телефоне — тап/свайп вверх, на ПК — пробел/W/↑, P — пауза.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {DIFFICULTIES.map(d => (
              <button key={d.id} onClick={() => setDiffId(d.id)} onMouseEnter={(e)=>hoverIn(e.currentTarget)} onMouseLeave={(e)=>hoverOut(e.currentTarget)}
                style={{ padding: "0.45rem 0.8rem", borderRadius: 100, fontWeight: 800, fontSize: 12, cursor: "pointer", border: d.id===diffId ? "1px solid rgba(255,45,85,0.5)" : "1px solid rgba(255,255,255,0.12)", background: d.id===diffId ? "rgba(255,45,85,0.18)" : "rgba(255,255,255,0.06)", color: d.id===diffId ? "#fff" : "rgba(255,255,255,0.7)" }}>
                {d.emoji} {d.label} {d.id===diffId ? "✓" : ""}<span data-glow style={{ display: "none" }} />
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
            {BIRD_SKINS.map(s => (
              <button key={s.id} onClick={() => setSkinId(s.id)} title={s.lore} onMouseEnter={(e)=>hoverIn(e.currentTarget)} onMouseLeave={(e)=>hoverOut(e.currentTarget)}
                style={{ width: 44, height: 44, borderRadius: 12, fontSize: 18, cursor: "pointer", border: s.id===skinId ? "2px solid " + s.glow : "1px solid rgba(255,255,255,0.1)", background: s.body + "22", boxShadow: s.id===skinId ? "0 0 12px " + s.glow + "66" : "none" }}>
                {s.emoji}<span data-glow style={{ display: "none" }} />
              </button>
            ))}
          </div>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{skin.emoji} {skin.name} — {skin.lore}</span>
          <button className={styles.playBtn} onClick={flap} onMouseEnter={(e)=>hoverIn(e.currentTarget)} onMouseLeave={(e)=>hoverOut(e.currentTarget)}>Играть {diff.emoji}!<span data-glow style={{ display: "none" }} /></button>
          <Link to="/magnum/games" className={styles.back}>← К играм</Link>
        </div>
      )}

      {state === "playing" && (
        <div className={styles.navRow}>
          <Link to="/magnum/games" className={styles.backInline}>← К играм</Link>
          <span className={styles.hint} style={{ marginLeft: 8 }}>{score}/{WIN_SCORE}</span>
        </div>
      )}

      {state === "win" && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2>🎉 42 ТРУБЫ ПРОЙДЕНЫ!</h2>
            <p>{score} очков — ты братуха-пилот высшего класса!</p>
            <p className={styles.hint} style={{ maxWidth: 320 }}>Сохрани MAGNUM, чтобы не пропустить дроп — один клик и альбом у тебя в библиотеке.</p>
            <a href={PRESAVE} target="_blank" rel="noreferrer" className={styles.presaveBtn}>Пресейв MAGNUM →</a>
            <button className={styles.restartBtn} onClick={() => { birdRef.current = { y: 250, vy: 0, rot: 0 }; pipesRef.current = []; particlesRef.current = []; trailRef.current = []; scoreRef.current = 0; shakeRef.current = 0; setScore(0); setState("playing"); stateRef.current = "playing"; lastPipeRef.current = performance.now(); setFloats([]); }}>Ещё раз</button>
            <Link to="/magnum/games" className={styles.backInline}>← К играм</Link>
          </div>
        </div>
      )}

      {state === "dead" && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2>💥 Упал!</h2>
            <p>{score} / {WIN_SCORE} • Рекорд {best}</p>
            <button className={styles.playBtn} onClick={() => { birdRef.current = { y: 250, vy: 0, rot: 0 }; pipesRef.current = []; particlesRef.current = []; trailRef.current = []; scoreRef.current = 0; shakeRef.current = 0; setScore(0); setState("playing"); stateRef.current = "playing"; lastPipeRef.current = performance.now(); setFloats([]); }}>Ещё попытка</button>
            <Link to="/magnum/games" className={styles.backInline}>← К играм</Link>
          </div>
        </div>
      )}
    </div>
  );
}