import { useRef, useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { spawnWave, circleHit } from "./dodge42Logic";
import type { Bullet } from "./dodge42Logic";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./Dodge42Game.module.css";
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
const SURVIVE_SEC = 42;
const PLAYER_R = 14;
const BULLET_R = 7;
const ARENA_W = 400;
const ARENA_H = 560;

// ── 5opka/MAGNUM контент 50+ строк + баланс ──
const DODGE_TIPS: string[] = [
  "5 ПУЛЬ — 5 треков MAGNUM: каждый цвет пуль — пульс альбома!",
  "Свайп в сторону от пули = Near Miss + звук + очко уклонения!",
  "Волна каждые 2.5с — к 42-й секунде ад из 5× пуль!",
  "Зелёный 42 — твой щит: держи центр арены, не жмись к стенам!",
  "Пресейв MAGNUM — награда выжившим 42 секунды!",
  "Близкий пролёт (<12px) — триггер near-miss, фармит счёт!",
  "WASD/стрелки — точный контроль, тап/мышь — плавное следование!",
  "Изи: 60с выживания, Хард: 30с но пуль вдвое больше — выбирай!",
  "Двойной даш: свайп быстро → рывок, R — рестарт!",
  "42 — ответ, 5 пуль — вопрос. Уклонись от всех!",
  "Freakland 2025 — Freak Rush → 5 пуль → MAGNUM!",
  "Мультиплеер скоро — дуэли уклонений!",
  "Звук WebAudio: near-miss писк, смерть басс, победа арпеджио!",
  "Частицы 42: взрыв на 30 частиц при смерти, 50 при победе!",
  "Рекорд локально — бей свой best dodged!",
];
const DIFFICULTY = {
  easy: { label: "Изи", survive: 60, bulletMul: 0.7, speedMul: 0.85, win: 2500, hint: "дольше, но медленнее" },
  normal: { label: "Нормал", survive: 42, bulletMul: 1, speedMul: 1, win: 4200, hint: "канон 42с" },
  hard: { label: "Хард", survive: 30, bulletMul: 1.6, speedMul: 1.25, win: 6000, hint: "ад 30с" },
} as const;
type DiffKey = keyof typeof DIFFICULTY;
const LS_DIFF = "dodge42-diff";
interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; color: string; size: number;
}

const BULLET_COLORS = ["#ff2d55", "#ffcc00", "#00ff88", "#5865f2", "#ff6b35"];

// — WebAudio
let ac: AudioContext | null = null;
function ensureAC() {
  if (!ac) try { ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { return null; }
  if (ac && ac.state === "suspended") void ac.resume();
  return ac;
}
function playNearMiss() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "sine"; o.frequency.value = 1200; o.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.12);
  g.gain.setValueAtTime(0.08, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
  o.start(); o.stop(ctx.currentTime + 0.15);
}
function playDeath() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "sawtooth"; o.frequency.value = 220; o.frequency.linearRampToValueAtTime(55, ctx.currentTime + 0.5);
  g.gain.setValueAtTime(0.25, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
  o.start(); o.stop(ctx.currentTime + 0.6);
}
function playWin() {
  const ctx = ensureAC(); if (!ctx) return;
  [0, 0.1, 0.2, 0.35].forEach((d, i) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.value = 440 + i * 110;
    g.gain.setValueAtTime(0.18, ctx.currentTime + d); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.4);
    o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.4);
  });
}
function safeRamp(param: AudioParam, fn: () => void, fb: number) { try { fn(); } catch { param.value = fb; } }
function playDash() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "triangle"; o.frequency.value = 380; safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.09), 900);
  g.gain.setValueAtTime(0.11, ctx.currentTime); safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.18);
}
function playSlowMo() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain(); const f = ctx.createBiquadFilter();
  o.connect(f); f.connect(g); g.connect(ctx.destination);
  f.type = "lowpass"; f.frequency.value = 1800; o.type = "sine"; o.frequency.value = 660;
  safeRamp(f.frequency, () => f.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.35), 600);
  g.gain.setValueAtTime(0.12, ctx.currentTime); safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.42);
}

export function Dodge42Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scorePopRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"menu" | "playing" | "win" | "dead">("menu");
  const [elapsed, setElapsed] = useState(0);
  const [dodged, setDodged] = useState(0);
  const [bestDodged, setBestDodged] = useState(0);
  useEffect(()=>{
    fetch("/magnum/api/games/my",{credentials:"include"}).then(r=>r.ok?r.json():null).then(j=>{
      const arr=j?.scores as {game:string;score:number}[]|undefined; if(!arr) return;
      let m=0; for(const s of arr) if(s.game==="dodge"&&s.score>m) m=s.score;
      if(m) setBestDodged(m);
    }).catch(()=>{});
  },[]);
  const [wave, setWave] = useState(0);
  const [diff, setDiff] = useState<DiffKey>(() => { try { const v = localStorage.getItem(LS_DIFF) as DiffKey | null; return v && DIFFICULTY[v] ? v : "normal"; } catch { return "normal"; } }); // LS-UI-only
  const [tipIdx, setTipIdx] = useState(0);
  const [dashCd, setDashCd] = useState(false);
  const [slowMo, setSlowMo] = useState(false);
  const diffRef = useRef<DiffKey>(diff);
  const slowRef = useRef(false);
  useEffect(() => { diffRef.current = diff; try { localStorage.setItem(LS_DIFF, diff); } catch {} }, [diff]); // LS-UI-only
  useEffect(() => { const id = setInterval(() => setTipIdx(i => (i + 1) % DODGE_TIPS.length), 3200); return () => clearInterval(id); }, []);
  useEffect(() => { slowRef.current = slowMo; }, [slowMo]);

  const playerRef = useRef({ x: ARENA_W / 2, y: ARENA_H * 0.78 });
  const bulletsRef = useRef<Bullet[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef(0);
  const startRef = useRef(0);
  const waveRef = useRef(0);
  const dodgedRef = useRef(0);
  const lastWaveRef = useRef(0);
  const nearMissRef = useRef(0);
  const shakeRef = useRef(0);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const keysRef = useRef({ up: false, down: false, left: false, right: false });

  const startGame = useCallback(() => {
    playerRef.current = { x: ARENA_W / 2, y: ARENA_H * 0.78 };
    bulletsRef.current = [];
    particlesRef.current = [];
    waveRef.current = 0; dodgedRef.current = 0; lastWaveRef.current = 0;
    nearMissRef.current = 0; shakeRef.current = 0;
    startRef.current = performance.now();
    setElapsed(0); setDodged(0); setWave(0);
    setSlowMo(false);
    setState("playing");
  }, []);

  const doDash = useCallback((dx: number, dy: number) => {
    if (dashCd || state !== "playing") return;
    const p = playerRef.current;
    const len = Math.sqrt(dx*dx + dy*dy) || 1;
    p.x += (dx/len) * 52; p.y += (dy/len) * 52;
    p.x = Math.max(PLAYER_R, Math.min(ARENA_W - PLAYER_R, p.x));
    p.y = Math.max(PLAYER_R, Math.min(ARENA_H - PLAYER_R, p.y));
    playDash();
    setDashCd(true);
    if (scorePopRef.current && !prefersReducedMotion()) gsap.fromTo(scorePopRef.current, { scale: 1.25 }, { scale: 1, duration: 0.28, ease: "back.out(1.5)" });
    if (navigator.vibrate) navigator.vibrate(20);
    setTimeout(() => setDashCd(false), 1200);
  }, [dashCd, state]);

  const toggleSlowMo = useCallback(() => {
    if (state !== "playing") return;
    setSlowMo(v => { const nv = !v; if (nv) playSlowMo(); return nv; });
    setTimeout(() => setSlowMo(false), 2200);
  }, [state]);

  // keyboard input
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === "ArrowUp" || e.code === "KeyW") keysRef.current.up = true;
      if (e.code === "ArrowDown" || e.code === "KeyS") keysRef.current.down = true;
      if (e.code === "ArrowLeft" || e.code === "KeyA") keysRef.current.left = true;
      if (e.code === "ArrowRight" || e.code === "KeyD") keysRef.current.right = true;
      if (e.code === "Space") { e.preventDefault(); doDash(keysRef.current.right ? 1 : keysRef.current.left ? -1 : 0, keysRef.current.down ? 1 : keysRef.current.up ? -1 : -1); }
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") { e.preventDefault(); toggleSlowMo(); }
      if (e.code === "KeyR") { e.preventDefault(); startGame(); }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "ArrowUp" || e.code === "KeyW") keysRef.current.up = false;
      if (e.code === "ArrowDown" || e.code === "KeyS") keysRef.current.down = false;
      if (e.code === "ArrowLeft" || e.code === "KeyA") keysRef.current.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") keysRef.current.right = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, [doDash, toggleSlowMo, startGame]);

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

  // canvas loop
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const DPR = window.devicePixelRatio || 1;
    const resize = () => {
      const pw = canvas.parentElement?.clientWidth || ARENA_W;
      const w = Math.min(pw, ARENA_W);
      canvas.width = w * DPR; canvas.height = ARENA_H * DPR;
      canvas.style.width = w + "px"; canvas.style.height = ARENA_H + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize(); window.addEventListener("resize", resize);

    const draw = () => {
      const w = parseFloat(canvas.style.width) || ARENA_W;
      const h = ARENA_H;
      ctx.clearRect(0, 0, w, h);

      // bg
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#08081a"); bg.addColorStop(0.5, "#12082e"); bg.addColorStop(1, "#1a0a2e");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

      // grid
      ctx.strokeStyle = "rgba(255,255,255,0.03)"; ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

      if (state === "playing") {
        const now = performance.now();
        const cfg = DIFFICULTY[diffRef.current];
        const surv = cfg.survive;
        const dtRaw = Math.min((now - startRef.current) / 1000, surv);
        const dt = slowRef.current ? dtRaw * 0.55 : dtRaw;
        const sec = Math.floor(dtRaw);
        setElapsed(sec);

        // spawn waves every ~2.5s (хард чаще)
        const waveEvery = diffRef.current === "hard" ? 2.0 : 2.5;
        const currentWave = Math.floor(dtRaw / waveEvery);
        if (currentWave > lastWaveRef.current) {
          lastWaveRef.current = currentWave;
          waveRef.current = currentWave;
          setWave(currentWave);
          const newBullets = spawnWave(currentWave, w, h);
          // баланс сложности
          const mul = cfg.bulletMul;
          const extra = mul > 1 ? Math.floor(newBullets.length * (mul - 1)) : 0;
          for (let i = 0; i < extra; i++) {
            const src = newBullets[i % newBullets.length]!;
            newBullets.push({ ...src, x: src.x + (Math.random()-0.5)*40, vx: src.vx * cfg.speedMul, vy: src.vy * cfg.speedMul, trail: [] });
          }
          if (mul < 1) newBullets.splice(Math.floor(newBullets.length * mul));
          // скорость пуль
          if (cfg.speedMul !== 1) newBullets.forEach(b => { b.vx *= cfg.speedMul; b.vy *= cfg.speedMul; });
          bulletsRef.current.push(...newBullets);
        }

        // move player
        const p = playerRef.current;
        const spd = slowRef.current ? 2.2 : 3.8;
        if (keysRef.current.left) p.x -= spd;
        if (keysRef.current.right) p.x += spd;
        if (keysRef.current.up) p.y -= spd;
        if (keysRef.current.down) p.y += spd;
        // pointer follow
        if (pointerRef.current) {
          const dx = pointerRef.current.x - p.x;
          const dy = pointerRef.current.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 2) { p.x += (dx / dist) * Math.min(spd * 1.2, dist); p.y += (dy / dist) * Math.min(spd * 1.2, dist); }
        }
        p.x = Math.max(PLAYER_R, Math.min(w - PLAYER_R, p.x));
        p.y = Math.max(PLAYER_R, Math.min(h - PLAYER_R, p.y));

        // update bullets
        let hit = false;
        for (const b of bulletsRef.current) {
          if (!b.alive) continue;
          b.trail.push({ x: b.x, y: b.y });
          if (b.trail.length > 8) b.trail.shift();
          b.x += b.vx; b.y += b.vy;
          // bounce off walls (except initial spawn area)
          if (b.x > 0 && b.x < w) {
            if (b.x < BULLET_R) { b.x = BULLET_R; b.vx = Math.abs(b.vx); }
            if (b.x > w - BULLET_R) { b.x = w - BULLET_R; b.vx = -Math.abs(b.vx); }
          }
          // collision
          if (circleHit(p.x, p.y, PLAYER_R, b.x, b.y, BULLET_R)) {
            hit = true;
          }
          // near miss detection
          const dist = Math.sqrt((p.x - b.x) ** 2 + (p.y - b.y) ** 2);
          if (dist < PLAYER_R + BULLET_R + 12 && dist > PLAYER_R + BULLET_R) {
            if (now - nearMissRef.current > 400) {
              nearMissRef.current = now;
              dodgedRef.current++;
              setDodged(dodgedRef.current);
              playNearMiss();
            }
          }
          // remove offscreen
          if (b.y > h + 30 || b.y < -60 || b.x < -60 || b.x > w + 60) {
            b.alive = false;
            dodgedRef.current++;
            setDodged(dodgedRef.current);
          }
        }
        bulletsRef.current = bulletsRef.current.filter(b => b.alive);

        if (hit) {
          playDeath(); shakeRef.current = 20;
          for (let i = 0; i < 30; i++) {
            particlesRef.current.push({
              x: p.x, y: p.y,
              vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10,
              life: 1, color: BULLET_COLORS[i % 5]!, size: 3 + Math.random() * 4,
            });
          }
          const nb = Math.max(bestDodged, dodgedRef.current);
          setBestDodged(nb);
          void fetch("/magnum/api/games/submit",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({game:"dodge",score:nb})}).catch(()=>{});
          setState("dead");
        }

        // win check
        if (dtRaw >= surv) {
          playWin();
          for (let i = 0; i < 50; i++) {
            particlesRef.current.push({
              x: w / 2 + (Math.random() - 0.5) * 100, y: h / 2 + (Math.random() - 0.5) * 100,
              vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8,
              life: 1, color: BULLET_COLORS[i % 5]!, size: 3 + Math.random() * 5,
            });
          }
          if (scorePopRef.current && !prefersReducedMotion()) gsap.fromTo(scorePopRef.current, { scale: 1.35, rotation: -2 }, { scale: 1, rotation: 0, duration: 0.45, ease: "back.out(1.4)" });
          if (navigator.vibrate) navigator.vibrate([40,30,60]);
          const nb = Math.max(bestDodged, dodgedRef.current);
          setBestDodged(nb);
          void fetch("/magnum/api/games/submit",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({game:"dodge",score:nb})}).catch(()=>{});
          setState("win");
        }

        // draw bullets with trails
        for (const b of bulletsRef.current) {
          if (!b.alive) continue;
          // trail
          for (let t = 0; t < b.trail.length; t++) {
            const tp = b.trail[t]!;
            const alpha = (t / b.trail.length) * 0.35;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = b.color;
            ctx.beginPath(); ctx.arc(tp.x, tp.y, BULLET_R * 0.6, 0, Math.PI * 2); ctx.fill();
          }
          ctx.globalAlpha = 1;
          // glow
          ctx.shadowColor = b.color; ctx.shadowBlur = 14;
          ctx.fillStyle = b.color;
          ctx.beginPath(); ctx.arc(b.x, b.y, BULLET_R, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
          // inner
          ctx.fillStyle = "rgba(255,255,255,0.7)";
          ctx.beginPath(); ctx.arc(b.x - 2, b.y - 2, BULLET_R * 0.35, 0, Math.PI * 2); ctx.fill();
        }

        // draw player
        ctx.save();
        if (shakeRef.current > 0.5) {
          ctx.translate((Math.random() - 0.5) * shakeRef.current, (Math.random() - 0.5) * shakeRef.current);
          shakeRef.current *= 0.88;
        }
        // player glow
        ctx.shadowColor = "#00ff88"; ctx.shadowBlur = 18;
        ctx.fillStyle = "#00ff88";
        ctx.beginPath(); ctx.arc(p.x, p.y, PLAYER_R, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        // player inner
        ctx.fillStyle = "#0a0a0a";
        ctx.beginPath(); ctx.arc(p.x, p.y, PLAYER_R * 0.55, 0, Math.PI * 2); ctx.fill();
        // 42 label
        ctx.fillStyle = "#00ff88"; ctx.font = "900 10px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("42", p.x, p.y);
        ctx.restore();

        // timer bar
        const progress = dt / SURVIVE_SEC;
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(0, 0, w, 4);
        const grad = ctx.createLinearGradient(0, 0, w * progress, 0);
        grad.addColorStop(0, "#ff2d55"); grad.addColorStop(1, "#ffcc00");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w * progress, 4);

        // wave indicator
        ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "700 11px Inter, sans-serif"; ctx.textAlign = "left";
        ctx.fillText(`Волна ${currentWave}`, 10, 20);
        ctx.textAlign = "right";
        ctx.fillText(`${sec}s / ${SURVIVE_SEC}s`, w - 10, 20);
      }

      // particles (always draw)
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
      for (const p of particlesRef.current) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= 0.02;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // idle decoration
      if (state === "menu") {
        const t = performance.now() * 0.001;
        for (let i = 0; i < 5; i++) {
          const bx = w / 2 + Math.cos(t + i * 1.26) * 80;
          const by = h / 2 + Math.sin(t * 0.7 + i * 1.26) * 60;
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = BULLET_COLORS[i]!;
          ctx.beginPath(); ctx.arc(bx, by, 8, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener("resize", resize); };
  }, [state, bestDodged]);

  return (
    <div className={styles.page} data-gsap-root>
      <h1 ref={scorePopRef as unknown as React.RefObject<HTMLHeadingElement>}>5 ПУЛЬ</h1>
      <p className={styles.sub} data-gsap-root>Уклоняйся от пуль {DIFFICULTY[diff].survive}с — {DIFFICULTY[diff].hint} — выживи ради MAGNUM! {slowMo ? "🐢 SLOW-MO!" : ""}</p>
      <div style={{ fontSize: "0.78rem", color: "rgba(255,204,0,0.88)", background: "rgba(255,204,0,0.07)", border: "1px solid rgba(255,204,0,0.16)", borderRadius: 10, padding: "0.45rem 0.75rem", maxWidth: 560, textAlign: "center", margin: "0 auto 0.6rem" }}>{DODGE_TIPS[tipIdx % DODGE_TIPS.length]}</div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 8 }}>
        {(Object.keys(DIFFICULTY) as DiffKey[]).map((k) => (
          <button key={k} onClick={() => setDiff(k)} style={{ padding: "0.42rem 0.85rem", borderRadius: 999, fontSize: "0.82rem", fontWeight: 800, cursor: "pointer", border: "1px solid", borderColor: diff === k ? "rgba(255,45,85,0.6)" : "rgba(255,255,255,0.12)", background: diff === k ? "rgba(255,45,85,0.14)" : "rgba(255,255,255,0.06)", color: diff === k ? "#ffcc00" : "rgba(240,240,240,0.7)" }}>{DIFFICULTY[k].label} · {DIFFICULTY[k].survive}с</button>
        ))}
      </div>

      {state === "menu" && (
        <div className={styles.menu}>
          <div className={styles.rules}>
            <p>🎯 WASD/стрелки — движение · Space — рывок 52px {dashCd ? "⌛" : "⚡"}</p>
            <p>👆 Тап/мышь — следование · Свайп быстро → даш в сторону</p>
            <p>💥 5 цветных пуль со всех сторон — пульс MAGNUM</p>
            <p>🌊 Волна каждые {diff === "hard" ? "2.0" : "2.5"}с — {diff === "hard" ? "ад ×1.6" : diff === "easy" ? "мягче ×0.7" : "баланс"}</p>
            <p>⭐ Near Miss &lt;12px = писк + очко</p>
            <p>🐢 Shift — Slow-Mo 2.2с (замедляет время) · R — рестарт</p>
            <p>🏆 Продержись {DIFFICULTY[diff].survive}с — {DIFFICULTY[diff].win} очков!</p>
          </div>
          <button className={styles.playBtn} onClick={startGame}>Начать! — {DIFFICULTY[diff].label}</button>
          <p className={styles.hint}>Рекорд: {bestDodged} уклонений • {DIFFICULTY[diff].label}</p>
          <Link to="/magnum/games" className={styles.back}>← К играм</Link>
        </div>
      )}

      {state === "playing" && (
        <div className={styles.gameArea}>
          <div className={styles.hud}>
            <div className={styles.stat}><span>Время</span><strong>{elapsed} / {DIFFICULTY[diff].survive}s</strong></div>
            <div className={styles.stat}><span>Волна</span><strong>{wave}</strong></div>
            <div className={styles.stat}><span>Уклонений</span><strong ref={scorePopRef}>{dodged}</strong></div>
            <div className={styles.stat}><span>Даш</span><strong style={{ color: dashCd ? "rgba(240,240,240,0.35)" : "#00ff88" }}>{dashCd ? "⌛" : "⚡ Готов"}</strong></div>
          </div>
          <div className={styles.canvasWrap} style={slowMo ? { boxShadow: "0 0 22px rgba(88,101,242,0.35)" } : undefined}>
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              onPointerMove={(e) => {
                const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
                pointerRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
              }}
              onPointerLeave={() => { pointerRef.current = null; }}
              onPointerDown={(e) => {
                const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
                pointerRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
                (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                const t = e as unknown as { clientX: number; clientY: number };
                // @ts-ignore store start for swipe
                (canvasRef.current as unknown as { _sx?: number; _sy?: number })._sx = t.clientX;
                (canvasRef.current as unknown as { _sx?: number; _sy?: number })._sy = t.clientY;
              }}
              onPointerUp={(e) => {
                const c = canvasRef.current as unknown as { _sx?: number; _sy?: number } | null;
                if (c && c._sx !== undefined) {
                  const dx = e.clientX - c._sx!, dy = e.clientY - c._sy!;
                  if (Math.sqrt(dx*dx + dy*dy) > 48) doDash(dx, dy);
                  c._sx = undefined; c._sy = undefined;
                }
                pointerRef.current = null;
              }}
            />
          </div>
          <div className={styles.navRow} style={{ gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <button onClick={() => doDash(0, -52)} disabled={dashCd} style={{ padding: "0.42rem 0.9rem", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: dashCd ? "rgba(255,255,255,0.04)" : "rgba(0,255,136,0.10)", color: dashCd ? "rgba(240,240,240,0.35)" : "#00ff88", fontWeight: 800, cursor: dashCd ? "not-allowed" : "pointer" }}>⚡ Даш ↑</button>
            <button onClick={toggleSlowMo} disabled={slowMo} style={{ padding: "0.42rem 0.9rem", borderRadius: 10, border: "1px solid rgba(88,101,242,0.22)", background: slowMo ? "rgba(88,101,242,0.10)" : "rgba(88,101,242,0.08)", color: slowMo ? "rgba(240,240,240,0.35)" : "#5865f2", fontWeight: 800, cursor: slowMo ? "not-allowed" : "pointer" }}>🐢 Slow-Mo</button>
            <Link to="/magnum/games" className={styles.backInline}>← К играм</Link>
          </div>
        </div>
      )}

      {state === "win" && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2>🎉 Выжил! {DIFFICULTY[diff].survive}с!</h2>
            <p>{DIFFICULTY[diff].survive}с • {dodged} уклонений • волна {wave} • {DIFFICULTY[diff].label}</p>
            <p className={styles.winSub}>Ты — неуязвимый братуха! +{DIFFICULTY[diff].win} монет</p>
            <p style={{ fontSize: "0.76rem", color: "rgba(240,240,240,0.5)" }}>{DODGE_TIPS[tipIdx % DODGE_TIPS.length]}</p>
            <a href={PRESAVE} target="_blank" rel="noreferrer" className={styles.presaveBtn}>Пресейв MAGNUM →</a>
            <button className={styles.playBtn} onClick={startGame}>Ещё раз</button>
          </div>
        </div>
      )}

      {state === "dead" && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2>💥 Попал!</h2>
            <p>{elapsed}с / {DIFFICULTY[diff].survive}с • {dodged} уклонений • рекорд {bestDodged}</p>
            <p className={styles.failHint}>Двигайся быстрее — 5 пуль не прощают! Space-даш спасёт.</p>
            <p style={{ fontSize: "0.76rem", color: "rgba(240,240,240,0.5)" }}>{DODGE_TIPS[tipIdx % DODGE_TIPS.length]}</p>
            <button className={styles.playBtn} onClick={startGame}>Ещё попытка (R)</button>
            <Link to="/magnum/games" className={styles.backInline}>← К играм</Link>
          </div>
        </div>
      )}
    </div>
  );
}