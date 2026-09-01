import { useRef, useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./RunnerGame.module.css";
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
const WIN_SCORE = 4200;
const GRAVITY = 0.6;
const JUMP_FORCE = -12;
const GROUND_Y = 0.75;

// ── 5opka/MAGNUM контент 50+ строк ──
const RUNNER_TIPS: string[] = [
  "42 — ответ. Беги к 4200 — пресейв MAGNUM ждёт на финише!",
  "Двойной прыжок — ВЗЛЕТ. Тапай дважды: второй прыжок выше!",
  "Гриб 🍄 из Freakland — классика 5opka, прыгай выше головы!",
  "Цепь ⛓️ — тяжёлый металл BRATUKHI, не задень звеном!",
  "Диско-шар 🪩 — свет MAGNUM, скользит под ногами!",
  "Собирай 42 и ноты 🎵 — +50 к счёту, копи на пресейв!",
  "Пыль из-под ног — держи темп, игра ускоряется каждые 450м!",
  "Параллакс-неон: звёзды, горы, город — три слоя MAGNUM-ночи!",
  "Спрайт 5opka-runner — беги стильно, падай красиво!",
  "Свайп вверх — прыжок, дабл-тап — двойной, холд — парение!",
  "Спринт к 4200 — ~2 минуты чистого экстрима!",
  "Лучший результат сохраняется — бей свой рекорд!",
  "Каждая цепь — шанс на комбо, каждая 42 — +50!",
  "MAGNUM — 12 треков, 12 испытаний, 12 причин бежать!",
  "BRATUKHI бегут рядом — не отставай от братух!",
];
const DIFFICULTY = {
  easy:   { label: "Изи",    speed: 3.2, gravity: 0.52, jump: -11, win: 3000, hint: "медленнее, прыжок мягче" },
  normal: { label: "Нормал", speed: 4,   gravity: 0.60, jump: -12, win: 4200, hint: "баланс MAGNUM" },
  hard:   { label: "Хард",   speed: 5.1, gravity: 0.68, jump: -13, win: 6000, hint: "турбо + хардкор" },
} as const;
type DiffKey = keyof typeof DIFFICULTY;
const LS_DIFF = "runner42-diff";
const LS_TIP = "runner42-tip-v1";

interface Obstacle {
  x: number;
  w: number;
  h: number;
  type: "mushroom" | "chain" | "disco";
}
interface Collectible {
  x: number;
  y: number;
  type: "42" | "note";
  collected: boolean;
}
interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string; alpha: number;
}
interface ParallaxLayer {
  x: number; speed: number; h: number; w: number; color: string;
}

// WebAudio jump sound
let audioCtx: AudioContext | null = null;
function playJumpSound(doubleJump = false) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "square";
    o.frequency.value = doubleJump ? 880 : 660;
    o.connect(g); g.connect(audioCtx.destination);
    g.gain.setValueAtTime(0.18, audioCtx.currentTime);
    const at = audioCtx.currentTime;
    safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, at + 0.22), 0.001);
    safeRamp(o.frequency, () => o.frequency.exponentialRampToValueAtTime(doubleJump ? 440 : 330, at + 0.12), 440);
    o.start(); o.stop(audioCtx.currentTime + 0.22);
    // click transient
    const o2 = audioCtx.createOscillator();
    const g2 = audioCtx.createGain();
    o2.frequency.value = doubleJump ? 1200 : 900;
    o2.connect(g2); g2.connect(audioCtx.destination);
    g2.gain.setValueAtTime(0.08, audioCtx.currentTime);
    const at2 = audioCtx.currentTime;
    safeRamp(g2.gain, () => g2.gain.exponentialRampToValueAtTime(0.001, at2 + 0.08), 0.001);
    o2.start(); o2.stop(audioCtx.currentTime + 0.08);
  } catch { /* ignore */ }
}
function playCollectSound() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type = "sine"; o.frequency.value = 880;
    o.connect(g); g.connect(audioCtx.destination);
    g.gain.setValueAtTime(0.12, audioCtx.currentTime);
    const at4 = audioCtx.currentTime;
    safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, at4 + 0.35), 0.001);
    o.frequency.setValueAtTime(880, audioCtx.currentTime);
    const at5 = audioCtx.currentTime;
    safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(1320, at5 + 0.12), 1320);
    o.start(); o.stop(audioCtx.currentTime + 0.35);
  } catch { /* ignore */ }
}
function playDieSound() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const ctx = audioCtx!;
    const o = ctx.createOscillator(); const g = ctx.createGain(); const f = ctx.createBiquadFilter();
    o.connect(f); f.connect(g); g.connect(ctx.destination);
    f.type = "lowpass"; f.frequency.value = 1400; o.type = "sawtooth"; o.frequency.value = 220;
    safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(48, ctx.currentTime + 0.38), 48);
    g.gain.setValueAtTime(0.16, ctx.currentTime);
    safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.44), 0.001);
    o.start(); o.stop(ctx.currentTime + 0.46);
    const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
    o2.connect(g2); g2.connect(ctx.destination);
    o2.type = "square"; o2.frequency.value = 90; g2.gain.setValueAtTime(0.09, ctx.currentTime);
    safeRamp(g2.gain, () => g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18), 0.001);
    o2.start(); o2.stop(ctx.currentTime + 0.2);
  } catch { /* ignore */ }
}
function playWinSound() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const ctx = audioCtx!;
    const notes = [523, 659, 784, 1046];
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = i % 2 === 0 ? "sine" : "triangle"; o.frequency.value = freq;
      const t0 = ctx.currentTime + i * 0.12;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.15, t0 + 0.02);
      safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55), 0.001);
      o.start(t0); o.stop(t0 + 0.6);
    });
  } catch { /* ignore */ }
}
function playDashSound() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const ctx = audioCtx!;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "triangle"; o.frequency.value = 320;
    safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.08), 900);
    g.gain.setValueAtTime(0.11, ctx.currentTime);
    safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16), 0.001);
    o.start(); o.stop(ctx.currentTime + 0.18);
  } catch { /* ignore */ }
}
// Confetti win — full-screen
function spawnWinConfetti(particlesRef: { current: Particle[] }, canvasWidth: number, groundY: number) {
  const colors = ["#ff2d55", "#ffcc00", "#00ff88", "#5865f2", "#fff"];
  for (let i = 0; i < 42; i++) {
    particlesRef.current.push({
      x: canvasWidth / 2 + (Math.random() - 0.5) * 120, y: groundY - 30,
      vx: (Math.random() - 0.5) * 8, vy: -Math.random() * 8 - 2,
      life: 1, maxLife: 1, size: 3 + Math.random() * 5, color: colors[Math.floor(Math.random() * colors.length)]!, alpha: 1,
    });
  }
}

export function RunnerGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spriteRef = useRef<HTMLImageElement | null>(null);
  const spriteLoaded = useRef(false);
  const scorePopRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<"start" | "playing" | "over" | "win">("start");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => {
    try { return Number(localStorage.getItem("runner-best")) || 0; } catch { return 0; }
  });
  const [diff, setDiff] = useState<DiffKey>(() => {
    try { const v = localStorage.getItem(LS_DIFF) as DiffKey | null; return v && DIFFICULTY[v] ? v : "normal"; } catch { return "normal"; }
  });
  const [tipIdx, setTipIdx] = useState(0);
  const [dashReady, setDashReady] = useState(true);
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const diffRef = useRef<DiffKey>(diff);
  useEffect(() => { diffRef.current = diff; try { localStorage.setItem(LS_DIFF, diff); } catch {} }, [diff]);
  useEffect(() => { const id = setInterval(() => setTipIdx((i) => (i + 1) % RUNNER_TIPS.length), 3200); return () => clearInterval(id); }, []);
  void LS_TIP;

  const stateRef = useRef({
    playerY: 0, playerVY: 0, isGrounded: true, canDoubleJump: true,
    obstacles: [] as Obstacle[], collectibles: [] as Collectible[],
    particles: [] as Particle[],
    speed: 4, distance: 0, score: 0, frame: 0,
    bgX: 0, bgX2: 0, bgX3: 0,
    layerOffsets: [0, 0, 0],
    shake: 0,
    spriteFrame: 0,
  });

  // load sprite — perf: 800px webp 34KB vs 1.4M png (97.6% saving), png fallback
  useEffect(() => {
    const img = new Image();
    // @ts-ignore — fetchPriority hint for LCP sprite (supported in modern browsers)
    img.fetchPriority = "low";
    img.decoding = "async";
    img.src = "/magnum/images/5opka-runner-800.webp";
    img.onload = () => { spriteRef.current = img; spriteLoaded.current = true; };
    img.onerror = () => {
      const fb = new Image();
      fb.src = "/magnum/images/5opka-runner.png";
      fb.onload = () => { spriteRef.current = fb; spriteLoaded.current = true; };
      fb.onerror = () => { spriteLoaded.current = false; };
    };
  }, []);

  const resetGame = useCallback(() => {
    const s = stateRef.current;
    s.playerY = 0; s.playerVY = 0; s.isGrounded = true; s.canDoubleJump = true;
    s.obstacles = []; s.collectibles = []; s.particles = [];
    s.speed = 4; s.distance = 0; s.score = 0; s.frame = 0;
    s.bgX = 0; s.bgX2 = 0; s.bgX3 = 0; s.shake = 0; s.spriteFrame = 0;
    s.layerOffsets = [0, 0, 0];
    setScore(0);
  }, []);

  const spawnParticles = useCallback((x: number, y: number, count: number, colors: string[], vxRange = 3, vyRange = 4) => {
    const s = stateRef.current;
    for (let i = 0; i < count; i++) {
      s.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * vxRange * 2,
        vy: -Math.random() * vyRange - 1,
        life: 1, maxLife: 1,
        size: 2 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)]!,
        alpha: 1,
      });
    }
  }, []);

  const jump = useCallback(() => {
    const s = stateRef.current;
    if (gameState !== "playing") return;
    const d = DIFFICULTY[diffRef.current];
    if (s.isGrounded) {
      s.playerVY = d.jump;
      s.isGrounded = false;
      s.canDoubleJump = true;
      spawnParticles(80, s.playerY, 10, ["#ffcc00", "#ff2d55", "#fff"], 2, 2);
      playJumpSound(false);
    } else if (s.canDoubleJump) {
      s.playerVY = d.jump * 0.85;
      s.canDoubleJump = false;
      spawnParticles(80, s.playerY, 14, ["#00ff88", "#5865f2", "#ffcc00"], 3, 3);
      playJumpSound(true);
    }
  }, [gameState, spawnParticles]);

  const dash = useCallback(() => {
    const s = stateRef.current;
    if (gameState !== "playing" || !dashReady) return;
    s.speed = Math.min(11, s.speed + 2.2);
    s.distance += 120;
    spawnParticles(80, s.playerY - 10, 18, ["#00ff88", "#ffcc00", "#fff"], 5, 2);
    playDashSound();
    setDashReady(false);
    if (scorePopRef.current && !prefersReducedMotion()) {
      gsap.fromTo(scorePopRef.current, { scale: 1.3, color: "#00ff88" }, { scale: 1, color: "#fff", duration: 0.35, ease: "back.out(1.7)" });
    }
    setTimeout(() => setDashReady(true), 1800);
  }, [gameState, dashReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId = 0;
    let lastTime = 0;

    const resize = () => {
      canvas.width = Math.min(canvas.parentElement?.clientWidth || 800, 800);
      canvas.height = 400;
    };
    resize();
    window.addEventListener("resize", resize);

    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") { e.preventDefault(); jump(); }
      if (e.code === "KeyD" || e.code === "ShiftRight") { e.preventDefault(); dash(); }
    };
    window.addEventListener("keydown", handleKey);

    const spawnObstacle = (s: typeof stateRef.current) => {
      const types: Obstacle["type"][] = ["mushroom", "chain", "disco"];
      const type = types[Math.floor(Math.random() * types.length)]!;
      const h = type === "mushroom" ? 42 : type === "chain" ? 52 : 36;
      const w = type === "disco" ? 36 : 26;
      s.obstacles.push({ x: canvas.width + 60, w, h, type });
    };
    const spawnCollectible = (s: typeof stateRef.current) => {
      const type = Math.random() > 0.5 ? "42" : "note";
      s.collectibles.push({
        x: canvas.width + 100,
        y: canvas.height * GROUND_Y - 60 - Math.random() * 90,
        type: type as Collectible["type"], collected: false,
      });
    };

    // sprite draw with fallback
    const drawPlayer = (ctx: CanvasRenderingContext2D, x: number, y: number, frame: number, isGrounded: boolean, vy: number) => {
      ctx.save();
      ctx.translate(x, y);
      // tilt based on vy
      const tilt = isGrounded ? Math.sin(frame * 0.25) * 0.04 : vy * 0.02;
      ctx.rotate(tilt);
      if (spriteLoaded.current && spriteRef.current) {
        // sprite is 1536x1024 full image, we crop center portion
        // animate bob slightly
        const bob = isGrounded ? Math.sin(frame * 0.3) * 2 : 0;
        const size = 64;
        // shadow
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath(); ctx.ellipse(0, 16, 22, 6, 0, 0, Math.PI * 2); ctx.fill();
        // glow behind
        ctx.shadowColor = "#ff2d55"; ctx.shadowBlur = 18;
        ctx.globalAlpha = 0.9;
        try {
          // drawImage with cover - center crop
          const img = spriteRef.current;
          // use object fit: draw scaled to 64x64 centered
          ctx.drawImage(img, -size / 2, -size / 2 + bob - 28, size, size);
        } catch { /* fallback below */ }
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        // double-jump aura
        if (!isGrounded) {
          ctx.strokeStyle = "rgba(255,204,0,0.5)";
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(0, -10 + bob, 30, 0, Math.PI * 2); ctx.stroke();
        }
      } else {
        // fallback procedural 42 style
        ctx.shadowColor = "#ff2d55"; ctx.shadowBlur = 12;
        ctx.fillStyle = "#ff2d55";
        ctx.fillRect(-15, -40, 30, 40);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffcc00";
        ctx.beginPath(); ctx.arc(0, -50, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#333";
        const legOffset = Math.sin(frame * 0.35) * 7;
        ctx.fillRect(-10, 0, 8, 15 + legOffset);
        ctx.fillRect(2, 0, 8, 15 - legOffset);
        ctx.fillStyle = "#000"; ctx.fillRect(-10, -54, 20, 5);
        ctx.fillStyle = "#ffcc00"; ctx.fillRect(-12, -35, 24, 3);
      }
      ctx.restore();
    };

    const drawObstacle = (ctx: CanvasRenderingContext2D, obs: Obstacle, groundY: number, frame: number) => {
      ctx.save();
      ctx.translate(obs.x, groundY);
      const pulse = Math.sin(frame * 0.08 + obs.x * 0.01) * 0.5;
      if (obs.type === "mushroom") {
        ctx.shadowColor = "rgba(255,45,85,0.6)"; ctx.shadowBlur = 10 + pulse * 2;
        ctx.fillStyle = "#ff2d55";
        ctx.beginPath(); ctx.arc(0, -obs.h, obs.w, Math.PI, 0); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(-6, -obs.h - 10, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(5, -obs.h - 7, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ffe0e8"; ctx.beginPath(); ctx.arc(0, -obs.h + 4, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fillRect(-7, -obs.h, 14, obs.h);
        ctx.fillStyle = "rgba(0,0,0,0.1)"; ctx.fillRect(-7, -4, 14, 4);
      } else if (obs.type === "chain") {
        ctx.shadowColor = "#ffcc00"; ctx.shadowBlur = 12;
        ctx.strokeStyle = "#ffcc00"; ctx.lineWidth = 4;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath(); ctx.arc(0, -obs.h + i * 16 + 6, 7, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = "rgba(255,204,0,0.2)"; ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffcc00"; ctx.beginPath(); ctx.arc(0, -2, 3, 0, Math.PI * 2); ctx.fill();
      } else {
        // disco with sparkle
        ctx.shadowColor = "#5865f2"; ctx.shadowBlur = 14;
        ctx.fillStyle = "#5865f2";
        ctx.beginPath(); ctx.arc(0, -obs.h / 2, obs.w / 2, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        const spark = Math.floor(frame / 6) % 5;
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = i === spark ? "#fff" : "rgba(255,255,255,0.45)";
          ctx.fillRect(-obs.w / 2 + i * 7 + 1, -obs.h / 2 - 3, 4, 4);
          ctx.fillRect(-obs.w / 2 + i * 7 + 1, -obs.h / 2 + 3, 4, 4);
        }
        ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, -obs.h / 2, obs.w / 2, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    };

    const drawCollectible = (ctx: CanvasRenderingContext2D, c: Collectible, frame: number) => {
      if (c.collected) return;
      ctx.save();
      ctx.translate(c.x, c.y);
      const floatY = Math.sin(frame * 0.12 + c.x * 0.01) * 6;
      ctx.translate(0, floatY);
      ctx.globalAlpha = 0.9 + Math.sin(frame * 0.14) * 0.1;
      ctx.shadowColor = c.type === "42" ? "#ffcc00" : "#00ff88";
      ctx.shadowBlur = 14;
      // orb bg
      ctx.fillStyle = c.type === "42" ? "rgba(255,204,0,0.18)" : "rgba(0,255,136,0.18)";
      ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      if (c.type === "42") {
        ctx.fillStyle = "#ffcc00";
        ctx.font = "900 20px Inter, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("42", 0, 1);
        ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 2; ctx.strokeText("42", 0, 1);
        ctx.fillText("42", 0, 1);
      } else {
        ctx.font = "20px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = "#00ff88";
        ctx.fillText("🎵", 0, 2);
      }
      // ring
      ctx.strokeStyle = c.type === "42" ? "rgba(255,204,0,0.5)" : "rgba(0,255,136,0.5)";
      ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    };

    const gameLoop = (time: number) => {
      const dt = Math.min((time - lastTime) / 16.67, 2);
      lastTime = time;
      const s = stateRef.current;
      const W = canvas.width; const H = canvas.height;
      const groundY = H * GROUND_Y;

      if (gameState === "playing") {
        s.frame++; s.spriteFrame++;
        s.distance += s.speed * dt;
        // баланс по сложности
        const dCfg = DIFFICULTY[diffRef.current];
        const cap = diffRef.current === "hard" ? 10.2 : diffRef.current === "easy" ? 8.2 : 9.5;
        const base = dCfg.speed;
        s.speed = Math.min(cap, base + s.distance * 0.00038);
        s.score = Math.floor(s.distance / 10);
        setScore(s.score);
        if (s.score >= dCfg.win) {
          setGameState("win");
          const newBest = Math.max(best, s.score);
          setBest(newBest);
          try { localStorage.setItem("runner-best", String(newBest)); } catch {}
          spawnWinConfetti(stateRef as unknown as { current: Particle[] }, W, groundY);
          playWinSound();
          if (scorePopRef.current && !prefersReducedMotion()) gsap.fromTo(scorePopRef.current, { scale: 1.4, y: -8 }, { scale: 1, y: 0, duration: 0.5, ease: "back.out(1.7)" });
          if (navigator.vibrate) navigator.vibrate([40, 30, 60]);
        } else {
          s.playerVY += dCfg.gravity * dt;
          s.playerY += s.playerVY * dt;
          if (s.playerY >= 0) { s.playerY = 0; s.playerVY = 0; if (!s.isGrounded) { spawnParticles(80, groundY, 8, ["#ffcc00", "rgba(255,255,255,0.6)"], 3, 1.5); s.shake = 2; } s.isGrounded = true; }

          if (s.frame % Math.max(55, 110 - Math.floor(s.distance / 450)) === 0) spawnObstacle(s);
          if (s.frame % 82 === 0) spawnCollectible(s);

          s.obstacles = s.obstacles.filter(o => { o.x -= s.speed * dt; return o.x > -80; });
          s.collectibles = s.collectibles.filter(c => { c.x -= s.speed * dt; return c.x > -80; });

          const playerX = 80;
          const playerTop = groundY + s.playerY - 52;
          const playerBottom = groundY + s.playerY + 15;
          const playerLeft = playerX - 15; const playerRight = playerX + 15;

          for (const obs of s.obstacles) {
            const obsTop = groundY - obs.h - 6;
            const obsBottom = groundY;
            const obsLeft = obs.x - obs.w / 2 - 2;
            const obsRight = obs.x + obs.w / 2 + 2;
            if (playerRight > obsLeft && playerLeft < obsRight && playerBottom > obsTop && playerTop < obsBottom) {
              spawnParticles(playerX, groundY + s.playerY - 10, 18, ["#ff2d55", "#fff", "#000"], 5, 5);
              playDieSound();
              s.shake = 10;
              setGameState("over");
              const newBest = Math.max(best, s.score);
              setBest(newBest);
              try { localStorage.setItem("runner-best", String(newBest)); } catch {}
              if (navigator.vibrate) navigator.vibrate([60, 30, 80]);
              break;
            }
          }
          for (const c of s.collectibles) {
            if (c.collected) continue;
            const dx = Math.abs(playerX - c.x);
            const dy = Math.abs((groundY + s.playerY - 25) - c.y);
            if (dx < 28 && dy < 28) {
              c.collected = true; s.score += 50;
              spawnParticles(c.x, c.y, 10, c.type === "42" ? ["#ffcc00", "#fff"] : ["#00ff88", "#fff"], 3, 3);
              playCollectSound();
              if (scorePopRef.current && !prefersReducedMotion()) gsap.fromTo(scorePopRef.current, { scale: 1.18 }, { scale: 1, duration: 0.24, ease: "back.out(1.4)" });
              if (navigator.vibrate) navigator.vibrate(12);
            }
          }
          s.bgX = (s.bgX + s.speed * 0.28 * dt) % W;
          s.bgX2 = (s.bgX2 + s.speed * 0.14 * dt) % W;
          s.bgX3 = (s.bgX3 + s.speed * 0.06 * dt) % W;
          if (s.shake > 0) s.shake -= dt * 2;
          // running dust when grounded
          if (s.isGrounded && s.frame % 6 === 0) {
            s.particles.push({
              x: playerX - 10, y: groundY - 2,
              vx: -s.speed * 0.3 + (Math.random() - 0.5),
              vy: -Math.random() * 1.2,
              life: 1, maxLife: 1, size: 2 + Math.random() * 2,
              color: "rgba(255,204,0,0.7)", alpha: 0.7,
            });
          }
        }
      }

      // update particles
      s.particles = s.particles.filter(p => {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.18 * dt; p.life -= 0.022 * dt; p.alpha = p.life; return p.life > 0;
      });

      // Draw
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      if (s.shake > 0) {
        ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);
      }
      // sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#07081e"); sky.addColorStop(0.45, "#1a0a2e"); sky.addColorStop(0.75, "#2a0a2e"); sky.addColorStop(1, "#1a0a2e");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      // neon skyline glow
      ctx.fillStyle = "rgba(255,45,85,0.04)"; ctx.fillRect(0, H * 0.35, W, H * 0.4);
      // stars parallax layer 3
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      for (let i = 0; i < 40; i++) {
        const sx = ((i * 137 + 47) % (W + 60) - s.bgX3) % (W + 60);
        const sy = (i * 53 + 18) % (H * 0.48);
        const tw = 0.6 + Math.sin(s.frame * 0.04 + i) * 0.4;
        const x = sx < 0 ? sx + W + 60 : sx;
        ctx.globalAlpha = 0.3 + tw * 0.4;
        ctx.fillRect(x, sy, 1.8, 1.8);
        if (i % 7 === 0) { ctx.fillStyle = "rgba(255,204,0,0.6)"; ctx.fillRect(x, sy, 1.2, 1.2); ctx.fillStyle = "rgba(255,255,255,0.55)"; }
      }
      ctx.globalAlpha = 1;
      // far mountains silhouette layer 2
      ctx.fillStyle = "rgba(18,8,35,0.9)";
      for (let i = 0; i < 10; i++) {
        const bx = ((i * 110) - s.bgX2 * 0.7) % (W + 120);
        const bh = 55 + (i * 41) % 80;
        const x = bx < 0 ? bx + W + 120 : bx;
        ctx.beginPath(); ctx.moveTo(x, groundY); ctx.lineTo(x + 30, groundY - bh); ctx.lineTo(x + 80, groundY - bh * 0.6); ctx.lineTo(x + 100, groundY); ctx.closePath(); ctx.fill();
      }
      // mid city parallax layer 1
      for (let i = 0; i < 14; i++) {
        const bx = ((i * 90) - s.bgX) % (W + 110);
        const bh = 36 + (i * 37) % 95;
        const x = bx < 0 ? bx + W + 110 : bx;
        // building glow
        ctx.fillStyle = "rgba(255,45,85,0.08)";
        ctx.fillRect(x - 2, groundY - bh - 2, 54, bh + 2);
        ctx.fillStyle = "rgba(22,10,42,0.95)";
        ctx.fillRect(x, groundY - bh, 50, bh);
        // windows
        ctx.fillStyle = i % 3 === 0 ? "rgba(255,204,0,0.9)" : i % 3 === 1 ? "rgba(88,101,242,0.85)" : "rgba(0,255,136,0.7)";
        for (let wy = 0; wy < 3; wy++) {
          for (let wx = 0; wx < 2; wx++) {
            if ((i + wy + wx) % 2 === 0) ctx.fillRect(x + 8 + wx * 18, groundY - bh + 8 + wy * 14, 8, 6);
          }
        }
        // neon top
        ctx.fillStyle = "rgba(255,45,85,0.9)"; ctx.fillRect(x, groundY - bh, 50, 2);
      }
      // speed lines
      ctx.strokeStyle = "rgba(255,255,255,0.04)"; ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const y = H * 0.25 + i * 24;
        const off = (s.bgX * (0.5 + i * 0.08)) % W;
        ctx.beginPath(); ctx.moveTo(-off, y); ctx.lineTo(W - off, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W - off, y); ctx.lineTo(W - off + 40, y); ctx.stroke();
      }
      // ground
      ctx.fillStyle = "#12122a"; ctx.fillRect(0, groundY, W, H - groundY);
      // ground grid perspective
      ctx.strokeStyle = "rgba(255,45,85,0.18)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(W, groundY); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1;
      for (let i = 0; i < W; i += 40) {
        const x = (i - s.bgX) % W; const gx = x < 0 ? x + W : x;
        ctx.beginPath(); ctx.moveTo(gx, groundY); ctx.lineTo(gx - 18, H); ctx.stroke();
      }
      for (let y = groundY + 20; y < H; y += 22) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      // ground neon strip
      const neonGrad = ctx.createLinearGradient(0, groundY - 2, 0, groundY + 4);
      neonGrad.addColorStop(0, "rgba(255,45,85,0)"); neonGrad.addColorStop(0.5, "rgba(255,45,85,0.9)"); neonGrad.addColorStop(1, "rgba(255,204,0,0)");
      ctx.fillStyle = neonGrad; ctx.fillRect(0, groundY - 2, W, 6);

      // obstacles & collectibles
      for (const obs of s.obstacles) drawObstacle(ctx, obs, groundY, s.frame);
      for (const c of s.collectibles) drawCollectible(ctx, c, s.frame);
      // particles
      for (const p of s.particles) {
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // player
      drawPlayer(ctx, 80, groundY + s.playerY, s.frame, s.isGrounded, s.playerVY);
      ctx.restore();

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);
  
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

  return () => { cancelAnimationFrame(animId); window.removeEventListener("keydown", handleKey); window.removeEventListener("resize", resize); };
  }, [gameState, jump, best, spawnParticles]);

  const startGame = () => {
    const d = DIFFICULTY[diffRef.current];
    const s = stateRef.current;
    s.speed = d.speed;
    resetGame();
    s.speed = d.speed;
    setGameState("playing");
  };

  return (
    <div className={styles.page} data-gsap-root>
      <h1 ref={scorePopRef as unknown as React.RefObject<HTMLHeadingElement>}>Беги, братуха!</h1>
      <div style={{ fontSize: "0.78rem", color: "rgba(255,204,0,0.88)", background: "rgba(255,204,0,0.07)", border: "1px solid rgba(255,204,0,0.16)", borderRadius: 10, padding: "0.45rem 0.75rem", maxWidth: 560, textAlign: "center", margin: "0 auto 0.6rem" }}>{RUNNER_TIPS[tipIdx % RUNNER_TIPS.length]}</div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 8 }}>
        {(Object.keys(DIFFICULTY) as DiffKey[]).map((k) => (
          <button key={k} onClick={() => setDiff(k)} style={{ padding: "0.42rem 0.85rem", borderRadius: 999, fontSize: "0.82rem", fontWeight: 800, cursor: "pointer", border: "1px solid", borderColor: diff === k ? "rgba(255,45,85,0.6)" : "rgba(255,255,255,0.12)", background: diff === k ? "rgba(255,45,85,0.14)" : "rgba(255,255,255,0.06)", color: diff === k ? "#ffcc00" : "rgba(240,240,240,0.7)" }}>{DIFFICULTY[k].label} · {DIFFICULTY[k].win}</button>
        ))}
      </div>
      <div className={styles.canvasWrap}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onClick={jump}
          onTouchStart={(e) => {
            const t = e.touches[0] as Touch | undefined;
            if (t) touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
          }}
          onTouchEnd={(e) => {
            const s = touchStartRef.current;
            const t = (e.changedTouches[0] as Touch | undefined);
            if (!s || !t) { jump(); return; }
            const dx = t.clientX - s.x, dy = t.clientY - s.y, dt = Date.now() - s.t;
            if (Math.abs(dy) > 48 && dy < 0) { jump(); }
            else if (Math.abs(dx) > 60 && dt < 400) { dash(); }
            else { jump(); }
            touchStartRef.current = null;
            e.preventDefault();
          }}
        />
        {gameState === "start" && (
          <div className={styles.overlay}>
            <h2>🏃 БЕГИ, БРАТУХА!</h2>
            <p>Прыгай через мухоморы и цепи — звук на WebAudio</p>
            <p className={styles.controls}>Пробел / Клик / Свайп ↑ = прыжок · Свайп → = dash {dashReady ? "⚡" : "⌛"} · D = рывок</p>
            <p style={{ fontSize: "0.76rem", color: "rgba(240,240,240,0.5)" }}>{DIFFICULTY[diff].hint} • Рекорд {best}</p>
            <button className={styles.startBtn} onClick={startGame}>Начать! — {DIFFICULTY[diff].win}</button>
            <span className={styles.hint}>Спрайт: 5opka-runner • параллакс 3 слоя • частицы • {DIFFICULTY[diff].label}</span>
          </div>
        )}
        {gameState === "over" && (
          <div className={styles.overlay}>
            <h2>💀 Раздавили!</h2>
            <p>Счёт: {score} • Лучший: {best} • {DIFFICULTY[diff].label}</p>
            <p style={{ fontSize: "0.78rem", color: "rgba(240,240,240,0.5)" }}>{RUNNER_TIPS[tipIdx % RUNNER_TIPS.length]}</p>
            <button className={styles.startBtn} onClick={startGame}>Ещё раз</button>
          </div>
        )}
        {gameState === "win" && (
          <div className={styles.overlay}>
            <h2>🎉 Победа! {DIFFICULTY[diff].win}+</h2>
            <p>Счёт: {score} — ты братуха 42! {DIFFICULTY[diff].label}</p>
            <p style={{ fontSize: "0.76rem", color: "rgba(240,240,240,0.5)" }}>{RUNNER_TIPS[tipIdx % RUNNER_TIPS.length]}</p>
            <a href={PRESAVE} target="_blank" rel="noreferrer" className={styles.presaveBtn}>Пресейв MAGNUM →</a>
            <button className={styles.restartBtn} onClick={startGame}>Ещё раз</button>
          </div>
        )}
      </div>
      <div className={styles.hud}>
        <span>Счёт: <strong ref={scorePopRef}>{score}</strong></span>
        <span>Лучший: {best}</span>
        <span>Цель: {DIFFICULTY[diff].win}</span>
        <span style={{ color: dashReady ? "#00ff88" : "rgba(240,240,240,0.35)" }}>{dashReady ? "⚡ Dash готов (D/→)" : "⌛ Dash..."}</span>
      </div>
      <Link to="/magnum/games" className={styles.back}>← К играм</Link>
    </div>
  );
}