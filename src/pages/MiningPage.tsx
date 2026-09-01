import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import styles from "./MiningPage.module.css";

/* ── types ─────────────────────────────── */
type Upgrade = {
  id: string;
  name: string;
  desc: string;
  icon: string;
  baseCost: number;
  power: number; // + per click
  auto: number; // per second
  count: number;
};

type BoardEntry = {
  name: string;
  coins: number;
  date: string;
};

const STORAGE_KEY = "magnum-coins-v1";
const BOARD_KEY = "magnum-mining-board-v1";

const UPGRADES_INIT: Upgrade[] = [
  { id: "shovel", name: "Лопата 42", desc: "+1 за клик · шахтёрский старт", icon: "🪓", baseCost: 42, power: 1, auto: 0, count: 0 },
  { id: "pick", name: "Кирка 142", desc: "+3 за клик · кузбасская закалка", icon: "⛏️", baseCost: 142, power: 3, auto: 0, count: 0 },
  { id: "drill", name: "Бур 420", desc: "+1/сек авто · гудит как Томь", icon: "🛢️", baseCost: 420, power: 0, auto: 1, count: 0 },
  { id: "truck", name: "БЕЛАЗ 1042", desc: "+5/сек авто · везёт весь Кузбасс", icon: "🚚", baseCost: 1042, power: 0, auto: 5, count: 0 },
  { id: "shaft", name: "Шахта 2042", desc: "+12/сек · бездна 42", icon: "🏗️", baseCost: 2042, power: 5, auto: 12, count: 0 },
];

const NICKNAMES = ["Братуха42", "Кузбасс_142", "Шахтёр", "Томь_42", "MAGNUM_топ", "42_навсегда", "Кемер_042", "Уголь_42"];
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

export function MiningPage() {
  const [coins, setCoins] = useState<number>(() => {
    try { const v = localStorage.getItem(STORAGE_KEY); if (v) return JSON.parse(v).coins ?? 0; } catch { /* */ }
    return 0;
  });
  const [totalMined, setTotalMined] = useState<number>(() => {
    try { const v = localStorage.getItem(STORAGE_KEY); if (v) return JSON.parse(v).totalMined ?? 0; } catch { /* */ }
    return 0;
  });
  const [clicks, setClicks] = useState<number>(() => {
    try { const v = localStorage.getItem(STORAGE_KEY); if (v) return JSON.parse(v).clicks ?? 0; } catch { /* */ }
    return 0;
  });
  const [upgrades, setUpgrades] = useState<Upgrade[]>(() => {
    try { const v = localStorage.getItem(STORAGE_KEY); if (v && v) { const p = JSON.parse(v); if (p.upgrades) return p.upgrades; } } catch { /* */ }
    return UPGRADES_INIT;
  });
  const [toast, setToast] = useState<string | null>(null);
  const [board, setBoard] = useState<BoardEntry[]>(() => {
    try { const v = localStorage.getItem(BOARD_KEY); if (v) return JSON.parse(v); } catch { /* */ }
    return BOARD_MOCK;
  });
  const [nick, setNick] = useState("Братуха_42");

  const rockRef = useRef<HTMLButtonElement>(null);
  const floatRootRef = useRef<HTMLDivElement>(null);
  const coinsRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const perClick = upgrades.reduce((s, u) => s + u.power * u.count, 1);
  const perSec = upgrades.reduce((s, u) => s + u.auto * u.count, 0);

  // persist
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ coins, totalMined, clicks, upgrades }));
  }, [coins, totalMined, clicks, upgrades]);
  useEffect(() => {
    localStorage.setItem(BOARD_KEY, JSON.stringify(board));
  }, [board]);

  // auto-mining tick
  useEffect(() => {
    if (perSec === 0) return;
    const id = window.setInterval(() => {
      setCoins((c) => c + perSec);
      setTotalMined((t) => t + perSec);
    }, 1000);
    return () => clearInterval(id);
  }, [perSec]);

  // GSAP entrance
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(`.${styles.heroTitle}`, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" });
      gsap.fromTo(`.${styles.statCard}`, { y: 16, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.07, duration: 0.5, ease: "power2.out", delay: 0.15 });
      gsap.fromTo(`.${styles.rockWrap}`, { scale: 0.92, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: "back.out(1.4)", delay: 0.3 });
      // idle float for rock
      if (rockRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.to(rockRef.current, { y: -4, duration: 1.6, repeat: -1, yoyo: true, ease: "sine.inOut" });
      }
    });
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
    setTotalMined((t) => t + val);
    setClicks((k) => k + 1);

    // GSAP punch
    if (rockRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.fromTo(rockRef.current, { scale: 0.94 }, { scale: 1, duration: 0.22, ease: "back.out(2)" });
      // particles burst
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
    // float +val
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    spawnFloat(val, e.clientX - rect.left, e.clientY - rect.top);

    // coins pulse
    if (coinsRef.current) gsap.fromTo(coinsRef.current, { scale: 1.06 }, { scale: 1, duration: 0.25, ease: "power2.out" });
  };

  const buy = (id: string) => {
    const idx = upgrades.findIndex((u) => u.id === id);
    if (idx === -1) return;
    const u = upgrades[idx];
    const price = costOf(u);
    if (coins < price) { showToast("Мало 42-коинов, братуха — покопай ещё"); return; }
    setCoins((c) => c - price);
    setUpgrades((prev) => prev.map((x) => x.id === id ? { ...x, count: x.count + 1 } : x));
    showToast(`Куплено: ${u.name} · −${price} 🪙`);
    if (boardRef.current) gsap.fromTo(boardRef.current, { scale: 0.998 }, { scale: 1, duration: 0.2 });
  };

  const saveToBoard = () => {
    const name = nick.trim() || "Братуха_42";
    const entry: BoardEntry = { name, coins: totalMined, date: new Date().toISOString().slice(0, 10) };
    setBoard((prev) => {
      const next = [...prev.filter((p) => p.name !== name), entry].sort((a, b) => b.coins - a.coins).slice(0, 20);
      return next;
    });
    showToast("Сохранено в лидерборд — респект, шахтёр!");
    // flash board
    if (boardRef.current) gsap.fromTo(boardRef.current, { y: 6, opacity: 0.9 }, { y: 0, opacity: 1, duration: 0.35, ease: "power2.out" });
  };

  const reset = () => {
    if (!confirm("Сбросить прогресс майнинга?")) return;
    setCoins(0); setTotalMined(0); setClicks(0); setUpgrades(UPGRADES_INIT);
    localStorage.removeItem(STORAGE_KEY);
    showToast("Прогресс сброшен — начинай заново, братуха");
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.badge}>⛏️ ИРОНИЧНЫЙ МАЙНИНГ · 42-COIN · КУЗБАСС EDITION</div>
        <h1 className={styles.heroTitle}>МАЙНИ 42-КОИНЫ<br /><span>КОПАЙ КАК ШАХТЁР</span></h1>
        <p className={styles.subtitle}>
          Кликер-дриг без крипты и без скама. Кликай по породе, покупай лопаты и кирки, включай авто-бур — и стань легендой Кузбасса.
          Всё хранится в <code>localStorage</code> — без бэкенда, по-братски.
        </p>
      </header>

      {toast && <div className={styles.toast} role="status">{toast}</div>}

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLbl}>Баланс</div>
          <div ref={coinsRef} className={styles.statVal}><span className={styles.coin}>◉</span> {coins.toLocaleString("ru-RU")} <small>42</small></div>
          <div className={styles.statHint}>magnum-coins</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLbl}>За клик</div>
          <div className={styles.statValAccent}>+{perClick} <small>42</small></div>
          <div className={styles.statHint}>{clicks.toLocaleString("ru-RU")} кликов</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLbl}>Авто / сек</div>
          <div className={styles.statValGreen}>+{perSec} <small>/с</small></div>
          <div className={styles.statHint}>всего намайнено {totalMined.toLocaleString("ru-RU")}</div>
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
          <p>💡 Совет братухи: купи <b>Лопату 42</b> за 42 — окупается за 42 клика. Кирка 142 — для трушных.</p>
          <div className={styles.digActions}>
            <input className={styles.nickInput} value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Твой ник" maxLength={18} aria-label="Ник для лидерборда" />
            <button className={styles.btnSave} onClick={saveToBoard}>В ЛИДЕРБОРД →</button>
            <button className={styles.btnGhost} onClick={reset}>Сброс</button>
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
              <div key={u.id} className={`${styles.shopCard} ${u.count > 0 ? styles.shopCardOwned : ""}`}>
                <div className={styles.shopIcon}>{u.icon}</div>
                <div className={styles.shopInfo}>
                  <div className={styles.shopName}>{u.name} {u.count > 0 && <span className={styles.countBadge}>×{u.count}</span>}</div>
                  <div className={styles.shopDesc}>{u.desc}</div>
                  <div className={styles.shopMeta}>
                    <span className={u.power ? styles.metaClick : styles.metaAuto}>{u.power ? `+${u.power}/клик` : `+${u.auto}/сек`}</span>
                    <span className={styles.metaPrice} data-can={canBuy ? "1" : "0"}>{price} 42</span>
                  </div>
                </div>
                <button className={styles.buyBtn} disabled={!canBuy} onClick={() => buy(u.id)}>{canBuy ? "КУПИТЬ" : "КОПИ"}</button>
              </div>
            );
          })}
        </div>
      </section>

      <section ref={boardRef} className={styles.board}>
        <div className={styles.boardHead}>
          <h2 className={styles.sectionTitle}>ЛИДЕРБОРД <span>· LOCALSTORAGE</span></h2>
          <span className={styles.boardHint}>топ шахтёров Кузбасса · сохраняется у тебя в браузере</span>
        </div>
        <div className={styles.boardTableWrap}>
          <table className={styles.boardTable}>
            <thead><tr><th>#</th><th>Братуха</th><th>Намайнено</th><th>Дата</th></tr></thead>
            <tbody>
              {board.map((row, i) => (
                <tr key={row.name + i} className={i < 3 ? styles.topRow : ""}>
                  <td className={styles.rankCell}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</td>
                  <td className={styles.nameCell}>{row.name} {row.name === nick.trim() ? <span className={styles.youBadge}>ты</span> : null}</td>
                  <td className={styles.coinsCell}>{row.coins.toLocaleString("ru-RU")} 42</td>
                  <td className={styles.dateCell}>{row.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.boardFoot}>
          <span>Ников в борде: {board.length} · твой тотал: {totalMined.toLocaleString("ru-RU")} · авто: {perSec}/с</span>
          <span className={styles.memeHint}>«копай пока горячо — скоро 42 подорожает» — батя с шахты</span>
        </div>
      </section>

      <div className={styles.disclaimer}>
        Ирония, братуха: это не крипта и не финсовет. 42-коин нельзя вывести, но можно уважать. Кузбасс одобряет. 🖤💛
      </div>
    </div>
  );
}
