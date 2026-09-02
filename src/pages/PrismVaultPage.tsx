 
import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { NEON_PRISM_CATALOG, NEON_PRISM_IDS_SET, isNeonPrismCosmetic, COSMETICS_CATALOG } from "../lib/cosmetics";
import { getCoins, subscribe as subscribeCoins } from "../lib/coins";
import { subscribeMe, fetchMe } from "../lib/authMe";

const RARITY_META: Record<string, { label: string; price: number; color: string }> = {
  common: { label: "COMMON", price: 42, color: "#00ffcc" },
  rare: { label: "RARE", price: 142, color: "#ff44cc" },
  epic: { label: "EPIC", price: 420, color: "#9147ff" },
  legendary: { label: "LEGENDARY", price: 1420, color: "#ffcc00" },
};

function toast(msg: string, kind: "ok" | "err" = "ok") {
  const el = document.createElement("div");
  el.textContent = (kind === "err" ? "💸 " : "✅ ") + msg;
  el.style.cssText = `position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:9999;padding:10px 18px;border-radius:999px;font-weight:800;font-size:13px;color:#fff;background:${kind === "err" ? "#ff2d55" : "#00ff88"};color:${kind === "err" ? "#fff" : "#0a1a14"};box-shadow:0 8px 32px rgba(0,0,0,0.4)`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

export function PrismVaultPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [coins, setCoins] = useState(() => getCoins());
  const [owned, setOwned] = useState<string[]>([]);
  const [equipped, setEquipped] = useState<Record<string, string>>({});
  const [me, setMe] = useState<{ id: number; username: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // auth + inventory
  useEffect(() => {
    let cancelled = false;
    subscribeCoins(setCoins);
    fetchMe().then((u) => { if (!cancelled && u) setMe({ id: (u as any).id, username: (u as any).username }); });
    const unsub = subscribeMe((u) => { if (!cancelled) setMe(u ? { id: (u as any).id, username: (u as any).username } : null); });
    (async () => {
      try {
        const r = await fetch("/magnum/api/shop/inventory", { credentials: "include" });
        if (r.ok) {
          const d = await r.json() as { inventory?: string[]; equipped?: Record<string, string> };
          if (!cancelled) {
            if (d.inventory) setOwned(d.inventory);
            if (d.equipped) setEquipped(d.equipped);
          }
        } else {
          // fallback to /shop/state
          const r2 = await fetch("/magnum/api/shop/state", { credentials: "include" });
          if (r2.ok) { const d2 = await r2.json() as { inventory?: string[]; cosmetics?: string[]; equipped?: Record<string, string> }; if (!cancelled) { if (d2.inventory || d2.cosmetics) setOwned((d2.inventory ?? d2.cosmetics ?? []) as string[]); if (d2.equipped) setEquipped(d2.equipped); } }
        }
      } catch {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; unsub(); };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      const cards = gridRef.current?.querySelectorAll("[data-prism-card]");
      if (cards && cards.length) {
        gsap.set(cards, { y: 20, opacity: 0 });
        gsap.to(cards, { y: 0, opacity: 1, duration: 0.45, stagger: 0.08, ease: "power2.out" });
      }
      const aurora = rootRef.current?.querySelector("[data-aurora-hero]");
      if (aurora) {
        gsap.fromTo(aurora, { y: -10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" });
      }
    }, rootRef);
    return () => ctx.revert();
  }, [loading]);

  const dismantle = useCallback(async (id: string) => {
    try {
      const r = await fetch("/magnum/api/shop/dismantle", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cosmeticId: id }) });
      const d = await r.json() as { balance?: number; reward?: number; error?: string };
      if (!r.ok) { toast(String(d.error || "Разбор не прошёл"), "err"); return; }
      if (typeof d.balance === "number") setCoins(d.balance);
      setOwned((v) => v.filter((x) => x !== id));
      // aurora epic forge spring + confetti
      try {
        const el = document.querySelector(`[data-prism-card="${id}"]`) as HTMLElement;
        if (el && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          gsap.fromTo(el, { scale: 1 }, { scale: 1.06, duration: 0.18, yoyo: true, repeat: 1, ease: "back.out(1.7)" });
          gsap.to(el, { boxShadow: "0 0 18px #00ffcc, 0 0 36px rgba(0,255,204,0.35)", duration: 0.3, yoyo: true, repeat: 1 });
        }
      } catch {}
      toast(`Разобрано +${d.reward} монет`);
    } catch { toast("Сеть упала", "err"); }
  }, []);

  const craftAurora = useCallback(async (id: string) => {
    const item = COSMETICS_CATALOG.find((c) => c.id === id);
    if (!item) return;
    // aurora epic/legendary крафтятся через /shop/prism/craft, остальные — через /shop/buy; оба списывают один и тот же баланс монет
    const isPrismCraft = item.rarity === "epic" || item.rarity === "legendary";
    if (coins < item.price) { toast(`Нужно ${item.price} монет, у тебя ${coins}`, "err"); return; }
    try {
      if (isPrismCraft) {
        const r = await fetch("/magnum/api/shop/prism/craft", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cosmeticId: id }) });
        const d = await r.json() as { balance?: number; error?: string; crafted?: string };
        if (!r.ok) { toast(String(d.error || "Крафт не прошёл"), "err"); return; }
        if (typeof d.balance === "number") setCoins(d.balance);
        setOwned((v) => [...v, id]);
        try {
          const el = document.querySelector("[data-forge-reveal]") as HTMLElement;
          if (el && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            gsap.fromTo(el, { scale: 0, rotation: 5, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.5, ease: "back.out(1.7)" });
            gsap.to(el, { boxShadow: "0 0 16px #00ffcc, 0 0 28px rgba(0,255,204,0.4)", duration: 0.35, yoyo: true, repeat: 1 });
          }
          const canvas = document.createElement("canvas"); canvas.style.position = "fixed"; canvas.style.inset = "0"; canvas.style.pointerEvents = "none"; canvas.width = window.innerWidth; canvas.height = window.innerHeight; document.body.appendChild(canvas);
          const ctx2 = canvas.getContext("2d")!; const parts = Array.from({ length: 80 }, () => ({ x: window.innerWidth / 2, y: window.innerHeight / 2, vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12 - 4, life: 1, decay: 0.015 + Math.random() * 0.01 }));
          const tick = () => { ctx2.clearRect(0, 0, canvas.width, canvas.height); let alive = false; for (const p of parts) { if (p.life <= 0) continue; alive = true; p.x += p.vx; p.y += p.vy; p.vy += 0.25; p.life -= p.decay; ctx2.globalAlpha = Math.max(0, p.life); ctx2.fillStyle = "#00ffcc"; ctx2.beginPath(); ctx2.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx2.fill(); } if (alive) requestAnimationFrame(tick); else canvas.remove(); }; tick();
        } catch {}
        toast(`Скрафчено ${item.name} за ${item.price} 🪙 · aurora ✨`);
        return;
      }
      // 3× common craft — тоже через общий баланс монет
      const r = await fetch("/magnum/api/shop/buy", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cosmeticId: id }) });
      const d = await r.json() as { balance?: number; error?: string };
      if (!r.ok) { toast(String(d.error || "Покупка не прошла"), "err"); return; }
      if (typeof d.balance === "number") setCoins(d.balance);
      setOwned((v) => [...v, id]);
      toast(`Куплено ${item.name} за ${item.price} 🪙 · aurora`);
    } catch { toast("Сеть упала", "err"); }
  }, [coins]);

  const equip = useCallback(async (id: string) => {
    const item = COSMETICS_CATALOG.find((c) => c.id === id);
    if (!item) return;
    try {
      const r = await fetch("/magnum/api/shop/equip", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cosmeticId: id }) });
      if (!r.ok) { toast("Equip не прошёл", "err"); return; }
      setEquipped((prev) => ({ ...prev, [item.slot]: id }));
      toast(`Надето ${item.name} · ${item.slot} aurora ✨`);
      try {
        const el = document.querySelector(`[data-prism-card="${id}"]`) as HTMLElement;
        if (el && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          gsap.to(el, { scale: 1.04, duration: 0.2, yoyo: true, repeat: 1, ease: "power2.out" });
          gsap.to(el, { boxShadow: "0 0 20px rgba(0,255,204,0.45)", duration: 0.3, yoyo: true, repeat: 1 });
        }
      } catch {}
    } catch { toast("Сеть упала", "err"); }
  }, []);

  if (loading) return <div style={{ padding: "4rem 2rem", textAlign: "center", color: "#00ffcc" }}>Загрузка Prism Vault…</div>;

  return (
    <div ref={rootRef} style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 14px 40px" }}>
      {/* hero aurora */}
      <div data-aurora-hero style={{ borderRadius: 18, padding: 18, marginBottom: 16, background: "linear-gradient(135deg,rgba(0,255,204,0.12),rgba(88,101,242,0.10) 45%,rgba(255,68,204,0.08))", border: "1px solid rgba(0,255,204,0.22)", boxShadow: "0 0 28px rgba(0,255,204,0.14)" }}>
        <div style={{ fontWeight: 900, letterSpacing: "0.06em", fontSize: 12, color: "#00ffcc" }}>NEON PRISM 42 — 12 AURORA · PRISM VAULT</div>
        <h1 style={{ margin: "8px 0 6px", fontWeight: 900, fontSize: 26, letterSpacing: "-0.02em" }}>NEON PRISM <span style={{ background: "linear-gradient(90deg,#00ffcc,#5865f2 35%,#ff44cc)", WebkitBackgroundClip: "text", color: "transparent" as any }}>AURORA</span> 12</h1>
        <p style={{ margin: 0, opacity: 0.72, fontSize: 13, lineHeight: 1.45 }}>
          12 скинов neon prism + aurora epic 1420 · 42/142/420/1420 common→legendary · крафт 42 · разбор +100 монет · epic конус aurora + spin 3s
          <br />kemerovo-neon 142 · meduza-aurora 420 · gold-aurora-spin epic 1420 spin 3s · единый баланс монет — общий с магазином, дуэлями, заврами, майнингом
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10, fontSize: 12, fontWeight: 800 }}>
          <span style={{ padding: "6px 12px", borderRadius: 999, background: "rgba(0,255,204,0.12)", border: "1px solid rgba(0,255,204,0.25)", color: "#00ffcc" }}>🪙 {coins} монет</span>
          <span style={{ padding: "6px 12px", borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}>{owned.filter((id) => NEON_PRISM_IDS_SET.has(id)).length}/12 собрано</span>
        </div>
        {!me && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>Войди, братуха — крафт/разбор требуют логина. Баланс Neon, без localStorage.</div>}
      </div>

      {/* grid 12 */}
      <div ref={gridRef} data-forge-reveal style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
        {NEON_PRISM_CATALOG.map((co: typeof NEON_PRISM_CATALOG[number]) => {
          const isOwned = owned.includes(co.id);
          const isEq = equipped[co.slot] === co.id;
          const isEpic = co.rarity === "epic";
          const isLegend = co.rarity === "legendary";
          const canAfford = coins >= co.price;
          const isAuroraEpic = isEpic && isNeonPrismCosmetic(co.id);
          return (
            <div
              key={co.id}
              data-prism-card={co.id}
              data-rarity={co.rarity}
              style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: 16,
                border: isEq ? "1px solid #00ff88" : isLegend ? "1px solid rgba(255,204,0,0.35)" : isEpic ? "1px solid rgba(0,255,204,0.25)" : "1px solid rgba(255,255,255,0.08)",
                background: "rgba(18,18,22,0.92)",
                boxShadow: isEq ? "0 0 20px rgba(0,255,136,0.35)" : isLegend ? "0 0 16px rgba(255,204,0,0.28)" : isAuroraEpic ? "0 0 16px rgba(0,255,204,0.22)" : "none",
                padding: 10,
              }}
            >
              {/* preview with aurora epic forge spring + spin 3s */}
              <div
                style={{
                  height: 92,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 800,
                  textAlign: "center",
                  padding: 8,
                  ...(co.slot === "banner"
                    ? { background: co.style }
                    : {
                        border: co.style as string,
                        background: "rgba(255,255,255,0.04)",
                        ...(isLegend || isAuroraEpic ? { animation: "auroraSpin 3s linear infinite", boxShadow: isLegend ? "0 0 16px #ffcc00" : "0 0 16px #00ffcc" } : {}),
                      }),
                } as any}
              >
                <span>{co.name} · {co.slot}</span>
              </div>
              <div style={{ marginTop: 8, fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {co.name}
                <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 999, border: `1px solid ${RARITY_META[co.rarity].color}`, color: RARITY_META[co.rarity].color }}>
                  {RARITY_META[co.rarity].label}
                </span>
                {(isLegend || isAuroraEpic) && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: "rgba(0,255,204,0.12)", color: "#00ffcc", border: "1px solid rgba(0,255,204,0.25)" }}>aurora spin 3s</span>}
              </div>
              <div style={{ opacity: 0.62, fontSize: 11, margin: "4px 0 8px" }}>
                {co.slot} · 🪙 {co.price} {isEpic ? "· aurora epic 420" : isLegend ? "· epic 1420" : co.rarity === "rare" ? "· kemerovo-neon 142" : "· common 42"}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {isOwned ? (
                  <>
                    {isEq ? (
                      <button type="button" onClick={() => equip(co.id)} style={{ flex: 1, padding: "8px 10px", borderRadius: 10, fontWeight: 800, border: "1px solid #00ff88", background: "rgba(0,255,136,0.12)", color: "#fff", cursor: "pointer" }}>
                        ✅ Надет · aurora
                      </button>
                    ) : (
                      <button type="button" onClick={() => equip(co.id)} style={{ flex: 1, padding: "8px 10px", borderRadius: 10, fontWeight: 800, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#fff", cursor: "pointer" }}>
                        Надеть
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => dismantle(co.id)}
                      title="Разобрать → +монеты"
                      style={{ padding: "8px 10px", borderRadius: 10, fontWeight: 700, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#fff", cursor: "pointer", fontSize: 12 }}
                    >
                      ♻️ +{co.rarity === "legendary" ? 420 : co.rarity === "epic" ? 100 : co.rarity === "rare" ? 42 : 14}🪙
                    </button>
                  </>
                ) : co.rarity === "epic" || co.rarity === "legendary" ? (
                  <button
                    type="button"
                    onClick={() => craftAurora(co.id)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 10, fontWeight: 800, border: "1px solid rgba(0,255,204,0.35)", background: canAfford ? "linear-gradient(90deg,#00ffcc,#5865f2)" : "rgba(255,255,255,0.06)", color: canAfford ? "#0a1a14" : "#fff", cursor: "pointer", opacity: canAfford ? 1 : 0.85 }}
                  >
                    🪙 {co.price} {co.rarity === "legendary" ? "· gold-aurora-spin 1420" : co.id.includes("meduza") ? "· meduza-aurora 420" : ""}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => craftAurora(co.id)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 10, fontWeight: 800, border: "1px solid rgba(255,255,255,0.12)", background: canAfford ? "linear-gradient(90deg,#ffcc00,#ff9d1e)" : "rgba(255,255,255,0.06)", color: canAfford ? "#1a1a0a" : "#fff", cursor: "pointer" }}
                  >
                    🪙 {co.price} {co.id.includes("kemerovo") ? "· kemerovo-neon 142" : ""}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ marginTop: 12, fontSize: 12, opacity: 0.62 }}>
        12 aurora: kemerovo-neon 142 · meduza-aurora 420 · gold-aurora-spin epic 1420 spin 3s · 42/142/420/1420 common→legendary · крафт 42 (3×common) · разбор +100 монет (epic) · GSAP stagger y20 0.08 · aurora epic forge spring
      </p>

      <style>{`@keyframes auroraSpin{from{filter:hue-rotate(0deg)}to{filter:hue-rotate(360deg)}} @keyframes neonPrismSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default PrismVaultPage;
