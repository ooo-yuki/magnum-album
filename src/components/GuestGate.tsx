import { useEffect, useState } from "react";
import { subscribeMe, invalidateMe, type MeUser } from "../lib/authMe";

/** Текущий пользователь. undefined — ещё не знаем, null — гость. */
export function useMe(): MeUser | undefined {
  const [me, setMe] = useState<MeUser | undefined>(undefined);
  useEffect(() => subscribeMe(setMe), []);
  return me;
}

/**
 * Гейт для соревновательных разделов.
 *
 * Публичные рейтинги остаются видимыми — гость их смотрит, но не участвует.
 * Здесь же сама регистрация, чтобы не отправлять человека искать её в шапке.
 */
export function GuestGate({ action = "участвовать" }: { action?: string }) {
  const me = useMe();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creds, setCreds] = useState<{ username: string; password: string } | null>(null);

  if (me === undefined || me) return null;

  async function quickRegister() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const suffix = Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 4);
      const username = `brat-${suffix}`;
      const password = `42-${suffix}-${Date.now().toString(36).slice(-4)}`;
      const r = await fetch("/magnum/api/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; user?: MeUser };
      if (!r.ok) {
        setError(j.error || "не получилось создать аккаунт");
        return;
      }
      // пароль показываем — иначе войти с другого устройства будет нечем
      setCreds({ username, password });
      invalidateMe();
      window.dispatchEvent(new CustomEvent("magnum:auth", { detail: j.user }));
    } catch {
      setError("сеть не отвечает");
    } finally {
      setBusy(false);
    }
  }

  if (creds) {
    return (
      <div
        role="status"
        data-testid="guest-gate-created"
        style={{
          border: "1px solid rgba(0,255,136,0.32)", borderRadius: 14, padding: 14,
          background: "rgba(0,255,136,0.06)", margin: "12px 0", fontSize: 13, lineHeight: 1.55,
        }}
      >
        <div style={{ fontWeight: 900, color: "#00ff88", marginBottom: 6 }}>Аккаунт создан — ты в игре</div>
        <div style={{ color: "rgba(255,255,255,0.72)" }}>
          Запиши, чтобы зайти с другого устройства:{" "}
          <code style={{ background: "rgba(255,255,255,0.08)", padding: "2px 6px", borderRadius: 6 }}>{creds.username}</code>{" "}
          <code style={{ background: "rgba(255,255,255,0.08)", padding: "2px 6px", borderRadius: 6 }}>{creds.password}</code>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="guest-gate"
      style={{
        border: "1px solid rgba(255,204,0,0.28)", borderRadius: 14, padding: 14,
        background: "linear-gradient(180deg, rgba(255,204,0,0.08), rgba(255,45,85,0.05))",
        margin: "12px 0", fontSize: 13, lineHeight: 1.55,
      }}
    >
      <div style={{ fontWeight: 900, color: "#ffcc00", marginBottom: 4 }}>Нужен аккаунт, чтобы {action}</div>
      <div style={{ color: "rgba(255,255,255,0.68)", marginBottom: 10 }}>
        Рейтинг можно смотреть без входа, но результат гостя никуда не сохраняется и в топ не попадает.
        Аккаунт нужен, чтобы за твоими очками стоял ты, а косметика и привилегии были видны остальным.
      </div>
      <button
        type="button"
        onClick={quickRegister}
        disabled={busy}
        data-testid="guest-gate-register"
        style={{
          appearance: "none", border: "1px solid #00ff88", background: "#00ff88", color: "#0a0a0a",
          fontWeight: 900, fontSize: 13, padding: "9px 16px", borderRadius: 999,
          cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? "Создаю…" : "⚡ Создать аккаунт за 1 клик"}
      </button>
      <span style={{ marginLeft: 10, color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
        уже есть — войди в шапке
      </span>
      {error && <div role="alert" style={{ marginTop: 8, color: "#ff6b81", fontSize: 12 }}>{error}</div>}
    </div>
  );
}

export default GuestGate;
