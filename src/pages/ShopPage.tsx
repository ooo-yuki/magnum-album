
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./ShopPage.module.css";
import { getCoins, subscribe } from "../lib/coins";
import { AuthStatus } from "../components/AuthStatus";
import { GLACIER_CATALOG, GLACIER, GLACIER_IDS_SET, GLACIER_IDS, PRISM_CATALOG, PRISM_IDS_SET, PRISM_IDS, CRYSTAL_CATALOG, CRYSTAL_IDS_SET, CRYSTAL_IDS, VOLCANO_CATALOG, VOLCANO_IDS_SET, VOLCANO_IDS, OBSIDIAN_CATALOG, OBSIDIAN_IDS_SET, OBSIDIAN_IDS, FORGE_CATALOG, FORGE_IDS_SET, FORGE_IDS, COSMETICS_CATALOG } from "../lib/cosmetics";
import { SKINS as SHOP_CATALOG_SKINS, RARITY_META as SHOP_RARITY_META, type Skin as ShopSkin, type Rarity as ShopRarity } from "../lib/shopCatalog";
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
  { id:"frame-void", slot:"frame", name:"Войд", price:1420, rarity:"legendary", style:"4px solid #7a1ecb" },
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
  { id:"banner-nebula", slot:"banner", name:"Туманность", price:1420, rarity:"legendary", style:"linear-gradient(90deg,#1b0a3a,#ff2d55)" },
  { id:"banner-grid", slot:"banner", name:"Сетка", price:62, rarity:"common", style:"linear-gradient(90deg,#2e3238,#b8bcc4)" },
  { id:"banner-tiger", slot:"banner", name:"Тигр", price:520, rarity:"epic", style:"linear-gradient(90deg,#8a3c00,#ffd76a)" },
  { id:"title-bra", slot:"title", name:"Братуха", price:42, rarity:"common", style:"#9aa4b2" },
  { id:"title-42", slot:"title", name:"42 навсегда", price:142, rarity:"rare", style:"#5865f2" },
  { id:"title-magnum", slot:"title", name:"MAGNUM", price:420, rarity:"epic", style:"#ff44cc" },
  { id:"title-legend", slot:"title", name:"Легенда", price:2042, rarity:"legendary", style:"#ffcc00" },
  { id:"title-neon", slot:"title", name:"Неоновый", price:84, rarity:"common", style:"#00ffcc" },
  { id:"title-hype", slot:"title", name:"Хайп", price:184, rarity:"rare", style:"#9147ff" },
  { id:"title-toxic", slot:"title", name:"Токсичный", price:390, rarity:"epic", style:"#7cff00" },
  { id:"title-vip", slot:"title", name:"VIP 42", price:1420, rarity:"legendary", style:"#ff2d55" },
  { id:"title-noob", slot:"title", name:"Новичок", price:22, rarity:"common", style:"#aaa" },
  { id:"title-god", slot:"title", name:"Бог 42", price:4242, rarity:"legendary", style:"#ffd700" },
  { id:"frame-prism-rose", slot:"frame", name:"Призма Роза", price:42, rarity:"common", style:"conic-gradient(from 0deg,#ff44cc,#ffcc00,#00ffcc,#5865f2,#ff44cc)" },
  { id:"frame-prism-ice", slot:"frame", name:"Призма Лёд", price:142, rarity:"rare", style:"conic-gradient(from 45deg,#7dd8ff,#00ffcc,#9147ff,#7dd8ff)" },
  { id:"frame-prism-toxic", slot:"frame", name:"Призма Токсик", price:420, rarity:"epic", style:"conic-gradient(from 90deg,#7cff00,#00ffcc,#ffcc00,#7cff00)" },
  { id:"frame-prism-void", slot:"frame", name:"Призма Войд", price:1420, rarity:"legendary", style:"conic-gradient(from 180deg,#7a1ecb,#ff44cc,#0a0a0a,#7a1ecb)" },
  { id:"banner-prism-aurora", slot:"banner", name:"Аврора Призм", price:84, rarity:"common", style:"linear-gradient(90deg,#00ffcc,#5865f2 35%,#ff44cc 70%,#ffcc00)" },
  { id:"banner-prism-neon", slot:"banner", name:"Неон Призм", price:184, rarity:"rare", style:"linear-gradient(90deg,#ff44cc,#9147ff 40%,#00ffcc)" },
  { id:"banner-prism-sunset", slot:"banner", name:"Призм Закат", price:390, rarity:"epic", style:"linear-gradient(90deg,#ff7b00,#ff44cc 40%,#7a1ecb)" },
  { id:"banner-prism-abyss", slot:"banner", name:"Призм Бездна", price:1420, rarity:"legendary", style:"linear-gradient(90deg,#0a0a0a,#7a1ecb 30%,#ffcc00 70%,#ff44cc)" },
  { id:"title-prism-novice", slot:"title", name:"Призм Новичок", price:22, rarity:"common", style:"#7dd8ff" },
  { id:"title-prism-hype", slot:"title", name:"Призм Хайп", price:142, rarity:"rare", style:"#ff44cc" },
  { id:"title-prism-aurora", slot:"title", name:"Аврора", price:420, rarity:"epic", style:"#9147ff" },
  { id:"title-prism-legend", slot:"title", name:"Призм Легенда", price:2042, rarity:"legendary", style:"conic-gradient(from 0deg,#ffcc00,#ff44cc,#00ffcc,#ffcc00)" },
  { id:"frame-glacier-matte", slot:"frame", name:"Гляйшер Матт", price:42, rarity:"common", style:"2px solid #e0faff" },
  { id:"banner-snow-dust", slot:"banner", name:"Снежная Пыль", price:42, rarity:"common", style:"linear-gradient(90deg,#ffffff,#e0faff)" },
  { id:"title-ice-fence", slot:"title", name:"Ледяной Забор", price:42, rarity:"common", style:"#b8e6fe" },
  { id:"frame-siberia-frost", slot:"frame", name:"Сибирь Фрост", price:142, rarity:"rare", style:"3px solid #a5f3fc" },
  { id:"banner-tom-glacier", slot:"banner", name:"Том Гляйшер", price:142, rarity:"rare", style:"linear-gradient(90deg,#06b6d4,#0891b2)" },
  { id:"title-kuzbass-ice", slot:"title", name:"Кузбасс Лед", price:142, rarity:"rare", style:"#0e7490" },
  { id:"frame-meduza-glacier", slot:"frame", name:"Медуза Гляйшер", price:420, rarity:"epic", style:"conic-gradient(from 0deg,#a5f3fc,#06b6d4,#e0faff,#a5f3fc)" },
  { id:"banner-vpn-frost", slot:"banner", name:"ВПН Фрост", price:420, rarity:"epic", style:"linear-gradient(90deg,#e0faff,#06b6d4)" },
  { id:"title-nova-tundra", slot:"title", name:"Нова Тундра", price:420, rarity:"epic", style:"#7c3aed" },
  { id:"frame-gold-glacier-spin", slot:"frame", name:"Голд Гляйшер Спин", price:1420, rarity:"legendary", style:"conic-gradient(from 0deg,#e0faff,#06b6d4,#ffd700,#e0faff)" },
  { id:"banner-diamond-frost", slot:"banner", name:"Даймонд Фрост", price:1420, rarity:"legendary", style:"linear-gradient(90deg,#e0faff,#ffffff)" },
  { id:"title-rgb-glacier", slot:"title", name:"РГБ Гляйшер", price:1420, rarity:"legendary", style:"conic-gradient(from 0deg,#e0faff,#ff44cc,#00ffcc,#e0faff)" },
  { id:"frame-crystal-matte", slot:"frame", name:"Кристалл Матт", price:42, rarity:"common", style:"2px solid #e8f8ff" },
  { id:"banner-snow-quartz", slot:"banner", name:"Снежный Кварц", price:42, rarity:"common", style:"linear-gradient(90deg,#ffffff,#e8f0ff)" },
  { id:"title-crystal-fence", slot:"title", name:"Кристалл Забор", price:42, rarity:"common", style:"2px solid #b8e0ff" },
  { id:"frame-siberia-crystal", slot:"frame", name:"Сибирь Кристалл", price:142, rarity:"rare", style:"3px solid #a8e8ff" },
  { id:"banner-tom-quartz", slot:"banner", name:"Том Кварц", price:142, rarity:"rare", style:"linear-gradient(90deg,#38bdf8,#0ea5e9)" },
  { id:"title-taiga-crystal", slot:"title", name:"Тайга Кристалл", price:142, rarity:"rare", style:"#0e7490" },
  { id:"frame-meduza-crystal", slot:"frame", name:"Медуза Кристалл", price:420, rarity:"epic", style:"conic-gradient(from 0deg,#a8e8ff,#38bdf8,#e8f8ff,#a8e8ff)" },
  { id:"banner-vpn-quartz", slot:"banner", name:"ВПН Кварц", price:420, rarity:"epic", style:"linear-gradient(90deg,#e8f8ff,#38bdf8)" },
  { id:"title-nova-crystal", slot:"title", name:"Нова Кристалл", price:420, rarity:"epic", style:"conic-gradient(from 90deg,#7c3aed,#38bdf8)" },
  { id: "frame-gold-crystal-spin", slot: "frame", name: "Голд Кристалл Спин", price: 1420, rarity: "legendary", style: "conic-gradient(from 0deg,#e8f8ff,#38bdf8,#ffd700,#e8f8ff)" },
  { id: "banner-diamond-quartz", slot: "banner", name: "Даймонд Кварц", price: 1420, rarity: "legendary", style: "linear-gradient(90deg,#e8f8ff,#ffffff)" },
  { id: "title-rgb-crystal", slot: "title", name: "РГБ Кристалл", price: 1420, rarity: "legendary", style: "conic-gradient(from 0deg,#a8e8ff,#ff44cc,#00ffcc,#a8e8ff)" },
  { id: "frame-volcano-ash", slot: "frame", name: "Вулкан Пепел", price: 42, rarity: "common", style: "2px solid #ff5722" },
  { id: "banner-volcano-ash", slot: "banner", name: "Пепел Вулкана", price: 42, rarity: "common", style: "linear-gradient(90deg,#ff5722,#ff8a65)" },
  { id: "title-volcano-ash", slot: "title", name: "Пепельный", price: 42, rarity: "common", style: "#ff5722" },
  { id: "frame-volcano-lava", slot: "frame", name: "Вулкан Лава", price: 142, rarity: "rare", style: "3px solid #d32f2f" },
  { id: "banner-volcano-lava", slot: "banner", name: "Лава Вулкана", price: 142, rarity: "rare", style: "linear-gradient(90deg,#d32f2f,#ff5722)" },
  { id: "title-volcano-lava", slot: "title", name: "Лавовый", price: 142, rarity: "rare", style: "#d32f2f" },
  { id: "frame-volcano-eruption", slot: "frame", name: "Вулкан Извержение", price: 420, rarity: "epic", style: "conic-gradient(from 0deg,#ff5722,#ff8a65,#ff5722,#d32f2f,#ff5722)" },
  { id: "banner-volcano-eruption", slot: "banner", name: "Извержение", price: 420, rarity: "epic", style: "linear-gradient(90deg,#ff5722,#d32f2f)" },
  { id: "title-volcano-eruption", slot: "title", name: "Извергающий", price: 420, rarity: "epic", style: "#ff5722" },
  { id: "frame-volcano-gold-spin", slot: "frame", name: "Вулкан Голд Спин", price: 1420, rarity: "legendary", style: "conic-gradient(from 0deg,#ff5722,#ffcc00,#ffd700,#ff5722)" },
  { id: "banner-volcano-gold", slot: "banner", name: "Голд Вулкан", price: 1420, rarity: "legendary", style: "linear-gradient(90deg,#ff5722,#ffd700)" },
  { id: "title-volcano-gold", slot: "title", name: "Вулкан Голд", price: 1420, rarity: "legendary", style: "conic-gradient(from 0deg,#ff5722,#ffcc00,#ffd700,#ff5722)" },
  // ── OBSIDIAN FORGE 42 — 12 obsidian coal-dust 42 mine-shaft 142 meduza-obsidian 420 gold-obsidian-spin epic 1420 spin 3s molten ──
  { id: "frame-obsidian-coal", slot: "frame", name: "Обсидиан Уголь", price: 42, rarity: "common", style: "2px solid #1a1a1a" },
  { id: "banner-obsidian-dust", slot: "banner", name: "Угольная Пыль", price: 42, rarity: "common", style: "linear-gradient(90deg,#0a0a0a,#2b1a0a)" },
  { id: "title-obsidian-coal", slot: "title", name: "Угольный", price: 42, rarity: "common", style: "#1a1a1a" },
  { id: "frame-obsidian-shaft", slot: "frame", name: "Шахта Обсидиан", price: 142, rarity: "rare", style: "3px solid #4a2510" },
  { id: "banner-obsidian-shaft", slot: "banner", name: "Шахта", price: 142, rarity: "rare", style: "linear-gradient(90deg,#1a0a00,#ff4500)" },
  { id: "title-obsidian-shaft", slot: "title", name: "Шахтёр 42", price: 142, rarity: "rare", style: "#8b3a00" },
  { id: "frame-meduza-obsidian", slot: "frame", name: "Медуза Обсидиан", price: 420, rarity: "epic", style: "conic-gradient(from 0deg,#1a1a1a,#ff4500,#ff8c00,#1a1a1a)" },
  { id: "banner-meduza-obsidian", slot: "banner", name: "Медуза Расплав", price: 420, rarity: "epic", style: "linear-gradient(90deg,#1a1a1a,#ff5722)" },
  { id: "title-meduza-obsidian", slot: "title", name: "Расплавленный", price: 420, rarity: "epic", style: "#ff5722" },
  { id: "frame-gold-obsidian-spin", slot: "frame", name: "Голд Обсидиан Спин", price: 1420, rarity: "legendary", style: "conic-gradient(from 0deg,#1a1a1a,#ff4500,#ffcc00,#ffd700,#1a1a1a)" },
  { id: "banner-obsidian-gold", slot: "banner", name: "Золото Обсидиана", price: 1420, rarity: "legendary", style: "linear-gradient(90deg,#1a1a1a,#ffcc00)" },
  { id: "title-obsidian-gold", slot: "title", name: "Обсидиан Голд", price: 1420, rarity: "legendary", style: "conic-gradient(from 0deg,#ff4500,#ffcc00,#ffd700,#ff4500)" },
  // ── SKIN FORGE 42 — vault 12 + holo epic (hype-queue #16) clay-73-brown 142 meduza-holo 420 gold-42-conic epic 1420 spin 3s
  { id: "frame-forge-iron", slot: "frame", name: "Кузня Железо", price: 42, rarity: "common", style: "2px solid #8d6e3e" },
  { id: "banner-forge-dust", slot: "banner", name: "Кузнечная Пыль", price: 42, rarity: "common", style: "linear-gradient(90deg,#3a2a18,#8d6e3e)" },
  { id: "title-forge-spark", slot: "title", name: "Искра 42", price: 42, rarity: "common", style: "#c9a86a" },
  { id: "frame-clay-73-brown", slot: "frame", name: "Глина 73 Браун", price: 142, rarity: "rare", style: "3px solid #a67c52" },
  { id: "banner-forge-anvil", slot: "banner", name: "Наковальня 42", price: 142, rarity: "rare", style: "linear-gradient(90deg,#4a2510,#d17a22)" },
  { id: "title-forge-ember", slot: "title", name: "Уголёк 42", price: 142, rarity: "rare", style: "#d17a22" },
  { id: "frame-meduza-holo", slot: "frame", name: "Медуза Холо", price: 420, rarity: "epic", style: "conic-gradient(from 0deg,#9147ff,#00ffcc,#ff44cc,#9147ff)" },
  { id: "banner-forge-holo", slot: "banner", name: "Кузня Холо", price: 420, rarity: "epic", style: "linear-gradient(90deg,#9147ff,#00ffcc)" },
  { id: "title-forge-prism", slot: "title", name: "Призма Кузни", price: 420, rarity: "epic", style: "#9147ff" },
  { id: "frame-gold-42-conic", slot: "frame", name: "Голд 42 Коник", price: 1420, rarity: "legendary", style: "conic-gradient(from 0deg,#ffcc00,#9147ff,#00ffcc,#ff44cc,#ffcc00)" },
  { id: "banner-gold-forge", slot: "banner", name: "Голд Кузня", price: 1420, rarity: "legendary", style: "linear-gradient(90deg,#ffcc00,#9147ff)" },
  { id: "title-holo-forge", slot: "title", name: "Холо Кузня", price: 1420, rarity: "legendary", style: "conic-gradient(from 0deg,#ffcc00,#9147ff,#00ffcc,#ff44cc,#ffcc00)" },
];
// GLACIER/PRISM/CRYSTAL/VOLCANO/OBSIDIAN/FORGE — единый источник ../lib/cosmetics (12×6) — drift fixed, local COSMETICS kept 92+12 for backwards compat
export { GLACIER_CATALOG, GLACIER, GLACIER_IDS_SET, GLACIER_IDS, PRISM_CATALOG, PRISM_IDS_SET, CRYSTAL_CATALOG, CRYSTAL_IDS_SET, VOLCANO_CATALOG, VOLCANO_IDS_SET, OBSIDIAN_CATALOG, OBSIDIAN_IDS_SET, FORGE_CATALOG, FORGE_IDS_SET };
function isValidCosmeticId(v:string):boolean{ return /^[a-z0-9-]{2,64}$/.test(v) && !v.startsWith("-") && !v.endsWith("-") && !v.includes("--"); }
export function isValidBundleId(v:string):boolean{ const s=v.trim(); return !!s && s.length>=2 && s.length<=40 && /^[a-z0-9-]{2,40}$/.test(s) && !s.startsWith("-") && !s.endsWith("-") && !s.includes("--"); }
type Bundle = { id:string; name:string; desc:string; emoji:string; items:string[]; slots:string[]; price:number; origPrice:number; rarity:Rarity; tag:string };
const SHOP_BUNDLES: Bundle[] = [
  { id:"bundle-starter", name:"Старт 42", desc:"Мопс + Неон-рамка + Братуха", emoji:"🎒", items:["mops","frame-neon42","title-bra"], slots:["skin","frame","title"], price:84, origPrice:126, rarity:"rare", tag:"−33%" },
  { id:"bundle-neon", name:"Неон-вайб", desc:"Фламинго + RGB-пульс + Неоновый", emoji:"🌃", items:["flamingo","frame-rgb","title-neon"], slots:["skin","frame","title"], price:520, origPrice:624, rarity:"epic", tag:"−17%" },
  { id:"bundle-ice", name:"Лёд и Пламя", desc:"Панда + Лёд + Пламя + Хайп", emoji:"❄️", items:["panda","frame-ice","frame-fire","title-hype"], slots:["skin","frame","frame","title"], price:380, origPrice:452, rarity:"epic", tag:"−16%" },
  { id:"bundle-hunter", name:"Охотник 42", desc:"Волк + Форест + Токсичный", emoji:"🐺", items:["wolf","banner-forest","title-toxic"], slots:["skin","banner","title"], price:740, origPrice:860, rarity:"epic", tag:"−14%" },
  { id:"bundle-tiger", name:"Тигр-легенда", desc:"Тигр + Корона + Легенда + Грид", emoji:"🐯", items:["tiger","frame-crown","title-legend","banner-grid"], slots:["skin","frame","title","banner"], price:3100, origPrice:3586, rarity:"legendary", tag:"−14%" },
  { id:"bundle-dragon", name:"Дракон MAGNUM", desc:"Дракон + Когти + Бог 42", emoji:"🐉", items:["dragon","frame-dragon","title-god"], slots:["skin","frame","title"], price:5200, origPrice:6082, rarity:"legendary", tag:"−15%" },
  { id:"bundle-void", name:"Войд-сет", desc:"Войд + Туманность + VIP", emoji:"🕳️", items:["frame-void","banner-nebula","title-vip"], slots:["frame","banner","title"], price:2800, origPrice:3220, rarity:"legendary", tag:"−13%" },
  { id:"bundle-full42", name:"FULL 42", desc:"Лиса/Сова/Акула + Голо + MAGNUM", emoji:"💎", items:["fox","owl","shark","frame-holo","banner-magnum","title-magnum"], slots:["skin","skin","skin","frame","banner","title"], price:980, origPrice:1168, rarity:"epic", tag:"−16%" },
];



/* ── Компонент ────────────────────────────────────────────── */

type Toast = { id: number; kind: "ok" | "err"; text: string };

export function ShopPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const coinsRef = useRef<HTMLSpanElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const previewRef = useRef<HTMLDivElement>(null);
  const inventoryBarRef = useRef<HTMLDivElement>(null);

  const [coins, setCoins] = useState(() => getCoins());
  const [inventory, setInventory] = useState<string[]>([]);
  const [equipped, setEquipped] = useState<string | null>(null);
  // SHOP PREVIEW 42 — модалка 200px превью
  const [previewSkin, setPreviewSkin] = useState<Skin | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [cosOwned, setCosOwned] = useState<string[]>([]);
  const [cosEquipped, setCosEquipped] = useState<Record<string,string>>({});
  const [cosTab, setCosTab] = useState<"all"|CosmeticSlot|"prism"|"glacier"|"crystal"|"volcano"|"obsidian"|"forge">("all");
  const filteredCosmetics = useMemo(()=> cosTab==="all"? COSMETICS : cosTab==="prism"? COSMETICS.filter(x=>x.id.includes("prism")) : cosTab==="glacier"? COSMETICS.filter(x=>GLACIER_IDS_SET.has(x.id)) : cosTab==="crystal"? COSMETICS.filter(x=>CRYSTAL_IDS_SET.has(x.id)) : cosTab==="volcano"? COSMETICS.filter(x=>VOLCANO_IDS_SET.has(x.id)) : cosTab==="obsidian"? COSMETICS.filter(x=>OBSIDIAN_IDS_SET.has(x.id)) : cosTab==="forge"? COSMETICS.filter(x=>FORGE_IDS_SET.has(x.id)) : COSMETICS.filter(x=>x.slot===cosTab), [cosTab]);
  const [dust, setDust] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const shownCoins = useRef(getCoins());
  const [me, setMe] = useState<{ id: number; username: string } | null>(null);

  useEffect(() => {
    fetch("/magnum/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setMe(j?.user ?? null))
      .catch(() => setMe(null));
    const onAuth = () => fetch("/magnum/api/auth/me", { credentials: "include" }).then((r) => (r.ok ? r.json() : null)).then((j) => setMe(j?.user ?? null)).catch((e) => { console.warn("[ShopPage onAuth] failed", e); });
    window.addEventListener("magnum:auth" as unknown as string, onAuth as EventListener);
    window.addEventListener("magnum:need-auth" as unknown as string, onAuth as EventListener);
    return () => {
      window.removeEventListener("magnum:auth" as unknown as string, onAuth as EventListener);
      window.removeEventListener("magnum:need-auth" as unknown as string, onAuth as EventListener);
    };
  }, []);

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
    void (async()=>{
      try{
        const r=await fetch("/magnum/api/shop/dust",{credentials:"include"});
        if(r.ok){ const d=await r.json() as {dust:number;balance:number}; if(!cancelled) setDust(d.dust??d.balance??0); }
      }catch{}
    })();
    return () => { cancelled = true; };
  }, []);

  /* SHOP PREVIEW 42 — storage sync вкладок via window storage event */
  useEffect(() => {
    const syncFromStorage = () => {
      try {
        const invRaw = localStorage.getItem("magnum:shop:inventory");
        const eqRaw = localStorage.getItem("magnum:shop:equipped");
        if (invRaw) {
          const arr = JSON.parse(invRaw) as string[];
          if (Array.isArray(arr)) setInventory(arr.filter(x => typeof x === "string"));
        }
        if (eqRaw !== null) {
          const v = JSON.parse(eqRaw) as string | null;
          setEquipped(typeof v === "string" ? v : null);
        }
      } catch {}
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === "magnum:shop:inventory" || e.key === "magnum:shop:equipped") syncFromStorage();
    };
    window.addEventListener("storage", onStorage);
    // также sync через custom event для текущей вкладки
    const onCustom = () => syncFromStorage();
    window.addEventListener("magnum:shop:sync" as unknown as string, onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("magnum:shop:sync" as unknown as string, onCustom as EventListener);
    };
  }, []);

  // SHOP PREVIEW 42 — helpers для storage sync
  const persistInventory = useCallback((next: string[]) => {
    try {
      localStorage.setItem("magnum:shop:inventory", JSON.stringify(next));
      window.dispatchEvent(new Event("magnum:shop:sync"));
    } catch {}
  }, []);
  const persistEquipped = useCallback((next: string | null) => {
    try {
      localStorage.setItem("magnum:shop:equipped", JSON.stringify(next));
      window.dispatchEvent(new Event("magnum:shop:sync"));
    } catch {}
  }, []);

  // SHOP PREVIEW 42 — модалка 200px open/close
  const openPreview = useCallback((skin: Skin) => {
    setPreviewSkin(skin);
    setPreviewOpen(true);
  }, []);
  const closePreview = useCallback(() => {
    setPreviewOpen(false);
    window.setTimeout(() => setPreviewSkin(null), 220);
  }, []);

  useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closePreview(); };
    window.addEventListener("keydown", onKey);
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let ctx: gsap.Context | null = null;
    if (previewRef.current) {
      if (prefersReduced) {
        gsap.set(previewRef.current, { y: 0, opacity: 1, clearProps: "transform" });
      } else {
        ctx = gsap.context(() => {
          gsap.set(previewRef.current, { y: 20, opacity: 0, scale: 0.96 });
          gsap.to(previewRef.current, { y: 0, opacity: 1, scale: 1, duration: 0.34, ease: "back.out(1.2)" });
          // InventoryBar внутри модалки — stagger y20 0.08
          gsap.set(`.${styles.inventoryBar} > *`, { y: 20, opacity: 0 });
          gsap.to(`.${styles.inventoryBar} > *`, { y: 0, opacity: 1, stagger: 0.08, duration: 0.4, ease: "power2.out", delay: 0.12 });
          // shimmer epic — золотой/фиолет шиммер для epic/legendary preview
          if (previewSkin && (previewSkin.rarity === "epic" || previewSkin.rarity === "legendary")) {
            gsap.to(previewRef.current!.querySelector(`.${styles.previewFace}`) as Element, { boxShadow: "0 0 24px rgba(255,204,0,0.45), 0 0 36px rgba(145,71,255,0.25)", duration: 1.1, yoyo: true, repeat: -1, ease: "sine.inOut" });
          }
        }, previewRef);
      }
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      ctx?.revert();
    };
  }, [previewOpen, previewSkin, closePreview]);

  
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

  /* вход карточек — y20 stagger 0.08, reduced-motion, cleanup — SHOP PREVIEW 42 */
  useEffect(() => {
    if (!rootRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (prefersReduced) {
        ScrollTrigger.batch(document.querySelectorAll('.card'), { onEnter: (batch: Element[]) => gsap.to(batch, { y: 0, opacity: 1, stagger: 0.08, duration: 0.45, ease: "power2.out" }), start: "top 92%", once: true });
      gsap.set(`.${styles.header} > *`, { y: 0, opacity: 1, clearProps: "transform" });
        gsap.set(`.${styles.card}`, { y: 0, opacity: 1, clearProps: "transform" });
        gsap.set(`.${styles.inventoryBar} > *`, { y: 0, opacity: 1, clearProps: "transform" });
        return;
      }
      gsap.set(`.${styles.header} > *`, { y: 20, opacity: 0 });
      gsap.to(`.${styles.header} > *`, { y: 0, opacity: 1, stagger: 0.08, duration: 0.5, ease: "power2.out", delay: 0.05 });
      gsap.set(`.${styles.card}`, { y: 20, opacity: 0 });
      gsap.to(`.${styles.card}`, { y: 0, opacity: 1, stagger: 0.08, duration: 0.5, ease: "power2.out", delay: 0.22 });
      gsap.set(`.${styles.inventoryBar} > *`, { y: 20, opacity: 0 });
      gsap.to(`.${styles.inventoryBar} > *`, { y: 0, opacity: 1, stagger: 0.08, duration: 0.45, ease: "power2.out", delay: 0.35 });
      gsap.set(`.${styles.cosCard}`, { y: 20, opacity: 0 });
      gsap.to(`.${styles.cosCard}`, { y: 0, opacity: 1, stagger: 0.08, duration: 0.5, ease: "power2.out", delay: 0.42 });
      // SHOP PREVIEW 42 — shimmer epic: золотой/фиолет шиммер для epic/legendary
      gsap.to(`.${styles.card}[data-rarity="epic"] .${styles.cardFace}, .${styles.card}[data-rarity="legendary"] .${styles.cardFace}`, { filter: "brightness(1.12)", duration: 1.0, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 0.8 });
      gsap.to(`.${styles.card}[data-rarity="legendary"]`, { boxShadow: "0 0 20px rgba(255,204,0,0.35), 0 0 32px rgba(255,204,0,0.18)", duration: 1.3, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 1.0 });
      // SKIN FORGE 42 — shimmer epic holo forge spring: conic gold-42-conic epic 1420 spin 3s + holo pulse
      gsap.to(`[data-forge="1"][data-rarity="epic"], [data-forge="1"][data-rarity="legendary"]`, { boxShadow: "0 0 18px rgba(145,71,255,0.55), 0 0 32px rgba(145,71,255,0.25)", duration: 1.2, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 1.1 });
      gsap.to(`[data-forge="1"][data-rarity="legendary"]`, { scale: 1.015, duration: 1.6, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 0.9 });
      gsap.set(`.${styles.bundleCard}`, { y: 24, opacity: 0 });
      gsap.to(`.${styles.bundleCard}`, { y: 0, opacity: 1, stagger: 0.1, duration: 0.52, ease: "power2.out", delay: 0.52 });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  /* hover RGB — chromatic lift + molten obsidian + volcano eruption + forge holo */
  const onCardEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const isCrystal = (e.currentTarget as HTMLElement).dataset.crystal==="1";
    const isVolcano = (e.currentTarget as HTMLElement).dataset.volcano==="1";
    const isObsidian = (e.currentTarget as HTMLElement).dataset.obsidian==="1";
    const isForge = (e.currentTarget as HTMLElement).dataset.forge==="1";
    gsap.to(e.currentTarget, {
      y: -4,
      scale: 1.02,
      boxShadow: isForge ? "0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(145,71,255,0.25), 0 0 22px rgba(145,71,255,0.28), 0 0 28px rgba(255,204,0,0.14)" : isObsidian ? "0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,69,0,0.25), 0 0 22px rgba(255,69,0,0.28), 0 0 28px rgba(255,204,0,0.14)" : isCrystal ? "0 0 16px #38bdf8, 0 12px 32px rgba(0,0,0,0.45)" : isVolcano ? "0 0 16px #ff5722, 0 12px 32px rgba(0,0,0,0.45)" : "0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,45,85,0.20), 0 0 22px rgba(255,45,85,0.20), 0 0 22px rgba(0,255,136,0.12), 0 0 28px rgba(255,204,0,0.10)",
      borderColor: isForge ? "rgba(145,71,255,0.35)" : isObsidian ? "rgba(255,69,0,0.35)" : isCrystal ? "rgba(56,189,248,0.55)" : isVolcano ? "rgba(255,87,34,0.45)" : "rgba(255,45,85,0.35)",
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

  // SHOP PREVIEW 42 — confetti 80 — prefers-reduced-motion gate
  const fireConfetti80 = useCallback((rarity: Rarity) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.style.position = "fixed"; canvas.style.inset = "0"; canvas.style.pointerEvents = "none"; canvas.style.zIndex = "9999";
      canvas.width = window.innerWidth; canvas.height = window.innerHeight;
      document.body.appendChild(canvas);
      const ctx = canvas.getContext("2d")!;
      const color = rarity === "legendary" ? "#ffcc00" : rarity === "epic" ? "#ffcc00" : "#9147ff";
      const alt = rarity === "rare" ? "#9147ff" : "#ff2d55";
      const parts = Array.from({ length: 80 }, () => ({
        x: window.innerWidth / 2 + (Math.random() - 0.5) * 120,
        y: window.innerHeight / 2,
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 0.5) * 14 - 5,
        life: 1, decay: 0.015 + Math.random() * 0.012,
        c: Math.random() > 0.5 ? color : alt,
        r: 3 + Math.random() * 3,
      }));
      const tick = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;
        for (const p of parts) {
          if (p.life <= 0) continue;
          alive = true;
          p.x += p.vx; p.y += p.vy; p.vy += 0.28; p.life -= p.decay;
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle = p.c;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        }
        if (alive) requestAnimationFrame(tick); else canvas.remove();
      };
      tick();
    } catch {}
  }, []);

  const buy = async (skin: Skin) => {
    if (!me) {
      pushToast("err", "Войди, братуха — без логина магазин закрыт");
      window.dispatchEvent(new CustomEvent("magnum:need-auth"));
      return;
    }
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
        if (res.status === 401) {
          pushToast("err", "Войди, братуха — без логина магазин закрыт");
          window.dispatchEvent(new CustomEvent("magnum:need-auth"));
          return;
        }
        const txt = await res.text().catch(() => "");
        // парсим json ошибку если есть
        let msg = txt;
        try { const j = JSON.parse(txt) as { error?: string }; if (j.error) msg = j.error; } catch {}
        // прячем голую unauthorized
        if (msg.toLowerCase().includes("unauthorized")) msg = "Войди, братуха — без логина магазин закрыт";
        pushToast("err", msg || "Покупка не прошла — попробуй ещё раз");
        return;
      }
      const data = await res.json().catch(() => ({})) as { coins?: number; balance?: number; inventory?: string[]; equipped?: string | null };
      if (typeof data.coins === "number") setCoins(data.coins);
      else if (typeof data.balance === "number") setCoins(data.balance);
      if (Array.isArray(data.inventory)) { setInventory(data.inventory); persistInventory(data.inventory); }
      else { const next = [...inventory, skin.id]; setInventory(next); persistInventory(next); }
      if (data.equipped !== undefined) { setEquipped(data.equipped); persistEquipped(data.equipped); }
      pushToast("ok", `${skin.name} куплен! Легенда в инвентаре.`);
      // SHOP PREVIEW 42 — confetti 80 при покупке epic/legendary
      if (skin.rarity === "epic" || skin.rarity === "legendary") fireConfetti80(skin.rarity);
      closePreview();
    } catch {
      pushToast("err", "Сеть упала — не смогли купить");
    }
  };

  const equip = async (skin: Skin) => {
    if (!me) {
      pushToast("err", "Войди, братуха — без логина магазин закрыт");
      window.dispatchEvent(new CustomEvent("magnum:need-auth"));
      return;
    }
    try {
      const res = await fetch("/magnum/api/shop/equip", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skinId: skin.id, id: skin.id }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          pushToast("err", "Войди, братуха — без логина магазин закрыт");
          window.dispatchEvent(new CustomEvent("magnum:need-auth"));
          return;
        }
        pushToast("err", "Не удалось надеть — попробуй ещё раз");
        return;
      }
      const data = await res.json().catch(() => ({})) as { equipped?: string | null };
      setEquipped(data.equipped ?? skin.id); persistEquipped(data.equipped ?? skin.id);
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
      setEquipped(null); persistEquipped(null);
      pushToast("ok", "Скин снят. Голый магнум — тоже стиль.");
    } catch {
      // оптимистично снимаем даже без сети
      setEquipped(null); persistEquipped(null);
      pushToast("ok", "Скин снят. Голый магнум — тоже стиль.");
    }
  };

  const buyCosmetic = async (co: Cosmetic) => {
    if(!me){ pushToast("err","Войди, братуха — без логина магазин закрыт"); window.dispatchEvent(new CustomEvent("magnum:need-auth")); return; }
    if(!isValidCosmeticId(co.id)) return;
    if(cosOwned.includes(co.id)) return;
    if(coins < co.price){ pushToast("err",`Нужно ${co.price}, у тебя ${coins}. Фарми в играх!`); return; }
    try{
      const r=await fetch("/magnum/api/shop/cosmetic/buy",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({cosmeticId:co.id})});
      const d=await r.json().catch(()=>({})) as {balance?:number;error?:string};
      if(!r.ok){ if(r.status===401 || String((d as any).error||"").toLowerCase().includes("unauthorized")){ pushToast("err","Войди, братуха — без логина магазин закрыт"); window.dispatchEvent(new CustomEvent("magnum:need-auth")); return; } pushToast("err", String((d as any).error||"Покупка не прошла")); return; }
      if(typeof (d as any).balance==="number") setCoins((d as any).balance);
      setCosOwned(v=>[...v,co.id]);
      pushToast("ok",`${co.name} куплен!`);
      if(co.id==="title-vip"||co.id==="frame-void"||co.id==="title-god"){
        window.dispatchEvent(new CustomEvent("magnum:cosmetic-bought",{detail:co.id}));
        window.dispatchEvent(new CustomEvent("magnum:tier-refresh"));
      }
    }catch{ pushToast("err","Сеть упала"); }
  };
  const equipCosmetic = async (co: Cosmetic) => {
    if(!me){ pushToast("err","Войди, братуха — без логина магазин закрыт"); window.dispatchEvent(new CustomEvent("magnum:need-auth")); return; }
    try{
      const r=await fetch("/magnum/api/shop/cosmetic/equip",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({cosmeticId:co.id})});
      const d=await r.json().catch(()=>({})) as {equipped?:string;slot?:string;error?:string};
      if(!r.ok){ if(r.status===401 || String((d as any).error||"").toLowerCase().includes("unauthorized")){ pushToast("err","Войди, братуха — без логина магазин закрыт"); window.dispatchEvent(new CustomEvent("magnum:need-auth")); return; } pushToast("err", String((d as any).error||"Не надеть")); return; }
      setCosEquipped(prev=>({...prev,[co.slot]:co.id}));
      pushToast("ok",`${co.name} надет · слот ${co.slot}`);
    }catch{ pushToast("err","Сеть упала"); }
  };
  const buyBundle = async (b: Bundle) => {
    if(!isValidBundleId(b.id)) return;
    if(coins < b.price){ pushToast("err",`Нужно ${b.price}, у тебя ${coins}. Фарми в играх!`); return; }
    if(!me){ pushToast("err","Войди, братуха — без логина магазин закрыт"); window.dispatchEvent(new CustomEvent("magnum:need-auth")); return; }
    try{
      const r=await fetch("/magnum/api/shop/bundle/buy",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({bundleId:b.id})});
      const d=await r.json().catch(()=>({})) as {balance?:number;granted?:string[];skipped?:string[];error?:string};
      if(!r.ok){ let msg=String((d as any).error||"Покупка не прошла"); if(msg.toLowerCase().includes("unauthorized")) msg="Войди, братуха — без логина магазин закрыт"; pushToast("err",msg); return; }
      if(typeof (d as any).balance==="number") setCoins((d as any).balance);
      // optimistic: mark cosmetics as owned, skins as inventory
      const granted=(d as any).granted as string[]||[]; const skipped=(d as any).skipped as string[]||[];
      if(granted.length){ setCosOwned(v=>[...new Set([...v,...granted.filter(id=>!SHOP_BUNDLES.some(_=>false)&&id)])]); setInventory(v=>[...new Set([...v,...granted.filter(id=>SKINS.some(s=>s.id===id))])]); }
      // reload inventories for correctness
      try{
        const [invR, cosR]=await Promise.all([fetch("/magnum/api/shop/inventory",{credentials:"include"}), fetch("/magnum/api/shop/cosmetic/inventory",{credentials:"include"})]);
        if(invR.ok){ const dj=await invR.json() as {inventory?:any[]}; const arr=(dj as any).inventory||[]; const ids=Array.isArray(arr)? arr.map((x:any)=> typeof x==="string"?x:(x.skinId||x.skin_id||"")).filter(Boolean):[]; if(ids.length) setInventory(ids); }
        if(cosR.ok){ const dj=await cosR.json() as {inventory?:any[]}; const arr=(dj as any).inventory||[]; setCosOwned(arr.map((x:any)=> x.cosmeticId||x.cosmetic_id||"").filter(Boolean)); const eq:Record<string,string>={}; for(const it of arr) if(it.equipped) eq[it.slot]=it.cosmeticId||it.cosmetic_id; setCosEquipped(eq); }
      }catch{}
      const got=granted.length? ` +${granted.length} предметов`:""; const skip=skipped.length? ` (уже было: ${skipped.length})`:"";
      pushToast("ok",`${b.name} куплен!${got}${skip} · баланс ${ (d as any).balance ?? coins-b.price}`);
      if(b.id==="bundle-void"){
        window.dispatchEvent(new CustomEvent("magnum:cosmetic-bought",{detail:b.id}));
        window.dispatchEvent(new CustomEvent("magnum:tier-refresh"));
      } else if(granted.some(id=> id==="title-vip"||id==="frame-void"||id==="title-god")){
        window.dispatchEvent(new CustomEvent("magnum:cosmetic-bought",{detail:granted.find(id=> id==="title-vip"||id==="frame-void"||id==="title-god")||"" }));
        window.dispatchEvent(new CustomEvent("magnum:tier-refresh"));
      }
    }catch{ pushToast("err","Сеть упала"); }
  };
  const dismantle = async (co: Cosmetic) => {
    if(!me){ pushToast("err","Войди — нужен логин для разборки"); window.dispatchEvent(new CustomEvent("magnum:need-auth")); return; }
    try{
      const r=await fetch("/magnum/api/shop/dismantle",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({cosmeticId:co.id})});
      const d=await r.json().catch(()=>({})) as {dust?:number;reward?:number;error?:string};
      if(!r.ok){ pushToast("err", String((d as any).error||"Разборка не прошла")); return; }
      setCosOwned(v=>v.filter(x=>x!==co.id));
      setDust((d as any).dust??0);
      pushToast("ok",`Разобрано ${co.name} +${(d as any).reward} пыли · dust ${(d as any).dust}`);
    }catch{ pushToast("err","Сеть упала"); }
  };
  const craftPrism = async (co: Cosmetic) => {
    if(!me){ pushToast("err","Войди — нужен логин для крафта"); window.dispatchEvent(new CustomEvent("magnum:need-auth")); return; }
    if(dust < co.price){ pushToast("err",`Нужно ${co.price} пыли, у тебя ${dust}`); return; }
    try{
      const r=await fetch("/magnum/api/shop/craft",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({cosmeticId:co.id})});
      const d=await r.json().catch(()=>({})) as {dust?:number;error?:string};
      if(!r.ok){ pushToast("err", String((d as any).error||"Крафт не прошёл")); return; }
      setCosOwned(v=>[...v,co.id]);
      setDust((d as any).dust??0);
      pushToast("ok",`Скрафчено ${co.name} за ${co.price} пыли`);
    }catch{ pushToast("err","Сеть упала"); }
  };
  const craftGlacier = async (co: Cosmetic) => {
    if(!me){ pushToast("err","Войди — нужен логин для крафта"); window.dispatchEvent(new CustomEvent("magnum:need-auth")); return; }
    const isUncommon = co.rarity==="rare" && GLACIER_IDS_SET.has(co.id);
    if(isUncommon){
      try{
        const r=await fetch("/magnum/api/shop/glacier/craft",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({targetId:co.id})});
        const d=await r.json().catch(()=>({})) as {balance?:number;dust?:number;error?:string;consumed?:string[]};
        if(!r.ok){ pushToast("err", String((d as any).error||"Крафт не прошёл")); return; }
        if(typeof (d as any).balance==="number") setCoins((d as any).balance);
        const invIds = ((d as any).inventory as string[])||[];
        if(invIds.length) setCosOwned(invIds);
        else setCosOwned(v=>{ const toRemove = ((d as any).consumed as string[])||[]; const filtered=v.filter(x=>!toRemove.includes(x)); return [...filtered, co.id]; });
        pushToast("ok",`Скрафчено ${co.name} за 42 · 3×common ❄️`);
      }catch{ pushToast("err","Сеть упала"); }
      return;
    }
    if(!GLACIER_IDS_SET.has(co.id)){ pushToast("err","Только GLACIER крафт"); return; }
    pushToast("err","Гляйшер крафт только для uncommon (142) — собери 3×common");
  };
  const craftCrystal = async (co: Cosmetic) => {
    if(!me){ pushToast("err","Войди — нужен логин для крафта"); window.dispatchEvent(new CustomEvent("magnum:need-auth")); return; }
    if(!CRYSTAL_IDS_SET.has(co.id)){ pushToast("err","Только CRYSTAL крафт"); return; }
    const fee = co.rarity==="rare" ? 42 : co.rarity==="epic" ? 142 : 0;
    if(!fee){ pushToast("err","CRYSTAL крафт: uncommon 42 (3×common) или rare 142 (3×uncommon)"); return; }
    try{
      const r=await fetch("/magnum/api/shop/crystal/craft",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({targetId:co.id})});
      const d=await r.json().catch(()=>({})) as {balance?:number;error?:string;consumed?:string[];inventory?:string[]};
      if(!r.ok){ pushToast("err", String((d as any).error||"Крафт не прошёл")); return; }
      if(typeof (d as any).balance==="number") setCoins((d as any).balance);
      const invIds = ((d as any).inventory as string[])||[];
      if(invIds.length) setCosOwned(invIds);
      else setCosOwned(v=>{ const toRemove=((d as any).consumed as string[])||[]; const filtered=v.filter(x=>!toRemove.includes(x)); return [...filtered, co.id]; });
      try{
        const el=document.querySelector('[data-forge-reveal]') as HTMLElement;
        if(el && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
          const gs=(await import("gsap")).default;
          gs.fromTo(el,{scale:0,rotation:5,opacity:0},{scale:1,rotation:0,opacity:1,duration:0.5,ease:"back.out(1.7)"});
          gs.to(el,{boxShadow:"0 0 24px #38bdf8",duration:0.4,yoyo:true,repeat:1});
        }
        // confetti 80 crystal #a8e8ff
        const canvas=document.createElement('canvas'); canvas.style.position='fixed'; canvas.style.inset='0'; canvas.style.pointerEvents='none'; canvas.width=window.innerWidth; canvas.height=window.innerHeight; document.body.appendChild(canvas);
        const ctx=canvas.getContext('2d')!; const parts=Array.from({length:80},()=>({x:window.innerWidth/2,y:window.innerHeight/2,vx:(Math.random()-0.5)*12,vy:(Math.random()-0.5)*12-4,life:1,decay:0.015+Math.random()*0.01}));
        const tick=()=>{ ctx.clearRect(0,0,canvas.width,canvas.height); let alive=false; for(const p of parts){ if(p.life<=0) continue; alive=true; p.x+=p.vx; p.y+=p.vy; p.vy+=0.25; p.life-=p.decay; ctx.globalAlpha=Math.max(0,p.life); ctx.fillStyle='#a8e8ff'; ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2); ctx.fill(); } if(alive) requestAnimationFrame(tick); else canvas.remove(); }; tick();
      }catch{}
      pushToast("ok",`Скрафчено ${co.name} за ${fee} · 3×${co.rarity==="rare"?"common":"uncommon"} 💎`);
    }catch{ pushToast("err","Сеть упала"); }
  };
  const craftVolcano = async (co: Cosmetic) => {
    if(!me){ pushToast("err","Войди — нужен логин для крафта"); window.dispatchEvent(new CustomEvent("magnum:need-auth")); return; }
    if(!VOLCANO_IDS_SET.has(co.id)){ pushToast("err","Только VOLCANO крафт"); return; }
    if(co.rarity!=="rare"){ pushToast("err","VOLCANO крафт только для uncommon (142) — собери 3×common 🌋"); return; }
    try{
      const r=await fetch("/magnum/api/shop/volcano/craft",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({targetId:co.id})});
      const d=await r.json().catch(()=>({})) as {balance?:number;error?:string;consumed?:string[];inventory?:string[]};
      if(!r.ok){ pushToast("err", String((d as any).error||"Крафт не прошёл")); return; }
      if(typeof (d as any).balance==="number") setCoins((d as any).balance);
      const invIds = ((d as any).inventory as string[])||[];
      if(invIds.length) setCosOwned(invIds);
      else setCosOwned(v=>{ const toRemove=((d as any).consumed as string[])||[]; const filtered=v.filter(x=>!toRemove.includes(x)); return [...filtered, co.id]; });
      try{
        const el=document.querySelector('[data-forge-reveal]') as HTMLElement;
        if(el && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
          const gs=(await import("gsap")).default;
          gs.fromTo(el,{scale:0,rotation:5,opacity:0},{scale:1,rotation:0,opacity:1,duration:0.5,ease:"back.out(1.7)"});
          gs.to(el,{boxShadow:"0 0 16px #ff5722, 0 0 28px rgba(255,87,34,0.45)",duration:0.35,yoyo:true,repeat:1});
          gs.to(el,{scale:1.04,duration:0.35,yoyo:true,repeat:1,delay:0.5});
        }
        const canvas=document.createElement('canvas'); canvas.style.position='fixed'; canvas.style.inset='0'; canvas.style.pointerEvents='none'; canvas.width=window.innerWidth; canvas.height=window.innerHeight; document.body.appendChild(canvas);
        const ctx=canvas.getContext('2d')!; const parts=Array.from({length:80},()=>({x:window.innerWidth/2,y:window.innerHeight/2,vx:(Math.random()-0.5)*12,vy:(Math.random()-0.5)*12-4,life:1,decay:0.015+Math.random()*0.01}));
        const tick=()=>{ ctx.clearRect(0,0,canvas.width,canvas.height); let alive=false; for(const p of parts){ if(p.life<=0) continue; alive=true; p.x+=p.vx; p.y+=p.vy; p.vy+=0.25; p.life-=p.decay; ctx.globalAlpha=Math.max(0,p.life); ctx.fillStyle='#ff5722'; ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2); ctx.fill(); } if(alive) requestAnimationFrame(tick); else canvas.remove(); }; tick();
      }catch{}
      pushToast("ok",`Скрафчено ${co.name} за 42 · 3×common 🌋 eruption`);
    }catch{ pushToast("err","Сеть упала"); }
  };
  const craftObsidian = async (co: Cosmetic) => {
    if(!me){ pushToast("err","Войди — нужен логин для крафта"); window.dispatchEvent(new CustomEvent("magnum:need-auth")); return; }
    if(!OBSIDIAN_IDS_SET.has(co.id)){ pushToast("err","Только OBSIDIAN крафт"); return; }
    if(co.rarity!=="rare"){ pushToast("err","OBSIDIAN крафт только для uncommon (142) — собери 3×common ⛏️"); return; }
    try{
      const r=await fetch("/magnum/api/shop/obsidian/craft",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({targetId:co.id})});
      const d=await r.json().catch(()=>({})) as {balance?:number;error?:string;consumed?:string[];inventory?:string[]};
      if(!r.ok){ pushToast("err", String((d as any).error||"Крафт не прошёл")); return; }
      if(typeof (d as any).balance==="number") setCoins((d as any).balance);
      const invIds = ((d as any).inventory as string[])||[];
      if(invIds.length) setCosOwned(invIds);
      else setCosOwned(v=>{ const toRemove=((d as any).consumed as string[])||[]; const filtered=v.filter(x=>!toRemove.includes(x)); return [...filtered, co.id]; });
      // OBSIDIAN FORGE 42 — molten epic 1420 spin 3s + forge spring + confetti 80 #ff4500
      try{
        const el=document.querySelector('[data-forge-reveal]') as HTMLElement;
        if(el && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
          const gs=(await import("gsap")).default;
          gs.fromTo(el,{scale:0,rotation:5,opacity:0},{scale:1,rotation:0,opacity:1,duration:0.5,ease:"back.out(1.7)"});
          gs.to(el,{boxShadow:"0 0 16px #ff4500, 0 0 28px rgba(255,69,0,0.45)",duration:0.35,yoyo:true,repeat:1});
          gs.to(el,{scale:1.04,duration:0.35,yoyo:true,repeat:1,delay:0.5});
        }
        const canvas=document.createElement('canvas'); canvas.style.position='fixed'; canvas.style.inset='0'; canvas.style.pointerEvents='none'; canvas.width=window.innerWidth; canvas.height=window.innerHeight; document.body.appendChild(canvas);
        const ctx=canvas.getContext('2d')!; const parts=Array.from({length:80},()=>({x:window.innerWidth/2,y:window.innerHeight/2,vx:(Math.random()-0.5)*12,vy:(Math.random()-0.5)*12-4,life:1,decay:0.015+Math.random()*0.01}));
        const tick=()=>{ ctx.clearRect(0,0,canvas.width,canvas.height); let alive=false; for(const p of parts){ if(p.life<=0) continue; alive=true; p.x+=p.vx; p.y+=p.vy; p.vy+=0.25; p.life-=p.decay; ctx.globalAlpha=Math.max(0,p.life); ctx.fillStyle='#ff4500'; ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2); ctx.fill(); } if(alive) requestAnimationFrame(tick); else canvas.remove(); }; tick();
      }catch{}
      pushToast("ok",`Скрафчено ${co.name} за 42 · 3×common ⛏️ molten`);
    }catch{ pushToast("err","Сеть упала"); }
  };
  const craftForge = async (co: Cosmetic) => {
    if(!me){ pushToast("err","Войди — нужен логин для крафта"); window.dispatchEvent(new CustomEvent("magnum:need-auth")); return; }
    if(!FORGE_IDS_SET.has(co.id)){ pushToast("err","Только FORGE крафт 🔨"); return; }
    if(dust < 42){ pushToast("err",`Нужно 42 пыли, у тебя ${dust} · пыли для FORGE`); return; }
    try{
      const r=await fetch("/magnum/api/shop/forge/craft",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({targetId:co.id})});
      const d=await r.json().catch(()=>({})) as {dust?:number;balance?:number;error?:string;inventory?:string[]};
      if(!r.ok){ pushToast("err", String((d as any).error||"Крафт не прошёл")); return; }
      const newDust = (d as any).dust ?? (d as any).balance ?? dust-42;
      setDust(newDust);
      const invIds = ((d as any).inventory as string[])||[];
      if(invIds.length) setCosOwned(invIds);
      else setCosOwned(v=>[...v,co.id]);
      try{
        const el=document.querySelector('[data-forge-reveal]') as HTMLElement;
        if(el && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
          const gs=(await import("gsap")).default;
          gs.fromTo(el,{scale:0,rotation:5,opacity:0},{scale:1,rotation:0,opacity:1,duration:0.5,ease:"back.out(1.7)"});
          gs.to(el,{boxShadow:"0 0 16px #9147ff, 0 0 28px rgba(145,71,255,0.45)",duration:0.35,yoyo:true,repeat:1});
          gs.to(el,{scale:1.04,duration:0.35,yoyo:true,repeat:1,delay:0.5});
        }
        const canvas=document.createElement('canvas'); canvas.style.position='fixed'; canvas.style.inset='0'; canvas.style.pointerEvents='none'; canvas.width=window.innerWidth; canvas.height=window.innerHeight; document.body.appendChild(canvas);
        const ctx=canvas.getContext('2d')!; const parts=Array.from({length:80},()=>({x:window.innerWidth/2,y:window.innerHeight/2,vx:(Math.random()-0.5)*12,vy:(Math.random()-0.5)*12-4,life:1,decay:0.015+Math.random()*0.01}));
        const tick=()=>{ ctx.clearRect(0,0,canvas.width,canvas.height); let alive=false; for(const p of parts){ if(p.life<=0) continue; alive=true; p.x+=p.vx; p.y+=p.vy; p.vy+=0.25; p.life-=p.decay; ctx.globalAlpha=Math.max(0,p.life); ctx.fillStyle='#9147ff'; ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2); ctx.fill(); } if(alive) requestAnimationFrame(tick); else canvas.remove(); }; tick();
      }catch{}
      pushToast("ok",`Скрафчено ${co.name} за 42 пыли 🔨 holo`);
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
        <span className={styles.badge}>Магазин 42</span>
        <h1 className={styles.title}>МАГАЗИН БРАТУХ</h1>
        <p className={styles.subtitle}>
          Два разных вида предметов: <b>аватары</b> — эмодзи-персонаж, у тебя всегда один надетый.
          <b> Косметика</b> — рамка, баннер и титул: по одному предмету в каждом слоте, они видны в публичных топах.
        </p>
        {!me && (
          <div style={{ margin: "14px 0", padding: 14, border: "1px solid rgba(255,204,0,0.3)", borderRadius: 12, background: "rgba(255,204,0,0.08)" }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Войди, братуха — магазин закрыт без логина</div>
            <div style={{ opacity: 0.8, fontSize: 13, marginBottom: 10 }}>Авторизация нужна для покупок, инвентаря и VIP-рамок. Без голых ошибок.</div>
            <AuthStatus />
          </div>
        )}
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

      {/* текущий сетап — EquippedFrame glow conic-gradient */}
      <section className={styles.setup} aria-label="Текущий аватар и надетая косметика">
        <div className={styles.avatarSlot}>
          {equippedSkin ? (
            <div
              className={`${styles.avatarFace} ${styles.equippedFrame}`}
              style={{ background: equippedSkin.bg }}
              data-rarity={equippedSkin.rarity}
            >
              <span className={styles.avatarEmoji} style={{ fontSize: "48px" }}>{equippedSkin.emoji}</span>
            </div>
          ) : (
            <div className={`${styles.avatarFace} ${styles.avatarEmpty}`}>
              <span className={styles.avatarEmoji} style={{ fontSize: "48px" }}>👤</span>
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

        {/* InventoryBar скролл + equipped glow conic-gradient — SHOP PREVIEW 42 */}
        <div className={styles.inventory}>
          <h2 className={styles.invTitle}>
            Инвентарь <span className={styles.invCount}>{inventory.length}/{SKINS.length}</span>
          </h2>
          {inventory.length === 0 ? (
            <p className={styles.invEmpty}>
              Пусто, как в кошельке до зарплаты. Купи первый скин ниже 👇
            </p>
          ) : (
            <div className={styles.inventoryBar} ref={inventoryBarRef} role="list" aria-label="InventoryBar — скролл инвентаря">
              {SKINS.filter((s) => owned(s.id)).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="listitem"
                  className={`${styles.invItem} ${equipped === s.id ? styles.invItemActive : ""} ${equipped === s.id ? styles.equippedGlow : ""}`}
                  style={{ ["--rc" as string]: RARITY_META[s.rarity].color } as React.CSSProperties}
                  onClick={() => (equipped === s.id ? unequip() : equip(s))}
                  title={equipped === s.id ? "Снять" : "Надеть — клик для превью"}
                  onDoubleClick={() => openPreview(s)}
                >
                  <span className={styles.invEmoji} style={{ fontSize: "48px" }}>{s.emoji}</span>
                  <span className={styles.invName}>{s.name}</span>
                  {equipped === s.id && <span className={styles.invOn}>НАДЕТ</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* сетка магазина — SkinCard + клик открывает модалку 200px */}
      <h2 className={styles.cosTitle} style={{ marginTop: 8 }}>1. АВАТАРЫ — 12 эмодзи-персонажей</h2>
      <p className={styles.cosSub}>Один надетый аватар. Это не рамка и не титул — те ниже, в «Косметике 42».</p>
      <section className={styles.grid} aria-label="Аватары в продаже — клик открывает превью 200px">
        {SKINS.map((skin, i) => {
          const meta = RARITY_META[skin.rarity];
          const isOwned = owned(skin.id);
          const canAfford = coins >= meta.price;
          const badgeStyle = skin.rarity === "rare" ? { background: "rgba(145,71,255,0.18)", color: "#9147ff", borderColor: "#9147ff" } : skin.rarity === "epic" || skin.rarity === "legendary" ? { background: "rgba(255,204,0,0.18)", color: "#ffcc00", borderColor: "#ffcc00" } : { background: "rgba(154,164,178,0.18)", color: meta.color, borderColor: meta.color };
          return (
            <div
              key={skin.id}
              className={`${styles.card} ${styles.skinCard} ${isOwned && equipped === skin.id ? styles.equippedGlow : ""}`}
              ref={(el) => { cardsRef.current[i] = el; }}
              style={{ ["--rc" as string]: meta.color, ["--rg" as string]: meta.color } as React.CSSProperties}
              data-rarity={skin.rarity}
              onMouseEnter={onCardEnter}
              onMouseLeave={onCardLeave}
              onClick={() => openPreview(skin)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openPreview(skin); }}
              aria-label={`Превью ${skin.name} — ${meta.label} ${meta.price}`}
            >
              <div className={styles.cardGlow} aria-hidden />
              <div className={styles.cardFace} style={{ background: skin.bg }}>
                <span className={styles.cardEmoji} style={{ fontSize: "48px" }}>{skin.emoji}</span>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cardTop}>
                  <span className={styles.cardName}>{skin.name}</span>
                  <span
                    className={styles.rarityTag}
                    style={badgeStyle}
                  >
                    {meta.label}
                  </span>
                </div>
                <p className={styles.cardTag}>{skin.tagline}</p>
                {isOwned ? (
                  equipped === skin.id ? (
                    <button type="button" className={styles.btnWear} onClick={(e) => { e.stopPropagation(); unequip(); }}>
                      ✅ Надет — снять
                    </button>
                  ) : (
                    <button type="button" className={styles.btnWear} onClick={(e) => { e.stopPropagation(); equip(skin); }}>
                      Надеть
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    className={`${styles.btnBuy} ${canAfford ? "" : styles.btnLocked}`}
                    onClick={(e) => { e.stopPropagation(); buy(skin); }}
                  >
                    🪙 {meta.price}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* SHOP PREVIEW 42 — модалка 200px: превью скина + InventoryBar скролл */}
      {previewOpen && previewSkin && (
        <div className={styles.modalOverlay} onClick={closePreview} role="dialog" aria-modal="true" aria-label={`Превью ${previewSkin.name}`}>
          <div className={styles.modalContent} ref={previewRef} onClick={(e) => e.stopPropagation()} data-testid="shop-preview-modal">
            <button type="button" className={styles.modalClose} onClick={closePreview} aria-label="Закрыть превью">×</button>
            <div className={styles.previewFace} style={{ background: previewSkin.bg, width: "200px", height: "200px" }} data-rarity={previewSkin.rarity}>
              <span style={{ fontSize: "48px", filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.55))" }}>{previewSkin.emoji}</span>
            </div>
            <div className={styles.previewMeta}>
              <div className={styles.previewName}>{previewSkin.name}</div>
              <span className={styles.rarityTag} style={previewSkin.rarity === "rare" ? { background: "rgba(145,71,255,0.18)", color: "#9147ff", borderColor: "#9147ff" } : previewSkin.rarity === "epic" || previewSkin.rarity === "legendary" ? { background: "rgba(255,204,0,0.18)", color: "#ffcc00", borderColor: "#ffcc00" } : { background: "rgba(154,164,178,0.18)", color: RARITY_META[previewSkin.rarity].color, borderColor: RARITY_META[previewSkin.rarity].color }}>{RARITY_META[previewSkin.rarity].label}</span>
              <p className={styles.previewTagline}>{previewSkin.tagline}</p>
              <div className={styles.previewPrice}>🪙 {RARITY_META[previewSkin.rarity].price}</div>
              {inventory.includes(previewSkin.id) ? (
                equipped === previewSkin.id ? (
                  <button type="button" className={styles.btnWear} onClick={() => { unequip(); }}>✅ Надет — снять</button>
                ) : (
                  <button type="button" className={styles.btnWear} onClick={() => equip(previewSkin)}>Надеть</button>
                )
              ) : (
                <button type="button" className={`${styles.btnBuy} ${coins >= RARITY_META[previewSkin.rarity].price ? "" : styles.btnLocked}`} onClick={() => buy(previewSkin)}>🪙 {RARITY_META[previewSkin.rarity].price} — купить</button>
              )}
            </div>
            {/* InventoryBar скролл внутри модалки */}
            <div className={styles.modalInventoryBarWrap}>
              <div className={styles.modalInventoryLabel}>Инвентарь — скролл {inventory.length}/{SKINS.length}</div>
              <div className={styles.inventoryBar} role="list">
                {SKINS.filter(s => inventory.includes(s.id)).length === 0 ? (
                  <span className={styles.invEmpty} style={{ fontSize: "12px" }}>Пусто — купи первый скин</span>
                ) : (
                  SKINS.filter(s => inventory.includes(s.id)).map(s => (
                    <button
                      key={s.id}
                      type="button"
                      role="listitem"
                      className={`${styles.invItem} ${equipped === s.id ? styles.invItemActive : ""} ${equipped === s.id ? styles.equippedGlow : ""}`}
                      style={{ ["--rc" as string]: RARITY_META[s.rarity].color } as React.CSSProperties}
                      onClick={() => setPreviewSkin(s)}
                    >
                      <span className={styles.invEmoji} style={{ fontSize: "32px" }}>{s.emoji}</span>
                      <span className={styles.invName}>{s.name}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* косметика 104 — рамки/баннеры/титулы */}
      <section className={styles.cosmetics} aria-label="Косметика 42">
        <div className={styles.cosHead}>
          <h2 className={styles.cosTitle}>2. КОСМЕТИКА 42 — рамки · баннеры · титулы</h2>
          <p className={styles.cosSub}>104 предмета (32 + 12 PRISM + 12 GLACIER + 12 CRYSTAL + 12 VOLCANO + 12 OBSIDIAN + 12 FORGE) · пыль {dust} · Neon · без localStorage</p>
          <div className={styles.cosTabs} role="tablist">
            {(["all","frame","banner","title","prism","glacier","crystal","volcano","obsidian","forge"] as const).map(t => (
              <button key={t} type="button" role="tab" aria-selected={cosTab===t} className={`${styles.cosTab} ${cosTab===t?styles.cosTabOn:""}`} onClick={()=>setCosTab(t)}>{t==="all"?"Все":t==="frame"?"Рамки":t==="banner"?"Баннеры":t==="prism"?"PRISM 12":t==="glacier"?"GLACIER 12":t==="crystal"?"CRYSTAL 12":t==="volcano"?"VOLCANO 12 🌋":t==="obsidian"?"OBSIDIAN 12 ⛏️":t==="forge"?"FORGE 12 🔨":"Титулы"}</button>
            ))}
          </div>
        </div>
        <div className={styles.cosGrid} data-forge-reveal>
          {filteredCosmetics.map(co => {
            const isOwned = cosOwned.includes(co.id);
            const isEq = cosEquipped[co.slot]===co.id;
            const isPrism = co.id.includes("prism");
            const isGlacier = GLACIER_IDS_SET.has(co.id);
            const isCrystal = CRYSTAL_IDS_SET.has(co.id);
            const isVolcano = VOLCANO_IDS_SET.has(co.id);
            const isObsidian = OBSIDIAN_IDS_SET.has(co.id);
            const isForge = FORGE_IDS_SET.has(co.id);
            const can = coins >= co.price;
            const isCrystalEpic = isCrystal && co.rarity==="legendary";
            const isVolcanoGold = isVolcano && co.rarity==="legendary";
            const isObsidianGold = isObsidian && co.rarity==="legendary";
            const isForgeGold = isForge && co.rarity==="legendary";
            const isForgeHolo = isForge && co.rarity==="epic";
            return (
              <div key={co.id} className={`${styles.cosCard} ${isEq?styles.cosCardEq:""} ${isPrism?styles.cosCardPrism||"":""} ${isGlacier?styles.cosCardGlacier||"":""} ${isGlacier && co.rarity==="legendary"?styles.cosCardFrost||"":""} ${isCrystal?styles.cosCardCrystal||"":""} ${isCrystalEpic?styles.cosCardCrystalSpin||"":""} ${isVolcano?styles.cosCardVolcano||"":""} ${isVolcanoGold?styles.cosCardVolcanoGold||"":""} ${isObsidian?styles.cosCardObsidian||"":""} ${isObsidianGold?styles.cosCardObsidianGold||"":""} ${isForge?styles.cosCardForge||"":""} ${isForgeGold?styles.cosCardForgeGold||"":""}`} data-rarity={co.rarity} data-crystal={isCrystal?1:0} data-volcano={isVolcano?1:0} data-obsidian={isObsidian?1:0} data-forge={isForge?1:0} onMouseEnter={onCardEnter} onMouseLeave={onCardLeave}>
                <div className={styles.cosPreview} style={co.slot==="banner"?{background:co.style}:{border:co.style, background:"rgba(255,255,255,0.04)", boxShadow: isEq && isCrystal ? "0 0 24px #38bdf8" : isEq && isVolcano ? "0 0 16px #ff5722, 0 0 28px rgba(255,87,34,0.35)" : isEq && isObsidian ? "0 0 16px #ff4500, 0 0 28px rgba(255,69,0,0.35)" : isEq && isForge ? "0 0 16px #9147ff, 0 0 28px rgba(145,71,255,0.35)" : isVolcanoGold ? "0 0 16px #ff5722" : isObsidianGold ? "0 0 16px #ff4500" : isForgeGold ? "0 0 16px #9147ff" : isForgeHolo ? "0 0 12px #9147ff" : undefined, backdropFilter: (isEq && isCrystal) || (isEq && isVolcano) || (isEq && isObsidian) || (isEq && isForge) ? "blur(6px)" : undefined, animation: isForgeGold ? "forgeSpin 3s linear infinite" : isForgeHolo ? "forgeHoloShimmer 2s ease-in-out infinite" : undefined} as any}>
                  <span className={styles.cosName}>{co.name}{isPrism?"":isGlacier?" ❄️":isCrystal?" 💎":isVolcano?" 🌋":isObsidian?" ⛏️":isForge?" 🔨":""}</span>
                  <span className={styles.cosSlot}>{co.slot}{isPrism?" · prism":isGlacier?" · glacier":isCrystal?" · crystal":isVolcano?" · volcano":isObsidian?" · obsidian":isForge?" · forge":""}</span>
                </div>
                <div className={styles.cosMeta}><span className={styles.cosRarity} style={{color:RARITY_META[co.rarity].color}}>{RARITY_META[co.rarity].label}</span><span className={styles.cosPrice}>🪙 {co.price}{isPrism?" · пыль":isGlacier && co.rarity==="legendary"?" · frost ❄️":isCrystal && co.rarity==="legendary"?" · crystal 3s":isVolcano && co.rarity==="legendary"?" · volcano 3s 🌋":isObsidian && co.rarity==="legendary"?" · molten 3s ⛏️":isForge && co.rarity==="legendary"?" · holo 3s 🔨":isForge && co.rarity==="epic"?" · holo 🔨":isForge?" · forge":isObsidian?" · obsidian":isVolcano?" · volcano":""}</span></div>
                {isOwned ? (
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {isEq ? <button type="button" className={styles.btnWear} onClick={()=>equipCosmetic(co)}>✅ Надет</button> : <button type="button" className={styles.btnWear} onClick={()=>equipCosmetic(co)}>Надеть</button>}
                    <button type="button" className={styles.btnGhost} onClick={()=>dismantle(co)} title="Разобрать → пыль">♻️ +{FORGE_IDS_SET.has(co.id) ? 100 : OBSIDIAN_IDS_SET.has(co.id) ? (co.rarity==="legendary"?420:co.rarity==="epic"?100:co.rarity==="rare"?42:14) : CRYSTAL_IDS_SET.has(co.id) ? (co.rarity==="legendary"?420:co.rarity==="epic"?100:co.rarity==="rare"?42:14) : GLACIER_IDS_SET.has(co.id) ? (co.rarity==="legendary"?420:co.rarity==="epic"?100:co.rarity==="rare"?42:14) : VOLCANO_IDS_SET.has(co.id) ? (co.rarity==="legendary"?420:co.rarity==="epic"?100:co.rarity==="rare"?42:14) : co.rarity==="legendary"?420:co.rarity==="epic"?142:co.rarity==="rare"?42:14}✨</button>
                  </div>
                ) : isPrism ? <button type="button" className={`${styles.btnBuy} ${dust>=co.price?"":styles.btnLocked}`} onClick={()=>craftPrism(co)}>✨ {co.price} пыль</button> : isGlacier ? <button type="button" className={`${styles.btnBuy} ${can?"":styles.btnLocked}`} onClick={()=>craftGlacier(co)}>❄️ {co.price} {co.rarity==="rare"?"· крафт 3×common 42":""}</button> : isCrystal ? <button type="button" className={`${styles.btnBuy} ${can?"":styles.btnLocked}`} onClick={()=>craftCrystal(co)}>💎 {co.price} {co.rarity==="rare"?"· крафт 3×common 42":co.rarity==="epic"?"· крафт 3×uncommon 142":""}</button> : isVolcano ? <button type="button" className={`${styles.btnBuy} ${can?"":styles.btnLocked}`} onClick={()=>craftVolcano(co)}>🌋 {co.price}{co.rarity==="rare"?" · крафт 3×common 42 🌋":""}</button> : isObsidian ? <button type="button" className={`${styles.btnBuy} ${can?"":styles.btnLocked}`} onClick={()=>craftObsidian(co)}>⛏️ {co.price}{co.rarity==="rare"?" · крафт 3×common 42 ⛏️":""}</button> : isForge ? <button type="button" className={`${styles.btnBuy} ${dust>=42?"":styles.btnLocked}`} onClick={()=>craftForge(co)}>🔨 42 пыль</button> : <button type="button" className={`${styles.btnBuy} ${can?"":styles.btnLocked}`} onClick={()=>buyCosmetic(co)}>🪙 {co.price}</button>}
              </div>
            );
          })}
        </div>
        {cosOwned.length>0 && <p className={styles.cosHint}>В инвентаре: {cosOwned.length}/104 · пыль: {dust} · разбор: FORGE 100 ✨ / common 14 / rare 42 / epic 100(142 PRISM)/420 · крафт FORGE 42 пыль 🔨 · PRISM за пыль · GLACIER 3×common→uncommon 42 · CRYSTAL 3×common→uncommon 42 / 3×uncommon→rare 142 · VOLCANO 3×common→uncommon 42 🌋 · OBSIDIAN 3×common→uncommon 42 ⛏️ · verified -42/нед 💎</p>}
      </section>

      {}
      <section className={styles.bundles} aria-label="Наборы 42 — выгодно">
        <div className={styles.cosHead}>
          <h2 className={styles.cosTitle}>НАБОРЫ 42 — 8 бандлов со скидкой</h2>
          <p className={styles.cosSub}>Выгоднее поштучно · −13…−33% · баланс Neon · без localStorage · POST /magnum/api/shop/bundle/buy</p>
        </div>
        <div className={styles.bundleGrid}>
          {SHOP_BUNDLES.map(b=>{
            const can=coins>=b.price; const isStarter=b.id==="bundle-starter";
            return (
              <div key={b.id} className={`${styles.bundleCard} ${isStarter?styles.bundleHit:""}`} data-rarity={b.rarity} onMouseEnter={onCardEnter} onMouseLeave={onCardLeave}>
                <div className={styles.bundleTop}>
                  <span className={styles.bundleEmoji}>{b.emoji}</span>
                  <span className={styles.bundleTag} style={{color:RARITY_META[b.rarity].color, borderColor:RARITY_META[b.rarity].color}}>{b.tag} {RARITY_META[b.rarity].label}</span>
                </div>
                <div className={styles.bundleName}>{b.name}</div>
                <p className={styles.bundleDesc}>{b.desc}</p>
                <div className={styles.bundleItems}>{b.items.map(id=><span key={id} className={styles.bundleChip}>{id}</span>)}</div>
                <div className={styles.bundlePriceRow}><span className={styles.bundlePrice}>🪙 {b.price}</span><span className={styles.bundleOrig}>{b.origPrice}</span></div>
                <button type="button" className={`${styles.btnBuy} ${can?"":styles.btnLocked}`} onClick={()=>buyBundle(b)}>{can? `Купить · 🪙 ${b.price}`:`Нужно ${b.price}`}</button>
              </div>
            );
          })}
        </div>
        <p className={styles.cosHint}>8 бандлов · скидка vs сумма поштучно · уже купленное пропускается · транзакция в magnum_transactions</p>
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