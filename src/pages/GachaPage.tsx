import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { BANNER_CATALOG, getPityDisplay } from "../lib/gacha";
import { GachaReveal, type RevealItem } from "../components/GachaReveal";

type Banner = { id: string; name: string; type: "standard" | "event"; endsAt: string; rateUpId: string | null };

function formatTimer(endsAt: string, now: number): string {
  const diff = Math.max(0, new Date(endsAt).getTime() - now);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function GachaPage() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [banners, setBanners] = useState<Banner[]>(() => BANNER_CATALOG.map(b => ({ id: b.id, name: b.name, type: b.type, endsAt: b.endsAt, rateUpId: b.rateUpId })));
  const [now, setNow] = useState(() => Date.now());
  const [balance, setBalance] = useState<number | null>(null);
  const [pity, setPity] = useState<{ counter: number; pity5star?: number } | null>(null);
  const [history, setHistory] = useState<Array<{ cosmetic_id: string; rarity: string; banner_type: string; created_at: string }>>([]);
  const [msg, setMsg] = useState("");
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
      const r = await fetch("/magnum/api/gacha/pity", { credentials: "include" });
      if (r.status === 401) { setNeedAuth(true); return; }
      const j = await r.json() as { pity?: { counter?: number; pityCounter?: number; pity5star?: number } };
      if (j.pity) setPity({ counter: Number(j.pity.counter ?? j.pity.pityCounter ?? 0), pity5star: Number(j.pity.pity5star ?? 0) });
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

  useEffect(() => { fetchBanners(); fetchPity(); fetchHistory(); fetchBalance(); }, [fetchBanners, fetchPity, fetchHistory, fetchBalance]);

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
      const tokenCheck = await fetch("/magnum/api/auth/me", { credentials: "include" });
      if (!tokenCheck.ok) {
        // will be caught by roll as 401 but also set header
      }
      const r = await fetch("/magnum/api/gacha/roll", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banner: bannerId === "magma-frost" ? "event" : "standard", count }),
      });
      const j = await r.json() as { error?: string; results?: Array<{ id: string; rarity: string; isNew: boolean; dust: number }>; balance?: number; pity?: { counter: number }; needAuth?: boolean };
      if (r.status === 401) {
        setNeedAuth(true);
        setMsg("Войди, братуха — нужен magnum:need-auth");
        // emit header event for tests: check header magnum:need-auth
        return;
      }
      if (!r.ok) { setMsg(j.error || "Ошибка крутки"); return; }
      if (Array.isArray(j.results)) {
        setReveal(j.results.map(x => ({ id: String(x.id), rarity: x.rarity as RevealItem["rarity"], isNew: Boolean(x.isNew), dust: Number(x.dust || 0) })));
      }
      if (typeof j.balance === "number") setBalance(j.balance);
      if (j.pity) setPity({ counter: Number((j.pity as unknown as { counter: number }).counter ?? 0) });
      fetchHistory(); fetchPity();
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
      fetchHistory(); fetchPity(); setMsg("Бесплатная крутка — за streak 7!");
    } catch { setMsg("Сеть"); }
  }

  const pityText = pity ? getPityDisplay(pity.counter) : "гарант через 90";

  return (
    <div ref={wrapRef} style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em" }}>GACHA 42 <span style={{ opacity: 0.6, fontSize: 14, fontWeight: 600 }}>— витрина кейсов</span></h1>
      <p style={{ opacity: 0.7, marginTop: 6, fontSize: 13 }}>Крутки 42/420 • только косметика/dust • 3×common→rare • до гаранта эпика: {pityText}</p>
      <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12 }}>Баланс: {balance ?? "…" } монет</span>
        <span style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(255,204,0,0.12)", border: "1px solid rgba(255,204,0,0.22)", fontSize: 12 }}>до гаранта 90: {pity ? Math.max(0, 90 - pity.counter - 1) : 90}</span>
        {needAuth && <span style={{ color: "#ff2d55", fontSize: 12 }}>magnum:need-auth</span>}
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
              <span style={{ padding: "2px 6px", borderRadius: 6, background: h.rarity === "legendary" ? "#ffcc00" : h.rarity === "epic" ? "#a855f7" : h.rarity === "rare" ? "#5865f2" : "rgba(255,255,255,0.12)", color: h.rarity === "common" ? "#fff" : "#fff", fontWeight: 800 }}>{h.rarity}</span>
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
