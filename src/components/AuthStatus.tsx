import { useEffect, useState } from "react";
import styles from "./AuthStatus.module.css";

type Me = { id: number; username: string } | null;

export function AuthStatus() {
  const [me, setMe] = useState<Me>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/magnum/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setMe(j?.user ?? null))
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <span className={styles.skeleton}>…</span>;
  if (!me) return <a href="/magnum/ideas" className={styles.login}>Войти</a>;
  return <span className={styles.me}>@{me.username} ✓</span>;
}
