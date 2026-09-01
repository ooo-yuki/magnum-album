import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { Hero } from "../components/Hero";
import { Marquee } from "../components/Marquee";
import { Stats } from "../components/Stats";
import { Singles } from "../components/Singles";
import { About } from "../components/About";
import { NavGrid } from "../components/NavGrid";
import { CTA } from "../components/CTA";

const TARGET = 42;

function spawnBigConfetti() {
  const colors = ["#ff2d55", "#ffcc00", "#00ff88", "#5865f2", "#ff6b35", "#ffffff"];
  const container = document.createElement("div");
  Object.assign(container.style, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    zIndex: "9998",
    overflow: "hidden",
  } as unknown as CSSStyleDeclaration);
  document.body.appendChild(container);

  // center burst origin
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight * 0.28;

  const pieces: HTMLDivElement[] = [];
  for (let i = 0; i < 140; i++) {
    const el = document.createElement("div");
    const color = colors[i % colors.length];
    const w = 7 + Math.random() * 9;
    const h = 7 + Math.random() * 9;
    const shape = Math.random();
    let borderRadius = "2px";
    if (shape > 0.66) borderRadius = "50%";
    else if (shape > 0.33) borderRadius = "1px";
    Object.assign(el.style, {
      position: "absolute",
      left: cx + "px",
      top: cy + "px",
      width: w + "px",
      height: h + "px",
      background: color,
      borderRadius,
      opacity: "0.98",
    } as unknown as CSSStyleDeclaration);
    container.appendChild(el);
    pieces.push(el);
  }
  pieces.forEach((el) => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 180 + Math.random() * 520;
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist + 320 + Math.random() * 260;
    const rot = 360 + Math.random() * 900;
    const duration = 1.1 + Math.random() * 1.4;
    gsap.to(el, {
      x, y,
      rotation: rot,
      duration,
      ease: "power2.out",
      delay: Math.random() * 0.12,
    });
    gsap.to(el, {
      opacity: 0,
      duration: 0.45,
      delay: duration - 0.3,
      ease: "power1.in",
    });
    // gravity-ish fall after burst
    gsap.to(el, {
      y: `+=${220 + Math.random() * 380}`,
      duration: 1.2 + Math.random(),
      ease: "power1.in",
      delay: 0.55 + Math.random() * 0.25,
    });
  });

  // big text flash
  const flash = document.createElement("div");
  flash.textContent = "42 × BRATUKHI!";
  Object.assign(flash.style, {
    position: "fixed",
    left: "50%",
    top: "46%",
    transform: "translate(-50%,-50%) scale(0.7)",
    zIndex: "9999",
    fontSize: "clamp(2rem, 8vw, 4.2rem)",
    fontWeight: "900",
    letterSpacing: "-0.04em",
    background: "linear-gradient(90deg,#ff2d55,#ffcc00,#00ff88,#5865f2,#ff2d55)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    textAlign: "center",
    pointerEvents: "none",
    opacity: "0",
    filter: "drop-shadow(0 12px 40px rgba(255,45,85,0.35))",
  } as unknown as CSSStyleDeclaration);
  document.body.appendChild(flash);
  gsap.to(flash, { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(1.7)" });
  gsap.to(flash, { opacity: 0, scale: 1.06, y: -18, duration: 0.5, delay: 1.6, ease: "power2.in" });

  try { navigator.vibrate?.([80, 40, 120]); } catch {}
  setTimeout(() => { container.remove(); flash.remove(); }, 3400);
}

export function HomePage() {
  const clicksRef = useRef(0);
  const lastClickRef = useRef(0);
  const [progress, setProgress] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const hintTimerRef = useRef<number | null>(null);

  const onLogoClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    // catch clicks on Layout logo (aria-label) or Hero title
    const logo = target.closest('[aria-label="MAGNUM на главную"]') as HTMLElement | null;
    const heroTitle = target.closest("h1") as HTMLElement | null;
    const isHeroMagnum = heroTitle?.textContent?.trim() === "MAGNUM";
    const hit: HTMLElement | null = logo ?? (isHeroMagnum ? heroTitle : null);
    if (!hit) return;

    const now = Date.now();
    // reset if idle > 6s
    if (now - lastClickRef.current > 6000) clicksRef.current = 0;
    lastClickRef.current = now;

    // tiny gsap punch on the clicked element
    gsap.fromTo(hit, { scale: 1 }, { scale: 1.08, duration: 0.12, yoyo: true, repeat: 1, ease: "power2.out" });
    // chromatic micro-shift
    gsap.fromTo(hit, { filter: "drop-shadow(1px 0 0 #ff2d55) drop-shadow(-1px 0 0 #00ff88)" }, { filter: "none", duration: 0.18, ease: "power1.out" });

    clicksRef.current += 1;
    const c = clicksRef.current;
    setProgress(c);
    if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
    // auto-hide progress if idle
    hintTimerRef.current = window.setTimeout(() => setProgress(0), 2500);

    if (c >= TARGET && !unlocked) {
      setUnlocked(true);
      clicksRef.current = 0;
      setProgress(0);
      spawnBigConfetti();
      // allow re-trigger after 4s
      setTimeout(() => setUnlocked(false), 4000);
    } else if (c >= TARGET) {
      // already unlocked — still celebrate but less spam
      clicksRef.current = 0;
      setProgress(0);
      spawnBigConfetti();
    }

    // subtle hint at 10, 20, 30
    if (c === 10 || c === 20 || c === 30) {
      try { navigator.vibrate?.(30); } catch {}
    }
  }, [unlocked]);

  useEffect(() => {
    document.addEventListener("click", onLogoClick as unknown as EventListener);
    return () => {
      document.removeEventListener("click", onLogoClick as unknown as EventListener);
      if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
    };
  }, [onLogoClick]);

  const pct = Math.min(progress, TARGET);

  return (
    <>
      <Hero />
      <Marquee />
      <Stats />
      <NavGrid />
      <About />
      <Singles />
      <CTA />

      {/* 42-click progress — only visible while clicking */}
      {pct > 0 && pct < TARGET && (
        <div
          style={{
            position: "fixed",
            bottom: "1.2rem",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            padding: "0.5rem 0.9rem",
            borderRadius: "100px",
            background: "rgba(16,16,16,0.92)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(12px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            fontSize: "0.78rem",
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: "rgba(240,240,240,0.9)",
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              width: 56,
              height: 4,
              borderRadius: 999,
              background: "rgba(255,255,255,0.12)",
              overflow: "hidden",
              display: "block",
            }}
          >
            <span
              style={{
                display: "block",
                height: "100%",
                width: `${(pct / TARGET) * 100}%`,
                background: "linear-gradient(90deg,#ff2d55,#ffcc00,#00ff88)",
                transition: "width 0.18s ease",
              }}
            />
          </span>
          <span>{pct}/{TARGET}</span>
          <span style={{ color: "rgba(240,240,240,0.42)", fontWeight: 600, fontSize: "0.72rem" }}>
            {pct >= 35 ? "ещё чуть!" : pct >= 20 ? "жми!" : "лого!"}
          </span>
        </div>
      )}
    </>
  );
}
