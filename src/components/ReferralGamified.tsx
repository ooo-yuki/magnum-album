import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { endowedProgress, nextTierInfo, REFERRAL_TIERS, REFERRAL_BADGES, calcStreakMonths, type ReferralBadgeId } from "../lib/referralGamification";

type State = {
  code: string | null;
  invitedCount: number;
  endowed: ReturnType<typeof endowedProgress> | null;
  nextTier: ReturnType<typeof nextTierInfo>;
  badges: string[];
  streakLen: number;
  deepLink: string | null;
  authed: boolean | null;
};

export function ReferralGamified() {
  const [s, setS] = useState<State>({ code: null, invitedCount: 0, endowed: null, nextTier: { next: null, remain: 0 }, badges: [], streakLen: 0, deepLink: null, authed: null });
  const barRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/magnum/api/referral/code", { credentials: "include" });
      if (r.status === 401) { setS(x => ({ ...x, authed: false })); return; }
      if (!r.ok) return;
      const j = await r.json();
      const cnt = Number(j.invitedCount ?? 0);
      setS({ code: String(j.code ?? ""), invitedCount: cnt, endowed: j.endowed ?? endowedProgress(cnt), nextTier: j.nextTier ?? nextTierInfo(cnt), badges: (j.badges as string[]) ?? [], streakLen: Number(j.streakLen ?? 0), deepLink: String(j.deepLink ?? ""), authed: true });
    } catch {}
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (barRef.current && s.endowed) gsap.to(barRef.current, { width: `${s.endowed.pct}%`, duration: 0.7, ease: "power2.out" });
    if (cardRef.current) { gsap.fromTo(cardRef.current, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "power2.out" }); }
  }, [s.endowed?.pct]);

  if (s.authed === false) return <div data-testid="referral-gamified" style={{ padding: 16, border: "1px dashed rgba(255,204,0,0.25)", borderRadius: 16 }}>Войди чтобы получить БРАТУХА-КОД</div>;
  if (!s.code) return <div data-testid="referral-gamified">загрузка…</div>;

  const pct = s.endowed?.pct ?? 20;
  return (
    <div ref={cardRef} data-testid="referral-gamified" style={{ padding: 16, borderRadius: 16, background: "rgba(16,16,18,0.98)", border: "1px solid rgba(255,204,0,0.28)", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>БРАТУХА-КОД: {s.code}</strong>
        <button data-testid="referral-gamified-copy" onClick={async () => { await navigator.clipboard.writeText(s.code!); window.dispatchEvent(new CustomEvent("magnum:first-invite")); }}>Копировать</button>
      </div>
      {s.deepLink && <div style={{ fontSize: 12, opacity: 0.7, wordBreak: "break-all" }} data-testid="referral-gamified-link">{s.deepLink}</div>}
      <div>
        <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 6 }}>{s.endowed?.label ?? `1/5 до награды`} · {pct}%</div>
        <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div ref={barRef} data-testid="referral-gamified-bar" style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#ffcc00,#ff2d55)", borderRadius: 999 }} />
        </div>
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>Начни с 1/5 — 进度 уже есть (endowed progress)</div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} data-testid="referral-gamified-tiers">
        {REFERRAL_TIERS.map(t => {
          const done = s.invitedCount >= t.n;
          return <span key={t.n} data-testid={`tier-${t.n}`} style={{ padding: "6px 10px", borderRadius: 999, fontSize: 12, background: done ? "rgba(0,255,136,0.15)" : "rgba(255,255,255,0.06)", border: `1px solid ${done ? "#00ff88" : "rgba(255,255,255,0.12)"}` }}>{t.label} {done ? "✓" : `· +${t.dust} dust`}</span>;
        })}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} data-testid="referral-gamified-badges">
        {(Object.keys(REFERRAL_BADGES) as ReferralBadgeId[]).map(id => {
          const b = REFERRAL_BADGES[id]; const earned = s.badges.includes(id);
          return <span key={id} data-testid={`badge-${id}`} title={b.desc} style={{ padding: "6px 10px", borderRadius: 10, fontSize: 12, background: earned ? "rgba(255,204,0,0.18)" : "rgba(255,255,255,0.04)", opacity: earned ? 1 : 0.45 }}>{b.icon} {b.title}{earned ? " ✓" : ""}</span>;
        })}
      </div>
      <div data-testid="referral-gamified-streak" style={{ fontSize: 12, opacity: 0.85, padding: "8px 10px", borderRadius: 10, background: s.streakLen >= 3 ? "rgba(255,204,0,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${s.streakLen >= 3 ? "rgba(255,204,0,0.35)" : "rgba(255,255,255,0.08)"}` }}>
        Стрик: {s.streakLen}/3 мес · приведи 1 братуху в месяц 3 месяца → VIP
        {s.nextTier.next && <span style={{ marginLeft: 8, opacity: 0.7 }}>до {s.nextTier.next.label} осталось {s.nextTier.remain}</span>}
      </div>
      <div style={{ fontSize: 11, opacity: 0.55 }}>Первый инвайт = +142 dust обоим · deeplink ?ref={s.code}</div>
    </div>
  );
}
