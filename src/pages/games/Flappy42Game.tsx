import { useRef, useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import styles from "./Flappy42Game.module.css";

const PRESAVE = "https://music.thefence.me/psmagnum";
const WIN_SCORE = 42;
const GRAVITY = 0.42;
const FLAP_FORCE = -7.2;
const PIPE_GAP = 140;
const PIPE_W = 56;
const PIPE_SPEED = 2.6;
const PIPE_INTERVAL = 1600; // ms between pipes
const BIRD_R = 16;

interface Pipe { x: number; gapY: number; scored: boolean; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; }

let ac: AudioContext | null = null;
function ensureAC() {
  if (!ac) try { ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { return null; }
  if (ac && ac.state === "suspended") void ac.resume();
  return ac;
}
function playFlap() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "sine"; o.frequency.value = 520; o.frequency.linearRampToValueAtTime(680, ctx.currentTime + 0.06);
  g.gain.setValueAtTime(0.1, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
  o.start(); o.stop(ctx.currentTime + 0.12);
}
function playScore() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "sine"; o.frequency.value = 880; o.frequency.linearRampToValueAtTime(1320, ctx.currentTime + 0.1);
  g.gain.setValueAtTime(0.15, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  o.start(); o.stop(ctx.currentTime + 0.22);
}
function playHit() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "square"; o.frequency.value = 160; o.frequency.linearRampToValueAtTime(60, ctx.currentTime + 0.2);
  g.gain.setValueAtTime(0.18, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
  o.start(); o.stop(ctx.currentTime + 0.32);
}

export function Flappy42Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"menu" | "playing" | "win" | "dead">("menu");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem("flappy42-best")) || 0; } catch { return 0; } });

  const birdRef = useRef({ y: 250, vy: 0, rot: 0 });
  const pipesRef = useRef<Pipe[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const scoreRef = useRef(0);
  const lastPipeRef = useRef(0);
  const animRef = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  const flap = useCallback(() => {
    if (stateRef.current === "dead" || stateRef.current === "win") return;
    if (stateRef.current === "menu") {
      birdRef.current = { y: 250, vy: 0, rot: 0 };
      pipesRef.current = [];
      particlesRef.current = [];
      scoreRef.current = 0;
      lastPipeRef.current = performance.now();
      setScore(0);
      setState("playing");
      stateRef.current = "playing";
    }
    birdRef.current.vy = FLAP_FORCE;
    playFlap();
  }, []);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); flap(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flap]);

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

      // BG gradient
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#0a0a2e"); bg.addColorStop(0.5, "#1a0a3e"); bg.addColorStop(1, "#0a1a2e");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, H);

      // Stars
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      for (let i = 0; i < 25; i++) {
        const sx = (i * 97 + 13) % w;
        const sy = (i * 53 + 7) % (H * 0.5);
        ctx.globalAlpha = 0.15 + Math.sin(now * 0.001 + i) * 0.1;
        ctx.fillRect(sx, sy, 1.2, 1.2);
      }
      ctx.globalAlpha = 1;

      if (stateRef.current === "playing") {
        // Physics
        bird.vy += GRAVITY;
        bird.y += bird.vy;
        bird.rot = Math.max(-30, Math.min(70, bird.vy * 4));

        // Spawn pipes
        if (now - lastPipeRef.current > PIPE_INTERVAL) {
          const gapY = 100 + Math.random() * (H - 200 - PIPE_GAP);
          pipes.push({ x: w + 10, gapY, scored: false });
          lastPipeRef.current = now;
        }

        // Move pipes
        for (const p of pipes) p.x -= PIPE_SPEED;
        // Remove offscreen
        while (pipes.length > 0 && pipes[0]!.x < -PIPE_W - 10) pipes.shift();

        // Score
        for (const p of pipes) {
          if (!p.scored && p.x + PIPE_W < w / 2 - 20) {
            p.scored = true;
            scoreRef.current++;
            setScore(scoreRef.current);
            playScore();
            // confetti
            for (let i = 0; i < 6; i++) particlesRef.current.push({
              x: w / 2, y: bird.y, vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 4 - 1,
              life: 1, color: ["#ff2d55", "#ffcc00", "#00ff88"][i % 3]!,
            });
            if (scoreRef.current >= WIN_SCORE) {
              setState("win"); stateRef.current = "win";
              const nb = Math.max(best, scoreRef.current); setBest(nb);
              try { localStorage.setItem("flappy42-best", String(nb)); } catch {}
            }
          }
        }

        // Collision
        const bx = w / 2 - 20;
        if (bird.y > H - 30 || bird.y < 10) {
          setState("dead"); stateRef.current = "dead"; playHit();
          const nb = Math.max(best, scoreRef.current); setBest(nb);
          try { localStorage.setItem("flappy42-best", String(nb)); } catch {}
        }
        for (const p of pipes) {
          const inPipeX = bx + BIRD_R > p.x && bx - BIRD_R < p.x + PIPE_W;
          if (inPipeX && (bird.y - BIRD_R < p.gapY || bird.y + BIRD_R > p.gapY + PIPE_GAP)) {
            setState("dead"); stateRef.current = "dead"; playHit();
            const nb = Math.max(best, scoreRef.current); setBest(nb);
            try { localStorage.setItem("flappy42-best", String(nb)); } catch {}
          }
        }
      }

      // Draw pipes
      for (const p of pipes) {
        // top pipe
        const topH = p.gapY;
        const grad = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
        grad.addColorStop(0, "#1a3a2a"); grad.addColorStop(0.5, "#2a5a3a"); grad.addColorStop(1, "#1a3a2a");
        ctx.fillStyle = grad;
        ctx.fillRect(p.x, 0, PIPE_W, topH);
        // cap
        ctx.fillStyle = "#2a6a4a";
        ctx.fillRect(p.x - 4, topH - 18, PIPE_W + 8, 18);
        // bottom pipe
        const botY = p.gapY + PIPE_GAP;
        ctx.fillStyle = grad;
        ctx.fillRect(p.x, botY, PIPE_W, H - botY);
        ctx.fillStyle = "#2a6a4a";
        ctx.fillRect(p.x - 4, botY, PIPE_W + 8, 18);
        // 42 label
        ctx.fillStyle = "rgba(255,204,0,0.7)"; ctx.font = "900 11px Inter, sans-serif"; ctx.textAlign = "center";
        ctx.fillText("42", p.x + PIPE_W / 2, topH + PIPE_GAP / 2 + 4);
      }

      // Draw bird
      ctx.save();
      ctx.translate(w / 2 - 20, bird.y);
      ctx.rotate((bird.rot * Math.PI) / 180);
      // body glow
      ctx.shadowColor = "#ff2d55"; ctx.shadowBlur = 14;
      ctx.fillStyle = "#ff2d55";
      ctx.beginPath(); ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      // inner
      ctx.fillStyle = "#ff6b8a";
      ctx.beginPath(); ctx.arc(-3, -3, BIRD_R * 0.45, 0, Math.PI * 2); ctx.fill();
      // eye
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(6, -5, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath(); ctx.arc(7, -5, 2.5, 0, Math.PI * 2); ctx.fill();
      // beak
      ctx.fillStyle = "#ffcc00";
      ctx.beginPath(); ctx.moveTo(BIRD_R, -3); ctx.lineTo(BIRD_R + 10, 0); ctx.lineTo(BIRD_R, 4); ctx.closePath(); ctx.fill();
      // 42 text
      ctx.fillStyle = "#fff"; ctx.font = "900 8px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("42", -2, 1);
      ctx.restore();

      // Particles
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
      for (const p of particlesRef.current) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= 0.025;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Ground line
      ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, H - 28); ctx.lineTo(w, H - 28); ctx.stroke();

      // Menu idle animation
      if (stateRef.current === "menu" || stateRef.current === "dead" || stateRef.current === "win") {
        // gentle float
        bird.y = 250 + Math.sin(now * 0.003) * 20;
        bird.rot = Math.sin(now * 0.004) * 10;
      }

      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener("resize", resize); };
  }, [best]);

  return (
    <div className={styles.page}>
      <h1>FLAPPY 42</h1>
      <p className={styles.sub}>Тапай или пробел — пролети {WIN_SCORE} труб!</p>

      <div className={styles.hud}>
        <div className={styles.stat}><span>Очки</span><strong>{score}</strong></div>
        <div className={styles.stat}><span>Цель</span><strong>{WIN_SCORE}</strong></div>
        <div className={styles.stat}><span>Рекорд</span><strong>{best}</strong></div>
      </div>

      <div className={styles.canvasWrap}>
        <canvas ref={canvasRef} className={styles.canvas} onPointerDown={(e) => { e.preventDefault(); flap(); }} />
      </div>

      {state === "menu" && (
        <div className={styles.menu}>
          <p className={styles.hint}>Тап по экрану или пробел — птичка 42 летит вверх</p>
          <button className={styles.playBtn} onClick={flap}>Играть!</button>
          <Link to="/magnum/games" className={styles.back}>← К играм</Link>
        </div>
      )}

      {state === "playing" && (
        <div className={styles.navRow}>
          <Link to="/magnum/games" className={styles.backInline}>← К играм</Link>
        </div>
      )}

      {state === "win" && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2>🎉 42 ТРУБЫ ПРОЙДЕНЫ!</h2>
            <p>{score} очков — ты настоящий братуха-пилот!</p>
            <a href={PRESAVE} target="_blank" rel="noreferrer" className={styles.presaveBtn}>Пресейв MAGNUM →</a>
            <button className={styles.restartBtn} onClick={flap}>Ещё раз</button>
          </div>
        </div>
      )}

      {state === "dead" && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2>💥 Упал!</h2>
            <p>{score} / {WIN_SCORE} • Рекорд {best}</p>
            <button className={styles.playBtn} onClick={flap}>Ещё попытка</button>
            <Link to="/magnum/games" className={styles.backInline}>← К играм</Link>
          </div>
        </div>
      )}
    </div>
  );
}
