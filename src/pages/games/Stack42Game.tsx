import { useRef, useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import styles from "./Stack42Game.module.css";

const PRESAVE = "https://music.thefence.me/psmagnum";
const WIN_HEIGHT = 15; // 15 floors wins (42-themed)
const BLOCK_H = 22;
const BASE_W = 220;
const SPEED_BASE = 2.2;
const SPEED_INC = 0.12;

interface Block {
  x: number;
  y: number;
  w: number;
  color: string;
}
interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; color: string; size: number;
}
interface Floating {
  id: number; text: string; x: number; y: number; life: number;
}

function blockColor(idx: number): string {
  const palette = ["#ff2d55", "#ff6b35", "#ffcc00", "#00ff88", "#00d4ff", "#5865f2", "#a855f7", "#ff2d9a"];
  // gradient interpolation between palette stops
  const t = (idx % 24) / 24;
  const a = palette[Math.floor(t * palette.length) % palette.length]!;
  const b = palette[(Math.floor(t * palette.length) + 1) % palette.length]!;
  // simple mix by luma: pick a, but shift hue by idx
  void b;
  return a;
}

let ac: AudioContext | null = null;
function ensureAC() {
  if (!ac) try { ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { return null; }
  if (ac && ac.state === "suspended") void ac.resume();
  return ac;
}
function playDrop(ok: boolean, perfect: boolean) {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  if (!ok) { o.type = "square"; o.frequency.value = 120; g.gain.setValueAtTime(0.18, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35); o.frequency.linearRampToValueAtTime(60, ctx.currentTime + 0.2); }
  else if (perfect) { o.type = "sine"; o.frequency.value = 880; o.frequency.linearRampToValueAtTime(1320, ctx.currentTime + 0.12); g.gain.setValueAtTime(0.2, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35); }
  else { o.type = "triangle"; o.frequency.value = 420 + Math.random() * 80; g.gain.setValueAtTime(0.14, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18); }
  o.start(); o.stop(ctx.currentTime + 0.4);
}
function playWin() {
  const ctx = ensureAC(); if (!ctx) return;
  [0, 0.12, 0.24, 0.36].forEach((d, i) => {
    const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.value = 440 + i * 110; g.gain.setValueAtTime(0.14, ctx.currentTime + d); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.4); o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.4);
  });
}

export function Stack42Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"menu" | "playing" | "win" | "over">("menu");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem("stack42-best")) || 0; } catch { return 0; } });
  const [perfectStreak, setPerfectStreak] = useState(0);

  const blocksRef = useRef<Block[]>([]);
  const movingRef = useRef<{ x: number; w: number; dir: number; speed: number }>({ x: 0, w: BASE_W, dir: 1, speed: SPEED_BASE });
  const particlesRef = useRef<Particle[]>([]);
  const floatsRef = useRef<Floating[]>([]);
  const camYRef = useRef(0);
  const targetCamYRef = useRef(0);
  const animRef = useRef(0);
  const floatIdRef = useRef(0);
  const shakeRef = useRef(0);
  const bgPhaseRef = useRef(0);

  const reset = useCallback(() => {
    const base: Block = { x: 0, y: 0, w: BASE_W, color: "#1a1a2e" };
    blocksRef.current = [base];
    movingRef.current = { x: -BASE_W * 0.2, w: BASE_W, dir: 1, speed: SPEED_BASE };
    particlesRef.current = []; floatsRef.current = [];
    camYRef.current = 0; targetCamYRef.current = 0; shakeRef.current = 0; bgPhaseRef.current = 0;
    setScore(0); setPerfectStreak(0);
  }, []);

  const start = useCallback(() => { reset(); setState("playing"); }, [reset]);

  const drop = useCallback(() => {
    if (state !== "playing") return;
    const blocks = blocksRef.current;
    const top = blocks[blocks.length - 1]!;
    const m = movingRef.current;
    const overlapL = Math.max(top.x, m.x);
    const overlapR = Math.min(top.x + top.w, m.x + m.w);
    const overlap = overlapR - overlapL;
    const isPerfect = Math.abs(m.x - top.x) < 5 && Math.abs(m.w - top.w) < 3;

    if (overlap <= 0) {
      // miss - falling piece
      for (let i = 0; i < 16; i++) {
        particlesRef.current.push({ x: m.x + m.w / 2, y: blocks.length * BLOCK_H, vx: (Math.random() - 0.5) * 8, vy: -Math.random() * 6 - 1, life: 1, color: blockColor(blocks.length), size: 3 + Math.random() * 4 });
      }
      shakeRef.current = 14;
      playDrop(false, false);
      setState("over");
      const h = blocks.length - 1;
      const nb = Math.max(best, h); setBest(nb);
      try { localStorage.setItem("stack42-best", String(nb)); } catch {}
      return;
    }

    if (isPerfect) {
      // perfect keeps full width
      const nb: Block = { x: top.x, y: blocks.length * BLOCK_H, w: top.w, color: blockColor(blocks.length) };
      blocks.push(nb);
      setPerfectStreak((s) => s + 1);
      const ps = perfectStreak + 1;
      floatsRef.current.push({ id: floatIdRef.current++, text: ps >= 3 ? `PERFECT x${ps} 🔥` : "PERFECT!", x: 0, y: nb.y + BLOCK_H / 2, life: 1 });
      // confetti burst
      for (let i = 0; i < 10; i++) particlesRef.current.push({ x: 0, y: nb.y, vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 4 - 1, life: 1, color: "#ffcc00", size: 2 + Math.random() * 3 });
      playDrop(true, true);
    } else {
      // cut
      const nb: Block = { x: overlapL, y: blocks.length * BLOCK_H, w: overlap, color: blockColor(blocks.length) };
      // debris for cut part
      const cutW = m.w - overlap;
      if (cutW > 2) {
        const debrisX = m.x < top.x ? m.x + cutW / 2 : overlapR + cutW / 2;
        for (let i = 0; i < 8; i++) particlesRef.current.push({ x: debrisX, y: blocks.length * BLOCK_H, vx: (m.x < top.x ? -1 : 1) * (1 + Math.random() * 3) + (Math.random() - 0.5) * 2, vy: -Math.random() * 2, life: 1, color: "rgba(255,255,255,0.7)", size: 2 + Math.random() * 3 });
      }
      blocks.push(nb);
      setPerfectStreak(0);
      floatsRef.current.push({ id: floatIdRef.current++, text: overlap < top.w * 0.6 ? "Аккуратно!" : "OK", x: 0, y: nb.y, life: 1 });
      playDrop(true, false);
    }

    const h = blocks.length - 1;
    setScore(h);
    const nextW = blocks[blocks.length - 1]!.w;
    // prepare next moving block from alternating side
    const fromLeft = blocks.length % 2 === 0;
    movingRef.current = { x: fromLeft ? -nextW - 40 : 40, w: nextW, dir: fromLeft ? 1 : -1, speed: SPEED_BASE + h * SPEED_INC };
    targetCamYRef.current = Math.max(0, h * BLOCK_H - 220);
    if (h >= WIN_HEIGHT) {
      playWin();
      for (let i = 0; i < 36; i++) particlesRef.current.push({ x: (Math.random() - 0.5) * 180, y: h * BLOCK_H, vx: (Math.random() - 0.5) * 7, vy: -Math.random() * 7 - 2, life: 1, color: ["#ff2d55", "#ffcc00", "#00ff88", "#5865f2"][i % 4]!, size: 3 + Math.random() * 4 });
      const nb = Math.max(best, h); setBest(nb);
      try { localStorage.setItem("stack42-best", String(nb)); } catch {}
      setState("win");
    }
  }, [state, best, perfectStreak]);

  // input: canvas tap / space
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === "Space") { e.preventDefault(); drop(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drop]);

  // canvas loop
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const DPR = window.devicePixelRatio || 1;

    const resize = () => {
      const pw = canvas.parentElement?.clientWidth || 400;
      const w = Math.min(pw, 420);
      canvas.width = w * DPR; canvas.height = 560 * DPR;
      canvas.style.width = w + "px"; canvas.style.height = "560px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const w = parseFloat(canvas.style.width) || 400;
      const h = 560;
      const centerX = w / 2;

      // update moving
      if (state === "playing") {
        const m = movingRef.current;
        m.x += m.dir * m.speed;
        // bounce within bounds based on current w
        const limitL = -w * 0.35;
        const limitR = w * 0.35 + (w * 0.7 - m.w);
        // simpler: bounce at edges
        if (m.x <= -m.w * 0.3) { m.x = -m.w * 0.3; m.dir = 1; }
        if (m.x + m.w >= w + m.w * 0.3) { m.x = w - m.w + m.w * 0.3; m.dir = -1; }
        void limitL; void limitR;
      }
      // camera lerp
      camYRef.current += (targetCamYRef.current - camYRef.current) * 0.08;
      if (shakeRef.current > 0) shakeRef.current *= 0.88;
      bgPhaseRef.current += 0.006;

      // BG
      ctx.clearRect(0, 0, w, h);
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#07081e"); g.addColorStop(0.6, "#1a0a2e"); g.addColorStop(1, "#2a0a1e");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      // stars
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      for (let i = 0; i < 30; i++) {
        const sx = ((i * 97) % w);
        const sy = ((i * 53 + bgPhaseRef.current * 40) % (h * 0.6));
        ctx.globalAlpha = 0.2 + Math.sin(bgPhaseRef.current * 3 + i) * 0.15 + 0.2;
        ctx.fillRect(sx, sy, 1.4, 1.4);
      }
      ctx.globalAlpha = 1;
      // subtle ground glow
      ctx.fillStyle = "rgba(255,45,85,0.06)"; ctx.fillRect(0, h * 0.72, w, h * 0.28);

      ctx.save();
      if (shakeRef.current > 0.5) ctx.translate((Math.random() - 0.5) * shakeRef.current, (Math.random() - 0.5) * shakeRef.current);
      // world transform: center + cam
      ctx.translate(centerX, h - 48 + camYRef.current);

      // draw placed blocks bottom to top
      const blocks = blocksRef.current;
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i]!;
        const y = -b.y;
        if (y < -h - 80 || y > 40) continue;
        // shadow
        ctx.fillStyle = "rgba(0,0,0,0.28)"; ctx.fillRect(b.x - 2 + 3, y + BLOCK_H - 4, b.w, 4);
        // body gradient
        const grad = ctx.createLinearGradient(b.x, y, b.x, y + BLOCK_H);
        grad.addColorStop(0, b.color); grad.addColorStop(1, adjustColor(b.color, -28));
        ctx.fillStyle = grad;
        ctx.beginPath();
        const r = 4;
        // rounded top
        ctx.moveTo(b.x + r, y); ctx.lineTo(b.x + b.w - r, y); ctx.quadraticCurveTo(b.x + b.w, y, b.x + b.w, y + r);
        ctx.lineTo(b.x + b.w, y + BLOCK_H); ctx.lineTo(b.x, y + BLOCK_H); ctx.lineTo(b.x, y + r); ctx.quadraticCurveTo(b.x, y, b.x + r, y); ctx.closePath(); ctx.fill();
        // top highlight
        ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fillRect(b.x + 6, y + 3, Math.max(0, b.w - 12), 4);
        // side line
        ctx.strokeStyle = "rgba(255,255,255,0.10)"; ctx.lineWidth = 1; ctx.strokeRect(b.x, y, b.w, BLOCK_H);
        // floor number every 3
        if (i > 0 && i % 3 === 0) {
          ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.font = "700 9px Inter, sans-serif"; ctx.textAlign = "center";
          ctx.fillText(String(i), b.x + b.w / 2, y + BLOCK_H / 2 + 3);
        }
        // 42 mark at win height preview
        if (i === WIN_HEIGHT) {
          ctx.fillStyle = "#ffcc00"; ctx.font = "900 8px Inter, sans-serif"; ctx.fillText("42", b.x + b.w / 2, y - 6);
        }
      }

      // moving block (ghost above)
      if (state === "playing" || state === "over") {
        const m = movingRef.current;
        const y = -(blocks.length * BLOCK_H);
        // dashed guide line
        ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(m.x + m.w / 2, y + BLOCK_H); ctx.lineTo(m.x + m.w / 2, 24); ctx.stroke(); ctx.setLineDash([]);
        // moving block
        const isNarrow = m.w < 60;
        ctx.shadowColor = blockColor(blocks.length); ctx.shadowBlur = isNarrow ? 10 : 16;
        const grad2 = ctx.createLinearGradient(m.x, y, m.x, y + BLOCK_H);
        const c = blockColor(blocks.length);
        grad2.addColorStop(0, c); grad2.addColorStop(1, adjustColor(c, -32));
        ctx.fillStyle = grad2;
        ctx.beginPath();
        const rr = 4;
        ctx.moveTo(m.x + rr, y); ctx.lineTo(m.x + m.w - rr, y); ctx.quadraticCurveTo(m.x + m.w, y, m.x + m.w, y + rr);
        ctx.lineTo(m.x + m.w, y + BLOCK_H); ctx.lineTo(m.x, y + BLOCK_H); ctx.lineTo(m.x, y + rr); ctx.quadraticCurveTo(m.x, y, m.x + rr, y); ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,255,255,0.22)"; ctx.fillRect(m.x + 6, y + 3, Math.max(0, m.w - 12), 4);
        ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.2; ctx.strokeRect(m.x, y, m.w, BLOCK_H);
        // perfect indicator if aligned
        const top = blocks[blocks.length - 1]!;
        if (top && Math.abs(m.x - top.x) < 12) {
          ctx.fillStyle = "rgba(255,204,0,0.85)"; ctx.font = "700 7px Inter, sans-serif"; ctx.textAlign = "center";
          ctx.fillText("◆ PERFECT ◆", m.x + m.w / 2, y - 8);
        }
      }

      // particles world space (convert to same coords: x relative to center, y inverted)
      for (const p of particlesRef.current) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.32; p.life -= 0.018;
        if (p.life <= 0) continue;
        const py = -p.y;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, py, p.size * p.life, 0, Math.PI * 2); ctx.fill();
      }
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0);
      ctx.globalAlpha = 1;

      // floating texts
      floatsRef.current = floatsRef.current.filter((f) => f.life > 0);
      for (const f of floatsRef.current) {
        f.life -= 0.014;
        f.y -= 0.6;
        const py = -f.y;
        ctx.globalAlpha = Math.max(0, f.life);
        ctx.fillStyle = f.text.includes("PERFECT") ? "#ffcc00" : "rgba(255,255,255,0.95)";
        ctx.font = `900 ${f.text.includes("PERFECT") ? 12 : 10}px Inter, sans-serif`;
        ctx.textAlign = "center"; ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.lineWidth = 3;
        ctx.strokeText(f.text, f.x, py); ctx.fillText(f.text, f.x, py);
      }
      ctx.globalAlpha = 1;

      ctx.restore();

      // vignette
      const vig = ctx.createLinearGradient(0, 0, 0, h);
      vig.addColorStop(0, "rgba(0,0,0,0.18)"); vig.addColorStop(0.5, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(0,0,0,0.35)");
      ctx.fillStyle = vig; ctx.fillRect(0, 0, w, h);

      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener("resize", resize); };
  }, [state]);

  // helper darken
  function adjustColor(hex: string, amt: number): string {
    if (!hex.startsWith("#")) return hex;
    const n = parseInt(hex.slice(1), 16);
    let r = Math.max(0, Math.min(255, (n >> 16) + amt));
    let g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
    let b = Math.max(0, Math.min(255, (n & 0xff) + amt));
    return `rgb(${r},${g},${b})`;
  }

  return (
    <div className={styles.page}>
      <h1>СТОПКА 42</h1>
      <p className={styles.sub}>Тапай чтобы ставить блок — собери {WIN_HEIGHT} этажей!</p>

      {state === "menu" && (
        <div className={styles.menu}>
          <div className={styles.rules}>
            <p>🧱 Блок едет — тапни чтобы зафиксировать</p>
            <p>✂️ Выступ срезается — башня сужается</p>
            <p>⭐ Идеально вровень = сохраняется ширина + Perfect!</p>
            <p>💥 Промах = башня падает</p>
          </div>
          <button className={styles.playBtn} onClick={start}>Начать!</button>
          <p className={styles.hint}>Пробел тоже ставит блок • Рекорд: {best} этажей</p>
          <Link to="/magnum/games" className={styles.back}>← К играм</Link>
        </div>
      )}

      {(state === "playing" || state === "over" || state === "win") && (
        <div className={styles.gameArea}>
          <div className={styles.hud}>
            <div className={styles.stat}><span>Этажей</span><strong>{score} / {WIN_HEIGHT}</strong></div>
            <div className={styles.stat}><span>Рекорд</span><strong>{best}</strong></div>
            <div className={styles.stat}><span>Ширина</span><strong>{blocksRef.current[blocksRef.current.length - 1]?.w.toFixed(0) ?? BASE_W}px</strong></div>
          </div>
          <div className={styles.progress}><div className={styles.fill} style={{ width: `${Math.min((score / WIN_HEIGHT) * 100, 100)}%` }} /></div>
          {perfectStreak >= 2 && <div className={styles.streak}>⭐ Perfect x{perfectStreak}!</div>}
          <div className={styles.canvasWrap}>
            <canvas ref={canvasRef} className={styles.canvas} onPointerDown={(e) => { e.preventDefault(); drop(); }} />
            <button className={styles.tapBtn} onPointerDown={(e) => { e.preventDefault(); drop(); }}>ТАП!</button>
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
            <h2>🏆 Башня 42 готова!</h2>
            <p>{WIN_HEIGHT} этажей • ширина финала {blocksRef.current[blocksRef.current.length - 1]?.w.toFixed(0)}px</p>
            <p className={styles.winSub}>Ты — архитектор 42!</p>
            <a href={PRESAVE} target="_blank" rel="noreferrer" className={styles.presaveBtn}>Пресейв MAGNUM →</a>
            <button className={styles.restartBtn} onClick={start}>Ещё башню</button>
          </div>
        </div>
      )}
      {state === "over" && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2>💥 Башня рухнула!</h2>
            <p>{score} / {WIN_HEIGHT} этажей • Рекорд {best}</p>
            <button className={styles.playBtn} onClick={start}>Ещё попытка</button>
            <Link to="/magnum/games" className={styles.backInline}>← К играм</Link>
          </div>
        </div>
      )}
    </div>
  );
}
