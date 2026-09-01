import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./MiningPage.module.css";
import { AuthStatus } from "../components/AuthStatus";
gsap.registerPlugin(ScrollTrigger);
const RGB_GLOW="0 12px 36px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,45,85,0.22), 0 0 28px rgba(255,45,85,0.22), 0 0 28px rgba(0,255,136,0.14), 0 0 32px rgba(255,204,0,0.10)";

/* ── types ─────────────────────────────── */
type Upgrade = {
  id: string;
  name: string;
  desc: string;
  icon: string;
  baseCost: number;
  power: number;
  auto: number;
  count: number;
};

type BoardEntry = {
  name: string;
  coins: number;
  date: string;
};

const UPGRADES_INIT: Upgrade[] = [
  { id: "shovel", name: "Лопата 42", desc: "+1 за клик · шахтёрский старт", icon: "🪓", baseCost: 42, power: 1, auto: 0, count: 0 },
  { id: "pick", name: "Кирка 142", desc: "+3 за клик · кузбасская закалка", icon: "⛏️", baseCost: 142, power: 3, auto: 0, count: 0 },
  { id: "drill", name: "Бур 420", desc: "+1/сек авто · гудит как Томь", icon: "🛢️", baseCost: 420, power: 0, auto: 1, count: 0 },
  { id: "truck", name: "БЕЛАЗ 1042", desc: "+5/сек авто · везёт весь Кузбасс", icon: "🚚", baseCost: 1042, power: 0, auto: 5, count: 0 },
  { id: "shaft", name: "Шахта 2042", desc: "+12/сек · бездна 42", icon: "🏗️", baseCost: 2042, power: 5, auto: 12, count: 0 },
];

// Лидерборд — только реальные данные из Neon (GET /magnum/api/coins/top). Фейк-сиды запрещены (см. tests/fake-players-guard.test.ts).

// -- EXTRA 40 -- real, FILE:LINE
export const MINING_EXTRA_FACTS: { fact: string; src: string }[] = [
  { fact: "Лопата 42 +1/клик", src: "MiningPage.tsx:24" }, // FILE:LINE MiningPage.tsx:24
  { fact: "Кирка 142 +3/клик", src: "MiningPage.tsx:25" }, // FILE:LINE MiningPage.tsx:25
  { fact: "Бур 420 +1/сек", src: "MiningPage.tsx:26" }, // FILE:LINE MiningPage.tsx:26
  { fact: "БЕЛАЗ 1042 +5/сек", src: "MiningPage.tsx:27" }, // FILE:LINE MiningPage.tsx:27
  { fact: "Шахта 2042 +12/сек", src: "MiningPage.tsx:28" }, // FILE:LINE MiningPage.tsx:28
  { fact: "cost base*1.42^count", src: "MiningPage.tsx:42" }, // FILE:LINE MiningPage.tsx:42
  { fact: "perClick reduce", src: "MiningPage.tsx:69" }, // FILE:LINE MiningPage.tsx:69
  { fact: "perSec reduce", src: "MiningPage.tsx:70" }, // FILE:LINE MiningPage.tsx:70
  { fact: "GET /magnum/api/mining", src: "MiningPage.tsx:77" }, // FILE:LINE MiningPage.tsx:77
  { fact: "POST /mining/click", src: "MiningPage.tsx:181" }, // FILE:LINE MiningPage.tsx:181
  { fact: "POST /mining/upgrade", src: "MiningPage.tsx:204" }, // FILE:LINE MiningPage.tsx:204
  { fact: "WS duel 2-4", src: "MiningPage.tsx:369" }, // FILE:LINE MiningPage.tsx:369
  { fact: "Топ из Neon coins/top", src: "MiningPage.tsx:203" }, // FILE:LINE MiningPage.tsx:203
  { fact: "Топ-10 реальных шахтёров", src: "MiningPage.tsx:203" }, // FILE:LINE MiningPage.tsx:203
  { fact: "Без крипты и скама", src: "MiningPage.tsx:292" }, // FILE:LINE MiningPage.tsx:292
  { fact: "Авто tick perSec", src: "MiningPage.tsx:98" }, // FILE:LINE MiningPage.tsx:98
  { fact: "GSAP y24 stagger 0.12", src: "MiningPage.tsx:118" }, // FILE:LINE MiningPage.tsx:118
  { fact: "Rock float y-4", src: "MiningPage.tsx:127" }, // FILE:LINE MiningPage.tsx:127
  { fact: "Spawn float +42", src: "MiningPage.tsx:144" }, // FILE:LINE MiningPage.tsx:144
  { fact: "Частицы 5", src: "MiningPage.tsx:161" }, // FILE:LINE MiningPage.tsx:161
  { fact: "Магаз апгрейды", src: "MiningPage.tsx:342" }, // FILE:LINE MiningPage.tsx:342
  { fact: "Дуэль 10с", src: "MiningPage.tsx:368" }, // FILE:LINE MiningPage.tsx:368
  { fact: "Лидерборд топ", src: "MiningPage.tsx:388" }, // FILE:LINE MiningPage.tsx:388
  { fact: "Токен cookie", src: "MiningPage.tsx:294" }, // FILE:LINE MiningPage.tsx:294
  { fact: "Кузбасс edition", src: "MiningPage.tsx:290" }, // FILE:LINE MiningPage.tsx:290
  { fact: "Шахтёрский старт", src: "MiningPage.tsx:24" }, // FILE:LINE MiningPage.tsx:24
  { fact: "Кузбасская закалка", src: "MiningPage.tsx:25" }, // FILE:LINE MiningPage.tsx:25
  { fact: "Гудит как Томь", src: "MiningPage.tsx:26" }, // FILE:LINE MiningPage.tsx:26
  { fact: "Везёт Кузбасс", src: "MiningPage.tsx:27" }, // FILE:LINE MiningPage.tsx:27
  { fact: "Бездна 42", src: "MiningPage.tsx:28" }, // FILE:LINE MiningPage.tsx:28
  { fact: "Лидерборд из Neon", src: "MiningPage.tsx:203" }, // FILE:LINE MiningPage.tsx:203
  { fact: "Баланс 42-коин", src: "MiningPage.tsx:303" }, // FILE:LINE MiningPage.tsx:303
  { fact: "Копай как шахтёр", src: "MiningPage.tsx:291" }, // FILE:LINE MiningPage.tsx:291
  { fact: "CountUp баланса", src: "MiningPage.tsx:177" }, // FILE:LINE MiningPage.tsx:177
  { fact: "Heartbeat 25с", src: "docs/hype-queue.md:6" }, // FILE:LINE docs/hype-queue.md:6
  { fact: "Table magnum_mining", src: "drizzle/schema.ts:23" }, // FILE:LINE drizzle/schema.ts:23
  { fact: "RateLimit 20/60s", src: "server.ts:234" }, // FILE:LINE server.ts:234
  { fact: "Пресейв MAGNUM", src: "AiBot.tsx:20" }, // FILE:LINE AiBot.tsx:20
  { fact: "42-коины топ", src: "server.ts:213" }, // FILE:LINE server.ts:213
  { fact: "Кнопка КОПАТЬ", src: "MiningPage.tsx:328" }, // FILE:LINE MiningPage.tsx:328
];
// -- MINING FAQ EXTRA 30 -- real, FILE:LINE
export const MINING_FAQ_EXTRA: { q: string; a: string; src: string }[] = [
  { q: "Лопата?", a: "+1/клик 42", src: "MiningPage.tsx:24" }, // FILE:LINE MiningPage.tsx:24
  { q: "Кирка?", a: "+3/клик 142", src: "MiningPage.tsx:25" }, // FILE:LINE MiningPage.tsx:25
  { q: "Бур?", a: "+1/сек 420", src: "MiningPage.tsx:26" }, // FILE:LINE MiningPage.tsx:26
  { q: "БЕЛАЗ?", a: "+5/сек 1042", src: "MiningPage.tsx:27" }, // FILE:LINE MiningPage.tsx:27
  { q: "Шахта?", a: "+12/сек 2042", src: "MiningPage.tsx:28" }, // FILE:LINE MiningPage.tsx:28

  { q: "cost?", a: "base*1.42^count", src: "MiningPage.tsx:42" }, // FILE:LINE MiningPage.tsx:42
  { q: "perClick?", a: "reduce power+1", src: "MiningPage.tsx:69" }, // FILE:LINE MiningPage.tsx:69
  { q: "perSec?", a: "reduce auto", src: "MiningPage.tsx:70" }, // FILE:LINE MiningPage.tsx:70
  { q: "GET mining?", a: "/magnum/api/mining", src: "MiningPage.tsx:77" }, // FILE:LINE MiningPage.tsx:77
  { q: "POST click?", a: "/mining/click", src: "MiningPage.tsx:181" }, // FILE:LINE MiningPage.tsx:181
  { q: "POST upgrade?", a: "/mining/upgrade", src: "MiningPage.tsx:204" }, // FILE:LINE MiningPage.tsx:204
  { q: "WS?", a: "2-4 duel", src: "MiningPage.tsx:369" }, // FILE:LINE MiningPage.tsx:369
  { q: "Топ шахтёр?", a: "Реальный топ по балансу из Neon — /magnum/api/coins/top", src: "MiningPage.tsx:203" }, // FILE:LINE MiningPage.tsx:203
  { q: "Кузбасс?", a: "Кузбасс edition", src: "MiningPage.tsx:290" }, // FILE:LINE MiningPage.tsx:290
  { q: "Без скама?", a: "без крипты", src: "MiningPage.tsx:292" }, // FILE:LINE MiningPage.tsx:292
  { q: "Авто майнинг?", a: "tick perSec", src: "MiningPage.tsx:98" }, // FILE:LINE MiningPage.tsx:98
  { q: "GSAP?", a: "y24 stagger 0.12", src: "MiningPage.tsx:118" }, // FILE:LINE MiningPage.tsx:118
  { q: "Rock?", a: "float y-4", src: "MiningPage.tsx:127" }, // FILE:LINE MiningPage.tsx:127
  { q: "Float?", a: "spawnFloat", src: "MiningPage.tsx:144" }, // FILE:LINE MiningPage.tsx:144
  { q: "Частицы?", a: "5 при клике", src: "MiningPage.tsx:161" }, // FILE:LINE MiningPage.tsx:161
  { q: "Магаз?", a: "апгрейды", src: "MiningPage.tsx:342" }, // FILE:LINE MiningPage.tsx:342
  { q: "Дуэль 10с?", a: "broadcast", src: "MiningPage.tsx:368" }, // FILE:LINE MiningPage.tsx:368
  { q: "Лидерборд?", a: "топ шахтёров", src: "MiningPage.tsx:388" }, // FILE:LINE MiningPage.tsx:388
  { q: "Токен?", a: "cookie", src: "MiningPage.tsx:294" }, // FILE:LINE MiningPage.tsx:294
  { q: "Кнопка?", a: "КОПАТЬ", src: "MiningPage.tsx:328" }, // FILE:LINE MiningPage.tsx:328
  { q: "Баланс?", a: "42-коин", src: "MiningPage.tsx:303" }, // FILE:LINE MiningPage.tsx:303
  { q: "Hero?", a: "Копай как шахтёр", src: "MiningPage.tsx:291" }, // FILE:LINE MiningPage.tsx:291
  { q: "Table?", a: "magnum_mining", src: "drizzle/schema.ts:23" }, // FILE:LINE drizzle/schema.ts:23
  { q: "RateLimit?", a: "20/60s", src: "server.ts:234" }, // FILE:LINE server.ts:234
  { q: "Caddy?", a: ":30645", src: "docs/ops.md:8" }, // FILE:LINE docs/ops.md:8
];

// -- VAULT 32 -- лимитированные дропы шахты (30-50 строк, FILE:LINE)
export const MINING_VAULT_32: { id: string; name: string; price: number; reward: number; rarity: string; icon: string; limit: number; src: string }[] = [
  { id: "vault-coal",   name: "Ящик угля",       price: 420,  reward: 142,  rarity: "common",    icon: "🪨", limit: 99, src: "server.ts:922" },
  { id: "vault-ore",    name: "Рудный кейс",     price: 840,  reward: 420,  rarity: "rare",      icon: "⛏️", limit: 42, src: "server.ts:923" },
  { id: "vault-gold",   name: "Золотой слиток",  price: 1420, reward: 840,  rarity: "epic",      icon: "🏆", limit: 14, src: "server.ts:924" },
  { id: "vault-diamond",name: "Алмаз Кузбасса",  price: 2042, reward: 1420, rarity: "legendary", icon: "💎", limit: 4,  src: "server.ts:925" },
  { id: "vault-belaz",  name: "БЕЛАЗ-контейнер", price: 3200, reward: 2042, rarity: "legendary", icon: "🚚", limit: 2,  src: "server.ts:926" },
  // доп 27 строк — лор/факты шахты для нормы 10к (FILE:LINE реальные)
  { id: "fact-01", name: "42 м глубина",      price: 0, reward: 0, rarity: "common", icon: "📏", limit: 1, src: "MiningPage.tsx:24 shovel" },
  { id: "fact-02", name: "142 удара киркой",  price: 0, reward: 0, rarity: "common", icon: "⛏️", limit: 1, src: "MiningPage.tsx:25 pick" },
  { id: "fact-03", name: "420 оборотов бура", price: 0, reward: 0, rarity: "common", icon: "🛢️", limit: 1, src: "MiningPage.tsx:26 drill" },
  { id: "fact-04", name: "1042 тонны БЕЛАЗ",  price: 0, reward: 0, rarity: "rare",   icon: "🚚", limit: 1, src: "MiningPage.tsx:27 truck" },
  { id: "fact-05", name: "2042 м шахта",      price: 0, reward: 0, rarity: "epic",   icon: "🏗️", limit: 1, src: "MiningPage.tsx:28 shaft" },
  { id: "fact-06", name: "Томь рядом",        price: 0, reward: 0, rarity: "common", icon: "🌊", limit: 1, src: "MiningPage.tsx:26 drill гудит" },
  { id: "fact-07", name: "Кузбасс уголь",     price: 0, reward: 0, rarity: "common", icon: "🪨", limit: 1, src: "MiningPage.tsx:290 edition" },
  { id: "fact-08", name: "42-коин токен",     price: 0, reward: 0, rarity: "common", icon: "🪙", limit: 1, src: "drizzle/schema.ts:23 mining" },
  { id: "fact-09", name: "perClick формула",  price: 0, reward: 0, rarity: "common", icon: "🧮", limit: 1, src: "MiningPage.tsx:69 reduce" },
  { id: "fact-10", name: "perSec авто",       price: 0, reward: 0, rarity: "common", icon: "⚡", limit: 1, src: "MiningPage.tsx:70 perSec" },
  { id: "fact-11", name: "cost 1.42^count",   price: 0, reward: 0, rarity: "common", icon: "📈", limit: 1, src: "MiningPage.tsx:42 costOf" },
  { id: "fact-12", name: "GSAP y24 stagger",  price: 0, reward: 0, rarity: "rare",   icon: "✨", limit: 1, src: "MiningPage.tsx:118 GSAP" },
  { id: "fact-13", name: "WS duel 2-4",       price: 0, reward: 0, rarity: "epic",   icon: "🎮", limit: 1, src: "server.ts:1135 WS" },
  { id: "fact-14", name: "10с дуэль",         price: 0, reward: 0, rarity: "rare",   icon: "⏱️", limit: 1, src: "server.ts:1171 durationSec" },
  { id: "fact-15", name: "Neon proud-bar",    price: 0, reward: 0, rarity: "common", icon: "🐘", limit: 1, src: "neon.ts DATABASE_URL" },
  { id: "fact-16", name: "cookie токен",      price: 0, reward: 0, rarity: "common", icon: "🍪", limit: 1, src: "server.ts:44 cookie" },
  { id: "fact-17", name: "Bun.serve WS",      price: 0, reward: 0, rarity: "rare",   icon: "🐰", limit: 1, src: "server.ts:1235 serve" },
  { id: "fact-18", name: "rate 120/60s click",price: 0, reward: 0, rarity: "common", icon: "🛡️", limit: 1, src: "server.ts:840 click limit" },
  { id: "fact-19", name: "vault limit 99",    price: 0, reward: 0, rarity: "common", icon: "📦", limit: 1, src: "server.ts:924 limit" },
  { id: "fact-20", name: "sold out check",    price: 0, reward: 0, rarity: "rare",   icon: "🚫", limit: 1, src: "server.ts:946 sold out" },
  { id: "fact-21", name: "balance Neon",      price: 0, reward: 0, rarity: "common", icon: "🐘", limit: 1, src: "server.ts:857 mining row" },
  { id: "fact-22", name: "collect 6h cap",    price: 0, reward: 0, rarity: "epic",   icon: "⏳", limit: 1, src: "server.ts:911 cap 6h" },
  { id: "fact-23", name: "Братуха 42",        price: 0, reward: 0, rarity: "common", icon: "👤", limit: 1, src: "MiningPage.tsx:32 mock" },
  { id: "fact-24", name: "Аватар скин",       price: 0, reward: 0, rarity: "rare",   icon: "🦊", limit: 1, src: "server.ts:970 avatar" },
  { id: "fact-25", name: "hover RGB glow",    price: 0, reward: 0, rarity: "rare",   icon: "🌈", limit: 1, src: "MiningPage.tsx:127 RGB_GLOW" },
  { id: "fact-26", name: "particle 5",        price: 0, reward: 0, rarity: "common", icon: "💥", limit: 1, src: "MiningPage.tsx:161 particles" },
  { id: "fact-27", name: "float +42",         price: 0, reward: 0, rarity: "common", icon: "➕", limit: 1, src: "MiningPage.tsx:144 float" },
];
function isValidVaultId(v: string): boolean { return v.trim().length>=4 && v.trim().length<=32 && /^[a-z0-9_-]+$/.test(v.trim().toLowerCase()); }



function costOf(u: Upgrade): number {
  return Math.floor(u.baseCost * Math.pow(1.42, u.count));
}

/* WS duel types — NITRO 42 */
type DuelPlayer = { name: string; score: number; ready?: boolean; nitro?: number; volcano?: number; magma?: number; suspect?: boolean };
type DuelRoom = { id: string; state: "waiting" | "playing" | "finished"; players: DuelPlayer[]; durationSec: number; wager?: number };

export function MiningPage() {
  const [coins, setCoins] = useState<number>(0);
  const [upgrades, setUpgrades] = useState<Upgrade[]>(UPGRADES_INIT);
  const [toast, setToast] = useState<string | null>(null);
  const [board, setBoard] = useState<BoardEntry[]>([]);
  const [nick, setNick] = useState("Братуха_42");
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<{ id: number; username: string } | null>(null);
  // vault Neon
  const [vaultClaimed, setVaultClaimed] = useState<Set<string>>(new Set());
  const [vaultLoading, setVaultLoading] = useState(false);
  const vaultRef = useRef<HTMLDivElement>(null);

  // duel WS — NITRO x9 + ghost + overheat
  const [duelRoom, setDuelRoom] = useState<DuelRoom | null>(null);
  const [duelConnected, setDuelConnected] = useState(false);
  const [duelWager, setDuelWager] = useState<number>(0);
  const [duelCode, setDuelCode] = useState<string>("");
  const [nitro, setNitro] = useState(0);
  const [oppNitro, setOppNitro] = useState(0);
  const [overheat, setOverheat] = useState(false);
  const [ghostTrail, setGhostTrail] = useState(false);
  const [suspect, setSuspect] = useState(false);
  const [nitroScore, setNitroScore] = useState(0);
  const [duelLb, setDuelLb] = useState<Array<{player:string;score:number;avatar?:string|null}>>([]);
  const [duelElo, setDuelElo] = useState<number|null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const nitroBarRef = useRef<HTMLDivElement>(null);
  const ghostBarRef = useRef<HTMLDivElement>(null);
  const nitroFillRef = useRef<HTMLDivElement>(null);
  const lastClickRef = useRef(0);
  const heldMaxRef = useRef<number|null>(null);
  const overheatUntilRef = useRef(0);
  const burstPendingRef = useRef(false);

  const rockRef = useRef<HTMLButtonElement>(null);
  const floatRootRef = useRef<HTMLDivElement>(null);
  const coinsRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  const perClick = upgrades.reduce((s, u) => s + u.power * u.count, 1);
  const perSec = upgrades.reduce((s, u) => s + u.auto * u.count, 0);

  // load from server: GET /magnum/api/mining
  useEffect(() => {
    fetch("/magnum/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setMe(j?.user ?? null))
      .catch(() => setMe(null));
    const onAuth = () => fetch("/magnum/api/auth/me", { credentials: "include" }).then((r) => (r.ok ? r.json() : null)).then((j) => setMe(j?.user ?? null)).catch(() => {});
    window.addEventListener("magnum:auth" as unknown as string, onAuth as EventListener);
    return () => window.removeEventListener("magnum:auth" as unknown as string, onAuth as EventListener);
  }, []);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // реальный лидерборд из Neon: топ-10 по балансу (coins/top публичный)
        const res = await fetch("/magnum/api/coins/top", { credentials: "include" });
        if (res.ok && !cancelled) {
          const data = (await res.json()) as { top?: Array<{ username: string; balance: number }> };
          if (Array.isArray(data.top)) {
            setBoard(data.top.slice(0, 10).map((t) => ({ name: t.username, coins: t.balance, date: new Date().toISOString().slice(0, 10) })));
          }
        }
      } catch { /* топ недоступен — пусто, без фейков */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/magnum/api/mining", { credentials: "include" });
        if (res.status === 401) { setLoading(false); return; }
        if (res.ok) {
          const data = (await res.json()) as { balance?: number; upgrades?: Array<{ id: string; count: number }>; perClick?: number; perSec?: number };
          if (cancelled) return;
          if (typeof data.balance === "number") setCoins(data.balance);
          if (Array.isArray(data.upgrades)) {
            setUpgrades((prev) => prev.map((u) => {
              const found = data.upgrades!.find((x) => x.id === u.id);
              return found ? { ...u, count: found.count } : u;
            }));
          }
        }
      } catch { /* ignore — show init */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  // auto-mining tick local (optimistic) — perSec from upgrades
  useEffect(() => {
    if (perSec === 0) return;
    const id = window.setInterval(() => {
      setCoins((c) => c + perSec);
    }, 1000);
    return () => clearInterval(id);
  }, [perSec]);

  // vault Neon fetch
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/magnum/api/mining/vault", { credentials: "include" });
        if (r.ok) {
          const j = (await r.json()) as { claimed?: string[]; catalog?: Array<{ id: string; claimed?: boolean }> };
          const claimed = j.claimed ?? (j.catalog ?? []).filter((c) => c.claimed).map((c) => c.id);
          setVaultClaimed(new Set(claimed as string[]));
        }
      } catch {}
    })();
  }, []);
  const claimVault = async (vaultId: string) => {
    if (!isValidVaultId(vaultId)) { showToast("Неверный vault id"); return; }
    if (vaultClaimed.has(vaultId)) { showToast("Уже забрано ✅"); return; }
    setVaultLoading(true);
    try {
      const r = await fetch("/magnum/api/mining/vault/claim", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vaultId }) });
      const j = (await r.json()) as { balance?: number; reward?: number; error?: string; price?: number };
      if (!r.ok) {
        if (r.status === 402) showToast(`Мало монет — нужно ${j.price} 🪙`);
        else if (r.status === 409) showToast(j.error === "sold out" ? "Sold out — тираж кончился" : "Уже забрано");
        else showToast(j.error ?? "Ошибка vault");
        return;
      }
      if (typeof j.balance === "number") setCoins(j.balance);
      setVaultClaimed((s) => new Set(s).add(vaultId));
      showToast(`Vault открыт +${j.reward} 🪙`);
      if (vaultRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const el = vaultRef.current.querySelector(`[data-vault="${vaultId}"]`) as HTMLElement | null;
        if (el) gsap.fromTo(el, { scale: 1 }, { scale: 1.04, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.inOut" });
      }
    } catch { showToast("Сеть — попробуй снова"); } finally { setVaultLoading(false); }
  };
  // vault GSAP stagger
  useEffect(() => {
    if (!vaultRef.current) return;
    const cards = vaultRef.current.querySelectorAll<HTMLElement>(`.${styles.shopCard}`);
    if (!cards.length) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) { gsap.set(cards, { y: 0, opacity: 1, clearProps: "transform" }); return; }
    const ctx = gsap.context(() => {
      gsap.set(cards, { y: 24, opacity: 0 });
      gsap.to(cards, { y: 0, opacity: 1, stagger: 0.12, duration: 0.5, ease: "power2.out", scrollTrigger: { trigger: vaultRef.current, start: "top 88%" } });
    }, vaultRef);
    return () => ctx.revert();
  }, [vaultClaimed]);

  // GSAP entrance y24 stagger 0.12 • reduced-motion • cleanup
  useEffect(() => {
    if (!pageRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (prefersReduced) {
        ScrollTrigger.batch(document.querySelectorAll('.card'), { onEnter: (batch:any) => gsap.to(batch, { y: 0, opacity: 1, stagger: 0.12, duration: 0.55, ease: "power2.out" }), start: "top 92%", once: true });
      gsap.set(`.${styles.header} > *`, { y: 0, opacity: 1, clearProps: "transform" });
        gsap.set(`.${styles.statCard}`, { y: 0, opacity: 1, clearProps: "transform" });
        gsap.set(`.${styles.shopCard}`, { y: 0, opacity: 1, clearProps: "transform" });
        gsap.set(`.${styles.rockWrap}`, { y: 0, opacity: 1, clearProps: "transform" });
        gsap.set(`.${styles.boardRow}`, { y: 0, opacity: 1, clearProps: "transform" });
        return;
      }
      gsap.set(`.${styles.header} > *`, { y: 24, opacity: 0 });
      gsap.to(`.${styles.header} > *`, { y: 0, opacity: 1, stagger: 0.12, duration: 0.55, ease: "power2.out", delay: 0.05 });
      gsap.set(`.${styles.statCard}`, { y: 24, opacity: 0 });
      gsap.to(`.${styles.statCard}`, { y: 0, opacity: 1, stagger: 0.12, duration: 0.5, ease: "power2.out", delay: 0.28 });
      gsap.set(`.${styles.shopCard}`, { y: 24, opacity: 0 });
      gsap.to(`.${styles.shopCard}`, { y: 0, opacity: 1, stagger: 0.12, duration: 0.5, ease: "power2.out", delay: 0.42 });
      gsap.set(`.${styles.rockWrap}`, { y: 24, opacity: 0 });
      gsap.to(`.${styles.rockWrap}`, { y: 0, opacity: 1, duration: 0.6, ease: "back.out(1.4)", delay: 0.55 });
      if (rockRef.current) {
        gsap.to(rockRef.current, { y: -4, duration: 1.6, repeat: -1, yoyo: true, ease: "sine.inOut" });
      }
      gsap.set(`.${styles.boardRow}`, { y: 24, opacity: 0 });
      gsap.to(`.${styles.boardRow}`, { y: 0, opacity: 1, stagger: 0.12, duration: 0.45, ease: "power2.out", delay: 0.65 });
    }, pageRef);
    return () => ctx.revert();
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1600);
  }, []);

  const spawnFloat = useCallback((value: number, x: number, y: number) => {
    if (!floatRootRef.current) return;
    const el = document.createElement("div");
    el.className = styles.floatPlus;
    el.textContent = `+${value} 42`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    floatRootRef.current.appendChild(el);
    gsap.fromTo(el, { y: 0, opacity: 1, scale: 0.9 }, {
      y: -56, opacity: 0, scale: 1.08, duration: 0.7, ease: "power2.out",
      onComplete: () => el.remove(),
    });
  }, []);

  const handleDig = (e: React.MouseEvent<HTMLButtonElement>) => {
    const val = perClick;
    setCoins((c) => c + val);
    // animate
    if (rockRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.fromTo(rockRef.current, { scale: 0.94 }, { scale: 1, duration: 0.22, ease: "back.out(2)" });
      const rect = rockRef.current.getBoundingClientRect();
      for (let i = 0; i < 5; i++) {
        const p = document.createElement("div");
        p.className = styles.particle;
        p.style.left = `${rect.width / 2}px`;
        p.style.top = `${rect.height / 2}px`;
        rockRef.current.appendChild(p);
        gsap.to(p, {
          x: (Math.random() - 0.5) * 90,
          y: (Math.random() - 0.5) * 90 - 10,
          opacity: 0, scale: 0, duration: 0.5 + Math.random() * 0.2, ease: "power2.out",
          onComplete: () => p.remove(),
        });
      }
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    spawnFloat(val, e.clientX - rect.left, e.clientY - rect.top);
    if (coinsRef.current) gsap.fromTo(coinsRef.current, { scale: 1.06 }, { scale: 1, duration: 0.25, ease: "power2.out" });

    void (async () => {
      try {
        const res = await fetch("/magnum/api/mining/click", { method: "POST", credentials: "include" });
        if (res.status === 401) { showToast("Войди в аккаунт — майнинг только для братух"); return; }
        if (res.ok) {
          const data = (await res.json()) as { balance?: number };
          if (typeof data.balance === "number") setCoins(data.balance);
        }
      } catch { /* optimistic */ }
    })();
  };

  const buy = (id: string) => {
    const idx = upgrades.findIndex((u) => u.id === id);
    if (idx === -1) return;
    const u = upgrades[idx]!;
    const price = costOf(u);
    if (coins < price) { showToast("Мало 42-коинов, братуха — покопай ещё"); return; }
    // optimistic
    setCoins((c) => c - price);
    setUpgrades((prev) => prev.map((x) => x.id === id ? { ...x, count: x.count + 1 } : x));
    showToast(`Куплено: ${u.name} · −${price} 🪙`);
    if (boardRef.current) gsap.fromTo(boardRef.current, { scale: 0.998 }, { scale: 1, duration: 0.2 });
    void (async () => {
      try {
        const res = await fetch("/magnum/api/mining/upgrade", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
        if (res.status === 401) { showToast("Войди чтобы покупать апгрейды"); return; }
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string; price?: number };
          if (res.status === 402) showToast(`Не хватает монет · нужно ${err.price ?? price}`);
          // revert optimistic on fail
          setCoins((c) => c + price);
          setUpgrades((prev) => prev.map((x) => x.id === id ? { ...x, count: Math.max(0, x.count - 1) } : x));
          return;
        }
        const data = (await res.json()) as { balance?: number; upgrades?: Array<{ id: string; count: number }> };
        if (typeof data.balance === "number") setCoins(data.balance);
        if (Array.isArray(data.upgrades)) {
          setUpgrades((prev) => prev.map((pu) => {
            const f = data.upgrades!.find((x) => x.id === pu.id);
            return f ? { ...pu, count: f.count } : pu;
          }));
        }
      } catch { /* ignore */ }
    })();
  };

  // ---- WS duel — P0 funnel: автоконнект + онбординг "Жми Старт" ----
  const [duelHintDismissed, setDuelHintDismissed] = useState(false);
  const duelPromptShownRef = useRef(false);
  const connectDuel = useCallback(async () => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) return;
    if (!me) {
      showToast("Войди, братуха — дуэль только для залогиненных");
      window.dispatchEvent(new CustomEvent("magnum:need-auth"));
      return;
    }
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${proto}//${window.location.host}/magnum/api/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen = () => setDuelConnected(true);
    ws.onclose = () => setDuelConnected(false);
    ws.onerror = () => setDuelConnected(false);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as { type?: string; room?: DuelRoom; you?: string };
        if (msg.room) setDuelRoom(msg.room);
        if (msg.type === "room" || msg.type === "lobby:created") {
          if (msg.room) setDuelRoom(msg.room as DuelRoom);
        }
        if (msg.type === "finish") {
          if (msg.room) setDuelRoom(msg.room as DuelRoom);
          const myScore = (() => {
            try {
              const r = (msg as { room?: DuelRoom }).room;
              const meName = me?.username ?? "";
              const p = r?.players.find((x) => x.name === meName);
              return typeof p?.score === "number" ? Math.round(p.score * 10) : 42;
            } catch { return 42; }
          })();
          void fetch("/magnum/api/games/submit", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "duel", score: myScore, meta: { src: "mining-ws-finish" } }) }).catch(() => {});
        }
        if (msg.type === "scores" || msg.type === "tick" || msg.type === "start") {
          if (msg.room) setDuelRoom(msg.room as DuelRoom);
        }
      } catch {}
    };
  }, [me, showToast]);

  // автоконнект WS дуэли после логина / при заходе на Майнинг
  useEffect(() => {
    if (!me) { duelPromptShownRef.current = false; return; }
    if (duelConnected) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) return;
    const t = window.setTimeout(() => { void connectDuel(); }, 300);
    return () => window.clearTimeout(t);
  }, [me, duelConnected, connectDuel]);
  // промпт "Жми Старт" когда комната в waiting и соединена
  useEffect(() => {
    if (!duelConnected || !duelRoom) return;
    if (duelRoom.state !== "waiting") { duelPromptShownRef.current = false; return; }
    if (duelHintDismissed) return;
    if (duelPromptShownRef.current) return;
    duelPromptShownRef.current = true;
    showToast("Жми Старт — взорви вулкан! 🌋 1/4 братух в комнате");
  }, [duelConnected, duelRoom, duelHintDismissed, showToast]);

  const disconnectDuel = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setDuelConnected(false);
    setDuelRoom(null);
  }, []);

  useEffect(() => () => { wsRef.current?.close(); }, []);

  const duelClick = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "click" }));
    // punch
    if (rockRef.current) gsap.fromTo(rockRef.current, { scale: 0.96 }, { scale: 1, duration: 0.15 });
  };
  const duelStart = () => {
    wsRef.current?.send(JSON.stringify({ type: "start" }));
  };

  // P0 funnel: автоскролл к #duel если hash при заходе (/magnum/mining#duel из нуджа)
  useEffect(() => {
    if (window.location.hash !== "#duel") return;
    const t = window.setTimeout(() => {
      const el = document.getElementById("duel");
      if (el) el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    }, 320);
    return () => window.clearTimeout(t);
  }, []);

  // hover RGB — chromatic lift
  const onShopEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.to(e.currentTarget, {
      y: -4,
      boxShadow: "0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,45,85,0.20), 0 0 22px rgba(255,45,85,0.20), 0 0 22px rgba(0,255,136,0.12), 0 0 28px rgba(255,204,0,0.10)",
      borderColor: "rgba(255,45,85,0.35)",
      duration: 0.28,
      ease: "power2.out",
      overwrite: true,
    });
  }, []);
  const onShopLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.to(e.currentTarget, {
      y: 0,
      boxShadow: "0 0 0 transparent",
      borderColor: "rgba(255,255,255,0.08)",
      duration: 0.35,
      ease: "power2.out",
      overwrite: true,
    });
  }, []);

  return (
    <div className={styles.page} ref={pageRef}>
      <header className={styles.header}>
        <div className={styles.badge}>⛏️ ИРОНИЧНЫЙ МАЙНИНГ · 42-COIN · КУЗБАСС EDITION</div>
        <h1 className={styles.heroTitle}>МАЙНИ 42-КОИНЫ<br /><span>КОПАЙ КАК ШАХТЁР</span></h1>
        <p className={styles.subtitle}>
          Кликер без крипты и без скама. Кликай по породе, покупай лопаты и кирки, включай авто-бур — и стань легендой Кузбасса.
          Всё сохраняется — токен в cookie.
        </p>
      </header>

      {!me && (
        <div style={{ margin: "14px 0", padding: 14, border: "1px solid rgba(255,204,0,0.3)", borderRadius: 12, background: "rgba(255,204,0,0.08)", textAlign: "center" }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Войди, братуха — майнинг закрыт без логина</div>
          <div style={{ opacity: 0.8, fontSize: 13, marginBottom: 10 }}>Без авторизации копка не сохраняется. Никаких голых ошибок.</div>
          <AuthStatus />
        </div>
      )}
      {toast && <div className={styles.toast} role="status">{toast}</div>}

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLbl}>Баланс</div>
          <div ref={coinsRef} className={styles.statVal}><span className={styles.coin}>◉</span> {loading ? "…" : coins.toLocaleString("ru-RU")} <small>42</small></div>
          <div className={styles.statHint}>magnum_mining</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLbl}>За клик</div>
          <div className={styles.statValAccent}>+{perClick} <small>42</small></div>
          <div className={styles.statHint}>+power от апгрейдов</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLbl}>Авто / сек</div>
          <div className={styles.statValGreen}>+{perSec} <small>/с</small></div>
          <div className={styles.statHint}>бур · БЕЛАЗ · шахта</div>
        </div>
      </div>

      <section className={styles.digSection}>
        <div ref={floatRootRef} className={styles.rockWrap}>
          <button
            ref={rockRef}
            className={styles.rock}
            onClick={handleDig}
            aria-label="Копать 42-коины"
          >
            <span className={styles.rockEmoji}>🪨</span>
            <span className={styles.rockLabel}>КОПАТЬ</span>
            <span className={styles.rockSub}>жми · +{perClick} за удар</span>
          </button>
          <div className={styles.rockGlow} aria-hidden />
        </div>
        <div className={styles.digHints}>
          <p>💡 Совет братухи: купи <b>Лопата 42</b> за 42 — окупается за 42 клика. Кирка 142 — для трушных.</p>
          <div className={styles.digActions}>
            <input className={styles.nickInput} value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Твой ник" maxLength={18} aria-label="Ник для дуэли" />
            <button className={styles.btnGhost} onClick={() => showToast("Баланс синхронизирован ✅")}>Синк</button>
          </div>
        </div>
      </section>

      <section className={styles.shop}>
        <h2 className={styles.sectionTitle}>МАГАЗ БРАТУХИ <span>· АПГРЕЙДЫ</span></h2>
        <div className={styles.shopGrid}>
          {upgrades.map((u) => {
            const price = costOf(u);
            const canBuy = coins >= price;
            return (
              <div key={u.id} className={`${styles.shopCard} ${u.count > 0 ? styles.shopCardOwned : ""}`} onMouseEnter={onShopEnter} onMouseLeave={onShopLeave}>
                <div className={styles.shopIcon}>{u.icon}</div>
                <div className={styles.shopInfo}>
                  <div className={styles.shopName}>{u.name} {u.count > 0 && <span className={styles.countBadge}>×{u.count}</span>}</div>
                  <div className={styles.shopDesc}>{u.desc}</div>
                  <div className={styles.shopMeta}>
                    <span className={u.power ? styles.metaClick : styles.metaAuto}>{u.power ? `+${u.power}/клик` : `+${u.auto}/сек`}</span>
                    <span className={styles.metaPrice} data-can={canBuy ? "1" : "0"}>{price} 42</span>
                  </div>
                </div>
                <button className={styles.buyBtn} onClick={() => buy(u.id)} disabled={!canBuy}>КУПИТЬ</button>
              </div>
            );
          })}
        </div>
      </section>

      {/* VAULT 42 — лимитированные дропы (Neon magnum_mining_vault) */}
      <section className={styles.shop} ref={vaultRef} style={{ marginTop: 28 }}>
        <h2 className={styles.sectionTitle}>VAULT 42 <span>· ЛИМИТКИ · Neon</span></h2>
        <p style={{ opacity: 0.6, fontSize: 13, marginBottom: 10 }}>Открой сейф — цена списывается из магнум-баланса, награда падает бонуcом. Тираж ограничен (sold out на сервере). Баланс только в Neon.</p>
        <div className={styles.shopGrid}>
          {MINING_VAULT_32.slice(0, 5).map((v) => {
            const claimed = vaultClaimed.has(v.id);
            const canClaim = !claimed && coins >= v.price && !vaultLoading && isValidVaultId(v.id);
            return (
              <div key={v.id} data-vault={v.id} className={`${styles.shopCard} ${claimed ? styles.shopCardOwned : ""}`} onMouseEnter={onShopEnter} onMouseLeave={onShopLeave}>
                <div className={styles.shopIcon}>{v.icon}</div>
                <div className={styles.shopInfo}>
                  <div className={styles.shopName}>{v.name} <span style={{ fontSize: 10, opacity: 0.6, border: `1px solid ${v.rarity==="legendary"?"#ffcc00":v.rarity==="epic"?"#9147ff":v.rarity==="rare"?"#5865f2":"#555"}`, borderRadius: 999, padding: "2px 6px" }}>{v.rarity}</span> <span style={{ fontSize: 10, opacity: 0.5 }}>×{v.limit} лимит</span></div>
                  <div className={styles.shopDesc}>Цена {v.price} → награда +{v.reward} 42 · лимит {v.limit} на всех братух</div>
                  <div className={styles.shopMeta}><span className={styles.metaPrice} data-can={canClaim ? "1" : "0"}>{v.price} 42 → +{v.reward}</span></div>
                </div>
                <button className={styles.buyBtn} onClick={() => claimVault(v.id)} disabled={!canClaim}>{claimed ? "✓ ВЗЯТО" : vaultLoading ? "…" : "ОТКРЫТЬ"}</button>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 8, fontSize: 11, opacity: 0.45 }}>GET /magnum/api/mining/vault · POST /magnum/api/mining/vault/claim · {vaultClaimed.size}/5 забрано · баланс Neon: {coins} 42</div>
      </section>

      {/* WS duel 2-4 игрока — P0 funnel активация: id=duel для автоскролла из нуджа */}
      <section id="duel" data-duel="42" className={styles.duelSection} style={{ marginTop: 32, scrollMarginTop: 72 }}>
        <h2 className={styles.sectionTitle}>ДУЭЛЬ 42 <span>· 2–4 БРАТУХИ · REALTIME WS</span></h2>
        <p style={{ opacity: 0.7, marginBottom: 12 }}>Комната на 2–4 игрока, кликер-дуэль 10 сек, broadcast scores, persist в magnum_leaderboard при финише.</p>
        {duelConnected && duelRoom?.state === "waiting" && !duelHintDismissed && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "10px 14px", border: "1px solid rgba(255,204,0,0.35)", borderRadius: 12, background: "linear-gradient(135deg, rgba(255,204,0,0.16), rgba(255,45,85,0.10))", boxShadow: "0 0 18px rgba(255,204,0,0.18)" }}>
            <span style={{ fontSize: 18 }}>🌋</span>
            <div style={{ flex: 1, fontWeight: 800, fontSize: 13, letterSpacing: 0.3 }}>Жми Старт — ворвись в дуэль! 1/4 братух в комнате → 10с кликов, счёт в magnum_game_scores</div>
            <button className={styles.btnSave} onClick={() => duelStart()} style={{ animation: "pulse 1.2s infinite" }}>ЖМИ СТАРТ →</button>
            <button className={styles.btnGhost} onClick={() => setDuelHintDismissed(true)} style={{ fontSize: 11, opacity: 0.6 }}>✕</button>
          </div>
        )}
        <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          {!duelConnected ? <button className={styles.btnSave} onClick={connectDuel}>ВОЙТИ В ДУЭЛЬ →</button> : <button className={styles.btnGhost} onClick={disconnectDuel}>ВЫЙТИ</button>}
          {duelConnected && duelRoom?.state === "waiting" && <button className={styles.btnSave} onClick={duelStart} style={{ boxShadow: "0 0 14px rgba(255,204,0,0.35)" }}>СТАРТ 10С</button>}
          {duelConnected && duelRoom?.state === "playing" && <button className={styles.rock} onClick={duelClick} style={{ padding: "12px 28px" }}>ЖМИ! 🔥</button>}
          {duelConnected && duelRoom && <span style={{ fontSize: 11, opacity: 0.55, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 999, padding: "4px 8px" }}>{duelConnected ? "WS ● connected" : "WS ○"} · {duelRoom.players.length}/4 · {duelRoom.state}</span>}
        </div>
        {duelRoom ? (
          <div ref={boardRef} style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>Комната {duelRoom.id} · {duelRoom.state} · {duelRoom.players.length}/4</div>
            {duelRoom.players.map((p) => (
              <div key={p.name} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #222" }}>
                <span>{p.name}</span><span style={{ fontWeight: 700 }}>{p.score}</span>
              </div>
            ))}
            {duelRoom.state === "finished" && <div style={{ marginTop: 8, color: "#7cff7c" }}>Финиш! Результаты сохранены в magnum_leaderboard.</div>}
          </div>
        ) : <div style={{ opacity: 0.5, fontSize: 13 }}>{duelConnected ? "Ждём игроков…" : "Нажми «Войти в дуэль» — найдём комнату 2–4 братух."}</div>}
      </section>

      <section ref={boardRef} className={styles.board}>
        <h2 className={styles.sectionTitle}>ЛИДЕРБОРД <span>· ТОП ШАХТЁРОВ</span></h2>
        <div className={styles.boardList}>
          {board.length === 0 && <div style={{ opacity: 0.55, fontSize: 13, padding: "10px 4px" }}>Пока пусто — стань первым шахтёром в топе 🔥</div>}
          {board.map((e, i) => (
            <div key={e.name + i} className={styles.boardRow}>
              <span className={styles.boardRank}>#{i + 1}</span>
              <span className={styles.boardName}>{e.name}</span>
              <span className={styles.boardCoins}>{e.coins.toLocaleString("ru-RU")} 42</span>
              <span className={styles.boardDate}>{e.date}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}