import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import gsap from "gsap";
import { PRESAVE_URL } from "./CTA";

declare global {
  interface Window {
    __exitPresaveShown?: boolean;
  }
}

export function ExitIntentPresave() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(300);

  const isMagnumHome = location.pathname === "/magnum" || location.pathname === "/magnum/";

  const isPresaved = () => {
    try { return localStorage.getItem("presave_done") === "1"; } catch { return false; }
  };

  const show = useCallback(() => {
    if (isPresaved()) return;
    if (window.__exitPresaveShown || visible) return;
    window.__exitPresaveShown = true;
    setVisible(true);
  }, [visible]);

  // 45s delay + exit-intent (mouseleave top) only on /magnum, gated by localStorage
  useEffect(() => {
    if (!isMagnumHome) return;
    if (isPresaved()) return;
    if (window.__exitPresaveShown) return;

    timerRef.current = window.setTimeout(() => {
      show();
    }, 45_000);

    let ready = false;
    const readyTimer = window.setTimeout(() => { ready = true; }, 45_000);
    const onMouseLeaveReady = (e: MouseEvent) => {
      if (ready && e.clientY <= 2) show();
    };
    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && Date.now() - performance.timing.navigationStart > 45_000) {
        show();
      }
    };

    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseleave", onMouseLeaveReady);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      window.clearTimeout(readyTimer);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseleave", onMouseLeaveReady);
    };
  }, [isMagnumHome, show]);

  // countdown timer when visible (5 min urgency)
  useEffect(() => {
    if (!visible) return;
    setSecondsLeft(300);
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { window.clearInterval(id); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [visible]);

  useEffect(() => {
    if (!visible || !overlayRef.current || !cardRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      gsap.set(overlayRef.current, { opacity: 1 });
      gsap.set(cardRef.current, { opacity: 1, scale: 1, y: 0 });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.set(overlayRef.current, { opacity: 0 });
      gsap.set(cardRef.current, { scale: 0.92, y: 24, opacity: 0 });
      gsap.to(overlayRef.current, { opacity: 1, duration: 0.25, ease: "power2.out" });
      gsap.to(cardRef.current, { scale: 1, y: 0, opacity: 1, duration: 0.5, ease: "back.out(1.4)", delay: 0.08 });
    }, overlayRef);
    return () => ctx.revert();
  }, [visible]);

  const close = useCallback(() => {
    if (!overlayRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(false);
      return;
    }
    gsap.to(cardRef.current, { scale: 0.94, y: 16, opacity: 0, duration: 0.28, ease: "power2.in" });
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.22, delay: 0.08, onComplete: () => setVisible(false) });
  }, []);

  const handlePresave = useCallback(() => {
    try { localStorage.setItem("presave_done", "1"); } catch {}
    fetch("/magnum/api/presave/click", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: PRESAVE_URL, ts: Date.now() }),
    }).catch(() => {});
    setTimeout(close, 250);
  }, [close]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, close]);

  // if already presaved, never render (idempotent Gate)
  if (isPresaved() && !visible) return null;
  if (!visible) return null;

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Пресейв MAGNUM — не пропусти"
      data-testid="exit-intent-presave"
      data-presave-bonus="42"
      onClick={(e) => { if (e.target === overlayRef.current) close(); }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 95,
        display: "grid",
        placeItems: "center",
        padding: "1rem",
        background: "rgba(0,0,0,0.58)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        ref={cardRef}
        style={{
          position: "relative",
          width: "min(440px, calc(100vw - 1.2rem))",
          borderRadius: 20,
          background: "rgba(18,18,20,0.98)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.55), 0 0 40px rgba(255,45,85,0.18)",
          overflow: "hidden",
        }}
      >
        <div style={{ height: 3, background: "linear-gradient(90deg,#ff2d55,#ffcc00,#00ff88,#5865f2,#ff2d55)", backgroundSize: "200% 100%" }} />
        <button
          type="button"
          onClick={close}
          aria-label="Закрыть"
          data-testid="exit-intent-close"
          style={{
            position: "absolute", top: 10, right: 10, width: 34, height: 34, borderRadius: 12,
            background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)",
            color: "#fff", fontSize: "1.2rem", lineHeight: 1, cursor: "pointer", display: "grid", placeItems: "center",
          }}
        >
          ×
        </button>
        <div style={{ padding: "1.25rem 1.2rem 1.1rem", display: "flex", flexDirection: "column", gap: "0.65rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.12em", color: "#ff2d55", textTransform: "uppercase" as const }}>MAGNUM • пресейв открыт</span>
            <span data-testid="presave-timer" style={{ fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.06em", background: secondsLeft < 60 ? "#ff2d55" : "rgba(255,45,85,0.14)", color: secondsLeft < 60 ? "#fff" : "#ff2d55", padding: "0.16rem 0.45rem", borderRadius: 999, border: "1px solid rgba(255,45,85,0.22)" }}>{mm}:{ss}</span>
            <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", background: "#ffcc00", color: "#111", padding: "0.16rem 0.45rem", borderRadius: 999 }}>+42 монеты</span>
          </div>
          <strong style={{ fontSize: "1.35rem", fontWeight: 900, letterSpacing: "-0.03em", color: "#fff", lineHeight: 1.15 }}>
            Не пропусти дроп — 5 пуль уже на подлёте
          </strong>
          <span style={{ fontSize: "0.88rem", color: "rgba(240,240,240,0.62)", lineHeight: 1.5 }}>
            ТУСА МЕДУЗА и VPN уже в чартах. Нажми пресейв — получи <strong style={{ color: "#ffcc00" }}>+42 монеты</strong> бонусом и уведомление в день релиза. Бесплатно.
          </span>
          <a
            href={PRESAVE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handlePresave}
            data-testid="exit-intent-cta"
            data-presave-bonus="42"
            style={{
              marginTop: "0.4rem",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.45rem",
              padding: "0.82rem 1.2rem",
              borderRadius: 100,
              background: "#ff2d55",
              color: "#fff",
              fontWeight: 800,
              fontSize: "0.95rem",
              textDecoration: "none",
              boxShadow: "0 8px 24px rgba(255,45,85,0.35)",
            }}
          >
            ★ Пресейв на Яндекс Музыке → <span style={{ background: "rgba(255,255,255,0.22)", padding: "0.12rem 0.4rem", borderRadius: 999, fontSize: "0.72rem" }}>+42</span>
          </a>
          <span style={{ fontSize: "0.72rem", color: "rgba(240,240,240,0.38)", textAlign: "center" as const }}>Бонус действует {secondsLeft > 0 ? `ещё ${mm}:${ss}` : "последние секунды"} • Никакого спама</span>
          <button
            type="button"
            onClick={close}
            style={{
              marginTop: "0.15rem",
              background: "none",
              border: "none",
              color: "rgba(240,240,240,0.45)",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Не сейчас
          </button>
        </div>
      </div>
    </div>
  );
}
