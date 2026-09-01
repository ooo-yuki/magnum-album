import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { getStreakMultiplier } from "../lib/spinRewards";

// Show when user has 0 scores (activation fix: 12 users with daily14 but scores2)
// No localStorage — SPEC-42 p9 — dismiss in-memory per session only via /magnum/api/coins state

export function shouldShowReturnBanner(streak: number, scoresCount: number): boolean {
  // Spec: banner if 0 scores for session regardless of streak — activation 14% fix
  // Keep legacy streak gates as extra visibility but primary is 0 scores
  if (scoresCount === 0) return true;
  if (streak >= 7 && scoresCount <= 2) return true;
  if (streak >= 3 && scoresCount <= 1) return true;
  if (streak >= 2 && scoresCount === 0) return true;
  return false;
}

export function StreakChip({ streak, size = "sm" }: { streak: number; size?: "sm" | "md" }) {
  const m = getStreakMultiplier(streak);
  const isHot = m > 1;
  // sync with SpinWheel42 thresholds: 3→×2, 7→×3
  const label = m === 3 ? "×3" : m === 2 ? "×2" : "×1";
  const sub = streak >= 7 ? "7дн" : streak >= 3 ? "3дн" : `${streak}дн`;
  return (
    <span
      data-testid="return-streak-chip"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: size === "md" ? "0.28rem 0.7rem" : "0.2rem 0.55rem",
        borderRadius: 999,
        background: m === 3 ? "linear-gradient(90deg,#ffcc00,#ff9d1e)" : m === 2 ? "rgba(255,204,0,0.18)" : "rgba(255,255,255,0.07)",
        border: m === 3 ? "1px solid rgba(255,204,0,0.55)" : m === 2 ? "1px solid rgba(255,204,0,0.32)" : "1px solid rgba(255,255,255,0.10)",
        color: m === 3 ? "#111" : m === 2 ? "#ffcc00" : "rgba(255,255,255,0.72)",
        fontWeight: 900,
        fontSize: size === "md" ? "0.78rem" : "0.70rem",
        letterSpacing: "0.05em",
      }}
      title={`Стрик ${streak}дн — множитель ${label} (синхрон с Spin Wheel)`}
    >
      <span aria-hidden>{isHot ? "🔥" : "⚡"}</span> {sub} {label}
    </span>
  );
}

export function GameReturnBanner({ variant = "banner" }: { variant?: "banner" | "compact" }) {
  const [streak, setStreak] = useState<number | null>(null);
  const [scoresCount, setScoresCount] = useState<number | null>(null);
  const [presaveTotal, setPresaveTotal] = useState<number>(4);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const fetched = useRef(false);

  const fetchState = useCallback(async () => {
    if (dismissed) { setLoading(false); return; }
    try {
      const [dRes, gRes, pRes] = await Promise.all([
        fetch("/magnum/api/daily/status", { credentials: "include" }),
        fetch("/magnum/api/games/my?limit=50", { credentials: "include" }),
        fetch("/magnum/api/presave/stats", { credentials: "include" }),
      ]);
      let s: number | null = null;
      let c: number | null = null;
      if (dRes.ok) {
        const j = await dRes.json() as { streak?: number };
        s = Number(j.streak ?? 0) || 0;
      }
      if (gRes.ok) {
        const j = await gRes.json() as { count?: number; scores?: unknown[] };
        if (typeof j.count === "number") c = j.count;
        else if (Array.isArray(j.scores)) c = j.scores.length;
        else c = 0;
      } else if (gRes.status === 401) {
        // anon — don't show banner, but keep streak for chip if possible
        c = null;
      }
      if (pRes.ok) {
        const j = await pRes.json() as { total?: number };
        if (typeof j.total === "number") setPresaveTotal(j.total);
      }
      if (s !== null) setStreak(s);
      if (c !== null) setScoresCount(c);
      try {
        window.dispatchEvent(new CustomEvent("magnum:return-state", { detail: { streak: s, scoresCount: c } }));
      } catch {}
    } catch {
      // network fail -> hide silently
    } finally {
      setLoading(false);
    }
  }, [dismissed]);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    void fetchState();
    const onAuth = () => { fetched.current = false; setLoading(true); void fetchState(); };
    window.addEventListener("magnum:auth" as unknown as string, onAuth as EventListener);
    return () => window.removeEventListener("magnum:auth" as unknown as string, onAuth as EventListener);
  }, [fetchState]);

  const handleDismiss = useCallback(() => {
    // in-memory only, no localStorage per SPEC-42 p9
    setDismissed(true);
  }, []);

  if (loading || dismissed) return null;
  if (streak === null || scoresCount === null) return null;
  if (!shouldShowReturnBanner(streak, scoresCount)) return null;

  const is7 = streak >= 7;
  const m = getStreakMultiplier(streak);
  const dustClaim = 142; // SPEC: 142 dust for 1 game — via POST /magnum/api/coins/add or funnel_first_game
  const dropLabel = `${presaveTotal}/42`;

  if (variant === "compact") {
    return (
      <div data-testid="return-banner-compact" role="status" style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", padding:"0.55rem 0.7rem", borderRadius:999, background:"rgba(0,255,136,0.08)", border:"1px solid rgba(0,255,136,0.18)" }}>
        <StreakChip streak={streak} />
        <span style={{ fontSize:"0.78rem", fontWeight:800, color:"#fff" }}>Сыграй 1 игру — {dustClaim} dust + билет к дропу {dropLabel}</span>
        <span style={{ fontSize:"0.70rem", color:"rgba(255,255,255,0.55)" }}>{m>1?`· стрик ×${m}`:""}</span>
        <Link to="/magnum/games" data-testid="return-cta-games" style={{ marginLeft:"auto", background:"#00ff88", color:"#0a0a0a", borderRadius:999, padding:"0.32rem 0.7rem", fontWeight:900, fontSize:"0.74rem", textDecoration:"none" }}>Играть →</Link>
      </div>
    );
  }

  return (
    <div
      data-testid="return-banner"
      role="status"
      aria-live="polite"
      style={{
        maxWidth: 960,
        margin: "0 auto 1rem",
        padding: "0.95rem 1rem",
        borderRadius: 16,
        background: is7
          ? "linear-gradient(135deg, rgba(255,204,0,0.16), rgba(255,45,85,0.14), rgba(0,255,136,0.10))"
          : "linear-gradient(135deg, rgba(0,255,136,0.14), rgba(88,101,242,0.12))",
        border: is7 ? "1px solid rgba(255,204,0,0.32)" : "1px solid rgba(0,255,136,0.28)",
        boxShadow: is7
          ? "0 8px 32px rgba(0,0,0,0.22), 0 0 22px rgba(255,204,0,0.16)"
          : "0 8px 32px rgba(0,0,0,0.22), 0 0 18px rgba(0,255,136,0.14)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6, textAlign: "left" as const, flex: "1 1 240px", minWidth: 200 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <StreakChip streak={streak} size="md" />
          <span style={{ fontSize: "0.70rem", fontWeight: 700, color: "rgba(255,255,255,0.45)" }}>daily streak синкрон с Spin Wheel</span>
          {m > 1 && (
            <span style={{ fontSize: "0.70rem", fontWeight: 800, color: m===3 ? "rgba(255,204,0,0.95)" : "rgba(255,204,0,0.85)", letterSpacing: "0.04em" }}>
              · множитель ×{m} {m===3?"(7дн)":"(3дн)"}
            </span>
          )}
        </div>
        <strong style={{ fontSize: "0.94rem", fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.25 }}>
          Сыграй 1 игру — {dustClaim} dust + билет к дропу {dropLabel}
        </strong>
        <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.72)", lineHeight: 1.35 }}>
          Первая игра сегодня = <strong style={{ color: "#00ff88" }}>+{dustClaim} dust</strong> через <code style={{ fontSize:"0.72rem", background:"rgba(255,255,255,0.08)", padding:"1px 4px", borderRadius:4 }}>/magnum/api/coins</code> · билет к дропу 15.09 · {dropLabel} до золотой рамки
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
        <Link
          to="/magnum/games"
          data-testid="return-cta-games"
          style={{
            background: "#00ff88",
            color: "#0a0a0a",
            border: "1px solid #00ff88",
            borderRadius: 999,
            padding: "0.62rem 1.05rem",
            fontWeight: 900,
            fontSize: "0.82rem",
            textDecoration: "none",
            whiteSpace: "nowrap" as const,
            boxShadow: "0 6px 18px rgba(0,255,136,0.32)",
          }}
        >
          Играть → /magnum/games
        </Link>
        <Link
          to="/magnum/games/2042"
          data-testid="return-cta-2042"
          style={{
            background: "rgba(255,255,255,0.08)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 999,
            padding: "0.52rem 0.85rem",
            fontWeight: 800,
            fontSize: "0.78rem",
            textDecoration: "none",
            whiteSpace: "nowrap" as const,
          }}
        >
          2042
        </Link>
        <Link
          to="/magnum/games/runner"
          data-testid="return-cta-runner"
          style={{
            background: "rgba(255,255,255,0.08)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 999,
            padding: "0.52rem 0.85rem",
            fontWeight: 800,
            fontSize: "0.78rem",
            textDecoration: "none",
            whiteSpace: "nowrap" as const,
          }}
        >
          Runner
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Скрыть баннер"
          data-testid="return-banner-close"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#fff",
            fontSize: "1.05rem",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}

// Helper for chip outside banner (e.g., GamesHub header) — sync with daily + SpinWheel
export function useReturnStreakChip(): { streak: number | null; show: boolean } {
  const [st, setSt] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/magnum/api/daily/status", { credentials: "include" });
        if (!r.ok) return;
        const j = await r.json() as { streak?: number };
        const s = Number(j.streak ?? 0) || 0;
        if (!cancelled && s >= 1) setSt(s);
      } catch {}
    })();
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail as { streak?: number };
      if (typeof d?.streak === "number" && d.streak >= 1) setSt(d.streak);
    };
    window.addEventListener("magnum:return-state" as unknown as string, h as EventListener);
    return () => { cancelled = true; window.removeEventListener("magnum:return-state" as unknown as string, h as EventListener); };
  }, []);
  return { streak: st, show: st !== null && st >= 1 };
}
