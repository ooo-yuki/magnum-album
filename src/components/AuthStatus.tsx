import { useEffect, useState } from "react";
import styles from "./AuthStatus.module.css";

type Me = { id: number; username: string } | null;

export function AuthStatus() {
  const [me, setMe] = useState<Me>(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<string | null>(null);

  useEffect(() => {
    fetch("/magnum/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setMe(j?.user ?? null))
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
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

  if (loading) return <span className={styles.skeleton}>…</span>;
  if (!me) return <a href="/magnum/ideas" className={styles.login}>Войти</a>;
  const glowClass = tier ? ` ${styles.glow} ${tier === "vip" ? styles.glowVip : tier === "vip+" ? styles.glowVipPlus : styles.glowPro}` : "";
  const title = tier ? `VIP ${tier.toUpperCase()} активен` : undefined;
  return (
    <span className={styles.me + glowClass} title={title}>
      @{me.username} ✓{tier ? ` · ${tier.toUpperCase()}` : ""}
    </span>
  );
}
