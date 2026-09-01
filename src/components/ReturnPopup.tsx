import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import gsap from "gsap";
import { PRESAVE_URL } from "./CTA";

declare global {
  interface Window {
    __returnPopupShown?: boolean;
    __exitPresaveShown?: boolean;
  }
}

const COOKIE_NAME = "magnum_return_popup";
const COOKIE_MAX_AGE = 86400; // 1 day

function isPresaved(): boolean {
  try { return localStorage.getItem("presave_done") === "1"; } catch { return false; }
}

function hasCookieToday(): boolean {
  try {
    const raw = document.cookie || "";
    for (const part of raw.split(";")) {
      const t = part.trim();
      if (t.startsWith(COOKIE_NAME + "=")) return true;
    }
    return false;
  } catch { return false; }
}

function setCookieDay(): void {
  try { document.cookie = `${COOKIE_NAME}=1; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`; } catch {}
}

function isAuthModalOpen(): boolean {
  try {
    // AuthStatus modal uses role=dialog + aria-modal + input placeholder логин
    const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
    for (const d of Array.from(dialogs)) {
      const txt = (d as HTMLElement).innerText || "";
      if (txt.includes("Вход") || txt.includes("Регистрация") || txt.toLowerCase().includes("логин")) return true;
      if (d.querySelector('input[placeholder*="логин" i]') || d.querySelector('input[placeholder*="пароль" i]')) return true;
    }
  } catch {}
  return false;
}

function isNearBottom(): boolean {
  const scrollY = window.scrollY || window.pageYOffset;
  const vh = window.innerHeight;
  const full = document.documentElement.scrollHeight;
  return vh + scrollY >= full - 120;
}

export function ReturnPopup() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const idleRef = useRef<number | null>(null);
  const scrollCountRef = useRef(0);
  const clickedRef = useRef(false);
  const shownRef = useRef(false);

  const isHome = location.pathname === "/magnum" || location.pathname === "/magnum/";

  const doShow = useCallback(() => {
    if (shownRef.current) return;
    if (isPresaved()) return;
    if (hasCookieToday()) return;
    if (window.__returnPopupShown) return;
    if (isAuthModalOpen()) return;
    // avoid double with exit-intent if it already showed
    if (window.__exitPresaveShown && document.querySelector('[data-testid="exit-intent-presave"]')) return;
    shownRef.current = true;
    window.__returnPopupShown = true;
    setCookieDay();
    setVisible(true);
  }, []);

  // 3 triggers
  useEffect(() => {
    if (!isHome) return;
    if (isPresaved()) return;
    if (hasCookieToday()) return;
    if (window.__returnPopupShown) return;

    clickedRef.current = false;
    scrollCountRef.current = 0;

    const onClick = () => { clickedRef.current = true; };
    document.addEventListener("click", onClick);

    // 45s idle (simple timeout from mount; also reset on activity)
    const resetIdle = () => {
      if (idleRef.current) window.clearTimeout(idleRef.current);
      idleRef.current = window.setTimeout(() => { doShow(); }, 45_000);
    };
    resetIdle();
    const activityEvents: Array<keyof DocumentEventMap> = ["mousemove", "keydown", "touchstart", "scroll"];
    const onActivity = () => { if (!shownRef.current) resetIdle(); };
    activityEvents.forEach((ev) => document.addEventListener(ev, onActivity, { passive: true }));

    // initial 45s timer even without idle reset (spec: 45с idle — we treat as 45s from entry)
    timerRef.current = window.setTimeout(() => { doShow(); }, 45_000);

    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) doShow();
    };
    document.addEventListener("mouseleave", onMouseLeave);

    const onScroll = () => {
      if (clickedRef.current) return;
      if (!isNearBottom()) return;
      scrollCountRef.current += 1;
      if (scrollCountRef.current >= 2) doShow();
    };
    let scrollTicking = false;
    const onScrollThrottled = () => {
      if (scrollTicking) return;
      scrollTicking = true;
      window.setTimeout(() => { scrollTicking = false; onScroll(); }, 250);
    };
    window.addEventListener("scroll", onScrollThrottled, { passive: true });

    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("scroll", onScrollThrottled);
      activityEvents.forEach((ev) => document.removeEventListener(ev, onActivity));
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (idleRef.current) window.clearTimeout(idleRef.current);
    };
  }, [isHome, doShow]);

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
      body: JSON.stringify({ url: PRESAVE_URL, ts: Date.now(), variant: "return-popup" }),
    }).catch(() => {});
    setTimeout(close, 250);
  }, [close]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, close]);

  if (isPresaved() && !visible) return null;
  if (!visible) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Пресейв MAGNUM — золотая рамка"
      data-testid="return-popup"
      data-variant="return-popup"
      data-presave-bonus="42"
      onClick={(e) => { if (e.target === overlayRef.current) close(); }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 94,
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
          data-testid="return-popup-close"
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
            <span style={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.12em", color: "#ff2d55", textTransform: "uppercase" as const }}>MAGNUM • почти 42</span>
            <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", background: "#ffcc00", color: "#111", padding: "0.16rem 0.45rem", borderRadius: 999 }}>+42 монеты</span>
            <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", background: "linear-gradient(135deg,#ffd700,#ffcc00)", color: "#111", padding: "0.16rem 0.45rem", borderRadius: 999, border: "1px solid rgba(255,215,0,0.6)" }}>золотая рамка</span>
          </div>
          <strong style={{ fontSize: "1.22rem", fontWeight: 900, letterSpacing: "-0.03em", color: "#fff", lineHeight: 1.2 }}>
            Эй, братуха — ты почти в 42. Пресейв 1 клик → золотая рамка + 42 монетки.
          </strong>
          <span style={{ fontSize: "0.86rem", color: "rgba(240,240,240,0.62)", lineHeight: 1.5 }}>
            Один клик — и ты в 42 с золотой рамкой профиля + <strong style={{ color: "#ffcc00" }}>42 монеты</strong> бонусом. Бесплатно, уведомление в день дропа.
          </span>
          <a
            href={PRESAVE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handlePresave}
            data-testid="return-popup-cta"
            data-presave-bonus="42"
            data-variant="return-popup"
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
            ★ Пресейв 1 клик → <span style={{ background: "rgba(255,255,255,0.22)", padding: "0.12rem 0.4rem", borderRadius: 999, fontSize: "0.72rem" }}>+42</span>
          </a>
          <span style={{ fontSize: "0.72rem", color: "rgba(240,240,240,0.38)", textAlign: "center" as const }}>Бонус +42 и рамка — один раз · Никакого спама</span>
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
