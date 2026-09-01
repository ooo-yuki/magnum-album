import { useEffect, useState } from "react";
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
    if (!me) return;
    fetch("/magnum/api/shop/subscriptions", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const t = (j?.active ?? j?.tier) as string | null | undefined;
        if (t && typeof t === "string") setTier(t);
      })
      .catch(() => {});
  }, [me]);

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
      <span className={styles.meWrap}>
        <span className={styles.me + glowClass} title={title}>@{me.username} ✓{tier ? ` · ${tier.toUpperCase()}` : ""}</span>
        <button type="button" className={styles.logout} onClick={logout} aria-label="Выйти">×</button>
      </span>
    );
  }
  return (
    <>
      <span className={styles.authBtns}>
        <button type="button" className={styles.login} onClick={() => setShowModal("login")}>Войти</button>
        <button type="button" className={styles.register} onClick={() => setShowModal("register")}>Регистрация</button>
      </span>
      {showModal && (
        <div className={styles.overlay} role="dialog" aria-modal="true" onClick={() => setShowModal(null)}>
          <form className={styles.modal} onSubmit={submit} onClick={(ev) => ev.stopPropagation()}>
            <h3 className={styles.modalTitle}>{showModal === "register" ? "Регистрация 42" : "Вход"}</h3>
            <input className={styles.input} placeholder="логин (3-32)" value={form.username} onChange={(ev) => setForm((p) => ({ ...p, username: ev.target.value }))} maxLength={32} autoFocus />
            <input className={styles.input} placeholder="пароль (3+)" type="password" value={form.password} onChange={(ev) => setForm((p) => ({ ...p, password: ev.target.value }))} />
            {error && <span className={styles.error}>{error}</span>}
            <div className={styles.modalActions}>
              <button type="submit" className={styles.submit} disabled={busy}>{busy ? "…" : showModal === "register" ? "Создать" : "Войти"}</button>
              <button type="button" className={styles.cancel} onClick={() => setShowModal(null)}>Отмена</button>
            </div>
            <span className={styles.hint}>Без логина мультиплеер и магазин закрыты — войди, братуха</span>
          </form>
        </div>
      )}
    </>
  );
}
