import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";

const STORAGE_DISMISS = "magnum:first-game-banner-dismissed";

export function FirstGameBanner() {
  const [visible, setVisible] = useState(false);
  const [checked, setChecked] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Was gated >24h (daily 20 vs gameScores 0 — users mined but never saw CTA). Now: 0 scores → show immediately (session dismiss only).
  useEffect(() => {
    let cancelled = false;
    try {
      if (sessionStorage.getItem(STORAGE_DISMISS) === "1") return;
    } catch {}
    (async () => {
      try {
        const [gRes, meRes] = await Promise.all([
          fetch("/magnum/api/games/my?limit=1", { credentials: "include" }),
          fetch("/magnum/api/auth/me", { credentials: "include" }).catch(() => null as unknown as Response),
        ]);
        if (cancelled) return;
        let count = 0;
        let loggedIn = false;
        if (gRes) {
          if (gRes.status === 401) {
            loggedIn = false;
          } else if (gRes.ok) {
            loggedIn = true;
            const j = await gRes.json() as { count?: number; scores?: unknown[] };
            count = typeof j.count === "number" ? j.count : Array.isArray(j.scores) ? j.scores.length : 0;
          } else {
            setChecked(true);
            return;
          }
        }
        // consume meRes to avoid unhandled but not gating on hoursSinceReg anymore
        if (meRes && meRes.ok) {
          try { await meRes.json(); loggedIn = true; } catch { loggedIn = true; }
        }
        if (loggedIn) {
          if (count !== 0) { setChecked(true); return; }
          setVisible(true);
          setChecked(true);
          return;
        }
        // anon: 1st visit without gameScores — show if presave funnel OR generic first-visit CTA
        // Check presave_done / bridge first, but even cold anon with 0 scores gets banner (funnel daily+mining → game)
        try {
          const done = localStorage.getItem("presave_done") === "1" || sessionStorage.getItem("magnum:post-presave-bridge-at") || localStorage.getItem("magnum:post-presave-bridge-at");
          if (done) { setVisible(true); setChecked(true); return; }
        } catch {}
        // anon without presave — still show generic first-game CTA on 1st visit (no 24h wait)
        setVisible(true);
        setChecked(true);
      } catch {
        setChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!visible || !ref.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;
    const el = ref.current;
    gsap.set(el, { y: 16, opacity: 0 });
    gsap.to(el, { y: 0, opacity: 1, duration: 0.52, ease: "power2.out" });
    // pulse glow
    const glow = el.querySelector<HTMLElement>("[data-glow]");
    if (glow) {
      gsap.to(glow, { opacity: 0.85, duration: 1.6, repeat: -1, yoyo: true, ease: "sine.inOut" });
    }
  }, [visible]);

  const dismiss = useCallback(() => {
    const el = ref.current;
    try { sessionStorage.setItem(STORAGE_DISMISS, "1"); } catch {}
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(false);
      return;
    }
    gsap.to(el, { y: -10, opacity: 0, duration: 0.28, ease: "power2.in", onComplete: () => setVisible(false) });
  }, []);

  if (!checked || !visible) return null;

  return (
    <div
      ref={ref}
      data-testid="first-game-banner"
      role="region"
      aria-label="Первая игра — 42 dust"
      style={{
        position: "relative",
        maxWidth: 1120,
        margin: "1rem auto",
        padding: "1rem 1.1rem",
        borderRadius: 18,
        background: "rgba(16,16,18,0.96)",
        border: "1px solid rgba(255,204,0,0.32)",
        boxShadow: "0 0 0 1px rgba(255,204,0,0.12), 0 12px 40px rgba(0,0,0,0.45), 0 0 28px rgba(255,204,0,0.18), 0 0 22px rgba(255,45,85,0.10)",
        overflow: "hidden",
        isolation: "isolate" as const,
      }}
    >
      <div
        data-glow=""
        aria-hidden
        style={{
          position: "absolute",
          inset: -1,
          borderRadius: 18,
          background: "linear-gradient(135deg, rgba(255,45,85,0.18) 0%, rgba(255,204,0,0.22) 52%, rgba(0,255,136,0.14) 100%)",
          opacity: 0.42,
          filter: "blur(14px)",
          zIndex: -1,
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,#ff2d55,#ffcc00,#00ff88)", opacity: 0.95 }} />

      <button
        onClick={dismiss}
        aria-label="Закрыть баннер"
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          width: 28,
          height: 28,
          borderRadius: 999,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.62)",
          fontSize: "1rem",
          lineHeight: 1,
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
        }}
      >
        ×
      </button>

      <div style={{ display: "flex", gap: "0.9rem", alignItems: "center", flexWrap: "wrap", paddingRight: "2rem" }}>
        <span style={{ fontSize: "2rem", lineHeight: 1, filter: "drop-shadow(0 4px 18px rgba(255,204,0,0.35))" }}>🎮</span>
        <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: "0.22rem" }}>
          <strong style={{ fontSize: "1.05rem", fontWeight: 900, letterSpacing: "-0.02em", color: "#fff", lineHeight: 1.15 }}>
            Сыграй 1 игру → <span style={{ color: "#ffcc00" }}>42 dust</span>
          </strong>
          <span style={{ fontSize: "0.82rem", color: "rgba(240,240,240,0.62)", lineHeight: 1.35 }}>
            Первая игра — пыль на крафт FORGE/PRISM. 42 секунды в Dodge42 или Карта 42 — и награда твоя.
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <Link
            to="/magnum/games/dodge?from=first-game"
            onClick={() => { try { sessionStorage.setItem(STORAGE_DISMISS,"1"); } catch {} }}
            data-testid="first-game-cta-dodge"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "0.62rem 1.05rem",
              borderRadius: 999,
              background: "#ffcc00",
              color: "#111",
              fontWeight: 900,
              fontSize: "0.84rem",
              textDecoration: "none",
              boxShadow: "0 8px 22px rgba(255,204,0,0.32)",
              whiteSpace: "nowrap" as const,
            }}
          >
            ИГРАТЬ Dodge42 →
          </Link>
          <Link
            to="/magnum/map?from=first-game"
            onClick={() => { try { sessionStorage.setItem(STORAGE_DISMISS,"1"); } catch {} }}
            data-testid="first-game-cta-map"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "0.6rem 0.95rem",
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#fff",
              fontWeight: 800,
              fontSize: "0.82rem",
              textDecoration: "none",
              whiteSpace: "nowrap" as const,
            }}
          >
            Карта 42
          </Link>
        </div>
      </div>
      <div style={{ marginTop: "0.65rem", display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
        <Link to="/magnum/games" style={{ fontSize: "0.74rem", fontWeight: 700, color: "rgba(240,240,240,0.48)", textDecoration: "none" }}>
          Все 16 игр →
        </Link>
        <span style={{ fontSize: "0.72rem", color: "rgba(240,240,240,0.28)" }}>· 1 визит без gameScores · +42 dust на первую победу</span>
      </div>
    </div>
  );
}
