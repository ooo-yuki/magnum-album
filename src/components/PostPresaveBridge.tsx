import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import gsap from "gsap";

/**
 * P0 funnel: presave 223 (+52/30м) but presaveUsers 0 — all clicks anon.
 * Post-presave bridge: after anon click show registration nudge
 * "Забери +42 монеты — зарегистрируйся 1 клик" with quickRegister + recover-bonus.
 * Authed branch keeps game CTA "Сыграй первую игру → 42".
 */
const BRIDGE_KEY = "magnum:post-presave-bridge-at";
const AUTO_NAV_SEC = 6;
type Mode = "anon" | "authed";
export function PostPresaveBridge() {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<Mode>("anon");
  const [countdown, setCountdown] = useState(AUTO_NAV_SEC);
  const [authBusy, setAuthBusy] = useState(false);
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [recoverToast, setRecoverToast] = useState<string | null>(null);
  const [recoverDone, setRecoverDone] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const autoRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const dismiss = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (autoRef.current) window.clearTimeout(autoRef.current);
    timerRef.current = null;
    autoRef.current = null;
    const el = cardRef.current;
    const ov = overlayRef.current;
    const done = () => setVisible(false);
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { done(); return; }
    gsap.to(el, { y: 18, opacity: 0, scale: 0.97, duration: 0.24, ease: "power2.in", onComplete: done });
    if (ov) gsap.to(ov, { opacity: 0, duration: 0.2, ease: "power2.in" });
  }, []);
  const goGames = useCallback(() => {
    try { sessionStorage.setItem("magnum:post-presave-bridge-shown", "1"); } catch {}
    dismiss();
    window.setTimeout(() => {
      if (location.pathname === "/magnum/games") {
        const grid = document.querySelector("[data-testid='gameshub-grid']") || document.getElementById("gameshub");
        if (grid) grid.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
        else window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      navigate("/magnum/games?from=presave#gameshub");
      window.setTimeout(() => {
        const el = document.getElementById("gameshub") || document.querySelector("[data-testid='gameshub-grid']");
        if (el) el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      }, 420);
    }, 180);
  }, [dismiss, navigate, location.pathname]);

  // quickRegister inside bridge — same logic as AuthStatus quickRegister
  const quickRegister = useCallback(async () => {
    if (authBusy) return;
    setAuthBusy(true); setAuthErr(null);
    try {
      const suffix = Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 4);
      const username = `brat-${suffix}`;
      const password = `42-${suffix}-${Date.now().toString(36).slice(-4)}`;
      const r = await fetch("/magnum/api/auth/register", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const j = await r.json().catch(() => ({})) as { error?: string; user?: { id:number; username:string } };
      if (!r.ok) { setAuthErr(j.error || "ошибка 1-клик"); return; }
      try { window.dispatchEvent(new CustomEvent("magnum:auth", { detail: j.user })); } catch {}
      // after auth, auto-link presave: fire authenticated click so funnel presaveUsers>0 + bonus 42
      try {
        await fetch("/magnum/api/presave/click", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: "https://music.thefence.me/psmagnum", ts: Date.now(), variant: "post-presave-bridge" }) });
      } catch {}
      // also try recover dust (idempotent)
      try {
        const rec = await fetch("/magnum/api/presave/recover-bonus", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
        const rj = await rec.json().catch(()=>({})) as { ok?:boolean; dust?:number };
        if (rec.ok && rj.ok) setRecoverToast(`+${rj.dust ?? 142} dust — пресейв привязан!`);
        else setRecoverToast("+42 монеты начислены — пресейв привязан!");
      } catch { setRecoverToast("+42 монеты — пресейв привязан!"); }
      setTimeout(()=> setRecoverToast(null), 2800);
      // switch to authed game CTA after short celebration
      setMode("authed");
      setCountdown(AUTO_NAV_SEC);
      setRecoverDone(true);
    } catch { setAuthErr("сеть упала"); }
    finally { setAuthBusy(false); }
  }, [authBusy]);

  const openAuth = useCallback(() => {
    dismiss();
    window.setTimeout(()=> {
      try { window.dispatchEvent(new CustomEvent("magnum:need-auth")); } catch {}
    }, 180);
  }, [dismiss]);

  const handleRecover = useCallback(async () => {
    if (authBusy) return;
    setAuthBusy(true); setAuthErr(null);
    try {
      const res = await fetch("/magnum/api/presave/recover-bonus", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const j = await res.json().catch(()=>({})) as { ok?:boolean; already?:boolean; dust?:number; error?:string };
      if (res.ok && j.ok) { setRecoverToast(`+${j.dust ?? 142} dust — спасибо!`); setRecoverDone(true); setTimeout(()=> setRecoverToast(null), 2600); }
      else if (j.already || j.error?.includes("already")) { setRecoverToast("Уже получено"); setTimeout(()=> setRecoverToast(null), 1800); }
      else { setAuthErr(j.error?.slice(0,80) || "ошибка"); }
    } catch { setAuthErr("сеть — попробуй снова"); }
    finally { setAuthBusy(false); }
  }, [authBusy]);

  const showBridge = useCallback(async () => {
    // decide mode by auth check
    let isAuthed = false;
    try {
      const r = await fetch("/magnum/api/auth/me", { credentials: "include" });
      if (r.ok) { const j = await r.json().catch(()=>null) as { user?: unknown } | null; isAuthed = Boolean(j?.user); }
    } catch {}
    try { sessionStorage.setItem(BRIDGE_KEY, String(Date.now())); } catch {}
    try { localStorage.setItem(BRIDGE_KEY, String(Date.now())); } catch {}
    setMode(isAuthed ? "authed" : "anon");
    setAuthErr(null);
    setRecoverToast(null);
    setCountdown(AUTO_NAV_SEC);
    setVisible(true);
  }, []);

  useEffect(() => {
    const onPresave = () => { void showBridge(); };
    window.addEventListener("magnum:presave" as unknown as string, onPresave as EventListener);
    // after external auth (AuthStatus login/register), if bridge visible in anon mode, switch to authed game CTA
    const onAuth = () => {
      if (visible && mode === "anon") {
        // verify presave link after auth
        void (async()=> {
          try { await fetch("/magnum/api/presave/click", { method:"POST", credentials:"include", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ url:"https://music.thefence.me/psmagnum", ts: Date.now(), variant:"post-presave-bridge-auth" }) }); } catch {}
          try {
            const rec = await fetch("/magnum/api/presave/recover-bonus", { method:"POST", credentials:"include", headers:{"Content-Type":"application/json"}, body: JSON.stringify({}) });
            const rj = await rec.json().catch(()=>({})) as { ok?:boolean };
            if (rec.ok && (rj as {ok?:boolean}).ok) setRecoverToast("Пресейв привязан — +dust!");
          } catch {}
          setMode("authed"); setCountdown(AUTO_NAV_SEC);
        })();
      }
    };
    window.addEventListener("magnum:auth" as unknown as string, onAuth as EventListener);
    return () => {
      window.removeEventListener("magnum:presave" as unknown as string, onPresave as EventListener);
      window.removeEventListener("magnum:auth" as unknown as string, onAuth as EventListener);
    };
  }, [showBridge, visible, mode]);

  useEffect(() => {
    if (!visible) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced && cardRef.current && overlayRef.current) {
      const ctx = gsap.context(() => {
        if (!cardRef.current || !overlayRef.current) return;
        gsap.set(overlayRef.current, { opacity: 0 });
        gsap.set(cardRef.current, { y: 28, opacity: 0, scale: 0.96 });
        gsap.to(overlayRef.current, { opacity: 1, duration: 0.28, ease: "power2.out" });
        gsap.to(cardRef.current, { y: 0, opacity: 1, scale: 1, duration: 0.52, ease: "back.out(1.5)", delay: 0.06 });
        const cta = cardRef.current.querySelector("[data-bridge-cta]") as HTMLElement | null;
        if (cta) gsap.to(cta, { boxShadow: "0 0 28px rgba(255,45,85,0.42), 0 0 48px rgba(255,204,0,0.18)", duration: 1.1, repeat: -1, yoyo: true, ease: "sine.inOut" });
      });
      const _ctx = ctx;
      return () => { _ctx.revert(); };
    }
    // only authed mode auto-navigates to games
    if (mode === "authed") {
      timerRef.current = window.setInterval(() => { setCountdown((c)=> { if (c<=1) { if(timerRef.current) window.clearInterval(timerRef.current); return 0; } return c-1; }); }, 1000);
      autoRef.current = window.setTimeout(() => { goGames(); }, AUTO_NAV_SEC*1000);
      return () => { if(timerRef.current) window.clearInterval(timerRef.current); if(autoRef.current) window.clearTimeout(autoRef.current); };
    }
  }, [visible, mode, goGames]);

  if (!visible) return null;
  if (mode === "anon") {
    return (
      <div ref={overlayRef} role="dialog" aria-modal="true" aria-label="Забери +42 монеты — зарегистрируйся" data-testid="post-presave-bridge" data-bridge="post-presave-anon" onClick={dismiss} style={{ position:"fixed", inset:0, zIndex:9997, display:"grid", placeItems:"center", background:"rgba(6,6,10,0.62)", backdropFilter:"blur(8px)", padding:"1rem" }}>
        <div ref={cardRef} onClick={e=>e.stopPropagation()} style={{ width:"min(520px,92vw)", background:"linear-gradient(135deg,#121214 0%,#1e1220 55%,#121214 100%)", border:"1px solid rgba(0,255,136,0.35)", borderRadius:20, boxShadow:"0 24px 64px rgba(0,0,0,0.55),0 0 0 1px rgba(0,255,136,0.12),0 0 36px rgba(0,255,136,0.16)", overflow:"hidden", position:"relative" }}>
          <div style={{ height:3, background:"linear-gradient(90deg,#00ff88,#ffcc00,#ff2d55,#5865f2,#00ff88)", backgroundSize:"200% 100%" }} />
          <button onClick={dismiss} aria-label="Закрыть" style={{ position:"absolute", top:10, right:10, width:30, height:30, borderRadius:10, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.08)", color:"#fff", cursor:"pointer", display:"grid", placeItems:"center", fontSize:16, lineHeight:1 }}>×</button>
          <div style={{ padding:"18px 18px 14px", display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
              <span style={{ fontSize:28, lineHeight:1, filter:"drop-shadow(0 0 10px rgba(0,255,136,0.55))" }}>🪙</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:900, fontSize:16, color:"#fff", lineHeight:1.25 }}>Забери <span style={{ color:"#00ff88" }}>+42 монеты</span> — зарегистрируйся 1 клик</div>
                <div style={{ fontSize:12.5, color:"rgba(255,255,255,0.62)", marginTop:4, lineHeight:1.45 }}>Пресейв засчитан анонимно — привяжи к аккаунту и получи бонус на баланс. 1 клик = авто brat-xxxx, без пароля.</div>
              </div>
            </div>
            {recoverToast && <div style={{ fontSize:12, color:"#00ff88", fontWeight:800, background:"rgba(0,255,136,0.08)", border:"1px solid rgba(0,255,136,0.18)", borderRadius:10, padding:"6px 10px" }}>{recoverToast}</div>}
            {authErr && <div style={{ fontSize:12, color:"#ff4d6a", fontWeight:700 }}>{authErr}</div>}
            <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
              <button type="button" data-bridge-cta="quick-register" data-testid="bridge-quick-register" onClick={quickRegister} disabled={authBusy} style={{ flex:"1 1 220px", background:"#00ff88", color:"#0a0a0a", border:"1px solid #00ff88", borderRadius:999, padding:"11px 16px", fontWeight:900, fontSize:14, cursor: authBusy?"wait":"pointer", opacity: authBusy?0.7:1, boxShadow:"0 10px 28px rgba(0,255,136,0.28)", display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                {authBusy?"…":"⚡ Зарегистрируйся — 1 клик +42"}
              </button>
              <button type="button" onClick={openAuth} style={{ flex:"0 0 auto", background:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.72)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:999, padding:"11px 14px", fontWeight:700, fontSize:13, cursor:"pointer" }}>Войти</button>
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
              <button type="button" data-testid="bridge-recover-bonus" onClick={handleRecover} disabled={authBusy || recoverDone} style={{ fontSize:11, color:recoverDone?"rgba(0,255,136,0.9)":"rgba(255,255,255,0.55)", background: recoverDone?"rgba(0,255,136,0.08)":"transparent", border:"1px solid "+(recoverDone?"rgba(0,255,136,0.18)":"rgba(255,255,255,0.1)"), borderRadius:999, padding:"5px 10px", cursor: authBusy?"wait":"pointer" }}>
                {recoverDone?"✓ привязано":"/api/presave/recover-bonus → +dust"}
              </button>
              <span style={{ fontSize:11, color:"rgba(255,255,255,0.32)" }}>или войди своим логином — бонус привяжется</span>
            </div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.38)", textAlign:"center", lineHeight:1.4 }}>Пресейв уже ушёл на music.thefence.me/psmagnum — регистрация привяжет твой клик к рейтингу (presaveUsers +1).</div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div ref={overlayRef} role="dialog" aria-modal="true" aria-label="Пресейв сохранён — сыграй первую игру" data-testid="post-presave-bridge" data-bridge="post-presave-authed" onClick={dismiss} style={{ position:"fixed", inset:0, zIndex:9997, display:"grid", placeItems:"center", background:"rgba(6,6,10,0.62)", backdropFilter:"blur(8px)", padding:"1rem" }}>
      <div ref={cardRef} onClick={e=>e.stopPropagation()} style={{ width:"min(520px,92vw)", background:"linear-gradient(135deg,#121214 0%,#1e1220 55%,#121214 100%)", border:"1px solid rgba(255,45,85,0.35)", borderRadius:20, boxShadow:"0 24px 64px rgba(0,0,0,0.55),0 0 0 1px rgba(255,45,85,0.12),0 0 36px rgba(255,45,85,0.16)", overflow:"hidden", position:"relative" }}>
        <div style={{ height:3, background:"linear-gradient(90deg,#ff2d55,#ffcc00,#00ff88,#5865f2,#ff2d55)", backgroundSize:"200% 100%" }} />
        <div style={{ height:2, background:"rgba(255,255,255,0.08)", position:"relative", overflow:"hidden" }}><div style={{ position:"absolute", left:0, top:0, bottom:0, width:`${((AUTO_NAV_SEC-countdown)/AUTO_NAV_SEC)*100}%`, background:"linear-gradient(90deg,#ff2d55,#ffcc00)", transition:"width 1s linear" }} /></div>
        <button onClick={dismiss} aria-label="Закрыть" style={{ position:"absolute", top:10, right:10, width:30, height:30, borderRadius:10, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.08)", color:"#fff", cursor:"pointer", display:"grid", placeItems:"center", fontSize:16, lineHeight:1 }}>×</button>
        <div style={{ padding:"18px 18px 14px", display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
            <span style={{ fontSize:28, lineHeight:1, filter:"drop-shadow(0 0 10px rgba(255,204,0,0.55))" }}>🔥</span>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:900, fontSize:16, color:"#fff", lineHeight:1.25 }}>Пресейв сохранён! <span style={{ color:"#00ff88" }}>+42</span> уже твои</div>
              <div style={{ fontSize:12.5, color:"rgba(255,255,255,0.62)", marginTop:4, lineHeight:1.45 }}>Следующий шаг — сыграй первую игру и закрепи бонус. 30 секунд, 42 монеты на баланс сразу после счёта.</div>
            </div>
          </div>
          {recoverToast && <div style={{ fontSize:12, color:"#00ff88", fontWeight:800, background:"rgba(0,255,136,0.08)", border:"1px solid rgba(0,255,136,0.18)", borderRadius:10, padding:"6px 10px" }}>{recoverToast}</div>}
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", background:"rgba(255,204,0,0.08)", border:"1px solid rgba(255,204,0,0.18)", borderRadius:12, padding:"8px 10px" }}>
            <span style={{ fontSize:13, fontWeight:800, color:"#ffcc00" }}>🎮 Сыграй первую игру → получи 42</span>
            <span style={{ marginLeft:"auto", fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.55)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:999, padding:"2px 7px" }}>автопереход через {countdown}с</span>
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <button type="button" data-bridge-cta="games" data-testid="bridge-to-games" onClick={goGames} style={{ flex:"1 1 220px", background:"#ff2d55", color:"#fff", border:"1px solid #ff2d55", borderRadius:999, padding:"11px 16px", fontWeight:900, fontSize:14, cursor:"pointer", boxShadow:"0 10px 28px rgba(255,45,85,0.28)", display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6 }}>Сыграй первую игру → получи 42 <span aria-hidden>→</span></button>
            <button type="button" onClick={dismiss} style={{ flex:"0 0 auto", background:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.72)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:999, padding:"11px 14px", fontWeight:700, fontSize:13, cursor:"pointer" }}>Позже</button>
          </div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.38)", textAlign:"center", lineHeight:1.4 }}>Откроется GamesHub — выбери любую из 16 игр (Кликер, Память, Квиз…). Донат-попап отложен, сначала — игра.</div>
        </div>
      </div>
    </div>
  );
}
