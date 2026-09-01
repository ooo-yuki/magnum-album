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

export function Dodge42Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"menu" | "playing" | "win" | "dead">("menu");
  const [elapsed, setElapsed] = useState(0);
  const [dodged, setDodged] = useState(0);
  const [bestDodged, setBestDodged] = useState(() => { try { return Number(localStorage.getItem("dodge42-best")) || 0; } catch { return 0; } });
  const [wave, setWave] = useState(0);

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
    setState("playing");
  }, []);

  // keyboard input
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === "ArrowUp" || e.code === "KeyW") keysRef.current.up = true;
      if (e.code === "ArrowDown" || e.code === "KeyS") keysRef.current.down = true;
      if (e.code === "ArrowLeft" || e.code === "KeyA") keysRef.current.left = true;
      if (e.code === "ArrowRight" || e.code === "KeyD") keysRef.current.right = true;
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "ArrowUp" || e.code === "KeyW") keysRef.current.up = false;
      if (e.code === "ArrowDown" || e.code === "KeyS") keysRef.current.down = false;
      if (e.code === "ArrowLeft" || e.code === "KeyA") keysRef.current.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") keysRef.current.right = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
  
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

  return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
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
        const dt = Math.min((now - startRef.current) / 1000, SURVIVE_SEC);
        const sec = Math.floor(dt);
        setElapsed(sec);

        // spawn waves every ~2.5s
        const currentWave = Math.floor(dt / 2.5);
        if (currentWave > lastWaveRef.current) {
          lastWaveRef.current = currentWave;
          waveRef.current = currentWave;
          setWave(currentWave);
          const newBullets = spawnWave(currentWave, w, h);
          bulletsRef.current.push(...newBullets);
        }

        // move player
        const p = playerRef.current;
        const spd = 3.8;
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
          try { localStorage.setItem("dodge42-best", String(nb)); } catch {}
          setState("dead");
        }

        // win check
        if (dt >= SURVIVE_SEC) {
          playWin();
          for (let i = 0; i < 50; i++) {
            particlesRef.current.push({
              x: w / 2 + (Math.random() - 0.5) * 100, y: h / 2 + (Math.random() - 0.5) * 100,
              vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8,
              life: 1, color: BULLET_COLORS[i % 5]!, size: 3 + Math.random() * 5,
            });
          }
          const nb = Math.max(bestDodged, dodgedRef.current);
          setBestDodged(nb);
          try { localStorage.setItem("dodge42-best", String(nb)); } catch {}
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
    <div className={styles.page}>
      <h1>5 ПУЛЬ</h1>
      <p className={styles.sub}>Уклоняйся от пуль {SURVIVE_SEC} секунд — выживи ради MAGNUM!</p>

      {state === "menu" && (
        <div className={styles.menu}>
          <div className={styles.rules}>
            <p>🎯 Управляй зелёным 42 — WASD / стрелки / тап</p>
            <p>💥 5 цветных пуль летят со всех сторон</p>
            <p>🌊 Каждые 2.5с новая волна — больше пуль, быстрее</p>
            <p>⭐ Свайп в сторону от пули = Near Miss + очко</p>
            <p>🏆 Продержись {SURVIVE_SEC} секунд — победа!</p>
          </div>
          <button className={styles.playBtn} onClick={startGame}>Начать!</button>
          <p className={styles.hint}>Рекорд: {bestDodged} уклонений</p>
          <Link to="/magnum/games" className={styles.back}>← К играм</Link>
        </div>
      )}

      {state === "playing" && (
        <div className={styles.gameArea}>
          <div className={styles.hud}>
            <div className={styles.stat}><span>Время</span><strong>{elapsed}s</strong></div>
            <div className={styles.stat}><span>Волна</span><strong>{wave}</strong></div>
            <div className={styles.stat}><span>Уклонений</span><strong>{dodged}</strong></div>
          </div>
          <div className={styles.canvasWrap}>
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
              }}
            />
          </div>
          <div className={styles.navRow}>
            <Link to="/magnum/games" className={styles.backInline}>← К играм</Link>
          </div>
        </div>
      )}

      {state === "win" && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2>🎉 Выжил! 42 секунды!</h2>
            <p>{SURVIVE_SEC}с • {dodged} уклонений • волна {wave}</p>
            <p className={styles.winSub}>Ты — неуязвимый братуха!</p>
            <a href={PRESAVE} target="_blank" rel="noreferrer" className={styles.presaveBtn}>Пресейв MAGNUM →</a>
            <button className={styles.playBtn} onClick={startGame}>Ещё раз</button>
          </div>
        </div>
      )}

      {state === "dead" && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2>💥 Попал!</h2>
            <p>{elapsed}с / {SURVIVE_SEC}с • {dodged} уклонений • рекорд {bestDodged}</p>
            <p className={styles.failHint}>Двигайся быстрее — 5 пуль не прощают!</p>
            <button className={styles.playBtn} onClick={startGame}>Ещё попытка</button>
            <Link to="/magnum/games" className={styles.backInline}>← К играм</Link>
          </div>
        </div>
      )}
    </div>
  );
}