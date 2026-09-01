import { useEffect, useState, useCallback, useRef } from "react";

const STORAGE_RECOVERY = "magnum_recovery_dismissed";
const STORAGE_VARIANT = "magnum_presave_variant";

type RecoveryState = {
  hasPresave: boolean;
  dailyStreak: number;
  dailyReady: boolean;
  needsRecovery: boolean;
  loading: boolean;
};

export function CTAPresaveRecovery() {
  const [state, setState] = useState<RecoveryState>({
    hasPresave: false,
    dailyStreak: 0,
    dailyReady: false,
    needsRecovery: false,
    loading: true,
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const fetched = useRef(false);

  const check = useCallback(async () => {
    // local dismiss
    try {
      if (localStorage.getItem(STORAGE_RECOVERY) === "1") {
        setDismissed(true);
        setState(s => ({ ...s, loading: false }));
        return;
      }
    } catch {}
    // variant flag — if b variant was old, recovery may be needed
    let variantFlag = false;
    try {
      const v = localStorage.getItem(STORAGE_VARIANT) ?? localStorage.getItem("ab_cta");
      variantFlag = v === "b" || v === "a";
    } catch {}
    void variantFlag;
    try {
      const [presaveRes, dailyRes] = await Promise.all([
        fetch("/magnum/api/presave/stats", { credentials: "include" }),
        fetch("/magnum/api/daily/status", { credentials: "include" }),
      ]);
      let hasPresave = false;
      let dailyStreak = 0;
      let canClaim = false;
      if (presaveRes.ok) {
        const j = (await presaveRes.json()) as { total?: number; myClicks?: number | null };
        if (typeof j.myClicks === "number" && j.myClicks > 0) hasPresave = true;
      }
      // anonymous fallback: local presave_done
      if (!hasPresave) {
        try { if (localStorage.getItem("presave_done") === "1") hasPresave = true; } catch {}
      }
      if (dailyRes.ok) {
        const d = (await dailyRes.json()) as { streak?: number; canClaim?: boolean; nextStreak?: number; nextReward?: number };
        dailyStreak = Number(d.streak ?? 0) || 0;
        canClaim = Boolean(d.canClaim);
        // if canClaim false but streak>0 we still have daily>=1
        // recovery visible when without presave but daily>=1
      } else {
        // not authed -> try daily not available, fallback dailyStreak 0
        dailyStreak = 0;
      }
      const needsRecovery = !hasPresave && dailyStreak >= 1;
      // also show if unauth but has local presave_done? then hasPresave true -> no banner
      // For anon without auth, daily is 0, so banner hidden (DoD: user без presave но с daily>=1)
      setState({ hasPresave, dailyStreak, dailyReady: !canClaim ? dailyStreak >= 1 : true, needsRecovery, loading: false });
      // streak bonus CTA handled separately via prop? we expose state for CTA Hero to consume via event
      try {
        window.dispatchEvent(new CustomEvent("magnum:recovery-state", { detail: { hasPresave, dailyStreak, needsRecovery } }));
      } catch {}
    } catch {
      setState(s => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    void check();
    const onAuth = () => void check();
    window.addEventListener("magnum:auth" as unknown as string, onAuth as EventListener);
    return () => window.removeEventListener("magnum:auth" as unknown as string, onAuth as EventListener);
  }, [check]);

  const handleRecover = async () => {
    if (busy || done) return;
    setBusy(true);
    try {
      const res = await fetch("/magnum/api/presave/recover-bonus", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; already?: boolean; dust?: number; balance?: number; error?: string };
      if (res.ok && j.ok) {
        setDone(true);
        try { localStorage.setItem(STORAGE_RECOVERY, "1"); localStorage.setItem("presave_done", "1"); } catch {}
        setToast(`+${j.dust ?? 142} dust за возврат — спасибо!`);
        try { window.dispatchEvent(new CustomEvent("magnum:recovery-done")); } catch {}
        setTimeout(() => setToast(null), 2800);
      } else if (j.already || j.error?.includes("already")) {
        setDone(true);
        try { localStorage.setItem(STORAGE_RECOVERY, "1"); } catch {}
        setToast("Уже получено");
        setTimeout(() => setToast(null), 2000);
      } else {
        setToast(j.error?.slice(0, 80) || "ошибка");
        setTimeout(() => setToast(null), 2000);
      }
    } catch {
      setToast("сеть — попробуй снова");
      setTimeout(() => setToast(null), 2000);
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = () => {
    try { localStorage.setItem(STORAGE_RECOVERY, "1"); } catch {}
    setDismissed(true);
  };

  if (state.loading || dismissed || done || !state.needsRecovery) return null;

  return (
    <div
      data-testid="presave-recovery-banner"
      role="status"
      aria-live="polite"
      style={{
        maxWidth: 960,
        margin: "0 auto 1.1rem",
        padding: "0.9rem 1rem",
        borderRadius: 16,
        background: "linear-gradient(135deg, rgba(255,45,85,0.16), rgba(255,204,0,0.14))",
        border: "1px solid rgba(255,45,85,0.28)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.22), 0 0 22px rgba(255,45,85,0.16)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4, textAlign: "left" as const }}>
        <strong style={{ fontSize: "0.92rem", fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>
          База обновилась — подтверди пресейв снова и получи +142 dust
        </strong>
        <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.72)", lineHeight: 1.35 }}>
          Одноразово для братух со стриком {state.dailyStreak}дн. Прогресс 2/42 до золотой рамки — твой клик важен.
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <button
          type="button"
          onClick={handleRecover}
          disabled={busy}
          data-testid="presave-recovery-cta"
          style={{
            background: "#ff2d55",
            color: "#fff",
            border: "1px solid #ff2d55",
            borderRadius: 999,
            padding: "0.55rem 1rem",
            fontWeight: 900,
            fontSize: "0.82rem",
            cursor: busy ? "wait" : "pointer",
            opacity: busy ? 0.7 : 1,
            whiteSpace: "nowrap" as const,
            boxShadow: "0 6px 18px rgba(255,45,85,0.35)",
          }}
        >
          {busy ? "…" : "Подтвердить +142"}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Скрыть баннер"
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
      {toast && (
        <div style={{ flexBasis: "100%", fontSize: "0.78rem", color: "#00ff88", fontWeight: 700, marginTop: 2 }}>{toast}</div>
      )}
    </div>
  );
}

// Helper for CTA/Hero streak bonus: fetch streak and presave, return CTA text
export function useStreakPresaveBonus(): { streak: number; hasPresave: boolean; cta: string | null; canClaimBonus: boolean } {
  const [s, setS] = useState({ streak: 0, hasPresave: false, cta: null as string | null, canClaimBonus: false });
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [pr, dr] = await Promise.all([
          fetch("/magnum/api/presave/stats", { credentials: "include" }).then(r => r.ok ? r.json() as Promise<{ myClicks?: number | null }> : null).catch(() => null),
          fetch("/magnum/api/daily/status", { credentials: "include" }).then(r => r.ok ? r.json() as Promise<{ streak?: number }> : null).catch(() => null),
        ]);
        let has = false;
        if (pr && typeof pr.myClicks === "number" && pr.myClicks > 0) has = true;
        try { if (!has && localStorage.getItem("presave_done") === "1") has = true; } catch {}
        const streak = Number(dr?.streak ?? 0) || 0;
        if (cancelled) return;
        if (streak >= 3 && has) setS({ streak, hasPresave: has, cta: `стрик ${streak}дн — +42 монетки`, canClaimBonus: true });
        else if (streak >= 3 && !has) setS({ streak, hasPresave: has, cta: "стрик 3дн — забери пресейв-бонус", canClaimBonus: false });
        else setS({ streak, hasPresave: has, cta: null, canClaimBonus: false });
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);
  return s;
}
