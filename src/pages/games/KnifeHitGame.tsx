import { useRef, useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import styles from "./KnifeHitGame.module.css";

const PRESAVE = "https://music.thefence.me/psmagnum";
const TOTAL_KNIVES = 42;
const TARGET_RADIUS = 80;
const KNIFE_LENGTH = 40;
const KNIFE_WIDTH = 6;
const HIT_ZONE_RADIUS = 12;
const COLLISION_ANGLE_THRESHOLD = 0.18; // radians

interface StuckKnife {
  angle: number; // angle relative to target center at time of sticking
}

type GameState = "start" | "playing" | "throwing" | "gameover" | "won";

export function KnifeHitGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<GameState>("start");
  const [score, setScore] = useState(0);
  const [knivesThrown, setKnivesThrown] = useState(0);

  // Game refs (mutable state for animation loop)
  const gameRef = useRef({
    targetAngle: 0,
    targetSpeed: 1.5, // radians per second
    stuckKnives: [] as StuckKnife[],
    throwingKnife: null as { y: number; speed: number } | null,
    nextThrowReady: true,
    knivesRemaining: TOTAL_KNIVES,
    lastTime: 0,
    animFrame: 0,
    speedChangeTimer: 0,
    knivesSinceLastChange: 0,
    canvasW: 0,
    canvasH: 0,
    centerX: 0,
    centerY: 0,
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string }[],
    shakeTimer: 0,
    shakeIntensity: 0,
  });

  const drawKnife = useCallback(
    (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, glowing: boolean) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      // Blade
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

      // Handle
      ctx.fillStyle = "#8B6914";
      ctx.fillRect(-KNIFE_WIDTH / 2 - 1, KNIFE_LENGTH / 4, KNIFE_WIDTH + 2, KNIFE_LENGTH / 4);

      // Handle wrap
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

      // Outer ring shadow
      ctx.beginPath();
      ctx.arc(0, 0, TARGET_RADIUS + 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fill();

      // Main log body
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, TARGET_RADIUS);
      grad.addColorStop(0, "#C4A265");
      grad.addColorStop(0.3, "#A08040");
      grad.addColorStop(0.7, "#8B6914");
      grad.addColorStop(1, "#6B4F0A");
      ctx.beginPath();
      ctx.arc(0, 0, TARGET_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Wood grain rings
      ctx.strokeStyle = "rgba(107,79,10,0.3)";
      ctx.lineWidth = 1;
      for (let r = 15; r < TARGET_RADIUS; r += 12) {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Center dot
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#6B4F0A";
      ctx.fill();

      // Bark edge
      ctx.beginPath();
      ctx.arc(0, 0, TARGET_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = "#4A3508";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.restore();
    },
    []
  );

  const spawnParticles = useCallback((x: number, y: number, count: number, color: string) => {
    const g = gameRef.current;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      g.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color,
      });
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

      // Update target rotation
      g.targetAngle += g.targetSpeed * dt;

      // Update throwing knife
      if (g.throwingKnife) {
        g.throwingKnife.y -= g.throwingKnife.speed * dt;
        const knifeTipY = g.throwingKnife.y - KNIFE_LENGTH / 2;
        const targetEdgeY = cy - TARGET_RADIUS + 5;

        if (knifeTipY <= targetEdgeY) {
          // Check collision with stuck knives
          // The knife is at angle 0 (top) relative to target
          const throwAngle = (-g.targetAngle) % (Math.PI * 2);
          const normalizedAngle = ((throwAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

          if (checkCollision(normalizedAngle)) {
            // Hit an existing knife - game over
            spawnParticles(cx, cy - TARGET_RADIUS, 15, "#ff2d55");
            g.shakeTimer = 0.3;
            g.shakeIntensity = 8;
            g.throwingKnife = null;
            g.nextThrowReady = true;
            setGameState("gameover");
          } else {
            // Stick into target
            g.stuckKnives.push({ angle: normalizedAngle });
            g.throwingKnife = null;
            g.nextThrowReady = true;
            g.knivesSinceLastChange++;
            g.knivesRemaining--;

            spawnParticles(cx, cy - TARGET_RADIUS, 8, "#C4A265");

            setScore((s) => s + 1);
            setKnivesThrown((k) => k + 1);

            // Check win
            if (g.stuckKnives.length >= TOTAL_KNIVES) {
              setGameState("won");
              return;
            }

            // Change speed every 5 knives
            if (g.knivesSinceLastChange >= 5) {
              g.knivesSinceLastChange = 0;
              const speedOptions = [1.2, 1.8, 2.5, 3.0, -1.5, -2.0, -2.8];
              g.targetSpeed = speedOptions[Math.floor(Math.random() * speedOptions.length)]!;
            }
          }
        }
      }

      // Update particles
      g.particles = g.particles.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1; // gravity
        p.life -= dt * 2;
        return p.life > 0;
      });

      // Update shake
      if (g.shakeTimer > 0) {
        g.shakeTimer -= dt;
      }

      // --- DRAW ---
      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, w, h);

      // Apply shake
      ctx.save();
      if (g.shakeTimer > 0) {
        const sx = (Math.random() - 0.5) * g.shakeIntensity * (g.shakeTimer / 0.3);
        const sy = (Math.random() - 0.5) * g.shakeIntensity * (g.shakeTimer / 0.3);
        ctx.translate(sx, sy);
      }

      // Draw target
      drawTarget(ctx, cx, cy, g.targetAngle);

      // Draw stuck knives (rotate with target)
      for (const knife of g.stuckKnives) {
        const kx = cx + Math.sin(knife.angle + g.targetAngle) * (TARGET_RADIUS - 8);
        const ky = cy - Math.cos(knife.angle + g.targetAngle) * (TARGET_RADIUS - 8);
        const kAngle = knife.angle + g.targetAngle + Math.PI;
        drawKnife(ctx, kx, ky, kAngle, false);
      }

      // Draw throwing knife
      if (g.throwingKnife) {
        drawKnife(ctx, cx, g.throwingKnife.y, 0, true);
      }

      // Draw particles
      for (const p of g.particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.restore();

      // Draw next-throw indicator (ready line)
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
    [drawTarget, drawKnife, checkCollision, spawnParticles, gameState]
  );

  // Resize canvas
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

  // Start animation loop
  useEffect(() => {
    if (gameState === "playing" || gameState === "throwing" || gameState === "gameover" || gameState === "won") {
      const g = gameRef.current;
      g.lastTime = 0;
      g.animFrame = requestAnimationFrame(gameLoop);
      return () => cancelAnimationFrame(g.animFrame);
    }
  }, [gameState, gameLoop]);

  // GSAP entrance
  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(`.${styles.overlay} > *`, {
        y: 20, opacity: 0, stagger: 0.1, duration: 0.6,
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
  }, []);

  const throwKnife = useCallback(() => {
    const g = gameRef.current;
    if (!g.nextThrowReady || g.throwingKnife || g.knivesRemaining <= 0) return;
    g.nextThrowReady = false;
    g.throwingKnife = {
      y: g.centerY + TARGET_RADIUS + 100,
      speed: 800,
    };
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

        {/* HUD overlay */}
        {gameState === "playing" && (
          <div className={styles.hud}>
            <div className={styles.hudLeft}>
              <span className={styles.hudLabel}>Ножи</span>
              <span className={styles.hudValue}>{knivesThrown}/{TOTAL_KNIVES}</span>
            </div>
            <div className={styles.hudRight}>
              <span className={styles.hudLabel}>Счёт</span>
              <span className={styles.hudValue}>{score}</span>
            </div>
          </div>
        )}

        {/* Knife supply */}
        {gameState === "playing" && (
          <div className={styles.supply}>
            {Array.from({ length: Math.min(remaining, 10) }, (_, i) => (
              <div key={i} className={styles.supplyKnife} />
            ))}
            {remaining > 10 && <span className={styles.supplyMore}>+{remaining - 10}</span>}
          </div>
        )}

        {/* Start overlay */}
        {gameState === "start" && (
          <div className={styles.overlay}>
            <h1 className={styles.title}>НОЖИ 42</h1>
            <p className={styles.instruction}>Бросай ножи в мишень</p>
            <p className={styles.instructionSmall}>Не попадай в другие ножи!</p>
            <button className={styles.startBtn} onClick={startGame}>
              Начать
            </button>
          </div>
        )}

        {/* Game Over overlay */}
        {gameState === "gameover" && (
          <div className={styles.overlay}>
            <h2 className={styles.gameOverTitle}>Промах! 💥</h2>
            <p className={styles.gameOverScore}>Ножей: {score}</p>
            <button className={styles.startBtn} onClick={startGame}>
              Заново
            </button>
          </div>
        )}

        {/* Win overlay */}
        {gameState === "won" && (
          <div className={styles.overlay}>
            <div className={styles.winCard}>
              <h2 className={styles.winTitle}>🎉 Победа!</h2>
              <p className={styles.winScore}>42 ножа в мишени!</p>
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
