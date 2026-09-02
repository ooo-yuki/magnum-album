import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";

const LS_KEY = "magnum:first-invite-popup:date";
const COOKIE_NAME = "magnum_first_invite";

function todayStr(): string { return new Date().toISOString().slice(0, 10); }
function alreadyShownToday(): boolean {
  const t = todayStr();
  try { if (localStorage.getItem(LS_KEY) === t) return true; } catch {}
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
    if (m && decodeURIComponent(m[1]) === t) return true;
  } catch {}
  return false;
}
function markShown(): void {
  const t = todayStr();
  try { localStorage.setItem(LS_KEY, t); } catch {}
  try { document.cookie = `${COOKIE_NAME}=${encodeURIComponent(t)}; path=/; max-age=86400; SameSite=Lax`; } catch {}
}

export function FirstInvitePopup({ triggerKey }: { triggerKey?: number }) {
  const [open, setOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const show = useCallback(() => {
    if (alreadyShownToday()) return;
    markShown();
    setOpen(true);
  }, []);

  useEffect(() => {
    const h = () => { show(); };
    window.addEventListener("magnum:first-invite", h as EventListener);
    return () => window.removeEventListener("magnum:first-invite", h as EventListener);
  }, [show]);

  // triggerKey bumps on copy/share
  useEffect(() => {
    if (triggerKey != null && triggerKey > 0) show();
  }, [triggerKey, show]);

  useEffect(() => {
    if (!open || !cardRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;
    const el = cardRef.current;
    const ov = overlayRef.current;
    const ctx = gsap.context(() => {
      if (ov) { gsap.set(ov, { opacity: 0 }); gsap.to(ov, { opacity: 1, duration: 0.24, ease: "power2.out" }); }
      gsap.set(el, { y: 28, opacity: 0, scale: 0.96 });
      gsap.to(el, { y: 0, opacity: 1, scale: 1, duration: 0.48, ease: "back.out(1.4)", delay: 0.06 });
      gsap.to(el, { scale: 1.015, duration: 0.42, ease: "power2.inOut", repeat: 1, yoyo: true, delay: 0.55 });
      // confetti 60 — gacha.game 20pct lifetime celebration
      try { const colors=["#ffcc00","#ff2d55","#a855f7","#00ff88","#fff"]; for(let i=0;i<60;i++){ const d=document.createElement("div"); d.style.cssText="position:fixed;left:50%;top:42%;width:6px;height:6px;border-radius:2px;pointer-events:none;z-index:120"; d.style.background=colors[i%colors.length]||"#fff"; document.body.appendChild(d); const ang=Math.random()*Math.PI*2, dist=60+Math.random()*220; gsap.to(d,{x:Math.cos(ang)*dist, y:Math.sin(ang)*dist+60, rotation: Math.random()*720, opacity:0, duration:0.7+Math.random()*0.6, ease:"power2.out", onComplete:()=>d.remove()}); } } catch{}
    });
    return () => ctx.revert();
  }, [open]);

  const close = useCallback(() => {
    const el = cardRef.current;
    const ov = overlayRef.current;
    const doClose = () => setOpen(false);
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { doClose(); return; }
    const ctx = gsap.context(() => {
      if (ov) gsap.to(ov, { opacity: 0, duration: 0.22, ease: "power2.in" });
      gsap.to(el, { y: 18, opacity: 0, scale: 0.97, duration: 0.28, ease: "power2.in", onComplete: doClose });
    });
    window.setTimeout(doClose, 600);
    void ctx;
  }, []);

  // esc + overlay click
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Братуха-код скопирован"
      data-testid="first-invite-popup"
      onClick={(e) => { if (e.target === overlayRef.current) close(); }}
      style={{ position: "fixed", inset: 0, zIndex: 95, display: "grid", placeItems: "center", padding: "1rem", background: "rgba(0,0,0,0.58)", backdropFilter: "blur(10px)" }}
    >
      <div
        ref={cardRef}
        style={{ width: "min(420px, calc(100vw - 1.5rem))", borderRadius: 20, background: "rgba(16,16,18,0.98)", border: "1px solid rgba(255,204,0,0.28)", boxShadow: "0 0 0 1px rgba(255,204,0,0.14), 0 22px 64px rgba(0,0,0,0.55), 0 0 28px rgba(255,204,0,0.12)", overflow: "hidden" }}
      >
        <div style={{ height: 4, background: "linear-gradient(90deg,#ff2d55,#ffcc00,#00ff88,#5865f2,#ff2d55)", backgroundSize: "200% 100%" }} />
        <button onClick={close} aria-label="Закрыть" style={{ position: "absolute" as const, top: 10, right: 10, width: 32, height: 32, borderRadius: 10, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: "1.15rem", lineHeight: 1, cursor: "pointer", display: "grid", placeItems: "center" }}>×</button>
        <div style={{ padding: "1.2rem 1.25rem 1.1rem", display: "flex", flexDirection: "column", gap: "0.55rem" }}>
          <div style={{ fontSize: "0.68rem", fontWeight: 900, letterSpacing: "0.1em", color: "#ffcc00", textTransform: "uppercase" as const }}>БРАТУХА-КОД СКОПИРОВАН!</div>
          <div style={{ fontSize: "1.15rem", fontWeight: 900, color: "#fff", lineHeight: 1.25 }}>🎉 Первый инвайт = <span style={{ color: "#ffcc00" }}>+142 dust</span> обоим · <span style={{ color: "#a855f7", background: "rgba(168,85,247,0.12)", padding: "1px 6px", borderRadius: 999, border: "1px solid rgba(168,85,247,0.22)" }}>gacha +20% lifetime</span></div>
          <div style={{ fontSize: "0.84rem", color: "rgba(240,240,240,0.68)", lineHeight: 1.45 }}>
            Пригласи 1 братуху → <b style={{ color: "#ffcc00" }}>+142 dust</b> каждому. 3 инвайта → <b style={{ color: "#ffcc00" }}>+420 dust</b> (прогресс 0/1/3). Поделись QR-диплинком <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: 6 }}> ?ref=42-XXXX</code>.
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" as const }}>
            <a href="/magnum/presave-rating" onClick={close} style={{ flex: 1, textAlign: "center" as const, padding: "0.68rem 0.9rem", borderRadius: 100, background: "#ff2d55", color: "#fff", fontWeight: 900, fontSize: "0.86rem", textDecoration: "none", boxShadow: "0 8px 20px rgba(255,45,85,0.22)" }}>К рейтингу →</a>
            <button onClick={close} style={{ flex: 1, padding: "0.68rem 0.9rem", borderRadius: 100, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontWeight: 800, fontSize: "0.86rem", cursor: "pointer" }}>Понятно ✦</button>
          </div>
          <div style={{ fontSize: "0.71rem", color: "rgba(240,240,240,0.38)", textAlign: "center" as const, marginTop: 2 }}>Показывается 1 раз в сутки · GSAP back.out(1.4)</div>
        </div>
      </div>
    </div>
  );
}
export default FirstInvitePopup;
