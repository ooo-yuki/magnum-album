import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { CosmeticAvatar, cosmeticName, type LeaderCosmetics } from "./CosmeticBadge";

const DISMISS_KEY = "duel-cta-dismissed";
const DISMISS_MS = 24 * 60 * 60 * 1000;

function isDismissed(): boolean {
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    if (!v) return false;
    const ts = Number(v);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_MS;
  } catch { return false; }
}

export function DuelCTA() {
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (isDismissed()) { setChecking(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/magnum/api/games/my?limit=100", { credentials: "include" });
        if (!r.ok) { if (!cancelled) setChecking(false); return; }
        const j = await r.json() as { scores?: Array<{ game: string; score: number }> };
        const scores = Array.isArray(j.scores) ? j.scores : [];
        // count games excluding duel/magnum meta? gameScores 1 => any game with score
        // exclude duel-family: if we already have duel, don't show
        const duelCount = scores.filter(s => s.game === "duel" || s.game === "duel42").length;
        if (duelCount > 0) { if (!cancelled) setChecking(false); return; }
        const gameCount = scores.filter(s => s.game !== "duel" && s.game !== "duel42").length;
        if (gameCount >= 1 && !isDismissed() && !cancelled) setVisible(true);
      } catch { /* ignore */ }
      finally { if (!cancelled) setChecking(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const dismiss = useCallback(() => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setVisible(false);
  }, []);

  if (checking || !visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Вызов на дуэль"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 95,
        display: "grid", placeItems: "center",
        background: "rgba(0,0,0,0.62)", backdropFilter: "blur(8px)",
        padding: "1rem",
      }}
      onClick={dismiss}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(440px, 100%)",
          borderRadius: 20,
          background: "rgba(16,16,18,0.98)",
          border: "1px solid rgba(255,45,85,0.22)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.55), 0 0 32px rgba(255,69,0,0.18)",
          overflow: "hidden",
        }}
      >
        <div style={{ height: 4, background: "linear-gradient(90deg,#ff4500,#ff0000,#ffcc00)", backgroundSize: "200% 100%" }} />
        <div style={{ padding: "1.2rem 1.2rem 1rem", display: "flex", flexDirection: "column", gap: "0.7rem" }}>
          <div style={{ fontSize: "1.35rem", lineHeight: 1 }}>🌋</div>
          <strong style={{ fontSize: "1.08rem", fontWeight: 900, color: "#fff", lineHeight: 1.25 }}>
            Сыграл? Вызови братуху на дуэль MAGMA x10
          </strong>
          <span style={{ fontSize: "0.86rem", color: "rgba(240,240,240,0.68)", lineHeight: 1.45 }}>
            ставка 42 dust · ELO + wager · 10с NITRO — кто быстрее тапает
          </span>
          <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.4rem" }}>
            <Link
              to="/magnum/mining#duel"
              onClick={dismiss}
              style={{
                flex: 1, textAlign: "center" as const, padding: "0.7rem 1rem", borderRadius: 100,
                background: "linear-gradient(135deg,#ff4500,#ff0000)", color: "#fff",
                fontWeight: 800, fontSize: "0.88rem", textDecoration: "none",
                boxShadow: "0 8px 20px rgba(255,69,0,0.32)",
              }}
            >
              Вызвать →
            </Link>
            <button
              onClick={dismiss}
              style={{
                padding: "0.7rem 1rem", borderRadius: 100,
                background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.10)",
                color: "rgba(255,255,255,0.85)", fontWeight: 700, fontSize: "0.84rem", cursor: "pointer",
              }}
            >
              Позже
            </button>
          </div>
          <span style={{ fontSize: "0.7rem", color: "rgba(240,240,240,0.35)", textAlign: "center" as const }}>
            подсказка скрыта на 24ч · ELO в Neon magnum_leaderboard duel42
          </span>
        </div>
      </div>
    </div>
  );
}

export function DuelTeaser() {
  const [top, setTop] = useState<Array<{ player: string; score: number; avatar?: string | null } & LeaderCosmetics>>([]);
  useEffect(() => {
    fetch("/magnum/api/duel42/leaderboard?limit=3", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.leaderboard) setTop(j.leaderboard.slice(0, 3)); })
      .catch(() => {});
  }, []);
  const hasReal = top.length > 0;
  return (
    <section
      aria-label="Дуэли 42 тизер"
      style={{
        maxWidth: 1120, margin: "0 auto", padding: "0.8rem 1rem",
      }}
    >
      <Link
        to="/magnum/mining#duel"
        style={{
          display: "flex", alignItems: "center", gap: "0.9rem",
          padding: "0.9rem 1rem",
          borderRadius: 18,
          background: "linear-gradient(135deg, rgba(255,69,0,0.14), rgba(255,0,80,0.10), rgba(255,204,0,0.08))",
          border: "1px solid rgba(255,69,0,0.22)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.28), 0 0 20px rgba(255,69,0,0.10)",
          textDecoration: "none",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: "1.6rem", filter: "drop-shadow(0 4px 16px rgba(255,69,0,0.3))" }}>🌋</span>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontWeight: 900, fontSize: "0.95rem", color: "#fff", letterSpacing: "-0.02em" }}>
            Дуэли 42: топ ELO — volcano-crown 👑
          </div>
          <div style={{ fontSize: "0.78rem", color: "rgba(240,240,240,0.58)", marginTop: 2 }}>
            {hasReal ? `${top.length} братух в топе · ворвись в тройку` : "ты можешь быть первым — 42 dust ставка, +ELO"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {(hasReal ? top : [{ player: "?" }, { player: "?" }, { player: "?" }]).slice(0, 3).map((p, i) => {
            const row = p as { player: string; avatar?: string | null } & LeaderCosmetics;
            const medal = i === 0 ? "👑" : i === 1 ? "🥈" : "🥉";
            return (
              <div
                key={i}
                style={{
                  width: 36, height: 36, borderRadius: 999,
                  background: i === 0 ? "linear-gradient(135deg,#ffcc00,#ff6b35)" : i === 1 ? "linear-gradient(135deg,#a8b0c0,#6b7280)" : "linear-gradient(135deg,#cd7f32,#8b4513)",
                  border: i === 0 ? "2px solid #ffcc00" : "1px solid rgba(255,255,255,0.18)",
                  boxShadow: i === 0 ? "0 0 14px rgba(255,204,0,0.55), 0 0 0 1px rgba(255,204,0,0.22)" : "0 4px 12px rgba(0,0,0,0.3)",
                  display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800, color: "#fff",
                  overflow: "hidden",
                }}
                title={[row.player ?? "?", cosmeticName(row.title), cosmeticName(row.frame), i === 0 ? "👑 volcano-crown" : null].filter(Boolean).join(" · ")}
              >
                {hasReal
                  ? <CosmeticAvatar avatar={row.avatar} frame={row.frame} size={32} fallback={medal} />
                  : <span>{medal}</span>}
              </div>
            );
          })}
          {!hasReal && (
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "rgba(255,255,255,0.62)", marginLeft: 4 }}>
              ты можешь быть первым
            </span>
          )}
        </div>
        <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#ff4500", whiteSpace: "nowrap" }}>В дуэль →</span>
      </Link>
    </section>
  );
}
