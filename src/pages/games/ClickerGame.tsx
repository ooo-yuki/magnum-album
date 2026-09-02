import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./ClickerGame.module.css";
gsap.registerPlugin(ScrollTrigger);
function prefersReducedMotion():boolean{return typeof window!=="undefined"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;}
const RGB_GLOW="0 12px 36px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,45,85,0.22), 0 0 28px rgba(255,45,85,0.22), 0 0 28px rgba(0,255,136,0.14), 0 0 32px rgba(255,204,0,0.10)";
function hoverIn(el:HTMLElement){ if(prefersReducedMotion()) return; gsap.to(el,{y: -4, boxShadow:RGB_GLOW, duration:0.3}); }
function hoverOut(el:HTMLElement){ if(prefersReducedMotion()){gsap.set(el,{clearProps:"boxShadow"});return;} gsap.to(el,{y:0, duration:0.3}); }

const PRESAVE = "https://music.thefence.me/psmagnum";
const MILESTONES = [42, 100, 420, 4200] as const;
const TARGET = 4200;
const TIME = 42;

// ── WebAudio ──
let ac: AudioContext | null = null;
function ensureAC(): AudioContext | null {
  if (!ac)
    try {
      ac = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  if (ac && ac.state === "suspended") void ac.resume();
  return ac;
}
function safeRamp(param: AudioParam, fn: () => void, fallback: number) {
  try {
    fn();
  } catch {
    param.value = fallback;
  }
}
function playClick(combo: number) {
  const ctx = ensureAC();
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g);
  g.connect(ctx.destination);
  o.type = "sine";
  const base = 420 + Math.min(combo, 15) * 28;
  o.frequency.value = base;
  safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(base * 1.28, ctx.currentTime + 0.06), base * 1.28);
  g.gain.setValueAtTime(0.13 + Math.min(combo, 10) * 0.01, ctx.currentTime);
  safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11), 0.001);
  o.start();
  o.stop(ctx.currentTime + 0.13);
}
function playCombo() {
  const ctx = ensureAC();
  if (!ctx) return;
  [0, 0.06].forEach((d, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "square";
    o.frequency.value = 660 + i * 220;
    g.gain.setValueAtTime(0.09, ctx.currentTime + d);
    safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.12), 0.001);
    o.start(ctx.currentTime + d);
    o.stop(ctx.currentTime + d + 0.14);
  });
}
function playMilestone() {
  const ctx = ensureAC();
  if (!ctx) return;
  [523, 659, 784].forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.value = f;
    g.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.09);
    safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.09 + 0.28), 0.001);
    o.start(ctx.currentTime + i * 0.09);
    o.stop(ctx.currentTime + i * 0.09 + 0.3);
  });
}
function playWin() {
  const ctx = ensureAC();
  if (!ctx) return;
  [0, 0.11, 0.22, 0.33, 0.46].forEach((d, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = i % 2 === 0 ? "sine" : "triangle";
    o.frequency.value = 392 + i * 110;
    g.gain.setValueAtTime(0.16, ctx.currentTime + d);
    safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.5), 0.001);
    o.start(ctx.currentTime + d);
    o.stop(ctx.currentTime + d + 0.55);
  });
  // bass hit
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g);
  g.connect(ctx.destination);
  o.type = "sine";
  o.frequency.value = 110;
  g.gain.setValueAtTime(0.22, ctx.currentTime);
  safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6), 0.001);
  o.start();
  o.stop(ctx.currentTime + 0.65);
}
function playLose() {
  const ctx = ensureAC();
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g);
  g.connect(ctx.destination);
  o.type = "sawtooth";
  o.frequency.value = 220;
  safeRamp(o.frequency, () => o.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.32), 110);
  g.gain.setValueAtTime(0.11, ctx.currentTime);
  safeRamp(g.gain, () => g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38), 0.001);
  o.start();
  o.stop(ctx.currentTime + 0.4);
}

// balance: инкремент ускоряет прогресс после майлстоунов
function getIncrement(clicks: number): number {
  if (clicks >= 420) return 6;
  if (clicks >= 100) return 3;
  if (clicks >= 42) return 2;
  return 1;
}
function getRank(clicks: number): string {
  if (clicks >= 4200) return "MAGNUM";
  if (clicks >= 420) return "ГОТОВ К 4200";
  if (clicks >= 100) return "РАЗГОН";
  if (clicks >= 42) return "СТАРТ ПРОЙДЕН";
  return "НАЖМИ!";
}

function Confetti({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!active || !ref.current) return;
    const canvas = ref.current;
    const ctx = canvas.getContext("2d")!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ["#ff2d55", "#ffcc00", "#00ff88", "#5865f2", "#fff", "#ff7a00"];
    type P = { x: number; y: number; vx: number; vy: number; r: number; c: string; rot: number; vr: number };
    const parts: P[] = Array.from({ length: 220 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 420,
      vx: (Math.random() - 0.5) * 10,
      vy: 2.2 + Math.random() * 7.5,
      r: 5 + Math.random() * 8,
      c: colors[Math.floor(Math.random() * colors.length)]!,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.38,
    }));
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = 0;
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.rot += p.vr;
        p.vx *= 0.991;
        if (p.y < canvas.height + 40) alive++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.globalAlpha = 0.96;
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.58);
        ctx.restore();
      }
      if (alive > 0) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const onResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [active]);
  if (!active) return null;
  return <canvas ref={ref} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 500 }} />;
}

export function ClickerGame() {
  const [clicks, setClicks] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME);
  const [started, setStarted] = useState(false);
  const [won, setWon] = useState(false);
  const [lost, setLost] = useState(false);
  const [cps, setCps] = useState(0);
  const [combo, setCombo] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [milestoneMsg, setMilestoneMsg] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const numRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const clicksRef = useRef(0);
  const burstRef = useRef<HTMLDivElement>(null);
  const lastClickRef = useRef(0);
  const comboRef = useRef(0);
  const startTimeRef = useRef(0);
  const toastRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pageRef.current) return;
    if (prefersReducedMotion()) { gsap.set(`.${styles.hero} > *`, { y: 0, opacity: 1, clearProps: "transform" }); return; }
    const ctx = gsap.context(() => {
      gsap.from(`.${styles.hero} > *`, { y: 20, opacity: 0, stagger: 0.12, duration: 0.6 });
    }, pageRef);
    return () => ctx.revert();
  }, []);

  // modal ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [])
  // GSAP spec batch
  useEffect(() => {
    const root: HTMLElement = document.querySelector<HTMLElement>("[data-gsap-root]") || (document.body as unknown as HTMLElement);
    if (!root) return;
    if (prefersReducedMotion()) { const els=root.querySelectorAll(".card"); if(els.length) gsap.set(els,{y:0,opacity:1,clearProps:"transform"}); return; }
    const ctx=gsap.context(()=>{ const cards=root.querySelectorAll<HTMLElement>(".card,[data-card],.tile"); if(cards.length){ gsap.set(cards,{y:24,opacity:0}); ScrollTrigger.batch(cards,{onEnter:(batch:any)=>gsap.to(batch,{y:0,opacity:1,stagger:0.12,duration:0.55,ease:"power2.out"}),start:"top 92%",once:true}); } }, root);
    return ()=>ctx.revert();
  }, []);

  const startGame = useCallback(() => {
    setStarted(true);
    setClicks(0);
    clicksRef.current = 0;
    setTimeLeft(TIME);
    setWon(false);
    setLost(false);
    setCps(0);
    setCombo(0);
    comboRef.current = 0;
    lastClickRef.current = 0;
    setShowModal(false);
    setMilestoneMsg(null);
    startTimeRef.current = Date.now();

    if (timerRef.current) clearInterval(timerRef.current);
    if (elapsedRef.current) clearInterval(elapsedRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          if (elapsedRef.current) clearInterval(elapsedRef.current);
          // проверяем победу trước, иначе поражение
          if (clicksRef.current >= TARGET) {
            setWon(true);
            setStarted(false);
            setShowModal(true);
            playWin();
          } else {
            setLost(true);
            setStarted(false);
            playLose();
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    elapsedRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setCps(elapsed > 0 ? clicksRef.current / elapsed : 0);
    }, 120);
  }, []);

  const spawnParticles = (count: number, inc: number) => {
    if (!burstRef.current) return;
    if (prefersReducedMotion()) return;
    const colors = ["#ff2d55", "#ffcc00", "#00ff88", "#fff", "#5865f2"];
    for (let i = 0; i < count; i++) {
      const dot = document.createElement("span");
      const isPlus = i === 0;
      dot.textContent = isPlus ? `+${inc}` : "•";
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 18 + Math.random() * 54;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist - 10;
      const col = colors[Math.floor(Math.random() * colors.length)]!;
      dot.style.cssText = `position:absolute;left:50%;top:46%;font-weight:900;font-size:${isPlus ? 16 : 10}px;color:${col};pointer-events:none;text-shadow:0 0 8px rgba(0,0,0,0.85);will-change:transform,opacity;`;
      burstRef.current.appendChild(dot);
      gsap.fromTo(dot, { x: 0, y: 0, scale: 0.4, opacity: 1 }, {
        x: dx,
        y: dy - 28,
        scale: isPlus ? 1.15 : 1,
        opacity: 0,
        duration: 0.62 + Math.random() * 0.18,
        ease: "power2.out",
        onComplete: () => dot.remove(),
      });
    }
  };

  const handleClick = () => {
    if (!started || won || lost) return;
    const inc = getIncrement(clicksRef.current);
    const prev = clicksRef.current;
    const next = prev + inc;
    clicksRef.current = next;
    setClicks(next);

    // combo: быстрые клики < 380мс
    const now = Date.now();
    const dt = now - lastClickRef.current;
    lastClickRef.current = now;
    if (dt < 380 && dt > 0) {
      comboRef.current = Math.min(comboRef.current + 1, 25);
    } else {
      comboRef.current = 0;
    }
    setCombo(comboRef.current);

    // audio
    playClick(comboRef.current);
    if (comboRef.current > 0 && comboRef.current % 7 === 0) playCombo();

    // milestone hit toast
    const hit = MILESTONES.find((m) => prev < m && next >= m);
    if (hit) {
      playMilestone();
      const msg = hit === 4200 ? "MAGNUM 4200 !" : hit === 420 ? "420 — турбо x6!" : hit === 100 ? "100 — ускорение x3!" : "42 — поехали!";
      setMilestoneMsg(msg);
      window.setTimeout(() => setMilestoneMsg(null), 1600);
      if (toastRef.current && !prefersReducedMotion()) gsap.fromTo(toastRef.current, { y: 10, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, duration: 0.25, ease: "back.out(1.7)" });
      // milestone burst extra
      spawnParticles(10, inc);
    }

    // animations: number pop + button squash
    if (numRef.current && !prefersReducedMotion()) gsap.fromTo(numRef.current, { scale: 1.38 }, { scale: 1, duration: 0.15, ease: "back.out(2.2)" });
    if (btnRef.current && !prefersReducedMotion()) {
      gsap.fromTo(btnRef.current, { scale: 0.95 }, { scale: 1, duration: 0.11, ease: "power1.out" });
    }
    // screen shake per click (лёгкий)
    if (pageRef.current && !prefersReducedMotion()) {
      gsap.to(pageRef.current, {
        x: (Math.random() - 0.5) * 4,
        y: (Math.random() - 0.5) * 2,
        duration: 0.06,
        yoyo: true,
        repeat: 1,
        ease: "power1.inOut",
        onComplete: () => gsap.set(pageRef.current!, { x: 0, y: 0 }),
      });
    }
    // particle burst
    spawnParticles(hit ? 0 : 6, inc);

    // victory
    if (next >= TARGET) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      setWon(true);
      setStarted(false);
      setShowModal(true);
      playWin();
      if (pageRef.current && !prefersReducedMotion()) gsap.to(pageRef.current, { x: 7, duration: 0.05, yoyo: true, repeat: 9, ease: "power1.inOut", onComplete: () => gsap.set(pageRef.current!, { x: 0 }) });
    }
  };

  const restart = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (elapsedRef.current) clearInterval(elapsedRef.current);
    setClicks(0);
    clicksRef.current = 0;
    setTimeLeft(TIME);
    setStarted(false);
    setWon(false);
    setLost(false);
    setCps(0);
    setCombo(0);
    comboRef.current = 0;
    setShowModal(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, []);

  const progress = Math.min((clicks / TARGET) * 100, 100);
  const isDanger = timeLeft <= 7 && started;
  const incNow = getIncrement(clicks);
  const rank = getRank(clicks);
  const nextMilestone = MILESTONES.find((m) => clicks < m) ?? TARGET;
  const toNext = nextMilestone - clicks;

  return (
    <div className={styles.page} ref={pageRef}>
      <Confetti active={won} />
      <div className={styles.hero}>
        <h1>Кликер MAGNUM</h1>
        <p>
          42 → 100 → 420 → <strong style={{ color: "#ffcc00" }}>4200</strong> • x{incNow} за клик • CPS: {cps.toFixed(1)} {combo >= 3 ? <span style={{ color: "#00ff88", fontWeight: 800 }}>COMBO x{combo}🔥</span> : null}
        </p>
      </div>

      <div className={styles.gameArea} style={{ position: "relative" }}>
        <div className={styles.stats}>
          <div
            className={styles.stat}
            style={{
              background: clicks >= 4200 ? "rgba(0,255,136,0.1)" : clicks >= 42 ? "rgba(255,204,0,0.07)" : undefined,
              borderRadius: 12,
              padding: "6px 12px",
              border: clicks >= 4200 ? "1px solid rgba(0,255,136,0.22)" : "1px solid transparent",
            }}
          >
            <span className={styles.statLabel}>Клики / {TARGET}</span>
            <span className={styles.statValue} style={{ color: progress > 82 ? "#00ff88" : progress > 40 ? "#ffcc00" : undefined }}>
              {clicks.toLocaleString("ru-RU")}
            </span>
            <span style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: "0.06em" }}>{rank}</span>
          </div>
          <div
            className={styles.stat}
            style={{
              background: isDanger ? "rgba(255,45,85,0.11)" : "rgba(255,255,255,0.04)",
              borderRadius: 12,
              padding: "6px 12px",
              border: isDanger ? "1px solid rgba(255,45,85,0.26)" : "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <span className={styles.statLabel}>Время</span>
            <span className={`${styles.statValue} ${isDanger ? styles.danger : ""}`} style={{ display: "inline-block" }}>
              {timeLeft}с
            </span>
            <span style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>до {nextMilestone.toLocaleString("ru-RU")} ещё {toNext > 0 ? toNext : 0}</span>
          </div>
        </div>

        <div className={styles.progress} style={{ height: 10, border: "1px solid rgba(255,255,255,0.09)", position: "relative", overflow: "visible" }}>
          <div
            className={styles.progressFill}
            style={{
              width: `${progress}%`,
              background: progress >= 100 ? "linear-gradient(90deg,#00ff88,#ffcc00)" : progress >= 30 ? "linear-gradient(90deg,#ff2d55,#ffcc00)" : "var(--gradient)",
              boxShadow: progress > 65 ? "0 0 14px rgba(255,45,85,0.55)" : undefined,
              transition: "width 0.14s linear",
            }}
          />
          {/* milestone ticks */}
          {MILESTONES.map((m) => {
            const left = (m / TARGET) * 100;
            const reached = clicks >= m;
            return (
              <div
                key={m}
                title={`${m}`}
                style={{
                  position: "absolute",
                  left: `${left}%`,
                  top: -4,
                  width: 2,
                  height: 18,
                  background: reached ? "#00ff88" : "rgba(255,255,255,0.35)",
                  boxShadow: reached ? "0 0 6px #00ff88" : undefined,
                  transform: "translateX(-1px)",
                  borderRadius: 2,
                }}
              />
            );
          })}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10,
            color: "rgba(255,255,255,0.42)",
            marginBottom: 16,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          <span>0</span>
          <span style={{ color: clicks >= 42 ? "#ffcc00" : undefined }}>42</span>
          <span style={{ color: clicks >= 100 ? "#ffcc00" : undefined }}>100</span>
          <span style={{ color: clicks >= 420 ? "#ffcc00" : undefined }}>420</span>
          <span style={{ color: clicks >= 4200 ? "#00ff88" : undefined }}>4200 ✓</span>
        </div>

        {/* milestone toast */}
        {milestoneMsg ? (
          <div
            ref={toastRef}
            style={{
              margin: "0 auto 12px",
              display: "inline-block",
              padding: "6px 14px",
              borderRadius: 100,
              background: "rgba(255,204,0,0.12)",
              border: "1px solid rgba(255,204,0,0.28)",
              color: "#ffcc00",
              fontWeight: 800,
              fontSize: 12,
              letterSpacing: "0.06em",
            }}
          >
            {milestoneMsg}
          </div>
        ) : null}

        {!started && !won && !lost && (
          <button
            className={styles.startBtn}
            onClick={startGame}
            style={{ boxShadow: "0 0 34px rgba(255,45,85,0.45), 0 0 0 1px rgba(255,255,255,0.06) inset" }}
          >
            Начать — {TIME} сек до 4200!
          </button>
        )}

        {started && (
          <div style={{ position: "relative", display: "flex", justifyContent: "center", paddingTop: 8 }} ref={burstRef as unknown as React.RefObject<HTMLDivElement>}>
            <button
              ref={btnRef}
              className={styles.clickBtn}
              onClick={handleClick}
              aria-label="Клик"
              style={{
                background: `radial-gradient(circle at 30% 30%, #ff5a7a, var(--accent))`,
                boxShadow: "0 0 48px rgba(255,45,85,0.58), 0 0 0 1px rgba(255,255,255,0.1) inset, 0 10px 28px rgba(0,0,0,0.42)",
                position: "relative",
                overflow: "hidden",
                touchAction: "manipulation",
              }}
            >
              <div className={styles.clickNum} ref={numRef} style={{ textShadow: "0 2px 10px rgba(0,0,0,0.38)" }}>
                {clicks.toLocaleString("ru-RU")}
              </div>
              <div className={styles.clickLabel} style={{ letterSpacing: "0.12em" }}>
                ЖМИ! x{incNow}
              </div>
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.24), transparent 62%)",
                  pointerEvents: "none",
                }}
              />
            </button>
          </div>
        )}

        {won && !showModal && (
          <div
            className={styles.win}
            style={{ background: "rgba(0,255,136,0.07)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 16, padding: "1.2rem", marginTop: 16 }}
          >
            <h2>🎉 4200 — MAGNUM!</h2>
            <p>
              {TARGET.toLocaleString("ru-RU")} кликов за {TIME - timeLeft} сек • CPS {cps.toFixed(1)} • COMBO {combo}
            </p>
            <button onClick={() => setShowModal(true)} className={styles.presaveBtn} style={{ cursor: "pointer" }}>
              Пресейв MAGNUM →
            </button>
            <button onClick={restart} className={styles.restartBtn}>
              Ещё раз
            </button>
          </div>
        )}

        {lost && (
          <div
            className={styles.lose}
            style={{ background: "rgba(255,45,85,0.07)", border: "1px solid rgba(255,45,85,0.2)", borderRadius: 16, padding: "1.2rem" }}
          >
            <h2>Время вышло ⏱️</h2>
            <p>
              Кликов: {clicks.toLocaleString("ru-RU")}/{TARGET.toLocaleString("ru-RU")} • ещё {(TARGET - clicks).toLocaleString("ru-RU")} до MAGNUM • CPS {cps.toFixed(1)}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={restart} className={styles.restartBtn}>
                Попробовать снова
              </button>
              <a href={PRESAVE} target="_blank" rel="noreferrer" className={styles.presaveBtn}>
                Пресейв всё равно →
              </a>
            </div>
          </div>
        )}
      </div>

      {/* presave modal — победа 4200 */}
      {showModal && won ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(8,8,14,0.78)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 600,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(420px, 92vw)",
              background: "linear-gradient(180deg, rgba(28,28,38,0.98), rgba(14,14,20,0.98))",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 20,
              padding: "22px 18px 16px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.55), 0 0 40px rgba(255,45,85,0.18)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 38, marginBottom: 6 }}>💿✨</div>
            <h2 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 6px", letterSpacing: "-0.02em" }}>4200 кликов — ты MAGNUM!</h2>
            <p style={{ color: "rgba(240,240,240,0.68)", fontSize: 13, lineHeight: 1.5, margin: "0 0 14px" }}>
              Легенда кликера. Альбом заслуживает пресейва — один тап и ты в релизе первым.
              <br />
              <span style={{ color: "#ffcc00", fontWeight: 700 }}>
                CPS {cps.toFixed(1)} • {TIME - timeLeft}с • COMBO {combo}
              </span>
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <a
                href={PRESAVE}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-block",
                  padding: "11px 18px",
                  borderRadius: 100,
                  background: "var(--accent, #ff2d55)",
                  color: "#fff",
                  fontWeight: 800,
                  textDecoration: "none",
                  boxShadow: "0 0 24px rgba(255,45,85,0.45)",
                }}
              >
                Пресейв MAGNUM →
              </a>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: "11px 16px",
                  borderRadius: 100,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Закрыть
              </button>
            </div>
            <button
              onClick={restart}
              style={{ marginTop: 12, background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
            >
              сыграть ещё раз
            </button>
          </div>
        </div>
      ) : null}

      <Link to="/magnum/games" className={styles.back}>
        ← К играм
      </Link>
    </div>
  );
}
