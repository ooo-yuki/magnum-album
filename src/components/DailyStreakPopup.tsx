import { useEffect, useRef, useState } from "react";

// Global daily streak popup — appears once per session after login if canClaim
export function DailyStreakPopup() {
  const [pop, setPop] = useState<null | { streak: number; reward: number }>(null);
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current) return;
    let cancelled = false;
    void (async () => {
      try {
        const me = await fetch("/magnum/api/auth/me", { credentials: "include" });
        if (!me.ok) return;
        const j = await me.json() as { user?: unknown };
        if (!j.user) return;
        const r = await fetch("/magnum/api/daily/status", { credentials: "include" });
        if (!r.ok || cancelled) return;
        const d = await r.json() as { canClaim?: boolean; streak?: number; nextReward?: number };
        if (d.canClaim) {
          shown.current = true;
          window.setTimeout(() => { if (!cancelled) setPop({ streak: d.streak ?? 0, reward: d.nextReward ?? 42 }); }, 1100);
        }
      } catch {}
    })();
    const onAuth = () => {
      if (shown.current) return;
      void (async () => {
        try {
          const r = await fetch("/magnum/api/daily/status", { credentials: "include" });
          if (!r.ok) return;
          const d = await r.json() as { canClaim?: boolean; streak?: number; nextReward?: number };
          if (d.canClaim) setPop({ streak: d.streak ?? 0, reward: d.nextReward ?? 42 });
        } catch {}
      })();
    };
    window.addEventListener("magnum:auth" as unknown as string, onAuth as EventListener);
    return () => { cancelled = true; window.removeEventListener("magnum:auth" as unknown as string, onAuth as EventListener); };
  }, []);
  async function claim() {
    try { await fetch("/magnum/api/daily/claim", { method: "POST", credentials: "include" }); } catch {}
    setPop(null);
  }
  if (!pop) return null;
  return (
    <div role="dialog" aria-modal="true" onClick={() => setPop(null)} style={{ position: "fixed", inset: 0, zIndex: 9997, background: "rgba(0,0,0,0.58)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "min(360px,92vw)", background: "#121214", border: "1px solid #23232b", borderRadius: 16, padding: 18, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,.6)" }}>
        <div style={{ fontSize: 28 }}>🔥</div>
        <h3 style={{ margin: "6px 0 4px", fontWeight: 900, fontSize: 16 }}>Дейли стрик x{pop.streak + 1} — +{pop.reward} монет</h3>
        <p style={{ margin: 0, fontSize: 12, opacity: 0.72 }}>Ежедневный бонус — стрик до 7. Забери и фарми в /magnum/eco</p>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button type="button" onClick={claim} style={{ flex: 1, background: "#ff2d55", color: "#fff", border: "1px solid #ff2d55", borderRadius: 10, padding: "9px 10px", fontWeight: 800, cursor: "pointer" }}>Забрать +{pop.reward}</button>
          <button type="button" onClick={() => setPop(null)} style={{ flex: 1, background: "transparent", color: "#9aa4b2", border: "1px solid #23232b", borderRadius: 10, padding: "9px 10px", cursor: "pointer" }}>Позже</button>
        </div>
        <a href="/magnum/eco" onClick={() => setPop(null)} style={{ display: "block", marginTop: 10, fontSize: 12, color: "#78dcff", textDecoration: "none" }}>→ Эко-рейтинг и стрик 7дн</a>
      </div>
    </div>
  );
}
