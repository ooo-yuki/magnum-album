import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ZAVRI_BY_ID, RARITY_COLOR } from "../lib/zavri/catalog";

export type ZavriRevealItem =
  | { kind: "species"; rarity: string; speciesId: string; isNew?: boolean; isFeatured?: boolean }
  | { kind: "shards"; rarity: string; speciesId: string; amount: number };

const RARITY_STYLE: Record<string, { border: string; label: string; color: string; bg: string }> = {
  common: { border: "1px solid rgba(255,255,255,0.12)", label: "ОБЫЧНЫЙ", color: "#9aa4b2", bg: "rgba(255,255,255,0.06)" },
  rare: { border: "1px solid #5865f2", label: "РЕДКИЙ", color: "#5865f2", bg: "rgba(88,101,242,0.14)" },
  epic: { border: "1px solid #a855f7", label: "ЭПИЧЕСКИЙ", color: "#a855f7", bg: "rgba(168,85,247,0.16)" },
  legendary: { border: "1px solid #ffcc00", label: "ЛЕГЕНДАРНЫЙ", color: "#ffcc00", bg: "rgba(255,204,0,0.16)" },
};

function rarityTier(r: string): number {
  if (r === "legendary") return 3;
  if (r === "epic") return 2;
  if (r === "rare") return 1;
  return 0;
}

export function ZavriReveal({ items, onClose }: { items: ZavriRevealItem[]; onClose: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const tunnelRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"tunnel" | "cards">(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "cards";
    return "tunnel";
  });

  const hasLeg = items.some((i) => i.rarity === "legendary");
  const hasEpic = items.some((i) => i.rarity === "epic");
  const tunnelMs = hasLeg ? 1600 : hasEpic ? 1200 : 750;

  useEffect(() => {
    if (phase !== "tunnel" || !tunnelRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) { setPhase("cards"); return; }
    const ctx = gsap.context(() => {
      const stars = tunnelRef.current!.querySelectorAll<HTMLElement>("[data-star]");
      stars.forEach((el, i) => {
        const delay = (i % 7) * 0.06;
        gsap.set(el, { scale: 0.2, opacity: 0 });
        gsap.to(el, { scale: 1, opacity: 1, duration: 0.3, delay, ease: "power2.out" });
        gsap.to(el, { scale: 3.5, opacity: 0, duration: 0.9, delay: delay + 0.25, ease: "power2.in" });
        const ang = (i / stars.length) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 140 + Math.random() * 420;
        gsap.to(el, { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist, duration: 1.1, delay, ease: "power2.in" });
      });
      // sky color wash by highest rarity
      const sky = tunnelRef.current!.querySelector<HTMLElement>("[data-sky]");
      if (sky) {
        const col = hasLeg ? "#221605" : hasEpic ? "#1c1128" : "#0f172a";
        gsap.fromTo(sky, { backgroundColor: "#020208" }, { backgroundColor: col, duration: 0.5, ease: "power2.out" });
      }
    }, tunnelRef);
    const id = window.setTimeout(() => setPhase("cards"), tunnelMs);
    return () => { ctx.revert(); window.clearTimeout(id); };
  }, [phase, hasEpic, hasLeg, tunnelMs]);

  useEffect(() => {
    if (phase !== "cards" || !wrapRef.current || !cardsRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;
    const cards = cardsRef.current.querySelectorAll<HTMLElement>("[data-card]");
    const ctx = gsap.context(() => {
      gsap.set(wrapRef.current, { y: -16, opacity: 0 });
      gsap.to(wrapRef.current, { y: 0, opacity: 1, duration: 0.36, ease: "power2.out" });
      cards.forEach((card, idx) => {
        const rarity = card.dataset.rarity || "common";
        const tier = rarityTier(rarity);
        const delay = idx * 0.11;
        gsap.set(card, { y: 18 + tier * 8, opacity: 0, scale: 0.96 - tier * 0.02 });
        if (tier <= 1) gsap.to(card, { y: 0, opacity: 1, scale: 1, duration: 0.35, delay, ease: "power2.out" });
        else if (tier === 2) gsap.to(card, { y: 0, opacity: 1, scale: 1, duration: 0.6, delay, ease: "back.out(1.2)" });
        else gsap.to(card, { y: 0, opacity: 1, scale: 1, duration: 0.85, delay, ease: "elastic.out(1,0.45)" });
        if (rarity === "legendary") {
          for (let i = 0; i < 90; i++) {
            const d = document.createElement("div");
            d.style.position = "absolute"; d.style.left = "50%"; d.style.top = "44%"; d.style.width = "5px"; d.style.height = "5px"; d.style.borderRadius = "50%";
            d.style.background = i % 3 === 0 ? "#ffcc00" : i % 3 === 1 ? "#ff2d55" : "#fff"; d.style.pointerEvents = "none"; d.style.zIndex = "4";
            card.appendChild(d);
            const ang = Math.random() * Math.PI * 2, dist = 30 + Math.random() * 200;
            gsap.to(d, { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist + 30, rotation: Math.random() * 720, opacity: 0, duration: 0.8 + Math.random() * 0.5, ease: "power2.out", onComplete: () => d.remove() });
          }
        } else if (rarity === "epic") {
          for (let i = 0; i < 36; i++) {
            const d = document.createElement("div");
            d.style.position = "absolute"; d.style.left = "50%"; d.style.top = "42%"; d.style.width = "4px"; d.style.height = "4px"; d.style.borderRadius = "50%";
            d.style.background = i % 2 === 0 ? "#a855f7" : "#60a5fa"; d.style.pointerEvents = "none"; d.style.zIndex = "3";
            card.appendChild(d);
            const ang = Math.random() * Math.PI * 2, dist = 24 + Math.random() * 140;
            gsap.to(d, { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist, opacity: 0, duration: 0.55, ease: "power2.out", onComplete: () => d.remove() });
          }
        }
      });
    }, wrapRef);
    // chime
    try {
      const ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const base = hasLeg ? 880 : hasEpic ? 660 : 440;
      const osc = ac.createOscillator(), gain = ac.createGain();
      osc.frequency.setValueAtTime(620, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(base * 1.35, ac.currentTime + 0.35);
      gain.gain.setValueAtTime(0.14, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.6);
      osc.connect(gain).connect(ac.destination); osc.start(); osc.stop(ac.currentTime + 0.6);
    } catch {}
    return () => ctx.revert();
  }, [phase, items, hasEpic, hasLeg]);

  const sorted = [...items].sort((a, b) => rarityTier(b.rarity) - rarityTier(a.rarity));

  if (phase === "tunnel") {
    return (
      <div ref={tunnelRef} style={{ position: "fixed", inset: 0, zIndex: 95, display: "grid", placeItems: "center", overflow: "hidden" }}>
        <div data-sky style={{ position: "absolute", inset: 0, background: "#020208" }} />
        {/* radial glow by top rarity */}
        <div style={{ position: "absolute", inset: 0, background: hasLeg ? "radial-gradient(900px 600px at 50% 65%, rgba(255,204,0,0.22), transparent 62%)" : hasEpic ? "radial-gradient(900px 600px at 50% 65%, rgba(168,85,247,0.20), transparent 62%)" : "radial-gradient(900px 600px at 50% 65%, rgba(96,165,250,0.14), transparent 64%)" }} aria-hidden />
        <div style={{ position: "relative", width: 120, height: 120 }}>
          {Array.from({ length: 42 }).map((_, i) => (
            <span key={i} data-star style={{ position: "absolute", left: 57, top: 57, width: 6, height: 6, borderRadius: 999, background: hasLeg ? (i % 3 === 0 ? "#ffcc00" : i % 3 === 1 ? "#ff8a00" : "#fff") : hasEpic ? (i % 2 === 0 ? "#a855f7" : "#60a5fa") : "#94a3b8", boxShadow: hasLeg ? "0 0 10px rgba(255,204,0,0.9)" : hasEpic ? "0 0 8px rgba(168,85,247,0.8)" : "0 0 6px rgba(148,163,184,0.7)" }} />
          ))}
        </div>
        <div style={{ position: "absolute", bottom: 28, color: "rgba(255,255,255,0.78)", fontSize: 12, letterSpacing: "0.14em", fontWeight: 800 }}>
          {hasLeg ? "ЛЕГЕНДАРНЫЙ СИГНАЛ…" : hasEpic ? "ЭПИЧЕСКИЙ ОТКЛИК…" : "СКАНИРОВАНИЕ…"}
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapRef} style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(2,2,8,0.74)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 1020, width: "100%", maxHeight: "92vh", overflowY: "auto", background: "rgba(16,16,18,0.98)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <strong style={{ fontSize: 18 }}>Вскрытие — {items.length} шт {hasLeg && <span style={{ marginLeft: 8, padding: "3px 8px", borderRadius: 999, background: "#ffcc00", color: "#141008", fontSize: 10, letterSpacing: "0.08em" }}>LEGENDARY!</span>}</strong>
          <button onClick={onClose} style={{ padding: "6px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#fff", cursor: "pointer" }}>Забрать</button>
        </div>
        <div ref={cardsRef} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: 12 }}>
          {sorted.map((it, idx) => {
            const def = ZAVRI_BY_ID.get(it.speciesId);
            const st = RARITY_STYLE[it.rarity] ?? RARITY_STYLE.common!;
            const isLeg = it.rarity === "legendary", isEpic = it.rarity === "epic";
            const title = def ? `${def.name} · ${def.title}` : it.speciesId;
            const rarityColor = RARITY_COLOR[it.rarity as never] ?? "#9aa4b2";
            return (
              <div
                key={idx + it.speciesId}
                data-card
                data-rarity={it.rarity}
                style={{
                  position: "relative",
                  borderRadius: 16,
                  padding: isLeg || isEpic ? 1.5 : 0,
                  background: isLeg ? "conic-gradient(from 0deg,#ffd700,#ffcc00,#ff8a00,#ffd700)" : isEpic ? "conic-gradient(from 0deg,#a855f7,#5865f2,#06ffa5,#a855f7)" : "transparent",
                  border: isLeg || isEpic ? "none" : st.border,
                  overflow: "hidden",
                }}
              >
                <div style={{ background: isLeg || isEpic ? "rgba(14,14,16,0.98)" : st.bg, borderRadius: 14, padding: 10, minHeight: 196, display: "grid", alignContent: "start", gap: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.1em", color: st.color }}>{st.label}{it.kind === "species" && (it as { isFeatured?: boolean }).isFeatured ? " · ФИЧА" : ""}</div>
                  <img src={`/magnum/images/zavri/${it.speciesId}.png`} alt={def?.name ?? it.speciesId} loading="lazy" style={{ width: "100%", aspectRatio: "1", objectFit: "contain", background: "radial-gradient(220px 140px at 50% 30%, rgba(255,255,255,0.06), transparent)", borderRadius: 10, border: `1px solid ${isLeg ? "rgba(255,204,0,0.35)" : isEpic ? "rgba(168,85,247,0.30)" : "rgba(255,255,255,0.08)"}` }} />
                  <div style={{ fontWeight: 900, fontSize: 13, lineHeight: 1.15 }}>{title}</div>
                  <div style={{ fontSize: 11, color: it.kind === "shards" ? "#c4b5fd" : isLeg ? "#facc15" : "rgba(255,255,255,0.72)", fontWeight: 700 }}>
                    {it.kind === "shards" ? `Осколки ×${it.amount}` : (it as { isNew?: boolean }).isNew ? "Новый завр!" : "Дубликат (осколки начислены)"}
                  </div>
                  {it.rarity === "legendary" && it.kind === "species" && <div style={{ fontSize: 10, color: rarityColor, opacity: 0.9, fontWeight: 800 }}>★ шанс 0.6% · гарант 180</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
