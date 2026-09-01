import { useEffect, useState, useRef } from "react";
import gsap from "gsap";
import styles from "./AuthStatus.module.css";

type Me = { id: number; username: string } | null;

export function AuthStatus() {
  const [me, setMe] = useState<Me>(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<null | "login" | "register">(null);
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const modalRef = useRef<HTMLFormElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // GSAP 24/7: entrance y24 stagger 0.08 + reduced-motion gate + context cleanup
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

  // GSAP: modal entrance scale 0.96→1 + overlay fade, hover RGB-neon
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

  // GSAP hover RGB-неон for auth buttons
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

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!me) { setTier(null); return; }
    const ac = new AbortController();
    (async () => {
      try {
        // P0 #1: primary — GET /magnum/api/shop/subscriptions (handleShopSubscriptions) returns {tier, active}
        const r = await fetch("/magnum/api/shop/subscriptions", { credentials: "include", signal: ac.signal });
        if (r.ok) {
          const ct = r.headers.get("content-type") ?? "";
          if (ct.includes("application/json")) {
            let j: unknown = null;
            try { j = await r.json(); } catch { const txt = await r.text().catch(() => ""); try { j = JSON.parse(txt); } catch { j = null; } }
            const obj = j as { tier?: string | null; active?: string | null; subscription?: string | null } | null;
            const t = (obj?.tier ?? obj?.active ?? obj?.subscription) as string | null | undefined;
            if (typeof t === "string" && t) { setTier(t); return; }
            if (t === null) { setTier(null); return; }
          }
        }
        // fallback: derive tier from cosmetic inventory (legacy + P1 reliability)
        const inv = await fetch("/magnum/api/shop/cosmetic/inventory", { credentials: "include", signal: ac.signal });
        if (inv.ok) {
          const ct2 = inv.headers.get("content-type") ?? "";
          if (!ct2.includes("application/json")) { setTier(null); return; }
          const j = await inv.json() as { inventory?: Array<{ cosmeticId?: string; cosmetic_id?: string }>; items?: Array<{ cosmeticId?: string; cosmetic_id?: string }> };
          const arr = (j.inventory ?? j.items ?? []) as Array<{ cosmeticId?: string; cosmetic_id?: string }>;
          if (!Array.isArray(arr)) { setTier(null); return; }
          const ids = new Set(arr.map(x => String(x.cosmeticId ?? x.cosmetic_id ?? "")).filter(Boolean));
          if (ids.has("title-god") || ids.has("frame-crown")) setTier("pro");
          else if ([...ids].some(id => id.startsWith("title-prism-") || id.startsWith("frame-prism-")) && (ids.has("title-vip") || ids.has("frame-void"))) setTier("vip+");
          else if (ids.has("title-vip") || ids.has("title-prism-legend")) setTier("vip");
          else setTier(null);
          return;
        }
        setTier(null);
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
        console.warn("[AuthStatus tier] failed", e);
      }
    })();
    return () => ac.abort();
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
    if (u.length < 3) { setError("логин минимум 3 символа"); return; }
    if (p.length < 3) { setError("пароль минимум 3 символа"); return; }
    setBusy(true);
    try {
      const url = showModal === "register" ? "/magnum/api/auth/register" : "/magnum/api/auth/login";
      const r = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError((j as { error?: string }).error || "ошибка"); return; }
      // close with GSAP exit before unmount
      if (overlayRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        await new Promise<void>((res) => {
          gsap.to(modalRef.current, { scale: 0.96, opacity: 0, duration: 0.18, ease: "power2.in" });
          gsap.to(overlayRef.current, { opacity: 0, duration: 0.18, ease: "power2.in", onComplete: () => res() });
        });
      }
      setShowModal(null);
      setForm({ username: "", password: "" });
      await refresh();
      window.dispatchEvent(new CustomEvent("magnum:auth", { detail: (j as { user?: Me }).user }));
    } catch {
      setError("сеть упала");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await fetch("/magnum/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      setMe(null);
      setTier(null);
    }
  }

  if (loading) return <span className={styles.skeleton}>…</span>;
  if (me) {
    const glowClass = tier ? ` ${styles.glow} ${tier === "vip" ? styles.glowVip : tier === "vip+" ? styles.glowVipPlus : styles.glowPro}` : "";
    const title = tier ? `VIP ${tier.toUpperCase()} активен` : undefined;
    return (
      <span className={styles.meWrap} ref={wrapRef}>
        <span className={styles.me + glowClass} title={title}>@{me.username} ✓{tier ? ` · ${tier.toUpperCase()}` : ""}</span>
        <button type="button" className={styles.logout} onClick={logout} aria-label="Выйти" onMouseEnter={onBtnEnter} onMouseLeave={onBtnLeave}>×</button>
      </span>
    );
  }
  return (
    <>
      <span className={styles.authBtns} ref={wrapRef}>
        <button type="button" className={styles.login} onClick={() => setShowModal("login")} onMouseEnter={onBtnEnter} onMouseLeave={onBtnLeave}>Войти</button>
        <button type="button" className={styles.register} onClick={() => setShowModal("register")} onMouseEnter={onBtnEnter} onMouseLeave={onBtnLeave}>Регистрация</button>
      </span>
      {showModal && (
        <div ref={overlayRef} className={styles.overlay} role="dialog" aria-modal="true" onClick={() => setShowModal(null)}>
          <form ref={modalRef} className={styles.modal} onSubmit={submit} onClick={(ev) => ev.stopPropagation()}>
            <h3 className={styles.modalTitle}>{showModal === "register" ? "Регистрация 42" : "Вход"}</h3>
            <input className={styles.input} placeholder="логин (3-32)" value={form.username} onChange={(ev) => setForm((p) => ({ ...p, username: ev.target.value }))} maxLength={32} autoFocus />
            <input className={styles.input} placeholder="пароль (3+)" type="password" value={form.password} onChange={(ev) => setForm((p) => ({ ...p, password: ev.target.value }))} />
            {error && <span className={styles.error}>{error}</span>}
            <div className={styles.modalActions}>
              <button type="submit" className={styles.submit} disabled={busy} onMouseEnter={onBtnEnter} onMouseLeave={onBtnLeave}>{busy ? "…" : showModal === "register" ? "Создать" : "Войти"}</button>
              <button type="button" className={styles.cancel} onClick={() => setShowModal(null)} onMouseEnter={onBtnEnter} onMouseLeave={onBtnLeave}>Отмена</button>
            </div>
            <span className={styles.hint}>Без логина мультиплеер и магазин закрыты — войди, братуха</span>
          </form>
        </div>
      )}
    </>
  );
}
