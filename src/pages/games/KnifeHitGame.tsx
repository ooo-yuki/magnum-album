import { useRef, useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./KnifeHitGame.module.css";
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
const TOTAL_KNIVES = 42;
const WIN_SCORE = 4200;
const SCORE_PER_HIT = 100;
const TARGET_RADIUS = 80;
const KNIFE_LENGTH = 40;
const KNIFE_WIDTH = 6;
const COLLISION_ANGLE_THRESHOLD = 0.18; // radians
const ROTATION_ACCEL = 0.02;
const SPEED_CAP = 4.2;

interface StuckKnife {
  angle: number;
}

type GameState = "start" | "playing" | "throwing" | "gameover" | "won";

// — WebAudio helpers (Obscura-safe) —
let ac: AudioContext | null = null;
function ensureAC(): AudioContext | null {
  if (!ac) try { ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { return null; }
  if (ac && ac.state === "suspended") void ac.resume();
  return ac;
}
function safeRamp(param: AudioParam, fn: () => void, fallback: number) {
  try { fn(); } catch { param.value = fallback; }
}
function playThrow() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "triangle";
  o.frequency.value = 720;
  g.gain.setValueAtTime(0.14, ctx.currentTime);
  safeRamp(o.frequency, () => o.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.10), 120);
  safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.12);
  // air whoosh second layer
  const o2 = ctx.createOscillator(); const g2 = ctx.createGain(); o2.connect(g2); g2.connect(ctx.destination);
  o2.type = "sine"; o2.frequency.value = 180; g2.gain.setValueAtTime(0.06, ctx.currentTime);
  safeRamp(g2.gain, () => g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18), 0.001);
  o2.start(); o2.stop(ctx.currentTime + 0.18);
}
function playHit() {
  const ctx = ensureAC(); if (!ctx) return;
  // woody thud — low sine + click
  const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination);
  o.type = "sine"; o.frequency.value = 180; g.gain.setValueAtTime(0.28, ctx.currentTime);
  safeRamp(o.frequency, () => o.frequency.exponentialRampToValueAtTime(85, ctx.currentTime + 0.08), 85);
  safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.18);
  const o2 = ctx.createOscillator(); const g2 = ctx.createGain(); o2.connect(g2); g2.connect(ctx.destination);
  o2.type = "square"; o2.frequency.value = 900; g2.gain.setValueAtTime(0.06, ctx.currentTime);
  safeRamp(g2.gain, () => g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05), 0.001);
  o2.start(); o2.stop(ctx.currentTime + 0.05);
}
function playMiss() {
  const ctx = ensureAC(); if (!ctx) return;
  // metallic clash — промах: высокий square + падение + шум
  const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination);
  o.type = "square"; o.frequency.value = 620; g.gain.setValueAtTime(0.32, ctx.currentTime);
  safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.35), 110);
  safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.5);
  const o2 = ctx.createOscillator(); const g2 = ctx.createGain(); o2.connect(g2); g2.connect(ctx.destination);
  o2.type = "triangle"; o2.frequency.value = 280; g2.gain.setValueAtTime(0.18, ctx.currentTime);
  safeRamp(g2.gain, () => g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4), 0.001);
  safeRamp(o2.frequency, () => o2.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.38), 40);
  o2.start(); o2.stop(ctx.currentTime + 0.4);
  // dissonant spark
  const o3 = ctx.createOscillator(); const g3 = ctx.createGain(); o3.connect(g3); g3.connect(ctx.destination);
  o3.type = "sawtooth"; o3.frequency.value = 1400; g3.gain.setValueAtTime(0.07, ctx.currentTime);
  safeRamp(g3.gain, () => g3.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12), 0.001);
  o3.start(); o3.stop(ctx.currentTime + 0.12);
}
function playWin() {
  const ctx = ensureAC(); if (!ctx) return;
  [0, 0.14, 0.28, 0.42].forEach((d, i) => {
    const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.value = 440 + i * 130; g.gain.setValueAtTime(0.16, ctx.currentTime + d);
    safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.45), 0.001);
    o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.45);
  });
}

export function KnifeHitGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<GameState>("start");
  const [score, setScore] = useState(0);
  const [knivesThrown, setKnivesThrown] = useState(0);

  const gameRef = useRef({
    targetAngle: 0,
    targetSpeed: 1.5,
    stuckKnives: [] as StuckKnife[],
    throwingKnife: null as { y: number; speed: number } | null,
    nextThrowReady: true,
    knivesRemaining: TOTAL_KNIVES,
    lastTime: 0,
    animFrame: 0,
    knivesSinceLastChange: 0,
    canvasW: 0,
    canvasH: 0,
    centerX: 0,
    centerY: 0,
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string }[],
    shakeTimer: 0,
    shakeIntensity: 0,
  });

  const triggerDomShake = useCallback((intensity: number) => {
    const el = containerRef.current;
    if (!el) return;
    try {
      gsap.killTweensOf(el);
      gsap.fromTo(el, { x: 0 }, {
        x: intensity,
        duration: 0.06,
        repeat: 5,
        yoyo: true,
        ease: "power2.inOut",
        onComplete: () => gsap.set(el, { x: 0 }),
      });
      // also quick scale punch
      gsap.fromTo(el, { scale: 1 }, { scale: 0.985, duration: 0.08, yoyo: true, repeat: 1, ease: "power2.out" });
    } catch { /* ignore */ }
  }, []);

  const drawKnife = useCallback(
    (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, glowing: boolean) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, -KNIFE_LENGTH / 2);
      ctx.lineTo(-KNIFE_WIDTH / 2, KNIFE_LENGTH / 4);
      ctx.lineTo(KNIFE_WIDTH / 2, KNIFE_LENGTH / 4);
      ctx.closePath();
      if (glowing) {
        ctx.shadowColor = "#ff2d55";
        ctx.shadowBlur = 15;
        ctx.fillStyle = "#ff4466";
      } else {
        ctx.fillStyle = "#cc2244";
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#8B6914";
      ctx.fillRect(-KNIFE_WIDTH / 2 - 1, KNIFE_LENGTH / 4, KNIFE_WIDTH + 2, KNIFE_LENGTH / 4);
      ctx.strokeStyle = "#6B4F0A";
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const hy = KNIFE_LENGTH / 4 + 3 + i * 4;
        ctx.beginPath();
        ctx.moveTo(-KNIFE_WIDTH / 2, hy);
        ctx.lineTo(KNIFE_WIDTH / 2 + 2, hy);
        ctx.stroke();
      }
      ctx.restore();
    },
    []
  );

  const drawTarget = useCallback(
    (ctx: CanvasRenderingContext2D, cx: number, cy: number, angle: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.arc(0, 0, TARGET_RADIUS + 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fill();
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, TARGET_RADIUS);
      grad.addColorStop(0, "#C4A265");
      grad.addColorStop(0.3, "#A08040");
      grad.addColorStop(0.7, "#8B6914");
      grad.addColorStop(1, "#6B4F0A");
      ctx.beginPath();
      ctx.arc(0, 0, TARGET_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = "rgba(107,79,10,0.3)";
      ctx.lineWidth = 1;
      for (let r = 15; r < TARGET_RADIUS; r += 12) {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#6B4F0A";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, TARGET_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = "#4A3508";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    },
    []
  );

  const spawnParticles = useCallback((x: number, y: number, count: number, color: string, opts?: { spark?: boolean }) => {
    const g = gameRef.current;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = opts?.spark ? 2 + Math.random() * 6 : 1 + Math.random() * 3.5;
      g.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (opts?.spark ? 1 : 0),
        life: 1,
        color: opts?.spark && Math.random() > 0.5 ? "#ffcc00" : color,
      });
    }
    if (!opts?.spark) {
      for (let i = 0; i < Math.floor(count / 2); i++) {
        const a = Math.random() * Math.PI - Math.PI / 2;
        g.particles.push({ x, y, vx: Math.cos(a) * (1 + Math.random() * 2), vy: Math.sin(a) * (2 + Math.random() * 2), life: 1, color: "#8B6914" });
      }
    }
  }, []);

  const checkCollision = useCallback((throwAngle: number): boolean => {
    const g = gameRef.current;
    for (const knife of g.stuckKnives) {
      let diff = Math.abs(knife.angle - throwAngle);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff < COLLISION_ANGLE_THRESHOLD) return true;
    }
    return false;
  }, []);

  const gameLoop = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const g = gameRef.current;

      if (g.lastTime === 0) g.lastTime = timestamp;
      const dt = Math.min((timestamp - g.lastTime) / 1000, 0.05);
      g.lastTime = timestamp;

      const w = g.canvasW;
      const h = g.canvasH;
      const cx = g.centerX;
      const cy = g.centerY;

      g.targetAngle += g.targetSpeed * dt;

      if (g.throwingKnife) {
        g.throwingKnife.y -= g.throwingKnife.speed * dt;
        const knifeTipY = g.throwingKnife.y - KNIFE_LENGTH / 2;
        const targetEdgeY = cy - TARGET_RADIUS + 5;

        if (knifeTipY <= targetEdgeY) {
          const throwAngle = (-g.targetAngle) % (Math.PI * 2);
          const normalizedAngle = ((throwAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

          if (checkCollision(normalizedAngle)) {
            spawnParticles(cx, cy - TARGET_RADIUS, 22, "#ff2d55", { spark: true });
            g.shakeTimer = 0.55;
            g.shakeIntensity = 18;
            triggerDomShake(10);
            playMiss();
            // vibration fallback
            try { navigator.vibrate?.(120); } catch {}
            g.throwingKnife = null;
            g.nextThrowReady = true;
            setGameState("gameover");
          } else {
            g.stuckKnives.push({ angle: normalizedAngle });
            g.throwingKnife = null;
            g.nextThrowReady = true;
            g.knivesSinceLastChange++;
            g.knivesRemaining--;
            spawnParticles(cx, cy - TARGET_RADIUS, 12, "#C4A265");
            g.shakeTimer = 0.12;
            g.shakeIntensity = 4;
            playHit();
            try { navigator.vibrate?.(30); } catch {}

            // баланс вращения: ускорение 0.02 на каждый успешный бросок
            const dir = Math.sign(g.targetSpeed) || 1;
            const absSpeed = Math.min(SPEED_CAP, Math.abs(g.targetSpeed) + ROTATION_ACCEL);
            g.targetSpeed = dir * absSpeed;

            const nextScore = g.stuckKnives.length * SCORE_PER_HIT;
            setScore(nextScore);
            setKnivesThrown((k) => k + 1);

            // победа 4200 → presave (42 ножа *100) — оставляем фолбэк по TOTAL_KNIVES
            if (nextScore >= WIN_SCORE || g.stuckKnives.length >= TOTAL_KNIVES) {
              playWin();
              for (let i = 0; i < 36; i++) {
                const a = Math.random() * Math.PI * 2;
                const spd = 2 + Math.random() * 6;
                g.particles.push({ x: cx, y: cy - TARGET_RADIUS, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 1, life: 1, color: ["#ff2d55", "#ffcc00", "#00ff88", "#5865f2"][i % 4]! });
              }
              g.shakeTimer = 0.45; g.shakeIntensity = 10;
              setGameState("won");
              return;
            }

            if (g.knivesSinceLastChange >= 5) {
              g.knivesSinceLastChange = 0;
              const speedOptions = [1.2, 1.8, 2.5, 3.0, -1.5, -2.0, -2.8];
              const base = speedOptions[Math.floor(Math.random() * speedOptions.length)]!;
              // сохранить накопленное ускорение: прибавляем delta к новому направлению
              const accelBonus = Math.abs(g.targetSpeed) - 1.5;
              const sign = Math.sign(base) || 1;
              g.targetSpeed = sign * Math.min(SPEED_CAP, Math.abs(base) + Math.max(0, accelBonus));
            }
          }
        }
      }

      g.particles = g.particles.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.life -= dt * 2;
        return p.life > 0;
      });

      if (g.shakeTimer > 0) g.shakeTimer -= dt;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      if (g.shakeTimer > 0) {
        const sx = (Math.random() - 0.5) * g.shakeIntensity * (g.shakeTimer / 0.3);
        const sy = (Math.random() - 0.5) * g.shakeIntensity * (g.shakeTimer / 0.3);
        ctx.translate(sx, sy);
      }

      drawTarget(ctx, cx, cy, g.targetAngle);

      for (const knife of g.stuckKnives) {
        const kx = cx + Math.sin(knife.angle + g.targetAngle) * (TARGET_RADIUS - 8);
        const ky = cy - Math.cos(knife.angle + g.targetAngle) * (TARGET_RADIUS - 8);
        const kAngle = knife.angle + g.targetAngle + Math.PI;
        drawKnife(ctx, kx, ky, kAngle, false);
      }

      if (g.throwingKnife) {
        drawKnife(ctx, cx, g.throwingKnife.y, 0, true);
      }

      for (const p of g.particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.restore();

      if (g.nextThrowReady && !g.throwingKnife && gameState === "playing") {
        const indicatorY = cy + TARGET_RADIUS + 60;
        ctx.save();
        ctx.strokeStyle = "rgba(255,45,85,0.3)";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(cx - 30, indicatorY);
        ctx.lineTo(cx + 30, indicatorY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      g.animFrame = requestAnimationFrame(gameLoop);
    },
    [drawTarget, drawKnife, checkCollision, spawnParticles, gameState, triggerDomShake]
  );

  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = Math.min(rect.height, window.innerHeight - 120);
      canvas.width = w * devicePixelRatio;
      canvas.height = h * devicePixelRatio;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(devicePixelRatio, devicePixelRatio);
      const g = gameRef.current;
      g.canvasW = w;
      g.canvasH = h;
      g.centerX = w / 2;
      g.centerY = h / 2 - 20;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

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

  useEffect(() => {
    if (gameState === "playing" || gameState === "throwing" || gameState === "gameover" || gameState === "won") {
      const g = gameRef.current;
      g.lastTime = 0;
      g.animFrame = requestAnimationFrame(gameLoop);
      return () => cancelAnimationFrame(g.animFrame);
    }
  }, [gameState, gameLoop]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(`.${styles.overlay} > *`, {
        y: 20, opacity: 0, stagger: 0.12, duration: 0.6,
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const startGame = useCallback(() => {
    const g = gameRef.current;
    g.targetAngle = 0;
    g.targetSpeed = 1.5;
    g.stuckKnives = [];
    g.throwingKnife = null;
    g.nextThrowReady = true;
    g.knivesRemaining = TOTAL_KNIVES;
    g.knivesSinceLastChange = 0;
    g.particles = [];
    g.shakeTimer = 0;
    g.lastTime = 0;
    setScore(0);
    setKnivesThrown(0);
    setGameState("playing");
    void ensureAC();
  }, []);

  const throwKnife = useCallback(() => {
    const g = gameRef.current;
    if (!g.nextThrowReady || g.throwingKnife || g.knivesRemaining <= 0) return;
    g.nextThrowReady = false;
    g.throwingKnife = {
      y: g.centerY + TARGET_RADIUS + 100,
      speed: 800,
    };
    playThrow();
  }, []);

  const handleCanvasClick = useCallback(() => {
    if (gameState === "playing") {
      throwKnife();
    }
  }, [gameState, throwKnife]);

  const restart = useCallback(() => {
    setGameState("start");
    setScore(0);
    setKnivesThrown(0);
  }, []);

  const remaining = TOTAL_KNIVES - knivesThrown;

  return (
    <div className={styles.page} ref={containerRef}>
      <div className={styles.canvasWrap}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onClick={handleCanvasClick}
        />

        {gameState === "playing" && (
          <>
            <div className={styles.hud}>
              <div className={styles.hudLeft}>
                <span className={styles.hudLabel}>Ножи</span>
                <span className={styles.hudValue}>{knivesThrown}/{TOTAL_KNIVES}</span>
              </div>
              <div className={styles.hudRight}>
                <span className={styles.hudLabel}>Счёт</span>
                <span className={styles.hudValue}>{score} / {WIN_SCORE}</span>
              </div>
            </div>
            <div style={{ position: "absolute", top: 58, left: 12, right: 12, height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden", zIndex: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ width: `${Math.min(100, (score / WIN_SCORE) * 100)}%`, height: "100%", background: "linear-gradient(90deg,#ff2d55,#ffcc00,#00ff88)", borderRadius: 999, transition: "width 0.35s ease", boxShadow: score > 3500 ? "0 0 12px rgba(255,45,85,0.7)" : undefined }} />
              <div style={{ position: "absolute", inset: 0, display: "flex" }}>
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} style={{ flex: 1, borderRight: i < 5 ? "1px solid rgba(255,255,255,0.18)" : undefined, position: "relative" }}>
                    <span style={{ position: "absolute", right: 2, top: 10, fontSize: 7, color: "rgba(255,255,255,0.45)", fontWeight: 700 }}>{(i + 1) * 7}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ position: "absolute", top: 76, left: 12, right: 12, display: "flex", justifyContent: "space-between", zIndex: 10, pointerEvents: "none" }}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Прогресс 42 → 4200</span>
              <span style={{ fontSize: 9, color: score >= WIN_SCORE ? "#00ff88" : "rgba(255,255,255,0.45)", fontWeight: 800 }}>{Math.round((score / WIN_SCORE) * 100)}%</span>
            </div>
          </>
        )}

        {gameState === "playing" && (
          <div className={styles.supply}>
            {Array.from({ length: Math.min(remaining, 10) }, (_, i) => (
              <div key={i} className={styles.supplyKnife} />
            ))}
            {remaining > 10 && <span className={styles.supplyMore}>+{remaining - 10}</span>}
          </div>
        )}

        {gameState === "start" && (
          <div className={styles.overlay}>
            <h1 className={styles.title}>НОЖИ 42</h1>
            <p className={styles.instruction}>Бросай ножи в мишень — набери 4200</p>
            <p className={styles.instructionSmall}>Не попадай в другие ножи! +100 за попадание · ускорение 0.02</p>
            <button className={styles.startBtn} onClick={startGame}>
              Начать
            </button>
          </div>
        )}

        {gameState === "gameover" && (
          <div className={styles.overlay}>
            <h2 className={styles.gameOverTitle}>Промах! 💥</h2>
            <p className={styles.gameOverScore}>Счёт {score} / {WIN_SCORE} · Ножей: {knivesThrown}/{TOTAL_KNIVES}</p>
            <button className={styles.startBtn} onClick={startGame}>
              Заново
            </button>
          </div>
        )}

        {gameState === "won" && (
          <div className={styles.overlay}>
            <div className={styles.winCard}>
              <h2 className={styles.winTitle}>🎉 Победа! 4200</h2>
              <p className={styles.winScore}>42 ножа в мишени! {score} очков</p>
              <a href={PRESAVE} target="_blank" rel="noreferrer" className={styles.presaveBtn}>
                Пресейв MAGNUM →
              </a>
              <button onClick={restart} className={styles.restartBtn}>
                Ещё раз
              </button>
            </div>
          </div>
        )}
      </div>

      <Link to="/magnum/games" className={styles.back}>← К играм</Link>
    </div>
  );
}