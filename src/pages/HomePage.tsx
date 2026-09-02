import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Hero } from "../components/Hero";
import { Marquee } from "../components/Marquee";
import { Stats } from "../components/Stats";
import { About } from "../components/About";
import { NavGrid } from "../components/NavGrid";
import { lazy, Suspense } from "react";
import { getABVariant, type ABVariant } from "../lib/presaveTracker";
import { ReferralCard } from "../components/ReferralCard";
import { TamagotchiWidget } from "../components/TamagotchiWidget";
// perf 16:34 — lazy below-fold (Timeline 576L + PressWall 207L + News2026 242L + CTA) — main 466→~340K eager
// perf 2026-09-01 — Singles lazy (162L, GSAP/ScrollTrigger, 2 covers) → main -~12KB (chunk split)
const Singles = lazy(() => import("../components/Singles").then(m => ({ default: m.Singles })));
const Timeline = lazy(() => import("../components/Timeline").then(m => ({ default: m.Timeline })));
const PressWall = lazy(() => import("../components/PressWall").then(m => ({ default: m.PressWall })));
const News2026 = lazy(() => import("../components/News2026").then(m => ({ default: m.News2026 })));
const CTA = lazy(() => import("../components/CTA").then(m => ({ default: m.CTA })));

gsap.registerPlugin(ScrollTrigger);
function prefersReducedMotion(): boolean { return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
const RGB_GLOW = "0 12px 36px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,45,85,0.22), 0 0 28px rgba(255,45,85,0.22), 0 0 28px rgba(0,255,136,0.14), 0 0 32px rgba(255,204,0,0.10)";
function hoverIn(el: HTMLElement){ if(prefersReducedMotion()) return; gsap.to(el,{y: -4, boxShadow:RGB_GLOW, borderColor:"rgba(255,45,85,0.45)", duration:0.3, ease:"power2.out", overwrite:true}); }

const TARGET = 42;

function spawnBigConfetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
    gsap.to(el, {
      y: `+=${220 + Math.random() * 380}`,
      duration: 1.2 + Math.random(),
      ease: "power1.in",
      delay: 0.55 + Math.random() * 0.25,
    });
  });

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

/* ── Promo banners над Singles ── */
const PROMOS = [
  { to: "/magnum/games/duel-magma", icon: "🌋", title: "DUEL MAGMA 42", subtitle: "NEW • WS 2-4", desc: "магма x10 • lava-spike • ставка 42/142/420", gradient: "linear-gradient(135deg,#ff4500 0%,#ff0000 50%,#ffcc00 100%)", shadow: "rgba(255,69,0,0.5)", border: "#ff4500" },
  { to: "/magnum/shop", icon: "🛒", title: "Магазин", subtitle: "12 скинов", desc: "COMMON → LEGENDARY за magnum-coins", gradient: "linear-gradient(135deg,#ff2d55 0%,#ff6b35 35%,#ffcc00 70%,#ff2d55 100%)", shadow: "rgba(255,45,85,0.45)", border: "#ff2d55" },
  { to: "/magnum/eco", icon: "🌿", title: "Эко-рейтинг", subtitle: "пройди тест", desc: "8 вопросов • стань ЭкоЛегендой", gradient: "linear-gradient(135deg,#00ff88 0%,#00d4ff 50%,#00ff88 100%)", shadow: "rgba(0,255,136,0.4)", border: "#00ff88" },
  { to: "/magnum/games/roulette", icon: "⚔️", title: "Арена", subtitle: "дуэль", desc: "PvP братух • собери 4200 монет", gradient: "linear-gradient(135deg,#5865f2 0%,#9147ff 50%,#5865f2 100%)", shadow: "rgba(88,101,242,0.5)", border: "#5865f2" },
  { to: "/magnum/42", icon: "🖼️", title: "Галерея 42", subtitle: "42 арты", desc: "Движение, сквады, стиль — смотри", gradient: "linear-gradient(135deg,#ffcc00 0%,#ff9d1e 40%,#ff2d55 100%)", shadow: "rgba(255,204,0,0.45)", border: "#ffcc00" },
];

function PromoBanners() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      const cards = ref.current!.querySelectorAll<HTMLElement>("[data-promo]");
      if (!cards.length) return;
      if (prefersReduced) {
        gsap.set(cards, { y: 0, opacity: 1, scale: 1, clearProps: "transform" });
        gsap.set(ref.current!.querySelectorAll<HTMLElement>("[data-glow]"), { opacity: 0.22 });
        return;
      }
      gsap.set(cards, { y: 24, opacity: 0, scale: 0.96 });
      gsap.to(cards, {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 0.62,
        stagger: 0.12,
        ease: "back.out(1.5)",
        scrollTrigger: {
          trigger: ref.current,
          start: "top 85%",
          toggleActions: "play none none none",
        },
      });
      cards.forEach((c) => {
        const glow = c.querySelector<HTMLElement>("[data-glow]");
        if (!glow) return;
        gsap.to(glow, { opacity: 0.9, duration: 1.8, repeat: -1, yoyo: true, ease: "sine.inOut", delay: Math.random() * 0.8 });
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  const onMove = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 10;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -10;
    gsap.to(card, { rotateY: x, rotateX: y, y: -6, duration: 0.35, ease: "power2.out", overwrite: true });
    // RGB glow on hover
    gsap.to(card, {
      boxShadow: "0 0 0 1px rgba(255,45,85,0.22), 0 12px 36px rgba(255,45,85,0.28), 0 0 28px rgba(0,255,136,0.18), 0 0 32px rgba(255,204,0,0.14)",
      borderColor: "rgba(255,45,85,0.55)",
      duration: 0.3,
      ease: "power2.out",
      overwrite: true,
    });
  }, []);
  const onLeave = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.to(e.currentTarget, { rotateY: 0, rotateX: 0, y: 0, duration: 0.5, ease: "elastic.out(1,0.45)", overwrite: true });
    gsap.to(e.currentTarget, {
      boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.35)",
      borderColor: "rgba(255,255,255,0.08)",
      duration: 0.4,
      ease: "power2.out",
      overwrite: true,
    });
  }, []);

  return (
    <section
      ref={ref}
      aria-label="Промо-баннеры"
      style={{ maxWidth: 1120, margin: "0 auto", padding: "1.2rem 1rem 0.6rem", perspective: 900 }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.9rem" }}>
        {PROMOS.map((p) => (
          <Link
            key={p.to + p.title}
            to={p.to}
            data-promo=""
            onMouseMove={onMove}
            onMouseLeave={onLeave}
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
              padding: "1.15rem 1.1rem 1rem",
              borderRadius: 20,
              background: "rgba(18,18,20,0.92)",
              border: `1px solid ${p.border}55`,
              boxShadow: `0 0 0 1px ${p.border}22, 0 8px 32px ${p.shadow}, 0 0 28px ${p.shadow}`,
              textDecoration: "none",
              overflow: "hidden",
              transformStyle: "preserve-3d" as never,
              isolation: "isolate" as never,
            }}
          >
            <div
              data-glow=""
              aria-hidden
              style={{
                position: "absolute",
                inset: -1,
                borderRadius: 20,
                background: p.gradient,
                opacity: 0.18,
                filter: "blur(14px)",
                zIndex: -1,
                pointerEvents: "none",
              }}
            />
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: p.gradient, opacity: 0.95 }} />
            <span style={{ fontSize: "1.9rem", lineHeight: 1, filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.4))" }}>{p.icon}</span>
            <strong style={{ fontSize: "1.05rem", fontWeight: 900, letterSpacing: "-0.02em", color: "#fff", lineHeight: 1.1 }}>{p.title}</strong>
            <span style={{ fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: p.border }}>{p.subtitle}</span>
            <span style={{ fontSize: "0.82rem", color: "rgba(240,240,240,0.62)", lineHeight: 1.35, marginTop: 2 }}>{p.desc}</span>
            <span style={{ marginTop: "0.6rem", fontSize: "0.8rem", fontWeight: 700, color: "#fff", display: "inline-flex", alignItems: "center", gap: 6 }}>
              Перейти <span aria-hidden>→</span>
            </span>
            <span
              aria-hidden
              style={{
                position: "absolute",
                right: -18,
                bottom: -18,
                fontSize: "5.2rem",
                opacity: 0.06,
                pointerEvents: "none",
                userSelect: "none",
              }}
            >
              {p.icon}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function PopupBanner() {
  const [visible, setVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // без localStorage: показываем один раз за сессию (in-memory), 3с delay — Neon-стейт для пресейва отдельно
    const t = window.setTimeout(() => setVisible(true), 3000);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!visible || !cardRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;
    gsap.fromTo(cardRef.current, { y: 40, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.55, ease: "back.out(1.6)" });
  }, [visible]);

  const close = useCallback(() => {
    const el = cardRef.current;
    const doClose = () => {
      setVisible(false);
    };
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { doClose(); return; }
    gsap.to(el, { y: 24, opacity: 0, scale: 0.96, duration: 0.3, ease: "power2.in", onComplete: doClose });
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Промо MAGNUM"
      aria-modal="false"
      style={{
        position: "fixed",
        right: "1rem",
        bottom: "1rem",
        zIndex: 90,
        width: "min(360px, calc(100vw - 1.2rem))",
        pointerEvents: "auto",
      }}
    >
      <div
        ref={cardRef}
        style={{
          position: "relative",
          borderRadius: 18,
          background: "rgba(16,16,18,0.96)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 0 0 1px rgba(255,45,85,0.12), 0 16px 48px rgba(0,0,0,0.55), 0 0 32px rgba(255,45,85,0.18)",
          overflow: "hidden",
          backdropFilter: "blur(14px)",
        }}
      >
        <div style={{ height: 3, background: "linear-gradient(90deg,#ff2d55,#ffcc00,#00ff88,#5865f2,#ff2d55)", backgroundSize: "200% 100%" }} />
        <button
          onClick={close}
          aria-label="Закрыть баннер"
          style={{
            position: "absolute", top: 8, right: 8, width: 32, height: 32, borderRadius: 10,
            background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)",
            color: "#fff", fontSize: "1.15rem", lineHeight: 1, cursor: "pointer", display: "grid", placeItems: "center",
          }}
        >
          ×
        </button>
        <div style={{ padding: "1rem 1.1rem 0.95rem", display: "flex", flexDirection: "column", gap: "0.55rem" }}>
          <span style={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.1em", color: "#ff2d55", textTransform: "uppercase" as const }}>MAGNUM • не пропусти</span>
          <strong style={{ fontSize: "1.02rem", fontWeight: 900, color: "#fff", lineHeight: 1.25 }}>🔥 Магазин, Эко и Арена — уже на сайте</strong>
          <span style={{ fontSize: "0.82rem", color: "rgba(240,240,240,0.6)", lineHeight: 1.4 }}>12 скинов, эко-тест на 8 вопросов и дуэли братух. Всё — прямо из главного меню.</span>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.35rem", flexWrap: "wrap" }}>
            <Link to="/magnum/shop" onClick={close} style={{ flex: 1, textAlign: "center" as const, padding: "0.62rem 0.8rem", borderRadius: 100, background: "#ff2d55", color: "#fff", fontWeight: 800, fontSize: "0.82rem", textDecoration: "none", boxShadow: "0 8px 20px rgba(255,45,85,0.32)" }}>Магазин →</Link>
            <Link to="/magnum/eco" onClick={close} style={{ flex: 1, textAlign: "center" as const, padding: "0.62rem 0.8rem", borderRadius: 100, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontWeight: 700, fontSize: "0.82rem", textDecoration: "none" }}>Эко-тест</Link>
          </div>
          <Link to="/magnum/games/roulette" onClick={close} style={{ fontSize: "0.76rem", fontWeight: 600, color: "rgba(240,240,240,0.55)", textDecoration: "none", textAlign: "center" as const, paddingTop: 2 }}>Арена дуэлей →</Link>
        </div>
      </div>
    </div>
  );
}

export function HomePage() {
  const clicksRef = useRef(0);
  const lastClickRef = useRef(0);
  const [progress, setProgress] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const hintTimerRef = useRef<number | null>(null);
  const [abVariant, setAbVariant] = useState<ABVariant>("a");
  useEffect(() => { try { setAbVariant(getABVariant()); } catch {} }, []);

  const onLogoClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const logo = target.closest('[aria-label="MAGNUM на главную"]') as HTMLElement | null;
    const heroTitle = target.closest("h1") as HTMLElement | null;
    const isHeroMagnum = heroTitle?.textContent?.trim() === "MAGNUM";
    const hit: HTMLElement | null = logo ?? (isHeroMagnum ? heroTitle : null);
    if (!hit) return;

    const now = Date.now();
    if (now - lastClickRef.current > 6000) clicksRef.current = 0;
    lastClickRef.current = now;

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.fromTo(hit, { scale: 1 }, { scale: 1.08, duration: 0.12, yoyo: true, repeat: 1, ease: "power2.out" });
      gsap.fromTo(hit, { filter: "drop-shadow(1px 0 0 #ff2d55) drop-shadow(-1px 0 0 #00ff88)" }, { filter: "none", duration: 0.18, ease: "power1.out" });
    }

    clicksRef.current += 1;
    const c = clicksRef.current;
    setProgress(c);
    if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
    hintTimerRef.current = window.setTimeout(() => setProgress(0), 2500);

    if (c >= TARGET && !unlocked) {
      setUnlocked(true);
      clicksRef.current = 0;
      setProgress(0);
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        spawnBigConfetti();
      }
      setTimeout(() => setUnlocked(false), 4000);
    } else if (c >= TARGET) {
      clicksRef.current = 0;
      setProgress(0);
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        spawnBigConfetti();
      }
    }

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
      <Hero variant={abVariant} />
      <Marquee />
      <Stats />
      <NavGrid />
      <About />
      <Suspense fallback={<div style={{minHeight:200}} /> }><Timeline /></Suspense>
      <Suspense fallback={<div style={{minHeight:200}} /> }><PressWall /></Suspense>
      <Suspense fallback={<div style={{minHeight:160}} /> }><News2026 /></Suspense>
      <PromoBanners />
      <div style={{ maxWidth:1120, margin:"0 auto", padding:"0.8rem 1rem" }}><ReferralCard /></div>
      <TamagotchiWidget />
      <Suspense fallback={<div style={{minHeight:220}} />}><Singles /></Suspense>
      <Suspense fallback={<div style={{minHeight:120}} /> }><CTA variant={abVariant} /></Suspense>
      <PopupBanner />

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
