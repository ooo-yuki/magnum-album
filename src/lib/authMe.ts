/**
 * Единый источник правды по авторизации — /magnum/api/auth/me.
 *
 * До этого 11 компонентов independently дёргали ручку, и каждый ещё и
 * перезапрашивал её по событию magnum:auth. Один заход на /magnum/mining давал
 * 12 запросов auth/me, часть висла, fetch падал с "Failed to fetch" — и страница
 * показывала гейт «Войди, братуха» залогиненному юзеру.
 *
 * Здесь: кэш + дедуп параллельных вызовов (все получают один и тот же промис).
 * Важно — 401 и сетевая ошибка различаются: 401 это «точно гость», а сбой сети
 * бросает исключение, чтобы UI не разлогинивал юзера на ровном месте.
 */

export type MeUser = { id: number; username: string } | null;

let cached: { user: MeUser } | null = null;
let inflight: Promise<MeUser> | null = null;

/** Кэшированный me. Параллельные вызовы разделяют один запрос. Бросает при сбое сети. */
export function fetchMe(force = false): Promise<MeUser> {
  if (!force && cached) return Promise.resolve(cached.user);
  if (inflight) return inflight;
  inflight = (async () => {
    const r = await fetch("/magnum/api/auth/me", { credentials: "include" });
    if (r.status === 401) {
      cached = { user: null };
      return null;
    }
    if (!r.ok) throw new Error(`auth/me ${r.status}`);
    const j = (await r.json()) as { user?: MeUser } | null;
    const user = j?.user ?? null;
    cached = { user };
    return user;
  })();
  const p = inflight;
  p.catch(() => {}).then(() => {
    if (inflight === p) inflight = null;
  });
  return p;
}

/** Сбросить кэш — после login/logout/register. */
export function invalidateMe(): void {
  cached = null;
  inflight = null;
}

/** Последний известный me без запроса: undefined — ещё не знаем. */
export function peekMe(): MeUser | undefined {
  return cached ? cached.user : undefined;
}

/**
 * Подписка на авторизацию. Отдаёт текущего me и обновляет по magnum:auth.
 * onChange(undefined) не вызывается — при сбое сети прошлое состояние сохраняется,
 * чтобы не мигал гейт логина.
 */
export function subscribeMe(onChange: (u: MeUser) => void): () => void {
  let cancelled = false;
  const load = (force: boolean) => {
    fetchMe(force)
      .then((u) => {
        if (!cancelled) onChange(u);
      })
      .catch(() => {
        /* сеть моргнула — оставляем предыдущее состояние, не разлогиниваем */
      });
  };
  load(false);
  // ВАЖНО: тут нельзя звать invalidateMe() — он сбрасывает inflight, и тогда
  // N подписчиков дадут N запросов вместо одного. fetchMe(true) и так минует
  // кэш, но переиспользует общий inflight — на всех выходит один запрос.
  const onAuth = () => load(true);
  window.addEventListener("magnum:auth" as unknown as string, onAuth as EventListener);
  return () => {
    cancelled = true;
    window.removeEventListener("magnum:auth" as unknown as string, onAuth as EventListener);
  };
}
