import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./MemoryGame.module.css";
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
const SYMBOLS = ["🪼", "🧥", "🕶️", "🍄", "⛓️", "🎵", "4️⃣", "2️⃣"] as const;
const WIN_SCORE = 4200;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

interface Card {
  id: number;
  symbol: string;
  flipped: boolean;
  matched: boolean;
}

// ---------- WebAudio ----------
let ac: AudioContext | null = null;
function ensureAC(): AudioContext | null {
  if (!ac) {
    try {
      const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      ac = new Ctx();
    } catch {
      return null;
    }
  }
  if (ac.state === "suspended") void ac.resume();
  return ac;
}
function safeRamp(param: AudioParam, fn: () => void, fallback: number) {
  try { fn(); } catch { param.value = fallback; }
}
function playFlip() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "sine"; o.frequency.value = 420;
  safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(680, ctx.currentTime + 0.07), 680);
  g.gain.setValueAtTime(0.14, ctx.currentTime);
  safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.14);
}
function playMatch() {
  const ctx = ensureAC(); if (!ctx) return;
  [0, 0.09].forEach((d, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.value = i === 0 ? 660 : 880;
    safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(i === 0 ? 780 : 1100, ctx.currentTime + d + 0.08), 1100);
    g.gain.setValueAtTime(0.18, ctx.currentTime + d);
    safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.22), 0.001);
    o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.22);
  });
}
function playMiss() {
  const ctx = ensureAC(); if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "square"; o.frequency.value = 160;
  safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.12), 110);
  g.gain.setValueAtTime(0.11, ctx.currentTime);
  safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18), 0.001);
  o.start(); o.stop(ctx.currentTime + 0.18);
}
function playWin() {
  const ctx = ensureAC(); if (!ctx) return;
  [0, 0.14, 0.28, 0.42].forEach((d, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.value = 523 + i * 110;
    g.gain.setValueAtTime(0.16, ctx.currentTime + d);
    safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.5), 0.001);
    o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.5);
  });
}

// ---------- Confetti (win) ----------
function Confetti({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!active || !ref.current) return;
    const canvas = ref.current;
    const ctx = canvas.getContext("2d")!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ["#ff2d55", "#ffcc00", "#00ff88", "#5865f2", "#fff"];
    type P = { x: number; y: number; vx: number; vy: number; r: number; c: string; rot: number; vr: number };
    const parts: P[] = Array.from({ length: 160 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 280,
      vx: (Math.random() - 0.5) * 8,
      vy: 2 + Math.random() * 6,
      r: 5 + Math.random() * 7,
      c: colors[Math.floor(Math.random() * colors.length)]!,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.35,
    }));
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = 0;
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.09; p.rot += p.vr; p.vx *= 0.991;
        if (p.y < canvas.height + 24) alive++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.globalAlpha = Math.max(0, 1 - (p.y / canvas.height) * 0.18);
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.62);
        ctx.restore();
      }
      if (alive > 0) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const onResize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, [active]);
  if (!active) return null;
  return <canvas ref={ref} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 300 }} />;
}

// ---------- Match particles (burst per pair) ----------
type Burst = { x: number; y: number; id: number };
function BurstLayer({ bursts, onDone }: { bursts: Burst[]; onDone: (id: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (bursts.length === 0) return;
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const upd = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    upd();
    window.addEventListener("resize", upd);
    type P2 = { x: number; y: number; vx: number; vy: number; r: number; life: number; c: string };
    const colors = ["#00ff88", "#ffcc00", "#ff2d55", "#fff", "#5865f2"];
    const all: P2[] = [];
    for (const b of bursts) {
      for (let i = 0; i < 22; i++) {
        const ang = (Math.PI * 2 * i) / 22 + Math.random() * 0.3;
        const sp = 3 + Math.random() * 7;
        all.push({ x: b.x, y: b.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - Math.random() * 2, r: 3 + Math.random() * 4, life: 1, c: colors[Math.floor(Math.random() * colors.length)]! });
      }
    }
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let any = false;
      for (const p of all) {
        if (p.life <= 0) continue;
        p.x += p.vx; p.y += p.vy; p.vy += 0.28; p.vx *= 0.98; p.life -= 0.018;
        if (p.life > 0) any = true;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (any) raf = requestAnimationFrame(draw);
      else bursts.forEach((b) => onDone(b.id));
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", upd); };
  }, [bursts, onDone]);
  if (bursts.length === 0) return null;
  return <canvas ref={ref} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 150 }} />;
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function MemoryGame() {
  const [cards, setCards] = useState<Card[]>(() =>
    shuffle([...SYMBOLS, ...SYMBOLS]).map((s, i) => ({ id: i, symbol: s, flipped: false, matched: false }))
  );
  const [first, setFirst] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [won, setWon] = useState(false);
  const [moves, setMoves] = useState(0);
  const [pairs, setPairs] = useState(0);
  const [sec, setSec] = useState(0);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [scoreBump, setScoreBump] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const burstIdRef = useRef(0);

  // intro
  useEffect(() => {
    if (!ref.current) return;
    gsap.from(`.${styles.grid} .${styles.card}`, { scale: 0.8, opacity: 0, stagger: 0.12, duration: 0.45, ease: "back.out(1.4)", delay: 0.18 });
  }, []);

  // timer
  useEffect(() => {
    if (won) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      return;
    }
    if (!startedRef.current) return;
    timerRef.current = window.setInterval(() => setSec((s) => s + 1), 1000);
  
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

  return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [won, startedRef.current]);

  // start timer on first flip
  const ensureTimer = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => setSec((s) => s + 1), 1000);
  }, []);

  const triggerBurstAt = useCallback((el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const id = ++burstIdRef.current;
    setBursts((prev) => [...prev, { x, y, id }]);
  }, []);

  const handleClick = (id: number) => {
    if (locked || won) return;
    const c = cards[id];
    if (!c || c.flipped || c.matched) return;
    ensureTimer();
    playFlip();
    const next = cards.map((card) => (card.id === id ? { ...card, flipped: true } : card));
    setCards(next);
    const el = gridRef.current?.querySelectorAll(`.${styles.card}`)[id] as HTMLElement | undefined;
    if (el) gsap.fromTo(el, { scale: 0.92, rotationY: 60 }, { scale: 1, rotationY: 0, duration: 0.28, ease: "back.out(1.5)" });

    if (first === null) {
      setFirst(id);
    } else {
      setLocked(true);
      setMoves((m) => m + 1);
      const a = next[first]!;
      const b = next[id]!;
      if (a.symbol === b.symbol) {
        // match
        playMatch();
        const matched = next.map((card) => (card.symbol === a.symbol ? { ...card, matched: true } : card));
        setCards(matched);
        setPairs((p) => p + 1);
        setFirst(null);
        setLocked(false);
        if (el) {
          gsap.to(el, { scale: 1.1, duration: 0.14, yoyo: true, repeat: 1, ease: "power1.out" });
          triggerBurstAt(el);
        }
        const target = gridRef.current?.querySelectorAll(`.${styles.card}`)[first] as HTMLElement | undefined;
        if (target) {
          gsap.to(target, { scale: 1.1, duration: 0.14, yoyo: true, repeat: 1, ease: "power1.out" });
          setTimeout(() => triggerBurstAt(target), 40);
        }
        // score bump anim
        setScoreBump(true);
        setTimeout(() => setScoreBump(false), 280);
        if (matched.every((card) => card.matched)) {
          setTimeout(() => {
            setWon(true);
            playWin();
            if (gridRef.current) gsap.to(gridRef.current, { scale: 1.02, duration: 0.2, yoyo: true, repeat: 1 });
          }, 380);
        }
      } else {
        // mismatch — shake + miss sound
        playMiss();
        const el2 = gridRef.current?.querySelectorAll(`.${styles.card}`)[id] as HTMLElement | undefined;
        const el1 = gridRef.current?.querySelectorAll(`.${styles.card}`)[first] as HTMLElement | undefined;
        if (el1 && el2) {
          gsap.to([el1, el2], { x: 6, duration: 0.06, yoyo: true, repeat: 5, ease: "power1.inOut", onComplete: () => gsap.set([el1, el2], { x: 0 }) });
          // also shake whole grid subtly
          if (gridRef.current) gsap.to(gridRef.current, { x: 3, duration: 0.05, yoyo: true, repeat: 3, onComplete: () => gsap.set(gridRef.current!, { x: 0 }) });
        }
        setTimeout(() => {
          setCards((prev) => prev.map((card) => (card.id === first || card.id === id ? { ...card, flipped: false } : card)));
          setFirst(null);
          setLocked(false);
        }, 740);
      }
    }
  };

  const restart = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    startedRef.current = false;
    const shuffled = shuffle([...SYMBOLS, ...SYMBOLS]).map((s, i) => ({ id: i, symbol: s, flipped: false, matched: false }));
    setCards(shuffled);
    setFirst(null);
    setLocked(false);
    setWon(false);
    setMoves(0);
    setPairs(0);
    setSec(0);
    setBursts([]);
    setScoreBump(false);
    setTimeout(() => {
      if (!gridRef.current) return;
      gsap.from(`.${styles.grid} .${styles.card}`, { scale: 0.85, opacity: 0, stagger: 0.02, duration: 0.36, ease: "back.out(1.4)" });
    }, 40);
  }, []);

  const progress = (pairs / 8) * 100;

  return (
    <div className={styles.page} ref={ref} style={{ position: "relative" }}>
      <Confetti active={won} />
      <BurstLayer bursts={bursts} onDone={(id) => setBursts((prev) => prev.filter((b) => b.id !== id))} />
      <h1 style={{ background: "var(--gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
        Память 42
      </h1>
      <p style={{ color: "rgba(240,240,240,0.52)", marginBottom: 10, fontSize: "0.92rem" }}>Найди все 8 пар — чем быстрее, тем круче</p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <span style={{ background: "rgba(255,255,255,0.06)", padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.08)", fontSize: "0.9rem" }}>
          ⏱ <b style={{ color: "#fff", fontVariantNumeric: "tabular-nums" }}>{fmtTime(sec)}</b>
        </span>
        <span style={{ background: "rgba(255,255,255,0.06)", padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.08)", fontSize: "0.9rem" }}>
          Ходы: <b style={{ color: "#fff" }}>{moves}</b>
        </span>
        <span
          style={{
            background: scoreBump ? "rgba(0,255,136,0.18)" : "rgba(0,255,136,0.08)",
            padding: "6px 12px",
            borderRadius: 999,
            border: "1px solid rgba(0,255,136,0.18)",
            color: "#00ff88",
            fontSize: "0.9rem",
            transform: scoreBump ? "scale(1.08)" : "scale(1)",
            transition: "transform 0.18s, background 0.18s",
            display: "inline-block",
          }}
        >
          Пары: {pairs}/8
        </span>
        <span style={{ background: "rgba(255,45,85,0.08)", padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(255,45,85,0.18)", color: "#ff2d55", fontSize: "0.9rem" }}>
          {Math.round(progress)}%
        </span>
      </div>

      <div className={styles.grid} ref={gridRef} style={{ perspective: 900 }}>
        {cards.map((c) => (
          <button
            key={c.id}
            aria-label={c.flipped || c.matched ? c.symbol : "закрыто"}
            className={`${styles.card} ${c.flipped || c.matched ? styles.flipped : ""} ${c.matched ? styles.matched : ""}`}
            onClick={() => handleClick(c.id)}
            style={{
              boxShadow: c.matched ? "0 0 18px rgba(0,255,136,0.38)" : c.flipped ? "0 0 14px rgba(255,45,85,0.32)" : undefined,
              transform: c.flipped || c.matched ? "scale(1.02)" : undefined,
            } as React.CSSProperties}
          >
            <span style={{ display: "inline-block", transform: c.flipped || c.matched ? "scale(1)" : "scale(0.82)", transition: "transform 0.22s", fontSize: "1.7rem" }}>
              {c.flipped || c.matched ? c.symbol : "?"}
            </span>
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 360, margin: "1.15rem auto 0", height: 7, background: "rgba(255,255,255,0.07)", borderRadius: 999, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ width: `${progress}%`, height: "100%", background: "var(--gradient)", transition: "width 0.42s cubic-bezier(0.22,1,0.36,1)", boxShadow: pairs === 8 ? "0 0 14px rgba(0,255,136,0.7)" : undefined }} />
      </div>
      <div style={{ maxWidth: 360, margin: "0.4rem auto 0", display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.34)", letterSpacing: "0.06em", textTransform: "uppercase", padding: "0 2px" as unknown as string }}>
        <span>0</span><span>4 пары</span><span>8 ✓</span>
      </div>

      {won && (
        <div className={styles.win}>
          <div className={styles.winCard} style={{ boxShadow: "0 0 44px rgba(255,45,85,0.22), 0 0 80px rgba(88,101,242,0.16)", border: "1px solid rgba(255,255,255,0.12)", maxWidth: 420 }}>
            <h2>🎉 Победа!</h2>
            <p style={{ fontSize: "1.05rem", marginBottom: 6 }}>
              <b style={{ color: "#ffcc00", fontSize: "1.35rem" }}>{WIN_SCORE}</b> очков • {moves} ходов • {fmtTime(sec)}
            </p>
            <p style={{ fontSize: "0.88rem", color: "rgba(240,240,240,0.58)", marginBottom: 16 }}>Пары 8/8 • Точность {moves > 0 ? Math.round((8 / moves) * 100) : 100}%</p>
            <a href={PRESAVE} target="_blank" rel="noreferrer" className={styles.presaveBtn} style={{ display: "block", textAlign: "center" }}>
              Пресейв MAGNUM →
            </a>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginTop: 8, letterSpacing: "0.04em" }}>победа {WIN_SCORE} → пресейв</p>
            <button onClick={restart} className={styles.restartBtn} style={{ marginTop: 10, width: "100%" }}>
              Ещё раз
            </button>
          </div>
        </div>
      )}

      <div className={styles.nav}>
        <Link to="/magnum/games" className={styles.back}>
          ← К играм
        </Link>
        <button onClick={restart} className={styles.restartBtn}>
          Заново
        </button>
      </div>
    </div>
  );
}