import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { BANNER_CATALOG, getPityDisplay, getPityLegendaryDisplay, softPityCurve } from "../lib/gacha";
import { QUEST_DEFS, WEEKLY_DEF, weekId as gachaWeekId } from "../lib/gachaQuests";
import { GachaReveal, type RevealItem } from "../components/GachaReveal";

type Banner = { id: string; name: string; type: "standard" | "event"; endsAt: string; rateUpId: string | null };

function formatTimer(endsAt: string, now: number): string {
  const diff = Math.max(0, new Date(endsAt).getTime() - now);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type PityState = { counter: number; pity5star: number; lost5050: boolean; pulls: number };
type QuestProgress = { questId: string; progress: number; target: number; claimed: boolean; completed: boolean };
type QuestsData = {
  daily: QuestProgress[];
  weekly: QuestProgress | null;
  weekId: string;
  comeback: { eligible: boolean; days: number };
};

export function GachaPage() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [banners, setBanners] = useState<Banner[]>(() => BANNER_CATALOG.map(b => ({ id: b.id, name: b.name, type: b.type, endsAt: b.endsAt, rateUpId: b.rateUpId })));
  const [now, setNow] = useState(() => Date.now());
  const [balance, setBalance] = useState<number | null>(null);
  const [dust, setDust] = useState<number | null>(null);
  const [pity, setPity] = useState<PityState | null>(null);
  const [history, setHistory] = useState<Array<{ cosmetic_id: string; rarity: string; banner_type: string; created_at: string }>>([]);
  const [quests, setQuests] = useState<QuestsData | null>(null);
  const [msg, setMsg] = useState("");
  const [coupon, setCoupon] = useState("");
  const [couponMsg, setCouponMsg] = useState("");
  const [reveal, setReveal] = useState<RevealItem[] | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [needAuth, setNeedAuth] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const fetchBanners = useCallback(async () => {
    try {
      const r = await fetch("/magnum/api/gacha/banners", { credentials: "include" });
      const j = await r.json() as { banners?: Banner[] };
      if (Array.isArray(j.banners) && j.banners.length) setBanners(j.banners);
    } catch {}
  }, []);

  const fetchPity = useCallback(async () => {
    try {
      // try new pity endpoint, fallback to status for both banners
      const r = await fetch("/magnum/api/gacha/pity", { credentials: "include" });
      if (r.status === 401) { setNeedAuth(true); return; }
      if (r.ok) {
        const j = await r.json() as { pity?: { counter?: number; pityCounter?: number; pity_5star?: number; pity5star?: number; lost_50_50?: boolean; lost5050?: boolean; pulls?: number }; guaranteeIn?: { epic?: number; legendary?: number } };
        if (j.pity) {
          setPity({
            counter: Number(j.pity.counter ?? j.pity.pityCounter ?? 0),
            pity5star: Number(j.pity.pity_5star ?? j.pity.pity5star ?? 0),
            lost5050: Boolean(j.pity.lost_50_50 ?? j.pity.lost5050 ?? false),
            pulls: Number(j.pity.pulls ?? 0),
          });
          return;
        }
      }
      // fallback to status?banner=standard
      const rs = await fetch("/magnum/api/gacha/status?banner=standard", { credentials: "include" });
      if (rs.ok) {
        const j2 = await rs.json() as { pity?: { counter?: number; pityCounter?: number; pity_5star?: number; pity5star?: number; lost_50_50?: boolean; pulls?: number } };
        if (j2.pity) setPity({
          counter: Number(j2.pity.counter ?? j2.pity.pityCounter ?? 0),
          pity5star: Number(j2.pity.pity_5star ?? j2.pity.pity5star ?? 0),
          lost5050: Boolean((j2.pity as unknown as { lost_50_50: boolean }).lost_50_50 ?? false),
          pulls: Number((j2.pity as unknown as { pulls: number }).pulls ?? 0),
        });
      }
    } catch {}
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const r = await fetch("/magnum/api/gacha/history", { credentials: "include" });
      const j = await r.json() as { history?: typeof history };
      if (Array.isArray(j.history)) setHistory(j.history.slice(0, 10));
    } catch {}
  }, []);

  const fetchBalance = useCallback(async () => {
    try {
      const r = await fetch("/magnum/api/coins", { credentials: "include" });
      const j = await r.json() as { balance?: number; coins?: number };
      const v = j.balance ?? j.coins;
      if (typeof v === "number") setBalance(v);
    } catch {}
  }, []);

  const fetchDust = useCallback(async () => {
    try {
      const r = await fetch("/magnum/api/shop/dust", { credentials: "include" });
      if (!r.ok) return;
      const j = await r.json() as { balance?: number; dust?: number };
      const v = j.balance ?? j.dust;
      if (typeof v === "number") setDust(v);
    } catch {}
  }, []);

  const fetchQuests = useCallback(async () => {
    try {
      const r = await fetch("/magnum/api/gacha/quests", { credentials: "include" });
      if (r.ok) {
        const j = await r.json() as { daily?: QuestProgress[]; weekly?: QuestProgress; weekId?: string; comeback?: { eligible: boolean; days: number }; quests?: QuestProgress[] };
        if (Array.isArray(j.daily) || j.weekly || j.comeback) {
          setQuests({
            daily: Array.isArray(j.daily) ? j.daily : (Array.isArray(j.quests) ? j.quests.filter(q => q.questId.startsWith("daily")) : []),
            weekly: j.weekly ?? (Array.isArray(j.quests) ? j.quests.find(q => q.questId === WEEKLY_DEF.id) ?? null : null),
            weekId: j.weekId ?? gachaWeekId(),
            comeback: j.comeback ?? { eligible: false, days: 0 },
          });
          return;
        }
      }
      // fallback: build placeholder from local QUEST_DEFS so UI still shows structure
      if (r.status === 404 || !r.ok) {
        setQuests({
          daily: QUEST_DEFS.map(q => ({ questId: q.id, progress: 0, target: q.target, claimed: false, completed: false })),
          weekly: { questId: WEEKLY_DEF.id, progress: 0, target: WEEKLY_DEF.target, claimed: false, completed: false },
          weekId: gachaWeekId(),
          comeback: { eligible: false, days: 0 },
        });
        // try secondary: fetch comeback eligibility via last activity heuristic — don't block
        try {
          const rc = await fetch("/magnum/api/auth/me", { credentials: "include" });
          if (rc.ok) {
            const uj = await rc.json() as { user?: { created_at?: string } };
            // if no comeback endpoint, keep false — banner hidden
          }
        } catch {}
      }
    } catch {
      setQuests({
        daily: QUEST_DEFS.map(q => ({ questId: q.id, progress: 0, target: q.target, claimed: false, completed: false })),
        weekly: { questId: WEEKLY_DEF.id, progress: 0, target: WEEKLY_DEF.target, claimed: false, completed: false },
        weekId: gachaWeekId(),
        comeback: { eligible: false, days: 0 },
      });
    }
  }, []);

  useEffect(() => { fetchBanners(); fetchPity(); fetchHistory(); fetchBalance(); fetchDust(); fetchQuests(); }, [fetchBanners, fetchPity, fetchHistory, fetchBalance, fetchDust, fetchQuests]);

  // GSAP y:-20->0 appearance + prefers-reduced-motion gate
  useEffect(() => {
    if (!wrapRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (wrapRef.current) gsap.set(wrapRef.current, { clearProps: "all" });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.set(wrapRef.current, { y: -20, opacity: 0 });
      gsap.to(wrapRef.current, { y: 0, opacity: 1, duration: 0.52, ease: "power2.out", overwrite: true });
    }, wrapRef);
    return () => ctx.revert();
  }, []);

  async function doRoll(bannerId: string, count: 1 | 10) {
    setMsg(""); setNeedAuth(false); setLoading(bannerId + ":" + count);
    try {
      const r = await fetch("/magnum/api/gacha/roll", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banner: bannerId === "magma-frost" ? "event" : "standard", count }),
      });
      const j = await r.json() as { error?: string; results?: Array<{ id: string; rarity: string; isNew: boolean; dust: number }>; balance?: number; pity?: { counter: number; pityCounter?: number; pity5star?: number; pity_5star?: number; lost_50_50?: boolean }; needAuth?: boolean; dust?: number };
      if (r.status === 401) {
        setNeedAuth(true);
        setMsg("Войди, братуха — нужен magnum:need-auth");
        return;
      }
      if (r.status === 402) { setMsg(j.error || "Недостаточно монет (402)"); return; }
      if (r.status === 429) { setMsg(j.error || "Превышен лимит (429)"); return; }
      if (!r.ok) { setMsg(j.error || "Ошибка крутки"); return; }
      if (Array.isArray(j.results)) {
        setReveal(j.results.map(x => ({ id: String(x.id), rarity: x.rarity as RevealItem["rarity"], isNew: Boolean(x.isNew), dust: Number(x.dust || 0) })));
      }
      if (typeof j.balance === "number") setBalance(j.balance);
      if (typeof j.dust === "number") setDust(j.dust);
      else fetchDust();
      if (j.pity) {
        const c = Number((j.pity as unknown as { counter: number }).counter ?? (j.pity as unknown as { pityCounter: number }).pityCounter ?? 0);
        const p5 = Number((j.pity as unknown as { pity5star: number }).pity5star ?? (j.pity as unknown as { pity_5star: number }).pity_5star ?? 0);
        const lost = Boolean((j.pity as unknown as { lost_50_50: boolean }).lost_50_50 ?? false);
        setPity(prev => ({ counter: c, pity5star: p5, lost5050: lost, pulls: prev?.pulls ?? 0 }));
      } else fetchPity();
      fetchHistory();
      setMsg(count === 1 ? "Крутка x1 — удачи, братуха!" : "Крутка x10 — погнали!");
    } catch {
      setMsg("Сеть — попробуй ещё");
    } finally { setLoading(null); }
  }

  async function doFreeRoll() {
    setMsg(""); setNeedAuth(false);
    try {
      const r = await fetch("/magnum/api/gacha/free-roll", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const j = await r.json() as { error?: string; results?: RevealItem[]; balance?: number };
      if (r.status === 401) { setNeedAuth(true); setMsg("Войди — нужен magnum:need-auth"); return; }
      if (r.status === 429) { setMsg(j.error || "1/день — уже крутил"); return; }
      if (!r.ok) { setMsg(j.error || "Ошибка"); return; }
      if (Array.isArray((j as unknown as { results: RevealItem[] }).results)) setReveal((j as unknown as { results: RevealItem[] }).results);
      if (typeof j.balance === "number") setBalance(j.balance);
      fetchHistory(); fetchPity(); fetchDust(); setMsg("Бесплатная крутка — за streak 7!");
    } catch { setMsg("Сеть"); }
  }

  async function doRedeemCoupon() {
    const code = coupon.trim().toUpperCase();
    if (!code) { setCouponMsg("Введи код"); return; }
    setCouponMsg("…");
    try {
      const r = await fetch("/magnum/api/promo/redeem", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const j = await r.json() as { error?: string; ok?: boolean; reward?: number; balance?: number; code?: string };
      if (r.status === 401) { setCouponMsg("Войди — нужен magnum:need-auth"); return; }
      if (r.status === 404) { setCouponMsg("Код не найден (404)"); return; }
      if (r.status === 409) {
        const already = String(j.error || "").includes("already") ? "Уже активирован (409)" : (j.error || "409 — уже/распродано");
        setCouponMsg(already); return;
      }
      if (!r.ok) { setCouponMsg(j.error || "Ошибка купона"); return; }
      setCouponMsg(`✓ ${code} — +${j.reward ?? 0} • баланс ${j.balance ?? ""}`.trim());
      if (typeof j.balance === "number") setBalance(j.balance);
      // GACHADUST gives dust, refresh dust; GACHA42 may give rolls/dust — refresh both
      fetchDust(); fetchBalance(); fetchPity();
      if (code === "GACHA42") {
        // spec: 10× roll or 420 dust — server gives coins 0 but we still refresh; show hint
        setMsg("GACHA42 — забирай крутки!");
      }
      if (code === "GACHADUST") setMsg("GACHADUST — пыль зачислена +420");
    } catch { setCouponMsg("Сеть"); }
  }

  const pityText = pity ? getPityDisplay(pity.counter) : "гарант через 90";
  const pityLegendaryText = pity ? getPityLegendaryDisplay(pity.pity5star) : "легендарка через 180";
  const epicLeft = pity ? Math.max(0, 90 - pity.counter - 1) : 90;
  const legendaryLeft = pity ? Math.max(0, 180 - pity.pity5star - 1) : 180;
  const legendaryChance = pity ? softPityCurve(pity.pity5star) : 0.006;
  const isSoftPity = pity ? pity.pity5star >= 65 : false;
  const chancePct = (legendaryChance * 100).toFixed(2);

  return (
    <div ref={wrapRef} style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em" }}>GACHA 42 <span style={{ opacity: 0.6, fontSize: 14, fontWeight: 600 }}>— витрина кейсов</span></h1>
      <p style={{ opacity: 0.7, marginTop: 6, fontSize: 13 }}>Крутки 42/420 • только косметика/dust • 3×common→rare • до гаранта эпика: {pityText} • {pityLegendaryText}</p>

      {/* top vitrine bar: coins + dust + pity both + 50/50 + chance */}
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12 }}>Баланс: {balance ?? "…"} монет</span>
        <span style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.22)", fontSize: 12, display: "inline-flex", gap: 6, alignItems: "center" }}>
          <span>Пыль: {dust ?? "…"} </span>
          <Link to="/magnum/shop" style={{ color: "#a855f7", textDecoration: "underline", fontWeight: 800, fontSize: 11 }}>→ /shop#dust</Link>
        </span>
        <span style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(255,204,0,0.12)", border: "1px solid rgba(255,204,0,0.22)", fontSize: 12 }}>до эпика 90: {epicLeft} {epicLeft === 0 ? "— гарант!" : ""}</span>
        <span style={{ padding: "6px 10px", borderRadius: 8, background: isSoftPity ? "rgba(255,45,85,0.18)" : "rgba(255,204,0,0.10)", border: isSoftPity ? "1px solid rgba(255,45,85,0.35)" : "1px solid rgba(255,204,0,0.18)", fontSize: 12, fontWeight: isSoftPity ? 800 : 600, color: isSoftPity ? "#ff2d55" : undefined, boxShadow: isSoftPity ? "0 0 10px rgba(255,45,85,0.35)" : undefined }}>
          до легендарки 180: {legendaryLeft} {legendaryLeft === 0 ? "— гарант!" : ""}
        </span>
        <span title={isSoftPity ? `soft-pity с 65: шанс легендарки ${chancePct}%` : `шанс легендарки ${chancePct}%`} style={{ padding: "6px 10px", borderRadius: 8, background: isSoftPity ? "rgba(255,45,85,0.14)" : "rgba(255,255,255,0.06)", border: isSoftPity ? "1px solid rgba(255,45,85,0.28)" : "1px solid rgba(255,255,255,0.08)", fontSize: 12, fontWeight: isSoftPity ? 800 : 600 }}>
          шанс легендарки: {chancePct}% {isSoftPity ? "🔥 soft-pity 65+" : ""}
        </span>
        <span style={{ padding: "6px 10px", borderRadius: 8, background: pity?.lost5050 ? "rgba(0,255,136,0.14)" : "rgba(88,101,242,0.14)", border: pity?.lost5050 ? "1px solid rgba(0,255,136,0.28)" : "1px solid rgba(88,101,242,0.28)", fontSize: 12, fontWeight: 800 }}>
          50/50: {pity?.lost5050 ? "Гарант ивента ✓" : "50/50"}
        </span>
        {needAuth && <span style={{ color: "#ff2d55", fontSize: 12 }}>magnum:need-auth</span>}
      </div>

      {/* links to pass + shop */}
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <Link to="/magnum/shop" style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12, color: "#fff", textDecoration: "none" }}>Магазин пыли → /shop</Link>
        {/* pass not yet routed — link still per spec; fallback handled by SPA */}
        <Link to="/magnum/pass" style={{ padding: "6px 10px", borderRadius: 8, background: "linear-gradient(135deg,#a855f7, #5865f2)", border: "1px solid rgba(168,85,247,0.35)", fontSize: 12, color: "#fff", textDecoration: "none", fontWeight: 800 }}>Пропуск 42 → /pass FREE/PREMIUM</Link>
        <Link to="/magnum/shop#dust" style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.22)", fontSize: 12, color: "#d8b4fe", textDecoration: "none" }}>Обменник пыли</Link>
      </div>

      {/* quests progress 3 daily + weekly + weekId */}
      {quests && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", opacity: 0.9 }}>КВЕСТЫ 42 — {quests.weekId} (weekId)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 10, marginTop: 10 }}>
            {quests.daily.map(q => {
              const def = QUEST_DEFS.find(d => d.id === q.questId);
              const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
              return (
                <div key={q.questId} style={{ padding: 10, borderRadius: 10, background: q.completed ? "rgba(0,255,136,0.08)" : "rgba(255,255,255,0.04)", border: q.completed ? "1px solid rgba(0,255,136,0.18)" : "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 11, fontWeight: 800 }}>{def?.icon ?? "⚔️"} {def?.title ?? q.questId} — {q.progress}/{q.target}</div>
                  <div style={{ marginTop: 6, height: 6, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: q.completed ? "#00ff88" : "#5865f2" }} /></div>
                  <div style={{ marginTop: 4, fontSize: 11, opacity: 0.7 }}>{q.completed ? (q.claimed ? "Забрано ✓" : "Готово — забирай крутку") : def?.desc ?? ""}</div>
                </div>
              );
            })}
            {quests.weekly && (
              <div style={{ padding: 10, borderRadius: 10, background: quests.weekly.completed ? "rgba(255,204,0,0.08)" : "rgba(255,255,255,0.04)", border: quests.weekly.completed ? "1px solid rgba(255,204,0,0.22)" : "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 11, fontWeight: 800 }}>{WEEKLY_DEF.icon} {WEEKLY_DEF.title} — {quests.weekly.progress}/{quests.weekly.target}</div>
                <div style={{ marginTop: 6, height: 6, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}><div style={{ width: `${Math.min(100, Math.round((quests.weekly.progress / quests.weekly.target) * 100))}%`, height: "100%", background: quests.weekly.completed ? "#ffcc00" : "#a855f7" }} /></div>
                <div style={{ marginTop: 4, fontSize: 11, opacity: 0.7 }}>{quests.weekly.completed ? (quests.weekly.claimed ? "Забрано ✓" : "Готово — 3 крутки MAGMA FROST") : WEEKLY_DEF.desc}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* comeback banner only if eligible 7d+ */}
      {quests?.comeback?.eligible && (
        <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 14, background: "linear-gradient(135deg,#ff2d55 0%,#ff8a00 50%,#ffcc00 100%)", border: "1px solid rgba(255,204,0,0.35)", color: "#1a1a00", fontWeight: 800, display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <span>🎁 Возвращение 42 — 10 круток + 42 монеты (оффлайн {quests.comeback.days}д ≥7д)</span>
          <span style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(0,0,0,0.18)", color: "#fff", fontSize: 12 }}>Доступно 1×/7д</span>
        </div>
      )}

      {/* coupon input GACHA42 / GACHADUST */}
      <div style={{ marginTop: 12, padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.9 }}>Купон:</span>
        <input value={coupon} onChange={e => setCoupon(e.target.value)} placeholder="GACHA42 / GACHADUST" style={{ flex: "1 1 160px", maxWidth: 220, padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.22)", color: "#fff", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em" }} />
        <button onClick={doRedeemCoupon} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ffcc00", background: "rgba(255,204,0,0.16)", color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>Активировать</button>
        <span style={{ fontSize: 12, opacity: 0.8 }}>{couponMsg}</span>
        <span style={{ fontSize: 11, opacity: 0.55, width: "100%" }}>GACHA42 → 10× roll (или 420 dust) • GACHADUST → dust+420 • POST /magnum/api/promo/redeem</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16, marginTop: 18 }}>
        {banners.map(b => {
          const isEvent = b.type === "event";
          const endsIn = formatTimer(b.endsAt, now);
          return (
            <div key={b.id} data-banner={b.id} style={{ position: "relative", borderRadius: 18, padding: 16, background: isEvent ? "linear-gradient(135deg,#ff2d55 0%,#ff8a00 50%,#1a1a00 100%)" : "linear-gradient(135deg,#1a1a1a,#2a2a2a)", border: isEvent ? "1px solid rgba(255,204,0,0.35)" : "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", opacity: 0.8 }}>{isEvent ? "EVENT" : "STANDARD"} • {b.name}</div>
              <div style={{ marginTop: 8, fontWeight: 900, fontSize: 18 }}>{b.name}</div>
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>{isEvent ? "Ивент-легендарка banner-magma-frost 1420 rate-up 50%" : "Все 32+ косметики common→legendary"}</div>
              <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, padding: "5px 8px", borderRadius: 8, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.12)", transform: `scale(${now % 2000 < 1000 ? 1.04 : 1})`, transition: "transform 0.2s" }}>⏳ {endsIn}</span>
                <span style={{ fontSize: 11, opacity: 0.6 }}>14д ротация</span>
              </div>
              <div style={{ marginTop: 12, height: 88, borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px dashed rgba(255,255,255,0.12)", display: "grid", placeItems: "center", fontSize: 12, opacity: 0.8 }}>Превью кейса — {b.id}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={() => doRoll(b.id, 1)} disabled={loading === b.id + ":1"} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #ff2d55", background: "rgba(255,45,85,0.18)", color: "#fff", fontWeight: 800, cursor: "pointer" }}>{loading === b.id + ":1" ? "…" : "Крутить x1 42"}</button>
                <button onClick={() => doRoll(b.id, 10)} disabled={loading === b.id + ":10"} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #ffcc00", background: "rgba(255,204,0,0.18)", color: "#fff", fontWeight: 800, cursor: "pointer" }}>{loading === b.id + ":10" ? "…" : "Крутить x10 420"}</button>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, opacity: 0.6 }}>Баланс списывает COINS • дубликат → пыль • dust→крафт</div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={doFreeRoll} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid #00ff88", background: "rgba(0,255,136,0.12)", color: "#00ff88", fontWeight: 800, cursor: "pointer" }}>Бесплатная крутка (streak ≥3) — 1/день</button>
        <span style={{ alignSelf: "center", opacity: 0.6, fontSize: 12 }}>{msg}</span>
      </div>

      <div style={{ marginTop: 18 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800 }}>История последних 10</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {history.length === 0 && <div style={{ opacity: 0.6, fontSize: 12, padding: 16, border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 12 }}>Пока пусто — крутани кейс</div>}
          {history.map((h, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 12 }}>
              <span style={{ padding: "2px 6px", borderRadius: 6, background: h.rarity === "legendary" ? "#ffcc00" : h.rarity === "epic" ? "#a855f7" : h.rarity === "rare" ? "#5865f2" : "rgba(255,255,255,0.12)", color: "#fff", fontWeight: 800 }}>{h.rarity}</span>
              <span style={{ fontWeight: 700 }}>{h.cosmetic_id}</span>
              <span style={{ opacity: 0.6 }}>{h.banner_type}</span>
              <span style={{ marginLeft: "auto", opacity: 0.6 }}>{new Date(h.created_at).toLocaleString("ru-RU")}</span>
            </div>
          ))}
        </div>
      </div>

      {reveal && <GachaReveal items={reveal} onClose={() => setReveal(null)} />}
    </div>
  );
}
