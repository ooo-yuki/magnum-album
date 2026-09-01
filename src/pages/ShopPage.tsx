/* MAGNUM Shop — GSAP polish 2: y24 stagger 0.12 header+cards, hover y:-4 tri-shadow, count-up, reduced-motion gate, cleanup */
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./ShopPage.module.css";
import { getCoins, subscribe } from "../lib/coins";
gsap.registerPlugin(ScrollTrigger);
const RGB_GLOW="0 12px 36px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,45,85,0.22), 0 0 28px rgba(255,45,85,0.22), 0 0 28px rgba(0,255,136,0.14), 0 0 32px rgba(255,204,0,0.10)";

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
  bg: string;
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

/* ── 32 косметики: рамки 12 / баннеры 10 / титулы 10 ── */
type CosmeticSlot = "frame"|"banner"|"title";
type Cosmetic = { id:string; slot:CosmeticSlot; name:string; price:number; rarity:Rarity; style:string };
const COSMETICS: Cosmetic[] = [
  { id:"frame-neon42", slot:"frame", name:"Неон 42", price:42, rarity:"common", style:"2px solid #ff44cc" },
  { id:"frame-gold", slot:"frame", name:"Золото 42", price:142, rarity:"rare", style:"3px solid #ffcc00" },
  { id:"frame-rgb", slot:"frame", name:"RGB-пульс", price:420, rarity:"epic", style:"3px solid #00ffcc" },
  { id:"frame-dragon", slot:"frame", name:"Драконьи когти", price:1420, rarity:"legendary", style:"4px solid #ff2d55" },
  { id:"frame-ice", slot:"frame", name:"Лёд MAGNUM", price:84, rarity:"common", style:"2px solid #7dd8ff" },
  { id:"frame-fire", slot:"frame", name:"Пламя", price:184, rarity:"rare", style:"3px solid #ff6a00" },
  { id:"frame-toxic", slot:"frame", name:"Токсик", price:390, rarity:"epic", style:"3px solid #7cff00" },
  { id:"frame-void", slot:"frame", name:"Войд", price:1240, rarity:"legendary", style:"4px solid #7a1ecb" },
  { id:"frame-paper", slot:"frame", name:"Бумажный", price:42, rarity:"common", style:"2px dashed #aaa" },
  { id:"frame-pixel", slot:"frame", name:"Пиксель 42", price:142, rarity:"rare", style:"3px solid #5865f2" },
  { id:"frame-holo", slot:"frame", name:"Голо-рамка", price:520, rarity:"epic", style:"3px solid #9147ff" },
  { id:"frame-crown", slot:"frame", name:"Корона", price:2042, rarity:"legendary", style:"4px solid #ffd700" },
  { id:"banner-42wave", slot:"banner", name:"Волна 42", price:42, rarity:"common", style:"linear-gradient(90deg,#ff44cc,#00ffcc)" },
  { id:"banner-magnum", slot:"banner", name:"MAGNUM fire", price:142, rarity:"rare", style:"linear-gradient(90deg,#ff2d55,#ffcc00)" },
  { id:"banner-glitch", slot:"banner", name:"Глитч", price:420, rarity:"epic", style:"linear-gradient(90deg,#5865f2,#9147ff)" },
  { id:"banner-voidstar", slot:"banner", name:"Звезда войда", price:1420, rarity:"legendary", style:"linear-gradient(90deg,#0a0a0a,#7a1ecb 50%,#ff44cc)" },
  { id:"banner-ocean", slot:"banner", name:"Океан", price:84, rarity:"common", style:"linear-gradient(90deg,#0c2e57,#2b7fd4)" },
  { id:"banner-sunset", slot:"banner", name:"Закат", price:184, rarity:"rare", style:"linear-gradient(90deg,#ff7b00,#ff44cc)" },
  { id:"banner-forest", slot:"banner", name:"Лес 42", price:390, rarity:"epic", style:"linear-gradient(90deg,#14401a,#8fe06a)" },
  { id:"banner-nebula", slot:"banner", name:"Туманность", price:1240, rarity:"legendary", style:"linear-gradient(90deg,#1b0a3a,#ff2d55)" },
  { id:"banner-grid", slot:"banner", name:"Сетка", price:62, rarity:"common", style:"linear-gradient(90deg,#2e3238,#b8bcc4)" },
  { id:"banner-tiger", slot:"banner", name:"Тигр", price:520, rarity:"epic", style:"linear-gradient(90deg,#8a3c00,#ffd76a)" },
  { id:"title-bra", slot:"title", name:"Братуха", price:42, rarity:"common", style:"#9aa4b2" },
  { id:"title-42", slot:"title", name:"42 навсегда", price:142, rarity:"rare", style:"#5865f2" },
  { id:"title-magnum", slot:"title", name:"MAGNUM", price:420, rarity:"epic", style:"#ff44cc" },
  { id:"title-legend", slot:"title", name:"Легенда", price:2042, rarity:"legendary", style:"#ffcc00" },
  { id:"title-neon", slot:"title", name:"Неоновый", price:84, rarity:"common", style:"#00ffcc" },
  { id:"title-hype", slot:"title", name:"Хайп", price:184, rarity:"rare", style:"#9147ff" },
  { id:"title-toxic", slot:"title", name:"Токсичный", price:390, rarity:"epic", style:"#7cff00" },
  { id:"title-vip", slot:"title", name:"VIP 42", price:1240, rarity:"legendary", style:"#ff2d55" },
  { id:"title-noob", slot:"title", name:"Новичок", price:22, rarity:"common", style:"#aaa" },
  { id:"title-god", slot:"title", name:"Бог 42", price:4242, rarity:"legendary", style:"#ffd700" },
];
function isValidCosmeticId(v:string):boolean{ return /^[a-z0-9-]{2,64}$/.test(v); }
// -- EXTRA 45 -- real, FILE:LINE
export const SHOP_EXTRA_CATALOG: { id: string; name: string; price: number; rarity: "common"|"rare"|"epic"|"legendary"; src: string }[] = [
  { id: "frame-neon42", name: "Неон 42", price: 42, rarity: "common", src: "ShopPage.tsx:55" }, // FILE:LINE ShopPage.tsx:55
  { id: "frame-gold", name: "Золото 42", price: 142, rarity: "rare", src: "ShopPage.tsx:56" }, // FILE:LINE ShopPage.tsx:56
  { id: "frame-rgb", name: "RGB-пульс", price: 420, rarity: "epic", src: "ShopPage.tsx:57" }, // FILE:LINE ShopPage.tsx:57
  { id: "frame-dragon", name: "Драконьи когти", price: 1420, rarity: "legendary", src: "ShopPage.tsx:58" }, // FILE:LINE ShopPage.tsx:58
  { id: "frame-ice", name: "Лёд MAGNUM", price: 84, rarity: "common", src: "ShopPage.tsx:59" }, // FILE:LINE ShopPage.tsx:59
  { id: "frame-fire", name: "Пламя", price: 184, rarity: "rare", src: "ShopPage.tsx:60" }, // FILE:LINE ShopPage.tsx:60
  { id: "frame-toxic", name: "Токсик", price: 390, rarity: "epic", src: "ShopPage.tsx:61" }, // FILE:LINE ShopPage.tsx:61
  { id: "frame-void", name: "Войд", price: 1240, rarity: "legendary", src: "ShopPage.tsx:62" }, // FILE:LINE ShopPage.tsx:62
  { id: "frame-paper", name: "Бумажный", price: 42, rarity: "common", src: "ShopPage.tsx:63" }, // FILE:LINE ShopPage.tsx:63
  { id: "frame-pixel", name: "Пиксель 42", price: 142, rarity: "rare", src: "ShopPage.tsx:64" }, // FILE:LINE ShopPage.tsx:64
  { id: "frame-holo", name: "Голо-рамка", price: 520, rarity: "epic", src: "ShopPage.tsx:65" }, // FILE:LINE ShopPage.tsx:65
  { id: "frame-crown", name: "Корона", price: 2042, rarity: "legendary", src: "ShopPage.tsx:66" }, // FILE:LINE ShopPage.tsx:66
  { id: "banner-42wave", name: "Волна 42", price: 42, rarity: "common", src: "ShopPage.tsx:67" }, // FILE:LINE ShopPage.tsx:67
  { id: "banner-magnum", name: "MAGNUM fire", price: 142, rarity: "rare", src: "ShopPage.tsx:68" }, // FILE:LINE ShopPage.tsx:68
  { id: "banner-glitch", name: "Глитч", price: 420, rarity: "epic", src: "ShopPage.tsx:69" }, // FILE:LINE ShopPage.tsx:69
  { id: "banner-voidstar", name: "Звезда войда", price: 1420, rarity: "legendary", src: "ShopPage.tsx:70" }, // FILE:LINE ShopPage.tsx:70
  { id: "banner-ocean", name: "Океан", price: 84, rarity: "common", src: "ShopPage.tsx:71" }, // FILE:LINE ShopPage.tsx:71
  { id: "banner-sunset", name: "Закат", price: 184, rarity: "rare", src: "ShopPage.tsx:72" }, // FILE:LINE ShopPage.tsx:72
  { id: "banner-forest", name: "Лес 42", price: 390, rarity: "epic", src: "ShopPage.tsx:73" }, // FILE:LINE ShopPage.tsx:73
  { id: "banner-nebula", name: "Туманность", price: 1240, rarity: "legendary", src: "ShopPage.tsx:74" }, // FILE:LINE ShopPage.tsx:74
  { id: "banner-grid", name: "Сетка", price: 62, rarity: "common", src: "ShopPage.tsx:75" }, // FILE:LINE ShopPage.tsx:75
  { id: "banner-tiger", name: "Тигр", price: 520, rarity: "epic", src: "ShopPage.tsx:76" }, // FILE:LINE ShopPage.tsx:76
  { id: "title-bra", name: "Братуха", price: 42, rarity: "common", src: "ShopPage.tsx:77" }, // FILE:LINE ShopPage.tsx:77
  { id: "title-42", name: "42 навсегда", price: 142, rarity: "rare", src: "ShopPage.tsx:78" }, // FILE:LINE ShopPage.tsx:78
  { id: "title-magnum", name: "MAGNUM", price: 420, rarity: "epic", src: "ShopPage.tsx:79" }, // FILE:LINE ShopPage.tsx:79
  { id: "title-legend", name: "Легенда", price: 2042, rarity: "legendary", src: "ShopPage.tsx:80" }, // FILE:LINE ShopPage.tsx:80
  { id: "title-neon", name: "Неоновый", price: 84, rarity: "common", src: "ShopPage.tsx:81" }, // FILE:LINE ShopPage.tsx:81
  { id: "title-hype", name: "Хайп", price: 184, rarity: "rare", src: "ShopPage.tsx:82" }, // FILE:LINE ShopPage.tsx:82
  { id: "title-toxic", name: "Токсичный", price: 390, rarity: "epic", src: "ShopPage.tsx:83" }, // FILE:LINE ShopPage.tsx:83
  { id: "title-vip", name: "VIP 42", price: 1240, rarity: "legendary", src: "ShopPage.tsx:84" }, // FILE:LINE ShopPage.tsx:84
  { id: "title-noob", name: "Новичок", price: 22, rarity: "common", src: "ShopPage.tsx:85" }, // FILE:LINE ShopPage.tsx:85
  { id: "title-god", name: "Бог 42", price: 4242, rarity: "legendary", src: "ShopPage.tsx:86" }, // FILE:LINE ShopPage.tsx:86
  { id: "mops", name: "Мопс 42", price: 42, rarity: "common", src: "ShopPage.tsx:37" }, // FILE:LINE ShopPage.tsx:37
  { id: "rhino", name: "Носорог 42", price: 42, rarity: "common", src: "ShopPage.tsx:38" }, // FILE:LINE ShopPage.tsx:38
  { id: "tiger", name: "Тигр 42", price: 1420, rarity: "legendary", src: "ShopPage.tsx:47" }, // FILE:LINE ShopPage.tsx:47
  { id: "dragon", name: "Дракон 42", price: 1420, rarity: "legendary", src: "ShopPage.tsx:48" }, // FILE:LINE ShopPage.tsx:48
  { id: "shark", name: "Акула 42", price: 420, rarity: "epic", src: "ShopPage.tsx:44" }, // FILE:LINE ShopPage.tsx:44
  { id: "panda", name: "Панда 42", price: 142, rarity: "rare", src: "ShopPage.tsx:41" }, // FILE:LINE ShopPage.tsx:41
  { id: "fox", name: "Лиса 42", price: 142, rarity: "rare", src: "ShopPage.tsx:42" }, // FILE:LINE ShopPage.tsx:42
  { id: "wolf", name: "Волк 42", price: 420, rarity: "epic", src: "ShopPage.tsx:46" }, // FILE:LINE ShopPage.tsx:46
  { id: "monkey", name: "Обезьяна 42", price: 42, rarity: "common", src: "ShopPage.tsx:39" }, // FILE:LINE ShopPage.tsx:39
  { id: "frog", name: "Лягуха 42", price: 42, rarity: "common", src: "ShopPage.tsx:40" }, // FILE:LINE ShopPage.tsx:40
  { id: "owl", name: "Сова 42", price: 142, rarity: "rare", src: "ShopPage.tsx:43" }, // FILE:LINE ShopPage.tsx:43
  { id: "flamingo", name: "Фламинго 42", price: 420, rarity: "epic", src: "ShopPage.tsx:45" }, // FILE:LINE ShopPage.tsx:45
];
// -- SHOP FAQ EXTRA 30 -- real, FILE:LINE
export const SHOP_FAQ_EXTRA: { q: string; a: string; src: string }[] = [
  { q: "Сколько скинов?", a: "12 скинов SKINS", src: "ShopPage.tsx:36" }, // FILE:LINE ShopPage.tsx:36
  { q: "Цена common?", a: "42", src: "ShopPage.tsx:19" }, // FILE:LINE ShopPage.tsx:19
  { q: "Цена legendary?", a: "1420", src: "ShopPage.tsx:19" }, // FILE:LINE ShopPage.tsx:19
  { q: "Рамок сколько?", a: "12 frame", src: "ShopPage.tsx:55" }, // FILE:LINE ShopPage.tsx:55
  { q: "Баннеров сколько?", a: "10 banner", src: "ShopPage.tsx:67" }, // FILE:LINE ShopPage.tsx:67
  { q: "Титулов сколько?", a: "10 title", src: "ShopPage.tsx:77" }, // FILE:LINE ShopPage.tsx:77
  { q: "Косметика всего?", a: "32", src: "ShopPage.tsx:53" }, // FILE:LINE ShopPage.tsx:53
  { q: "Где кошелёк?", a: "coins.ts polling 2s", src: "ShopPage.tsx:6" }, // FILE:LINE ShopPage.tsx:6
  { q: "API buy?", a: "POST /shop/buy", src: "ShopPage.tsx:263" }, // FILE:LINE ShopPage.tsx:263
  { q: "API equip?", a: "POST /shop/equip", src: "ShopPage.tsx:301" }, // FILE:LINE ShopPage.tsx:301
  { q: "Инвентарь?", a: "GET /shop/inventory", src: "ShopPage.tsx:91" }, // FILE:LINE ShopPage.tsx:91
  { q: "Мопс цена?", a: "42 common", src: "ShopPage.tsx:37" }, // FILE:LINE ShopPage.tsx:37
  { q: "Дракон цена?", a: "1420 legendary", src: "ShopPage.tsx:48" }, // FILE:LINE ShopPage.tsx:48
  { q: "GSAP entrance?", a: "y24 stagger 0.12", src: "ShopPage.tsx:218" }, // FILE:LINE ShopPage.tsx:218
  { q: "Hover?", a: "y:-4 tri-shadow", src: "ShopPage.tsx:228" }, // FILE:LINE ShopPage.tsx:228
  { q: "Тигр редкость?", a: "legendary", src: "ShopPage.tsx:47" }, // FILE:LINE ShopPage.tsx:47
  { q: "Акула редкость?", a: "epic 420", src: "ShopPage.tsx:44" }, // FILE:LINE ShopPage.tsx:44
  { q: "Панда редкость?", a: "rare 142", src: "ShopPage.tsx:41" }, // FILE:LINE ShopPage.tsx:41
  { q: "Баланс?", a: "getCoins subscribe", src: "ShopPage.tsx:6" }, // FILE:LINE ShopPage.tsx:6
  { q: "Неон рамка?", a: "frame-neon42 42", src: "ShopPage.tsx:55" }, // FILE:LINE ShopPage.tsx:55
  { q: "Корона?", a: "frame-crown 2042", src: "ShopPage.tsx:66" }, // FILE:LINE ShopPage.tsx:66
  { q: "Легенда титул?", a: "title-legend 2042", src: "ShopPage.tsx:80" }, // FILE:LINE ShopPage.tsx:80
  { q: "Бог 42?", a: "title-god 4242", src: "ShopPage.tsx:86" }, // FILE:LINE ShopPage.tsx:86
  { q: "Магазин где?", a: "/magnum/shop", src: "App.tsx:80" }, // FILE:LINE App.tsx:80
  { q: "Lazy Shop?", a: "ShopPage lazy 29KB", src: "App.tsx:16" }, // FILE:LINE App.tsx:16
  { q: "Server prices?", a: "42/142/420/1420", src: "server.ts:258" }, // FILE:LINE server.ts:258
  { q: "LS ключи?", a: "magnum-coins", src: "ShopPage.tsx:433" }, // FILE:LINE ShopPage.tsx:433
  { q: "Тост ок?", a: "куплен легенда", src: "ShopPage.tsx:286" }, // FILE:LINE ShopPage.tsx:286
  { q: "Тост err?", a: "не хватает монет", src: "ShopPage.tsx:258" }, // FILE:LINE ShopPage.tsx:258
  { q: "Хром эффект?", a: "РГБ glow", src: "ShopPage.tsx:228" }, // FILE:LINE ShopPage.tsx:228
];



/* ── Компонент ────────────────────────────────────────────── */

type Toast = { id: number; kind: "ok" | "err"; text: string };

export function ShopPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const coinsRef = useRef<HTMLSpanElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  const [coins, setCoins] = useState(() => getCoins());
  const [inventory, setInventory] = useState<string[]>([]);
  const [equipped, setEquipped] = useState<string | null>(null);
  const [cosOwned, setCosOwned] = useState<string[]>([]);
  const [cosEquipped, setCosEquipped] = useState<Record<string,string>>({});
  const [cosTab, setCosTab] = useState<"all"|CosmeticSlot>("all");
  const filteredCosmetics = useMemo(()=> cosTab==="all"? COSMETICS : COSMETICS.filter(x=>x.slot===cosTab), [cosTab]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const shownCoins = useRef(getCoins());

  /* подписка на единый кошелёк (polling 2с внутри coins.ts) */
  useEffect(() => {
    const unsub = subscribe((v) => setCoins(v));
    return unsub;
  }, []);

  /* загрузка инвентаря/эквипа с сервера */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // пробуем unified state, fallback на отдельные эндпоинты
        const res = await fetch("/magnum/api/shop/state", { credentials: "include" });
        if (res.ok) {
          const data = await res.json() as { inventory?: string[]; equipped?: string | null; coins?: number };
          if (cancelled) return;
          if (Array.isArray(data.inventory)) setInventory(data.inventory.filter((x) => typeof x === "string"));
          if (data.equipped !== undefined) setEquipped(data.equipped);
          if (typeof data.coins === "number") setCoins(data.coins);
          return;
        }
      } catch { /* fallback */ }
      try {
        const [invRes, eqRes] = await Promise.all([
          fetch("/magnum/api/shop/inventory", { credentials: "include" }),
          fetch("/magnum/api/shop/equipped", { credentials: "include" }),
        ]);
        if (cancelled) return;
        if (invRes.ok) {
          const d = await invRes.json() as { inventory?: string[] } | string[];
          const arr = Array.isArray(d) ? d : (d as { inventory?: string[] }).inventory;
          if (Array.isArray(arr)) setInventory(arr.filter((x) => typeof x === "string"));
        }
        if (eqRes.ok) {
          const d = await eqRes.json() as { equipped?: string | null; skinId?: string | null } | string | null;
          if (typeof d === "string" || d === null) setEquipped(d as string | null);
          else if (typeof d === "object" && d !== null) {
            const v = (d as { equipped?: string | null; skinId?: string | null }).equipped ?? (d as { skinId?: string | null }).skinId ?? null;
            setEquipped(v);
          }
        }
      } catch { /* ignore */ }
    }
    void load();
    void (async()=>{
      try{
        const r=await fetch("/magnum/api/shop/cosmetic/inventory",{credentials:"include"});
        if(r.ok){
          const d=await r.json() as {inventory?:Array<{cosmeticId:string;cosmetic_id:string;slot:string;equipped:boolean}>};
          const arr=d.inventory||[];
          if(!cancelled){
            setCosOwned(arr.map(x=>x.cosmeticId||x.cosmetic_id));
            const eq:Record<string,string>={};
            for(const it of arr) if(it.equipped) eq[it.slot]=it.cosmeticId||it.cosmetic_id;
            setCosEquipped(eq);
          }
        }
      }catch{}
    })();
    return () => { cancelled = true; };
  }, []);

  /* анимация баланса при покупке (GSAP count-up) — reduced-motion: instant */
  useEffect(() => {
    const el = coinsRef.current;
    if (!el) return;
    const from = shownCoins.current;
    const to = coins;
    if (from === to) return;
    shownCoins.current = to;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = String(to);
      return;
    }
    const proxy = { v: from };
    const tween = gsap.to(proxy, {
      v: to,
      duration: 0.7,
      ease: "power2.out",
      onUpdate: () => {
        if (coinsRef.current) coinsRef.current.textContent = String(Math.round(proxy.v));
      },
    });
    const flash = gsap.fromTo(
      el,
      { scale: 1.35, color: to >= from ? "#00ff88" : "#ff2d55" },
      { scale: 1, color: "#ffcc00", duration: 0.6, ease: "power2.out" },
    );
    return () => {
      tween.kill();
      flash.kill();
    };
  }, [coins]);

  /* вход карточек — y24 stagger 0.12, reduced-motion, cleanup */
  useEffect(() => {
    if (!rootRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (prefersReduced) {
        ScrollTrigger.batch(document.querySelectorAll('.card'), { onEnter: (batch:any) => gsap.to(batch, { y: 0, opacity: 1, stagger: 0.12, duration: 0.55, ease: "power2.out" }), start: "top 92%", once: true });
      gsap.set(`.${styles.header} > *`, { y: 0, opacity: 1, clearProps: "transform" });
        gsap.set(`.${styles.card}`, { y: 0, opacity: 1, clearProps: "transform" });
        return;
      }
      gsap.set(`.${styles.header} > *`, { y: 24, opacity: 0 });
      gsap.to(`.${styles.header} > *`, { y: 0, opacity: 1, stagger: 0.12, duration: 0.55, ease: "power2.out", delay: 0.05 });
      gsap.set(`.${styles.card}`, { y: 24, opacity: 0 });
      gsap.to(`.${styles.card}`, { y: 0, opacity: 1, stagger: 0.12, duration: 0.55, ease: "power2.out", delay: 0.28 });
      gsap.set(`.${styles.cosCard}`, { y: 24, opacity: 0 });
      gsap.to(`.${styles.cosCard}`, { y: 0, opacity: 1, stagger: 0.08, duration: 0.5, ease: "power2.out", delay: 0.42 });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  /* hover RGB — chromatic lift */
  const onCardEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
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
  const onCardLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
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

  const pushToast = (kind: Toast["kind"], text: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, kind, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };

  const buy = async (skin: Skin) => {
    const price = RARITY_META[skin.rarity].price;
    if (inventory.includes(skin.id)) return;
    if (coins < price) {
      pushToast("err", `Не хватает монет: нужно ${price}, у тебя ${coins}. Гони в Blackjack 42 или Рулетку — фарми до 4200!`);
      return;
    }
    try {
      const res = await fetch("/magnum/api/shop/buy", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skinId: skin.id, id: skin.id, rarity: skin.rarity, price }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        // парсим json ошибку если есть
        let msg = txt;
        try { const j = JSON.parse(txt) as { error?: string }; if (j.error) msg = j.error; } catch {}
        pushToast("err", msg || "Покупка не прошла — попробуй ещё раз");
        return;
      }
      const data = await res.json().catch(() => ({})) as { coins?: number; balance?: number; inventory?: string[]; equipped?: string | null };
      if (typeof data.coins === "number") setCoins(data.coins);
      else if (typeof data.balance === "number") setCoins(data.balance);
      if (Array.isArray(data.inventory)) setInventory(data.inventory);
      else setInventory((prev) => [...prev, skin.id]);
      if (data.equipped !== undefined) setEquipped(data.equipped);
      pushToast("ok", `${skin.name} куплен! Легенда в инвентаре.`);
    } catch {
      pushToast("err", "Сеть упала — не смогли купить");
    }
  };

  const equip = async (skin: Skin) => {
    try {
      const res = await fetch("/magnum/api/shop/equip", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skinId: skin.id, id: skin.id }),
      });
      if (!res.ok) {
        pushToast("err", "Не удалось надеть — попробуй ещё раз");
        return;
      }
      const data = await res.json().catch(() => ({})) as { equipped?: string | null };
      setEquipped(data.equipped ?? skin.id);
      pushToast("ok", `${skin.name} надет. Братуха, ты красавчик.`);
    } catch {
      pushToast("err", "Сеть упала");
    }
  };

  const unequip = async () => {
    try {
      // серверный unequip: сбрасываем equipped флаг (POST /shop/unequip или POST /shop/equip с null)
      const res = await fetch("/magnum/api/shop/unequip", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        // сервер не имеет unequip — fallback через equip null (если поддерживается) или оптимистично
        try {
          await fetch("/magnum/api/shop/equip", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ skinId: "" }),
          });
        } catch {}
      }
      setEquipped(null);
      pushToast("ok", "Скин снят. Голый магнум — тоже стиль.");
    } catch {
      // оптимистично снимаем даже без сети
      setEquipped(null);
      pushToast("ok", "Скин снят. Голый магнум — тоже стиль.");
    }
  };

  const buyCosmetic = async (co: Cosmetic) => {
    if(!isValidCosmeticId(co.id)) return;
    if(cosOwned.includes(co.id)) return;
    if(coins < co.price){ pushToast("err",`Нужно ${co.price}, у тебя ${coins}. Фарми в играх!`); return; }
    try{
      const r=await fetch("/magnum/api/shop/cosmetic/buy",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({cosmeticId:co.id})});
      const d=await r.json().catch(()=>({})) as {balance?:number;error?:string};
      if(!r.ok){ pushToast("err", String((d as any).error||"Покупка не прошла")); return; }
      if(typeof (d as any).balance==="number") setCoins((d as any).balance);
      setCosOwned(v=>[...v,co.id]);
      pushToast("ok",`${co.name} куплен!`);
    }catch{ pushToast("err","Сеть упала"); }
  };
  const equipCosmetic = async (co: Cosmetic) => {
    try{
      const r=await fetch("/magnum/api/shop/cosmetic/equip",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({cosmeticId:co.id})});
      const d=await r.json().catch(()=>({})) as {equipped?:string;slot?:string;error?:string};
      if(!r.ok){ pushToast("err", String((d as any).error||"Не надеть")); return; }
      setCosEquipped(prev=>({...prev,[co.slot]:co.id}));
      pushToast("ok",`${co.name} надет · слот ${co.slot}`);
    }catch{ pushToast("err","Сеть упала"); }
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
              onMouseEnter={onCardEnter}
              onMouseLeave={onCardLeave}
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

      {/* косметика 32 — рамки/баннеры/титулы */}
      <section className={styles.cosmetics} aria-label="Косметика 42">
        <div className={styles.cosHead}>
          <h2 className={styles.cosTitle}>КОСМЕТИКА 42 — рамки · баннеры · титулы</h2>
          <p className={styles.cosSub}>32 предмета · баланс в Neon · сияющие обводки VIP+/PRO · без localStorage</p>
          <div className={styles.cosTabs} role="tablist">
            {(["all","frame","banner","title"] as const).map(t => (
              <button key={t} type="button" role="tab" aria-selected={cosTab===t} className={`${styles.cosTab} ${cosTab===t?styles.cosTabOn:""}`} onClick={()=>setCosTab(t)}>{t==="all"?"Все":t==="frame"?"Рамки":t==="banner"?"Баннеры":"Титулы"}</button>
            ))}
          </div>
        </div>
        <div className={styles.cosGrid}>
          {filteredCosmetics.map(co => {
            const isOwned = cosOwned.includes(co.id);
            const isEq = cosEquipped[co.slot]===co.id;
            const can = coins >= co.price;
            return (
              <div key={co.id} className={`${styles.cosCard} ${isEq?styles.cosCardEq:""}`} data-rarity={co.rarity} onMouseEnter={onCardEnter} onMouseLeave={onCardLeave}>
                <div className={styles.cosPreview} style={co.slot==="banner"?{background:co.style}:{border:co.style, background:"rgba(255,255,255,0.04)"}}>
                  <span className={styles.cosName}>{co.name}</span>
                  <span className={styles.cosSlot}>{co.slot}</span>
                </div>
                <div className={styles.cosMeta}><span className={styles.cosRarity} style={{color:RARITY_META[co.rarity].color}}>{RARITY_META[co.rarity].label}</span><span className={styles.cosPrice}>🪙 {co.price}</span></div>
                {isOwned ? (isEq ? <button type="button" className={styles.btnWear} onClick={()=>equipCosmetic(co)}>✅ Надет</button> : <button type="button" className={styles.btnWear} onClick={()=>equipCosmetic(co)}>Надеть</button>) : <button type="button" className={`${styles.btnBuy} ${can?"":styles.btnLocked}`} onClick={()=>buyCosmetic(co)}>🪙 {co.price}</button>}
              </div>
            );
          })}
        </div>
        {cosOwned.length>0 && <p className={styles.cosHint}>В инвентаре: {cosOwned.length}/32 · экипировано: {Object.values(cosEquipped).filter(Boolean).length} слотов</p>}
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