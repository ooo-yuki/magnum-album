import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { PRESAVE_URL } from "./CTA";

declare global {
  interface Window {
    __stickyPresaveDismissed?: boolean;
  }
}

export function StickyPresaveBar() {
  const barRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);
  const [dismissed, setDismissed] = useState(() => Boolean(window.__stickyPresaveDismissed));

  useEffect(() => {
    if (dismissed || !barRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      gsap.set(barRef.current, { y: 0, opacity: 1 });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.set(barRef.current, { y: 80, opacity: 0 });
      gsap.to(barRef.current, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out", delay: 0.6 });
      if (ctaRef.current) {
        gsap.to(ctaRef.current, {
          scale: 1.04,
          boxShadow: "0 0 32px rgba(255,45,85,0.55), 0 8px 24px rgba(255,45,85,0.28)",
          duration: 1.1,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      }
    }, barRef);
    return () => ctx.revert();
  }, [dismissed]);

  const handleDismiss = useCallback(() => {
    window.__stickyPresaveDismissed = true;
    if (!barRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDismissed(true);
      return;
    }
    gsap.to(barRef.current, {
      y: 80,
      opacity: 0,
      duration: 0.3,
      ease: "power2.in",
      onComplete: () => setDismissed(true),
    });
  }, []);

  const handleClick = useCallback(() => {
    // explicit beacon — presaveTracker also catches via delegated click on href, but double-safe
    fetch("/magnum/api/presave/click", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: PRESAVE_URL, ts: Date.now() }),
    }).catch(() => {});
  }, []);

  if (dismissed) return null;

  return (
    <div
      ref={barRef}
      data-testid="sticky-presave-bar"
      role="region"
      aria-label="Пресейв MAGNUM"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.7rem",
        padding: "0.65rem 0.9rem calc(0.65rem + env(safe-area-inset-bottom, 0px))",
        background: "rgba(14,14,16,0.96)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(14px)",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,45,85,0.06)",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: "linear-gradient(90deg,#ff2d55,#ffcc00,#00ff88,#5865f2,#ff2d55)",
          backgroundSize: "200% 100%",
        }}
      />
      <span
        style={{
          fontSize: "0.78rem",
          fontWeight: 800,
          letterSpacing: "0.06em",
          color: "rgba(255,255,255,0.9)",
          whiteSpace: "nowrap",
          display: "none",
        }}
        className="sticky-label"
      >
        MAGNUM • пресейв
      </span>
      <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "rgba(240,240,240,0.85)", lineHeight: 1.2, flex: "0 1 auto", textAlign: "center" as const }}>
        <span className="hide-mobile" style={{ opacity: 0.9 }}>🔥 Пресейв MAGNUM — </span>первым услышишь дроп
      </span>
      <a
        ref={ctaRef}
        href={PRESAVE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        data-testid="sticky-presave-cta"
        aria-label="Пресейв MAGNUM на Яндекс Музыке"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          padding: "0.55rem 1.05rem",
          borderRadius: 100,
          background: "#ff2d55",
          color: "#fff",
          fontWeight: 800,
          fontSize: "0.84rem",
          textDecoration: "none",
          whiteSpace: "nowrap",
          flexShrink: 0,
          boxShadow: "0 4px 18px rgba(255,45,85,0.38)",
        }}
      >
        Пресейв →
      </a>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Скрыть баннер"
        data-testid="sticky-presave-close"
        style={{
          width: 30,
          height: 30,
          borderRadius: 10,
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.7)",
          fontSize: "1.05rem",
          lineHeight: 1,
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        ×
      </button>
      <style>{`@media(max-width:640px){.hide-mobile{display:none!important}} @media(min-width:641px){.sticky-label{display:inline!important}}`}</style>
    </div>
  );
}
