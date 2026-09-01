import { useRef, useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import styles from "./Snake42Game.module.css";

//Obscura-заглушка AudioParam: прямые вызовы ramp-методов могут кинуть — оборачиваем
function safeRamp(param: AudioParam, fn: () => void, fallbackValue: number) {
  try { fn(); } catch { param.value = fallbackValue; }
}


const PRESAVE = "https://music.thefence.me/psmagnum";
const WIN_LENGTH = 42;
const GRID = 20;
const TICK_MS_START = 140;
const TICK_MS_MIN = 70;

type Dir = "up" | "down" | "left" | "right";
type Pt = { x: number; y: number };

const DIR_VECTORS: Record<Dir, Pt> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

const SNAKE_COLORS = ["#ff2d55", "#ff6b35", "#ffcc00", "#00ff88", "#5865f2", "#a855f7"];

let ac: AudioContext | null = null;
function ensureAC() {
  if (!ac) try { ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { return null; }
  if (ac && ac.state === "suspended") void ac.resume();
  return ac;
}
function playEat() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "sine"; o.frequency.value = 660; safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(990, ctx.currentTime + 0.08), 990);
  g.gain.setValueAtTime(0.18, ctx.currentTime); safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.2);
}
function playDie() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "square"; o.frequency.value = 200; safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.3), 80);
  g.gain.setValueAtTime(0.15, ctx.currentTime); safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.4);
}
function playWin() {
  const ctx = ensureAC(); if (!ctx) return;
  [0, 0.1, 0.2, 0.3].forEach((d, i) => {
    const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.value = 440 + i * 110;
    g.gain.setValueAtTime(0.14, ctx.currentTime + d); safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.35), 0.001);
    o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.4);
  });
}

function spawnFood(snake: Pt[]): Pt {
  const occupied = new Set(snake.map((p) => `${p.x},${p.y}`));
  const free: Pt[] = [];
  for (let x = 0; x < GRID; x++) for (let y = 0; y < GRID; y++) if (!occupied.has(`${x},${y}`)) free.push({ x, y });
  return free.length > 0 ? free[Math.floor(Math.random() * free.length)]! : { x: 0, y: 0 };
}

export function Snake42Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"menu" | "playing" | "win" | "over">("menu");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem("snake42-best")) || 0; } catch { return 0; } });

  const snakeRef = useRef<Pt[]>([{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]);
  const dirRef = useRef<Dir>("right");
  const nextDirRef = useRef<Dir>("right");
  const foodRef = useRef<Pt>({ x: 15, y: 10 });
  const tickRef = useRef(0);
  const animRef = useRef(0);
  const lastTickRef = useRef(0);
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; life: number; color: string }[]>([]);

  const reset = useCallback(() => {
    snakeRef.current = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    dirRef.current = "right"; nextDirRef.current = "right";
    foodRef.current = spawnFood(snakeRef.current);
    tickRef.current = TICK_MS_START;
    particlesRef.current = [];
    setScore(0);
  }, []);

  const start = useCallback(() => { reset(); setState("playing"); }, [reset]);

  useEffect(() => {
    const map: Record<string, Dir> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", KeyW: "up", KeyS: "down", KeyA: "left", KeyD: "right" };
    const onKey = (e: KeyboardEvent) => {
      const d = map[e.code]; if (!d) return;
      e.preventDefault();
      if (d !== OPPOSITE[dirRef.current]) nextDirRef.current = d;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = useCallback((e: React.TouchEvent) => { touchRef.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY }; }, []);
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const t = e.changedTouches[0]!; const dx = t.clientX - touchRef.current.x; const dy = t.clientY - touchRef.current.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    const d: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
    if (d !== OPPOSITE[dirRef.current]) nextDirRef.current = d;
    touchRef.current = null;
  }, []);

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
      ctx.clearRect(0, 0, SIZE, SIZE);
      const bg = ctx.createLinearGradient(0, 0, 0, SIZE);
      bg.addColorStop(0, "#08081a"); bg.addColorStop(1, "#1a0a2e");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      for (let i = 1; i < GRID; i++) {
        ctx.beginPath(); ctx.moveTo(i * cellW, 0); ctx.lineTo(i * cellW, SIZE); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * cellW); ctx.lineTo(SIZE, i * cellW); ctx.stroke();
      }

      if (state === "playing") {
        if (now - lastTickRef.current >= tickRef.current) {
          lastTickRef.current = now;
          dirRef.current = nextDirRef.current;
          const snake = snakeRef.current;
          const head = snake[0]!;
          const vec = DIR_VECTORS[dirRef.current];
          const newHead: Pt = { x: head.x + vec.x, y: head.y + vec.y };
          if (newHead.x < 0 || newHead.x >= GRID || newHead.y < 0 || newHead.y >= GRID) {
            playDie(); setState("over");
            const nb = Math.max(best, snake.length); setBest(nb);
            try { localStorage.setItem("snake42-best", String(nb)); } catch {}
            animRef.current = requestAnimationFrame(draw); return;
          }
          if (snake.some((p) => p.x === newHead.x && p.y === newHead.y)) {
            playDie(); setState("over");
            const nb = Math.max(best, snake.length); setBest(nb);
            try { localStorage.setItem("snake42-best", String(nb)); } catch {}
            animRef.current = requestAnimationFrame(draw); return;
          }
          snake.unshift(newHead);
          if (newHead.x === foodRef.current.x && newHead.y === foodRef.current.y) {
            playEat();
            foodRef.current = spawnFood(snake);
            setScore(snake.length);
            for (let i = 0; i < 8; i++) particlesRef.current.push({
              x: newHead.x * cellW + cellW / 2, y: newHead.y * cellW + cellW / 2,
              vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4,
              life: 1, color: SNAKE_COLORS[snake.length % SNAKE_COLORS.length]!,
            });
            tickRef.current = Math.max(TICK_MS_MIN, TICK_MS_START - snake.length * 1.5);
            if (snake.length >= WIN_LENGTH) {
              playWin(); setState("win");
              const nb = Math.max(best, snake.length); setBest(nb);
              try { localStorage.setItem("snake42-best", String(nb)); } catch {}
            }
          } else {
            snake.pop();
          }
        }

        const f = foodRef.current;
        ctx.shadowColor = "#ff2d55"; ctx.shadowBlur = 14;
        ctx.fillStyle = "#ff2d55";
        ctx.beginPath(); ctx.arc(f.x * cellW + cellW / 2, f.y * cellW + cellW / 2, cellW * 0.38, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff"; ctx.font = `900 ${cellW * 0.42}px Inter, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("42", f.x * cellW + cellW / 2, f.y * cellW + cellW / 2 + 1);

        const snake = snakeRef.current;
        for (let i = snake.length - 1; i >= 0; i--) {
          const p = snake[i]!;
          const color = SNAKE_COLORS[i % SNAKE_COLORS.length]!;
          const isHead = i === 0;
          const r = isHead ? cellW * 0.44 : cellW * 0.38;
          if (isHead) { ctx.shadowColor = color; ctx.shadowBlur = 12; }
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.roundRect(p.x * cellW + (cellW - r * 2) / 2, p.y * cellW + (cellW - r * 2) / 2, r * 2, r * 2, isHead ? 6 : 4); ctx.fill();
          ctx.shadowBlur = 0;
          if (isHead) {
            const vec = DIR_VECTORS[dirRef.current];
            const cx = p.x * cellW + cellW / 2 + vec.x * cellW * 0.15;
            const cy = p.y * cellW + cellW / 2 + vec.y * cellW * 0.15;
            ctx.fillStyle = "#fff";
            ctx.beginPath(); ctx.arc(cx - 3, cy - 2, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + 3, cy - 2, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#000";
            ctx.beginPath(); ctx.arc(cx - 3, cy - 2, 1.2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + 3, cy - 2, 1.2, 0, Math.PI * 2); ctx.fill();
          }
        }
      } else {
        const t = now * 0.001;
        for (let i = 0; i < 12; i++) {
          const x = ((Math.sin(t * 0.8 + i * 0.5) + 1) / 2) * (GRID - 1);
          const y = ((Math.cos(t * 0.6 + i * 0.7) + 1) / 2) * (GRID - 1);
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = SNAKE_COLORS[i % SNAKE_COLORS.length]!;
          ctx.beginPath(); ctx.roundRect(x * cellW + 2, y * cellW + 2, cellW - 4, cellW - 4, 4); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      particlesRef.current = particlesRef.current.filter((p) => p.life > 0);
      for (const p of particlesRef.current) {
        p.x += p.vx; p.y += p.vy; p.life -= 0.025;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      const vig = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.3, SIZE / 2, SIZE / 2, SIZE * 0.7);
      vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(0,0,0,0.35)");
      ctx.fillStyle = vig; ctx.fillRect(0, 0, SIZE, SIZE);

      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [state, best]);

  return (
    <div className={styles.page}>
      <h1>ЗМЕЙКА 42</h1>
      <p className={styles.sub}>Стрелками или свайпом — вырасти до {WIN_LENGTH}!</p>

      {state === "menu" && (
        <div className={styles.menu}>
          <div className={styles.rules}>
            <p>🐍 Управление: стрелки / WASD / свайп</p>
            <p>🍎 Ешь «42» — растёшь на 1</p>
            <p>💀 Стены и хвост = конец</p>
            <p>🏆 Цель: длина {WIN_LENGTH}</p>
          </div>
          <button className={styles.playBtn} onClick={start}>Начать!</button>
          <p className={styles.hint}>Рекорд: {best} клеток</p>
          <Link to="/magnum/games" className={styles.back}>← К играм</Link>
        </div>
      )}

      {(state === "playing" || state === "win" || state === "over") && (
        <div className={styles.gameArea}>
          <div className={styles.hud}>
            <div className={styles.stat}><span>Длина</span><strong>{score} / {WIN_LENGTH}</strong></div>
            <div className={styles.stat}><span>Рекорд</span><strong>{best}</strong></div>
          </div>
          <div className={styles.progress}><div className={styles.fill} style={{ width: `${Math.min((score / WIN_LENGTH) * 100, 100)}%` }} /></div>
          <div className={styles.canvasWrap} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <canvas ref={canvasRef} className={styles.canvas} />
          </div>
          <div className={styles.navRow}>
            <button className={styles.restartBtn} onClick={start}>Заново</button>
            <Link to="/magnum/games" className={styles.backInline}>← К играм</Link>
          </div>
        </div>
      )}

      {state === "win" && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2>🏆 Змейка {WIN_LENGTH}!</h2>
            <p>Длина {WIN_LENGTH} — ты собрал магическое число!</p>
            <a href={PRESAVE} target="_blank" rel="noreferrer" className={styles.presaveBtn}>Пресейв MAGNUM →</a>
            <button className={styles.restartBtn} onClick={start}>Ещё раз</button>
          </div>
        </div>
      )}
      {state === "over" && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2>💀 Столкновение!</h2>
            <p>Длина {score} / {WIN_LENGTH} • Рекорд {best}</p>
            <button className={styles.playBtn} onClick={start}>Ещё попытка</button>
            <Link to="/magnum/games" className={styles.backInline}>← К играм</Link>
          </div>
        </div>
      )}
    </div>
  );
}
