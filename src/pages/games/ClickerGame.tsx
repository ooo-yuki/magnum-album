import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import styles from "./ClickerGame.module.css";

const PRESAVE = "https://music.thefence.me/psmagnum";
const TARGET = 42;
const TIME = 10;

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
      y: -20 - Math.random() * 250,
      vx: (Math.random() - 0.5) * 9,
      vy: 2.5 + Math.random() * 7,
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
        p.x += p.vx; p.y += p.vy; p.vy += 0.09; p.rot += p.vr; p.vx *= 0.992;
        if (p.y < canvas.height + 30) alive++;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        // star-ish
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.55);
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

export function ClickerGame() {
  const [clicks, setClicks] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME);
  const [started, setStarted] = useState(false);
  const [won, setWon] = useState(false);
  const [lost, setLost] = useState(false);
  const [cps, setCps] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const numRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const clicksRef = useRef(0);
  const burstRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    gsap.from(`.${styles.hero} > *`, { y: 20, opacity: 0, stagger: 0.1, duration: 0.6 });
  }, []);

  const startGame = useCallback(() => {
    setStarted(true); setClicks(0); clicksRef.current = 0; setTimeLeft(TIME); setWon(false); setLost(false); setCps(0);
    const start = Date.now();
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          // check win before losing
          if (clicksRef.current >= TARGET) {
            setWon(true); setStarted(false);
          } else {
            setLost(true); setStarted(false);
          }
          return 0;
        }
        const elapsed = (Date.now() - start) / 1000;
        setCps(elapsed > 0 ? clicksRef.current / elapsed : 0);
        return t - 1;
      });
    }, 1000);
  }, []);

  const handleClick = () => {
    if (!started || won || lost) return;
    const next = clicks + 1;
    clicksRef.current = next;
    setClicks(next);
    if (numRef.current) gsap.fromTo(numRef.current, { scale: 1.35 }, { scale: 1, duration: 0.14, ease: "back.out(2)" });
    if (btnRef.current) {
      gsap.fromTo(btnRef.current, { scale: 0.96 }, { scale: 1, duration: 0.12, ease: "power1.out" });
      // ripple burst
      if (burstRef.current) {
        const dot = document.createElement("span");
        dot.textContent = "+1";
        dot.style.cssText = `position:absolute;left:${50 + (Math.random() - 0.5) * 30}%;top:${30 + Math.random() * 20}%;font-weight:900;font-size:1rem;color:#fff;pointer-events:none;text-shadow:0 0 8px rgba(0,0,0,0.8);`;
        burstRef.current.appendChild(dot);
        gsap.to(dot, { y: -40, opacity: 0, scale: 1.2, duration: 0.6, ease: "power1.out", onComplete: () => dot.remove() });
      }
    }
    if (next >= TARGET) {
      if (timerRef.current) clearInterval(timerRef.current);
      setWon(true); setStarted(false);
    }
  };

  const restart = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setClicks(0); clicksRef.current = 0; setTimeLeft(TIME); setStarted(false); setWon(false); setLost(false); setCps(0);
  };

  const progress = Math.min((clicks / TARGET) * 100, 100);
  const isDanger = timeLeft <= 3 && started;

  return (
    <div className={styles.page} ref={ref}>
      <Confetti active={won} />
      <div className={styles.hero}>
        <h1>Кликер 42</h1>
        <p>Нажми {TARGET} раз за {TIME} секунд • CPS: {cps.toFixed(1)}</p>
      </div>

      <div className={styles.gameArea} style={{ position: "relative" }}>
        <div className={styles.stats}>
          <div className={styles.stat} style={{ background: clicks >= TARGET ? "rgba(0,255,136,0.08)" : undefined, borderRadius: 12, padding: "6px 12px", border: clicks >= TARGET ? "1px solid rgba(0,255,136,0.2)" : "1px solid transparent" }}>
            <span className={styles.statLabel}>Клики</span>
            <span className={styles.statValue} style={{ color: progress > 80 ? "#ffcc00" : undefined }}>{clicks}/{TARGET}</span>
          </div>
          <div className={styles.stat} style={{ background: isDanger ? "rgba(255,45,85,0.1)" : "rgba(255,255,255,0.04)", borderRadius: 12, padding: "6px 12px", border: isDanger ? "1px solid rgba(255,45,85,0.25)" : "1px solid rgba(255,255,255,0.06)" }}>
            <span className={styles.statLabel}>Время</span>
            <span className={`${styles.statValue} ${isDanger ? styles.danger : ""}`} style={{ display: "inline-block" }}>{timeLeft}с</span>
          </div>
        </div>

        <div className={styles.progress} style={{ height: 8, border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className={styles.progressFill} style={{ width: `${progress}%`, background: progress >= 100 ? "linear-gradient(90deg,#00ff88,#ffcc00)" : "var(--gradient)", boxShadow: progress > 70 ? "0 0 12px rgba(255,45,85,0.6)" : undefined, transition: "width 0.12s" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 16, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          <span>0</span><span style={{ color: progress >= 50 ? "#ffcc00" : undefined }}>21</span><span style={{ color: progress >= 100 ? "#00ff88" : undefined }}>42 ✓</span>
        </div>

        {!started && !won && !lost && (
          <button className={styles.startBtn} onClick={startGame} style={{ boxShadow: "0 0 32px rgba(255,45,85,0.45), 0 0 0 1px rgba(255,255,255,0.06) inset" }}>Начать!</button>
        )}

        {started && (
          <div style={{ position: "relative", display: "flex", justifyContent: "center" }} ref={burstRef as unknown as React.RefObject<HTMLDivElement>}>
            <button
              ref={btnRef}
              className={styles.clickBtn}
              onClick={handleClick}
              style={{
                background: `radial-gradient(circle at 30% 30%, #ff5a7a, var(--accent))`,
                boxShadow: "0 0 44px rgba(255,45,85,0.55), 0 0 0 1px rgba(255,255,255,0.1) inset, 0 8px 24px rgba(0,0,0,0.4)",
                position: "relative", overflow: "hidden",
              }}
            >
              <div className={styles.clickNum} ref={numRef} style={{ textShadow: "0 2px 10px rgba(0,0,0,0.35)" }}>{clicks}</div>
              <div className={styles.clickLabel} style={{ letterSpacing: "0.12em" }}>ЖМИ!</div>
              <span style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.22), transparent 60%)", pointerEvents: "none" }} />
            </button>
          </div>
        )}

        {won && (
          <div className={styles.win} style={{ background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.18)", borderRadius: 16, padding: "1.2rem" }}>
            <h2>🎉 Победа!</h2>
            <p>{TARGET} кликов за {TIME - timeLeft} секунд • CPS {(TARGET / Math.max(1, TIME - timeLeft)).toFixed(1)}</p>
            <a href={PRESAVE} target="_blank" rel="noreferrer" className={styles.presaveBtn}>Пресейв MAGNUM →</a>
            <button onClick={restart} className={styles.restartBtn}>Ещё раз</button>
          </div>
        )}

        {lost && (
          <div className={styles.lose} style={{ background: "rgba(255,45,85,0.06)", border: "1px solid rgba(255,45,85,0.18)", borderRadius: 16, padding: "1.2rem" }}>
            <h2>Не успел! 😤</h2>
            <p>Кликов: {clicks}/{TARGET} • ещё {TARGET - clicks} до победы</p>
            <button onClick={restart} className={styles.restartBtn}>Попробовать снова</button>
          </div>
        )}
      </div>

      <Link to="/magnum/games" className={styles.back}>← К играм</Link>
    </div>
  );
}
