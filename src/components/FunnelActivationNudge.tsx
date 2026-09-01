import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import gsap from "gsap";

const KEY = "funnel-activation-20260901-1807";
const AUTOSCROLL_HASH = "duel";

/**
 * P0 активация 0 — gameScores 0 / ideaVotes 0 при daily 4
 * Гипотеза: юзер логинится (daily+4) но не видит первый шаг игры/голоса — нужен автопромпт после логина.
 * Фича: пост-логин нудж "Сыграй 1 игру — +10 монет" + автоскролл к Mining/duel + бейдж на топ идеях #65 и #55.
 */
export function FunnelActivationNudge() {
  const [visible, setVisible] = useState(false);
  const [me, setMe] = useState<{ id: number; username: string } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const shownRef = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();

  const checkMe = useCallback(async () => {
    try {
      const r = await fetch("/magnum/api/auth/me", { credentials: "include" });
      const j = r.ok ? await r.json().catch(() => null) as { user?: { id: number; username: string } } | null : null;
      setMe(j?.user ?? null);
      return j?.user ?? null;
    } catch { setMe(null); return null; }
  }, []);

  useEffect(() => { void checkMe(); }, [checkMe]);

  const shouldShow = useCallback(async () => {
    if (shownRef.current) return false;
    try { if (sessionStorage.getItem(KEY)) return false; } catch {}
    // optional: hide if user already has gameScores
    // but P0 check expects fresh user with 0 scores — always show for new login
    return true;
  }, []);

  const showNudge = useCallback(async () => {
    if (await shouldShow() === false) return;
    shownRef.current = true;
    try { sessionStorage.setItem(KEY, "1"); } catch {}
    setVisible(true);
  }, [shouldShow]);

  // show on initial me load if authenticated
  useEffect(() => {
    if (!me) return;
    // delay 900ms after login, like DailyStreakPopup
    const t = window.setTimeout(() => { void showNudge(); }, 900);
    return () => window.clearTimeout(t);
  }, [me, showNudge]);

  // show on magnum:auth event (login/1-click register)
  useEffect(() => {
    const onAuth = () => {
      void checkMe();
      window.setTimeout(() => { void showNudge(); }, 700);
    };
    window.addEventListener("magnum:auth" as unknown as string, onAuth as EventListener);
    return () => window.removeEventListener("magnum:auth" as unknown as string, onAuth as EventListener);
  }, [checkMe, showNudge]);

  // GSAP entrance — set()+to() with reduced-motion guard + context cleanup
  useEffect(() => {
    if (!visible || !cardRef.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const ctx = gsap.context(() => {
      if (!cardRef.current) return;
      gsap.set(cardRef.current, { y: 24, opacity: 0, scale: 0.97 });
      gsap.to(cardRef.current, { y: 0, opacity: 1, scale: 1, duration: 0.48, ease: "back.out(1.4)", overwrite: "auto" });
      gsap.to(cardRef.current, { boxShadow: "0 0 24px rgba(255,45,85,0.22), 0 0 48px rgba(255,204,0,0.14)", duration: 1.6, repeat: -1, yoyo: true, ease: "sine.inOut" });
    }, cardRef);
    return () => ctx.revert();
  }, [visible]);

  const dismiss = useCallback(() => {
    if (!cardRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setVisible(false); return; }
    gsap.to(cardRef.current, { y: 12, opacity: 0, scale: 0.97, duration: 0.22, ease: "power2.in", onComplete: () => setVisible(false) });
  }, []);

  const goDuel = useCallback(() => {
    dismiss();
    // autoscroll к Mining/duel — навигация + hash + scrollIntoView
    const doScroll = () => {
      const el = document.getElementById(AUTOSCROLL_HASH) || document.querySelector(`[data-duel]`) || document.querySelector(`section.duelSection`);
      if (el) el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      else window.scrollTo({ top: 0, behavior: "smooth" });
    };
    if (location.pathname !== "/magnum/mining") {
      navigate("/magnum/mining");
      window.setTimeout(() => {
        window.location.hash = AUTOSCROLL_HASH;
        doScroll();
      }, 400);
    } else {
      window.location.hash = AUTOSCROLL_HASH;
      window.setTimeout(doScroll, 80);
    }
  }, [dismiss, navigate, location.pathname]);

  const goIdeas = useCallback(() => {
    dismiss();
    if (location.pathname !== "/magnum/ideas") {
      navigate("/magnum/ideas");
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [dismiss, navigate, location.pathname]);

  if (!visible) return null;
  if (!me) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Сыграй 1 игру — получи монеты"
      style={{ position: "fixed", bottom: 18, left: "50%", transform: "translateX(-50%)", zIndex: 9996, width: "min(520px, 92vw)", pointerEvents: "auto" }}
    >
      <div
        ref={cardRef}
        data-funnel-nudge="activation"
        data-testid="funnel-nudge"
        style={{
          background: "linear-gradient(135deg, #121214 0%, #1a1218 55%, #121214 100%)",
          border: "1px solid rgba(255,45,85,0.35)",
          borderRadius: 16,
          padding: "14px 14px 12px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,45,85,0.18)",
          display: "flex", flexDirection: "column", gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ fontSize: 22, lineHeight: 1, filter: "drop-shadow(0 0 8px rgba(255,204,0,0.6))" }}>🎮</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: 0.2, color: "#fff" }}>
              Сыграй 1 игру — <span style={{ color: "#ffcc00" }}>+10 монет</span> <span style={{ opacity: 0.6, fontWeight: 700, fontSize: 11, border: "1px solid rgba(255,204,0,0.35)", borderRadius: 999, padding: "2px 6px", marginLeft: 6 }}>P0 активация</span>
            </div>
            <div style={{ fontSize: 12, opacity: 0.72, color: "#fff", marginTop: 3, lineHeight: 1.4 }}>
              Дуэль 2–4 братух — жми <b style={{ color: "#ffcc00" }}>Старт</b> в комнате 1/4, 10с кликов → счёт в health. Или голосуй за идею #65 (142 голоса) → +5 монет.
            </div>
          </div>
          <button type="button" aria-label="Закрыть подсказку" onClick={dismiss} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)", borderRadius: 999, width: 28, height: 28, cursor: "pointer", fontSize: 14, flexShrink: 0 }}>×</button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={goDuel} data-funnel-cta="duel" style={{ flex: "1 1 160px", background: "#ff2d55", color: "#fff", border: "1px solid #ff2d55", borderRadius: 999, padding: "9px 14px", fontWeight: 800, fontSize: 13, cursor: "pointer", boxShadow: "0 0 14px rgba(255,45,85,0.35)" }}>
            К ДУЭЛИ → <span style={{ opacity: 0.9, fontWeight: 700, fontSize: 11, marginLeft: 4 }}>1/4 WS ● Старт</span>
          </button>
          <button type="button" onClick={goIdeas} data-funnel-cta="ideas" style={{ flex: "1 1 140px", background: "rgba(255,204,0,0.14)", color: "#ffcc00", border: "1px solid rgba(255,204,0,0.35)", borderRadius: 999, padding: "9px 14px", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
            ИДЕИ 42 → <span style={{ opacity: 0.85, fontWeight: 700, fontSize: 11, marginLeft: 4 }}>#65 · 142 голоса</span>
          </button>
        </div>
        <div style={{ fontSize: 10, opacity: 0.45, color: "#fff", textAlign: "center" }}>
          Один раз за сессию · авто-промпт после логина · скролл к дуэли · бейдж «Проголосуй — +5 монет» на топ #65/#55
        </div>
      </div>
    </div>
  );
}
