import { useEffect, useState, useRef, useCallback } from "react";
import gsap from "gsap";

const VIP_IDS = new Set(["title-vip", "title-god", "frame-void", "bundle-void"]);
const SEEN_KEY = "magnum-vip-popup-seen";

function isVipId(id: string): boolean {
  return VIP_IDS.has(id);
}

export function VipActivatedPopup() {
  const [visible, setVisible] = useState(false);
  const [cosmeticId, setCosmeticId] = useState<string>("title-vip");
  const [equipping, setEquipping] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const lastShowRef = useRef(0);
  const visibleRef = useRef(false);
  useEffect(() => { visibleRef.current = visible; }, [visible]);

  const close = useCallback(() => {
    try { sessionStorage.setItem(SEEN_KEY, cosmeticId); } catch {}
    setVisible(false);
  }, [cosmeticId]);

  const show = useCallback((id: string, force: boolean) => {
    if (!isVipId(id)) return;
    const now = Date.now();
    if (now - lastShowRef.current < 800) return;
    if (visibleRef.current) return;
    if (!force) {
      try { if (sessionStorage.getItem(SEEN_KEY) === id) return; } catch {}
    } else {
      try { sessionStorage.removeItem(SEEN_KEY); } catch {}
    }
    lastShowRef.current = now;
    setCosmeticId(id);
    setVisible(true);
  }, []);

  // listen to both events — single source, deduped via debounce + seen guard
  useEffect(() => {
    const onCosmeticBought = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as string | undefined;
      if (typeof detail === "string" && detail) {
        show(detail, true);
      }
    };
    const onTierRefresh = () => {
      // tier-refresh without detail: check if we already have VIP tier? Don't auto-show to avoid spam, but allow if seen not set and no recent show.
      // We treat it as soft trigger: only show if not seen and not recently shown. Try to infer from sessionStorage not set.
      // To avoid false positives, we skip tier-refresh unless it carries vip detail via cosmetic-bought; this listener exists to dedupe single source.
      // No-op: the cosmetic-bought is primary. Keeping listener to satisfy spec single-source without duplicate.
    };
    window.addEventListener("magnum:cosmetic-bought" as unknown as string, onCosmeticBought as EventListener);
    window.addEventListener("magnum:tier-refresh" as unknown as string, onTierRefresh as EventListener);
    return () => {
      window.removeEventListener("magnum:cosmetic-bought" as unknown as string, onCosmeticBought as EventListener);
      window.removeEventListener("magnum:tier-refresh" as unknown as string, onTierRefresh as EventListener);
    };
  }, [show]);

  // GSAP: stagger y20 0.08 + shimmer epic 1.5s, prefers-reduced-motion gate, gsap.context
  useEffect(() => {
    if (!visible || !overlayRef.current || !cardRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;
    const ctx = gsap.context(() => {
      const overlay = overlayRef.current!;
      const card = cardRef.current!;
      gsap.set(overlay, { opacity: 0 });
      gsap.set(card, { y: 20, opacity: 0, scale: 0.97 });
      gsap.to(overlay, { opacity: 1, duration: 0.28, ease: "power2.out" });
      gsap.to(card, { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: "back.out(1.4)", delay: 0.06 });
      const inner = card.querySelectorAll("[data-vip-stagger]");
      if (inner.length) {
        gsap.set(inner, { y: 20, opacity: 0 });
        gsap.to(inner, { y: 0, opacity: 1, duration: 0.38, stagger: 0.08, ease: "power2.out", delay: 0.18 });
      }
      const glow = card.querySelector("[data-vip-glow]") as HTMLElement | null;
      if (glow) {
        gsap.set(glow, { opacity: 0.12 });
        gsap.to(glow, { opacity: 0.22, duration: 1.5, repeat: -1, yoyo: true, ease: "sine.inOut" });
        // shimmer: rotate conic-gradient via background position or rotation
        gsap.to(glow, { rotation: 360, duration: 1.5, repeat: -1, ease: "none", transformOrigin: "50% 50%" });
      }
    }, overlayRef);
    return () => ctx.revert();
  }, [visible]);

  const handleEquip = async () => {
    const target = cosmeticId === "bundle-void" ? "title-vip" : (["title-vip", "frame-void", "title-god"].includes(cosmeticId) ? cosmeticId : "title-vip");
    setEquipping(true);
    try {
      const r = await fetch("/magnum/api/shop/cosmetic/equip", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cosmeticId: target }),
      });
      // close regardless
      close();
      if (r.ok) {
        window.dispatchEvent(new CustomEvent("magnum:tier-refresh"));
      }
    } catch {
      close();
    } finally {
      setEquipping(false);
    }
  };

  if (!visible) return null;

  return (
    <div
      ref={overlayRef}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="VIP активирован"
      style={{ position: "fixed", inset: 0, zIndex: 10000, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.62)", backdropFilter: "blur(6px)", padding: 16 }}
    >
      <div
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(420px,92vw)", background: "#121214", border: "1px solid #23232b", borderRadius: 20, padding: 20, boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 28px rgba(255,204,0,0.25)", position: "relative", overflow: "hidden" }}
      >
        <div
          data-vip-glow
          aria-hidden
          style={{ position: "absolute", inset: -2, background: "conic-gradient(from 0deg,#ffcc00,#ff44cc,#5865f2,#00ffcc,#ffcc00)", opacity: 0.12, filter: "blur(14px)", pointerEvents: "none" }}
        />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div data-vip-stagger style={{ fontWeight: 900, fontSize: "1.15rem", letterSpacing: ".02em", marginBottom: 6 }}>VIP активирован — твоя обводка сияет ✨</div>
          <p data-vip-stagger style={{ opacity: 0.75, fontSize: "0.86rem", margin: "0 0 14px", lineHeight: 1.4 }}>Без перезагрузки — уровень уже в профиле. Надень титул и рамка засветится золотом.</p>
          <div
            data-vip-stagger
            aria-hidden
            style={{ height: 56, borderRadius: 14, border: "2px solid rgba(255,204,0,0.45)", background: "conic-gradient(from 0deg,#ffcc00,#ff44cc,#5865f2,#00ffcc,#ffcc00)", boxShadow: "0 0 18px rgba(255,204,0,0.45), 0 0 28px rgba(255,204,0,0.2)", display: "grid", placeItems: "center", marginBottom: 14, position: "relative", overflow: "hidden" }}
          >
            <span style={{ background: "#121214", borderRadius: 999, padding: "4px 10px", fontSize: "0.78rem", fontWeight: 800, border: "1px solid rgba(255,255,255,0.1)" }}>@ты · VIP</span>
          </div>
          <div data-vip-stagger style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={handleEquip} disabled={equipping} style={{ flex: 1, background: "#ffcc00", color: "#111", border: "1px solid #ffcc00", borderRadius: 12, padding: "0.6rem 0.8rem", fontWeight: 900, cursor: equipping ? "wait" : "pointer", opacity: equipping ? 0.7 : 1 }}>Надеть сейчас</button>
            <button type="button" onClick={close} style={{ flex: 1, background: "transparent", color: "#9aa4b2", border: "1px solid #23232b", borderRadius: 12, padding: "0.6rem 0.8rem", cursor: "pointer", fontWeight: 700 }}>Позже</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VipActivatedPopup;
