// MAGNUM · единый кошелёк 42 — один баланс для игр и магазина.
// Ключ: magnum-coins. Миграция: если ключа нет — max(blackjack42-balance, roulette42-balance) или 1000.

const COINS_KEY = "magnum-coins";
const BJ_KEY = "blackjack42-balance";
const RL_KEY = "roulette42-balance";
export const START_COINS = 1000;

type Listener = (coins: number) => void;
const listeners = new Set<Listener>();

let cached: number | null = null;

function lsGet(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null; // SSR / приватный режим
  }
}

function lsSet(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* приватный режим — живём в памяти */
  }
}

function readCoins(): number {
  if (cached !== null) return cached;
  let v = lsGet(COINS_KEY);
  if (v === null) {
    // миграция со старых балансов игр: берём самый жирный
    const bj = lsGet(BJ_KEY);
    const rl = lsGet(RL_KEY);
    v = Math.max(bj ?? 0, rl ?? 0, START_COINS);
    lsSet(COINS_KEY, v);
  }
  cached = v;
  return v;
}

function commit(value: number): number {
  const v = Math.max(0, Math.round(value));
  cached = v;
  lsSet(COINS_KEY, v);
  listeners.forEach((cb) => {
    try {
      cb(v);
    } catch {
      /* слушатель упал — не роняем кошелёк */
    }
  });
  return v;
}

/** Текущий баланс (localStorage → миграция → память). */
export function getCoins(): number {
  return readCoins();
}

/** Начислить/списать монеты. В минус не уйдёт — кламп в 0. Возвращает новый баланс. */
export function addCoins(n: number): number {
  return commit(readCoins() + n);
}

/** Жёстко выставить баланс. */
export function setCoins(n: number): number {
  return commit(n);
}

/** Подписка на изменения баланса; сразу дёргает cb текущим значением. Возвращает отписку. */
export function subscribe(cb: Listener): () => void {
  listeners.add(cb);
  cb(readCoins());
  return () => {
    listeners.delete(cb);
  };
}

/** Синхронизация между вкладками (storage event). */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === COINS_KEY) {
      try {
        const n = Number(e.newValue);
        if (Number.isFinite(n) && n >= 0) {
          const v = Math.round(n);
          cached = v;
          listeners.forEach((cb) => cb(v));
        }
      } catch {
        /* ignore */
      }
    }
  });
}
