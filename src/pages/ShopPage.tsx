import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import styles from "./ShopPage.module.css";
import { getCoins, addCoins, subscribe } from "../lib/coins";

/* ── Редкости ─────────────────────────────────────────────── */

type Rarity = "common" | "rare" | "epic" | "legendary";

type RarityMeta = {
  label: string;
  price: number;
  color: string;
};

const RARITY_META: Record<Rarity, RarityMeta> = {
  common:    { label: "COMMON",    price: 42,   color: "#9aa4b2" },
  rare:      { label: "RARE",      price: 142,  color: "#5865f2" },
  epic:      { label: "EPIC",      price: 420,  color: "#9147ff" },
  legendary: { label: "LEGENDARY", price: 1420, color: "#ffcc00" },
};

/* ── 12 скинов ────────────────────────────────────────────── */

type Skin = {
  id: string;
  name: string;
  emoji: string;
  rarity: Rarity;
  bg: string; // CSS-градиент
  tagline: string;
};

const SKINS: Skin[] = [
  { id: "mops",    name: "Мопс 42",     emoji: "🐗", rarity: "common",    bg: "linear-gradient(135deg,#d8a86f,#9a6b3a 55%,#3d2a18)", tagline: "Братуха с мягкими ушами" },
  { id: "rhino",   name: "Носорог 42",  emoji: "🦏", rarity: "common",    bg: "linear-gradient(135deg,#b8bcc4,#6f757f 55%,#2e3238)", tagline: "Броня по-магнумовски" },
  { id: "monkey",  name: "Обезьяна 42", emoji: "🐵", rarity: "common",    bg: "linear-gradient(135deg,#c98f4e,#8f5a24 55%,#422711)", tagline: "42 банана — норм старт" },
  { id: "frog",    name: "Лягуха 42",   emoji: "🐸", rarity: "common",    bg: "linear-gradient(135deg,#8fe06a,#3f9e3a 55%,#14401a)", tagline: "Сидит тихо, ждёт дроп" },
  { id: "panda",   name: "Панда 42",    emoji: "🐼", rarity: "rare",      bg: "linear-gradient(135deg,#f2f2f2,#8f8f8f 55%,#1c1c1c)", tagline: "Спит 42 часа в сутки" },
  { id: "fox",     name: "Лиса 42",     emoji: "🦊", rarity: "rare",      bg: "linear-gradient(135deg,#ffb14d,#e26a1e 55%,#7a2f08)", tagline: "Чует, где лежат монеты" },
  { id: "owl",     name: "Сова 42",     emoji: "🦉", rarity: "rare",      bg: "linear-gradient(135deg,#a98bd6,#6a4fa0 55%,#2c1e47)", tagline: "42 правила ночного стрима" },
  { id: "shark",   name: "Акула 42",    emoji: "🦈", rarity: "epic",      bg: "linear-gradient(135deg,#6fd8ff,#2b7fd4 55%,#0c2e57)", tagline: "Хищник чартов" },
  { id: "flamingo",name: "Фламинго 42", emoji: "🦩", rarity: "epic",      bg: "linear-gradient(135deg,#ff9ad5,#f0569b 55%,#7a1f4b)", tagline: "Розовый, но дерзкий" },
  { id: "wolf",    name: "Волк 42",     emoji: "🐺", rarity: "epic",      bg: "linear-gradient(135deg,#9fb3c8,#51677d 55%,#1c2733)", tagline: "Одинокий волк 42 квартала" },
  { id: "tiger",   name: "Тигр 42",     emoji: "🐯", rarity: "legendary", bg: "linear-gradient(135deg,#ffd76a,#ff9d1e 55%,#8a3c00)", tagline: "Легенда улиц, все братухи в курсе" },
  { id: "dragon",  name: "Дракон 42",   emoji: "🐉", rarity: "legendary", bg: "linear-gradient(135deg,#ff2d55,#8a1ecb 55%,#1b0a3a)", tagline: "Жжёт чарты как MAGNUM" },
];

/* ── Инвентарь (localStorage) ─────────────────────────────── */

const INV_KEY = "magnum-shop-inventory";
const EQUIPPED_KEY = "magnum-shop-equipped";

function loadInventory(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(INV_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveInventory(inv: string[]): void {
  try {
    localStorage.setItem(INV_KEY, JSON.stringify(inv));
  } catch {
    /* ignore */
  }
}

function loadEquipped(): string | null {
  try {
    return localStorage.getItem(EQUIPPED_KEY);
  } catch {
    return null;
  }
}

function saveEquipped(id: string | null): void {
  try {
    if (id) localStorage.setItem(EQUIPPED_KEY, id);
    else localStorage.removeItem(EQUIPPED_KEY);
  } catch {
    /* ignore */
  }
}

/* ── Компонент ────────────────────────────────────────────── */

type Toast = { id: number; kind: "ok" | "err"; text: string };

export function ShopPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const coinsRef = useRef<HTMLSpanElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  const [coins, setCoins] = useState(() => getCoins());
  const [inventory, setInventory] = useState<string[]>(() => loadInventory());
  const [equipped, setEquipped] = useState<string | null>(() => loadEquipped());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const shownCoins = useRef(getCoins());

  /* подписка на единый кошелёк */
  useEffect(() => {
    const unsub = subscribe((v) => setCoins(v));
    return unsub;
  }, []);

  /* анимация баланса при покупке (GSAP count-up) */
  useEffect(() => {
    const el = coinsRef.current;
    if (!el) return;
    const from = shownCoins.current;
    const to = coins;
    if (from === to) return;
    shownCoins.current = to;
    const proxy = { v: from };
    gsap.to(proxy, {
      v: to,
      duration: 0.7,
      ease: "power2.out",
      onUpdate: () => {
        if (coinsRef.current) coinsRef.current.textContent = String(Math.round(proxy.v));
      },
    });
    gsap.fromTo(
      el,
      { scale: 1.35, color: to >= from ? "#00ff88" : "#ff2d55" },
      { scale: 1, color: "#ffcc00", duration: 0.6, ease: "power2.out" },
    );
  }, [coins]);

  /* вход карточек */
  useEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.set(cardsRef.current, { y: 32, opacity: 0, scale: 0.96 });
      gsap.to(cardsRef.current, {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 0.55,
        stagger: 0.05,
        ease: "back.out(1.4)",
        delay: 0.1,
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  const pushToast = (kind: Toast["kind"], text: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, kind, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };

  const buy = (skin: Skin) => {
    const price = RARITY_META[skin.rarity].price;
    if (inventory.includes(skin.id)) return;
    if (coins < price) {
      pushToast("err", `Не хватает монет: нужно ${price}, у тебя ${coins}. Гони в Blackjack 42 или Рулетку — фарми до 4200!`);
      return;
    }
    addCoins(-price);
    const next = [...inventory, skin.id];
    setInventory(next);
    saveInventory(next);
    pushToast("ok", `${skin.name} куплен! Легенда в инвентаре.`);
  };

  const equip = (skin: Skin) => {
    setEquipped(skin.id);
    saveEquipped(skin.id);
    pushToast("ok", `${skin.name} надет. Братуха, ты красавчик.`);
  };

  const unequip = () => {
    setEquipped(null);
    saveEquipped(null);
    pushToast("ok", "Скин снят. Голый магнум — тоже стиль.");
  };

  const equippedSkin = useMemo(
    () => SKINS.find((s) => s.id === equipped) ?? null,
    [equipped],
  );

  const owned = (id: string) => inventory.includes(id);

  return (
    <div className={styles.shop} ref={rootRef}>
      {/* шапка */}
      <header className={styles.header}>
        <span className={styles.badge}>Магазин • Косметика 42</span>
        <h1 className={styles.title}>СКИНЫ ДЛЯ БРАТУХ</h1>
        <p className={styles.subtitle}>
          12 аватаров в стиле 42. Фармим монеты в играх — качаем лук.
        </p>
        <div className={styles.coinsRow} aria-live="polite">
          <span className={styles.coinIcon}>🪙</span>
          <span className={styles.coinsValue} ref={coinsRef}>{coins}</span>
          <span className={styles.coinsLabel}>монет</span>
        </div>
      </header>

      {/* тосты */}
      <div className={styles.toasts} role="status">
        {toasts.map((t) => (
          <div key={t.id} className={`${styles.toast} ${t.kind === "err" ? styles.toastErr : styles.toastOk}`}>
            {t.kind === "err" ? "💸 " : "✅ "}
            {t.text}
          </div>
        ))}
      </div>

      {/* текущий сетап */}
      <section className={styles.setup} aria-label="Текущий аватар">
        <div className={styles.avatarSlot}>
          {equippedSkin ? (
            <div
              className={styles.avatarFace}
              style={{ background: equippedSkin.bg }}
              data-rarity={equippedSkin.rarity}
            >
              <span className={styles.avatarEmoji}>{equippedSkin.emoji}</span>
            </div>
          ) : (
            <div className={`${styles.avatarFace} ${styles.avatarEmpty}`}>
              <span className={styles.avatarEmoji}>👤</span>
            </div>
          )}
          <span className={styles.slotLabel}>
            {equippedSkin ? equippedSkin.name : "Аватар не надет"}
          </span>
          {equippedSkin && (
            <button type="button" className={styles.btnGhost} onClick={unequip}>
              Снять скин
            </button>
          )}
        </div>

        {/* инвентарь */}
        <div className={styles.inventory}>
          <h2 className={styles.invTitle}>
            Инвентарь <span className={styles.invCount}>{inventory.length}/{SKINS.length}</span>
          </h2>
          {inventory.length === 0 ? (
            <p className={styles.invEmpty}>
              Пусто, как в кошельке до зарплаты. Купи первый скин ниже 👇
            </p>
          ) : (
            <div className={styles.invGrid}>
              {SKINS.filter((s) => owned(s.id)).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`${styles.invItem} ${equipped === s.id ? styles.invItemActive : ""}`}
                  style={{ ["--rc" as string]: RARITY_META[s.rarity].color }}
                  onClick={() => (equipped === s.id ? unequip() : equip(s))}
                  title={equipped === s.id ? "Снять" : "Надеть"}
                >
                  <span className={styles.invEmoji}>{s.emoji}</span>
                  <span className={styles.invName}>{s.name}</span>
                  {equipped === s.id && <span className={styles.invOn}>НАДЕТ</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* сетка магазина */}
      <section className={styles.grid} aria-label="Скины в продаже">
        {SKINS.map((skin, i) => {
          const meta = RARITY_META[skin.rarity];
          const isOwned = owned(skin.id);
          const canAfford = coins >= meta.price;
          return (
            <div
              key={skin.id}
              className={styles.card}
              ref={(el) => { cardsRef.current[i] = el; }}
              style={{ ["--rc" as string]: meta.color, ["--rg" as string]: meta.color }}
              data-rarity={skin.rarity}
            >
              <div className={styles.cardGlow} aria-hidden />
              <div className={styles.cardFace} style={{ background: skin.bg }}>
                <span className={styles.cardEmoji}>{skin.emoji}</span>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cardTop}>
                  <span className={styles.cardName}>{skin.name}</span>
                  <span
                    className={styles.rarityTag}
                    style={{ color: meta.color, borderColor: meta.color }}
                  >
                    {meta.label}
                  </span>
                </div>
                <p className={styles.cardTag}>{skin.tagline}</p>
                {isOwned ? (
                  equipped === skin.id ? (
                    <button type="button" className={styles.btnWear} onClick={unequip}>
                      ✅ Надет — снять
                    </button>
                  ) : (
                    <button type="button" className={styles.btnWear} onClick={() => equip(skin)}>
                      Надеть
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    className={`${styles.btnBuy} ${canAfford ? "" : styles.btnLocked}`}
                    onClick={() => buy(skin)}
                  >
                    🪙 {meta.price}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* футер-намёк */}
      <footer className={styles.footer}>
        <p className={styles.footerText}>
          Монеты кончились? 🎰 <Link to="/magnum/games" className={styles.footerLink}>Blackjack 42 и Рулетка ждут братуху</Link> — цель 4200.
        </p>
      </footer>
    </div>
  );
}

export default ShopPage;
