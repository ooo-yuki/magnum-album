import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./MiningPage.module.css";
import { CosmeticIdentity, cosmeticBannerStyle, type LeaderCosmetics } from "../components/CosmeticBadge";
import { AuthStatus } from "../components/AuthStatus";
import { FirstGameBanner } from "../components/FirstGameBanner";
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
  avatar?: string | null;
  verified?: boolean;
} & LeaderCosmetics;

const UPGRADES_INIT: Upgrade[] = [
  { id: "shovel", name: "Лопата 42", desc: "+1 за клик · шахтёрский старт", icon: "🪓", baseCost: 42, power: 1, auto: 0, count: 0 },
  { id: "pick", name: "Кирка 142", desc: "+3 за клик · кузбасская закалка", icon: "⛏️", baseCost: 142, power: 3, auto: 0, count: 0 },
  { id: "drill", name: "Бур 420", desc: "+1/сек авто · гудит как Томь", icon: "🛢️", baseCost: 420, power: 0, auto: 1, count: 0 },
  { id: "truck", name: "БЕЛАЗ 1042", desc: "+5/сек авто · везёт весь Кузбасс", icon: "🚚", baseCost: 1042, power: 0, auto: 5, count: 0 },
  { id: "shaft", name: "Шахта 2042", desc: "+12/сек · бездна 42", icon: "🏗️", baseCost: 2042, power: 5, auto: 12, count: 0 },
];



export const MINING_VAULT_32: { id: string; name: string; price: number; reward: number; rarity: string; icon: string; limit: number; src: string }[] = [
  { id: "vault-coal",   name: "Ящик угля",       price: 420,  reward: 142,  rarity: "common",    icon: "🪨", limit: 99, src: "" },
  { id: "vault-ore",    name: "Рудный кейс",     price: 840,  reward: 420,  rarity: "rare",      icon: "⛏️", limit: 42, src: "" },
  { id: "vault-gold",   name: "Золотой слиток",  price: 1420, reward: 840,  rarity: "epic",      icon: "🏆", limit: 14, src: "" },
  { id: "vault-diamond",name: "Алмаз Кузбасса",  price: 2042, reward: 1420, rarity: "legendary", icon: "💎", limit: 4,  src: "" },
  { id: "vault-belaz",  name: "БЕЛАЗ-контейнер", price: 3200, reward: 2042, rarity: "legendary", icon: "🚚", limit: 2,  src: "" },
  { id: "fact-01", name: "42 м глубина",      price: 0, reward: 0, rarity: "common", icon: "📏", limit: 1, src: "" },
  { id: "fact-02", name: "142 удара киркой",  price: 0, reward: 0, rarity: "common", icon: "⛏️", limit: 1, src: "" },
  { id: "fact-03", name: "420 оборотов бура", price: 0, reward: 0, rarity: "common", icon: "🛢️", limit: 1, src: "" },
  { id: "fact-04", name: "1042 тонны БЕЛАЗ",  price: 0, reward: 0, rarity: "rare",   icon: "🚚", limit: 1, src: "" },
  { id: "fact-05", name: "2042 м шахта",      price: 0, reward: 0, rarity: "epic",   icon: "🏗️", limit: 1, src: "" },
  { id: "fact-06", name: "Томь рядом",        price: 0, reward: 0, rarity: "common", icon: "🌊", limit: 1, src: "" },
  { id: "fact-07", name: "Кузбасс уголь",     price: 0, reward: 0, rarity: "common", icon: "🪨", limit: 1, src: "" },
  { id: "fact-08", name: "42-коин токен",     price: 0, reward: 0, rarity: "common", icon: "🪙", limit: 1, src: "" },
  { id: "fact-09", name: "perClick формула",  price: 0, reward: 0, rarity: "common", icon: "🧮", limit: 1, src: "" },
  { id: "fact-10", name: "perSec авто",       price: 0, reward: 0, rarity: "common", icon: "⚡", limit: 1, src: "" },
  { id: "fact-11", name: "cost 1.42^count",   price: 0, reward: 0, rarity: "common", icon: "📈", limit: 1, src: "" },
  { id: "fact-12", name: "GSAP y24 stagger",  price: 0, reward: 0, rarity: "rare",   icon: "✨", limit: 1, src: "" },
  { id: "fact-13", name: "WS duel 2-4",       price: 0, reward: 0, rarity: "epic",   icon: "🎮", limit: 1, src: "" },
  { id: "fact-14", name: "10с дуэль",         price: 0, reward: 0, rarity: "rare",   icon: "⏱️", limit: 1, src: "" },
  { id: "fact-15", name: "Neon proud-bar",    price: 0, reward: 0, rarity: "common", icon: "🐘", limit: 1, src: "" },
  { id: "fact-16", name: "cookie токен",      price: 0, reward: 0, rarity: "common", icon: "🍪", limit: 1, src: "" },
  { id: "fact-17", name: "Bun.serve WS",      price: 0, reward: 0, rarity: "rare",   icon: "🐰", limit: 1, src: "" },
  { id: "fact-18", name: "rate 120/60s click",price: 0, reward: 0, rarity: "common", icon: "🛡️", limit: 1, src: "" },
  { id: "fact-19", name: "vault limit 99",    price: 0, reward: 0, rarity: "common", icon: "📦", limit: 1, src: "" },
  { id: "fact-20", name: "sold out check",    price: 0, reward: 0, rarity: "rare",   icon: "🚫", limit: 1, src: "" },
  { id: "fact-21", name: "balance Neon",      price: 0, reward: 0, rarity: "common", icon: "🐘", limit: 1, src: "" },
  { id: "fact-22", name: "collect 6h cap",    price: 0, reward: 0, rarity: "epic",   icon: "⏳", limit: 1, src: "" },
  { id: "fact-23", name: "Братуха 42",        price: 0, reward: 0, rarity: "common", icon: "👤", limit: 1, src: "" },
  { id: "fact-24", name: "Аватар скин",       price: 0, reward: 0, rarity: "rare",   icon: "🦊", limit: 1, src: "" },
  { id: "fact-25", name: "hover RGB glow",    price: 0, reward: 0, rarity: "rare",   icon: "🌈", limit: 1, src: "" },
  { id: "fact-26", name: "particle 5",        price: 0, reward: 0, rarity: "common", icon: "💥", limit: 1, src: "" },
  { id: "fact-27", name: "float +42",         price: 0, reward: 0, rarity: "common", icon: "➕", limit: 1, src: "" },
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
  const [petBuff, setPetBuff] = useState<{stage:number;bonus:number;buff:string}|null>(null);
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
        const res = await fetch("/magnum/api/coins/top", { credentials: "include" });
        if (res.ok && !cancelled) {
          const data = (await res.json()) as { top?: Array<{ username: string; balance: number; avatar?: string | null; verified?: boolean } & LeaderCosmetics> };
          if (Array.isArray(data.top)) {
            setBoard(data.top.slice(0, 10).map((t) => ({
              name: t.username, coins: t.balance, date: new Date().toISOString().slice(0, 10),
              avatar: t.avatar ?? null, verified: Boolean(t.verified),
              frame: t.frame ?? null, banner: t.banner ?? null, title: t.title ?? null,
            })));
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

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/magnum/api/pet", { credentials: "include" });
        if (r.ok) {
          const j = await r.json() as { pet?: { stage:number; miningBonus:number; buff:string } };
          if (j.pet) setPetBuff({ stage: j.pet.stage, bonus: j.pet.miningBonus, buff: j.pet.buff });
        }
      } catch {}
    })();
  }, []);
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

  // ---- WS duel — NITRO 42: x9 + ghost + overheat 3s→1s -50% ----
  const [duelHintDismissed, setDuelHintDismissed] = useState(false);
  const duelPromptShownRef = useRef(false);
  const spawnConfetti = useCallback(() => {
    if (!stageRef.current) return;
    const root = stageRef.current;
    for (let i=0;i<160;i++) {
      const d=document.createElement('div');
      d.style.position='absolute'; d.style.left='50%'; d.style.top='38%';
      d.style.width='6px'; d.style.height='6px'; d.style.borderRadius='1px';
      d.style.background= i%3===0?'#ff2d55': i%3===1?'#00ff88':'#ffd42a';
      d.style.pointerEvents='none';
      root.appendChild(d);
      const ang=Math.random()*Math.PI*2, dist=60+Math.random()*180;
      gsap.to(d,{x:Math.cos(ang)*dist, y:Math.sin(ang)*dist+80, rotation:Math.random()*720, opacity:0, duration:0.9+Math.random()*0.6, ease:'power2.out', onComplete:()=>d.remove()});
    }
  },[]);
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
    ws.onopen = () => { setDuelConnected(true); setSuspect(false); };
    ws.onclose = () => setDuelConnected(false);
    ws.onerror = () => setDuelConnected(false);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as any;
        if (msg.room) setDuelRoom(msg.room);
        if (msg.type === "room" || msg.type === "lobby:created") {
          if (msg.room) { setDuelRoom(msg.room as DuelRoom); if (msg.code) setDuelCode(String(msg.code)); }
        }
        if (msg.type === "suspect") { setSuspect(true); showToast(msg.toast||"братуха, авто-клик? 🚫"); if(stageRef.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) gsap.fromTo(stageRef.current,{x:-6},{x:6,duration:0.08, yoyo:true, repeat:5, ease:'power2.inOut'}); }
        if (msg.type === "overheat") { setOverheat(true); setGhostTrail(true); showToast("OVERHEAT — кулдаун 1с −50% ❄️"); if(stageRef.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) gsap.fromTo(stageRef.current,{x:-6},{x:6,duration:0.09, yoyo:true, repeat:4}); setTimeout(()=>{ setOverheat(false); },1000); }
        if (msg.type === "tick") {
          if (typeof msg.nitro==='number') setNitro(msg.nitro); else if(typeof msg.volcano==='number') setNitro(msg.volcano);
          else if(typeof msg.magma==='number') setNitro(msg.magma);
          if (typeof msg.score==='number') setNitroScore(Math.round(msg.score*10));
          if (msg.ghostTrail || msg.eruptionPending) setGhostTrail(true);
          if (msg.overheat) { setOverheat(true); setTimeout(()=>setOverheat(false),1000); }
          if (typeof msg.oppNitro==='number') setOppNitro(msg.oppNitro);
          if (msg.lavaSpike || msg.eruption) { burstPendingRef.current=false; if(stageRef.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){ gsap.fromTo(stageRef.current,{scale:1},{scale:1.03,duration:0.12,yoyo:true,repeat:1}); } }
          if (msg.ghostTrail && ghostBarRef.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            gsap.fromTo(ghostBarRef.current,{opacity:0.6},{opacity:1, duration:0.4, yoyo:true, repeat:1, ease:'sine.inOut'});
          }
          if (msg.room) setDuelRoom(msg.room as DuelRoom);
        }
        if (msg.type === "finish") {
          if (msg.room) setDuelRoom(msg.room as DuelRoom);
          spawnConfetti();
          setNitro(0); setOppNitro(0); setGhostTrail(false); setOverheat(false); heldMaxRef.current=null; burstPendingRef.current=false;
          const myScore = (() => {
            try {
              const r = (msg as { room?: DuelRoom }).room;
              const meName = me?.username ?? "";
              const p = r?.players.find((x) => x.name === meName);
              return typeof p?.score === "number" ? Math.round(p.score * 10) : 42;
            } catch { return 42; }
          })();
          void fetch("/magnum/api/games/submit", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "duel42", score: myScore, meta: { src: "mining-nitro-finish", nitro } }) }).catch(() => {});
        }
        if (msg.type === "scores" || msg.type === "start") {
          if (msg.room) setDuelRoom(msg.room as DuelRoom);
          if (msg.type==="start") { setNitro(0); setNitroScore(0); setGhostTrail(false); setOverheat(false); heldMaxRef.current=null; lastClickRef.current=0; overheatUntilRef.current=0; }
        }
      } catch {}
    };
  }, [me, showToast, spawnConfetti]);

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
    showToast("Жми Старт — вруби NITRO! 🔥 1/4 братух в комнате — x9 до 9!");
  }, [duelConnected, duelRoom, duelHintDismissed, showToast]);

  useEffect(()=>{ if(!me) return; fetch('/magnum/api/duel42/leaderboard').then(r=>r.ok?r.json():null).then(j=>{ if(j?.leaderboard) setDuelLb(j.leaderboard); }).catch(()=>{}); fetch('/magnum/api/duel42/elo',{credentials:'include'}).then(r=>r.ok?r.json():null).then(j=>{ if(typeof j?.elo==='number') setDuelElo(j.elo); }).catch(()=>{}); },[me]);

  const disconnectDuel = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setDuelConnected(false);
    setDuelRoom(null);
  }, []);

  useEffect(() => () => { wsRef.current?.close(); }, []);

  const duelClick = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (Date.now() < overheatUntilRef.current) { showToast('OVERHEAT — остываем 1с'); return; }
    const now=Date.now(); const dt=now - lastClickRef.current;
    let cur=nitro;
    if (dt < 180) cur = Math.min(9, cur + 1); else cur = 1;
    setNitro(cur);
    lastClickRef.current=now;
    if (cur >= 9) {
      if (heldMaxRef.current===null) heldMaxRef.current=now;
      const held = now - (heldMaxRef.current??now);
      if (held >= 3000 && !burstPendingRef.current) {
        burstPendingRef.current=true; setGhostTrail(true);
      }
      if (held >= 3000) {
        overheatUntilRef.current=now+1000; setOverheat(true); setGhostTrail(true);
        setTimeout(()=>setOverheat(false),1000);
        if(stageRef.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) gsap.fromTo(stageRef.current,{x:-6},{x:6,duration:0.09, yoyo:true, repeat:4});
      }
    } else {
      heldMaxRef.current=null; burstPendingRef.current=false;
    }
    wsRef.current.send(JSON.stringify({ type: "click" }));
    if (rockRef.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) gsap.fromTo(rockRef.current, { scale: 0.96 }, { scale: 1, duration: 0.15 });
    if (nitroFillRef.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.fromTo(nitroFillRef.current,{scaleX:1},{scaleX:1.08,duration:0.12, yoyo:true, repeat:1});
    }
    if (cur>=9 && ghostBarRef.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.fromTo(ghostBarRef.current,{opacity:0.5},{opacity:1,duration:0.25, yoyo:true, repeat:1});
    }
  };
  const duelStart = () => {
    wsRef.current?.send(JSON.stringify({ type: "start" }));
    setNitro(0); setOverheat(false); setGhostTrail(false); heldMaxRef.current=null; burstPendingRef.current=false;
  };
  const duelCreateLobby = () => {
    if(!wsRef.current || wsRef.current.readyState!==WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type:"lobby:create", wager: duelWager }));
  };
  const duelJoin = () => {
    if(!wsRef.current || wsRef.current.readyState!==WebSocket.OPEN) return;
    const code = duelCode.trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4);
    if(code.length!==4){ showToast('Код 4 символа, братуха'); return; }
    wsRef.current.send(JSON.stringify({ type:"join", code }));
  };
  const duelReady = () => { wsRef.current?.send(JSON.stringify({type:'ready'})); };

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

      <FirstGameBanner />

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

      {}
      <section className={styles.shop} ref={vaultRef} style={{ marginTop: 28 }}>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:10,padding:"8px 12px",border:"1px solid rgba(255,204,0,.18)",borderRadius:12,background:"rgba(255,204,0,.06)"}}>
          <span style={{fontWeight:800,fontSize:12}}>🐾 ПИТОМЕЦ 42 {petBuff?`· stage ${petBuff.stage} · ${petBuff.buff} · +${petBuff.bonus}% mining`:`· яйцо → титан +5/10/15% mining`}</span>
          <a href="/magnum/pet" style={{marginLeft:"auto",fontSize:12,padding:"6px 10px",borderRadius:999,border:"1px solid #ffd42a",color:"#ffd42a",textDecoration:"none",fontWeight:800}}>→ /magnum/pet</a>
        </div>
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

      {}
      <section ref={stageRef} id="duel" data-duel="42" className={styles.duelSection} style={{ marginTop: 32, scrollMarginTop: 72, position:"relative", overflow:"hidden", border:"1px solid rgba(255,45,85,0.18)", borderRadius:14, padding:14, background:"linear-gradient(180deg, rgba(255,45,85,0.06), rgba(255,255,255,0.02))" }}>
        {overheat && <div style={{position:"absolute", inset:0, background:"rgba(0,180,255,0.06)", pointerEvents:"none"}} />}
        <h2 className={styles.sectionTitle}>⚡ ДУЭЛЬ NITRO 42 <span>· 2–4 БРАТУХИ · x9 · 10С</span></h2>
        <p style={{ opacity: 0.7, marginBottom: 12 }}>NITRO &lt;0.18с +9% капа x9 (1.0→1.72) · overheat 3с удержания x9 → 1с кулдаун −50% · ghost-nitro trail · CPS&gt;20 suspect · wager 0/42/142/420</p>
        {duelConnected && duelRoom?.state === "waiting" && !duelHintDismissed && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "10px 14px", border: "1px solid rgba(255,45,85,0.35)", borderRadius: 12, background: "linear-gradient(135deg, rgba(255,45,85,0.16), rgba(255,204,0,0.10))", boxShadow: "0 0 18px rgba(255,45,85,0.18)" }}>
            <span style={{ fontSize: 18 }}>⚡</span>
            <div style={{ flex: 1, fontWeight: 800, fontSize: 13, letterSpacing: 0.3 }}>Вруби NITRO! 1/4 братух → 10с кликов · &lt;0.18с +9% до x9</div>
            <button className={styles.btnSave} onClick={() => duelStart()} style={{ animation: "pulse 1.2s infinite" }}>ЖМИ СТАРТ →</button>
            <button className={styles.btnGhost} onClick={() => setDuelHintDismissed(true)} style={{ fontSize: 11, opacity: 0.6 }}>✕</button>
          </div>
        )}
        <div style={{display:"flex", gap:8, marginBottom:10, flexWrap:"wrap", alignItems:"center"}}>
          <select value={duelWager} onChange={e=>setDuelWager(Number(e.target.value))} style={{padding:"6px 8px", borderRadius:10, border:"1px solid rgba(255,255,255,0.12)", background:"rgba(0,0,0,0.3)", color:"#fff"}}>
            <option value={0}>wager 0</option><option value={42}>wager 42</option><option value={142}>wager 142</option><option value={420}>wager 420</option>
          </select>
          <button onClick={duelCreateLobby} disabled={!duelConnected} style={{padding:"6px 10px", borderRadius:10, border:"1px solid rgba(255,204,0,0.22)", opacity:!duelConnected?0.5:1, cursor:"pointer"}}>Создать ABCD</button>
          <input value={duelCode} onChange={e=>setDuelCode(e.target.value)} placeholder="ABCD" maxLength={4} style={{width:64, padding:"6px 8px", borderRadius:10, border:"1px solid rgba(255,255,255,0.12)", background:"rgba(0,0,0,0.3)", color:"#fff", textTransform:"uppercase"}} />
          <button onClick={duelJoin} disabled={!duelConnected} style={{padding:"6px 10px", borderRadius:10, border:"1px solid rgba(255,255,255,0.12)", opacity:!duelConnected?0.5:1, cursor:"pointer"}}>Join</button>
        </div>
        {/* nitro + ghost bars */}
        <div ref={nitroBarRef} style={{marginBottom:10, display:"grid", gap:6}}>
          <div style={{display:"flex", justifyContent:"space-between", fontSize:12, opacity:0.9}}><span>NITRO {nitro}/9 {ghostTrail?"👻 ghost": ""} {overheat?"❄️ OVERHEAT 1с":""} {suspect?"🚫 suspect":""}</span><span>score {nitroScore}</span></div>
          <div style={{height:14, borderRadius:10, background:"rgba(0,0,0,0.35)", border:"1px solid rgba(255,45,85,0.22)", overflow:"hidden", position:"relative"}}>
            <div ref={nitroFillRef} style={{height:"100%", width:`${(nitro/9)*100}%`, background: overheat?"linear-gradient(90deg,#00b8ff,#00e5ff)": ghostTrail?"linear-gradient(90deg,#ff2d55,#ff8a65)":"linear-gradient(90deg,#ff2d55,#ffd42a)", transition:"width 0.12s", boxShadow: ghostTrail?"0 0 14px rgba(255,45,85,0.45)":"none"}} />
          </div>
          <div ref={ghostBarRef} style={{height:6, borderRadius:6, background: ghostTrail?"rgba(255,45,85,0.35)":"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.06)", opacity: ghostTrail?1:0.5, boxShadow: ghostTrail?"0 0 10px rgba(255,45,85,0.35)":"none", transition:"all 0.2s"}} />
          <div style={{fontSize:11, opacity:0.6}}>ABCD join→ready→10с · nitro &lt;0.18с +9% капа x9 · overheat 3с→1с −50% · ghost trail · throttle 30/сек · heartbeat 25с · wager win +wager*2 +42 ELO</div>
        </div>
        <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          {!duelConnected ? <button className={styles.btnSave} onClick={connectDuel}>ВОЙТИ В ДУЭЛЬ →</button> : <button className={styles.btnGhost} onClick={disconnectDuel}>ВЫЙТИ</button>}
          {duelConnected && <button className={styles.btnGhost} onClick={duelReady}>READY ✓</button>}
          {duelConnected && duelRoom?.state === "waiting" && <button className={styles.btnSave} onClick={duelStart} style={{ boxShadow: "0 0 14px rgba(255,45,85,0.35)" }}>СТАРТ 10С</button>}
          {duelConnected && duelRoom?.state === "playing" && <button className={styles.rock} onClick={duelClick} style={{ padding: "12px 28px", background: overheat?"rgba(0,180,255,0.12)":undefined, borderColor: overheat?"rgba(0,180,255,0.32)":undefined, boxShadow: nitro>=9?"0 0 16px rgba(255,45,85,0.35)":"none" }}>{overheat?"ОСТЫВАЕМ... ❄️":"ЖМИ! ⚡ NITRO"}</button>}
          {duelConnected && duelRoom && <span style={{ fontSize: 11, opacity: 0.55, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 999, padding: "4px 8px" }}>{duelConnected ? "WS ● connected" : "WS ○"} · {duelRoom.players.length}/4 · {duelRoom.state} {duelRoom.wager?`· wager ${duelRoom.wager}`:""} {duelElo!==null?`· ELO ${duelElo}`:""}</span>}
        </div>
        {duelRoom ? (
          <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>Комната {duelRoom.id} · {duelRoom.state} · {duelRoom.players.length}/4 {duelRoom.wager?`· wager ${duelRoom.wager}`:""}</div>
            {duelRoom.players.map((p) => (
              <div key={p.name} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #222", opacity: (p as any).suspect?0.6:1 }}>
                <span>{p.name} {(p as any).ready?"✓":""} {(p as any).suspect?"👻":""} {p.name===me?.username?`· nitro ${nitro}/9`: (p.nitro!==undefined?`· nitro ${p.nitro}/9`: p.volcano!==undefined?`· nitro ${p.volcano}/9`:"")}</span><span style={{ fontWeight: 700 }}>{p.score.toFixed(2)}</span>
              </div>
            ))}
            {duelRoom.state === "finished" && <div style={{ marginTop: 8, color: "#7cff7c" }}>Финиш! Результаты в magnum_leaderboard (duel42) + ELO · Конфетти 160 🎉</div>}
          </div>
        ) : <div style={{ opacity: 0.5, fontSize: 13 }}>{duelConnected ? "Ждём игроков…" : "Нажми «Войти в дуэль» — найдём комнату 2–4 братух."}</div>}
        {duelLb.length>0 && <div style={{marginTop:10, padding:10, borderRadius:10, border:"1px solid rgba(255,255,255,0.06)", background:"rgba(255,255,255,0.02)", fontSize:12}}><div style={{opacity:0.8, marginBottom:6}}>🏆 DUEL42 7дн · ELO · crown nitro</div>{duelLb.slice(0,5).map((r,i)=><div key={i} style={{display:"flex", justifyContent:"space-between"}}><span>{i+1}. {r.player}</span><span>{r.score}</span></div>)}</div>}
      </section>

      <section ref={boardRef} className={styles.board}>
        <h2 className={styles.sectionTitle}>ЛИДЕРБОРД <span>· ТОП ШАХТЁРОВ</span></h2>
        <div className={styles.boardList}>
          {board.length === 0 && <div style={{ opacity: 0.55, fontSize: 13, padding: "10px 4px" }}>Пока пусто — стань первым шахтёром в топе 🔥</div>}
          {board.map((e, i) => (
            <div key={e.name + i} className={styles.boardRow} style={cosmeticBannerStyle(e.banner)}>
              <span className={styles.boardRank}>#{i + 1}</span>
              <span className={styles.boardName}>
                <CosmeticIdentity username={e.name} avatar={e.avatar} frame={e.frame} title={e.title} verified={e.verified} size={24} />
              </span>
              <span className={styles.boardCoins}>{e.coins.toLocaleString("ru-RU")} 42</span>
              <span className={styles.boardDate}>{e.date}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}