import { useRef, useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import styles from "./RunnerGame.module.css";

const PRESAVE = "https://music.thefence.me/psmagnum";
const WIN_SCORE = 4200;
const GRAVITY = 0.6;
const JUMP_FORCE = -12;
const GROUND_Y = 0.75;

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

export function RunnerGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<"start" | "playing" | "over" | "win">("start");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => {
    try { return Number(localStorage.getItem("runner-best")) || 0; } catch { return 0; }
  });

  const stateRef = useRef({
    playerY: 0, playerVY: 0, isGrounded: true, canDoubleJump: true,
    obstacles: [] as Obstacle[], collectibles: [] as Collectible[],
    speed: 4, distance: 0, score: 0, frame: 0,
    bgX: 0, bgX2: 0,
  });

  const resetGame = useCallback(() => {
    const s = stateRef.current;
    s.playerY = 0; s.playerVY = 0; s.isGrounded = true; s.canDoubleJump = true;
    s.obstacles = []; s.collectibles = [];
    s.speed = 4; s.distance = 0; s.score = 0; s.frame = 0;
    s.bgX = 0; s.bgX2 = 0;
    setScore(0);
  }, []);

  const jump = useCallback(() => {
    const s = stateRef.current;
    if (gameState !== "playing") return;
    if (s.isGrounded) {
      s.playerVY = JUMP_FORCE;
      s.isGrounded = false;
      s.canDoubleJump = true;
    } else if (s.canDoubleJump) {
      s.playerVY = JUMP_FORCE * 0.8;
      s.canDoubleJump = false;
    }
  }, [gameState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number;
    let lastTime = 0;

    const resize = () => {
      canvas.width = Math.min(canvas.parentElement?.clientWidth || 800, 800);
      canvas.height = 400;
    };
    resize();
    window.addEventListener("resize", resize);

    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); jump(); }
    };
    window.addEventListener("keydown", handleKey);

    const spawnObstacle = (s: typeof stateRef.current) => {
      const types: Obstacle["type"][] = ["mushroom", "chain", "disco"];
      const type = types[Math.floor(Math.random() * types.length)]!;
      const h = type === "mushroom" ? 40 : type === "chain" ? 50 : 35;
      const w = type === "disco" ? 35 : 25;
      s.obstacles.push({ x: canvas.width + 50, w, h, type });
    };

    const spawnCollectible = (s: typeof stateRef.current) => {
      const type = Math.random() > 0.5 ? "42" : "note";
      s.collectibles.push({
        x: canvas.width + 100,
        y: canvas.height * GROUND_Y - 60 - Math.random() * 80,
        type, collected: false,
      });
    };

    const drawPlayer = (ctx: CanvasRenderingContext2D, x: number, y: number, frame: number) => {
      // Simple animated character
      ctx.save();
      ctx.translate(x, y);
      // Body
      ctx.fillStyle = "#ff2d55";
      ctx.fillRect(-15, -40, 30, 40);
      // Head
      ctx.fillStyle = "#ffcc00";
      ctx.beginPath();
      ctx.arc(0, -50, 12, 0, Math.PI * 2);
      ctx.fill();
      // Legs (animated)
      ctx.fillStyle = "#333";
      const legOffset = Math.sin(frame * 0.3) * 8;
      ctx.fillRect(-10, 0, 8, 15 + legOffset);
      ctx.fillRect(2, 0, 8, 15 - legOffset);
      // Sunglasses
      ctx.fillStyle = "#000";
      ctx.fillRect(-10, -54, 20, 5);
      // Chain
      ctx.fillStyle = "#ffcc00";
      ctx.fillRect(-12, -35, 24, 3);
      ctx.restore();
    };

    const drawObstacle = (ctx: CanvasRenderingContext2D, obs: Obstacle, groundY: number) => {
      ctx.save();
      ctx.translate(obs.x, groundY);
      if (obs.type === "mushroom") {
        // Red mushroom with white dots
        ctx.fillStyle = "#ff2d55";
        ctx.beginPath();
        ctx.arc(0, -obs.h, obs.w, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(-5, -obs.h - 8, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(5, -obs.h - 5, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ddd";
        ctx.fillRect(-6, -obs.h, 12, obs.h);
      } else if (obs.type === "chain") {
        ctx.strokeStyle = "#ffcc00";
        ctx.lineWidth = 4;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(0, -obs.h + i * 15, 6, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else {
        // Disco ball
        ctx.fillStyle = "#5865f2";
        ctx.beginPath();
        ctx.arc(0, -obs.h / 2, obs.w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        for (let i = 0; i < 5; i++) {
          ctx.fillRect(-obs.w / 2 + i * 7, -obs.h / 2 - 3, 4, 4);
        }
      }
      ctx.restore();
    };

    const drawCollectible = (ctx: CanvasRenderingContext2D, c: Collectible, frame: number) => {
      if (c.collected) return;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.globalAlpha = 0.8 + Math.sin(frame * 0.1) * 0.2;
      if (c.type === "42") {
        ctx.fillStyle = "#ffcc00";
        ctx.font = "bold 24px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("42", 0, 8);
      } else {
        ctx.fillStyle = "#00ff88";
        ctx.font = "20px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("🎵", 0, 8);
      }
      ctx.restore();
    };

    const gameLoop = (time: number) => {
      const dt = Math.min((time - lastTime) / 16.67, 2);
      lastTime = time;

      const s = stateRef.current;
      const W = canvas.width;
      const H = canvas.height;
      const groundY = H * GROUND_Y;

      if (gameState === "playing") {
        s.frame++;
        s.distance += s.speed * dt;
        s.speed = 4 + s.distance * 0.0005;
        s.score = Math.floor(s.distance / 10);
        setScore(s.score);

        if (s.score >= WIN_SCORE) {
          setGameState("win");
          const newBest = Math.max(best, s.score);
          setBest(newBest);
          try { localStorage.setItem("runner-best", String(newBest)); } catch {}
          return;
        }

        // Player physics
        s.playerVY += GRAVITY * dt;
        s.playerY += s.playerVY * dt;
        if (s.playerY >= 0) { s.playerY = 0; s.playerVY = 0; s.isGrounded = true; }

        // Spawn obstacles
        if (s.frame % Math.max(60, 120 - Math.floor(s.distance / 500)) === 0) {
          spawnObstacle(s);
        }
        if (s.frame % 90 === 0) spawnCollectible(s);

        // Move obstacles
        s.obstacles = s.obstacles.filter(o => {
          o.x -= s.speed * dt;
          return o.x > -50;
        });

        // Move collectibles
        s.collectibles = s.collectibles.filter(c => {
          c.x -= s.speed * dt;
          return c.x > -50;
        });

        // Collision detection
        const playerX = 80;
        const playerTop = groundY + s.playerY - 50;
        const playerBottom = groundY + s.playerY + 15;
        const playerLeft = playerX - 12;
        const playerRight = playerX + 12;

        for (const obs of s.obstacles) {
          const obsTop = groundY - obs.h;
          const obsBottom = groundY;
          const obsLeft = obs.x - obs.w / 2;
          const obsRight = obs.x + obs.w / 2;

          if (playerRight > obsLeft && playerLeft < obsRight &&
              playerBottom > obsTop && playerTop < obsBottom) {
            setGameState("over");
            const newBest = Math.max(best, s.score);
            setBest(newBest);
            try { localStorage.setItem("runner-best", String(newBest)); } catch {}
            return;
          }
        }

        // Collect items
        for (const c of s.collectibles) {
          if (c.collected) continue;
          const dx = Math.abs(playerX - c.x);
          const dy = Math.abs((groundY + s.playerY - 25) - c.y);
          if (dx < 25 && dy < 25) {
            c.collected = true;
            s.score += 50;
          }
        }

        // Background scroll
        s.bgX = (s.bgX + s.speed * 0.3 * dt) % W;
        s.bgX2 = (s.bgX2 + s.speed * 0.15 * dt) % W;
      }

      // Draw
      ctx.clearRect(0, 0, W, H);

      // Sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
      skyGrad.addColorStop(0, "#0a0a2e");
      skyGrad.addColorStop(1, "#1a0a2e");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H);

      // Stars
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      for (let i = 0; i < 30; i++) {
        const sx = ((i * 137 + 50) % W - s.bgX2 * 0.5) % W;
        const sy = (i * 73 + 20) % (H * 0.5);
        ctx.fillRect(sx < 0 ? sx + W : sx, sy, 2, 2);
      }

      // City silhouette (parallax)
      ctx.fillStyle = "rgba(20,10,40,0.8)";
      for (let i = 0; i < 15; i++) {
        const bx = ((i * 80) - s.bgX) % (W + 100);
        const bh = 40 + (i * 37) % 100;
        ctx.fillRect(bx < 0 ? bx + W + 100 : bx, groundY - bh, 50, bh);
      }

      // Ground
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, groundY, W, H - groundY);
      ctx.strokeStyle = "rgba(255,45,85,0.3)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(W, groundY);
      ctx.stroke();

      // Draw obstacles
      for (const obs of s.obstacles) {
        drawObstacle(ctx, obs, groundY);
      }

      // Draw collectibles
      for (const c of s.collectibles) {
        drawCollectible(ctx, c, s.frame);
      }

      // Draw player
      drawPlayer(ctx, 80, groundY + s.playerY, s.frame);

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", resize);
    };
  }, [gameState, jump, best]);

  const startGame = () => {
    resetGame();
    setGameState("playing");
  };

  return (
    <div className={styles.page}>
      <h1>Беги, братуха!</h1>

      <div className={styles.canvasWrap}>
        <canvas ref={canvasRef} className={styles.canvas} onClick={jump} onTouchStart={(e) => { e.preventDefault(); jump(); }} />

        {gameState === "start" && (
          <div className={styles.overlay}>
            <h2>🏃 БЕГИ, БРАТУХА!</h2>
            <p>Прыгай через мухоморы и цепи</p>
            <p className={styles.controls}>Пробел / Клик = Прыжок</p>
            <button className={styles.startBtn} onClick={startGame}>Начать!</button>
          </div>
        )}

        {gameState === "over" && (
          <div className={styles.overlay}>
            <h2>💀 Раздавили!</h2>
            <p>Счёт: {score} • Лучший: {best}</p>
            <button className={styles.startBtn} onClick={startGame}>Ещё раз</button>
          </div>
        )}

        {gameState === "win" && (
          <div className={styles.overlay}>
            <h2>🎉 Победа!</h2>
            <p>Счёт: {score}</p>
            <a href={PRESAVE} target="_blank" className={styles.presaveBtn}>Пресейв MAGNUM →</a>
            <button className={styles.restartBtn} onClick={startGame}>Ещё раз</button>
          </div>
        )}
      </div>

      <div className={styles.hud}>
        <span>Счёт: {score}</span>
        <span>Лучший: {best}</span>
        <span>Цель: {WIN_SCORE}</span>
      </div>

      <Link to="/magnum/games" className={styles.back}>← К играм</Link>
    </div>
  );
}
