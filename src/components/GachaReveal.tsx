import { useEffect, useRef } from "react";
import gsap from "gsap";

export type RevealItem = { id: string; rarity: "common"|"rare"|"epic"|"legendary"; isNew: boolean; dust: number };

const RARITY_STYLE: Record<string, { border: string; glow: string; label: string; color: string }> = {
  common: { border: "1px solid rgba(255,255,255,0.12)", glow: "none", label: "COMMON", color: "#9aa4b2" },
  rare: { border: "1px solid #5865f2", glow: "0 0 12px #5865f2", label: "RARE", color: "#5865f2" },
  epic: { border: "2px solid transparent", glow: "0 0 18px #a855f7", label: "EPIC", color: "#a855f7" },
  legendary: { border: "2px solid transparent", glow: "0 0 22px #ffcc00", label: "LEGENDARY", color: "#ffcc00" },
};

export function GachaReveal({ items, onClose }: { items: RevealItem[]; onClose: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wrapRef.current || !cardsRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      if (wrapRef.current) gsap.set(wrapRef.current, { clearProps: "all" });
      const els = cardsRef.current.querySelectorAll<HTMLElement>("[data-card]");
      els.forEach(el => gsap.set(el, { clearProps: "all" }));
      return;
    }
    const cards = cardsRef.current.querySelectorAll<HTMLElement>("[data-card]");
    if (!cards.length) return;
    const ctx = gsap.context(() => {
      gsap.set(wrapRef.current, { y: -20, opacity: 0 });
      gsap.to(wrapRef.current, { y: 0, opacity: 1, duration: 0.42, ease: "power2.out", overwrite: true });
      cards.forEach((card, idx) => {
        const rarity = card.dataset.rarity || "common";
        const delay = idx * 0.12;
        if (rarity === "common") {
          gsap.set(card, { y: 12, opacity: 0 });
          gsap.to(card, { y: 0, opacity: 1, duration: 0.3, delay, ease: "power2.out", overwrite: true });
        } else if (rarity === "rare") {
          gsap.set(card, { y: 24, opacity: 0, scale: 0.96 });
          gsap.to(card, { y: 0, opacity: 1, scale: 1, duration: 0.5, delay, ease: "back.out(1.2)", overwrite: true });
        } else if (rarity === "epic") {
          gsap.set(card, { y: 32, opacity: 0, scale: 0.9 });
          gsap.to(card, { y: 0, opacity: 1, scale: 1, duration: 0.7, delay, ease: "elastic.out(1,0.5)", overwrite: true });
          // epic shimmer is CSS linear 1.2s infinite — no extra GSAP needed, but ensure overwrite
        } else if (rarity === "legendary") {
          gsap.set(card, { y: 40, opacity: 0, scale: 0.85 });
          gsap.to(card, { y: 0, opacity: 1, scale: 1, duration: 0.9, delay, ease: "elastic.out(1,0.45)", overwrite: true });
          const inner = card.querySelector<HTMLElement>("[data-legendary-inner]");
          if (inner) {
            gsap.to(inner, { scale: 1.06, duration: 0.5, delay: delay + 0.9, yoyo: true, repeat: 1, ease: "power2.inOut", overwrite: true });
          }
          // 120 confetti: 80 immediate + 40 burst delayed 300ms — per spec total 120
          const root = card;
          for (let i = 0; i < 80; i++) {
            const d = document.createElement("div");
            d.style.position = "absolute"; d.style.left = "50%"; d.style.top = "40%"; d.style.width = "6px"; d.style.height = "6px"; d.style.borderRadius = "2px";
            d.style.background = i % 3 === 0 ? "#ffcc00" : i % 3 === 1 ? "#ff2d55" : "#fff";
            d.style.pointerEvents = "none"; d.style.zIndex = "5";
            root.appendChild(d);
            const ang = Math.random() * Math.PI * 2, dist = 40 + Math.random() * 180;
            gsap.to(d, { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist + 40, rotation: Math.random() * 720, opacity: 0, duration: 0.8 + Math.random() * 0.5, ease: "power2.out", overwrite: true, onComplete: () => d.remove() });
          }
          setTimeout(() => {
            for (let i = 0; i < 40; i++) {
              const d = document.createElement("div");
              d.style.position = "absolute"; d.style.left = "50%"; d.style.top = "50%"; d.style.width = "4px"; d.style.height = "10px"; d.style.background = "#ffd700"; d.style.pointerEvents = "none"; d.style.zIndex = "5";
              root.appendChild(d);
              const ang = Math.random() * Math.PI * 2;
              gsap.to(d, { x: Math.cos(ang) * 120, y: Math.sin(ang) * 120, rotation: 720, opacity: 0, duration: 0.6, ease: "power2.out", overwrite: true, onComplete: () => d.remove() });
            }
          }, 300);
        }
      });
    }, wrapRef);
    // sound via WebAudio
    try {
      const ctxAudio = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const hasLegendary = items.some(i => i.rarity === "legendary");
      const freq = hasLegendary ? 880 : items.some(i => i.rarity === "epic") ? 660 : 440;
      const osc = ctxAudio.createOscillator();
      const gain = ctxAudio.createGain();
      osc.frequency.setValueAtTime(600, ctxAudio.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.4, ctxAudio.currentTime + 0.4);
      gain.gain.setValueAtTime(0.12, ctxAudio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctxAudio.currentTime + 0.5);
      osc.connect(gain).connect(ctxAudio.destination);
      osc.start(); osc.stop(ctxAudio.currentTime + 0.5);
    } catch {}
    return () => ctx.revert();
  }, [items]);

  return (
    <div ref={wrapRef} style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ maxWidth: 980, width: "100%", maxHeight: "90vh", overflowY: "auto", background: "rgba(18,18,20,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <strong style={{ fontSize: 18 }}>Вскрытие — {items.length} шт</strong>
          <button onClick={onClose} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#fff", cursor: "pointer" }}>Закрыть</button>
        </div>
        <div ref={cardsRef} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
          {items.map((it, idx) => {
            const st = RARITY_STYLE[it.rarity]!;
            const isEpic = it.rarity === "epic";
            const isLeg = it.rarity === "legendary";
            return (
              <div
                key={it.id + idx}
                data-card
                data-rarity={it.rarity}
                style={{
                  position: "relative",
                  padding: 12,
                  borderRadius: 14,
                  background: isLeg
                    ? "conic-gradient(from 0deg,#ffd700,#ffcc00,#ff8a00,#ffd700)"
                    : isEpic
                      ? "conic-gradient(from 0deg,#a855f7,#5865f2,#00ffcc,#a855f7)"
                      : "rgba(255,255,255,0.04)",
                  border: st.border,
                  boxShadow: isLeg || isEpic ? undefined : st.glow as string,
                  overflow: "hidden",
                  animation: isLeg ? "conicSpin 3s linear infinite" : undefined,
                }}
              >
                <div
                  data-legendary-inner={isLeg ? "" : undefined}
                  style={{
                    background: isLeg || isEpic ? "rgba(12,12,14,0.96)" : "transparent",
                    borderRadius: 10,
                    padding: isLeg || isEpic ? 10 : 0,
                    boxShadow: it.rarity === "rare" ? "0 0 12px #5865f2" : undefined,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: st.color }}>{st.label}</div>
                  <div style={{ fontWeight: 800, marginTop: 6, fontSize: 12, wordBreak: "break-all" }}>{it.id}</div>
                  <div style={{ marginTop: 6, fontSize: 11, opacity: 0.7 }}>
                    {it.isNew ? "Новое!" : `Дубликат +${it.dust} пыли`}
                    {!it.isNew && it.dust > 0 && <span style={{ marginLeft: 6, padding: "2px 5px", borderRadius: 6, background: "rgba(168,85,247,0.18)", border: "1px solid rgba(168,85,247,0.28)", fontSize: 10, fontWeight: 800, color: "#d8b4fe" }}>+{it.dust} пыль</span>}
                  </div>
                  {isEpic && <div style={{ position: "absolute", inset: 0, borderRadius: 14, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)", animation: "shimmer 1.2s linear infinite", pointerEvents: "none" }} />}
                </div>
              </div>
            );
          })}
        </div>
        <style>{`@keyframes conicSpin{to{transform:rotate(360deg)}} @keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}`}</style>
      </div>
    </div>
  );
}
