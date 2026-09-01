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

  const isMagnumHome = location.pathname === "/magnum" || location.pathname === "/magnum/";

  const show = useCallback(() => {
    if (window.__exitPresaveShown || visible) return;
    window.__exitPresaveShown = true;
    setVisible(true);
  }, [visible]);

  // 45s delay + exit-intent (mouseleave top) only on /magnum
  useEffect(() => {
    if (!isMagnumHome) return;
    if (window.__exitPresaveShown) return;

    // 45s fallback: show even without exit-intent if user stays
    timerRef.current = window.setTimeout(() => {
      show();
    }, 45_000);

    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && Date.now() - performance.timing.navigationStart > 45_000) {
        show();
      }
    };
    // also allow early exit-intent after 45s has passed regardless of navStart drift
    let ready = false;
    const readyTimer = window.setTimeout(() => { ready = true; }, 45_000);
    const onMouseLeaveReady = (e: MouseEvent) => {
      if (ready && e.clientY <= 2) show();
    };

    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseleave", onMouseLeaveReady);
    // mobile: visibilitychange / pagehide not needed — timer covers it; scroll + back gesture not reliable for exit

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      window.clearTimeout(readyTimer);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseleave", onMouseLeaveReady);
    };
  }, [isMagnumHome, show]);

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
    fetch("/magnum/api/presave/click", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: PRESAVE_URL, ts: Date.now() }),
    }).catch(() => {});
    // let presaveTracker also fire via href, then close after short delay
    setTimeout(close, 250);
  }, [close]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, close]);

  if (!visible) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Пресейв MAGNUM — не пропусти"
      data-testid="exit-intent-presave"
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
          <span style={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.12em", color: "#ff2d55", textTransform: "uppercase" as const }}>MAGNUM • пресейв открыт</span>
          <strong style={{ fontSize: "1.35rem", fontWeight: 900, letterSpacing: "-0.03em", color: "#fff", lineHeight: 1.15 }}>
            Не пропусти дроп — 5 пуль уже на подлёте
          </strong>
          <span style={{ fontSize: "0.88rem", color: "rgba(240,240,240,0.62)", lineHeight: 1.5 }}>
            ТУСА МЕДУЗА и VPN уже в чартах. Нажми пресейв — уведомление придёт в день релиза. Это бесплатно.
          </span>
          <a
            href={PRESAVE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handlePresave}
            data-testid="exit-intent-cta"
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
            ★ Пресейв на Яндекс Музыке →
          </a>
          <span style={{ fontSize: "0.72rem", color: "rgba(240,240,240,0.38)", textAlign: "center" as const }}>Никакого спама — только уведомление о релизе</span>
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
