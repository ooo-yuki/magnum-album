import { useEffect, useState, useRef, useCallback } from "react";
import gsap from "gsap";
import styles from "./AuthStatus.module.css";

type Me = { id: number; username: string } | null;
export function AuthStatus() {
  const [me, setMe] = useState<Me>(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<null | "login" | "register">(null);
  const [form, setForm] = useState({ username: "", password: "", bratCode: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [quickBusy, setQuickBusy] = useState(false);
  const [dailyPop, setDailyPop] = useState<null | { streak: number; reward: number; canClaim: boolean }>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const modalRef = useRef<HTMLFormElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      const els = wrapRef.current?.children ? Array.from(wrapRef.current.children) as Element[] : [];
      if (!els.length) return;
      if (reduced) {
        gsap.set(els, { y: 0, opacity: 1, clearProps: "transform" });
        return;
      }
      gsap.set(els, { y: 12, opacity: 0 });
      gsap.to(els, { y: 0, opacity: 1, duration: 0.45, stagger: 0.08, ease: "power3.out", overwrite: "auto" });
    }, wrapRef);
    return () => ctx.revert();
  }, [loading, me]);

  useEffect(() => {
    if (!showModal || !overlayRef.current || !modalRef.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const ctx = gsap.context(() => {
      gsap.set(overlayRef.current, { opacity: 0 });
      gsap.set(modalRef.current, { scale: 0.96, y: 12, opacity: 0 });
      gsap.to(overlayRef.current, { opacity: 1, duration: 0.24, ease: "power2.out" });
      gsap.to(modalRef.current, { scale: 1, y: 0, opacity: 1, duration: 0.38, ease: "back.out(1.6)", delay: 0.08 });
      const inputs = modalRef.current?.querySelectorAll(`.${styles.input}`) ?? [];
      if (inputs.length) {
        gsap.set(inputs, { y: 8, opacity: 0 });
        gsap.to(inputs, { y: 0, opacity: 1, duration: 0.3, stagger: 0.06, ease: "power2.out", delay: 0.18 });
      }
    }, overlayRef);
    return () => ctx.revert();
  }, [showModal]);

  const onBtnEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.to(e.currentTarget, { scale: 1.04, boxShadow: "0 0 14px rgba(255,45,85,0.35), 0 0 28px rgba(255,45,85,0.15)", duration: 0.22, ease: "power2.out", overwrite: "auto" });
  };
  const onBtnLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.to(e.currentTarget, { scale: 1, boxShadow: "0 0 0 rgba(255,45,85,0)", duration: 0.28, ease: "power2.out", overwrite: "auto" });
  };

  async function refresh() {
    try {
      const r = await fetch("/magnum/api/auth/me", { credentials: "include" });
      const j = r.ok ? await r.json() : null;
      setMe(j?.user ?? null);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }

  // P1: simplified tier refetch — one json parse, no content-type guard
  const refreshTier = useCallback(async () => {
    if (!me) { setTier(null); return; }
    try {
      const r = await fetch("/magnum/api/shop/subscriptions", { credentials: "include" });
      const j = r.ok ? await r.json().catch(() => null) as { tier?: string | null; active?: string | null; subscription?: string | null } | null : null;
      const t = (j?.tier ?? j?.active ?? j?.subscription) as string | null | undefined;
      setTier(typeof t === "string" && t ? t : null);
    } catch { setTier(null); }
  }, [me]);

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!me) { setTier(null); return; }
    void refreshTier();
    const onTierRefresh = () => { void refreshTier(); };
    const onCosmeticBought = () => { void refreshTier(); };
    window.addEventListener("magnum:tier-refresh" as unknown as string, onTierRefresh as EventListener);
    window.addEventListener("magnum:cosmetic-bought" as unknown as string, onCosmeticBought as EventListener);
    return () => {
      window.removeEventListener("magnum:tier-refresh" as unknown as string, onTierRefresh as EventListener);
      window.removeEventListener("magnum:cosmetic-bought" as unknown as string, onCosmeticBought as EventListener);
    };
  }, [me, refreshTier]);

  // daily streak popup on entry — after auth, check canClaim and show once per session
  const dailyShownRef = useRef(false);
  useEffect(() => {
    if (!me || dailyShownRef.current) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/magnum/api/daily/status", { credentials: "include" });
        if (!r.ok || cancelled) return;
        const j = await r.json() as { canClaim?: boolean; streak?: number; nextReward?: number; waitMs?: number };
        if (j.canClaim) {
          dailyShownRef.current = true;
          window.setTimeout(() => {
            if (!cancelled) setDailyPop({ streak: j.streak ?? 0, reward: j.nextReward ?? 42, canClaim: true });
          }, 900);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [me]);

  // P1 #4: магнум:need-auth → открыть модалку логина (ShopPage/MiningPage диспатчат при 401)
  useEffect(() => {
    const onNeedAuth = () => setShowModal((prev) => prev ?? "login");
    window.addEventListener("magnum:need-auth" as unknown as string, onNeedAuth as EventListener);
    return () => window.removeEventListener("magnum:need-auth" as unknown as string, onNeedAuth as EventListener);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const u = form.username.trim();
    const p = form.password;
    // правила совпадают с сервером (handleRegister): 3-32 [a-z0-9_-], пароль от 8 символов
    const ul = u.toLowerCase();
    if (!/^[a-z0-9_-]{3,32}$/.test(ul) || ul.startsWith("-") || ul.endsWith("-") || ul.includes("--")) {
      setError("логин: 3–32 символа, a-z, 0-9, _ и - (дефис не в начале/конце)"); return;
    }
    if (p.length < 8) { setError("пароль минимум 8 символов"); return; }
    setBusy(true);
    try {
      const url = showModal === "register" ? "/magnum/api/auth/register" : "/magnum/api/auth/login";
      const payload: Record<string,string> = { username: u, password: p };
      if (showModal === "register" && form.bratCode.trim()) payload.referralCode = form.bratCode.trim().toUpperCase();
      const r = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError((j as { error?: string }).error || "ошибка"); return; }
      if (overlayRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        await new Promise<void>((res) => {
          gsap.to(modalRef.current, { scale: 0.96, opacity: 0, duration: 0.18, ease: "power2.in" });
          gsap.to(overlayRef.current, { opacity: 0, duration: 0.18, ease: "power2.in", onComplete: () => res() });
        });
      }
      setShowModal(null);
      setForm({ username: "", password: "", bratCode: "" });
      await refresh();
      window.dispatchEvent(new CustomEvent("magnum:auth", { detail: (j as { user?: Me }).user }));
    } catch {
      setError("сеть упала");
    } finally {
      setBusy(false);
    }
  }

  // P1 funnel: 1-click registration — generates random brat-xxxx + 42 password
  async function quickRegister() {
    if (quickBusy || busy) return;
    setQuickBusy(true); setError(null);
    try {
      const suffix = Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 4);
      const username = `brat-${suffix}`;
      const password = `42-${suffix}-${Date.now().toString(36).slice(-4)}`;
      const r = await fetch("/magnum/api/auth/register", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const j = await r.json().catch(() => ({})) as { error?: string; user?: Me };
      if (!r.ok) { setError(j.error || "ошибка 1-клик"); setShowModal("register"); return; }
      await refresh();
      window.dispatchEvent(new CustomEvent("magnum:auth", { detail: j.user }));
      setShowModal(null);
    } catch { setError("сеть упала"); setShowModal("register"); }
    finally { setQuickBusy(false); }
  }

  async function dailyClaim() {
    try {
      const r = await fetch("/magnum/api/daily/claim", { method: "POST", credentials: "include" });
      const j = await r.json().catch(() => ({})) as { ok?: boolean; reward?: number; streak?: number; error?: string };
      if (r.ok && j.ok) setDailyPop(null);
      else setDailyPop(null);
    } catch { setDailyPop(null); }
  }

  async function logout() {
    try {
      await fetch("/magnum/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      setMe(null);
      setTier(null);
      dailyShownRef.current = false;
    }
  }

  if (loading) return <span className={styles.skeleton}>…</span>;
  if (me) {
    const glowClass = tier ? ` ${styles.glow} ${tier === "vip" ? styles.glowVip : tier === "vip+" ? styles.glowVipPlus : styles.glowPro}` : "";
    const title = tier ? `VIP ${tier.toUpperCase()} активен` : undefined;
    return (
      <>
        <span className={styles.meWrap} ref={wrapRef}>
          <span className={styles.me + glowClass} title={title} style={tier ? { boxShadow: tier==="vip" ? "0 0 28px rgba(255,204,0,0.5)" : undefined } : undefined}>@{me.username} ✓{tier ? ` · ${tier.toUpperCase()}` : ""}</span>
          <button type="button" className={styles.logout} onClick={logout} aria-label="Выйти" onMouseEnter={onBtnEnter} onMouseLeave={onBtnLeave}>×</button>
        </span>
        {dailyPop?.canClaim && (
          <div role="dialog" aria-modal="true" onClick={() => setDailyPop(null)} style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.58)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ width: "min(360px,92vw)", background: "#121214", border: "1px solid #23232b", borderRadius: 16, padding: 18, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,.6)" }}>
              <div style={{ fontSize: 28 }}>🔥</div>
              <h3 style={{ margin: "6px 0 4px", fontWeight: 900, fontSize: 16 }}>Дейли стрик x{dailyPop.streak + 1} — +{dailyPop.reward} монет</h3>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.72 }}>Заходи каждый день — стрик до 7, бонус 42→294. Не пропусти в /magnum/eco!</p>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button type="button" onClick={dailyClaim} style={{ flex: 1, background: "#ff2d55", color: "#fff", border: "1px solid #ff2d55", borderRadius: 10, padding: "9px 10px", fontWeight: 800, cursor: "pointer" }}>Забрать +{dailyPop.reward}</button>
                <button type="button" onClick={() => setDailyPop(null)} style={{ flex: 1, background: "transparent", color: "#9aa4b2", border: "1px solid #23232b", borderRadius: 10, padding: "9px 10px", cursor: "pointer" }}>Позже</button>
              </div>
              <a href="/magnum/eco" onClick={() => setDailyPop(null)} style={{ display: "block", marginTop: 10, fontSize: 12, color: "#78dcff", textDecoration: "none" }}>→ Эко-рейтинг и стрик 7дн</a>
            </div>
          </div>
        )}
      </>
    );
  }
  return (
    <>
      <span className={styles.authBtns} ref={wrapRef}>
        <button type="button" className={styles.login} onClick={() => setShowModal("login")} onMouseEnter={onBtnEnter} onMouseLeave={onBtnLeave}>Войти</button>
        <button type="button" className={styles.register} onClick={() => setShowModal("register")} onMouseEnter={onBtnEnter} onMouseLeave={onBtnLeave}>Регистрация</button>
        <button type="button" onClick={quickRegister} disabled={quickBusy} aria-label="Регистрация в 1 клик" onMouseEnter={onBtnEnter} onMouseLeave={onBtnLeave} style={{ marginLeft: 6, fontSize: ".78rem", fontWeight: 900, color: "#0a0a0a", background: "#00ff88", border: "1px solid #00ff88", padding: ".32rem .62rem", borderRadius: 999, cursor: quickBusy ? "wait" : "pointer", opacity: quickBusy ? 0.7 : 1 }}>⚡ 1 клик</button>
      </span>
      {showModal && (
        <div ref={overlayRef} className={styles.overlay} role="dialog" aria-modal="true" onClick={() => setShowModal(null)}>
          <form ref={modalRef} className={styles.modal} onSubmit={submit} onClick={(ev) => ev.stopPropagation()}>
            <h3 className={styles.modalTitle}>{showModal === "register" ? "Регистрация 42" : "Вход"}</h3>
            <input className={styles.input} placeholder="логин (3-32, a-z 0-9 _ -)" value={form.username} onChange={(ev) => setForm((p) => ({ ...p, username: ev.target.value }))} maxLength={32} autoFocus />
            <input className={styles.input} placeholder="пароль (8+)" type="password" minLength={8} value={form.password} onChange={(ev) => setForm((p) => ({ ...p, password: ev.target.value }))} />
            {showModal === "register" && <input className={styles.input} placeholder="БРАТУХА-КОД 42-XXXX (опц.)" value={form.bratCode} onChange={ev=>setForm(p=>({...p, bratCode: ev.target.value}))} maxLength={7} style={{ textTransform:"uppercase" }} />}
            {error && <span className={styles.error}>{error}</span>}
            <div className={styles.modalActions}>
              <button type="submit" className={styles.submit} disabled={busy} onMouseEnter={onBtnEnter} onMouseLeave={onBtnLeave}>{busy ? "…" : showModal === "register" ? "Создать" : "Войти"}</button>
              <button type="button" className={styles.cancel} onClick={() => setShowModal(null)} onMouseEnter={onBtnEnter} onMouseLeave={onBtnLeave}>Отмена</button>
            </div>
            <button type="button" onClick={quickRegister} disabled={quickBusy} style={{ width: "100%", marginTop: 10, background: "#00ff88", color: "#0a0a0a", border: "1px solid #00ff88", borderRadius: 10, padding: ".5rem .8rem", fontWeight: 900, cursor: "pointer", fontSize: ".84rem" }}>{quickBusy ? "…" : "⚡ Создать за 1 клик (авто-логин)"}</button>
            <span className={styles.hint}>Без логина мультиплеер и магазин закрыты — войди, братуха. 1 клик = авто brat-xxxx + daily +42</span>
          </form>
        </div>
      )}
    </>
  );
}
