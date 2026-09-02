// MAGNUM · единый кошелёк 42 — баланс на сервере /magnum/api/coins
// getCoins → GET /magnum/api/coins, addCoins → POST /magnum/api/coins/add, subscribe polling 2с
export const START_COINS = 1000;
export const MAX_COINS = 9_999_999;
export const MIN_COINS = 0;
export const DAILY_BONUS = 42;
export const STREAK_BONUS = [42, 84, 126, 200, 420] as const;

type Listener = (coins: number) => void;
const listeners = new Set<Listener>();

let cached: number = START_COINS;
let pollTimer: number | null = null;
let inFlight = false;
let lastFetchAt = 0;
let fetchCount = 0;
let errorCount = 0;

function notify(v: number): void {
  cached = v;
  listeners.forEach((cb) => {
    try { cb(v); } catch { /* слушатель упал — не роняем кошелёк */ }
  });
}

async function fetchBalance(): Promise<number> {
  if (inFlight) return cached;
  inFlight = true;
  try {
    const res = await fetch("/magnum/api/coins", { method: "GET", credentials: "include" });
    if (!res.ok) return cached;
    const data = await res.json() as { coins?: number; balance?: number; amount?: number };
    const v = data.coins ?? data.balance ?? data.amount;
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      const nv = Math.round(v);
      if (nv !== cached) notify(nv);
      lastFetchAt = Date.now();
      fetchCount++;
      return nv;
    }
    return cached;
  } catch {
    errorCount++;
    return cached;
  } finally {
    inFlight = false;
  }
}

/** Текущий баланс (кэш, синкронно). Для актуального с сервера — await fetchCoins() */
export function getCoins(): number {
  return cached;
}

/** Актуальный баланс с сервера (GET /magnum/api/coins) */
export async function fetchCoins(): Promise<number> {
  return fetchBalance();
}

/** Начислить/списать монеты через сервер. В минус не уйдёт — сервер клампит в 0. */
export async function addCoins(n: number): Promise<number> {
  const delta = Math.round(n);
  if (!Number.isFinite(delta) || delta === 0) return cached;
  try {
    const res = await fetch("/magnum/api/coins/add", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: delta, delta, coins: delta }),
    });
    if (!res.ok) return cached;
    const data = await res.json() as { coins?: number; balance?: number; newBalance?: number };
    const v = data.coins ?? data.balance ?? data.newBalance;
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      const nv = Math.round(v);
      notify(nv);
      return nv;
    }
    return await fetchBalance();
  } catch {
    return cached;
  }
}

/** Жёстко выставить баланс через сервер (только для админа). */
export async function setCoins(n: number): Promise<number> {
  const target = Math.max(0, Math.round(n));
  const delta = target - cached;
  if (delta === 0) return cached;
  try {
    const res = await fetch("/magnum/api/coins/set", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coins: target, balance: target, amount: target }),
    });
    if (res.ok) {
      const data = await res.json() as { coins?: number; balance?: number };
      const v = data.coins ?? data.balance;
      if (typeof v === "number" && Number.isFinite(v)) {
        const nv = Math.round(v);
        notify(nv);
        return nv;
      }
      return await fetchBalance();
    }
  } catch { /* fallback */ }
  return addCoins(delta);
}

/** Подписка на изменения баланса; сразу дёргает cb кэшем и polling 2с с сервера. */
export function subscribe(cb: Listener): () => void {
  listeners.add(cb);
  try { cb(cached); } catch { /* ignore */ }
  void fetchBalance();
  if (listeners.size === 1) {
    pollTimer = window.setInterval(() => { void fetchBalance(); }, 2000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };
}
