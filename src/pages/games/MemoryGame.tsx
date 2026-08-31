import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import styles from "./MemoryGame.module.css";

const PRESAVE = "https://music.thefence.me/psmagnum";
const SYMBOLS = ["🪼", "🧥", "🕶️", "🍄", "⛓️", "🎵", "4️⃣", "2️⃣"];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
interface Card { id: number; symbol: string; flipped: boolean; matched: boolean; }

// Confetti hook component
function Confetti({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!active || !ref.current) return;
    const canvas = ref.current;
    const ctx = canvas.getContext("2d")!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ["#ff2d55", "#ffcc00", "#00ff88", "#5865f2", "#fff"];
    type P = { x: number; y: number; vx: number; vy: number; r: number; c: string; rot: number; vr: number; life: number };
    const parts: P[] = Array.from({ length: 140 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 200,
      vx: (Math.random() - 0.5) * 8,
      vy: 2 + Math.random() * 6,
      r: 4 + Math.random() * 7,
      c: colors[Math.floor(Math.random() * colors.length)]!,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
      life: 1,
    }));
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = 0;
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.rot += p.vr;
        p.vx *= 0.99;
        if (p.y < canvas.height + 20) alive++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.globalAlpha = Math.max(0, 1 - (p.y / canvas.height) * 0.2);
        // rect confetti
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
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

export function MemoryGame() {
  const [cards, setCards] = useState<Card[]>(() =>
    shuffle([...SYMBOLS, ...SYMBOLS]).map((s, i) => ({ id: i, symbol: s, flipped: false, matched: false }))
  );
  const [first, setFirst] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [won, setWon] = useState(false);
  const [moves, setMoves] = useState(0);
  const [pairs, setPairs] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    gsap.from(`.${styles.grid} .${styles.card}`, { scale: 0.8, opacity: 0, stagger: 0.03, duration: 0.4, ease: "back.out(1.4)", delay: 0.2 });
  }, []);

  const handleClick = (id: number) => {
    if (locked || cards[id]!.flipped || cards[id]!.matched) return;
    const next = cards.map((c) => (c.id === id ? { ...c, flipped: true } : c));
    setCards(next);
    // flip animation
    const el = gridRef.current?.querySelectorAll(`.${styles.card}`)[id] as HTMLElement | undefined;
    if (el) gsap.fromTo(el, { scale: 0.9, rotationY: 70 }, { scale: 1, rotationY: 0, duration: 0.28, ease: "back.out(1.5)" });

    if (first === null) {
      setFirst(id);
    } else {
      setLocked(true);
      setMoves((m) => m + 1);
      const a = next[first]!; const b = next[id]!;
      if (a.symbol === b.symbol) {
        const matched = next.map((c) => c.symbol === a.symbol ? { ...c, matched: true } : c);
        setCards(matched);
        setPairs(p => p + 1);
        setFirst(null); setLocked(false);
        // success pulse
        if (el) gsap.to(el, { scale: 1.08, duration: 0.15, yoyo: true, repeat: 1 });
        const target = gridRef.current?.querySelectorAll(`.${styles.card}`)[first] as HTMLElement | undefined;
        if (target) gsap.to(target, { scale: 1.08, duration: 0.15, yoyo: true, repeat: 1 });
        if (matched.every((c) => c.matched)) setTimeout(() => setWon(true), 300);
      } else {
        // mismatch shake
        const el2 = gridRef.current?.querySelectorAll(`.${styles.card}`)[id] as HTMLElement | undefined;
        const el1 = gridRef.current?.querySelectorAll(`.${styles.card}`)[first] as HTMLElement | undefined;
        if (el1 && el2) {
          gsap.to([el1, el2], { x: 4, duration: 0.06, yoyo: true, repeat: 5, ease: "power1.inOut", onComplete: () => gsap.set([el1, el2], { x: 0 }) });
        }
        setTimeout(() => {
          setCards((prev) => prev.map((c) => c.id === first || c.id === id ? { ...c, flipped: false } : c));
          setFirst(null); setLocked(false);
        }, 750);
      }
    }
  };

  const restart = useCallback(() => {
    const shuffled = shuffle([...SYMBOLS, ...SYMBOLS]).map((s, i) => ({ id: i, symbol: s, flipped: false, matched: false }));
    setCards(shuffled); setFirst(null); setLocked(false); setWon(false); setMoves(0); setPairs(0);
    setTimeout(() => {
      if (!gridRef.current) return;
      gsap.from(`.${styles.grid} .${styles.card}`, { scale: 0.85, opacity: 0, stagger: 0.02, duration: 0.35, ease: "back.out(1.4)" });
    }, 50);
  }, []);

  return (
    <div className={styles.page} ref={ref}>
      <Confetti active={won} />
      <h1 style={{ background: "var(--gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Память 42</h1>
      <p className={styles.info} style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
        <span style={{ background: "rgba(255,255,255,0.06)", padding: "4px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.08)" }}>Ходы: <b style={{ color: "#fff" }}>{moves}</b></span>
        <span style={{ background: "rgba(0,255,136,0.08)", padding: "4px 10px", borderRadius: 999, border: "1px solid rgba(0,255,136,0.18)", color: "#00ff88" }}>Пары: {pairs}/8</span>
        <span style={{ background: "rgba(255,45,85,0.08)", padding: "4px 10px", borderRadius: 999, border: "1px solid rgba(255,45,85,0.18)", color: "#ff2d55" }}>{Math.round((pairs / 8) * 100)}%</span>
      </p>
      <div className={styles.grid} ref={gridRef} style={{ perspective: 800 }}>
        {cards.map((c) => (
          <button
            key={c.id}
            className={`${styles.card} ${c.flipped || c.matched ? styles.flipped : ""} ${c.matched ? styles.matched : ""}`}
            onClick={() => handleClick(c.id)}
            style={{
              boxShadow: c.matched ? "0 0 18px rgba(0,255,136,0.35)" : c.flipped ? "0 0 14px rgba(255,45,85,0.35)" : undefined,
              transform: c.flipped || c.matched ? "scale(1.02)" : undefined,
            } as React.CSSProperties}
          >
            <span style={{ display: "inline-block", transform: c.flipped || c.matched ? "scale(1)" : "scale(0.85)", transition: "transform 0.22s" }}>
              {c.flipped || c.matched ? c.symbol : "?"}
            </span>
          </button>
        ))}
      </div>

      {/* progress */}
      <div style={{ maxWidth: 360, margin: "1.2rem auto 0", height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ width: `${(pairs / 8) * 100}%`, height: "100%", background: "var(--gradient)", transition: "width 0.4s", boxShadow: pairs === 8 ? "0 0 10px rgba(0,255,136,0.7)" : undefined }} />
      </div>

      {won && (
        <div className={styles.win}>
          <div className={styles.winCard} style={{ boxShadow: "0 0 40px rgba(255,45,85,0.25), 0 0 80px rgba(88,101,242,0.18)", border: "1px solid rgba(255,255,255,0.12)" }}>
            <h2>🎉 Победа!</h2>
            <p>Ходы: {moves} • Пары 8/8</p>
            <a href={PRESAVE} target="_blank" rel="noreferrer" className={styles.presaveBtn}>Пресейв MAGNUM →</a>
            <button onClick={restart} className={styles.restartBtn}>Ещё раз</button>
          </div>
        </div>
      )}
      <div className={styles.nav}>
        <Link to="/magnum/games" className={styles.back}>← К играм</Link>
        <button onClick={restart} className={styles.restartBtn}>Заново</button>
      </div>
    </div>
  );
}
