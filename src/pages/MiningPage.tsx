import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./MiningPage.module.css";
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

const BOARD_MOCK: BoardEntry[] = [
  { name: "Шахтёр_42", coins: 42042, date: "2026-08-30" },
  { name: "Томь_братуха", coins: 28420, date: "2026-08-29" },
  { name: "42_легенда", coins: 19142, date: "2026-08-28" },
  { name: "Кузбасс_топ", coins: 12420, date: "2026-08-27" },
  { name: "БЕЛАЗ_драйвер", coins: 8842, date: "2026-08-27" },
  { name: "Уголь_магнат", coins: 6242, date: "2026-08-26" },
  { name: "Братуха_из_Кемерово", coins: 4204, date: "2026-08-25" },
  { name: "142_клика", coins: 3142, date: "2026-08-25" },
];

function costOf(u: Upgrade): number {
  return Math.floor(u.baseCost * Math.pow(1.42, u.count));
}

/* WS duel types */
type DuelPlayer = { name: string; score: number };
type DuelRoom = { id: string; state: "waiting" | "playing" | "finished"; players: DuelPlayer[]; durationSec: number };

export function MiningPage() {
  const [coins, setCoins] = useState<number>(0);
  const [upgrades, setUpgrades] = useState<Upgrade[]>(UPGRADES_INIT);
  const [toast, setToast] = useState<string | null>(null);
  const [board] = useState<BoardEntry[]>(BOARD_MOCK);
  const [nick, setNick] = useState("Братуха_42");
  const [loading, setLoading] = useState(true);

  // duel WS
  const [duelRoom, setDuelRoom] = useState<DuelRoom | null>(null);
  const [duelConnected, setDuelConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const rockRef = useRef<HTMLButtonElement>(null);
  const floatRootRef = useRef<HTMLDivElement>(null);
  const coinsRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  const perClick = upgrades.reduce((s, u) => s + u.power * u.count, 1);
  const perSec = upgrades.reduce((s, u) => s + u.auto * u.count, 0);

  // load from server: GET /magnum/api/mining
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

  // ---- WS duel ----
  const connectDuel = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${proto}//${window.location.host}/magnum/api/ws?username=${encodeURIComponent(nick.trim() || "Братуха_42")}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen = () => setDuelConnected(true);
    ws.onclose = () => setDuelConnected(false);
    ws.onerror = () => setDuelConnected(false);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as { type?: string; room?: DuelRoom; you?: string };
        if (msg.room) setDuelRoom(msg.room);
      } catch {}
    };
  }, [nick]);

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

      {/* WS duel 2-4 игрока */}
      <section className={styles.duelSection} style={{ marginTop: 32 }}>
        <h2 className={styles.sectionTitle}>ДУЭЛЬ 42 <span>· 2–4 БРАТУХИ · REALTIME WS</span></h2>
        <p style={{ opacity: 0.7, marginBottom: 12 }}>Комната на 2–4 игрока, кликер-дуэль 10 сек, broadcast scores, persist в magnum_leaderboard при финише.</p>
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          {!duelConnected ? <button className={styles.btnSave} onClick={connectDuel}>ВОЙТИ В ДУЭЛЬ →</button> : <button className={styles.btnGhost} onClick={disconnectDuel}>ВЫЙТИ</button>}
          {duelConnected && duelRoom?.state === "waiting" && <button className={styles.btnSave} onClick={duelStart}>СТАРТ 10С</button>}
          {duelConnected && duelRoom?.state === "playing" && <button className={styles.rock} onClick={duelClick} style={{ padding: "12px 28px" }}>ЖМИ! 🔥</button>}
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