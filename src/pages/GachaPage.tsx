import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { BANNER_CATALOG, getPityDisplay, getPityLegendaryDisplay, softPityCurve, RARITY_TABLE, DUST_REWARD } from "../lib/gacha";
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
type QuestsData = { daily: QuestProgress[]; weekly: QuestProgress | null; weekId: string; comeback: { eligible: boolean; days: number } };
type PassPreview = { level: number; xp: number; xpInLevel: number; xpNeed: number; pct: number; premium: boolean } | null;

const RARITY_COLOR: Record<string, string> = { common:"#9aa4b2", rare:"#5865f2", epic:"#a855f7", legendary:"#ffcc00" };
const RARITY_BG: Record<string, string> = { common:"rgba(255,255,255,0.08)", rare:"rgba(88,101,242,0.18)", epic:"rgba(168,85,247,0.18)", legendary:"rgba(255,204,0,0.18)" };

export function GachaPage() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const dustRef = useRef<HTMLDivElement>(null);
  const [banners, setBanners] = useState<Banner[]>(() => BANNER_CATALOG.map(b => ({ id: b.id, name: b.name, type: b.type, endsAt: b.endsAt, rateUpId: b.rateUpId })));
  const [now, setNow] = useState(() => Date.now());
  const [balance, setBalance] = useState<number | null>(null);
  const [dust, setDust] = useState<number | null>(null);
  const [pity, setPity] = useState<PityState | null>(null);
  const [history, setHistory] = useState<Array<{ cosmetic_id: string; rarity: string; banner_type: string; created_at: string; is_new?: boolean }>>([]);
  const [quests, setQuests] = useState<QuestsData | null>(null);
  const [msg, setMsg] = useState("");
  const [coupon, setCoupon] = useState("");
  const [couponMsg, setCouponMsg] = useState("");
  const [reveal, setReveal] = useState<RevealItem[] | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [needAuth, setNeedAuth] = useState(false);
  const [pass, setPass] = useState<PassPreview>(null);

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
      const r = await fetch("/magnum/api/gacha/pity", { credentials: "include" });
      if (r.status === 401) { setNeedAuth(true); return; }
      if (r.ok) {
        const j = await r.json() as { pity?: { counter?: number; pityCounter?: number; pity_5star?: number; pity5star?: number; lost_50_50?: boolean; lost5050?: boolean; pulls?: number } };
        if (j.pity) {
          setPity({ counter: Number(j.pity.counter ?? j.pity.pityCounter ?? 0), pity5star: Number(j.pity.pity_5star ?? j.pity.pity5star ?? 0), lost5050: Boolean(j.pity.lost_50_50 ?? j.pity.lost5050 ?? false), pulls: Number(j.pity.pulls ?? 0) });
          return;
        }
      }
      const rs = await fetch("/magnum/api/gacha/status?banner=standard", { credentials: "include" });
      if (rs.ok) {
        const j2 = await rs.json() as { pity?: { counter?: number; pityCounter?: number; pity_5star?: number; pity5star?: number; lost_50_50?: boolean; pulls?: number } };
        if (j2.pity) setPity({ counter: Number(j2.pity.counter ?? j2.pity.pityCounter ?? 0), pity5star: Number(j2.pity.pity_5star ?? j2.pity.pity5star ?? 0), lost5050: Boolean((j2.pity as unknown as { lost_50_50: boolean }).lost_50_50 ?? false), pulls: Number((j2.pity as unknown as { pulls: number }).pulls ?? 0) });
      }
    } catch {}
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const r = await fetch("/magnum/api/gacha/history", { credentials: "include" });
      const j = await r.json() as { history?: typeof history };
      if (Array.isArray(j.history)) setHistory(j.history.slice(0, 20));
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
          setQuests({ daily: Array.isArray(j.daily) ? j.daily : (Array.isArray(j.quests) ? j.quests.filter(q => q.questId.startsWith("daily")) : []), weekly: j.weekly ?? (Array.isArray(j.quests) ? j.quests.find(q => q.questId === WEEKLY_DEF.id) ?? null : null), weekId: j.weekId ?? gachaWeekId(), comeback: j.comeback ?? { eligible: false, days: 0 } });
          return;
        }
      }
      setQuests({ daily: QUEST_DEFS.map(q => ({ questId: q.id, progress: 0, target: q.target, claimed: false, completed: false })), weekly: { questId: WEEKLY_DEF.id, progress: 0, target: WEEKLY_DEF.target, claimed: false, completed: false }, weekId: gachaWeekId(), comeback: { eligible: false, days: 0 } });
    } catch {
      setQuests({ daily: QUEST_DEFS.map(q => ({ questId: q.id, progress: 0, target: q.target, claimed: false, completed: false })), weekly: { questId: WEEKLY_DEF.id, progress: 0, target: WEEKLY_DEF.target, claimed: false, completed: false }, weekId: gachaWeekId(), comeback: { eligible: false, days: 0 } });
    }
  }, []);

  const fetchPass = useCallback(async () => {
    try {
      const r = await fetch("/magnum/api/pass/progress", { credentials: "include" });
      if (!r.ok) return;
      const j = await r.json() as { progress?: PassPreview; level?: number; xp?: number; premium?: boolean };
      if (j.progress) setPass(j.progress);
      else if (typeof j.level === "number") setPass({ level: j.level, xp: j.xp ?? 0, xpInLevel: 0, xpNeed: 42, pct: 0, premium: Boolean(j.premium) });
    } catch {}
  }, []);

  useEffect(() => { fetchBanners(); fetchPity(); fetchHistory(); fetchBalance(); fetchDust(); fetchQuests(); fetchPass(); }, [fetchBanners, fetchPity, fetchHistory, fetchBalance, fetchDust, fetchQuests, fetchPass]);

  useEffect(() => {
    if (!wrapRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { gsap.set(wrapRef.current, { clearProps: "all" }); return; }
    const ctx = gsap.context(() => { gsap.set(wrapRef.current, { y: -20, opacity: 0 }); gsap.to(wrapRef.current, { y: 0, opacity: 1, duration: 0.52, ease: "power2.out", overwrite: true }); }, wrapRef);
    return () => ctx.revert();
  }, []);
  // timeline stagger y16 0.08
  useEffect(() => {
    if (!timelineRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      const items = timelineRef.current!.querySelectorAll("[data-timeline-item]");
      if (!items.length) return;
      gsap.set(items, { y: 16, opacity: 0 });
      gsap.to(items, { y: 0, opacity: 1, duration: 0.38, stagger: 0.08, ease: "power2.out", overwrite: true });
    }, timelineRef);
    return () => ctx.revert();
  }, [history]);
  // chart path draw 0.6s power2.out
  useEffect(() => {
    if (!chartRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const path = chartRef.current.querySelector("path[data-curve]") as SVGPathElement | null;
    if (!path) return;
    const len = path.getTotalLength();
    gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
    gsap.to(path, { strokeDashoffset: 0, duration: 0.6, ease: "power2.out", overwrite: true });
  }, [pity]);
  // dust shop CTA pulse
  useEffect(() => {
    if (!dustRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const btn = dustRef.current.querySelector("[data-dust-btn]") as HTMLElement | null;
    if (!btn) return;
    gsap.to(btn, { scale: 1.02, duration: 0.8, yoyo: true, repeat: -1, ease: "power1.inOut" });
  }, [dust]);

  async function doRoll(bannerId: string, count: 1 | 10) {
    setMsg(""); setNeedAuth(false); setLoading(bannerId + ":" + count);
    try {
      const r = await fetch("/magnum/api/gacha/roll", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ banner: bannerId === "magma-frost" ? "event" : "standard", count }) });
      const j = await r.json() as { error?: string; results?: Array<{ id: string; rarity: string; isNew: boolean; dust: number }>; balance?: number; pity?: { counter: number; pityCounter?: number; pity5star?: number; pity_5star?: number; lost_50_50?: boolean }; dust?: number };
      if (r.status === 401) { setNeedAuth(true); setMsg("Войди, братуха — нужен magnum:need-auth"); return; }
      if (r.status === 402) { setMsg(j.error || "Недостаточно монет (402)"); return; }
      if (r.status === 429) { setMsg(j.error || "Превышен лимит (429)"); return; }
      if (!r.ok) { setMsg(j.error || "Ошибка крутки"); return; }
      if (Array.isArray(j.results)) setReveal(j.results.map(x => ({ id: String(x.id), rarity: x.rarity as RevealItem["rarity"], isNew: Boolean(x.isNew), dust: Number(x.dust || 0) })));
      if (typeof j.balance === "number") setBalance(j.balance);
      if (typeof j.dust === "number") setDust(j.dust); else fetchDust();
      if (j.pity) {
        const c = Number((j.pity as unknown as { counter: number }).counter ?? (j.pity as unknown as { pityCounter: number }).pityCounter ?? 0);
        const p5 = Number((j.pity as unknown as { pity5star: number }).pity5star ?? (j.pity as unknown as { pity_5star: number }).pity_5star ?? 0);
        const lost = Boolean((j.pity as unknown as { lost_50_50: boolean }).lost_50_50 ?? false);
        setPity(prev => ({ counter: c, pity5star: p5, lost5050: lost, pulls: prev?.pulls ?? 0 }));
      } else fetchPity();
      fetchHistory(); fetchPass();
      setMsg(count === 1 ? "Крутка x1 — удачи, братуха!" : "Крутка x10 — погнали!");
    } catch { setMsg("Сеть — попробуй ещё"); } finally { setLoading(null); }
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
      fetchHistory(); fetchPity(); fetchDust(); fetchPass(); setMsg("Бесплатная крутка — за streak 7!");
    } catch { setMsg("Сеть"); }
  }

  async function doDustBuy() {
    setMsg(""); setNeedAuth(false); setLoading("dust-buy");
    try {
      const r = await fetch("/magnum/api/gacha/dust/buy", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const j = await r.json() as { error?: string; results?: RevealItem[]; dust?: number; balanceDust?: number };
      if (r.status === 401) { setNeedAuth(true); setMsg("Войди — нужен magnum:need-auth"); return; }
      if (r.status === 402) { setMsg(j.error || "Нужно 420 пыли (402)"); return; }
      if (r.status === 429) { setMsg(j.error || "Лимит"); return; }
      if (!r.ok) { setMsg(j.error || "Ошибка dust buy"); return; }
      const res = (j.results ?? (j as unknown as { results: RevealItem[] }).results);
      if (Array.isArray(res) && res.length) setReveal(res.map(x => ({ id: String((x as unknown as { id: string }).id ?? (x as unknown as { cosmetic_id: string }).cosmetic_id ?? x.id), rarity: (x.rarity as RevealItem["rarity"]), isNew: Boolean((x as unknown as { isNew: boolean }).isNew ?? (x as unknown as { is_new: boolean }).is_new ?? x.isNew), dust: Number((x as unknown as { dust: number }).dust ?? x.dust ?? 0) })));
      if (typeof j.dust === "number") setDust(j.dust);
      else if (typeof j.balanceDust === "number") setDust(j.balanceDust);
      else fetchDust();
      fetchPity(); fetchHistory(); fetchPass();
      setMsg("Кейс за пыль открыт — 420 dust списано");
    } catch { setMsg("Сеть"); } finally { setLoading(null); }
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
      if (r.status === 409) { const already = String(j.error || "").includes("already") ? "Уже активирован (409)" : (j.error || "409 — уже/распродано"); setCouponMsg(already); return; }
      if (!r.ok) { setCouponMsg(j.error || "Ошибка купона"); return; }
      setCouponMsg(`✓ ${code} — +${j.reward ?? 0} • баланс ${j.balance ?? ""}`.trim());
      if (typeof j.balance === "number") setBalance(j.balance);
      fetchDust(); fetchBalance(); fetchPity();
      if (code === "GACHA42") setMsg("GACHA42 — забирай крутки!");
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

  // soft-pity curve SVG path: 0..180 -> x 0..300, y chance 0.006..1 -> 80 down to 6
  const chartW = 300, chartH = 80;
  const curvePoints: { x: number; y: number; p: number; c: number }[] = [];
  for (let p = 0; p <= 180; p++) {
    const c = softPityCurve(p);
    const x = (p / 180) * chartW;
    const y = chartH - 6 - (c / 1) * (chartH - 14);
    curvePoints.push({ x, y, p, c });
  }
  const pathD = curvePoints.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(" ");
  const markerX = pity ? (Math.min(180, pity.pity5star) / 180) * chartW : 0;

  return (
    <div ref={wrapRef} style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em" }}>GACHA 42 <span style={{ opacity: 0.6, fontSize: 14, fontWeight: 600 }}>— витрина кейсов</span></h1>
      <p style={{ opacity: 0.7, marginTop: 6, fontSize: 13 }}>Крутки 42/420 • только косметика/dust • 3×common→rare • до гаранта эпика: {pityText} • {pityLegendaryText}</p>

      {/* top vitrine bar */}
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12 }}>Баланс: {balance ?? dust ?? "…"} монет — общий счёт для всех режимов</span>
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

      {/* pass preview + shop links */}
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
        <Link to="/magnum/shop" style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12, color: "#fff", textDecoration: "none" }}>Магазин → /shop</Link>
        <Link to="/magnum/pass" style={{ padding: "6px 10px", borderRadius: 8, background: "linear-gradient(135deg,#a855f7, #5865f2)", border: "1px solid rgba(168,85,247,0.35)", fontSize: 12, color: "#fff", textDecoration: "none", fontWeight: 800 }}>
          Пропуск 42 → /pass FREE/PREMIUM {pass ? `• LV ${pass.level}/42 XP ${pass.xp} ${pass.premium ? "PREMIUM ✓" : "FREE"}` : "• LV …/42"}
        </Link>
        <Link to="/magnum/shop#dust" style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.22)", fontSize: 12, color: "#d8b4fe", textDecoration: "none" }}>Крафт в Prism Vault</Link>
      </div>
      {pass && (
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, opacity: 0.65 }}>Pass 42 прогрес: LV {pass.level}/42 • XP {pass.xp} ({pass.xpInLevel}/{pass.xpNeed} до след.) • {Math.round(pass.pct)}% • каждая крутка → XP за игру</span>
        </div>
      )}

      {/* Dust Shop CTA */}
      <div ref={dustRef} style={{ marginTop: 14, padding: 14, borderRadius: 14, background: "linear-gradient(135deg, rgba(168,85,247,0.14), rgba(88,101,242,0.10))", border: "1px solid rgba(168,85,247,0.22)", display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.06em" }}>КЕЙС 42 — гарант epic+</div>
          <div style={{ fontSize: 11, opacity: 0.65, marginTop: 4 }}>Баланс: <strong style={{ color: "#d8b4fe" }}>{dust ?? "…"}</strong> • цена кейса 420 — тот же счёт, что и в магазине, дуэлях, майнинге • дубликат → бонус к балансу по RARITY</div>
        </div>
        <button data-dust-btn onClick={doDustBuy} disabled={loading === "dust-buy" || (dust !== null && dust < 420)} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #a855f7", background: dust !== null && dust < 420 ? "rgba(168,85,247,0.08)" : "rgba(168,85,247,0.22)", color: dust !== null && dust < 420 ? "#9aa4b2" : "#fff", fontWeight: 900, cursor: dust !== null && dust < 420 ? "not-allowed" : "pointer", opacity: dust !== null && dust < 420 ? 0.6 : 1, fontSize: 12 }}>
          {loading === "dust-buy" ? "…" : "Кейс за 420"}
        </button>
      </div>

      {/* Soft-Pity 42 curve */}
      <div ref={chartRef} style={{ marginTop: 14, padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: isSoftPity ? "1px solid rgba(255,45,85,0.28)" : "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.06em" }}>SOFT-PITY 42 — шанс легендарки по pity 0→180 {isSoftPity && <span style={{ color: "#ff2d55" }}>🔥 65+</span>}</div>
          <div style={{ fontSize: 11, opacity: 0.65 }}>текущий pity_5star: <strong style={{ color: isSoftPity ? "#ff2d55" : "#ffcc00" }}>{pity?.pity5star ?? 0}</strong> • шанс {chancePct}% • softPityCurve(pity5)</div>
        </div>
        <div style={{ marginTop: 10, overflowX: "auto" }}>
          <svg width={chartW} height={chartH} viewBox={`0 0 ${chartW} ${chartH}`} style={{ display: "block", background: "rgba(0,0,0,0.22)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
            {/* soft-pity 65+ zone */}
            <rect x={(65/180)*chartW} y={0} width={((180-65)/180)*chartW} height={chartH} fill="rgba(255,45,85,0.08)" />
            <text x={(65/180)*chartW + 4} y={12} fontSize={8} fill="rgba(255,45,85,0.85)" fontWeight={800}>65 🔥</text>
            {/* grid lines */}
            <line x1={0} y1={chartH-6} x2={chartW} y2={chartH-6} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
            <line x1={(90/180)*chartW} y1={0} x2={(90/180)*chartW} y2={chartH} stroke="rgba(168,85,247,0.18)" strokeDasharray="3 3" />
            <text x={(90/180)*chartW + 2} y={chartH-2} fontSize={7} fill="rgba(255,255,255,0.45)">90 epic гарант</text>
            <line x1={chartW-1} y1={0} x2={chartW-1} y2={chartH} stroke="rgba(255,204,0,0.22)" strokeDasharray="3 3" />
            <text x={chartW-28} y={12} fontSize={7} fill="rgba(255,204,0,0.85)">180</text>
            <path data-curve d={pathD} fill="none" stroke={isSoftPity ? "#ff2d55" : "#a855f7"} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
            {/* marker */}
            {pity && <g>
              <line x1={markerX} y1={0} x2={markerX} y2={chartH} stroke={isSoftPity ? "#ff2d55" : "#ffcc00"} strokeWidth={1.2} strokeDasharray="4 3" opacity={0.9} />
              <circle cx={markerX} cy={curvePoints[Math.min(180, pity.pity5star)]?.y ?? chartH-6} r={4} fill={isSoftPity ? "#ff2d55" : "#ffcc00"} stroke="rgba(0,0,0,0.6)" strokeWidth={1} />
            </g>}
          </svg>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 10, opacity: 0.6, flexWrap: "wrap" }}>
          <span>0 → 0.60%</span><span>65 → 6.60%</span><span>70 → 36.6%</span><span>80 → 96.6%</span><span>82+ → 100% гарант</span><span style={{ color: "#ff2d55" }}>65+ подсветка 🔥</span>
        </div>
      </div>

      {/* Rate Table 42 */}
      <div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", overflowX: "auto" }}>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.06em" }}>RATE TABLE 42 — шансы + пыль за дубликат</div>
        <table style={{ width: "100%", marginTop: 8, borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ opacity: 0.6, fontSize: 10, letterSpacing: "0.06em" }}><th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Rarity</th><th style={{ textAlign: "right", padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Шанс</th><th style={{ textAlign: "right", padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Дубликат → dust</th><th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Примечание</th></tr></thead>
          <tbody>
            <tr style={{ background: "rgba(255,255,255,0.02)" }}><td style={{ padding: "7px 8px", fontWeight: 800, color: RARITY_COLOR.common! }}>COMMON</td><td style={{ padding: "7px 8px", textAlign: "right" }}>{(RARITY_TABLE.common*100).toFixed(1)}%</td><td style={{ padding: "7px 8px", textAlign: "right", color: "#d8b4fe", fontWeight: 800 }}>+{DUST_REWARD.common}</td><td style={{ padding: "7px 8px", opacity: 0.6 }}>база</td></tr>
            <tr><td style={{ padding: "7px 8px", fontWeight: 800, color: RARITY_COLOR.rare! }}>RARE</td><td style={{ padding: "7px 8px", textAlign: "right" }}>{(RARITY_TABLE.rare*100).toFixed(1)}%</td><td style={{ padding: "7px 8px", textAlign: "right", color: "#d8b4fe", fontWeight: 800 }}>+{DUST_REWARD.rare}</td><td style={{ padding: "7px 8px", opacity: 0.6 }}>глоу #5865f2</td></tr>
            <tr style={{ background: "rgba(255,255,255,0.02)" }}><td style={{ padding: "7px 8px", fontWeight: 800, color: RARITY_COLOR.epic! }}>EPIC</td><td style={{ padding: "7px 8px", textAlign: "right" }}>{(RARITY_TABLE.epic*100).toFixed(1)}%</td><td style={{ padding: "7px 8px", textAlign: "right", color: "#d8b4fe", fontWeight: 800 }}>+{DUST_REWARD.epic}</td><td style={{ padding: "7px 8px", opacity: 0.6 }}>гарант 90, shimmer 1.2s</td></tr>
            <tr><td style={{ padding: "7px 8px", fontWeight: 800, color: RARITY_COLOR.legendary! }}>LEGENDARY</td><td style={{ padding: "7px 8px", textAlign: "right" }}>{(RARITY_TABLE.legendary*100).toFixed(2)}% → soft-pity</td><td style={{ padding: "7px 8px", textAlign: "right", color: "#ffd700", fontWeight: 900 }}>+{DUST_REWARD.legendary}</td><td style={{ padding: "7px 8px", opacity: 0.6 }}>гарант 180, soft-pity 65+ 🔥</td></tr>
          </tbody>
        </table>
        <div style={{ fontSize: 10, opacity: 0.5, marginTop: 6 }}>3× common → rare крафт • дубликат всегда → dust по таблице • softPityCurve: 0.006 + (pity5-64)*0.06 до 1.0</div>
      </div>

      {/* quests */}
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

      {quests?.comeback?.eligible && (
        <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 14, background: "linear-gradient(135deg,#ff2d55 0%,#ff8a00 50%,#ffcc00 100%)", border: "1px solid rgba(255,204,0,0.35)", color: "#1a1a00", fontWeight: 800, display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <span>🎁 Возвращение 42 — 10 круток + 42 монеты (оффлайн {quests.comeback.days}д ≥7д)</span>
          <span style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(0,0,0,0.18)", color: "#fff", fontSize: 12 }}>Доступно 1×/7д</span>
        </div>
      )}

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

      {/* Pity Timeline 42 — 20 последних с pity_counter badge */}
      <div style={{ marginTop: 18 }}>
        <h3 style={{ fontSize: 14, fontWeight: 900, letterSpacing: "0.04em" }}>PITY ТАЙМЛАЙН 42 — 20 последних</h3>
        <div style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>Горизонтальная лента с badge pity/rarity • hover scale 1.02 • GSAP y16 stagger 0.08 • fetch /magnum/api/gacha/history 20</div>
        {history.length === 0 ? (
          <div style={{ opacity: 0.6, fontSize: 12, padding: 16, border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 12, marginTop: 8 }}>Пока пусто — крутани кейс</div>
        ) : (
          <div ref={timelineRef} style={{ display: "flex", gap: 10, marginTop: 10, overflowX: "auto", paddingBottom: 8, scrollPadding: 8, scrollbarWidth: "thin" }}>
            {history.slice(0, 20).map((h, i) => {
              const pityBadge = pity ? Math.max(0, pity.pity5star - (history.length - 1 - i)) : i;
              return (
                <div data-timeline-item key={i + h.cosmetic_id} title={`${h.cosmetic_id} • ${h.rarity} • ${h.banner_type} • ${new Date(h.created_at).toLocaleString("ru-RU")}`} style={{ flex: "0 0 132px", padding: 10, borderRadius: 12, background: RARITY_BG[h.rarity] ?? "rgba(255,255,255,0.04)", border: `1px solid ${RARITY_COLOR[h.rarity] ?? "rgba(255,255,255,0.08)"}40`, display: "flex", flexDirection: "column", gap: 6, transition: "transform 0.15s", cursor: "default" }} onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.02)")} onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}>
                  <span style={{ padding: "2px 6px", borderRadius: 6, background: RARITY_COLOR[h.rarity] ?? "rgba(255,255,255,0.12)", color: "#fff", fontWeight: 800, fontSize: 10, alignSelf: "flex-start" }}>{h.rarity}</span>
                  <span style={{ fontWeight: 700, fontSize: 10, wordBreak: "break-all", lineHeight: 1.2 }}>{h.cosmetic_id}</span>
                  <span style={{ fontSize: 10, opacity: 0.7 }}>{h.banner_type}</span>
                  <span style={{ fontSize: 9, opacity: 0.55 }}>{new Date(h.created_at).toLocaleString("ru-RU")}</span>
                  <span style={{ marginTop: "auto", fontSize: 9, padding: "3px 6px", borderRadius: 6, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.12)", fontWeight: 800, alignSelf: "flex-start" }}>pity #{pityBadge} • #{i + 1}</span>
                  {h.is_new === false && <span style={{ fontSize: 9, color: "#d8b4fe", fontWeight: 800 }}>Дубликат +dust</span>}
                </div>
              );
            })}
          </div>
        )}
        {/* compact history list also */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.7 }}>История списком (10)</div>
          {history.slice(0, 10).map((h, i) => (
            <div key={"list-" + i} style={{ display: "flex", gap: 10, alignItems: "center", padding: 8, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 11 }}>
              <span style={{ padding: "2px 6px", borderRadius: 6, background: RARITY_COLOR[h.rarity] ?? "rgba(255,255,255,0.12)", color: "#fff", fontWeight: 800, fontSize: 10 }}>{h.rarity}</span>
              <span style={{ fontWeight: 700, fontSize: 11 }}>{h.cosmetic_id}</span>
              <span style={{ opacity: 0.6, fontSize: 11 }}>{h.banner_type}</span>
              <span style={{ marginLeft: "auto", opacity: 0.6, fontSize: 10 }}>{new Date(h.created_at).toLocaleString("ru-RU")}</span>
            </div>
          ))}
        </div>
      </div>

      {reveal && <GachaReveal items={reveal} onClose={() => setReveal(null)} />}
    </div>
  );
}
